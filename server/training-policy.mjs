import { trainingCapacity, qualityRecipe } from "./training-capacity.mjs";
import { z } from "zod";
import { dateSchema, day, monday, sessionSchema } from "./domain.mjs";
import {
  POLICY_VERSION,
  methodLabels,
  policySources,
  adjustmentRules,
  methodDescriptions,
  trailApproaches,
} from "../shared/training-policy.mjs";
const optionalDate = z.union([dateSchema, z.literal("")]).default("");
const optionalNumber = (min, max) =>
  z
    .preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.coerce.number().min(min).max(max).nullable(),
    )
    .default(null);
export const intakeSchema = z
  .object({
    mode: z.enum(["road", "trail", "hybrid"]),
    priority: z.enum(["road", "trail"]).default("road"),
    start: dateSchema,
    goalId: z.string().nullable().default(null),
    secondaryGoalId: z.string().nullable().default(null),
    raceDate: optionalDate,
    raceDistance: optionalNumber(1, 300),
    raceElevation: optionalNumber(0, 30000),
    targetMinutes: optionalNumber(10, 5000),
    secondaryDate: optionalDate,
    secondaryDistance: optionalNumber(1, 300),
    secondaryElevation: optionalNumber(0, 30000),
    objective: z.enum(["finish", "performance", "base"]),
    baselineConfirmed: z.literal(true),
    baselineMinutes: z.coerce.number().min(0).max(1800),
    baselineKm: z.coerce.number().min(0).max(250),
    baselineElevation: z.coerce.number().min(0).max(15000),
    longestMinutes: z.coerce.number().min(0).max(600),
    longestKm: z.coerce.number().min(0).max(150),
    consistency: z.coerce.number().int().min(0).max(104),
    experience: z.enum(["new", "regular", "experienced"]),
    qualityExperience: z.boolean(),
    qualityDaysPerWeek: z.coerce.number().int().min(0).max(4).optional(),
    currentRunsPerWeek: optionalNumber(1, 14),
    allowDoubles: z.boolean().default(false),
    qualityMinutesPerWeek: optionalNumber(0, 240),
    walkingMinutes: optionalNumber(0, 120),
    nightRunning: z.boolean().default(false),
    recovery: z.enum(["ready", "tired", "pain", "illness"]),
    recentInjury: z.boolean(),
    sleep: z.coerce.number().min(2).max(12),
    availability: z
      .array(z.coerce.number().min(0).max(600))
      .length(7)
      .default([0, 45, 0, 45, 0, 30, 90]),
    availableDays: z
      .array(z.number().int().min(0).max(6))
      .min(2)
      .max(7)
      .optional(),
    longDay: z.coerce.number().int().min(0).max(6),
    weeklyLimit: z.coerce.number().min(30).max(1800),
    terrain: z.enum(["flat", "hills", "trail"]),
    terrains: z
      .array(z.enum(["flat", "hills", "trail"]))
      .min(1)
      .optional(),
    descent: z.enum(["new", "some", "experienced"]),
    strength: z.enum(["none", "new", "regular"]),
    fueling: z.enum(["new", "practiced"]),
    method: z.enum([
      "auto",
      "foundation",
      "pyramidal",
      "polarized",
      "subthreshold",
    ]),
    trailApproach: z
      .enum(["auto", "aerobic", "uphill", "course"])
      .default("auto"),
    recentRaceDistance: optionalNumber(3, 100),
    recentRaceMinutes: optionalNumber(5, 1500),
    recentRaceDate: optionalDate,
    notes: z.string().max(1500).default(""),
  })
  .transform((v) => ({
    ...v,
    // Day selection gives flexibility; capacity and the shared weekly budget
    // still bound each generated session. Legacy per-day limits remain valid.
    availability: v.availableDays
      ? Array.from({ length: 7 }, (_, i) =>
          v.availableDays.includes(i) ? 600 : 0,
        )
      : v.availability,
    terrain: v.terrains
      ? v.terrains.includes("trail")
        ? "trail"
        : v.terrains.includes("hills")
          ? "hills"
          : "flat"
      : v.terrain,
  }))
  .superRefine((v, c) => {
    if (v.currentRunsPerWeek != null && !Number.isInteger(v.currentRunsPerWeek))
      c.addIssue({
        code: "custom",
        message: "최근 주당 러닝 횟수는 정수로 입력해주세요.",
      });
    if (
      v.allowDoubles &&
      (v.experience !== "experienced" || v.currentRunsPerWeek == null)
    )
      c.addIssue({
        code: "custom",
        message:
          "하루 두 번 달리기는 숙련 러너의 최근 주당 러닝 횟수를 확인한 뒤 허용합니다.",
      });
    if (
      v.qualityExperience &&
      v.qualityDaysPerWeek != null &&
      v.qualityMinutesPerWeek != null &&
      (v.qualityDaysPerWeek === 0) !== (v.qualityMinutesPerWeek === 0)
    )
      c.addIssue({
        code: "custom",
        message:
          "강도 훈련 일수와 본훈련 시간은 둘 다 0이거나 둘 다 0보다 커야 합니다.",
      });
    if (
      v.availability.filter((n) => n > 0).length < 2 ||
      v.availability.filter((n) => n > 0).length > 7
    )
      c.addIssue({
        code: "custom",
        message:
          "주 2~7일을 선택해주세요. 주 7일은 충분한 경험이 있을 때만 사용합니다.",
      });
    if (!v.availability[v.longDay])
      c.addIssue({
        code: "custom",
        message: "롱런 요일에 훈련 가능한 시간을 입력해주세요.",
      });
    if (v.raceDate && v.raceDate <= v.start)
      c.addIssue({
        code: "custom",
        message: "목표 대회는 시작일 이후여야 합니다.",
      });
    if (v.secondaryDate && v.secondaryDate <= v.start)
      c.addIssue({
        code: "custom",
        message: "보조 대회는 시작일 이후여야 합니다.",
      });
    if (v.objective !== "base" && (!v.raceDate || !v.raceDistance))
      c.addIssue({
        code: "custom",
        message: "대회 목표에는 날짜와 거리가 필요합니다.",
      });
    if (v.objective === "performance" && !v.targetMinutes)
      c.addIssue({
        code: "custom",
        message: "기록 목표 시간을 입력하거나 완주/기초 목표를 선택해주세요.",
      });
    if (
      (v.recentRaceDistance || v.recentRaceMinutes || v.recentRaceDate) &&
      !(v.recentRaceDistance && v.recentRaceMinutes && v.recentRaceDate)
    )
      c.addIssue({
        code: "custom",
        message:
          "최근 대회는 거리·시간·날짜를 모두 입력하거나 모두 비워주세요.",
      });
  });
const round = (n) => Math.round(n);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const diff = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const trailElevation = (p) =>
  p.mode === "road"
    ? null
    : p.mode === "hybrid" && p.priority === "road"
      ? p.secondaryElevation
      : p.raceElevation;
const median = (xs) => {
  const a = [...xs].sort((a, b) => a - b);
  return (a[1] + a[2]) / 2;
};
export function baselineFromActivities(activities, today) {
  const end = monday(today);
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = day(-28 + i * 7, end),
      stop = day(7, start),
      runs = activities.filter((a) => a.date >= start && a.date < stop);
    return {
      start,
      minutes: round(sum(runs.map((a) => Number(a.duration) || 0))),
      km: Math.round(sum(runs.map((a) => Number(a.distance) || 0)) * 10) / 10,
      elevation: round(sum(runs.map((a) => Number(a.elevation) || 0))),
      days: new Set(runs.map((a) => a.date)).size,
      runs: runs.length,
    };
  });
  const recent = activities.filter(
    (a) => a.date >= day(-30, today) && a.date < today,
  );
  let consistency = 0;
  for (let i = 1; i <= 104; i++) {
    const start = day(-7 * i, end),
      stop = day(7, start);
    if (!activities.some((a) => a.date >= start && a.date < stop)) break;
    consistency++;
  }
  return {
    weeks,
    baselineMinutes: round(median(weeks.map((w) => w.minutes))),
    baselineKm: Math.round(median(weeks.map((w) => w.km)) * 10) / 10,
    baselineElevation: round(median(weeks.map((w) => w.elevation))),
    longestMinutes: round(
      Math.max(0, ...recent.map((a) => Number(a.duration) || 0)),
    ),
    longestKm:
      Math.round(
        Math.max(0, ...recent.map((a) => Number(a.distance) || 0)) * 100,
      ) / 100,
    currentRunsPerWeek: recent.length
      ? Math.min(14, Math.floor(median(weeks.map((w) => w.runs)))) || null
      : null,
    consistency: activities.length ? consistency : null,
    count: recent.length,
    asOf: today,
    explanation:
      "직전 완료된 4주(기록 없는 주 포함)의 중앙값입니다. 최근 30일 최장 단일 활동은 별도로 봅니다. 누락 기록·다중 워밍업 활동·비러닝 교차훈련은 직접 확인해주세요.",
  };
}
export function evaluateIntake(raw, today) {
  const p = intakeSchema.parse(raw),
    warnings = [],
    blockers = [],
    decisions = [];
  if (p.start < today)
    blockers.push(
      "지난 날짜에는 새 블록을 적용하지 않습니다. 시작일을 오늘 이후로 바꿔주세요.",
    );
  if (diff(p.start, today) > 14)
    blockers.push(
      "현재 훈련량으로 먼 미래를 확정하지 않습니다. 시작일 2주 이내에 다시 상담해주세요.",
    );
  if (["pain", "illness"].includes(p.recovery))
    blockers.push(
      "현재 통증 또는 질병이 있다고 답했습니다. 강도 처방보다 상태 확인이 먼저입니다. 필요한 경우 의료진과 복귀 조건을 정한 뒤 다시 상담해주세요.",
    );
  const foundation =
    p.consistency < 6 ||
    p.experience === "new" ||
    !p.qualityExperience ||
    p.baselineMinutes < 120 ||
    p.recentInjury;
  let method =
    p.method === "auto"
      ? foundation
        ? "foundation"
        : p.mode === "trail" || (p.mode === "hybrid" && p.priority === "trail")
          ? "polarized"
          : "pyramidal"
      : p.method;
  if (foundation && method !== "foundation") {
    warnings.push(
      "최근 훈련 기반·강도 경험·부상 이력을 고려해 요청한 방법 대신 기초 지구력으로 조정했습니다.",
    );
    method = "foundation";
  }
  if (p.recovery === "tired" || p.sleep < 6) {
    method = "foundation";
    warnings.push(
      "회복이 부족한 상태이므로 이번 블록은 증량·고강도 없이 기준량의 75% 이하에서 시작합니다.",
    );
  }
  if (
    method === "subthreshold" &&
    (p.consistency < 12 || p.baselineMinutes < 180)
  ) {
    method = "foundation";
    warnings.push(
      "서브역치는 12주 이상 일관성과 주 180분 이상의 기반이 있을 때 선택합니다. 이번 블록은 기초 우선으로 조정합니다.",
    );
  }
  let trailApproach =
    p.trailApproach === "auto"
      ? foundation || p.descent === "new" || p.terrain === "flat"
        ? "aerobic"
        : p.terrain === "hills"
          ? "uphill"
          : "course"
      : p.trailApproach;
  if (p.mode === "road") trailApproach = "aerobic";
  if (
    p.mode !== "road" &&
    (method === "foundation" || p.descent === "new" || p.terrain === "flat")
  ) {
    if (trailApproach !== "aerobic")
      warnings.push(
        "기반·회복·하강 경험·지형 제약을 고려해 트레일 특이 훈련을 런·하이크 기반으로 조정했습니다.",
      );
    trailApproach = "aerobic";
  }
  if (p.mode !== "road")
    decisions.push({
      title: "트레일 접근",
      text: `${trailApproaches[trailApproach]}: 저강도 시간 예산 안에서 지형별 단계를 배치합니다. 시간 구간은 코스에 맞춰 걷기로 대체할 수 있고, 새 중량·고속 하강은 추가하지 않습니다.`,
    });
  const walkStart =
    p.experience === "new" &&
    !p.baselineMinutes &&
    !p.longestMinutes &&
    p.walkingMinutes >= 15;
  if ((!p.baselineMinutes || !p.longestMinutes) && !walkStart) {
    blockers.push(
      "최근 지속 가능한 주간 시간과 최장 활동 시간이 필요합니다. 달리기 경험이 없다면 무리 없이 걸을 수 있는 시간을 입력해주세요.",
    );
  }
  const capacity = trainingCapacity(p, method);
  const days = p.availability.filter((n) => n > 0).length;
  if (
    days === 7 &&
    !(
      p.experience === "experienced" &&
      p.consistency >= 24 &&
      p.baselineMinutes >= 360
    )
  )
    blockers.push(
      "주 7일은 최근 24주 이상·주 360분 이상을 소화한 숙련 러너에게만 배정합니다. 현재는 최소 하루의 휴식을 남겨주세요.",
    );
  if (days === 7)
    warnings.push(
      "주 7일은 휴식이 필요 없다는 뜻이 아닙니다. 가장 짧은 이지런은 피로에 따라 휴식으로 바꾸세요.",
    );
  if (walkStart)
    warnings.push(
      "러닝 기록이 없어 확인한 걷기 능력에서 주 3회 이내, 걷기·달리기 적응으로 시작합니다. 10K 완주 준비가 끝났다는 의미는 아닙니다.",
    );
  decisions.push({
    title: "현재 기반에 맞춘 배정",
    text: `${capacity.label}. 강도 훈련 최대 ${capacity.qualityDays}회/주, 최근 강도 구간 ${capacity.qualityMinutes}분/주를 출발점으로 사용합니다. 목표 기록만으로 상위 단계로 올리지 않습니다.`,
  });
  if (days < 3)
    warnings.push(
      "주 2일은 습관·유지 블록으로 구성합니다. 마라톤·장거리 트레일의 기록 목표 준비로는 제한적입니다.",
    );
  if (p.weeklyLimit > p.baselineMinutes * 1.3)
    warnings.push(
      "가능한 시간이 늘어도 훈련량을 바로 채우지 않습니다. 현재 기준량에서 시작합니다.",
    );
  if (p.mode !== "road" && p.terrain === "flat")
    warnings.push(
      "언덕·트레일 접근이 없어 지형 특이 훈련을 평지 지구력으로 대체합니다. 기술적 코스 준비는 별도의 현장 노출이 필요합니다.",
    );
  if (
    capacity.mountainUltra &&
    (p.longestMinutes < 180 || p.baselineMinutes < 480 || p.consistency < 24)
  )
    warnings.push(
      "80km 이상 산악 목표에 비해 최근 장시간·누적 훈련 기반이 제한적입니다. 이번 적응 블록을 대회 준비 완료로 해석하지 말고 중간 거리 경험과 코스·보급 준비를 다시 확인해주세요.",
    );
  if (p.allowDoubles)
    decisions.push({
      title: "하루 두 번 달리기",
      text: "최근 주당 횟수로 확인한 경험 안에서, 가능한 하루 총시간을 두 번으로 나눕니다. 새 더블 역치는 배정하지 않으며 피로·테이퍼에는 줄입니다.",
    });
  if (p.mode !== "road" && p.descent === "new")
    warnings.push(
      "새 다운힐 노출은 낮은 강도의 짧은 구간부터 시작하며, 초기에는 시간과 상승 고도를 함께 늘리지 않습니다.",
    );
  const events = [p.raceDate, p.mode === "hybrid" ? p.secondaryDate : ""]
    .filter(Boolean)
    .sort();
  if (events.length === 2 && Math.abs(diff(events[0], events[1])) < 28)
    warnings.push(
      "두 대회가 4주 이내입니다. 둘 다 최고 기록을 노리기보다 우선순위·참가 방식·회복 기간을 재검토하세요. 이번 블록은 첫 대회 전까지만 만듭니다.",
    );
  if (
    p.raceDate &&
    diff(p.raceDate, p.start) < 56 &&
    (p.longestMinutes < 90 || p.baselineMinutes < 180)
  )
    warnings.push(
      "대회까지 짧은 기간에 지구력 기반을 급히 채울 수 없습니다. 완주 방식·거리·일정 조정이 필요한지 코치와 검토하세요.",
    );
  if (p.raceDistance >= 42 && p.baselineMinutes < 180)
    warnings.push(
      "현재 훈련 시간만으로 마라톤·울트라 완주 준비가 충분하다고 판단하지 않습니다. 이 계획은 다음 4주 적응 블록입니다.",
    );
  if (
    p.mode !== "road" &&
    trailElevation(p) > 0 &&
    p.baselineElevation < trailElevation(p) * 0.2
  )
    warnings.push(
      "목표 코스 대비 최근 상승 고도 노출이 작습니다. 대회 고도를 훈련에 그대로 복사하지 않고 점진적으로 적응합니다.",
    );
  const recentValid =
    p.recentRaceDistance &&
    diff(today, p.recentRaceDate) >= 0 &&
    diff(today, p.recentRaceDate) <= 90;
  let performance = null;
  if (p.objective === "performance") {
    if (recentValid && (p.mode === "road" || p.priority === "road")) {
      const reference = round(
        p.recentRaceMinutes *
          Math.pow((p.raceDistance || 42.195) / p.recentRaceDistance, 1.06),
      );
      performance = {
        referenceMinutes: reference,
        note: "최근 로드 기록의 Riegel 지수 1.06 환산 참고값입니다. 특히 마라톤 시간을 낙관적으로 환산할 수 있습니다. 지구력·코스·기상·개인차를 반영하지 않아 예측/훈련 페이스로 사용하지 않습니다.",
      };
      if (p.targetMinutes < reference * 0.97)
        warnings.push(
          "목표 기록이 최근 기록의 단순 거리 환산보다 빠릅니다. 목표는 가설로 두고 실제 훈련·비교 주행으로 재검증합니다.",
        );
    } else
      warnings.push(
        "현재 능력을 뒷받침하는 최근 로드 기록이 없거나 트레일 목표입니다. 목표 기록을 강제 페이스로 변환하지 않고 RPE로 훈련합니다.",
      );
  }
  decisions.push({
    title: "방법론",
    text: `${methodLabels[method]}: ${methodDescriptions[method]}`,
  });
  decisions.push({
    title: "계획 범위",
    text: "다음 4주만 구체화하고, 대회까지의 단계는 방향으로 제시합니다. 주간 증량 상한 3%, 4주차 20% 감소는 이 앱의 보수적 기본값이며 보편적인 안전 공식이 아닙니다.",
  });
  decisions.push({
    title: "현재 능력과 시간",
    text: `확인한 기준 ${walkStart ? Math.min(60, p.walkingMinutes * 3) : p.baselineMinutes}분/주${walkStart ? "(걷기·달리기 시작 상한)" : ""}와 가능 시간 ${p.weeklyLimit}분/주 중 작은 값에서 시작합니다. 시간 중심 세션이므로 달리기 거리를 임의 환산하지 않습니다.`,
  });
  decisions.push({
    title: "강도·롱런",
    text: `최근 강도 경험에 따라 강도 훈련 최대 ${capacity.qualityDays}회와 롱런을 배치합니다. 핵심 날짜 간 최소 48시간을 두고 회복 주·테이퍼에는 줄입니다. 실제 강도 구간의 시간을 따로 계산합니다.`,
  });
  if (p.mode === "hybrid")
    decisions.push({
      title: "병행 우선순위",
      text: `${p.priority === "road" ? "로드" : "트레일"}가 주목표입니다. 핵심 지구력 세션은 주목표 2회:보조 1회 순환으로 배분하며 하나의 시간 예산을 공유합니다. 초기 다운힐 적응을 넣는 주에는 별도 속도훈련을 추가하지 않습니다.`,
    });
  decisions.push({
    title: "레이스·테이퍼",
    text: "첫 목표 대회 전까지만 생성합니다. 대회 14일 전 약 70%, 마지막 7일 약 50%의 기준 시간으로 감량합니다. 마지막 이틀은 쉬운 달리기 최대 20분, 회복 부족 시 휴식으로 둡니다. 이는 개인 반응에 따라 재검토할 앱 기본값입니다. 대회 당일·이후는 결과와 회복 상태를 확인해 별도로 계획합니다.",
  });
  const roadmap = p.raceDate
    ? [
        {
          phase: "기초",
          text: "일관된 빈도·편안한 시간·근력 습관. 회복과 최근 훈련 기반이 우선입니다.",
        },
        {
          phase: "발전 / 특이성",
          text:
            p.mode === "road"
              ? p.raceDistance >= 40 && p.raceDistance <= 45
                ? "충분한 기초 이후 역치·마라톤 노력도 블록, 편안한 롱런과 보급 연습."
                : p.raceDistance <= 15
                  ? "쉬운 달리기를 기반으로 역치 지속 능력과 짧은 레이스 강도 반복을 발전시킵니다."
                  : "편안한 지구력과 역치 지속 능력을 발전시키고 목표 거리의 노력도·보급을 연습합니다."
              : p.mode === "trail"
                ? "시간·상승 고도·파워 하이킹·하강 기술을 단계적으로 경험."
                : "공통 유산소 기반 위에 주목표 특이성을 우선하고 보조 종목을 유지.",
        },
        {
          phase: "테이퍼 / 대회 이후",
          text: "최종 2주 훈련 시간을 줄입니다. 대회 후 통증·보행·피로·수면을 확인하기 전 다음 고강도를 확정하지 않습니다.",
        },
      ]
    : [
        {
          phase: "기초 → 평가 → 다음 블록",
          text: "대회 날짜가 없으므로 지속 가능한 훈련 습관과 현재 기반 개선에 집중합니다.",
        },
      ];
  return {
    profile: p,
    capacity,
    walkStart,
    method,
    warnings,
    blockers,
    decisions,
    performance,
    roadmap,
    trailApproach,
    policyVersion: POLICY_VERSION,
    sources: policySources,
    adjustmentRules,
    events,
  };
}
const rpe = (low, high) => ({
  metric: "rpe",
  low: String(low),
  high: String(high),
  basis: "현재 체감 강도 1~10 · 대화 가능 여부 병행",
  date: "",
});
const step = (id, type, name, min, intensity) => ({
  id,
  type,
  name,
  end: "time",
  min: min * 60,
  max: min * 60,
  intensity,
  notes: "",
});
export function buildCoachedPlan(raw, today) {
  const result = evaluateIntake(raw, today),
    p = result.profile;
  if (result.blockers.length) return { ...result, sessions: [], weeks: [] };
  const sessions = [],
    weeks = [];
  const lowRecovery = p.recovery === "tired" || p.sleep < 6;
  const budget = Math.min(
    result.walkStart ? Math.min(60, p.walkingMinutes * 3) : p.baselineMinutes,
    p.weeklyLimit,
    sum(p.availability),
  );
  const firstEvent = result.events[0];
  const startWeekday = (new Date(p.start).getUTCDay() + 6) % 7;
  let lastKey = day(-((startWeekday - p.longDay + 7) % 7 || 7), p.start);
  for (let w = 0; w < 4; w++) {
    const start = day(7 * w, p.start),
      end = day(7, start);
    if (firstEvent && start >= firstEvent) break;
    const toRace = firstEvent ? diff(firstEvent, start) : 999;
    const taper = toRace <= 14;
    const foundation = result.method === "foundation";
    const growth =
      foundation || lowRecovery || (p.descent === "new" && p.mode !== "road")
        ? 1
        : Math.pow(1.03, w);
    const phaseFactor = taper
      ? toRace <= 7
        ? 0.5
        : 0.7
      : w === 3
        ? 0.8
        : growth;
    // Recovery constraints must never increase a taper/recovery-week allocation.
    const factor = Math.min(phaseFactor, lowRecovery ? 0.75 : Infinity);
    const target = Math.floor(
      Math.min(budget * factor, p.weeklyLimit, sum(p.availability)),
    );
    const dates = Array.from({ length: 7 }, (_, d) => day(d, start)).filter(
      (d) =>
        (!firstEvent || d < firstEvent) &&
        p.availability[(new Date(d).getUTCDay() + 6) % 7] >= 15,
    );
    if (p.experience === "new" && p.longestMinutes <= 30) {
      const spaced = [];
      for (const date of dates)
        if (
          spaced.length < 3 &&
          (!spaced.length || diff(date, spaced.at(-1)) >= 2)
        )
          spaced.push(date);
      dates.splice(0, dates.length, ...spaced);
    }
    if (dates.length > Math.floor(target / 15)) {
      dates.splice(Math.max(0, Math.floor(target / 15)));
    }
    let longDate = dates.find(
      (d) => (new Date(d).getUTCDay() + 6) % 7 === p.longDay,
    );
    let trailWeek =
      p.mode === "trail" ||
      (p.mode === "hybrid"
        ? p.priority === "trail"
          ? w % 3 !== 2
          : w % 3 === 2
        : false);
    trailWeek = trailWeek && p.terrain !== "flat";
    const doubleSlots =
      !taper &&
      !lowRecovery &&
      result.capacity.level === "experienced" &&
      p.allowDoubles
        ? Math.max(
            0,
            Math.min(
              7,
              Math.floor((p.currentRunsPerWeek || dates.length) - dates.length),
            ),
          )
        : 0;
    const doubleDates = dates
      .filter(
        (d) =>
          d !== longDate &&
          p.availability[(new Date(d).getUTCDay() + 6) % 7] > 120,
      )
      .sort(
        (a, b) =>
          p.availability[(new Date(b).getUTCDay() + 6) % 7] -
          p.availability[(new Date(a).getUTCDay() + 6) % 7],
      )
      .slice(0, doubleSlots);
    const capacities = dates.map((d) => {
      const isLong = d === longDate;
      const cap = p.availability[(new Date(d).getUTCDay() + 6) % 7];
      return Math.floor(
        Math.min(
          cap,
          (result.walkStart
            ? Math.min(20, p.walkingMinutes)
            : p.longestMinutes * (doubleDates.includes(d) ? 2 : 1)) *
            (foundation ? 1 : Math.pow(1.03, w)),
          isLong
            ? trailWeek
              ? result.capacity.trailLongCap
              : result.capacity.roadLongCap
            : doubleDates.includes(d)
              ? result.capacity.dailyCap * 2
              : result.capacity.dailyCap,
          Math.max(15, target * (isLong ? 0.45 : 0.3)),
        ),
      );
    });
    // Weighted water filling uses only available slots and never exceeds a cap.
    const amounts = dates.map(() => 0);
    let remaining = target;
    while (remaining > 0) {
      let allocated = false;
      for (let i = 0; i < dates.length && remaining > 0; i++) {
        if (amounts[i] < capacities[i]) {
          amounts[i]++;
          remaining--;
          allocated = true;
        }
      }
      if (!allocated) break;
    }
    // Move easy-day time into the long slot, preserving the total and all bounds.
    const li = dates.indexOf(longDate);
    if (li >= 0)
      for (let i = 0; i < dates.length; i++) {
        if (i === li) continue;
        while (
          amounts[li] < Math.min(capacities[li], target * 0.4) &&
          amounts[i] > target / (dates.length + 1)
        ) {
          amounts[i]--;
          amounts[li]++;
        }
      }
    // Apply final-day reductions after allocation, so removed time is not
    // redistributed into larger sessions earlier in race week.
    for (let i = 0; i < dates.length; i++) {
      if (firstEvent && diff(firstEvent, dates[i]) <= 2)
        amounts[i] = Math.min(amounts[i], lowRecovery ? 0 : 20);
    }
    const useLong = li >= 0 && amounts[li] >= 30;
    if (!useLong) longDate = null;
    const qualityDates = [];
    if (
      !foundation &&
      !lowRecovery &&
      w !== 3 &&
      dates.length >= 3 &&
      !(trailWeek && p.descent === "new")
    ) {
      for (
        let i = 0;
        i < dates.length &&
        qualityDates.length <
          (taper
            ? Math.min(1, result.capacity.qualityDays)
            : result.capacity.qualityDays);
        i++
      ) {
        const d = dates[i];
        if (
          d !== longDate &&
          amounts[i] >= 35 &&
          (!firstEvent || diff(firstEvent, d) > 2) &&
          (!longDate || Math.abs(diff(d, longDate)) >= 2) &&
          (!lastKey || diff(d, lastKey) >= 2) &&
          qualityDates.every((q) => Math.abs(diff(d, q)) >= 2)
        )
          qualityDates.push(d);
      }
    }
    const qualityBudget = Math.floor(
      Math.min(
        sum(amounts.filter((n) => n >= 15)) * result.capacity.qualityFraction,
        result.capacity.qualityMinutes * (taper ? 0.5 : growth),
      ),
    );
    const elevationBudget =
      trailWeek && p.baselineElevation > 0
        ? Math.floor(
            p.baselineElevation *
              (p.descent === "new" ? Math.min(1, factor) : factor) *
              Math.min(1, sum(amounts) / Math.max(1, target)),
          )
        : 0;
    const terrainWeight = dates.reduce(
      (sum, d, i) => sum + amounts[i] * (d === longDate ? 1.5 : 1),
      0,
    );
    let hardMinutes = 0,
      elevation = 0;
    const weekSessions = [];
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      const splitDay = doubleDates.includes(d) && amounts[i] > 120;
      const duration = splitDay ? Math.ceil(amounts[i] / 2) : amounts[i];
      const secondDuration = splitDay ? amounts[i] - duration : 0;
      if (duration < 15) continue;
      const keyAllowed = !lastKey || diff(d, lastKey) >= 2;
      const long =
        d === longDate &&
        keyAllowed &&
        (!firstEvent || diff(firstEvent, d) > 2);
      const quality = qualityDates.includes(d) && keyAllowed;
      let type = long ? (trailWeek ? "trail" : "long") : "easy",
        title = long
          ? trailWeek
            ? "트레일 지구력 · 하이킹 포함"
            : "편안한 롱런"
          : "편안한 이지런";
      let steps = [
          step("run", "work", "대화 가능한 편안한 달리기", duration, rpe(2, 4)),
        ],
        workMinutes = 0;
      if (
        result.walkStart ||
        (p.experience === "new" && p.longestMinutes <= 30)
      ) {
        title = "걷기·달리기 적응";
        type = "easy";
        const count = Math.max(1, Math.floor((duration - 10) / 3));
        steps = [
          step("warm", "warmup", "편안하게 걷기", 5, rpe(2, 3)),
          {
            id: "run-walk",
            type: "repeat",
            name: `${count}회 걷기·달리기`,
            end: "time",
            count,
            children: [
              step(
                "run",
                "work",
                "편안하게 달리기 · 필요하면 걷기",
                1,
                rpe(2, 4),
              ),
              step("walk", "recovery", "걷기", 2, rpe(2, 3)),
            ],
          },
          step(
            "cool",
            "cooldown",
            "편안하게 걷기",
            duration - 5 - count * 3,
            rpe(2, 3),
          ),
        ];
      }
      if (quality) {
        const specific =
          result.method === "pyramidal" &&
          p.raceDistance >= 40 &&
          p.raceDistance <= 45 &&
          p.raceDate &&
          diff(p.raceDate, d) <= 56 &&
          (qualityDates.length > 1
            ? qualityDates.indexOf(d) === 1
            : w % 2 === 1) &&
          p.mode !== "trail" &&
          p.priority !== "trail";
        const recipe = qualityRecipe({
          p,
          capacity: result.capacity,
          method: result.method,
          ordinal: qualityDates.indexOf(d),
          week: w,
          taper,
          specific,
          duration,
          availableWork: Math.floor(
            (qualityBudget - hardMinutes) /
              (qualityDates.length - qualityDates.indexOf(d)),
          ),
        });
        if (recipe) {
          ({ type, title, workMinutes } = recipe);
          steps = [
            step("warm", "warmup", "워밍업", recipe.warm, rpe(2, 3)),
            {
              id: "repeats",
              type: "repeat",
              name: `${recipe.count}회 반복`,
              end: "time",
              count: recipe.count,
              children: [
                step(
                  "work",
                  "work",
                  title,
                  recipe.per,
                  rpe(recipe.low, recipe.high),
                ),
                {
                  ...step(
                    "recovery",
                    "recovery",
                    "편안한 조깅 / 내려오기",
                    recipe.recovery,
                    rpe(2, 3),
                  ),
                  condition: "between",
                },
              ],
            },
            step("cool", "cooldown", "쿨다운", recipe.cool, rpe(2, 3)),
          ];
        }
      }
      if (long && trailWeek) {
        const approach = result.trailApproach;
        const warm = Math.min(10, Math.floor(duration * 0.15));
        const cool = warm;
        const main = duration - warm - cool;
        if (approach === "aerobic") {
          title = "트레일 유산소 · 런/하이크";
          const hike = Math.max(2, Math.floor(main * 0.25));
          steps = [
            step("warm", "warmup", "편안한 시작", warm, rpe(2, 3)),
            step(
              "run",
              "work",
              "대화 강도의 달리기 · 필요하면 걷기",
              main - hike,
              rpe(2, 4),
            ),
            step("hike", "work", "파워 하이킹 / 걷기", hike, rpe(2, 4)),
            step("cool", "cooldown", "편안한 마무리", cool, rpe(2, 3)),
          ];
        } else if (approach === "uphill") {
          title = "트레일 등반 지구력 · 파워 하이킹";
          const climb = Math.max(3, Math.floor(main * 0.4));
          steps = [
            step("warm", "warmup", "편안한 시작", warm, rpe(2, 3)),
            step(
              "climb",
              "work",
              "지속 가능한 오르막 하이킹 · 중량 추가 없음",
              climb,
              rpe(3, 4),
            ),
            step(
              "return",
              "work",
              "완만한 코스의 달리기 / 걷기",
              main - climb,
              rpe(2, 3),
            ),
            step("cool", "cooldown", "편안한 마무리", cool, rpe(2, 3)),
          ];
        } else {
          title = "트레일 코스 적응 · 하강 제어";
          const descent = Math.min(
            taper ? 3 : result.capacity.level === "experienced" ? 30 : 5,
            Math.floor(main * 0.1),
          );
          const climb = Math.floor(main * 0.3);
          steps = [
            step("warm", "warmup", "편안한 시작", warm, rpe(2, 3)),
            step(
              "run",
              "work",
              "트레일 지구력",
              main - climb - descent,
              rpe(2, 4),
            ),
            step(
              "climb",
              "work",
              "오르막 · 대화가 어려우면 하이킹",
              climb,
              rpe(3, 4),
            ),
            {
              ...step(
                "descent",
                "work",
                "익숙한 하강 · 제어와 발 디딤",
                descent,
                rpe(2, 3),
              ),
              notes:
                "적절한 노면이 없거나 피로하면 걷기로 대체합니다. 시간은 노출 상한이며 속도 목표가 아닙니다.",
            },
            step("cool", "cooldown", "편안한 마무리", cool, rpe(2, 3)),
          ];
        }
      }
      if (long || workMinutes) lastKey = d;
      hardMinutes += workMinutes;
      const climbing =
        trailWeek && p.baselineElevation > 0
          ? Math.floor(
              Math.min(
                trailElevation(p) ?? Infinity,
                (elevationBudget * duration * (long ? 1.5 : 1)) /
                  Math.max(1, terrainWeight),
              ),
            )
          : null;
      elevation += climbing || 0;
      const downhill =
        long && trailWeek
          ? p.descent === "new"
            ? "하강 노출은 완만하고 익숙한 구간 5분 이내로 시작. 나머지는 걸어서 내려오고 통증·근육통을 확인합니다."
            : "익숙한 하강 구간에서 제어와 발 디딤을 연습합니다. 속도 경쟁은 하지 않습니다."
          : "";
      const strength =
        p.strength !== "none" &&
        !long &&
        !workMinutes &&
        weekSessions.filter((s) => s.notes.includes("보조 근력")).length < 2 &&
        !taper
          ? "보조 근력 20분(러닝 시간 외): 스쿼트·스텝업·종아리·균형을 익숙한 부하로 수행. 피로가 남으면 생략."
          : "";
      const notes = [
        climbing
          ? "상승 고도는 시간과 최근 노출을 고려한 상한입니다. 목표를 채우기 위해 강도를 올리지 않습니다."
          : "",
        `정책 ${POLICY_VERSION} · ${methodLabels[result.method]}`,
        long
          ? "롱런도 편안하게, 목표 거리를 채우기 위해 시간을 넘기지 않습니다."
          : "",
        downhill,
        p.nightRunning && long && trailWeek && !taper
          ? "야간 구간 준비: 익숙한 안전 코스에서 동행·헤드램프·예비 전원을 점검합니다. 첫 야간 노출은 본훈련 시간 안의 짧은 구간으로 두며 수면 박탈 훈련은 하지 않습니다."
          : "",
        result.capacity.mountainUltra && long && trailWeek
          ? "장거리 산악 준비: 폴·배낭·보급소 간 보급과 걷기 전환을 연습하고, 대회 필수 장비·고도·기상·탈출 지점을 확인합니다. 목표 거리 전체를 훈련에서 재현하지 않습니다."
          : "",
        strength,
        taper
          ? "테이퍼: 익숙한 강도만 짧게, 추가 증량·새로운 다운힐 금지."
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const session = sessionSchema.parse({
        date: d,
        type,
        title,
        duration,
        distance: null,
        elevation: climbing,
        goalId:
          p.mode === "hybrid" && trailWeek !== (p.priority === "trail")
            ? p.secondaryGoalId
            : p.goalId,
        notes,
        workout: {
          purpose: title,
          amountBasis: "time",
          totalKind: "exact",
          priority: long || workMinutes ? "key" : "normal",
          terrain: trailWeek
            ? p.terrain === "trail"
              ? "실제 트레일 / 오르막은 대화 강도 유지가 어려우면 파워 하이킹"
              : "언덕 코스 · 기술적인 트레일 하강 적응은 별도로 필요"
            : p.terrain === "flat"
              ? "평지 또는 트레드밀"
              : "평탄하고 익숙한 코스",
          fueling:
            duration >= 75
              ? p.fueling === "new"
                ? "긴 달리기에서 소량씩 익숙한 탄수화물·수분 섭취를 연습하고 위장 반응을 기록합니다. 섭취량은 개인별로 조정합니다."
                : "이미 적응한 보급·수분 계획을 연습하고 제품·빈도·위장 반응을 기록합니다."
              : "일상 식사와 갈증에 따른 수분 섭취를 유지하세요.",
          equipment:
            long && trailWeek
              ? "미끄럼 방지 신발·날씨에 맞는 장비·비상 연락 수단. 폴은 대회 규정과 숙련도 확인."
              : "익숙한 장비",
          moveRule: adjustmentRules[0],
          adjustmentRule: adjustmentRules[1],
          evaluation:
            "완료 여부와 별도로 RPE·통증·다음 날 회복을 기록. 같은 쉬운 코스에서 노력도 대비 페이스 변화 비교.",
          steps,
        },
      });
      weekSessions.push(session);
      sessions.push(session);
      if (secondDuration >= 15) {
        session.title += " · 첫 번째 달리기";
        const secondClimbing =
          climbing == null
            ? null
            : Math.floor((climbing * secondDuration) / duration);
        const second = sessionSchema.parse({
          ...session,
          title: "편안한 두 번째 달리기",
          type: "easy",
          duration: secondDuration,
          elevation: secondClimbing,
          notes:
            "이미 적응한 하루 두 번 러닝을 주간 시간 안에서 나눴습니다. 최소 6시간 간격을 두고 피로하면 두 번째 달리기는 생략하세요.",
          workout: {
            ...session.workout,
            purpose: "부담을 나눈 저강도 달리기",
            priority: "normal",
            steps: [
              step(
                "easy",
                "work",
                "대화 가능한 아주 편안한 달리기",
                secondDuration,
                rpe(2, 3),
              ),
            ],
          },
        });
        weekSessions.push(second);
        sessions.push(second);
        elevation += secondClimbing || 0;
      }
    }
    weeks.push({
      start,
      end: day(-1, end),
      phase: taper
        ? "테이퍼"
        : w === 3
          ? "회복"
          : result.method === "foundation"
            ? "기초"
            : p.raceDate && toRace <= 56
              ? "특이성"
              : "발전",
      minutes: sum(weekSessions.map((s) => s.duration)),
      qualityMinutes: hardMinutes,
      elevation,
      ancillaryMinutes:
        weekSessions.filter((s) => s.notes.includes("보조 근력")).length * 20,
      sessions: weekSessions.length,
    });
  }
  if (!sessions.length)
    result.blockers.push(
      firstEvent && diff(firstEvent, p.start) <= 2 && lowRecovery
        ? "대회까지 이틀 이내이고 회복이 부족해 달리기를 배정하지 않았습니다. 우선 휴식하고 회복 상태와 대회 참가 여부를 확인해주세요."
        : "가능한 시간·대회 일정 안에 15분 이상의 훈련을 배치할 수 없습니다. 일정을 조정해주세요.",
    );
  if (weeks[0]?.minutes < p.baselineMinutes * 0.7)
    result.warnings.push(
      "요일별 시간·롱런 상한 또는 테이퍼 때문에 실제 배정 시간이 기준보다 줄었습니다. 부족한 시간을 다른 날에 몰아 채우지 않습니다.",
    );
  result.warnings.push(
    "단일 활동의 거리 급증도 확인하세요. 시간 기반 계획이므로 실제 달린 거리가 최근 30일 최장 거리보다 크게 늘지 않는지 따로 점검합니다. 10%를 안전 보장선으로 취급하지 않습니다.",
  );
  return { ...result, sessions, weeks, nextCheck: day(7, p.start) };
}
