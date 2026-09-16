// Isolated UI QA: synthetic records, simulated integrations, disposable database.
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { today, day } from "../server/domain.mjs";
import { profile } from "../tests/fixtures/planning.mjs";
const dir = await mkdtemp(path.join(os.tmpdir(), "stride-ui-qa-"));
let failCoach = process.env.QA_COACH_FAILURE === "1";
const instance = createApp({
  dataDir: dir,
  integrations: {
    codex: {
      close() {},
      status: async () => ({
        connected: true,
        available: true,
        method: "chatgpt",
      }),
      models: async () => [{ id: "gpt-5.6-sol", reasoningEfforts: ["medium"] }],
      coach: async () => {
        if (process.env.QA_COACH_FAILURE === "1")
          await new Promise((resolve) => setTimeout(resolve, 4000));
        if (failCoach) {
          failCoach = false;
          throw new Error("QA: 코칭 응답을 받지 못했습니다. 다시 시도하세요.");
        }
        return {
          text: "QA 모의 응답입니다. 실제 코칭 품질 검증에는 사용하지 않습니다.",
          model: "gpt-5.6-sol",
          effort: "medium",
        };
      },
    },
    garmin: {
      cancel() {},
      status: () => ({ configured: true, available: true }),
      activities: async () => {
        throw new Error("QA: 연결을 확인한 뒤 다시 시도하세요.");
      },
    },
  },
});
const date = today();
const qaPort = Number(process.env.QA_PORT || 4320);
let dropCreateResponse = process.env.QA_DROP_CREATE_RESPONSE === "1";
const qaTrace = process.env.QA_TRACE === "1";
const qaFailures = process.env.QA_FAILURES === "1";
let failTrash = process.env.QA_TRASH_FAILURE === "1";
if (failTrash)
  instance.store.put("live", "trash", {
    id: "qa-restore",
    kind: "activity",
    deletedAt: new Date().toISOString(),
    entry: {
      id: "qa-restored",
      source: "manual",
      name: "QA 보관함 복원",
      date,
      distance: 6.25,
      duration: 38.5,
      type: "road",
      elevation: null,
      hr: null,
      rpe: null,
      notes: "복원 테스트",
    },
  });
instance.store.put("live", "activity", {
  id: "qa-detail",
  externalId: "qa-synthetic",
  source: "garmin",
  name: "QA 상세 표본 러닝",
  date: day(-1, date),
  distance: 5,
  duration: 30,
  type: "road",
  elevation: 12,
  detail: {
    version: 2,
    points: Array.from({ length: 61 }, (_, i) => ({
      time: i * 30,
      timer: i * 30,
      distance: (i * 5000) / 60,
      pace: 6,
      hr: 140 + i / 6,
      cadence: 174,
      lat: 37.5 + 0.001 * Math.sin((i * Math.PI) / 30),
      lon: 127 + 0.001 * Math.cos((i * Math.PI) / 30),
    })),
    stats: {},
    ...(process.env.QA_ZONE_FIXTURE === "1"
      ? {
          hrZones: [
            { zone: 1, low: 100, seconds: 60 },
            { zone: 2, low: 130, seconds: null },
          ],
          powerZones: [
            { zone: 1, low: 100, seconds: 0 },
            { zone: 2, low: 150, seconds: 0 },
          ],
        }
      : {}),
    laps: [],
    splits: [],
  },
});
instance.store.put("live", "activity", {
  id: "qa-run",
  source: "manual",
  name: "QA 합성 러닝",
  date: day(-2, date),
  distance: 8,
  duration: 40,
  type: "road",
  elevation: 20,
});
instance.store.put("live", "session", {
  id: "qa-done",
  title: "QA 완료한 러닝",
  date: day(-2, date),
  type: "easy",
  distance: 8,
  duration: 40,
});
instance.store.link("live", "qa-done", "qa-run");
instance.store.put("live", "session", {
  id: "qa-rest",
  title: "QA 휴식일",
  date: day(-1, date),
  type: "rest",
  distance: null,
  duration: null,
});
instance.store.put("live", "session", {
  id: "qa-time",
  title: "QA 시간 중심 훈련",
  date: day(1, date),
  type: "easy",
  distance: null,
  duration: 30,
});
instance.store.put("live", "planning", {
  id: "intake",
  answers: {
    ...profile,
    start: day(7, date),
    raceDate: day(90, date),
    strength: "none",
    notes: "QA 합성 상담",
    ...(process.env.QA_TRAINING_SPECTRUM === "1"
      ? {
          experience: "experienced",
          consistency: 52,
          baselineMinutes: 600,
          baselineKm: 110,
          longestMinutes: 150,
          qualityDaysPerWeek: 2,
          qualityMinutesPerWeek: 80,
          currentRunsPerWeek: 7,
          availability: [60, 100, 80, 100, 60, 70, 180],
          weeklyLimit: 660,
          raceDate: day(49, date),
          objective: "performance",
          targetMinutes: 159,
        }
      : {}),
  },
  step: 0,
});
let failIntake = true;
let failAnalysis = qaFailures;
let failReviews = qaFailures;
const server = http.createServer((req, res) => {
  if (
    process.env.QA_DROP_CREATE_RESPONSE === "1" &&
    req.method === "POST" &&
    req.url === "/api/activities"
  ) {
    if (dropCreateResponse) {
      dropCreateResponse = false;
      res.end = () => {
        console.log(
          "QA_CREATE_COMMITTED_RESPONSE_DROPPED",
          instance.store.list("live", "activity").length,
        );
        res.destroy();
        return res;
      };
    } else {
      res.on("finish", () =>
        console.log(
          "QA_CREATE_RETRY",
          res.statusCode,
          instance.store.list("live", "activity").length,
        ),
      );
    }
    return setTimeout(() => instance.app(req, res), 2500);
  }
  if (failTrash && req.method === "GET" && req.url === "/api/trash") {
    failTrash = false;
    res.writeHead(503, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ error: "QA: 보관함을 불러오지 못했습니다." }),
    );
  }
  if (qaTrace && /\/activities\/.+\/(detail|reviews)/.test(req.url)) {
    console.log("REQUEST", req.url);
    res.on("finish", () => console.log("RESPONSE", res.statusCode, req.url));
  }
  if (qaTrace && /\.(js|css)(\?|$)/.test(req.url))
    console.log("ASSET", req.url);
  if (failAnalysis && /\/assets\/ActivityAnalysis-.*\.js/.test(req.url)) {
    failAnalysis = false;
    res.writeHead(503, {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
    });
    return res.end("QA: simulated chunk failure");
  }
  if (
    failReviews &&
    req.method === "GET" &&
    req.url === "/api/activities/qa-run/reviews"
  ) {
    failReviews = false;
    res.writeHead(503, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "QA: 리뷰 요청 실패" }));
  }
  if (qaFailures && req.url === "/api/activities/qa-run/detail") {
    return setTimeout(() => instance.app(req, res), 6000);
  }
  if (req.method === "GET" && req.url === "/api/plan/intake" && failIntake) {
    failIntake = false;
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "QA: 상담을 불러오지 못했습니다. 다시 시도하세요.",
      }),
    );
  } else instance.app(req, res);
});
server.listen(qaPort, "127.0.0.1", () =>
  console.log(`QA_READY http://127.0.0.1:${qaPort} · synthetic data only`),
);
async function close() {
  await new Promise((resolve) => server.close(resolve));
  instance.store.db.close();
  await rm(dir, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
