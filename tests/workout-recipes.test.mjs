import test from "node:test";
import assert from "node:assert/strict";
import { workoutRecipes, applyRecipe } from "../shared/workout-recipes.mjs";
import { stepTotals } from "../shared/workout.mjs";
import { sessionSchema } from "../server/domain.mjs";

test("every purpose recipe produces a valid editable session and fresh nested IDs", () => {
  for (const r of workoutRecipes) {
    const base = { title: "", date: "2026-09-14", type: r.type };
    const a = applyRecipe(base, r.id),
      b = applyRecipe(base, r.id);
    sessionSchema.parse(a);
    const ids = (s) => s.flatMap((n) => [n.id, ...ids(n.children || [])]);
    assert.equal(
      new Set(ids(a.workout.steps)).size,
      ids(a.workout.steps).length,
    );
    assert.ok(
      !ids(a.workout.steps).some((id) => ids(b.workout.steps).includes(id)),
    );
    const total = stepTotals(a.workout.steps);
    if (total.duration.complete) assert.equal(a.duration, total.duration.min);
    else assert.equal(a.duration, null);
  }
});
test("between-repetition recovery is omitted only on final repeat; run-hike retains every hike", () => {
  assert.equal(applyRecipe({ type: "tempo" }, "cruise").duration, 39);
  assert.equal(applyRecipe({ type: "trail" }, "run-hike").duration, 40);
  assert.equal(
    Math.round(applyRecipe({ type: "easy" }, "strides").duration * 60),
    2180,
  );
});
test("open hill recoveries never become an invented total and replacing clears stale amounts", () => {
  const s = applyRecipe(
    {
      type: "hill",
      distance: 15,
      duration: 90,
      title: "My hill",
      workout: { timeSlot: "AM" },
    },
    "hill",
  );
  assert.equal(s.duration, null);
  assert.equal(s.distance, null);
  assert.equal(s.title, "My hill");
  assert.equal(s.workout.timeSlot, "AM");
  assert.equal(s.workout.steps[1].children[1].end, "manual");
  assert.throws(() => applyRecipe({ type: "easy" }, "hill"));
});
