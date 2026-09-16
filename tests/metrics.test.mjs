import test from "node:test";
import assert from "node:assert/strict";
import { reviewContext } from "../server/activity-review.mjs";
import { zoneDistribution } from "../shared/zone-distribution.mjs";
test("zone display preserves measured zero and never normalizes incomplete durations", () => {
  assert.deepEqual(zoneDistribution(null), []);
  const zeros = zoneDistribution([
    { zone: 1, seconds: 0 },
    { zone: 2, seconds: 0 },
  ]);
  assert.equal(zeros.length, 2);
  assert.deepEqual(
    zeros.map((z) => [z.seconds, z.percent]),
    [
      [0, null],
      [0, null],
    ],
  );
  const partial = zoneDistribution([
    { zone: 1, seconds: 60 },
    { zone: 2, seconds: null },
  ]);
  assert.deepEqual(
    partial.map((z) => [z.seconds, z.percent]),
    [
      [60, null],
      [null, null],
    ],
  );
  const complete = zoneDistribution([
    { zone: 1, seconds: 60 },
    { zone: 2, seconds: 180 },
    { zone: 3, seconds: 0 },
  ]);
  assert.deepEqual(
    complete.map((z) => z.percent),
    [25, 75, 0],
  );
});
import {
  normalizeGarmin,
  normalizeGarminDetail,
  kilometerSplits,
  analyzePoints,
} from "../server/metrics.mjs";
test("review context excludes GPS, raw payloads and unlisted fields", () => {
  const c = reviewContext(
    {
      name: "run",
      raw: { secret: "private" },
      stats: { cadence: 170, token: "secret" },
    },
    {
      points: [{ time: 1, hr: 140, lat: 37.5, lon: 127 }],
      laps: [{ duration: 300, latitude: 37.5 }],
      raw: { credentials: "secret" },
    },
    null,
    null,
  );
  assert.equal(c.stats.cadence, 170);
  assert.equal(c.samples[0].hr, 140);
  assert.equal(c.samples[0].lat, undefined);
  assert.equal(c.laps[0].latitude, undefined);
  assert.equal(JSON.stringify(c).includes("secret"), false);
});
test("Garmin summary preserves missing measurements and distinguishes duration clocks", () => {
  const a = normalizeGarmin({
    activityId: 12,
    activityType: { typeKey: "trail_running" },
    startTimeLocal: "2026-09-10T23:50:00",
    distance: 12500,
    duration: 3600,
    movingDuration: 3500,
    elapsedDuration: 3800,
    averageHR: 145,
  });
  assert.equal(a.distance, 12.5);
  assert.equal(a.duration, 60);
  assert.equal(a.type, "trail");
  assert.equal(a.date, "2026-09-10");
  assert.equal(a.stats.movingSeconds, 3500);
  assert.equal(a.elevation, null);
  assert.equal(a.stats.cadence, null);
  assert.equal(normalizeGarmin({ activityId: 1, distance: 0 }), null);
});
test("descriptors determine indexes, SI values are not multiplied by metadata factors", () => {
  const x = normalizeGarminDetail({
    details: {
      metricDescriptors: [
        { key: "directHeartRate", metricsIndex: 4, unit: { factor: 1 } },
        { key: "directTimestamp", metricsIndex: 0 },
        { key: "sumElapsedDuration", metricsIndex: 1, unit: { factor: 1000 } },
        { key: "directSpeed", metricsIndex: 2, unit: { factor: 0.1 } },
        { key: "sumDistance", metricsIndex: 3, unit: { factor: 100 } },
        { key: "directDoubleCadence", metricsIndex: 5 },
        { key: "invalid", metricsIndex: -1 },
      ],
      activityDetailMetrics: [
        { metrics: [1720000000000, 0, 3, 0, 140, 176] },
        { metrics: [1720000010000, 10, null, 30, null, 178] },
        { metrics: [null, null, 3, 60] },
      ],
    },
  });
  assert.equal(x.points.length, 2);
  assert.equal(x.points[0].time, 0);
  assert.equal(x.points[0].speed, 3);
  assert.equal(x.points[0].pace, 1000 / 180);
  assert.equal(x.points[1].distance, 30);
  assert.equal(x.points[1].hr, null);
  assert.equal(x.points[1].pace, null);
  assert.equal(x.points[0].cadence, 176);
});
test("km interpolation uses timer time, retains final partial split and rejects recording gaps", () => {
  const ps = Array.from({ length: 26 }, (_, i) => ({
    time: i * 10,
    timer: i * 8,
    distance: i * 100,
  }));
  const splits = kilometerSplits(ps);
  assert.equal(splits.length, 3);
  assert.equal(splits[0].duration, 80);
  assert.equal(splits[2].distance, 500);
  assert.equal(splits[2].pace, 80 / 60);
  assert.deepEqual(
    kilometerSplits([ps[0], { time: 500, timer: 100, distance: 1000 }]),
    [],
  );
  assert.deepEqual(
    kilometerSplits([{ time: 0, timer: 0, distance: 100 }, ps.at(-1)]),
    [],
  );
});
test("laps, zones and endpoint gaps remain independently usable", () => {
  const x = normalizeGarminDetail({
    laps: {
      lapDTOs: [
        {
          duration: 300,
          distance: 1000,
          averageHR: 150,
          intensityType: "active",
        },
      ],
    },
    hrZones: [{ zoneNumber: 2, secsInZone: 200, zoneLowBoundary: 130 }],
    errors: { weather: "unavailable" },
  });
  assert.equal(x.laps[0].pace, 5);
  assert.equal(x.laps[0].power, null);
  assert.equal(x.hrZones[0].seconds, 200);
  assert.deepEqual(x.points, []);
  assert.equal(x.errors.weather, "unavailable");
  assert.equal(
    analyzePoints([
      { time: 0, distance: 0, altitude: 0 },
      { time: 10, distance: 50, altitude: 5 },
      { time: 90, distance: 100, altitude: 10 },
    ]).uphillSeconds,
    10,
  );
});

test("pace chart scale excludes zero and handles outliers without changing measurements", async () => {
  const { paceRange } = await import("../shared/chart-range.mjs");
  const values = Array.from({ length: 100 }, (_, i) => 4.2 + i * 0.01);
  values.push(0.1, 80);
  const before = [...values],
    r = paceRange(values);
  assert.ok(r.domain[0] > 0);
  assert.ok(r.domain[1] < 8);
  assert.ok(r.clipped);
  assert.ok(r.ticks.every((t) => t > 0));
  assert.deepEqual(values, before);
  const steady = paceRange([5, 5, 5]);
  assert.ok(steady.domain[0] < 5 && steady.domain[1] > 5);
});
