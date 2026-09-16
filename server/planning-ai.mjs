import { z } from "zod";
import { buildCoachedPlan } from "./training-policy.mjs";

const proposalSchema = z
  .object({
    explanation: z.string().min(1).max(6000),
    changes: z
      .object({
        method: z
          .enum([
            "auto",
            "foundation",
            "pyramidal",
            "polarized",
            "subthreshold",
          ])
          .optional(),
        trailApproach: z
          .enum(["auto", "aerobic", "uphill", "course"])
          .optional(),
        weeklyLimit: z.number().min(30).max(1800).optional(),
        qualityDaysPerWeek: z.number().int().min(0).max(2).optional(),
        qualityMinutesPerWeek: z.number().min(0).max(240).optional(),
      })
      .strict(),
  })
  .strict();
export function validateAIProposal(text, answers, today) {
  const parsed = proposalSchema.parse(
    JSON.parse(
      text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    ),
  );
  const changes = parsed.changes;
  for (const key of [
    "weeklyLimit",
    "qualityDaysPerWeek",
    "qualityMinutesPerWeek",
  ]) {
    if (
      changes[key] != null &&
      changes[key] >
        Number(answers[key] ?? (key === "qualityDaysPerWeek" ? 1 : 15))
    )
      throw new Error(
        "AI가 확인한 시간·강도 상한을 늘리는 변경을 제안했습니다. 조건을 직접 수정한 뒤 다시 요청해주세요.",
      );
  }
  const next = { ...answers, ...changes };
  const plan = buildCoachedPlan(next, today);
  if (plan.blockers.length) throw new Error(plan.blockers.join(" "));
  return { explanation: parsed.explanation, changes, answers: next, plan };
}
export const planningAIPrompt = `훈련 계획을 검토하고 개선하세요. 제공된 methodology sources와 trainingPolicy를 근거로 목표·현재 기반·회복·일정·대회 특이성을 점검하세요. 사용자 기록을 새로운 사실로 추측하거나 통증 차단을 해제하지 마세요. 목표 기록을 현재 능력으로 간주하지 마세요. 기존 방법이 적합하면 유지하세요. 훈련량 및 강도 상한은 줄일 수만 있습니다. 날짜·가능 요일·지형·기록·경험·회복 답변은 변경할 수 없습니다. JSON만 반환하세요: {"explanation":"한국어 검토 근거, 변경 이유 및 한계", "changes":{}}. changes는 method(auto/foundation/pyramidal/polarized/subthreshold), trailApproach(auto/aerobic/uphill/course), weeklyLimit, qualityDaysPerWeek, qualityMinutesPerWeek 중 필요한 변경만 포함합니다. 강도 일수와 시간은 함께 0 또는 함께 양수여야 합니다. 별도 세션이나 의료 진단을 만들지 마세요.`;
