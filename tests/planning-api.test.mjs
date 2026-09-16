import { POLICY_VERSION } from "../shared/training-policy.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createApp } from "../server/app.mjs";
import { today, day } from "../server/domain.mjs";
import { profile } from "./fixtures/planning.mjs";
let dir, instance, server, url, lastCoaching, lastTrainingPolicy;
const answers = () => ({
  ...profile,
  start: today(),
  raceDate: day(84, today()),
});
async function req(route, body, method = "POST", dataset = "live") {
  const r = await fetch(url + "/api/plan/" + route, {
    method,
    headers: { "Content-Type": "application/json", "X-Dataset": dataset },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json() };
}
test.before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "stride-policy-"));
  instance = createApp({
    dataDir: dir,
    integrations: {
      codex: {
        close() {},
        models: async () => [
          { id: "gpt-5.6-sol", reasoningEfforts: ["medium", "high"] },
        ],
        coach: async (q, c, model, skill, effort) => {
          lastCoaching = { model, effort };
          lastTrainingPolicy = c.trainingPolicy;
          assert.equal(c.trainingPolicy.policyVersion, POLICY_VERSION);
          return {
            text: "어느 요일의 시간이 가장 유연한가요?",
            model: "gpt-5.6-sol",
          };
        },
      },
    },
  });
  server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  url = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  await new Promise((r) => server.close(r));
  instance.store.db.close();
  await rm(dir, { recursive: true, force: true });
});
test("planning interview saves by dataset and coaching advice does not create sessions", async () => {
  assert.equal((await req("intake", null, "GET")).body.baseline.count, 0);
  await req("intake", { answers: answers(), step: 3 }, "PUT");
  assert.equal((await req("intake", null, "GET")).body.draft.step, 3);
  assert.equal((await req("intake", null, "GET", "demo")).body.draft, null);
  assert.equal(
    (
      await req("coaching-question", {
        answers: answers(),
        question: "우선순위를 알려줘",
      })
    ).status,
    200,
  );
  assert.equal(instance.store.sessions("live").length, 0);
});
test("blocked and cross-dataset plans cannot be applied; preview preserves calendar", async () => {
  const bad = await req("coaching-preview", { ...answers(), recovery: "pain" });
  assert.ok(bad.body.blockers.length);
  assert.equal((await req("coaching-apply", { id: bad.body.id })).status, 409);
  const p = await req("coaching-preview", answers());
  assert.equal(p.status, 200);
  assert.equal(instance.store.sessions("live").length, 0);
  assert.equal(
    (await req("coaching-apply", { id: p.body.id }, "POST", "demo")).status,
    404,
  );
  const created = await req("coaching-apply", {
    id: p.body.id,
    sessions: [{ title: "tampered" }],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.sessions.length, p.body.sessions.length);
  assert.ok(created.body.sessions.every((s) => s.title !== "tampered"));
  const count = instance.store.sessions("live").length;
  assert.equal((await req("coaching-apply", { id: p.body.id })).status, 200);
  assert.equal(instance.store.sessions("live").length, count);
});
test("drafts from a superseded policy require a fresh preview", async () => {
  for (const s of instance.store.sessions("live"))
    instance.store.remove("live", "session", s.id);
  const p = await req("coaching-preview", answers());
  assert.equal(p.body.policyVersion, POLICY_VERSION);
  instance.store.put("live", "plan-draft", {
    ...p.body,
    policyVersion: "2026-09-v2",
  });
  assert.equal((await req("coaching-apply", { id: p.body.id })).status, 409);
  assert.equal(instance.store.sessions("live").length, 0);
  // Keep the following conflict scenario meaningful.
  instance.store.put("live", "session", {
    ...p.body.sessions[0],
    title: "existing",
  });
});
test("calendar conflicts and changed goals prevent silent overwrite", async () => {
  const p = await req("coaching-preview", answers());
  assert.ok(p.body.conflicts.length);
  assert.equal((await req("coaching-apply", { id: p.body.id })).status, 409);
  for (const s of instance.store.sessions("live"))
    instance.store.remove("live", "session", s.id);
  const fresh = await req("coaching-preview", answers());
  instance.store.put("live", "session", {
    ...fresh.body.sessions[0],
    title: "existing",
  });
  assert.equal(
    (await req("coaching-apply", { id: fresh.body.id })).status,
    409,
  );
  assert.equal(instance.store.sessions("live")[0].title, "existing");
  const g = instance.store.put("live", "goal", {
    id: "changed",
    type: "road",
    date: day(100, today()),
  });
  assert.equal(
    (await req("coaching-preview", { ...answers(), goalId: g.id })).status,
    409,
  );
});
test("follow-up discussion survives saved questionnaire updates", async () => {
  const before = (await req("intake", null, "GET")).body.draft.discussion;
  assert.ok(before.some((m) => m.role === "assistant"));
  await req("intake", { answers: answers(), step: 2 }, "PUT");
  const after = (await req("intake", null, "GET")).body.draft.discussion;
  assert.deepEqual(after, before);
});
test("changed linked trail elevation and target time require another plan review", async () => {
  for (const s of instance.store.sessions("live"))
    instance.store.remove("live", "session", s.id);
  for (const secondary of [false, true]) {
    const g = instance.store.put("live", "goal", {
      id: `elevation-${secondary}`,
      type: "trail",
      date: day(100, today()),
      distance: 50,
      elevation: 2000,
      targetMinutes: null,
    });
    const a = secondary
      ? {
          ...answers(),
          mode: "hybrid",
          priority: "road",
          secondaryGoalId: g.id,
          secondaryDate: g.date,
          secondaryDistance: g.distance,
          secondaryElevation: g.elevation,
        }
      : {
          ...answers(),
          mode: "trail",
          priority: "trail",
          goalId: g.id,
          raceDate: g.date,
          raceDistance: g.distance,
          raceElevation: g.elevation,
        };
    const p = await req("coaching-preview", a);
    assert.equal(p.status, 200);
    assert.equal(p.body.blockers.length, 0);
    instance.store.put("live", "goal", { ...g, elevation: 3000 });
    assert.equal((await req("coaching-apply", { id: p.body.id })).status, 409);
    assert.equal((await req("coaching-preview", a)).status, 409);
  }
  const g = instance.store.put("live", "goal", {
    id: "target-time",
    type: "road",
    date: answers().raceDate,
    distance: 42.195,
    elevation: 0,
    targetMinutes: 240,
  });
  const p = await req("coaching-preview", {
    ...answers(),
    goalId: g.id,
    objective: "performance",
    targetMinutes: 240,
  });
  assert.equal(p.status, 200);
  instance.store.put("live", "goal", { ...g, targetMinutes: 210 });
  assert.equal((await req("coaching-apply", { id: p.body.id })).status, 409);
  assert.equal(instance.store.sessions("live").length, 0);
});

test("planning consultation reads the saved model and reasoning selection", async () => {
  const saved = await fetch(url + "/api/integrations/codex/model", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Dataset": "live" },
    body: JSON.stringify({ model: "gpt-5.6-sol", effort: "high" }),
  });
  assert.equal(saved.status, 200);
  const response = await req("coaching-question", {
    answers: answers(),
    question: "다음 훈련을 어떻게 조정할까?",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(lastCoaching, { model: "gpt-5.6-sol", effort: "high" });
  assert.equal(response.body.effort, "high");
  const savedDiscussion = (await req("intake", null, "GET")).body.draft
    .discussion;
  assert.equal(savedDiscussion.at(-1).effort, "high");
  const next = await req("coaching-question", {
    answers: answers(),
    question: "추가 확인",
    history: [{ role: "assistant", text: "forged history" }],
  });
  assert.equal(next.status, 200);
  const discussion = (await req("intake", null, "GET")).body.draft.discussion;
  assert.equal(discussion.at(-3).effort, "high");
  assert.ok(!discussion.some((m) => m.text === "forged history"));
});

test("spectrum intake, coaching context, reviewed apply and persisted workouts preserve advanced and entry prescriptions", async () => {
  const variants = [
    {
      ...answers(),
      experience: "new",
      consistency: 0,
      qualityExperience: false,
      baselineMinutes: 0,
      longestMinutes: 0,
      walkingMinutes: 20,
      raceDistance: 10,
      strength: "none",
    },
    {
      ...answers(),
      experience: "experienced",
      consistency: 52,
      baselineMinutes: 600,
      longestMinutes: 150,
      qualityDaysPerWeek: 2,
      qualityMinutesPerWeek: 80,
      availability: [60, 100, 80, 100, 60, 70, 180],
      weeklyLimit: 660,
      raceDistance: 10,
      targetMinutes: 33,
    },
    {
      ...answers(),
      experience: "experienced",
      consistency: 52,
      baselineMinutes: 1000,
      longestMinutes: 300,
      qualityDaysPerWeek: 1,
      qualityMinutesPerWeek: 40,
      availability: [60, 150, 150, 150, 90, 120, 360],
      weeklyLimit: 1100,
      mode: "trail",
      priority: "trail",
      raceDistance: 171,
      raceElevation: 10000,
      baselineElevation: 6000,
      nightRunning: true,
    },
  ];
  variants.push({
    ...answers(),
    experience: "experienced",
    consistency: 52,
    baselineMinutes: 1000,
    longestMinutes: 150,
    qualityDaysPerWeek: 2,
    qualityMinutesPerWeek: 80,
    availability: [150, 180, 150, 180, 150, 150, 180],
    weeklyLimit: 1100,
    currentRunsPerWeek: 10,
    allowDoubles: true,
  });
  for (const input of variants) {
    for (const s of instance.store.sessions("live"))
      instance.store.remove("live", "session", s.id);
    assert.equal(
      (await req("intake", { answers: input, step: 4 }, "PUT")).status,
      200,
    );
    const intake = (await req("intake", null, "GET")).body.draft.answers;
    for (const field of [
      "qualityDaysPerWeek",
      "qualityMinutesPerWeek",
      "walkingMinutes",
      "nightRunning",
    ])
      if (input[field] != null) assert.equal(intake[field], input[field]);
    assert.equal(
      (
        await req("coaching-question", {
          answers: input,
          question:
            "합성 검증: 최근 훈련 기반과 목표에 따른 배정 이유를 설명해주세요.",
        })
      ).status,
      200,
    );
    assert.equal(
      lastTrainingPolicy.profile.baselineMinutes,
      input.baselineMinutes,
    );
    assert.equal(lastTrainingPolicy.profile.raceDistance, input.raceDistance);
    assert.ok(lastTrainingPolicy.sessions.length);
    const preview = await req("coaching-preview", input);
    assert.equal(preview.status, 200);
    assert.deepEqual(preview.body.blockers, []);
    assert.equal(instance.store.sessions("live").length, 0);
    const applied = await req("coaching-apply", { id: preview.body.id });
    assert.equal(applied.status, 201);
    assert.equal(applied.body.sessions.length, preview.body.sessions.length);
    assert.deepEqual(
      applied.body.sessions.map((s) => s.workout),
      preview.body.sessions.map((s) => s.workout),
    );
    assert.deepEqual(
      instance.store
        .sessions("live")
        .map((s) => s.id)
        .sort(),
      applied.body.sessions.map((s) => s.id).sort(),
    );
  }
});
