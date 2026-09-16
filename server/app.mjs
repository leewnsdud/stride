import express from "express";
import {
  baselineFromActivities,
  evaluateIntake,
  buildCoachedPlan,
} from "./training-policy.mjs";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { createStore } from "./store.mjs";
import { loadRemoteAccess, checkAccess } from "./access.mjs";
import {
  goalSchema,
  sessionSchema,
  activitySchema,
  dateSchema,
  summarize,
  today,
  day,
  monday,
} from "./domain.mjs";
import * as providers from "./providers.mjs";
import { createGarmin } from "./garmin.mjs";
import { CodexBridge } from "./codex.mjs";
import { demoDetail } from "./demo-detail.mjs";
import { AI_MODEL, AI_EFFORT, AI_FALLBACK_MODEL } from "./ai-settings.mjs";
import {
  coachContext,
  scopeSchema,
  scenarioSchema,
} from "./coaching-context.mjs";
import { coachingSkill } from "./coaching-skill.mjs";
import { POLICY_VERSION } from "../shared/training-policy.mjs";
import { reviewContext, REVIEW_PROMPT } from "./activity-review.mjs";
import { planningContext } from "./planning-context.mjs";
import { planningAIPrompt, validateAIProposal } from "./planning-ai.mjs";
export function createApp({
  dataDir = path.resolve("data"),
  integrations = providers,
} = {}) {
  const store = createStore(path.join(dataDir, "stride.sqlite"));
  // Preserve pre-session chat history once, atomically and separately per dataset.
  for (const ds of ["live", "demo"]) {
    const legacy = store.list(ds, "message").filter((m) => !m.conversationId);
    if (legacy.length)
      store.transaction(() => {
        const createdAt = legacy.map((m) => m.createdAt).sort()[0];
        const conversation = store.put(ds, "conversation", {
          title: "이전 대화",
          createdAt,
          updatedAt: legacy
            .map((m) => m.createdAt)
            .sort()
            .at(-1),
          archived: false,
        });
        for (const m of legacy)
          store.put(ds, "message", { ...m, conversationId: conversation.id });
      });
  }
  const remoteAccess = loadRemoteAccess(dataDir);
  const app = express();
  const garmin = integrations.garmin || createGarmin(dataDir);
  const codex = integrations.codex || new CodexBridge();
  app.disable("x-powered-by");
  const configFile = path.join(dataDir, "integrations.json");
  let config = existsSync(configFile)
    ? JSON.parse(readFileSync(configFile, "utf8"))
    : {};
  let syncing = false,
    coaching = false;
  for (const ds of ["live", "demo"])
    for (const job of store.list(ds, "planning-job"))
      if (job.status === "running")
        store.put(ds, "planning-job", {
          ...job,
          status: "failed",
          error: "서버가 재시작되어 생성이 중단됐습니다. 다시 요청해주세요.",
        });
  app.use((req, res, next) => {
    const access = checkAccess({
      method: req.method,
      headers: req.headers,
      address: req.socket.remoteAddress,
      remote: remoteAccess,
      devOrigin: process.env.DEV_ORIGIN,
    });
    if (access.error) return res.status(403).json({ error: access.error });
    res.locals.remote = access.remote;
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", (req, res, next) => {
    req.dataset = req.headers["x-dataset"] === "demo" ? "demo" : "live";
    next();
  });
  const safeActivity = (a) => {
    const { raw, streams, detail, ...rest } = a;
    return rest;
  };
  app.get("/api/state", (req, res) => {
    const ds = req.dataset;
    const sessions = store.sessions(ds),
      activities = store.list(ds, "activity").map(safeActivity);
    res.json({
      dataset: ds,
      access: { remote: res.locals.remote, url: remoteAccess?.origin || null },
      today: today(),
      goals: store.list(ds, "goal"),
      sessions,
      hasAppliedPlan: store.list(ds, "plan-draft").some((d) => d.applied),
      activities,
      summary: summarize(sessions, activities),
      conversations: store
        .list(ds, "conversation")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      messages: store
        .list(ds, "message")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      sync: store.list("live", "sync")[0] || null,
    });
  });
  for (const [kind, schema] of [
    ["goal", goalSchema],
    ["session", sessionSchema],
    ["activity", activitySchema],
  ]) {
    app.post(
      `/api/${kind === "activity" ? "activities" : kind + "s"}`,
      (req, res) => {
        const parsed = schema.parse(req.body);
        const requestKey = req.headers["idempotency-key"];
        const receiptId =
          requestKey === undefined
            ? null
            : `${kind}:${z.string().uuid().parse(requestKey)}`;
        const digest = createHash("sha256")
          .update(JSON.stringify(parsed))
          .digest("hex");
        const receipt =
          receiptId && store.get(req.dataset, "create-request", receiptId);
        if (receipt) {
          const entry = store.get(req.dataset, kind, receipt.entryId);
          if (receipt.digest !== digest || !entry)
            return res.status(409).json({
              error:
                "앞선 저장 요청이 이미 처리되었습니다. 창을 닫고 저장된 기록이나 보관함을 확인한 뒤 수정해주세요.",
            });
          return res.json(entry);
        }
        if (
          kind === "session" &&
          parsed.goalId &&
          !store.get(req.dataset, "goal", parsed.goalId)
        )
          return res.status(400).json({ error: "목표를 찾을 수 없습니다." });
        const saved = store.transaction(() => {
          const entry = store.put(req.dataset, kind, {
            ...parsed,
            ...(kind === "activity" ? { source: "manual" } : {}),
          });
          if (receiptId)
            store.put(req.dataset, "create-request", {
              id: receiptId,
              digest,
              entryId: entry.id,
            });
          return entry;
        });
        res.status(201).json(saved);
      },
    );
    app.put(
      `/api/${kind === "activity" ? "activities" : kind + "s"}/:id`,
      (req, res) => {
        const existing = store.get(req.dataset, kind, req.params.id);
        if (!existing)
          return res.status(404).json({ error: "항목을 찾을 수 없습니다." });
        const data = schema.parse(req.body);
        if (
          kind === "session" &&
          data.goalId &&
          !store.get(req.dataset, "goal", data.goalId)
        )
          return res.status(400).json({ error: "목표를 찾을 수 없습니다." });
        if (
          kind === "session" &&
          data.type === "rest" &&
          store.sessions(req.dataset).find((s) => s.id === req.params.id)
            ?.activityId
        )
          return res
            .status(409)
            .json({ error: "활동 연결을 먼저 해제한 뒤 휴식으로 변경하세요." });
        res.json(
          store.put(req.dataset, kind, {
            ...existing,
            ...data,
            id: req.params.id,
          }),
        );
      },
    );
    app.delete(
      `/api/${kind === "activity" ? "activities" : kind + "s"}/:id`,
      (req, res) => {
        if (!store.get(req.dataset, kind, req.params.id))
          return res.status(404).json({ error: "항목을 찾을 수 없습니다." });
        store.transaction(() => {
          store.put(req.dataset, "trash", {
            kind,
            entry: store.get(req.dataset, kind, req.params.id),
            deletedAt: new Date().toISOString(),
          });
          store.remove(req.dataset, kind, req.params.id);
          if (kind === "goal")
            store
              .list(req.dataset, "session")
              .filter((s) => s.goalId === req.params.id)
              .forEach((s) =>
                store.put(req.dataset, "session", { ...s, goalId: null }),
              );
        });
        res.json({ ok: true });
      },
    );
  }
  const checkPlanningGoals = (ds, p) => {
    for (const [id, date, type, distance, elevation, targetMinutes] of [
      [
        p.goalId,
        p.raceDate,
        p.mode === "hybrid" ? p.priority : p.mode,
        p.raceDistance,
        p.raceElevation,
        p.objective === "performance" ? p.targetMinutes : undefined,
      ],
      [
        p.secondaryGoalId,
        p.secondaryDate,
        p.priority === "road" ? "trail" : "road",
        p.secondaryDistance,
        p.secondaryElevation,
      ],
    ]) {
      if (!id) continue;
      const goal = store.get(ds, "goal", id);
      if (
        !goal ||
        goal.date !== date ||
        goal.type !== type ||
        Number(goal.distance) !== distance ||
        (type === "trail" && (goal.elevation ?? null) !== elevation) ||
        (targetMinutes !== undefined &&
          (goal.targetMinutes ?? null) !== targetMinutes)
      ) {
        const e = new Error(
          "연결한 목표의 날짜·종류·거리·고도 또는 목표 시간이 변경되었습니다. 목표를 다시 선택해주세요.",
        );
        e.status = 409;
        throw e;
      }
    }
  };
  app.get("/api/plan/intake", (req, res) =>
    res.json({
      draft: store.get(req.dataset, "planning", "intake") || null,
      previousBlock:
        store
          .list(req.dataset, "plan-draft")
          .filter((d) => d.applied)
          .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))[0] || null,
      baseline: baselineFromActivities(
        store.list(req.dataset, "activity"),
        today(),
      ),
    }),
  );
  app.put("/api/plan/intake", (req, res) => {
    const input = z
      .object({
        answers: z.record(z.string(), z.unknown()),
        step: z.number().int().min(0).max(6),
      })
      .parse(req.body);
    if (JSON.stringify(input).length > 20000)
      return res.status(400).json({ error: "상담 내용이 너무 깁니다." });
    res.json(
      store.put(req.dataset, "planning", {
        ...store.get(req.dataset, "planning", "intake"),
        id: "intake",
        ...input,
        updatedAt: new Date().toISOString(),
      }),
    );
  });
  const savePlanningDraft = (ds, answers, extra = {}) => {
    const plan = planningContext(store, ds, buildCoachedPlan(answers, today()));
    checkPlanningGoals(ds, plan.profile);
    const conflicts = store
      .sessions(ds)
      .filter((s) => plan.sessions.some((n) => n.date === s.date))
      .map((s) => ({ date: s.date, title: s.title }));
    if (conflicts.length)
      plan.blockers.push(
        "같은 날짜에 기존 훈련이 있습니다. 시작일이나 가능한 요일을 바꿔주세요. 기존 훈련을 자동으로 덮어쓰지 않습니다.",
      );
    return store.put(ds, "plan-draft", {
      ...plan,
      ...extra,
      conflicts,
      createdAt: new Date().toISOString(),
      applied: false,
    });
  };
  app.post("/api/plan/coaching-preview", (req, res) => {
    res.json(savePlanningDraft(req.dataset, req.body));
  });
  app.get("/api/plan/jobs", (req, res) => {
    res.json(
      store
        .list(req.dataset, "planning-job")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10),
    );
  });
  app.get("/api/plan/drafts/:id", (req, res) => {
    const draft = store.get(req.dataset, "plan-draft", req.params.id);
    if (!draft)
      return res.status(404).json({ error: "검토할 계획을 찾을 수 없습니다." });
    res.json(draft);
  });
  app.delete("/api/plan/intake", (req, res) => {
    if (
      store
        .list(req.dataset, "planning-job")
        .some((j) => j.status === "running")
    )
      return res
        .status(409)
        .json({ error: "계획 생성이 끝난 뒤 상담을 삭제해주세요." });
    store.transaction(() => {
      store.remove(req.dataset, "planning", "intake");
      for (const d of store.list(req.dataset, "plan-draft"))
        if (!d.applied) store.remove(req.dataset, "plan-draft", d.id);
      for (const j of store.list(req.dataset, "planning-job"))
        store.remove(req.dataset, "planning-job", j.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/plan/generate", async (req, res) => {
    const { answers, feedback } = z
      .object({
        answers: z.unknown(),
        feedback: z.string().max(2000).default(""),
      })
      .parse(req.body);
    const plan = buildCoachedPlan(answers, today());
    checkPlanningGoals(req.dataset, plan.profile);
    if (plan.blockers.length)
      return res.status(409).json({ error: plan.blockers.join(" ") });
    if (coaching)
      return res
        .status(409)
        .json({
          error: "AI가 다른 답변을 작성 중입니다. 완료 후 다시 요청해주세요.",
        });
    // Acquire before awaiting authentication to prevent concurrent job creation.
    coaching = true;
    try {
      if (!(await codex.status()).connected) {
        coaching = false;
        return res
          .status(409)
          .json({ error: "설정에서 AI 계정을 연결해주세요." });
      }
    } catch (e) {
      coaching = false;
      throw e;
    }
    const ds = req.dataset;
    let job = store.put(ds, "planning-job", {
      status: "running",
      stage: "계획과 방법론 검토 중",
      createdAt: new Date().toISOString(),
    });
    res.status(202).json(job);
    const run = async () => {
      try {
        const history =
          store.get(ds, "planning", "intake")?.discussion?.slice(-12) || [];
        const first = await codex.coach(
          planningAIPrompt,
          {
            trainingPolicy: planningContext(store, ds, plan),
            feedback,
            previousMessages: history,
          },
          config.codexModel || AI_MODEL,
          null,
          config.codexEffort || AI_EFFORT,
        );
        const proposal = validateAIProposal(
          typeof first === "string" ? first : first.text,
          plan.profile,
          today(),
        );
        job = store.put(ds, "planning-job", {
          ...job,
          stage: "AI 제안의 강도·일정 재검토 중",
        });
        const second = await codex.coach(
          planningAIPrompt +
            " 첫 제안을 비판적으로 재검토하고 최종안을 반환하세요. 개선이 필요 없으면 동일한 변경을 유지하세요.",
          {
            trainingPolicy: proposal.plan,
            originalPolicy: plan,
            feedback,
            firstReview: proposal.explanation,
          },
          config.codexModel || AI_MODEL,
          null,
          config.codexEffort || AI_EFFORT,
        );
        const final = validateAIProposal(
          typeof second === "string" ? second : second.text,
          proposal.answers,
          today(),
        );
        job = store.put(ds, "planning-job", {
          ...job,
          stage: "최종 조건과 기존 일정 검증 중",
        });
        const draft = savePlanningDraft(ds, final.answers, {
          aiReview: {
            text: final.explanation,
            firstReview: proposal.explanation,
            feedback,
            model: second.model || config.codexModel || AI_MODEL,
            effort: second.effort || config.codexEffort || AI_EFFORT,
          },
        });
        store.put(ds, "planning-job", {
          ...job,
          status: "ready",
          stage: "생성 완료 · 검토 후 적용",
          draftId: draft.id,
          finishedAt: new Date().toISOString(),
        });
      } catch (e) {
        store.put(ds, "planning-job", {
          ...job,
          status: "failed",
          error: e.message || "AI 계획 생성에 실패했습니다.",
          finishedAt: new Date().toISOString(),
        });
      } finally {
        coaching = false;
      }
    };
    void run();
  });
  app.post("/api/plan/coaching-apply", (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.body);
    const draft = store.get(req.dataset, "plan-draft", id);
    if (!draft)
      return res.status(404).json({ error: "검토한 계획을 찾을 수 없습니다." });
    if (draft.applied) return res.json({ ok: true, alreadyApplied: true });
    if (draft.blockers.length || !draft.sessions.length)
      return res.status(409).json({
        error: "상담의 확인 사항을 해결하고 다시 미리보기를 만들어주세요.",
      });
    if (
      Date.now() - Date.parse(draft.createdAt) > 86400000 ||
      draft.policyVersion !== POLICY_VERSION ||
      draft.profile.start < today()
    )
      return res
        .status(409)
        .json({ error: "계획을 다시 미리보기 해 최신 일정을 확인해주세요." });
    checkPlanningGoals(req.dataset, draft.profile);
    const conflicts = store
      .sessions(req.dataset)
      .some((s) => draft.sessions.some((n) => n.date === s.date));
    if (conflicts)
      return res.status(409).json({
        error:
          "미리보기 이후 같은 날짜에 훈련이 추가됐습니다. 다시 검토해주세요.",
      });
    const sessions = store.transaction(() => {
      const saved = draft.sessions.map((s) =>
        store.put(req.dataset, "session", sessionSchema.parse(s)),
      );
      store.put(req.dataset, "plan-draft", {
        ...draft,
        applied: true,
        appliedAt: new Date().toISOString(),
        sessionIds: saved.map((s) => s.id),
      });
      for (const job of store.list(req.dataset, "planning-job"))
        if (job.draftId === draft.id)
          store.put(req.dataset, "planning-job", { ...job, status: "applied" });
      return saved;
    });
    res.status(201).json({ sessions });
  });
  app.post("/api/plan/coaching-question", async (req, res) => {
    const { question, answers } = z
      .object({
        question: z.string().trim().min(1).max(2000),
        answers: z.unknown(),
      })
      .parse(req.body);
    const plan = buildCoachedPlan(answers, today());
    const history = (
      store.get(req.dataset, "planning", "intake")?.discussion || []
    ).slice(-12);
    if (coaching)
      return res
        .status(409)
        .json({ error: "코치가 답변을 작성하고 있습니다." });
    coaching = true;
    try {
      const result = await codex.coach(
        "훈련 계획 상담입니다. 사용자의 질문에 답하고 필요한 의사결정을 1~2개 질문하세요. trainingPolicy의 원칙과 차단 사유를 존중하세요. 목표 달성 확률·의학 진단·임의의 새 계획을 확정하지 마세요. 답변은 상담 조언이며 일정은 사용자가 답변을 수정하고 미리보기 후 적용해야 합니다. 질문: " +
          question,
        { trainingPolicy: plan, previousMessages: history },
        config.codexModel || AI_MODEL,
        null,
        config.codexEffort || AI_EFFORT,
      );
      const text = typeof result === "string" ? result : result.text;
      if (!text?.trim()) throw new Error("상담 응답이 비어 있습니다.");
      store.put(req.dataset, "planning", {
        ...store.get(req.dataset, "planning", "intake"),
        id: "intake",
        answers,
        step: 6,
        updatedAt: new Date().toISOString(),
        discussion: [
          ...history,
          { role: "user", text: question },
          {
            role: "assistant",
            text,
            model: result.model || config.codexModel || AI_MODEL,
            effort: result.effort || config.codexEffort || AI_EFFORT,
            fallback: !!result.fallback,
          },
        ].slice(-12),
      });
      res.json({
        text,
        model: result.model || config.codexModel || AI_MODEL,
        fallback: !!result.fallback,
        effort: result.effort || config.codexEffort || AI_EFFORT,
      });
    } finally {
      coaching = false;
    }
  });
  // Old clients must re-enter the reviewed, server-owned draft workflow.
  app.post(["/api/plan/preview", "/api/plan/apply"], (req, res) => {
    res.status(410).json({
      error:
        "이전 계획 생성 방식은 종료되었습니다. 훈련 계획에서 상담 후 새 미리보기를 만들어주세요.",
    });
  });
  app.post("/api/sessions/:id/link", (req, res) => {
    if (store.get(req.dataset, "session", req.params.id)?.type === "rest")
      return res
        .status(400)
        .json({ error: "휴식일에는 활동을 연결할 수 없습니다." });
    const { activityId } = z
      .object({ activityId: z.string().min(1) })
      .parse(req.body);
    try {
      store.link(req.dataset, req.params.id, activityId);
      res.json({ ok: true });
    } catch (e) {
      res.status(409).json({
        error: e.message.includes("UNIQUE")
          ? "이미 다른 훈련에 연결된 활동입니다."
          : e.message,
      });
    }
  });
  app.delete("/api/sessions/:id/link", (req, res) => {
    store.unlink(req.dataset, req.params.id);
    res.json({ ok: true });
  });
  app.get("/api/activities/:id/detail", async (req, res) => {
    const a = store.get(req.dataset, "activity", req.params.id);
    if (!a) return res.status(404).json({ error: "활동을 찾을 수 없습니다." });
    if (req.dataset === "demo" && a.source === "demo")
      return res.json({ ...safeActivity(a), ...demoDetail(a) });
    if (a.source === "garmin") {
      const detail =
        a.detail?.version === 2 && req.query.refresh !== "1"
          ? a.detail
          : await garmin.detail(a.externalId);
      if (detail !== a.detail)
        store.put(req.dataset, "activity", { ...a, detail });
      const { raw, ...publicDetail } = detail;
      return res.json({ ...safeActivity(a), ...publicDetail });
    }
    if (a.source === "intervals" && !a.streams) {
      const key = process.env.INTERVALS_API_KEY || config.intervalsKey;
      if (!key)
        return res
          .status(400)
          .json({ error: "Intervals.icu 연결이 필요합니다." });
      const streams = await integrations.icuRequest(
        key,
        `activity/${encodeURIComponent(a.externalId)}/streams.json`,
      );
      store.put(req.dataset, "activity", { ...a, streams });
      return res.json({
        ...safeActivity(a),
        streams,
        intervals: a.raw?.icu_intervals || [],
      });
    }
    res.json({
      ...safeActivity(a),
      streams: a.streams || [],
      intervals: a.raw?.icu_intervals || [],
    });
  });
  app.get("/api/integrations", async (req, res) =>
    res.json({
      intervals: {
        configured: !!(process.env.INTERVALS_API_KEY || config.intervalsKey),
      },
      garmin: garmin.status(),
      codex: {
        ...(await codex.status()),
        selectedModel: config.codexModel || AI_MODEL,
        fallbackModel: AI_FALLBACK_MODEL,
        reasoningEffort: config.codexEffort || AI_EFFORT,
      },
      syncing,
    }),
  );
  app.post("/api/integrations/garmin/login", async (req, res) => {
    const input = z
      .object({
        email: z.string().email().max(254),
        password: z.string().min(1).max(500),
      })
      .parse(req.body);
    const result = await garmin.login(input);
    res.json(result);
  });
  app.post("/api/integrations/garmin/mfa", async (req, res) => {
    const { code } = z
      .object({
        code: z
          .string()
          .trim()
          .regex(/^\d{4,10}$/),
      })
      .parse(req.body);
    res.json(await garmin.mfa(code));
  });
  app.post("/api/integrations/garmin/cancel", (req, res) => {
    garmin.cancel();
    res.json({ ok: true });
  });
  app.get("/api/integrations/codex/models", async (req, res) =>
    res.json(await codex.models()),
  );
  app.post("/api/integrations/codex/login", async (req, res) =>
    res.json(await codex.loginStart(res.locals.remote)),
  );
  app.post("/api/integrations/codex/model", async (req, res) => {
    const { model, effort } = z
      .object({
        model: z.string().min(1).max(100),
        effort: z
          .enum([
            "none",
            "minimal",
            "low",
            "medium",
            "high",
            "xhigh",
            "max",
            "ultra",
          ])
          .default(AI_EFFORT),
      })
      .parse(req.body);
    if (coaching)
      return res
        .status(409)
        .json({ error: "답변이 완료된 후 모델을 변경해주세요." });
    const available = await codex.models();
    const selected = available.find((m) => m.id === model);
    if (
      !selected ||
      !(selected.reasoningEfforts?.length
        ? selected.reasoningEfforts.includes(effort)
        : effort === AI_EFFORT)
    )
      return res.status(400).json({
        error: "이 계정에서 지원하는 모델과 추론 수준을 선택하세요.",
      });
    config = { ...config, codexModel: model, codexEffort: effort };
    writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 });
    res.json({ ok: true });
  });
  app.post("/api/integrations/intervals", (req, res) => {
    const { key } = z
      .object({ key: z.string().trim().min(8).max(300) })
      .parse(req.body);
    config = { ...config, intervalsKey: key };
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 });
    res.json({ ok: true });
  });
  async function sync(oldest = day(-30), newest = today()) {
    if (syncing) throw new Error("동기화가 이미 진행 중입니다.");
    if (!garmin.status().configured)
      throw new Error("설정에서 Garmin 계정을 연결하세요.");
    syncing = true;
    try {
      const activities = await garmin.activities(oldest, newest);
      store.transaction(() => {
        for (const a of activities) {
          const legacy = store
            .list("live", "activity")
            .filter((x) => x.source === "intervals")
            .filter(
              (x) =>
                String(
                  x.raw?.garmin_activity_id || x.raw?.external_id || "",
                ) === a.externalId ||
                (x.raw?.start_date_local === a.startTimeLocal &&
                  Math.abs(x.distance - a.distance) < 0.01),
            );
          const existing =
            store.get("live", "activity", a.id) ||
            store
              .list("live", "activity")
              .find(
                (x) => x.source === "garmin" && x.externalId === a.externalId,
              ) ||
            (legacy.length === 1 ? legacy[0] : null);
          store.put("live", "activity", {
            ...existing,
            ...a,
            id: existing?.id || a.id,
            notes: existing?.notes || a.notes,
            rpe: existing?.rpe ?? a.rpe,
            detail: existing?.source === "garmin" ? existing.detail : undefined,
          });
        }
        store.put("live", "sync", {
          id: "last",
          at: new Date().toISOString(),
          count: activities.length,
          source: "garmin",
          error: null,
        });
      });
      return { count: activities.length };
    } catch (e) {
      store.put("live", "sync", {
        id: "last",
        at: new Date().toISOString(),
        error: e.message,
        count: 0,
        source: "garmin",
      });
      throw e;
    } finally {
      syncing = false;
    }
  }
  app.post("/api/sync", async (req, res) => {
    if (req.dataset === "demo")
      return res
        .status(400)
        .json({ error: "실제 기록 모드에서 동기화하세요." });
    const dates = z
      .object({
        oldest: dateSchema.default(day(-90)),
        newest: dateSchema.default(today()),
      })
      .parse(req.body || {});
    if (dates.oldest > dates.newest)
      return res.status(400).json({ error: "날짜 범위를 확인하세요." });
    res.json(await sync(dates.oldest, dates.newest));
  });
  app.post("/api/conversations", (req, res) => {
    const { title } = z
      .object({ title: z.string().trim().min(1).max(100).default("새 대화") })
      .parse(req.body);
    const at = new Date().toISOString();
    res.status(201).json(
      store.put(req.dataset, "conversation", {
        title,
        createdAt: at,
        updatedAt: at,
        archived: false,
      }),
    );
  });
  app.delete("/api/conversations/:id", (req, res) => {
    const ds = req.dataset,
      id = req.params.id;
    if (!store.get(ds, "conversation", id))
      return res.status(404).json({ error: "대화를 찾을 수 없습니다." });
    if (coaching)
      return res
        .status(409)
        .json({ error: "답변이 완료된 후 대화를 삭제해주세요." });
    store.transaction(() => {
      for (const message of store.list(ds, "message")) {
        if (message.conversationId === id)
          store.remove(ds, "message", message.id);
      }
      store.remove(ds, "conversation", id);
    });
    res.json({ ok: true });
  });
  app.patch("/api/conversations/:id", (req, res) => {
    const existing = store.get(req.dataset, "conversation", req.params.id);
    if (!existing)
      return res.status(404).json({ error: "대화를 찾을 수 없습니다." });
    if (coaching)
      return res
        .status(409)
        .json({ error: "답변이 완료된 후 대화를 변경해주세요." });
    const changes = z
      .object({
        title: z.string().trim().min(1).max(100).optional(),
        archived: z.boolean().optional(),
      })
      .strict()
      .parse(req.body);
    res.json(
      store.put(req.dataset, "conversation", { ...existing, ...changes }),
    );
  });
  app.post("/api/coach", async (req, res) => {
    const {
      question,
      conversationId,
      reviewId,
      scope: requestedScope,
    } = z
      .object({
        question: z.string().trim().min(1).max(2000),
        conversationId: z.string().min(1).optional(),
        reviewId: z.string().min(1).optional(),
        scope: scopeSchema.default({ kind: "none" }),
      })
      .parse(req.body);
    if (coaching)
      return res
        .status(409)
        .json({ error: "코치가 답변을 작성하고 있습니다." });
    const ds = req.dataset;
    const conversation = conversationId
      ? store.get(ds, "conversation", conversationId)
      : reviewId
        ? store.list(ds, "conversation").find((c) => c.reviewId === reviewId)
        : null;
    const sourceReview =
      reviewId || conversation?.reviewId
        ? store.get(ds, "review", reviewId || conversation.reviewId)
        : null;
    if ((reviewId || conversation?.reviewId) && !sourceReview)
      return res.status(404).json({ error: "리뷰를 찾을 수 없습니다." });
    if (reviewId && conversationId && conversation?.reviewId !== reviewId)
      return res
        .status(409)
        .json({ error: "리뷰와 대화가 일치하지 않습니다." });
    if (sourceReview && conversation?.archived)
      return res.status(409).json({
        error: "보관된 대화입니다. AI 코칭 탭에서 복원한 뒤 이어가세요.",
      });
    const scope = sourceReview
      ? {
          kind: "activity",
          activityId: sourceReview.activityId,
          scenario:
            sourceReview.requestedScenario ||
            (sourceReview.scenario?.race
              ? "race"
              : sourceReview.scenario?.trail
                ? "trail"
                : "auto"),
        }
      : requestedScope;
    if (conversationId && (!conversation || conversation.archived))
      return res.status(404).json({ error: "열린 대화를 찾을 수 없습니다." });
    coaching = true;
    try {
      const records = scope.kind === "none" ? [] : store.list(ds, "activity");
      if (scope.kind === "activity") {
        const activity = records.find((a) => a.id === scope.activityId);
        if (!activity)
          return res
            .status(404)
            .json({ error: "선택한 활동을 찾을 수 없습니다." });
        if (ds === "demo" && activity.source === "demo")
          activity.detail = demoDetail(activity);
        else if (activity.source === "garmin" && !activity.detail) {
          try {
            activity.detail = await garmin.detail(activity.externalId);
            const current = store.get(ds, "activity", activity.id);
            if (current)
              store.put(ds, "activity", {
                ...current,
                detail: activity.detail,
              });
          } catch {
            // Still review the recorded summary and explicitly disclose missing detail.
            activity.detail = null;
          }
        }
      }
      let selectedContext;
      try {
        selectedContext = coachContext({
          activities: records,
          sessions: scope.kind === "none" ? [] : store.sessions(ds),
          goals: scope.kind === "none" ? [] : store.list(ds, "goal"),
          scope,
          today: today(),
          demo: ds === "demo",
        });
      } catch (e) {
        if (e.status) return res.status(e.status).json({ error: e.message });
        throw e;
      }
      const context = {
        ...selectedContext,
        ...(sourceReview
          ? {
              originalReview: {
                text: sourceReview.text,
                scenario: sourceReview.scenario,
                requestedScenario: sourceReview.requestedScenario || null,
                evidence: sourceReview.evidence,
                createdAt: sourceReview.createdAt,
              },
            }
          : {}),
        previousMessages: store
          .list(ds, "message")
          .filter((m) => conversation && m.conversationId === conversation.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .slice(-30)
          .map(({ role, text, coachingScope }) => ({
            role,
            text,
            ...(coachingScope ? { scope: coachingScope } : {}),
          })),
      };
      const skill = coachingSkill(context);
      const result = await codex.coach(
        question,
        context,
        config.codexModel || AI_MODEL,
        skill,
        config.codexEffort || AI_EFFORT,
      );
      const answer = typeof result === "string" ? result : result.text;
      if (!answer?.trim())
        throw new Error("답변이 비어 있습니다. 다시 시도해주세요.");
      const at = new Date().toISOString();
      let savedConversation;
      store.transaction(() => {
        if (sourceReview && !store.get(ds, "activity", sourceReview.activityId))
          throw new Error("활동이 삭제되어 답변을 저장하지 않았습니다.");
        const activity =
          sourceReview && store.get(ds, "activity", sourceReview.activityId);
        const current = conversation || {
          createdAt: at,
          archived: false,
          ...(sourceReview
            ? {
                reviewId: sourceReview.id,
                activityId: activity.id,
                title: `${activity.date} · ${activity.name}`,
              }
            : {}),
        };
        savedConversation = store.put(ds, "conversation", {
          ...current,
          title:
            !current.title || current.title === "새 대화"
              ? question.slice(0, 60)
              : current.title,
          updatedAt: at,
        });
        if (sourceReview && !conversation)
          store.put(ds, "message", {
            conversationId: savedConversation.id,
            role: "assistant",
            text: sourceReview.text,
            reviewId: sourceReview.id,
            coachingScope: context.scope,
            model: sourceReview.model,
            effort: sourceReview.effort,
            createdAt: sourceReview.createdAt,
          });
        store.put(ds, "message", {
          conversationId: savedConversation.id,
          role: "user",
          text: question,
          coachingScope: context.scope,
          createdAt: at,
        });
        store.put(ds, "message", {
          conversationId: savedConversation.id,
          role: "assistant",
          text: answer,
          coachingScope: context.scope,
          coachingSkill: { version: skill.version, modes: skill.modes },
          model: result.model || config.codexModel || AI_MODEL,
          effort: result.effort || config.codexEffort || AI_EFFORT,
          fallback: !!result.fallback,
          createdAt: new Date(Date.now() + 1).toISOString(),
        });
      });
      res.json({
        conversationId: savedConversation.id,
        answer,
        model: result.model || config.codexModel || AI_MODEL,
        fallback: !!result.fallback,
      });
    } finally {
      coaching = false;
    }
  });
  const activityReviews = (ds, id) =>
    store
      .list(ds, "review")
      .filter((r) => r.activityId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  app.get("/api/activities/:id/reviews", (req, res) => {
    if (!store.get(req.dataset, "activity", req.params.id))
      return res.status(404).json({ error: "활동을 찾을 수 없습니다." });
    res.json(activityReviews(req.dataset, req.params.id));
  });
  app.post("/api/activities/:id/reviews/:reviewId/conversation", (req, res) => {
    const ds = req.dataset;
    const review = store.get(ds, "review", req.params.reviewId);
    const activity = store.get(ds, "activity", req.params.id);
    if (!review || !activity || review.activityId !== activity.id)
      return res.status(404).json({ error: "리뷰를 찾을 수 없습니다." });
    const existing = store
      .list(ds, "conversation")
      .find((c) => c.reviewId === review.id);
    if (existing) return res.json(existing);
    if (coaching)
      return res
        .status(409)
        .json({ error: "AI 답변이 완료된 뒤 이동해주세요." });
    let conversation;
    store.transaction(() => {
      const at = new Date().toISOString();
      conversation = store.put(ds, "conversation", {
        reviewId: review.id,
        activityId: activity.id,
        title: `${activity.date} · ${activity.name}`,
        archived: false,
        createdAt: at,
        updatedAt: at,
      });
      store.put(ds, "message", {
        conversationId: conversation.id,
        reviewId: review.id,
        role: "assistant",
        text: review.text,
        model: review.model,
        effort: review.effort,
        createdAt: review.createdAt,
        coachingScope: {
          kind: "activity",
          activityId: activity.id,
          scenario: review.requestedScenario || "auto",
        },
      });
    });
    res.status(201).json(conversation);
  });
  app.get("/api/activities/:id/reviews/:reviewId/conversation", (req, res) => {
    const ds = req.dataset;
    const review = store.get(ds, "review", req.params.reviewId);
    if (
      !review ||
      review.activityId !== req.params.id ||
      !store.get(ds, "activity", req.params.id)
    )
      return res.status(404).json({ error: "리뷰를 찾을 수 없습니다." });
    const conversation = store
      .list(ds, "conversation")
      .find((c) => c.reviewId === review.id);
    res.json({
      conversation: conversation || null,
      messages: conversation
        ? store
            .list(ds, "message")
            .filter((m) => m.conversationId === conversation.id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        : [],
    });
  });
  app.post("/api/activities/:id/reviews", async (req, res) => {
    const { scenario } = z
      .object({ scenario: scenarioSchema.default("auto") })
      .parse(req.body || {});
    const ds = req.dataset,
      id = req.params.id;
    const activity = store.get(ds, "activity", id);
    if (!activity)
      return res.status(404).json({ error: "활동을 찾을 수 없습니다." });
    if (coaching)
      return res.status(409).json({
        error: "AI가 다른 답변을 작성 중입니다. 완료 후 다시 시도하세요.",
      });
    coaching = true;
    try {
      let detail = activity.detail;
      if (ds === "demo" && activity.source === "demo")
        detail = demoDetail(activity);
      else if (activity.source === "garmin" && !detail) {
        detail = await garmin.detail(activity.externalId);
        const current = store.get(ds, "activity", id);
        if (current) store.put(ds, "activity", { ...current, detail });
      }
      const session = store.sessions(ds).find((s) => s.activityId === id);
      const goal = session?.goalId
        ? store.get(ds, "goal", session.goalId)
        : null;
      const context = reviewContext(
        activity,
        detail,
        session,
        goal,
        ds === "demo",
        scenario,
      );
      const skill = coachingSkill(context);
      const result = await codex.coach(
        REVIEW_PROMPT,
        context,
        config.codexModel || AI_MODEL,
        skill,
        config.codexEffort || AI_EFFORT,
      );
      const text = typeof result === "string" ? result : result.text;
      if (!text?.trim())
        throw new Error("리뷰 응답이 비어 있습니다. 다시 시도하세요.");
      if (!store.get(ds, "activity", id))
        return res.status(409).json({
          error: "작성 중 활동이 삭제되어 리뷰를 저장하지 않았습니다.",
        });
      const review = store.put(ds, "review", {
        activityId: id,
        text,
        coachingSkill: { version: skill.version, modes: skill.modes },
        scenario: context.scenario,
        requestedScenario: scenario,
        evidence: {
          analysis: context.analysis,
          dataCoverage: context.dataCoverage,
          plannedSession: context.plannedSession,
        },
        model: result.model || config.codexModel || AI_MODEL,
        fallback: !!result.fallback,
        effort: result.effort || config.codexEffort || AI_EFFORT,
        createdAt: new Date().toISOString(),
        activityUpdatedAt: activity.updatedAt || null,
      });
      res.status(201).json(review);
    } finally {
      coaching = false;
    }
  });
  app.get("/api/trash", (req, res) =>
    res.json(store.list(req.dataset, "trash")),
  );
  app.post("/api/trash/:id/restore", (req, res) => {
    const item = store.get(req.dataset, "trash", req.params.id);
    if (!item)
      return res.status(404).json({ error: "보관된 항목이 없습니다." });
    if (store.get(req.dataset, item.kind, item.entry.id))
      return res.status(409).json({ error: "이미 같은 항목이 존재합니다." });
    store.transaction(() => {
      const entry = { ...item.entry };
      if (
        item.kind === "session" &&
        entry.goalId &&
        !store.get(req.dataset, "goal", entry.goalId)
      )
        entry.goalId = null;
      store.put(req.dataset, item.kind, entry);
      store.remove(req.dataset, "trash", item.id);
    });
    res.json({ ok: true });
  });
  app.get("/api/export", (req, res) =>
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      dataset: req.dataset,
      goals: store.list(req.dataset, "goal"),
      sessions: store.sessions(req.dataset),
      activities: store.list(req.dataset, "activity"),
      conversations: store.list(req.dataset, "conversation"),
      messages: store.list(req.dataset, "message"),
      reviews: store.list(req.dataset, "review"),
      planning: store.list(req.dataset, "planning"),
      plans: store.list(req.dataset, "plan-draft"),
    }),
  );
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "존재하지 않는 API입니다." }),
  );
  app.use(express.static(path.resolve("dist/client"), { index: "index.html" }));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.resolve("dist/client/index.html")),
  );
  app.use((err, req, res, next) => {
    res.status(err instanceof z.ZodError ? 400 : err.status || 500).json({
      error:
        err instanceof z.ZodError
          ? err.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("\n")
          : err.message || "요청을 처리할 수 없습니다.",
    });
  });
  return {
    app,
    store,
    sync,
    close: () => {
      garmin.cancel();
      codex.close();
      store.db.close();
    },
  };
}
