import test from "node:test";
import http from "node:http";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
let dir, instance, server, url;
const sample = {
  id: "icu-i1",
  externalId: "i1",
  source: "intervals",
  name: "Imported trail",
  date: "2026-09-11",
  distance: 10,
  duration: 80,
  elevation: 500,
  type: "trail",
  raw: { icu_intervals: [{ distance: 1000 }] },
};
const integrations = {
  garmin: {
    status: () => ({ configured: true, available: true }),
    activities: async () => [sample],
    detail: async () => ({
      version: 2,
      points: [{ time: 0, hr: 130 }],
      raw: { private: true },
    }),
    cancel: () => {},
  },
  codex: {
    models: async () => [{ id: "gpt-5.6-sol" }],
    close: () => {},
    status: async () => ({
      available: true,
      connected: true,
      method: "chatgpt",
    }),
    coach: async (q, c) => {
      if (c.activities)
        assert.ok(c.activities.every((a) => !a.raw && !a.streams));
      return "테스트 코칭 응답";
    },
  },
  icuRequest: async () => [
    { type: "time", data: [0, 60] },
    { type: "heartrate", data: [130, 140] },
  ],
};
async function req(route, body, method, ds = "live", headers = {}) {
  const r = await fetch(url + "/api" + route, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "content-type": "application/json",
      "x-dataset": ds,
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, data: await r.json() };
}
test.before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "stride-test-"));
  instance = createApp({ dataDir: dir, integrations });
  server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  url = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  await new Promise((r) => server.close(r));
  instance.store.db.close();
  await rm(dir, { recursive: true, force: true });
});
test("live data starts empty while demo is isolated", async () => {
  assert.equal((await req("/state")).data.activities.length, 0);
  assert.ok(
    (await req("/state", null, null, "demo")).data.activities.length > 0,
  );
});
test("CRUD, 1:1 linking, unlink, soft delete and persistence", async () => {
  const goal = await req("/goals", {
    name: "Test Marathon",
    date: "2026-11-01",
    type: "road",
    distance: 42.195,
    elevation: 0,
    targetMinutes: 240,
  });
  assert.equal(goal.status, 201);
  const body = {
    title: "Easy run",
    date: "2026-09-11",
    type: "easy",
    distance: 8,
    duration: 48,
    elevation: 0,
    goalId: goal.data.id,
  };
  const s1 = (await req("/sessions", body)).data,
    s2 = (await req("/sessions", body)).data;
  const a = (
    await req("/activities", {
      name: "Test run",
      date: "2026-09-11",
      type: "road",
      distance: 8,
      duration: 49,
      elevation: 0,
    })
  ).data;
  assert.ok(a.id);
  assert.equal(
    (await req(`/sessions/${s1.id}/link`, { activityId: a.id })).status,
    200,
  );
  assert.equal(
    (await req(`/sessions/${s2.id}/link`, { activityId: a.id })).status,
    409,
  );
  assert.equal(
    (await req(`/sessions/${s1.id}/link`, null, "DELETE")).status,
    200,
  );
  assert.equal(
    (await req(`/sessions/${s2.id}/link`, { activityId: a.id })).status,
    200,
  );
  assert.equal((await req(`/sessions/${s2.id}`, null, "DELETE")).status, 200);
  assert.ok((await req("/state")).data.activities.some((x) => x.id === a.id));
  assert.equal(instance.store.list("live", "trash").length, 1);
  const backup = (await req("/export")).data;
  assert.equal(backup.version, 1);
  assert.ok(backup.activities.length);
  assert.ok((await stat(path.join(dir, "stride.sqlite"))).size > 0);
  assert.equal(
    (await req("/sessions", { ...body, date: "2026-02-31" })).status,
    400,
  );
});
test("sync is idempotent, secrets redacted and detail streams persisted", async () => {
  assert.equal(
    (await req("/integrations/intervals", { key: "test-key-private" })).status,
    200,
  );
  assert.equal((await req("/sync", {}, null, "demo")).status, 400);
  assert.equal((await req("/sync", {})).status, 200);
  await req("/sync", {});
  const state = (await req("/state")).data;
  assert.equal(state.activities.filter((a) => a.id === "icu-i1").length, 1);
  assert.equal(state.activities.find((a) => a.id === "icu-i1").raw, undefined);
  assert.equal((await req("/activities/icu-i1/detail")).data.streams.length, 2);
  const publicSettings = (await req("/integrations")).data;
  assert.equal(
    JSON.stringify(publicSettings).includes("test-key-private"),
    false,
  );
  assert.equal(
    (await stat(path.join(dir, "integrations.json"))).mode & 0o777,
    0o600,
  );
});
test("retired planning routes cannot bypass reviewed drafts; coach stores successful turns", async () => {
  const before = (await req("/state")).data.sessions.length;
  const preview = await req("/plan/preview", {
    start: "2026-09-14",
    weeklyKm: 30,
    days: 4,
    weeks: 4,
    type: "road",
  });
  assert.equal(preview.status, 410);
  assert.equal((await req("/state")).data.sessions.length, before);
  assert.equal(
    (await req("/plan/apply", { sessions: preview.data.sessions })).status,
    410,
  );
  assert.equal((await req("/state")).data.sessions.length, before);
  assert.equal((await req("/coach", { question: "훈련 점검" })).status, 200);
  assert.equal((await req("/state")).data.messages.length, 2);
});
test("Garmin upgrade retains legacy id, notes and plan links across repeated syncs", async () => {
  const legacy = instance.store.get("live", "activity", "icu-i1");
  instance.store.put("live", "activity", {
    ...legacy,
    notes: "keep my note",
    raw: { garmin_activity_id: 77 },
  });
  const session = instance.store.put("live", "session", {
    title: "linked",
    date: "2026-09-11",
    type: "trail",
    distance: 10,
    duration: 80,
    elevation: 500,
  });
  instance.store.link("live", session.id, "icu-i1");
  const original = integrations.garmin.activities;
  integrations.garmin.activities = async () => [
    {
      ...sample,
      id: "garmin-77",
      externalId: "77",
      source: "garmin",
      raw: { activityId: 77 },
    },
  ];
  try {
    assert.equal((await req("/sync", {})).status, 200);
    assert.equal((await req("/sync", {})).status, 200);
    const state = (await req("/state")).data;
    assert.equal(
      state.activities.filter((a) => a.externalId === "77").length,
      1,
    );
    assert.equal(
      state.activities.find((a) => a.externalId === "77").notes,
      "keep my note",
    );
    assert.equal(
      state.sessions.find((s) => s.id === session.id).activityId,
      "icu-i1",
    );
    const detail = (await req("/activities/icu-i1/detail")).data;
    assert.equal(detail.points[0].hr, 130);
    assert.equal(detail.raw, undefined);
    assert.equal(
      (await req("/state")).data.activities.find((a) => a.id === "icu-i1")
        .detail,
      undefined,
    );
  } finally {
    integrations.garmin.activities = original;
  }
});
test("Garmin auth inputs and unavailable Codex models are rejected", async () => {
  assert.equal(
    (
      await req("/integrations/garmin/login", {
        email: "bad",
        password: "secret",
      })
    ).status,
    400,
  );
  assert.equal(
    (await req("/integrations/garmin/mfa", { code: "invalid" })).status,
    400,
  );
  assert.equal(
    (await req("/integrations/codex/model", { model: "unknown" })).status,
    400,
  );
  assert.equal(
    (await req("/integrations/codex/model", { model: "gpt-5.6-sol" })).status,
    200,
  );
});
test("activity reviews persist, stay scoped and preserve history on failure", async () => {
  const original = integrations.codex.coach;
  let seen;
  integrations.codex.coach = async (q, context, model) => {
    seen = { context, model };
    return {
      text: "활동 리뷰 테스트",
      model: "gpt-5.6-luna",
      effort: "medium",
      fallback: true,
    };
  };
  try {
    const created = await req("/activities/icu-i1/reviews", {});
    assert.equal(created.status, 201);
    assert.equal(created.data.effort, "medium");
    assert.equal(created.data.model, "gpt-5.6-luna");
    assert.equal(created.data.fallback, true);
    assert.equal(seen.model, "gpt-5.6-sol");
    assert.equal(seen.context.activity.name, sample.name);
    const saved = (await req("/activities/icu-i1/reviews")).data;
    assert.equal(saved.length, 1);
    assert.equal(saved[0].text, "활동 리뷰 테스트");
    assert.equal(
      instance.store.get("live", "review", saved[0].id).activityId,
      "icu-i1",
    );
    assert.equal(
      (await req("/activities/icu-i1/reviews", null, null, "demo")).status,
      404,
    );
    integrations.codex.coach = async () => {
      throw new Error("test failure");
    };
    assert.equal((await req("/activities/icu-i1/reviews", {})).status, 500);
    assert.equal((await req("/activities/icu-i1/reviews")).data.length, 1);
    assert.equal(
      (await req("/integrations")).data.codex.selectedModel,
      "gpt-5.6-sol",
    );
    assert.equal(
      (await req("/integrations")).data.codex.reasoningEffort,
      "medium",
    );
  } finally {
    integrations.codex.coach = original;
  }
});
test("blocks foreign origins and hosts", async () => {
  assert.equal(
    (await req("/goals", {}, null, "live", { origin: "https://evil.example" }))
      .status,
    403,
  );
  const status = await new Promise((resolve, reject) => {
    http
      .get(url + "/api/state", { headers: { Host: "evil.example" } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      })
      .on("error", reject);
  });
  assert.equal(status, 403);
});

test("deleted entries are restorable without overwriting existing data", async () => {
  const s = (
    await req("/sessions", {
      title: "Restore me",
      date: "2026-10-01",
      type: "easy",
      distance: 5,
      duration: 30,
      elevation: 0,
    })
  ).data;
  await req(`/sessions/${s.id}`, null, "DELETE");
  const trash = (await req("/trash")).data.find((x) => x.entry.id === s.id);
  assert.ok(trash);
  assert.equal((await req(`/trash/${trash.id}/restore`, {})).status, 200);
  assert.ok((await req("/state")).data.sessions.some((x) => x.id === s.id));
  assert.equal((await req(`/trash/${trash.id}/restore`, {})).status, 404);
});

test("rejects rest-day activity links and invalid goal reassignment", async () => {
  const rest = (
    await req("/sessions", {
      title: "Rest",
      date: "2026-10-01",
      type: "rest",
      distance: 0,
      duration: 0,
      elevation: 0,
    })
  ).data;
  assert.equal(
    (await req(`/sessions/${rest.id}/link`, { activityId: "icu-i1" })).status,
    400,
  );
  assert.equal(
    (await req(`/sessions/${rest.id}`, { ...rest, goalId: "missing" }, "PUT"))
      .status,
    400,
  );
});

test("race structure and unknown totals persist through creation and edits", async () => {
  const created = await req("/sessions", {
    title: "Race schema test",
    date: "2026-10-01",
    type: "race",
    distance: 10,
    duration: null,
    elevation: null,
    workout: {
      purpose: "후반 페이스 유지",
      steps: [],
      race: {
        kind: "tt",
        role: "checkpoint",
        strategy: "초반 억제",
        criteria: "후반 유지",
      },
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.duration, null);
  const edited = await req(
    `/sessions/${created.data.id}`,
    { ...created.data, date: "2026-10-02" },
    "PUT",
  );
  assert.equal(edited.status, 200);
  const saved = (await req("/state")).data.sessions.find(
    (s) => s.id === created.data.id,
  );
  assert.equal(saved.workout.race.strategy, "초반 억제");
  assert.equal(saved.date, "2026-10-02");
  assert.equal(saved.duration, null);
  const bad = await req("/sessions", {
    ...created.data,
    workout: {
      steps: [],
      intensity: { metric: "hr", low: "160", high: "140" },
    },
  });
  assert.equal(bad.status, 400);
});

test("coach conversations isolate context, archive safely and retain failed drafts", async () => {
  const original = integrations.codex.coach;
  const contexts = [];
  integrations.codex.coach = async (q, c) => {
    contexts.push(c.previousMessages);
    if (q === "fail") throw new Error("test failure");
    return "answer " + q;
  };
  try {
    const a = (await req("/conversations", {})).data;
    const b = (await req("/conversations", { title: "Separate topic" })).data;
    assert.equal(
      (await req("/coach", { question: "topic A", conversationId: a.id }))
        .status,
      200,
    );
    assert.deepEqual(contexts.at(-1), []);
    await req("/coach", { question: "topic B", conversationId: b.id });
    assert.deepEqual(contexts.at(-1), []);
    await req("/coach", { question: "follow A", conversationId: a.id });
    assert.deepEqual(
      contexts.at(-1).map((m) => m.text),
      ["topic A", "answer topic A"],
    );
    assert.equal(
      (
        await req(
          "/coach",
          { question: "wrong dataset", conversationId: a.id },
          null,
          "demo",
        )
      ).status,
      404,
    );
    assert.equal(
      (await req("/conversations/" + a.id, { title: "Renamed" }, "PATCH"))
        .status,
      200,
    );
    await req("/conversations/" + a.id, { archived: true }, "PATCH");
    assert.equal(
      (await req("/coach", { question: "archived", conversationId: a.id }))
        .status,
      404,
    );
    await req("/conversations/" + a.id, { archived: false }, "PATCH");
    const before = instance.store.list("live", "message").length;
    assert.equal(
      (await req("/coach", { question: "fail", conversationId: a.id })).status,
      500,
    );
    assert.equal(instance.store.list("live", "message").length, before);
    assert.equal(
      (await req("/coach", { question: "retry", conversationId: a.id })).status,
      200,
    );
    assert.equal(
      (await req("/export")).data.conversations.find((c) => c.id === a.id)
        .title,
      "Renamed",
    );
    assert.equal(
      (await req("/conversations/" + a.id, { title: " " }, "PATCH")).status,
      400,
    );
  } finally {
    integrations.codex.coach = original;
  }
});

test("legacy messages migrate once without loss and conversations survive restart", async () => {
  const migrationDir = await mkdtemp(
    path.join(os.tmpdir(), "stride-chat-migration-"),
  );
  let app;
  try {
    app = createApp({ dataDir: migrationDir, integrations });
    app.store.put("live", "message", {
      id: "old1",
      role: "user",
      text: "old question",
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    app.store.put("live", "message", {
      id: "old2",
      role: "assistant",
      text: "old answer",
      createdAt: "2026-09-01T00:00:01.000Z",
    });
    app.store.db.close();
    app = null;
    app = createApp({ dataDir: migrationDir, integrations });
    const conversation = app.store.list("live", "conversation")[0];
    assert.equal(conversation.title, "이전 대화");
    assert.equal(app.store.list("live", "message").length, 2);
    assert.ok(
      app.store
        .list("live", "message")
        .every((m) => m.conversationId === conversation.id),
    );
    assert.equal(app.store.list("demo", "conversation").length, 0);
    app.store.db.close();
    app = null;
    app = createApp({ dataDir: migrationDir, integrations });
    assert.equal(app.store.list("live", "conversation").length, 1);
    assert.equal(app.store.get("live", "message", "old1").text, "old question");
  } finally {
    app?.store.db.close();
    await rm(migrationDir, { recursive: true, force: true });
  }
});

test("deleting conversations removes only scoped messages including archived conversations", async () => {
  const a = (await req("/conversations", { title: "Delete this" })).data;
  const b = (await req("/conversations", { title: "Keep this" })).data;
  await req("/coach", { conversationId: a.id, question: "A" });
  await req("/coach", { conversationId: b.id, question: "B" });
  assert.equal(
    (await req(`/conversations/${a.id}`, null, "DELETE", "demo")).status,
    404,
  );
  assert.equal(
    instance.store
      .list("live", "message")
      .filter((m) => m.conversationId === a.id).length,
    2,
  );
  await req(`/conversations/${a.id}`, { archived: true }, "PATCH");
  assert.equal(
    (await req(`/conversations/${a.id}`, null, "DELETE")).status,
    200,
  );
  const state = (await req("/state")).data;
  assert.ok(!state.conversations.some((c) => c.id === a.id));
  assert.ok(!state.messages.some((m) => m.conversationId === a.id));
  assert.equal(
    state.messages.filter((m) => m.conversationId === b.id).length,
    2,
  );
  assert.equal(
    (await req(`/conversations/${a.id}`, null, "DELETE")).status,
    404,
  );
});

test("deletion cannot race with an active AI response", async () => {
  const c = (await req("/conversations", {})).data;
  const original = integrations.codex.coach;
  let release, started;
  const entered = new Promise((r) => (started = r));
  integrations.codex.coach = () =>
    new Promise((r) => {
      release = r;
      started();
    });
  const pending = req("/coach", { conversationId: c.id, question: "pending" });
  try {
    await entered;
    assert.equal(
      (await req(`/conversations/${c.id}`, null, "DELETE")).status,
      409,
    );
    release("completed");
    assert.equal((await pending).status, 200);
    assert.equal(
      (await req(`/conversations/${c.id}`, null, "DELETE")).status,
      200,
    );
    assert.ok(
      !instance.store
        .list("live", "message")
        .some((m) => m.conversationId === c.id),
    );
  } finally {
    release?.("completed");
    integrations.codex.coach = original;
    await pending;
  }
});

test("scoped coaching passes the actual skill and records context without crossing datasets", async () => {
  const original = integrations.codex.coach;
  const activity = instance.store.put("live", "activity", {
    name: "Coaching fixture",
    date: "2026-09-10",
    type: "trail",
    distance: 10,
    duration: 60,
    elevation: 500,
    detail: { points: [], raw: { private: "excluded" } },
  });
  let received;
  integrations.codex.coach = async (q, context, model, skill) => {
    received = { context, model, skill };
    return "Scoped review";
  };
  try {
    const scope = {
      kind: "activity",
      activityId: activity.id,
      scenario: "race",
    };
    const response = await req("/coach", {
      question: "이 활동을 리뷰해줘",
      scope,
    });
    assert.equal(response.status, 200);
    assert.equal(received.context.activity.name, "Coaching fixture");
    assert.deepEqual(received.skill.modes, ["road", "race", "trail"]);
    assert.ok(
      received.skill.instructions.includes("Evidence-led running coaching"),
    );
    assert.ok(!JSON.stringify(received.context).includes("excluded"));
    const saved = instance.store
      .list("live", "message")
      .filter((m) => m.conversationId === response.data.conversationId);
    assert.equal(saved.length, 2);
    assert.equal(saved[0].coachingScope.activityId, activity.id);
    assert.equal(
      saved.find((m) => m.role === "assistant").coachingSkill.version,
      "running-coach/1.1",
    );
    assert.equal(
      (await req("/coach", { question: "리뷰", scope }, null, "demo")).status,
      404,
    );
    assert.equal(
      (
        await req("/coach", {
          question: "리뷰",
          scope: { kind: "period", start: "2026-09-12", end: "2026-09-11" },
        })
      ).status,
      400,
    );
    const period = await req("/coach", {
      question: "기간 리뷰",
      conversationId: response.data.conversationId,
      scope: { kind: "period", start: "2026-09-10", end: "2026-09-10" },
    });
    assert.equal(period.status, 200);
    assert.equal(received.context.scope.start, "2026-09-10");
    assert.equal(
      received.context.previousMessages[0].scope.activityId,
      activity.id,
    );
    assert.ok(received.skill.modes.includes("period"));
    const review = await req(`/activities/${activity.id}/reviews`, {
      scenario: "race",
    });
    assert.equal(review.status, 201);
    assert.equal(review.data.scenario.race, true);
    assert.ok(review.data.coachingSkill.modes.includes("trail"));
    assert.equal(review.data.evidence.analysis.averagePaceSecondsPerKm, 360);
  } finally {
    integrations.codex.coach = original;
  }
});

test("coaching rereads changed linked training and goals while preserving prior review evidence", async () => {
  const original = integrations.codex.coach;
  let context;
  integrations.codex.coach = async (_q, c) => {
    context = c;
    return "연결된 훈련 확인";
  };
  try {
    const activity = (
      await req("/activities", {
        name: "Linked context fixture",
        date: "2026-09-10",
        type: "road",
        distance: 5,
        duration: 30,
      })
    ).data;
    const goalValues = {
      name: "Context goal",
      date: "2026-10-10",
      type: "road",
      distance: 10,
      elevation: 0,
      targetMinutes: 60,
    };
    const goal = (await req("/goals", goalValues)).data;
    const values = {
      title: "Original easy run",
      date: activity.date,
      type: "easy",
      distance: 5,
      duration: 40,
      goalId: goal.id,
    };
    const session = (await req("/sessions", values)).data;
    assert.equal(
      (await req(`/sessions/${session.id}/link`, { activityId: activity.id }))
        .status,
      200,
    );
    const firstReview = await req(`/activities/${activity.id}/reviews`, {});
    assert.equal(firstReview.status, 201);
    assert.equal(context.plannedSession.duration, 40);
    assert.equal(context.goal.targetMinutes, 60);
    assert.equal(context.scenario.race, false);
    assert.equal(
      (
        await req(
          `/sessions/${session.id}`,
          { ...values, title: "Changed race", type: "race", duration: 25 },
          "PUT",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await req(
          `/goals/${goal.id}`,
          { ...goalValues, targetMinutes: 55 },
          "PUT",
        )
      ).status,
      200,
    );
    const scope = { kind: "activity", activityId: activity.id };
    assert.equal(
      (await req("/coach", { question: "변경한 계획과 비교", scope })).status,
      200,
    );
    assert.equal(context.plannedSession.title, "Changed race");
    assert.equal(context.plannedSession.duration, 25);
    assert.equal(context.goal.targetMinutes, 55);
    assert.equal(context.scenario.race, true);
    const nextReview = await req(`/activities/${activity.id}/reviews`, {});
    assert.equal(nextReview.status, 201);
    assert.equal(nextReview.data.evidence.plannedSession.duration, 25);
    const saved = instance.store.get("live", "review", firstReview.data.id);
    assert.equal(saved.evidence.plannedSession.duration, 40);
    assert.equal(
      (await req(`/sessions/${session.id}/link`, null, "DELETE")).status,
      200,
    );
    assert.equal(
      (await req("/coach", { question: "연결 해제 후 확인", scope })).status,
      200,
    );
    assert.equal(context.plannedSession, null);
    assert.equal(context.goal, null);
    assert.equal(context.scenario.race, false);
  } finally {
    integrations.codex.coach = original;
  }
});

test("model choice persists and question-only requests omit attached records", async () => {
  const original = integrations.codex.coach,
    originalModels = integrations.codex.models;
  let seen;
  integrations.codex.models = async () => [
    { id: "gpt-5.6-sol" },
    { id: "gpt-5.6-luna", reasoningEfforts: ["medium", "high"] },
    { id: "unsupported", reasoningEfforts: ["high"] },
  ];
  integrations.codex.coach = async (q, c, m, skill, effort) => {
    seen = { c, m, effort };
    return "answer";
  };
  try {
    assert.equal(
      (await req("/integrations/codex/model", { model: "unsupported" })).status,
      400,
    );
    assert.equal(
      (
        await req("/integrations/codex/model", {
          model: "gpt-5.6-luna",
          effort: "high",
        })
      ).status,
      200,
    );
    assert.equal(
      (await req("/integrations")).data.codex.selectedModel,
      "gpt-5.6-luna",
    );
    const config = JSON.parse(
      await readFile(path.join(dir, "integrations.json"), "utf8"),
    );
    assert.equal(config.codexModel, "gpt-5.6-luna");
    assert.equal(config.codexEffort, "high");
    assert.equal(
      (await req("/integrations")).data.codex.reasoningEffort,
      "high",
    );
    assert.equal(
      (
        await req("/integrations/codex/model", {
          model: "gpt-5.6-luna",
          effort: "ultra",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req("/coach", {
          question: "편한 러닝이란?",
          scope: { kind: "none" },
        })
      ).status,
      200,
    );
    assert.equal(seen.m, "gpt-5.6-luna");
    assert.equal(seen.effort, "high");
    assert.equal(seen.c.activities, undefined);
    assert.equal(seen.c.goals, undefined);
    assert.equal(seen.c.sessions, undefined);
    const review = await req("/activities/icu-i1/reviews", {});
    assert.equal(review.status, 201);
    assert.equal(review.data.effort, "high");
    assert.equal(seen.m, "gpt-5.6-luna");
    assert.equal(seen.effort, "high");
    await req("/integrations/codex/model", { model: "gpt-5.6-sol" });
  } finally {
    integrations.codex.coach = original;
    integrations.codex.models = originalModels;
  }
});

test("replayed creation is atomic, dataset-scoped and never recreates deleted entries", async () => {
  const entries = [
    [
      "goals",
      "goal",
      {
        name: "Retry goal",
        date: "2026-12-01",
        type: "road",
        distance: 10,
        elevation: 0,
      },
    ],
    [
      "sessions",
      "session",
      {
        title: "Retry session",
        date: "2026-09-16",
        type: "easy",
        duration: 30,
      },
    ],
    [
      "activities",
      "activity",
      {
        name: "Retry activity",
        date: "2026-09-16",
        type: "road",
        distance: 3.2,
        duration: 22,
      },
    ],
  ];
  for (const [route, kind, body] of entries) {
    const headers = {
      "Idempotency-Key": "d1e843a0-743a-47e9-9735-aeaa3a60fdda", // gitleaks:allow -- synthetic request UUID, not an authentication credential
    };
    const before = instance.store.list("live", kind).length;
    const first = await req(`/${route}`, body, "POST", "live", headers);
    assert.equal(first.status, 201);
    // The client may lose the first response after the server committed it.
    const retry = await req(`/${route}`, body, "POST", "live", headers);
    assert.equal(retry.status, 200);
    assert.equal(retry.data.id, first.data.id);
    assert.equal(instance.store.list("live", kind).length, before + 1);
    assert.equal(
      (
        await req(
          `/${route}`,
          { ...body, distance: 9 },
          "POST",
          "live",
          headers,
        )
      ).status,
      409,
    );
    const demo = await req(`/${route}`, body, "POST", "demo", headers);
    assert.equal(demo.status, 201);
    assert.notEqual(demo.data.id, first.data.id);
    await req(`/${route}/${first.data.id}`, null, "DELETE");
    assert.equal(
      (await req(`/${route}`, body, "POST", "live", headers)).status,
      409,
    );
    assert.equal(instance.store.list("live", kind).length, before);
  }
});

test("review follow-ups share one persisted coach conversation with original review context", async () => {
  const activity = instance.store.put("live", "activity", {
    name: "리뷰 연결 테스트",
    date: "2026-09-12",
    type: "road",
    source: "manual",
    distance: 10,
    duration: 50,
    elevation: 10,
  });
  const original = integrations.codex.coach;
  const contexts = [];
  integrations.codex.coach = async (_q, context) => {
    contexts.push(context);
    return "후속 답변";
  };
  try {
    const review = (
      await req(`/activities/${activity.id}/reviews`, { scenario: "race" })
    ).data;
    assert.equal(review.requestedScenario, "race");
    const endpoint = `/activities/${activity.id}/reviews/${review.id}/conversation`;
    assert.equal((await req(endpoint)).data.conversation, null);
    const first = await req("/coach", {
      reviewId: review.id,
      question: "후반은 정리주였어요",
    });
    assert.equal(first.status, 200);
    let thread = (await req(endpoint)).data;
    assert.equal(thread.conversation.title, "2026-09-12 · 리뷰 연결 테스트");
    assert.equal(thread.messages.length, 3);
    assert.equal(thread.messages[0].reviewId, review.id);
    assert.equal(contexts.at(-1).originalReview.text, review.text);
    assert.equal(contexts.at(-1).scope.activityId, activity.id);
    const second = await req("/coach", {
      conversationId: first.data.conversationId,
      question: "다음엔 어떻게 할까요?",
    });
    assert.equal(second.data.conversationId, first.data.conversationId);
    assert.equal(contexts.at(-1).originalReview.requestedScenario, "race");
    assert.equal(contexts.at(-1).previousMessages.length, 3);
    assert.equal((await req(endpoint)).data.messages.length, 5);
    const unrelated = (await req("/conversations", {})).data;
    assert.equal(
      (
        await req("/coach", {
          conversationId: unrelated.id,
          reviewId: review.id,
          question: "wrong",
        })
      ).status,
      409,
    );
    assert.equal((await req(endpoint, null, null, "demo")).status, 404);
    await req(
      `/conversations/${first.data.conversationId}`,
      { archived: true },
      "PATCH",
    );
    assert.equal(
      (await req("/coach", { reviewId: review.id, question: "보관됨" })).status,
      409,
    );
    await req(
      `/conversations/${first.data.conversationId}`,
      { archived: false },
      "PATCH",
    );
    const beforeFailure = (await req(endpoint)).data.messages.length;
    integrations.codex.coach = async () => {
      throw new Error("temporary test failure");
    };
    assert.equal(
      (await req("/coach", { reviewId: review.id, question: "실패 테스트" }))
        .status,
      500,
    );
    assert.equal((await req(endpoint)).data.messages.length, beforeFailure);
  } finally {
    integrations.codex.coach = original;
  }
});

test("opening a review in Coach seeds one reusable conversation without an AI request", async () => {
  const activity = instance.store.put("live", "activity", { name: "이동 테스트", date: "2026-09-12" });
  const review = instance.store.put("live", "review", { activityId: activity.id, text: "저장된 리뷰", requestedScenario: "race", createdAt: new Date().toISOString() });
  const route = `/activities/${activity.id}/reviews/${review.id}/conversation`;
  const first = await req(route, {});
  assert.equal(first.status, 201);
  assert.equal(first.data.title, "2026-09-12 · 이동 테스트");
  assert.equal((await req(route, {})).data.id, first.data.id);
  const saved = (await req(route)).data;
  assert.equal(saved.messages.length, 1);
  assert.equal(saved.messages[0].text, review.text);
  assert.equal(saved.messages[0].coachingScope.scenario, "race");
  assert.equal((await req(route, {}, null, "demo")).status, 404);
});
