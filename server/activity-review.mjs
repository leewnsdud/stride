import { activityEvidence, scenarioFor } from "./coaching-analysis.mjs";
import { workoutSchema } from "./workout.mjs";
// Explicit allowlist: no raw activity payload, coordinates, account or credential data.
export function reviewContext(
  activity,
  detail,
  session,
  goal,
  demo = false,
  scenario = "auto",
) {
  const stats = { ...activity.stats, ...detail?.stats };
  const statKeys = [
    "timerSeconds",
    "movingSeconds",
    "elapsedSeconds",
    "maxHr",
    "cadence",
    "power",
    "maxPower",
    "normPower",
    "maxCadence",
    "calories",
    "descent",
    "aerobicEffect",
    "anaerobicEffect",
    "trainingLoad",
    "strideLength",
    "groundContactTime",
    "verticalOscillation",
    "verticalRatio",
    "groundContactBalance",
    "temperature",
  ];
  const pick = (value, keys) =>
    Object.fromEntries(keys.map((k) => [k, value?.[k] ?? null]));
  const points = (detail?.points || []).filter(
    (_, i) =>
      i % Math.max(1, Math.ceil((detail?.points?.length || 0) / 120)) === 0,
  );
  return {
    demo,
    units: {
      activity: "distance km, duration minutes, elevation m, hr bpm, rpe 0–10",
      laps: "distance m, duration seconds, pace min/km",
      samples: "time/timer seconds, distance m, pace min/km, altitude m",
      workout: "step distance m, time s; pace target M:SS/km",
    },
    scenario: scenarioFor(activity, session, scenario),
    analysis: activityEvidence(activity, detail, session),
    activity: pick(activity, [
      "source",
      "name",
      "date",
      "type",
      "distance",
      "duration",
      "elevation",
      "hr",
      "rpe",
      "notes",
    ]),
    stats: pick(stats, statKeys),
    laps: (detail?.laps || [])
      .slice(0, 100)
      .map((l) =>
        pick(l, [
          "index",
          "label",
          "distance",
          "duration",
          "pace",
          "hr",
          "cadence",
          "power",
          "ascent",
          "descent",
        ]),
      ),
    hrZones: (detail?.hrZones || []).map((z) =>
      pick(z, ["zone", "seconds", "low"]),
    ),
    powerZones: (detail?.powerZones || []).map((z) =>
      pick(z, ["zone", "seconds", "low"]),
    ),
    samples: points.map((p) =>
      pick(p, [
        "time",
        "timer",
        "distance",
        "pace",
        "hr",
        "altitude",
        "gap",
        "strideLength",
        "groundContactTime",
        "verticalOscillation",
        "verticalRatio",
        "temperature",
        "cadence",
        "power",
      ]),
    ),
    plannedSession: session
      ? {
          ...pick(session, [
            "title",
            "date",
            "type",
            "distance",
            "duration",
            "elevation",
            "notes",
          ]),
          workout: workoutSchema.safeParse(session.workout).success
            ? workoutSchema.parse(session.workout)
            : null,
        }
      : null,
    goal: goal
      ? pick(goal, [
          "name",
          "date",
          "type",
          "distance",
          "elevation",
          "targetMinutes",
        ])
      : null,
    dataCoverage: {
      hasDetailedSamples: points.length > 0,
      excerptCount: points.length,
      lapCount: detail?.laps?.length || 0,
      lapsTruncated: (detail?.laps?.length || 0) > 100,
      sampleCount: detail?.points?.length || 0,
      unavailableSections: Object.keys(detail?.errors || {}),
    },
  };
}
export const REVIEW_PROMPT = `선택한 달리기를 코칭 스킬에 따라 한국어 Markdown으로 리뷰해 주세요. 연결된 훈련의 목적과 실제 수행을 비교하고, 가장 중요한 근거와 다음 행동을 알려주세요. 데이터가 부족해 판단할 수 없는 부분은 구분하고 필요한 질문을 덧붙여 주세요.`;
