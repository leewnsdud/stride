import test from "node:test";
import assert from "node:assert/strict";
import { activityEvidence, scenarioFor } from "../server/coaching-analysis.mjs";
import { coachContext, scopeSchema } from "../server/coaching-context.mjs";
import { coachingSkill } from "../server/coaching-skill.mjs";
const a = {
  id: "a",
  name: "Run",
  date: "2026-09-12",
  type: "road",
  distance: 4,
  duration: 20,
  elevation: 0,
  rpe: 3,
};
const points = Array.from({ length: 121 }, (_, i) => ({
  time: i * 10,
  timer: i * 10,
  distance: (i * 1000) / 30,
  pace: 5,
  hr: 140,
  altitude: 0,
  lat: 37,
  lon: 127,
}));
const workout = {
  purpose: "easy",
  totalKind: "exact",
  steps: [],
  intensity: { metric: "hr", low: "130", high: "150" },
};
test("full-resolution intensity calculation respects clock units, missing samples and mixed steps", () => {
  const e = activityEvidence(
    a,
    { points },
    { distance: 5, duration: 25, elevation: 0, workout },
  );
  assert.equal(e.averagePaceSecondsPerKm, 300);
  assert.equal(e.sessionRpeLoadAu, 60);
  assert.equal(e.planComparison.distance.percentOfPlan, 80);
  assert.equal(e.planComparison.elevation.percentOfPlan, null);
  assert.equal(e.intensity.inRangeSeconds, 1200);
  assert.equal(e.intensity.coveragePercent, 100);
  assert.equal(e.pacing.laterSlowerPercent, 0);
  const sparse = activityEvidence(
    a,
    { points: points.filter((_, i) => i % 6 === 0) },
    { workout },
  );
  assert.equal(sparse.intensity.coveredSeconds, 0);
  assert.equal(sparse.intensity.percentOfCovered, null);
  assert.equal(sparse.intensity.suitableForOverallAssessment, false);
  assert.equal(
    activityEvidence(a, { points }, { workout: { ...workout, steps: [{}] } })
      .intensity,
    null,
  );
  assert.equal(
    activityEvidence({ ...a, rpe: null }, null, null).sessionRpeLoadAu,
    null,
  );
});
test("races require declared intent; trail race loads both references", () => {
  assert.equal(scenarioFor({ ...a, name: "FAST MARATHON" }, null).race, false);
  const scenario = scenarioFor({ ...a, type: "trail" }, { type: "race" });
  const s = coachingSkill({ activity: a, scenario });
  assert.deepEqual(s.modes, ["road", "race", "trail"]);
  assert.ok(s.instructions.includes("35213820"));
  assert.deepEqual(
    coachingSkill({ scope: { kind: "period" }, activities: [] }).modes,
    ["road", "period"],
  );
});
test("unavailable heart-rate zones remain unknown rather than zero seconds", () => {
  for (const detail of [
    null,
    { hrZones: [] },
    { hrZones: [{ zone: 1, seconds: null }] },
  ]) {
    const c = activityEvidence(a, detail, null).coverage;
    assert.equal(c.hrZoneSeconds, null);
    assert.equal(c.hrZonePercentOfTimer, null);
  }
  const zero = activityEvidence(
    a,
    { hrZones: [{ zone: 1, seconds: 0 }] },
    null,
  ).coverage;
  assert.equal(zero.hrZoneSeconds, 0);
  assert.equal(zero.hrZonePercentOfTimer, 0);
});
test("period boundaries, prior equal period and explicit links are independent of dates", () => {
  const records = [
    { ...a, detail: { points, stats: { secret: "private" } } },
    { ...a, id: "prior", date: "2026-09-10", distance: 6, rpe: null },
    { ...a, id: "outside", date: "2026-09-14" },
  ];
  const sessions = [
    { id: "rest", date: "2026-09-11", type: "rest" },
    { id: "s", date: "2026-09-11", type: "easy", activityId: "a", distance: 5 },
    { id: "unlinked", date: "2026-09-12", type: "easy", distance: 5 },
    { id: "future", date: "2026-09-13", type: "easy" },
  ];
  const c = coachContext({
    activities: records,
    sessions,
    goals: [],
    scope: { kind: "period", start: "2026-09-11", end: "2026-09-13" },
    today: "2026-09-12",
    demo: false,
  });
  assert.equal(c.summary.activities, 1);
  assert.equal(c.summary.distance.total, 4);
  assert.equal(c.summary.linkedSessions, 1);
  assert.equal(c.summary.plannedSessions, 3);
  assert.equal(c.summary.pastSessionsWithoutLinkedActivity, 0);
  assert.equal(c.summary.upcomingSessions, 2);
  assert.equal(c.summary.unlinkedActivities, 0);
  assert.equal(c.previousPeriod.start, "2026-09-08");
  assert.equal(c.previousPeriod.end, "2026-09-10");
  assert.equal(c.previousPeriod.distance.total, 6);
  assert.equal(c.previousPeriod.rpeLoadAu, null);
  assert.equal(c.activities[0].plannedSession.distance, 5);
  assert.equal(c.activities[0].samples, undefined);
  assert.ok(!JSON.stringify(c).includes("private"));
  assert.ok(!JSON.stringify(c).includes('"lat"'));
});
test("invalid, excessive and empty scopes cannot quietly turn into recent data", () => {
  for (const scope of [
    { kind: "period", start: "2026-02-30", end: "2026-03-02" },
    { kind: "period", start: "2026-09-12", end: "2026-09-11" },
    { kind: "period", start: "2026-01-01", end: "2026-09-01" },
  ])
    assert.equal(scopeSchema.safeParse(scope).success, false);
  const base = {
    activities: [a],
    sessions: [],
    goals: [],
    today: "2026-09-15",
    demo: false,
  };
  assert.throws(
    () =>
      coachContext({
        ...base,
        scope: { kind: "activity", activityId: "absent" },
      }),
    /선택한 활동/,
  );
  assert.equal(
    coachContext({
      ...base,
      scope: { kind: "period", start: "2026-01-01", end: "2026-01-02" },
    }).summary.activities,
    0,
  );
  assert.throws(
    () =>
      coachContext({
        ...base,
        activities: Array.from({ length: 201 }, () => a),
        scope: { kind: "recent" },
      }),
    /200개/,
  );
});

test("unattached questions contain no fresh personal records", () => {
  const c = coachContext({
    activities: [a],
    sessions: [{ notes: "private" }],
    goals: [{ name: "private" }],
    scope: { kind: "none" },
    today: "2026-09-15",
    demo: false,
  });
  assert.deepEqual(Object.keys(c).sort(), ["demo", "scope", "today"]);
  assert.deepEqual(coachingSkill(c).modes, []);
  assert.equal(scopeSchema.parse({ kind: "none" }).kind, "none");
});
