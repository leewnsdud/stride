import test from "node:test";
import assert from "node:assert/strict";
import { buildCoachedPlan } from "../server/training-policy.mjs";
import { stepTotals } from "../shared/workout.mjs";
import { profile } from "./fixtures/planning.mjs";

export const experienced = {
  ...profile,
  experience: "experienced",
  consistency: 52,
  baselineMinutes: 600,
  baselineKm: 110,
  longestMinutes: 150,
  qualityDaysPerWeek: 2,
  qualityMinutesPerWeek: 80,
  availability: [60, 100, 80, 100, 60, 70, 180],
  weeklyLimit: 660,
  raceDate: "2026-11-01",
  objective: "performance",
  targetMinutes: 159,
};
const today = "2026-09-14";
function invariants(plan, input) {
  assert.equal(plan.blockers.length, 0);
  assert.equal(plan.weeks.length, 4);
  for (const week of plan.weeks) {
    const sessions = plan.sessions.filter(
      (s) => s.date >= week.start && s.date <= week.end,
    );
    assert.equal(
      week.minutes,
      sessions.reduce((sum, s) => sum + s.duration, 0),
    );
    assert.ok(week.minutes > 0 && week.minutes <= input.weeklyLimit);
    assert.ok(
      week.qualityMinutes <= week.minutes * plan.capacity.qualityFraction,
    );
    assert.ok(week.elevation <= input.baselineElevation * 1.03 ** 2);
    for (const s of sessions) {
      assert.equal(stepTotals(s.workout.steps).duration.min, s.duration);
      assert.equal(stepTotals(s.workout.steps).duration.complete, true);
      assert.equal(s.distance, null);
      assert.ok(
        s.duration <=
          input.availability[(new Date(s.date).getUTCDay() + 6) % 7],
      );
    }
  }
  const keys = plan.sessions.filter((s) => s.workout.priority === "key");
  for (let i = 1; i < keys.length; i++)
    assert.ok(
      (Date.parse(keys[i].date) - Date.parse(keys[i - 1].date)) / 86400000 >= 2,
    );
}
test("walk-run entry works without inventing a running baseline, including recovery week", () => {
  const input = {
    ...profile,
    experience: "new",
    consistency: 0,
    qualityExperience: false,
    baselineMinutes: 0,
    longestMinutes: 0,
    walkingMinutes: 20,
    raceDistance: 10,
    strength: "none",
  };
  const plan = buildCoachedPlan(input, today);
  invariants(plan, input);
  for (const w of plan.weeks)
    assert.ok(w.sessions <= 3 && w.minutes <= 60 && w.qualityMinutes === 0);
  assert.ok(
    plan.sessions.every(
      (s) =>
        s.duration <= 20 &&
        s.workout.steps.some((step) => step.id === "run-walk"),
    ),
  );
  assert.ok(
    buildCoachedPlan({ ...input, walkingMinutes: null }, today).blockers.length,
  );
});
test("performance examples and neighboring targets receive event-specific training from demonstrated capacity", () => {
  for (const [distance, target] of [
    [5, 17],
    [10, 33],
    [15, 53],
    [21.0975, 80],
    [42.195, 179],
    [42.195, 159],
    [42.195, 195],
  ]) {
    const input = {
      ...experienced,
      raceDistance: distance,
      targetMinutes: target,
    };
    const plan = buildCoachedPlan(input, today);
    invariants(plan, input);
    assert.ok(plan.weeks[0].minutes >= input.baselineMinutes * 0.95);
    const first = plan.sessions.filter((s) => s.date <= plan.weeks[0].end);
    assert.equal(
      first.filter((s) => ["tempo", "interval", "marathon"].includes(s.type))
        .length,
      2,
    );
    assert.ok(first.some((s) => s.type === "tempo"));
    if (distance <= 15) assert.ok(first.some((s) => s.type === "interval"));
    if (distance >= 40 && distance <= 45)
      assert.ok(first.some((s) => s.type === "marathon"));
    else assert.ok(!plan.sessions.some((s) => s.type === "marathon"));
  }
});
test("goal ambition alone never promotes load or bypasses recovery and intensity history", () => {
  const a = buildCoachedPlan({ ...experienced, targetMinutes: 179 }, today);
  const b = buildCoachedPlan({ ...experienced, targetMinutes: 159 }, today);
  assert.deepEqual(a.weeks, b.weeks);
  const one = buildCoachedPlan(
    { ...experienced, qualityDaysPerWeek: 1, qualityMinutesPerWeek: 20 },
    today,
  );
  assert.ok(one.weeks.every((w) => w.qualityMinutes <= 22));
  const tired = buildCoachedPlan(
    {
      ...experienced,
      recovery: "tired",
      availability: [0, 100, 80, 100, 60, 70, 180],
    },
    today,
  );
  assert.ok(
    tired.weeks.every((w) => w.qualityMinutes === 0 && w.minutes <= 450),
  );
  assert.ok(
    buildCoachedPlan({ ...experienced, recovery: "pain" }, today).blockers
      .length,
  );
});
test("trail distance and established mountain exposure scale duration, climbing and race logistics", () => {
  for (const [distance, gain, minutes, longest] of [
    [20, 1200, 600, 150],
    [55, 3200, 720, 210],
    [105, 6000, 900, 270],
    [171, 10000, 1000, 300],
  ]) {
    const input = {
      ...experienced,
      mode: "trail",
      priority: "trail",
      raceDistance: distance,
      raceElevation: gain,
      targetMinutes: distance * 10,
      baselineMinutes: minutes,
      baselineElevation: distance >= 80 ? 6000 : 1500,
      longestMinutes: longest,
      weeklyLimit: 1100,
      availability: [60, 150, 150, 150, 90, 120, 360],
      nightRunning: true,
    };
    const plan = buildCoachedPlan(input, today);
    invariants(plan, input);
    assert.ok(plan.weeks[0].minutes >= minutes * 0.95);
    assert.ok(plan.weeks[0].elevation > input.baselineElevation * 0.9);
    assert.ok(plan.sessions.some((s) => s.notes.includes("야간 구간")));
    if (distance >= 80) {
      assert.ok(
        plan.sessions.some((s) => s.duration >= 270 && s.type === "trail"),
      );
      assert.ok(plan.sessions.some((s) => s.notes.includes("보급소")));
      assert.equal(plan.capacity.qualityDays, 1);
    }
    for (const s of plan.sessions) assert.ok((s.elevation || 0) <= gain);
  }
});

test("experienced doubles preserve daily totals and historical frequency, with one easy second run", () => {
  const input = {
    ...experienced,
    baselineMinutes: 1000,
    weeklyLimit: 1100,
    availability: [150, 180, 150, 180, 150, 150, 180],
    currentRunsPerWeek: 10,
    allowDoubles: true,
  };
  const plan = buildCoachedPlan(input, today);
  invariants(plan, input);
  assert.equal(plan.weeks[0].minutes, 1000);
  assert.equal(plan.weeks[0].sessions, 10);
  for (const w of plan.weeks) {
    assert.ok(w.sessions <= 10);
    const runs = plan.sessions.filter(
      (s) => s.date >= w.start && s.date <= w.end,
    );
    for (const date of new Set(runs.map((s) => s.date))) {
      const daily = runs.filter((s) => s.date === date);
      assert.ok(daily.length <= 2);
      assert.ok(
        daily.reduce((n, s) => n + s.duration, 0) <=
          input.availability[(new Date(date).getUTCDay() + 6) % 7],
      );
      if (daily.length === 2) {
        assert.equal(daily[1].type, "easy");
        assert.equal(daily[1].workout.priority, "normal");
        assert.match(daily[1].notes, /6시간/);
      }
    }
  }
  for (const changes of [
    { allowDoubles: false },
    { recovery: "tired" },
    { raceDate: "2026-09-27" },
  ]) {
    const reduced = buildCoachedPlan({ ...input, ...changes }, today);
    assert.ok(reduced.weeks.every((w) => w.sessions <= 7));
  }
  assert.throws(() =>
    buildCoachedPlan({ ...input, currentRunsPerWeek: null }, today),
  );
  assert.throws(() =>
    buildCoachedPlan({ ...input, currentRunsPerWeek: 9.5 }, today),
  );
});

test("capacity gates use training history, preserve zero quality and describe the actual event", () => {
  const zero = buildCoachedPlan(
    { ...experienced, qualityDaysPerWeek: 0, qualityMinutesPerWeek: 0 },
    today,
  );
  assert.ok(zero.weeks.every((w) => w.qualityMinutes === 0));
  const beginner = buildCoachedPlan(
    { ...experienced, experience: "new" },
    today,
  );
  assert.ok(beginner.blockers.length);
  const short = buildCoachedPlan(
    { ...experienced, raceDistance: 10, targetMinutes: 33 },
    today,
  );
  assert.ok(!short.roadmap.some((r) => r.text.includes("마라톤")));
  const unprepared = buildCoachedPlan(
    {
      ...profile,
      mode: "trail",
      priority: "trail",
      raceDistance: 171,
      raceElevation: 10000,
    },
    today,
  );
  assert.ok(unprepared.warnings.some((s) => s.includes("준비 완료")));
  assert.ok(unprepared.sessions.every((s) => s.duration <= 180));
  const hybrid = buildCoachedPlan(
    {
      ...experienced,
      mode: "hybrid",
      priority: "road",
      secondaryDate: "2026-12-01",
      secondaryDistance: 105,
      secondaryElevation: 6000,
      baselineElevation: 2000,
    },
    today,
  );
  assert.ok(
    hybrid.sessions
      .filter((s) => s.type === "long")
      .every((s) => !s.notes.includes("보급소")),
  );
});
