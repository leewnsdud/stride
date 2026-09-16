import { z } from "zod";
import { dateSchema } from "./domain.mjs";
import { reviewContext } from "./activity-review.mjs";
import { periodEvidence } from "./coaching-analysis.mjs";
export const scenarioSchema = z.enum(["auto", "road", "race", "trail"]);
export const scopeSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("recent") }),
    z.object({
      kind: z.literal("activity"),
      activityId: z.string().min(1).max(200),
      scenario: scenarioSchema.default("auto"),
    }),
    z.object({ kind: z.literal("period"), start: dateSchema, end: dateSchema }),
  ])
  .superRefine((v, c) => {
    if (
      v.kind === "period" &&
      (v.start > v.end ||
        Date.parse(v.end) - Date.parse(v.start) > 91 * 86400000)
    )
      c.addIssue({
        code: "custom",
        message:
          "시작일과 종료일을 확인하세요. 한 번에 최대 92일을 검토할 수 있습니다.",
      });
  });
const shift = (date, days) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function coachContext({
  activities,
  sessions,
  goals,
  scope,
  today,
  demo,
}) {
  if (scope.kind === "none")
    return { today, demo, scope: { kind: "none", label: "기록 없이 질문" } };
  const one = (a, scenario = "auto") => {
    const session = sessions.find((s) => s.activityId === a.id);
    const goal = goals.find((g) => g.id === session?.goalId);
    return reviewContext(a, a.detail, session, goal, demo, scenario);
  };
  if (scope.kind === "activity") {
    const a = activities.find((a) => a.id === scope.activityId);
    if (!a) fail(404, "선택한 활동을 찾을 수 없습니다.");
    return {
      ...one(a, scope.scenario),
      today,
      scope: { ...scope, label: `${a.date} · ${a.name}` },
    };
  }
  const start = scope.kind === "recent" ? shift(today, -41) : scope.start;
  const end = scope.kind === "recent" ? today : scope.end;
  const selected = activities
    .filter((a) => a.date >= start && a.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (selected.length > 200)
    fail(400, "200개를 넘는 활동이 있습니다. 기간을 줄여서 요청해주세요.");
  const countDays =
    Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  const previousEnd = shift(start, -1),
    previousStart = shift(start, -countDays);
  return {
    today,
    demo,
    scope: { ...scope, start, end, label: `${start} ~ ${end}` },
    summary: periodEvidence(activities, sessions, start, end, today),
    previousPeriod: periodEvidence(
      activities,
      sessions,
      previousStart,
      previousEnd,
      today,
    ),
    activities: selected.map((a) => {
      const c = one(a);
      // Every selected activity is represented; samples stay local for period reviews.
      return {
        ...c.activity,
        scenario: c.scenario,
        stats: c.stats,
        analysis: c.analysis,
        plannedSession: c.plannedSession,
        goal: c.goal,
        hrZones: c.hrZones,
        powerZones: c.powerZones,
        laps: c.laps.slice(0, 20),
        dataCoverage: {
          ...c.dataCoverage,
          lapsIncluded: Math.min(c.laps.length, 20),
          lapsTruncated: c.dataCoverage.lapCount > 20,
        },
      };
    }),
    sessions: sessions
      .filter((s) => s.date >= start && s.date <= end)
      .map((s) => ({
        ...reviewContext({}, null, s, null).plannedSession,
        linkedActivityDate:
          activities.find((a) => a.id === s.activityId)?.date || null,
      })),
    goals: goals.map((g) => reviewContext({}, null, null, g).goal),
    units: one({}).units,
    detailPolicy:
      "Period review uses cached detail, full local calculations and up to 20 laps per activity. No sampled stream. Missing Garmin detail can be loaded by opening the activity or selecting a single activity review.",
  };
}
