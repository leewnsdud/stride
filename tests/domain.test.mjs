import test from "node:test";
import assert from "node:assert/strict";
import { withStepMinimum, withRepeatCount } from "../shared/workout.mjs";

test("repeat count updates generated names without replacing custom instructions", () => {
  const cleared = withRepeatCount({ name: "4회 반복", count: 4 }, null);
  assert.equal(withRepeatCount(cleared, 3).name, "3회 반복");
  assert.equal(
    withRepeatCount({ name: "4회 반복", count: 4 }, 3).name,
    "3회 반복",
  );
  assert.equal(
    withRepeatCount({ name: "자세가 무너지면 중단", count: 4 }, 3).name,
    "자세가 무너지면 중단",
  );
});

test("editing a saved workout range preserves its upper bound and totals", () => {
  for (const end of ["time", "distance"]) {
    const initial = {
      id: "range",
      type: "warmup",
      name: "워밍업",
      end,
      min: 600,
      max: 900,
      condition: "always",
    };
    const edited = withStepMinimum(JSON.parse(JSON.stringify(initial)), 720);
    assert.equal(edited.max, 900);
    assert.equal(initial.min, 600);
    const totals = stepTotals([edited]);
    const key = end === "time" ? "duration" : "distance";
    const divisor = end === "time" ? 60 : 1000;
    assert.equal(totals[key].min, 720 / divisor);
    assert.equal(totals[key].max, 900 / divisor);
    assert.equal(withStepMinimum(edited, null).max, 900);
  }
  assert.deepEqual(withStepMinimum({ min: 600, max: 600 }, 720), {
    min: 720,
    max: 720,
  });
  assert.deepEqual(withStepMinimum({ min: 600, max: 600 }, 720, true), {
    min: 720,
    max: 600,
  });
});
import {
  sessionSchema,
  activitySchema,
  generatePlan,
  normalizeActivity,
  summarize,
  dateSchema,
  monday,
} from "../server/domain.mjs";
import {
  optionalNumber,
  measurementDifference,
} from "../shared/record-values.mjs";

test("optional activity measurements survive blank input and edit round trips", () => {
  const base = {
    name: "합성 러닝",
    date: "2026-09-15",
    type: "road",
    distance: 6.25,
    duration: 38.5,
  };
  for (const absent of [undefined, null, "", "  "]) {
    const record = activitySchema.parse({
      ...base,
      elevation: absent,
      hr: absent,
      rpe: absent,
    });
    assert.equal(record.elevation, null);
    assert.equal(record.hr, null);
    assert.equal(record.rpe, null);
    const edited = activitySchema.parse({
      ...record,
      hr: optionalNumber(record.hr),
      rpe: optionalNumber(record.rpe),
    });
    assert.deepEqual(edited, record);
  }
  assert.equal(activitySchema.parse({ ...base, elevation: 0 }).elevation, 0);
  assert.throws(() => activitySchema.parse({ ...base, hr: 0 }));
  assert.throws(() => activitySchema.parse({ ...base, rpe: 0 }));
  assert.throws(() => activitySchema.parse({ ...base, distance: "" }));
});
test("plan comparisons require both measurements, but preserve measured zero", () => {
  for (const missing of [null, undefined, "", NaN]) {
    assert.equal(measurementDifference(6.25, missing), null);
    assert.equal(measurementDifference(missing, 6.25), null);
  }
  assert.equal(measurementDifference(0, "0"), 0);
  assert.equal(measurementDifference(38.5, "30"), 8.5);
  assert.equal(measurementDifference("5", 6.25), -1.25);
});
test("reject impossible dates and malformed plans", () => {
  assert.throws(() => dateSchema.parse("2026-02-31"));
  assert.throws(() =>
    generatePlan({
      start: "2026-09-14",
      weeklyKm: -5,
      days: 4,
      weeks: 4,
      type: "road",
    }),
  );
});
test("weekly volume is distributed, includes recovery and never before start", () => {
  const plan = generatePlan({
    start: "2026-09-14",
    weeklyKm: 40,
    days: 4,
    weeks: 4,
    type: "trail",
  });
  assert.equal(plan.length, 16);
  assert.ok(
    Math.abs(plan.slice(0, 4).reduce((n, s) => n + s.distance, 0) - 40) < 0.3,
  );
  assert.ok(
    plan.slice(12).reduce((n, s) => n + s.distance, 0) <
      plan.slice(8, 12).reduce((n, s) => n + s.distance, 0),
  );
  assert.equal(plan.filter((s) => s.type === "trail").length, 4);
  assert.ok(
    generatePlan({
      start: "2026-09-18",
      weeklyKm: 30,
      days: 4,
      weeks: 1,
      type: "road",
    }).every((s) => s.date >= "2026-09-18"),
  );
});
test("uses local activity day and correct Garmin API units", () => {
  const a = normalizeActivity({
    id: "i1",
    start_date_local: "2026-09-11T06:00:00",
    type: "TrailRun",
    distance: 12500,
    moving_time: 4500,
    total_elevation_gain: 700,
    average_heartrate: 144,
  });
  assert.equal(a.distance, 12.5);
  assert.equal(a.duration, 75);
  assert.equal(a.type, "trail");
  assert.equal(a.date, "2026-09-11");
  assert.equal(normalizeActivity({ id: "broken" }), null);
});
test("summary respects week boundaries and missing data", () => {
  const activities = [
    { date: "2026-09-13", distance: 10, duration: 60, elevation: 100 },
    { date: "2026-09-14", distance: 80, duration: 600 },
  ];
  assert.equal(summarize([], activities, "2026-09-07").distance, 10);
  assert.equal(summarize([], [], "2026-09-07").pace, null);
  assert.equal(monday("2026-09-13"), "2026-09-07");
});

import { calendarDay } from "../src/calendar-data.mjs";
test("calendar preserves explicit links, unlinked records and cross-date records", () => {
  const sessions = [
    { id: "s1", date: "2026-09-12", activityId: "a1" },
    { id: "s2", date: "2026-09-12", activityId: "a3" },
    { id: "s3", date: "2026-09-12" },
  ];
  const activities = [
    { id: "a1", date: "2026-09-12" },
    { id: "a2", date: "2026-09-12" },
    { id: "a3", date: "2026-09-13" },
  ];
  const day = calendarDay("2026-09-12", sessions, activities);
  assert.equal(day.plans.length, 3);
  assert.equal(day.plans[0].activity.id, "a1");
  assert.deepEqual(
    day.activities.map((x) => x.activity.id),
    ["a2"],
  );
  assert.equal(
    calendarDay("2026-09-13", sessions, activities).activities[0].session.id,
    "s2",
  );
  assert.equal(
    calendarDay("2026-09-14", sessions, activities).activities.length,
    0,
  );
});

import { blankStep, stepTotals } from "../shared/workout.mjs";
import { workoutSchema } from "../server/workout.mjs";
test("nested repeats count recovery only between repetitions and preserve mixed units", () => {
  const work = { ...blankStep(), end: "distance", min: 200, max: 200 };
  const rest = {
    ...blankStep("recovery"),
    condition: "between",
    end: "time",
    min: 60,
    max: 60,
  };
  const inner = { ...blankStep("repeat"), count: 3, children: [work, rest] };
  const outer = {
    ...blankStep("repeat"),
    count: 2,
    children: [inner, { ...rest, id: "set-recovery", min: 180, max: 180 }],
  };
  const w = workoutSchema.parse({ steps: [outer] });
  const total = stepTotals(w.steps);
  assert.equal(total.distance.min, 1.2);
  assert.equal(total.duration.min, 7);
  assert.equal(total.distance.complete, false);
  assert.equal(total.duration.complete, false);
});
test("structured session validates ranges, pace, recovery placement, manual endpoints and totals", () => {
  const step = { ...blankStep(), end: "distance", min: 1000, max: 1000 };
  const base = {
    title: "검증",
    date: "2026-09-12",
    type: "interval",
    distance: 1,
    duration: null,
    elevation: null,
    workout: { steps: [step], totalKind: "exact" },
  };
  assert.equal(sessionSchema.parse(base).duration, null);
  assert.throws(() => sessionSchema.parse({ ...base, distance: 2 }));
  assert.throws(() => workoutSchema.parse({ steps: [{ ...step, min: 2000 }] }));
  assert.throws(() =>
    workoutSchema.parse({ steps: [{ ...step, condition: "between" }] }),
  );
  assert.throws(() =>
    workoutSchema.parse({
      steps: [{ ...step, end: "manual", min: null, max: null, notes: "" }],
    }),
  );
  assert.throws(() =>
    workoutSchema.parse({ intensity: { metric: "pace", low: "4:75" } }),
  );
  assert.throws(() => workoutSchema.parse({ steps: [step, step] }));
  assert.equal(
    workoutSchema.parse({
      intensity: { metric: "pace", low: "4:30", high: "4:45" },
    }).intensity.low,
    "4:30",
  );
});
test("race and time-based plans preserve unspecified distance instead of converting to zero", () => {
  const race = sessionSchema.parse({
    title: "레이스",
    type: "race",
    date: "2026-09-12",
    duration: 45,
    distance: "",
    elevation: "",
    workout: { race: { strategy: "후반 유지" }, steps: [] },
  });
  assert.equal(race.distance, null);
  assert.equal(race.elevation, null);
  assert.equal(race.workout.race.strategy, "후반 유지");
  assert.equal(
    sessionSchema.parse({
      title: "휴식",
      date: "2026-09-12",
      type: "rest",
      workout: { steps: [] },
    }).distance,
    null,
  );
});
