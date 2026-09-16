import test from "node:test";
import assert from "node:assert/strict";
import { requestJson } from "../src/http-client.mjs";

test("network failure gives a recovery message without automatically retrying writes", async () => {
  let calls = 0;
  await assert.rejects(
    requestJson("/api/activities", { method: "POST" }, async () => {
      calls++;
      throw new TypeError("Failed to fetch");
    }),
    /Mac에 연결하지 못했습니다/,
  );
  assert.equal(calls, 1);
});
test("proxy HTML failures stay readable and API rejection reasons are preserved", async () => {
  for (const status of [403, 502])
    await assert.rejects(
      requestJson(
        "/api/state",
        {},
        async () => new Response("<html>error</html>", { status }),
      ),
      status === 403
        ? /접속이 허용되지 않았습니다/
        : /서버 응답을 확인하지 못했습니다/,
    );
  await assert.rejects(
    requestJson("/api/state", {}, async () =>
      Response.json({ error: "본인 계정으로 연결하세요" }, { status: 403 }),
    ),
    /본인 계정으로 연결하세요/,
  );
  assert.deepEqual(
    await requestJson("/api/state", {}, async () =>
      Response.json({ activities: [] }),
    ),
    { activities: [] },
  );
});
