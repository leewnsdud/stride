import test from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatMinutes, formatPace } from "../shared/time.mjs";
test("duration preserves second precision and rolls over correctly", () => {
  assert.equal(formatMinutes(46.6), "46:36");
  assert.equal(formatMinutes(65.9), "1:05:54");
  assert.equal(formatDuration(3599.6), "1:00:00");
  assert.equal(formatDuration(90061), "25:01:01");
  assert.equal(formatDuration(0), "0:00");
  for (const v of [null, undefined, "", NaN, Infinity, -1])
    assert.equal(formatDuration(v), "—");
  assert.equal(formatMinutes(null, { unknown: "미정" }), "미정");
  assert.equal(formatMinutes(-1.5, { signed: true }), "−1:30");
  assert.equal(formatDuration(90, { forceHours: true }), "0:01:30");
  assert.equal(formatPace(4.65), "4:39");
});
