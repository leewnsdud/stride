// These are adjustable application guardrails, not performance qualification standards.
export function trainingCapacity(p, method) {
  const ready = p.recovery === "ready" && p.sleep >= 6 && !p.recentInjury;
  const established =
    p.experience === "experienced" &&
    p.consistency >= 24 &&
    p.baselineMinutes >= 360 &&
    ready;
  const highVolume = established && p.baselineMinutes >= 600;
  const trailDistance =
    p.mode === "hybrid" && p.priority === "road"
      ? p.secondaryDistance
      : p.raceDistance;
  const mountainUltra = p.mode !== "road" && trailDistance >= 80;
  const qualityDays =
    method === "foundation"
      ? 0
      : established &&
          !mountainUltra &&
          method !== "subthreshold" &&
          p.baselineMinutes >= 420 &&
          p.availability.filter((n) => n >= 35).length >= 5
        ? Math.min(2, p.qualityDaysPerWeek ?? 1)
        : Math.min(1, p.qualityDaysPerWeek ?? 1);
  return {
    level: established
      ? "experienced"
      : method === "foundation"
        ? "foundation"
        : "developing",
    label: established
      ? "축적된 훈련 기반 활용"
      : method === "foundation"
        ? "입문·기초 적응"
        : "지구력·강도 발전",
    roadLongCap: established ? 180 : 150,
    trailLongCap: established ? (mountainUltra ? 360 : 240) : 180,
    dailyCap: highVolume ? 150 : established ? 120 : 90,
    qualityDays,
    qualityFraction: established ? 0.2 : 0.15,
    qualityMinutes: p.qualityMinutesPerWeek ?? (established ? 30 : 15),
    mountainUltra,
    trailDistance,
  };
}

export function qualityRecipe({
  p,
  capacity,
  method,
  ordinal,
  week,
  taper,
  specific,
  duration,
  availableWork,
}) {
  const shortRoad =
    p.mode !== "trail" && p.priority !== "trail" && p.raceDistance <= 15;
  const isHill =
    p.mode !== "road" &&
    p.terrain !== "flat" &&
    (method === "polarized" || capacity.mountainUltra) &&
    (ordinal === 0 || capacity.mountainUltra);
  const type = isHill
    ? "hill"
    : shortRoad &&
        (ordinal === 1 || (capacity.qualityDays === 1 && week % 2 === 1))
      ? "interval"
      : method === "polarized"
        ? "interval"
        : specific
          ? "marathon"
          : "tempo";
  const advanced = capacity.level === "experienced";
  const sub = method === "subthreshold";
  const per =
    type === "marathon"
      ? advanced
        ? 15
        : 5
      : type === "interval"
        ? advanced
          ? 4
          : 2
        : type === "hill"
          ? advanced
            ? 4
            : 2
          : sub
            ? advanced
              ? 8
              : 4
            : advanced
              ? 8
              : 5;
  const recovery = type === "marathon" ? 3 : 2;
  const warm = advanced ? 15 : 10;
  const maxCount = taper ? 2 : type === "marathon" ? 3 : advanced ? 5 : 3;
  const count = Math.min(
    maxCount,
    Math.floor(availableWork / per),
    Math.floor((duration - warm - 5 + recovery) / (per + recovery)),
  );
  if (count < 2) return null;
  return {
    type,
    per,
    count,
    recovery,
    warm,
    cool: duration - warm - per * count - recovery * (count - 1),
    workMinutes: per * count,
    title: sub
      ? "통제된 서브역치 · 단일 세션"
      : {
          hill: "오르막 지속 반복",
          interval: shortRoad ? "5–10K 강도 반복" : "유산소 파워 인터벌",
          marathon: "마라톤 노력도 블록",
          tempo: "역치 크루즈 반복",
        }[type],
    low: sub || type === "marathon" ? 5 : type === "tempo" ? 6 : 7,
    high: sub || type === "marathon" ? 6 : type === "tempo" ? 7 : 8,
  };
}
