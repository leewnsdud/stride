import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { normalizeGarmin, normalizeGarminDetail } from "./metrics.mjs";

export function createGarmin(dataDir) {
  let active = null;
  const python = process.env.GARMIN_PYTHON || path.resolve(".venv/bin/python");
  function status() {
    return {
      available: existsSync(python),
      configured: existsSync(path.join(dataDir, "garmin/garmin_tokens.json")),
      pendingMfa: !!active?.mfa,
    };
  }
  function launch(input) {
    if (active)
      throw new Error(
        "Garmin 요청이 진행 중입니다. 먼저 완료하거나 취소하세요.",
      );
    let resolveEvent, rejectEvent;
    const next = () =>
      new Promise((resolve, reject) => {
        resolveEvent = resolve;
        rejectEvent = reject;
      });
    const event = next();
    const child = spawn(
      python,
      [path.resolve("server/garmin_bridge.py"), dataDir],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const state = { child, mfa: false, next };
    active = state;
    const finish = () => {
      clearTimeout(timer);
      if (active === state) active = null;
    };
    const fail = (message) => {
      rejectEvent(new Error(message));
      finish();
      child.kill();
    };
    const timer = setTimeout(
      () => fail("Garmin 요청 시간이 초과되었습니다. 다시 연결하세요."),
      300000,
    );
    child.on("error", () =>
      fail("Garmin 연결 모듈을 실행할 수 없습니다. Python 환경을 확인하세요."),
    );
    child.stderr.resume(); // Never log upstream auth diagnostics or credential material.
    child.stdin.on("error", () => {});
    let received = false;
    createInterface({ input: child.stdout }).on("line", (line) => {
      try {
        const value = JSON.parse(line);
        if (value.event === "mfa") {
          state.mfa = true;
          resolveEvent({ mfa: true });
        } else if (value.error) {
          received = true;
          fail(value.error);
        } else if ("result" in value) {
          received = true;
          resolveEvent(value.result);
          finish();
          child.stdin.end();
        }
      } catch {
        fail("Garmin 응답을 읽지 못했습니다.");
      }
    });
    child.on("close", () => {
      if (!received && active === state)
        fail("Garmin 연결이 종료되었습니다. 다시 시도하세요.");
    });
    child.stdin.write(JSON.stringify(input) + "\n");
    return event;
  }
  return {
    status,
    login: (input) => launch({ ...input, command: "login" }),
    mfa: (code) => {
      if (!active?.mfa)
        throw new Error("인증 요청이 만료되었습니다. 다시 연결하세요.");
      const event = active.next();
      active.mfa = false;
      active.child.stdin.write(JSON.stringify({ code }) + "\n");
      return event;
    },
    cancel: () => {
      if (active) {
        const child = active.child;
        child.kill();
      }
    },
    activities: async (oldest, newest) =>
      (await launch({ command: "activities", oldest, newest }))
        .map(normalizeGarmin)
        .filter(Boolean),
    detail: async (id) =>
      normalizeGarminDetail(await launch({ command: "detail", id })),
  };
}
