import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCoachedPlan,
  baselineFromActivities,
} from "../server/training-policy.mjs";
import { stepTotals } from "../shared/workout.mjs";
import { profile } from "./fixtures/planning.mjs";
const today = "2026-09-14";
test("baseline includes missing weeks rather than inferring fitness from one run", () => {
  const b = baselineFromActivities(
    [{ date: "2026-09-12", duration: 120, distance: 20, elevation: 500 }],
    today,
  );
  assert.equal(b.baselineMinutes, 0);
  assert.equal(b.longestMinutes, 120);
  assert.equal(b.weeks.length, 4);
});
test("individualized schedule respects day budgets, workload and exact structured steps", () => {
  const p = buildCoachedPlan(profile, today);
  assert.equal(p.blockers.length, 0);
  assert.equal(p.method, "pyramidal");
  assert.equal(p.weeks.length, 4);
  assert.ok(p.sessions.some((s) => s.type === "tempo"));
  for (const s of p.sessions) {
    const wd = (new Date(s.date).getUTCDay() + 6) % 7;
    assert.ok(s.duration <= profile.availability[wd]);
    assert.equal(s.distance, null);
    const t = stepTotals(s.workout.steps);
    assert.ok(t.duration.complete);
    assert.equal(t.duration.min, s.duration);
  }
  for (const w of p.weeks) {
    assert.ok(w.minutes <= profile.weeklyLimit);
    assert.ok(w.qualityMinutes <= w.minutes * 0.15);
  }
  const keys = p.sessions.filter((s) => s.workout.priority === "key");
  for (let i = 1; i < keys.length; i++)
    assert.ok(
      (Date.parse(keys[i].date) - Date.parse(keys[i - 1].date)) / 86400000 >= 2,
    );
  assert.ok(p.weeks[3].minutes < p.weeks[2].minutes);
});
test("hybrid shares the volume budget and mixes road/trail without duplicate long runs", () => {
  const p = buildCoachedPlan({ ...profile, mode: "hybrid" }, today);
  assert.ok(p.sessions.some((s) => s.type === "trail"));
  assert.ok(p.sessions.some((s) => s.type === "long"));
  for (const w of p.weeks) {
    const ss = p.sessions.filter((s) => s.date >= w.start && s.date <= w.end);
    assert.ok(ss.filter((s) => ["long", "trail"].includes(s.type)).length <= 1);
    assert.ok(w.minutes <= 360);
  }
  assert.equal(new Set(p.sessions.map((s) => s.date)).size, p.sessions.length);
});
test("hybrid trail elevation uses the trail event and preserves explicit zero", () => {
  for (const secondaryElevation of [0, 80, 4000, null]) {
    const p = buildCoachedPlan(
      {
        ...profile,
        mode: "hybrid",
        priority: "road",
        raceElevation: 10,
        secondaryElevation,
      },
      today,
    );
    const trails = p.sessions.filter((s) => s.type === "trail");
    assert.ok(trails.length);
    if (secondaryElevation !== null)
      assert.ok(trails.every((s) => s.elevation <= secondaryElevation));
    else assert.ok(trails.some((s) => s.elevation > 10));
    if (secondaryElevation === 4000)
      assert.ok(
        p.warnings.some((w) => w.includes("상승 고도 노출이 작습니다")),
      );
  }
  const noHistory = buildCoachedPlan(
    {
      ...profile,
      mode: "trail",
      priority: "trail",
      baselineElevation: 0,
      raceElevation: 8000,
    },
    today,
  );
  assert.ok(noHistory.sessions.every((s) => s.elevation === null));
});
test("beginner and ultra boundary profiles keep observed time caps and known totals", () => {
  const beginner = buildCoachedPlan(
    {
      ...profile,
      experience: "new",
      consistency: 2,
      baselineMinutes: 60,
      longestMinutes: 20,
      availability: [0, 20, 0, 20, 0, 20, 0],
      longDay: 5,
      method: "subthreshold",
    },
    today,
  );
  assert.equal(beginner.method, "foundation");
  assert.ok(beginner.sessions.length > 0);
  assert.ok(
    beginner.sessions.every((s) => s.duration <= 20 && s.type === "easy"),
  );
  assert.ok(
    beginner.weeks.every((w) => w.minutes <= 60 && w.qualityMinutes === 0),
  );
  const ultra = buildCoachedPlan(
    {
      ...profile,
      mode: "trail",
      priority: "trail",
      raceDistance: 160,
      raceElevation: 9000,
      baselineMinutes: 1800,
      weeklyLimit: 1800,
      longestMinutes: 600,
      availability: [300, 300, 300, 300, 300, 300, 0],
      longDay: 5,
    },
    today,
  );
  assert.equal(ultra.weeks.length, 4);
  assert.ok(ultra.sessions.some((s) => s.type === "trail"));
  for (const s of ultra.sessions) {
    assert.ok(s.duration <= (s.type === "trail" ? 180 : 90));
    assert.equal(s.distance, null);
    assert.equal(stepTotals(s.workout.steps).duration.min, s.duration);
  }
  assert.equal(
    buildCoachedPlan(
      { ...profile, baselineMinutes: 0, longestMinutes: 0 },
      today,
    ).sessions.length,
    0,
  );
});
test("short road races do not receive marathon-specific sessions", () => {
  const nearRace = { ...profile, raceDate: "2026-10-25" };
  const marathon = buildCoachedPlan(nearRace, today);
  assert.ok(marathon.sessions.some((s) => s.type === "marathon"));
  for (const raceDistance of [5, 10, 21.0975]) {
    const plan = buildCoachedPlan({ ...nearRace, raceDistance }, today);
    assert.ok(plan.sessions.some((s) => s.type === "tempo"));
    assert.ok(plan.sessions.every((s) => s.type !== "marathon"));
  }
});
test("pain blocks, fatigue reduces, inexperienced runners do not receive advanced intensity", () => {
  assert.equal(
    buildCoachedPlan({ ...profile, recovery: "pain" }, today).sessions.length,
    0,
  );
  const tired = buildCoachedPlan({ ...profile, recovery: "tired" }, today);
  assert.equal(tired.method, "foundation");
  assert.ok(tired.weeks.every((w) => w.minutes <= 225));
  assert.ok(
    tired.sessions.every(
      (s) => !["tempo", "hill", "interval", "marathon"].includes(s.type),
    ),
  );
  assert.equal(
    buildCoachedPlan(
      { ...profile, experience: "new", method: "polarized" },
      today,
    ).method,
    "foundation",
  );
});
test("first event truncates plans and taper is not a long-run spike", () => {
  const p = buildCoachedPlan(
    { ...profile, mode: "hybrid", secondaryDate: "2026-09-27" },
    today,
  );
  assert.ok(p.sessions.every((s) => s.date < "2026-09-27"));
  assert.ok(p.weeks.every((w) => w.phase === "테이퍼"));
  assert.ok(p.weeks[1].minutes <= p.weeks[0].minutes);
});
test("fatigue and short sleep cannot override the stricter pre-race taper", () => {
  for (const raceDate of ["2026-09-20", "2026-09-27"]) {
    const ready = buildCoachedPlan({ ...profile, raceDate }, today);
    for (const recovery of [{ recovery: "tired" }, { sleep: 5 }]) {
      const reduced = buildCoachedPlan(
        { ...profile, raceDate, ...recovery },
        today,
      );
      for (let i = 0; i < reduced.weeks.length; i++) {
        assert.ok(reduced.weeks[i].minutes <= ready.weeks[i].minutes);
        const daysToRace =
          (Date.parse(raceDate) - Date.parse(reduced.weeks[i].start)) /
          86400000;
        assert.ok(
          reduced.weeks[i].minutes <=
            profile.baselineMinutes * (daysToRace <= 7 ? 0.5 : 0.7),
        );
      }
      assert.ok(
        reduced.sessions.every(
          (s) => !["tempo", "interval", "hill", "marathon"].includes(s.type),
        ),
      );
    }
  }
});
test("race-relative final days never contain a long or quality run, and fatigue means rest", () => {
  for (let raceOffset = 1; raceOffset <= 14; raceOffset++) {
    const raceDate = new Date(Date.parse(today) + raceOffset * 86400000)
      .toISOString()
      .slice(0, 10);
    const lastTwo = (s) =>
      Date.parse(raceDate) - Date.parse(s.date) <= 2 * 86400000;
    for (const longDay of [1, 3, 4, 5, 6]) {
      const ready = buildCoachedPlan({ ...profile, raceDate, longDay }, today);
      assert.ok(
        ready.sessions
          .filter(lastTwo)
          .every((s) => s.type === "easy" && s.duration <= 20),
      );
      for (const recovery of [{ recovery: "tired" }, { sleep: 5 }]) {
        const tired = buildCoachedPlan(
          { ...profile, raceDate, longDay, ...recovery },
          today,
        );
        assert.equal(tired.sessions.filter(lastTwo).length, 0);
        for (const s of tired.sessions) {
          const sameDay = ready.sessions.find((r) => r.date === s.date);
          assert.ok(
            sameDay && s.duration <= sameDay.duration,
            "recovery must not redistribute removed time into a larger run",
          );
        }
      }
    }
  }
});
test("new descending exposure has no additional speed session that week", () => {
  const p = buildCoachedPlan(
    { ...profile, mode: "trail", priority: "trail", descent: "new" },
    today,
  );
  assert.ok(p.sessions.some((s) => s.type === "trail"));
  assert.ok(
    !p.sessions.some((s) => ["hill", "interval", "tempo"].includes(s.type)),
  );
});
test("varied start weekdays, sparse availability and methods keep all hard-day gaps and caps", () => {
  for (const start of ["2026-09-14", "2026-09-16", "2026-09-20"])
    for (const mode of ["road", "trail", "hybrid"])
      for (const method of ["foundation", "pyramidal", "polarized"]) {
        const v = {
          ...profile,
          start,
          mode,
          method,
          availability: [0, 40, 0, 45, 0, 30, 100],
          longDay: 6,
        };
        const p = buildCoachedPlan(v, today);
        assert.ok(p.sessions.every((s) => s.date >= start));
        for (const w of p.weeks) assert.ok(w.minutes <= 215);
        const keys = p.sessions.filter((s) => s.workout.priority === "key");
        for (let i = 1; i < keys.length; i++)
          assert.ok(
            (Date.parse(keys[i].date) - Date.parse(keys[i - 1].date)) /
              86400000 >=
              2,
          );
      }
});

test("controlled subthreshold is an opt-in single session with experience gates", () => {
  const p = buildCoachedPlan(
    { ...profile, method: "subthreshold", consistency: 16 },
    today,
  );
  assert.equal(p.method, "subthreshold");
  const quality = p.sessions.filter((s) => s.type === "tempo");
  assert.ok(quality.length > 0);
  assert.ok(
    quality.every((s) => s.workout.steps[1].children[0].intensity.high === "6"),
  );
  for (const week of p.weeks)
    assert.ok(week.qualityMinutes <= week.minutes * 0.15);
  assert.equal(
    buildCoachedPlan(
      { ...profile, method: "subthreshold", consistency: 8 },
      today,
    ).method,
    "foundation",
  );
  assert.equal(
    buildCoachedPlan(
      { ...profile, method: "subthreshold", recovery: "tired" },
      today,
    ).method,
    "foundation",
  );
});
test("trail approaches produce distinct exact steps and respect recovery and terrain", () => {
  for (const approach of ["aerobic", "uphill", "course"]) {
    const p = buildCoachedPlan(
      {
        ...profile,
        mode: "trail",
        priority: "trail",
        trailApproach: approach,
        descent: "experienced",
      },
      today,
    );
    assert.equal(p.trailApproach, approach);
    const runs = p.sessions.filter((s) => s.type === "trail");
    assert.ok(runs.length > 0);
    for (const s of runs) {
      assert.ok(s.workout.steps.length >= 4);
      assert.equal(stepTotals(s.workout.steps).duration.min, s.duration);
    }
    if (approach === "course")
      assert.ok(runs[0].workout.steps.some((s) => s.id === "descent"));
    if (approach === "uphill")
      assert.ok(
        runs[0].workout.steps.some((s) => s.name.includes("중량 추가 없음")),
      );
  }
  for (const override of [
    { descent: "new" },
    { terrain: "flat" },
    { recovery: "tired" },
  ]) {
    const p = buildCoachedPlan(
      { ...profile, mode: "trail", trailApproach: "course", ...override },
      today,
    );
    assert.equal(p.trailApproach, "aerobic");
  }
});
