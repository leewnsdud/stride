import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { today, day } from "../server/domain.mjs";
import { profile } from "./fixtures/planning.mjs";
import {
  baselineFromActivities,
  buildCoachedPlan,
} from "../server/training-policy.mjs";
import { validateAIProposal } from "../server/planning-ai.mjs";

test("day selection preserves weekly caps, multi-terrain and observed baseline precision", () => {
  const p = buildCoachedPlan(
    {
      ...profile,
      availableDays: [1, 3, 5, 6],
      terrains: ["flat", "hills"],
      weeklyLimit: 300,
    },
    profile.start,
  );
  assert.equal(p.profile.terrain, "hills");
  assert.deepEqual(p.profile.terrains, ["flat", "hills"]);
  assert.ok(p.weeks.every((w) => w.minutes <= 300));
  assert.ok(
    p.sessions.every((s) =>
      [1, 3, 5, 6].includes((new Date(s.date).getUTCDay() + 6) % 7),
    ),
  );
  const b = baselineFromActivities(
    Array.from({ length: 5 }, (_, i) => ({
      date: day(-7 * i - 1, "2026-09-14"),
      distance: 12.34567,
      duration: 70,
    })),
    "2026-09-14",
  );
  assert.equal(b.longestKm, 12.35);
  assert.equal(b.consistency, 5);
  assert.equal(b.currentRunsPerWeek, 1);
  assert.equal(baselineFromActivities([], "2026-09-14").consistency, null);
});
test("AI cannot raise load or change observed history and recovery", () => {
  for (const changes of [
    { weeklyLimit: 500 },
    { baselineMinutes: 500 },
    { recovery: "ready" },
    { qualityDaysPerWeek: 2 },
  ])
    assert.throws(() =>
      validateAIProposal(
        JSON.stringify({ explanation: "검토", changes }),
        profile,
        profile.start,
      ),
    );
  assert.throws(() =>
    validateAIProposal(
      '{"explanation":"검토","changes":{}}',
      { ...profile, recovery: "pain" },
      profile.start,
    ),
  );
});
test("background generation, review/apply, failure, restart and dataset isolation", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "stride-generation-"));
  let connected = true,
    calls = 0,
    release,
    malformed = false;
  const codex = {
    close() {},
    status: async () => ({ connected }),
    coach: async () => {
      calls++;
      if (release)
        await new Promise((r) => {
          release.resolve = r;
        });
      return {
        text: malformed
          ? "not JSON"
          : JSON.stringify({
              explanation: "현재 기반과 회복 조건을 유지합니다.",
              changes: {},
            }),
        model: "test-model",
        effort: "medium",
      };
    },
  };
  let app = createApp({ dataDir: dir, integrations: { codex } });
  const server = app.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const req = async (route, body, method = "POST", ds = "live") => {
    const r = await fetch(
      `http://127.0.0.1:${server.address().port}/api/plan/${route}`,
      {
        method,
        headers: { "Content-Type": "application/json", "X-Dataset": ds },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: r.status, body: await r.json() };
  };
  const answers = {
    ...profile,
    start: today(),
    raceDate: day(80, today()),
    availableDays: [1, 3, 4, 5, 6],
    terrains: ["flat", "trail"],
  };
  const waitDone = async (id) => {
    for (let n = 0; n < 100; n++) {
      const job = app.store.get("live", "planning-job", id);
      if (job.status !== "running") return job;
      await new Promise((r) => setTimeout(r, 5));
    }
    throw new Error("Job never finished");
  };
  try {
    connected = false;
    assert.equal((await req("generate", { answers })).status, 409);
    connected = true;
    release = {};
    const started = await req("generate", { answers, feedback: "회복 우선" });
    assert.equal(started.status, 202);
    assert.equal((await req("generate", { answers })).status, 409);
    assert.equal((await req("intake", null, "DELETE")).status, 409);
    assert.deepEqual((await req("jobs", null, "GET", "demo")).body, []);
    const resolve = release.resolve;
    release = null;
    resolve();
    const completed = await waitDone(started.body.id);
    assert.equal(completed.status, "ready");
    assert.equal(calls, 2);
    assert.equal(app.store.sessions("live").length, 0);
    const draft = (await req(`drafts/${completed.draftId}`, null, "GET")).body;
    assert.ok(draft.cycle.length > 4);
    assert.equal(draft.weeks.length, 4);
    assert.equal(draft.aiReview.feedback, "회복 우선");
    assert.equal(
      (await req(`drafts/${completed.draftId}`, null, "GET", "demo")).status,
      404,
    );
    assert.equal(
      (await req("coaching-apply", { id: completed.draftId })).status,
      201,
    );
    assert.equal(
      (await req("coaching-apply", { id: completed.draftId })).body
        .alreadyApplied,
      true,
    );
    const count = app.store.sessions("live").length;
    malformed = true;
    const failed = await req("generate", { answers });
    assert.equal((await waitDone(failed.body.id)).status, "failed");
    assert.equal(app.store.sessions("live").length, count);
    assert.equal((await req("intake", null, "DELETE")).status, 200);
    assert.equal(app.store.sessions("live").length, count);
    assert.ok(app.store.get("live", "plan-draft", completed.draftId).applied);
    app.store.put("live", "planning-job", {
      id: "interrupted",
      status: "running",
    });
    app.store.db.close();
    app = createApp({ dataDir: dir, integrations: { codex } });
    assert.equal(
      app.store.get("live", "planning-job", "interrupted").status,
      "failed",
    );
  } finally {
    await new Promise((r) => server.close(r));
    app.store.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
