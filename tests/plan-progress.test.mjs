import test from "node:test";
import assert from "node:assert/strict";
import { planProgress, planSessionStatus } from "../shared/plan-progress.mjs";
test("rest days cannot prevent full completion or become overdue workouts", () => {
  const activities = [{ id: "run" }];
  const sessions = [
    { date: "2026-09-13", type: "easy", activityId: "run" },
    { date: "2026-09-14", type: "rest" },
    { date: "2026-09-16", type: "rest" },
  ];
  assert.deepEqual(planProgress(sessions, activities, "2026-09-15"), {
    planned: 1,
    completed: 1,
    rest: 2,
    upcoming: 0,
  });
  assert.equal(
    planSessionStatus(sessions[1], activities, "2026-09-15"),
    "휴식",
  );
});
test("missing or deleted activity links are not proof of completion or failure", () => {
  const past = { date: "2026-09-14", type: "easy", activityId: "deleted" };
  const future = { date: "2026-09-16", type: "easy" };
  assert.equal(planSessionStatus(past, [], "2026-09-15"), "기록 미연결");
  assert.equal(planSessionStatus(future, [], "2026-09-15"), "예정");
  assert.deepEqual(planProgress([past, future], [], "2026-09-15"), {
    planned: 2,
    completed: 0,
    rest: 0,
    upcoming: 1,
  });
});
