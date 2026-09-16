import { z } from "zod";
import { intensityNumber } from "../shared/workout.mjs";
const text = z.string().max(2000).default("");
const intensity = z
  .object({
    metric: z.enum(["none", "pace", "hr", "rpe", "power"]).default("none"),
    low: z.string().max(20).default(""),
    high: z.string().max(20).default(""),
    basis: text,
    date: z.string().max(10).default(""),
  })
  .superRefine((v, c) => {
    if (v.metric === "none") return;
    const lo = intensityNumber(v.low, v.metric),
      hi = intensityNumber(v.high || v.low, v.metric);
    if (
      lo == null ||
      !Number.isFinite(lo) ||
      !Number.isFinite(hi) ||
      lo <= 0 ||
      lo > hi ||
      (v.metric === "rpe" && hi > 10) ||
      (v.metric === "hr" && hi > 250)
    )
      c.addIssue({
        code: "custom",
        message: "강도 범위와 단위를 확인하세요. 페이스는 분:초 형식입니다.",
      });
  });
const step = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(100),
    type: z.enum([
      "warmup",
      "work",
      "recovery",
      "cooldown",
      "repeat",
      "sequence",
    ]),
    name: z.string().min(1).max(100),
    end: z.enum(["distance", "time", "manual"]).default("time"),
    min: z.number().positive().max(100000).nullable().default(null),
    max: z.number().positive().max(100000).nullable().default(null),
    condition: z.enum(["always", "between"]).default("always"),
    count: z.number().int().min(1).max(100).default(1),
    children: z.array(step).max(100).default([]),
    intensity: intensity.optional(),
    notes: text,
  }),
);
export const workoutSchema = z
  .object({
    purpose: text,
    timeSlot: z.string().max(30).default(""),
    amountBasis: z
      .enum(["distance", "time", "steps", "rest"])
      .default("distance"),
    totalKind: z.enum(["exact", "estimate", "unknown"]).default("unknown"),
    priority: z.enum(["key", "normal", "optional"]).default("normal"),
    terrain: text,
    fueling: text,
    equipment: text,
    moveRule: text,
    adjustmentRule: text,
    evaluation: text,
    intensity: intensity.optional(),
    steps: z.array(step).max(100).default([]),
    race: z
      .object({
        kind: z.enum(["race", "tt", "benchmark"]).default("race"),
        role: z.enum(["goal", "checkpoint", "training"]).default("goal"),
        strategy: text,
        criteria: text,
        before: text,
        after: text,
        resultUse: text,
      })
      .optional(),
  })
  .superRefine((w, c) => {
    const ids = new Set();
    let count = 0,
      expanded = 0;
    function visit(nodes, parent, depth, multiplier) {
      for (const s of nodes) {
        count++;
        if (ids.has(s.id) || depth > 4 || count > 100)
          c.addIssue({
            code: "custom",
            message: "단계 ID 중복 또는 단계 한도 초과입니다.",
          });
        ids.add(s.id);
        if (s.condition === "between" && parent !== "repeat")
          c.addIssue({
            code: "custom",
            message: "반복 사이 회복은 반복 묶음 안에서만 사용할 수 있습니다.",
          });
        if (["repeat", "sequence"].includes(s.type)) {
          if (!s.children.length)
            c.addIssue({
              code: "custom",
              message: "묶음에 단계를 추가하세요.",
            });
          visit(
            s.children,
            s.type,
            depth + 1,
            multiplier * (s.type === "repeat" ? s.count : 1),
          );
        } else {
          expanded += multiplier;
          if (s.children.length)
            c.addIssue({
              code: "custom",
              message: "일반 단계에는 하위 단계가 올 수 없습니다.",
            });
          if (s.end === "manual") {
            if (!s.notes.trim() || s.min !== null || s.max !== null)
              c.addIssue({
                code: "custom",
                message:
                  "수동 종료는 수행량 없이 종료 조건을 메모에 작성하세요.",
              });
          } else if (s.min == null || s.max == null || s.min > s.max)
            c.addIssue({
              code: "custom",
              message: "단계 수행량의 최소·최대를 올바르게 입력하세요.",
            });
        }
      }
    }
    visit(w.steps, null, 1, 1);
    if (expanded > 10000)
      c.addIssue({
        code: "custom",
        message: "전체 반복 수행이 너무 많습니다.",
      });
  });
