import test from "node:test";
import assert from "node:assert/strict";
import { matchesActivityName } from "../shared/activity-search.mjs";
import { coachingSelectionError } from "../shared/coaching-selection.mjs";

test("activity name search handles composed Korean, case and multiple terms without matching notes", () => {
  const run = { name: "Morning 한강 이지 러닝", notes: "트레일 아님" };
  assert.equal(matchesActivityName(run, "  MORNING   러닝  "), true);
  assert.equal(matchesActivityName(run, "한강".normalize("NFD")), true);
  assert.equal(matchesActivityName(run, "트레일"), false);
  assert.equal(matchesActivityName(run, "이지 인터벌"), false);
  assert.equal(matchesActivityName(run, "  "), true);
});
test("coach selection accepts exactly 92 inclusive days and rejects 93 or reversed dates", () => {
  assert.equal(
    coachingSelectionError(
      { kind: "period", start: "2026-07-01", end: "2026-09-30" },
      [],
    ),
    "",
  );
  assert.match(
    coachingSelectionError(
      { kind: "period", start: "2026-07-01", end: "2026-10-01" },
      [],
    ),
    /92일/,
  );
  assert.ok(
    coachingSelectionError(
      { kind: "period", start: "2026-09-15", end: "2026-09-14" },
      [],
    ),
  );
  assert.ok(
    coachingSelectionError(
      { kind: "period", start: "", end: "2026-09-14" },
      [],
    ),
  );
});
test("deleted activity attachment blocks sending while question-only and recent remain available", () => {
  assert.equal(
    coachingSelectionError({ kind: "activity", activityId: "a" }, [
      { id: "a" },
    ]),
    "",
  );
  assert.ok(coachingSelectionError({ kind: "activity", activityId: "a" }, []));
  assert.equal(coachingSelectionError({ kind: "none" }, []), "");
  assert.equal(coachingSelectionError({ kind: "recent" }, []), "");
});
