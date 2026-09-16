import test from "node:test";
import assert from "node:assert/strict";
import { checkAccess, loadRemoteAccess } from "../server/access.mjs";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
const remote = {
  origin: "https://runner.example.ts.net",
  host: "runner.example.ts.net",
  login: "owner@example.com",
};
const check = (headers = {}, options = {}) =>
  checkAccess({
    headers: { host: "127.0.0.1:4318", ...headers },
    address: "127.0.0.1",
    remote,
    ...options,
  });
test("local same-origin access remains functional", () => {
  assert.deepEqual(check({ origin: "http://127.0.0.1:4318" }), {
    remote: false,
  });
  assert.ok(check({ origin: "https://evil.example" }).error);
  assert.ok(check({ host: "evil.example" }).error);
  assert.ok(check({ host: "[evil.example" }).error);
});
test("Serve allows only the configured owner and HTTPS origin", () => {
  const headers = {
    host: remote.host,
    "x-forwarded-proto": "https",
    "tailscale-user-login": remote.login,
    origin: remote.origin,
  };
  assert.deepEqual(check(headers), { remote: true });
  assert.ok(
    check({ ...headers, "tailscale-user-login": "other@example.com" }).error,
  );
  assert.ok(check({ ...headers, "tailscale-user-login": undefined }).error);
  assert.ok(
    check({ ...headers, origin: "https://other.example.ts.net" }).error,
  );
  assert.ok(check({ ...headers, origin: "null" }).error);
  assert.ok(check({ ...headers, host: "unconfigured.example.ts.net" }).error);
  assert.ok(check(headers, { remote: null }).error);
  assert.ok(check(headers, { address: "100.64.0.2" }).error);
});
test("proxy cannot bypass identity by rewriting Host to localhost", () => {
  assert.ok(check({ "x-forwarded-for": "100.64.0.2" }).error);
  assert.ok(
    check({
      "x-forwarded-proto": "https",
      "tailscale-user-login": "other@example.com",
    }).error,
  );
  assert.deepEqual(
    check({
      "x-forwarded-for": "100.64.0.2",
      "tailscale-user-login": remote.login,
      origin: remote.origin,
    }),
    { remote: true },
  );
  assert.ok(
    check({
      "tailscale-user-login": remote.login,
      origin: "http://127.0.0.1:4318",
    }).error,
  );
});
test("blocks cross-site navigation and forwarded headers without remote config", () => {
  assert.ok(
    check({ "sec-fetch-site": "cross-site" }, { method: "POST" }).error,
  );
  assert.ok(
    check({ "tailscale-user-login": remote.login }, { remote: null }).error,
  );
  assert.deepEqual(
    check(
      { origin: "http://127.0.0.1:4317" },
      { devOrigin: "http://127.0.0.1:4317" },
    ),
    { remote: false },
  );
});
test("remote configuration is optional and fails closed if malformed", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "stride-access-"));
  try {
    assert.equal(loadRemoteAccess(dir), null);
    writeFileSync(
      path.join(dir, "remote-access.json"),
      JSON.stringify({ origin: remote.origin, login: remote.login }),
    );
    assert.deepEqual(loadRemoteAccess(dir), remote);
    for (const origin of [
      "http://runner.example.ts.net",
      "https://example.com",
      "https://runner.example.ts.net/path",
      "https://user@runner.example.ts.net",
    ]) {
      writeFileSync(
        path.join(dir, "remote-access.json"),
        JSON.stringify({ origin, login: remote.login }),
      );
      assert.throws(() => loadRemoteAccess(dir));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
