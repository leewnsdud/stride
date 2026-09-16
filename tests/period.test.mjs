import test from "node:test";
import assert from "node:assert/strict";
import {
  periodBounds,
  movePeriod,
  summarizePeriod,
} from "../shared/period.mjs";
test("period boundaries use Monday weeks and calendar months including leap years", () => {
  assert.deepEqual(periodBounds("2026-09-20", "week"), {
    start: "2026-09-14",
    end: "2026-09-21",
    last: "2026-09-20",
  });
  assert.deepEqual(periodBounds("2024-02-29", "month"), {
    start: "2024-02-01",
    end: "2024-03-01",
    last: "2024-02-29",
  });
  assert.equal(movePeriod("2026-01-31", "month", 1), "2026-02-01");
  assert.equal(movePeriod("2026-01-01", "month", -1), "2025-12-01");
  assert.equal(movePeriod("2026-01-01", "week", -1), "2025-12-22");
});
test("selected period includes its last date, excludes next period, and reports unknown planned distance", () => {
  const runs = [
    { date: "2026-09-01", distance: 5, elevation: 20 },
    { date: "2026-09-30", distance: 10, elevation: 100 },
    { date: "2026-10-01", distance: 99, elevation: 999 },
  ];
  const plans = [
    { date: "2026-09-30", type: "long", distance: null, activityId: "a" },
    { date: "2026-09-01", type: "easy", distance: 10 },
    { date: "2026-09-02", type: "rest", distance: 0 },
    { date: "2026-10-01", type: "long", distance: 20 },
  ];
  const p = summarizePeriod(runs, plans, "2026-09-14", "month");
  assert.equal(p.distance, 15);
  assert.equal(p.elevation, 120);
  assert.equal(p.completed, 1);
  assert.equal(p.plans.length, 2);
  assert.equal(p.unknownDistance, true);
  assert.equal(p.days.length, 30);
  assert.equal(p.days.at(-1).distance, 10);
  assert.equal(summarizePeriod(runs, plans, "2026-09-14", "week").distance, 0);
});

test("inclusive recent-day and query ranges cross month and year boundaries", async () => {
  const { recentDays, inDateRange } = await import("../shared/period.mjs");
  const r = recentDays("2026-01-01");
  assert.deepEqual(r, { start: "2025-12-30", end: "2026-01-01" });
  assert.equal(inDateRange("2025-12-30", r), true);
  assert.equal(inDateRange("2026-01-01", r), true);
  assert.equal(inDateRange("2026-01-02", r), false);
  assert.equal(inDateRange("2025-12-29", r), false);
  assert.equal(inDateRange("2020-01-01", null), true);
});
test("monthly trend includes current and previous two calendar months exactly once", async () => {
  const { trendPeriods } = await import("../shared/period.mjs");
  const runs = [
    { date: "2025-10-31", distance: 99 },
    { date: "2025-11-01", distance: 3, type: "road" },
    { date: "2025-12-31", distance: 4, type: "trail" },
    { date: "2026-01-01", distance: 5, type: "road" },
    { date: "2026-02-01", distance: 99 },
  ];
  const c = trendPeriods(
    runs,
    [{ date: "2025-12-01", distance: 6, type: "easy" }],
    "2026-01-15",
    "month",
  );
  assert.deepEqual(
    c.map((x) => x.label),
    ["2025.11", "2025.12", "2026.1"],
  );
  assert.deepEqual(
    c.map((x) => x.distance),
    [3, 4, 5],
  );
  assert.deepEqual(
    c.map((x) => x.count),
    [1, 1, 1],
  );
  assert.equal(c[1].planned, 6);
  assert.equal(c[1].trail, 4);
});
test("weekly trend is anchored to today and includes empty weeks", async () => {
  const { trendPeriods } = await import("../shared/period.mjs");
  const c = trendPeriods(
    [{ date: "2026-09-15", distance: 2 }],
    [],
    "2026-09-15",
    4,
  );
  assert.equal(c.length, 4);
  assert.equal(c.at(-1).start, "2026-09-14");
  assert.equal(c.at(-1).end, "2026-09-21");
  assert.deepEqual(
    c.map((x) => x.count),
    [0, 0, 0, 1],
  );
});

test("selected month returns daily mileage, preserves empty days and excludes adjacent months", async () => {
  const { monthDays } = await import("../shared/period.mjs");
  const c = monthDays(
    [
      { date: "2024-01-31", distance: 99 },
      { date: "2024-02-01", distance: 3, type: "road", elevation: 10 },
      { date: "2024-02-29", distance: 7, type: "trail", elevation: 80 },
      { date: "2024-03-01", distance: 99 },
    ],
    [{ date: "2024-02-29", distance: 8, type: "easy" }],
    "2024-02-15",
  );
  assert.equal(c.length, 29);
  assert.equal(c[0].distance, 3);
  assert.equal(c[1].distance, 0);
  assert.equal(c[28].label, "29일");
  assert.equal(c[28].planned, 8);
  assert.equal(
    c.reduce((n, d) => n + d.distance, 0),
    10,
  );
  assert.equal(
    c.reduce((n, d) => n + d.count, 0),
    2,
  );
  assert.equal(
    c.reduce((n, d) => n + d.elevation, 0),
    90,
  );
});
