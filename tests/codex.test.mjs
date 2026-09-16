import test from "node:test";
import assert from "node:assert/strict";
import { CodexBridge } from "../server/codex.mjs";
function bridge(timeout = 1000) {
  const b = new CodexBridge({ turnTimeoutMs: timeout }),
    calls = [];
  b.status = async () => ({ connected: true });
  b.models = async () => [{ id: "gpt-5.6-sol", isDefault: true }];
  b.request = async (method, params) => {
    calls.push({ method, params });
    if (method === "config/read")
      return { config: { mcp_servers: { private_connector: {} } } };
    if (method === "thread/start") return { thread: { id: "t" } };
    return { turn: { id: "turn1" } };
  };
  return { b, calls };
}
test("structured coaching uses subscription catalog, read-only ephemeral thread and no connectors", async () => {
  const { b, calls } = bridge();
  const result = b.coach("question", { demo: true }, "gpt-5.6-sol", {
    instructions: "LOCAL_COACHING_SKILL",
  });
  await new Promise((r) => setImmediate(r));
  const start = calls.find((c) => c.method === "thread/start").params;
  assert.equal(start.model, "gpt-5.6-sol");
  assert.ok(start.baseInstructions.includes("LOCAL_COACHING_SKILL"));
  assert.ok(start.baseInstructions.includes("Never diagnose"));
  assert.equal(
    calls.find((c) => c.method === "turn/start").params.effort,
    "medium",
  );
  assert.equal(start.ephemeral, true);
  assert.equal(start.sandbox, "read-only");
  assert.equal(start.config["mcp_servers.private_connector.enabled"], false);
  b.events.emit("notification", {
    method: "item/completed",
    params: {
      threadId: "other",
      item: { type: "agentMessage", text: "wrong" },
    },
  });
  b.events.emit("notification", {
    method: "item/completed",
    params: { threadId: "t", item: { type: "agentMessage", text: "answer" } },
  });
  b.events.emit("notification", {
    method: "turn/completed",
    params: { threadId: "t", turn: { status: "completed" } },
  });
  assert.deepEqual(await result, {
    text: "answer",
    model: "gpt-5.6-sol",
    effort: "medium",
    fallback: false,
  });
  assert.equal(b.events.listenerCount("notification"), 0);
});
test("failed turns never return partial answers, timeouts interrupt the turn", async () => {
  const { b } = bridge();
  const result = b.coach("question", {});
  await new Promise((r) => setImmediate(r));
  b.events.emit("notification", {
    method: "item/completed",
    params: { threadId: "t", item: { type: "agentMessage", text: "partial" } },
  });
  b.events.emit("notification", {
    method: "turn/completed",
    params: { threadId: "t", turn: { status: "failed" } },
  });
  await assert.rejects(result, /완료하지/);
  const timed = bridge(10);
  await assert.rejects(timed.b.coach("question", {}), /초과/);
  assert.ok(
    timed.calls.some(
      (c) => c.method === "turn/interrupt" && c.params.turnId === "turn1",
    ),
  );
});
test("remote login uses device code while local login uses browser OAuth", async () => {
  const { b, calls } = bridge();
  b.start = async () => {};
  await b.loginStart(true);
  await b.loginStart(false);
  assert.equal(calls[0].params.type, "chatgptDeviceCode");
  assert.equal(calls[1].params.type, "chatgpt");
  await assert.rejects(
    b.coach("question", {}, "unavailable"),
    /사용 가능한 코칭 모델/,
  );
});

test("usage limit falls back once to Luna and next request returns to Sol", async () => {
  const { b } = bridge();
  b.models = async () => [{ id: "gpt-5.6-sol" }, { id: "gpt-5.6-luna" }];
  const models = [];
  let exhausted = true;
  b.runCoach = async (q, c, model) => {
    models.push(model);
    if (model === "gpt-5.6-sol" && exhausted)
      throw Object.assign(new Error("limit"), {
        codexErrorInfo: "UsageLimitExceeded",
      });
    return "complete";
  };
  assert.deepEqual(await b.coach("q", {}), {
    text: "complete",
    model: "gpt-5.6-luna",
    effort: "medium",
    fallback: true,
  });
  exhausted = false;
  assert.equal((await b.coach("q", {})).fallback, false);
  assert.deepEqual(models, ["gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.6-sol"]);
});
test("no fallback for authentication or network errors, and Luna limit stops retries", async () => {
  const { b } = bridge();
  b.models = async () => [{ id: "gpt-5.6-sol" }, { id: "gpt-5.6-luna" }];
  let attempts = 0;
  b.runCoach = async () => {
    attempts++;
    throw new Error("Unauthorized");
  };
  await assert.rejects(b.coach("q", {}), /Unauthorized/);
  assert.equal(attempts, 1);
  attempts = 0;
  b.runCoach = async () => {
    attempts++;
    throw Object.assign(new Error("limit"), {
      codexErrorInfo: "usageLimitExceeded",
    });
  };
  await assert.rejects(b.coach("q", {}), /선택한 모델과 Luna/);
  assert.equal(attempts, 2);
});
test("turn error notification preserves usage limit for fallback", async () => {
  const { b, calls } = bridge();
  b.models = async () => [{ id: "gpt-5.6-sol" }, { id: "gpt-5.6-luna" }];
  const result = b.coach("q", {});
  await new Promise((r) => setImmediate(r));
  b.events.emit("notification", {
    method: "error",
    params: {
      threadId: "t",
      error: { message: "limit", codexErrorInfo: "UsageLimitExceeded" },
    },
  });
  b.events.emit("notification", {
    method: "turn/completed",
    params: { threadId: "t", turn: { status: "failed" } },
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(
    calls.filter((c) => c.method === "turn/start").at(-1).params.model,
    "gpt-5.6-luna",
  );
  b.events.emit("notification", {
    method: "item/completed",
    params: { threadId: "t", item: { type: "agentMessage", text: "luna" } },
  });
  b.events.emit("notification", {
    method: "turn/completed",
    params: { threadId: "t", turn: { status: "completed" } },
  });
  assert.equal((await result).model, "gpt-5.6-luna");
});

test("selected catalog model is used and direct Luna does not retry itself", async () => {
  const { b } = bridge();
  b.models = async () => [
    { id: "gpt-5.6-sol" },
    { id: "gpt-5.6-luna" },
    { id: "other", reasoningEfforts: ["medium"] },
  ];
  let calls = [];
  b.runCoach = async (q, c, m) => {
    calls.push(m);
    return "answer";
  };
  assert.equal((await b.coach("q", {}, "other")).model, "other");
  assert.deepEqual(calls, ["other"]);
  calls = [];
  b.runCoach = async (q, c, m) => {
    calls.push(m);
    throw Object.assign(new Error("limit"), { code: "usage_limit_reached" });
  };
  await assert.rejects(b.coach("q", {}, "gpt-5.6-luna"));
  assert.deepEqual(calls, ["gpt-5.6-luna"]);
});

test("catalog pagination includes later models and their supported efforts", async () => {
  const b = new CodexBridge();
  b.start = async () => {};
  const cursors = [];
  b.request = async (method, params) => {
    assert.equal(method, "model/list");
    cursors.push(params.cursor);
    return params.cursor
      ? {
          data: [
            {
              model: "gpt-6-astra",
              supportedReasoningEfforts: [{ reasoningEffort: "high" }],
              defaultReasoningEffort: "high",
            },
          ],
          nextCursor: null,
        }
      : { data: [{ model: "gpt-5.6-sol" }], nextCursor: "next" };
  };
  const models = await b.models();
  assert.deepEqual(cursors, [undefined, "next"]);
  assert.deepEqual(models[1].reasoningEfforts, ["high"]);
  assert.equal(models[1].id, "gpt-6-astra");
});

test("chosen effort reaches turn/start and returned metadata", async () => {
  const { b, calls } = bridge();
  b.models = async () => [
    { id: "gpt-5.6-sol", reasoningEfforts: ["medium", "high"] },
  ];
  await assert.rejects(b.coach("q", {}, "gpt-5.6-sol", null, "ultra"));
  const result = b.coach("q", {}, "gpt-5.6-sol", null, "high");
  await new Promise((r) => setImmediate(r));
  assert.equal(
    calls.find((c) => c.method === "turn/start").params.effort,
    "high",
  );
  b.events.emit("notification", {
    method: "item/completed",
    params: { threadId: "t", item: { type: "agentMessage", text: "answer" } },
  });
  b.events.emit("notification", {
    method: "turn/completed",
    params: { threadId: "t", turn: { status: "completed" } },
  });
  assert.equal((await result).effort, "high");
});

test("higher-effort usage fallback is once at Luna medium and reports actual effort", async () => {
  const { b } = bridge();
  b.models = async () => [
    { id: "gpt-5.6-sol", reasoningEfforts: ["ultra"] },
    { id: "gpt-5.6-luna", reasoningEfforts: ["medium"] },
  ];
  const attempts = [];
  b.runCoach = async (q, c, model, skill, effort) => {
    attempts.push({ model, effort });
    if (model === "gpt-5.6-sol")
      throw Object.assign(new Error("limit"), {
        codexErrorInfo: "UsageLimitExceeded",
      });
    return "answer";
  };
  const result = await b.coach("q", {}, "gpt-5.6-sol", null, "ultra");
  assert.deepEqual(attempts, [
    { model: "gpt-5.6-sol", effort: "ultra" },
    { model: "gpt-5.6-luna", effort: "medium" },
  ]);
  assert.equal(result.effort, "medium");
  assert.equal(result.fallback, true);
});
