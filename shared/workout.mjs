export const workoutTypes = {
  easy: "이지 러닝",
  recovery: "회복 러닝",
  tempo: "템포 / 역치",
  interval: "인터벌",
  repetition: "레피티션",
  marathon: "마라톤 페이스",
  long: "롱런",
  hill: "언덕 반복",
  trail: "트레일",
  race: "레이스",
  rest: "휴식",
};
export const stepTypes = {
  warmup: "워밍업",
  work: "본훈련",
  recovery: "회복",
  cooldown: "쿨다운",
  repeat: "반복 묶음",
  sequence: "연속 묶음",
};
export const guidance = {
  easy: "거리 또는 시간과 편안한 강도를 정하세요. 필요하면 마지막에 스트라이드를 추가할 수 있습니다.",
  recovery: "회복 목적과 편안한 강도를 기록하세요.",
  tempo: "지속 템포 또는 회복을 포함한 크루즈 인터벌로 구성하세요.",
  interval: "작업 구간과 회복 구간을 반복 묶음 안에 넣으세요.",
  repetition: "짧은 작업과 충분한 회복을 구분해 기록하세요.",
  marathon:
    "워밍업 이후 목표 마라톤 강도 구간을 기록하세요. 현재 능력과 목표 가정을 구분하세요.",
  long: "전체 시간·거리와 후반 강도 변화, 보급 연습을 기록하세요.",
  hill: "오르막 작업과 내려오며 회복하는 구간을 구분하세요.",
  trail:
    "거리보다 시간·노력도를 중심으로 지형, 상승 고도, 보급과 장비를 기록하세요.",
  race: "대회나 TT의 역할, 목표와 수행 전략, 사전 조정·이후 회복을 기록하세요.",
  rest: "휴식 목적과 일정 제약만 작성해도 됩니다.",
};
export const blankStep = (type = "work") => ({
  id: crypto.randomUUID(),
  type,
  name: stepTypes[type],
  end: "time",
  min: null,
  max: null,
  condition: "always",
  notes: "",
  intensity: { metric: "none", low: "", high: "", basis: "", date: "" },
  ...(type === "repeat" || type === "sequence"
    ? { count: type === "repeat" ? 2 : 1, children: [] }
    : {}),
});
export function templateSteps(type) {
  if (["easy", "recovery", "long", "trail", "rest", "race"].includes(type))
    return [];
  const work = blankStep(),
    warm = blankStep("warmup"),
    cool = blankStep("cooldown");
  if (["interval", "repetition", "hill"].includes(type)) {
    const repeat = blankStep("repeat"),
      recovery = blankStep("recovery");
    recovery.condition = "between";
    repeat.children = [work, recovery];
    return [warm, repeat, cool];
  }
  return [warm, work, cool];
}
// Editing one end of an explicit range must not overwrite the other end.
export function withStepMinimum(step, minimum, rangeEnabled = false) {
  const ranged = rangeEnabled || step.min !== step.max;
  return { ...step, min: minimum, max: ranged ? step.max : minimum };
}
export function withRepeatCount(step, count) {
  const generatedName =
    step.name === `${step.count}회 반복` ||
    (step.count == null && /^\d+회 반복$/.test(step.name));
  return {
    ...step,
    count,
    name: generatedName && count != null ? `${count}회 반복` : step.name,
  };
}
export function intensityNumber(value, metric) {
  if (value === "" || value == null) return null;
  if (metric === "pace") {
    if (!/^\d{1,2}:[0-5]\d$/.test(value)) return NaN;
    const [m, s] = value.split(":").map(Number);
    return m * 60 + s;
  }
  return Number(value);
}
export function stepTotals(steps) {
  const result = {
    distance: { min: 0, max: 0, complete: true },
    duration: { min: 0, max: 0, complete: true },
  };
  function visit(nodes, multiplier = 1, parentCount = 1) {
    for (const s of nodes) {
      const times =
        multiplier *
        (s.condition === "between" ? (parentCount - 1) / parentCount : 1);
      if (s.type === "repeat" || s.type === "sequence") {
        const count = s.type === "repeat" ? Number(s.count) : 1;
        visit(s.children || [], times * count, count);
        continue;
      }
      for (const [key, end, unit] of [
        ["distance", "distance", 1000],
        ["duration", "time", 60],
      ]) {
        if (s.end !== end || s.min == null || s.max == null)
          result[key].complete = false;
        if (s.end === end) {
          result[key].min += (times * (Number(s.min) || 0)) / unit;
          result[key].max += (times * (Number(s.max) || 0)) / unit;
        }
      }
    }
  }
  visit(steps);
  if (!steps.length) for (const t of Object.values(result)) t.complete = false;
  return result;
}
