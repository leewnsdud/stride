import { workoutSchema } from "./workout.mjs";
import { workoutTypes, stepTotals } from "../shared/workout.mjs";
import { z } from "zod";
import { optionalNumber } from "../shared/record-values.mjs";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "올바른 날짜를 입력하세요.",
  );
export const goalSchema = z.object({
  name: z.string().trim().min(1).max(100),
  date: dateSchema,
  type: z.enum(["road", "trail"]),
  distance: z.coerce.number().positive().max(500),
  elevation: z.coerce.number().min(0).max(50000),
  targetMinutes: z.coerce
    .number()
    .positive()
    .max(10000)
    .nullable()
    .default(null),
});
export const sessionSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    date: dateSchema,
    type: z.enum(Object.keys(workoutTypes)),
    distance: z
      .preprocess(
        (v) => (v === "" ? null : v),
        z.coerce.number().min(0).max(300).nullable(),
      )
      .default(null),
    duration: z
      .preprocess(
        (v) => (v === "" ? null : v),
        z.coerce.number().min(0).max(3000).nullable(),
      )
      .default(null),
    elevation: z
      .preprocess(
        (v) => (v === "" ? null : v),
        z.coerce.number().min(0).max(30000).nullable(),
      )
      .default(null),
    notes: z.string().max(3000).default(""),
    goalId: z.string().nullable().default(null),
    workout: workoutSchema.optional(),
  })
  .superRefine((s, c) => {
    if (!s.workout) return;
    if (
      s.type !== "rest" &&
      !s.workout.steps.length &&
      !(s.distance > 0 || s.duration > 0)
    )
      c.addIssue({
        code: "custom",
        message: "거리 또는 시간, 또는 상세 단계를 입력하세요.",
      });
    if (s.workout.totalKind === "exact" && s.workout.steps.length) {
      const totals = stepTotals(s.workout.steps);
      for (const key of ["distance", "duration"]) {
        const t = totals[key];
        if (
          t.complete &&
          s[key] != null &&
          (s[key] < t.min - 0.001 || s[key] > t.max + 0.001)
        )
          c.addIssue({
            code: "custom",
            message: "정확한 총량이 단계 합계 범위와 다릅니다.",
          });
      }
    }
  });
export const activitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  date: dateSchema,
  type: z.enum(["road", "trail"]),
  distance: z.coerce.number().positive().max(500),
  duration: z.coerce.number().positive().max(10000),
  elevation: z.preprocess(
    optionalNumber,
    z.number().min(0).max(50000).nullable(),
  ),
  hr: z.preprocess(optionalNumber, z.number().min(20).max(250).nullable()),
  rpe: z.preprocess(optionalNumber, z.number().min(1).max(10).nullable()),
  notes: z.string().max(3000).default(""),
});
export function day(offset = 0, base = new Date()) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function monday(date = today()) {
  const d = new Date(date);
  return day(-((d.getUTCDay() + 6) % 7), d);
}
export function generatePlan({
  start,
  weeklyKm,
  days,
  weeks,
  type,
  goalId = null,
}) {
  const parsed = z
    .object({
      start: dateSchema,
      weeklyKm: z.coerce.number().min(5).max(200),
      days: z.coerce.number().int().min(3).max(6),
      weeks: z.coerce.number().int().min(1).max(24),
      type: z.enum(["road", "trail"]),
    })
    .parse({ start, weeklyKm, days, weeks, type });
  const slots = {
    3: [1, 3, 6],
    4: [1, 3, 5, 6],
    5: [0, 1, 3, 5, 6],
    6: [0, 1, 2, 3, 5, 6],
  }[parsed.days];
  return Array.from({ length: parsed.weeks }, (_, w) => {
    const km =
      parsed.weeklyKm *
      Math.pow(1.04, Math.floor(w / 4) * 3 + (w % 4)) *
      (w % 4 === 3 ? 0.8 : 1);
    const weights = slots.map((_, i) =>
      i === slots.length - 1 ? 0.35 : 0.65 / (slots.length - 1),
    );
    return slots.map((slot, i) => {
      const long = i === slots.length - 1;
      const quality = i === 1 && !long;
      const kind = long
        ? type === "trail"
          ? "trail"
          : "long"
        : quality
          ? "tempo"
          : "easy";
      const distance = Math.round(km * weights[i] * 10) / 10;
      return {
        title: {
          trail: "트레일 롱런",
          long: "이지 롱런",
          tempo: "템포 러닝",
          easy: "이지 러닝",
        }[kind],
        date: day(w * 7 + slot, new Date(monday(start))),
        type: kind,
        distance,
        duration: Math.round(distance * (kind === "trail" ? 9 : 6.2)),
        elevation: kind === "trail" ? Math.round(distance * 45) : 0,
        notes: quality
          ? "충분히 워밍업한 뒤 편안하게 유지 가능한 강도로 진행하세요."
          : "대화 가능한 강도로 진행하고 컨디션에 따라 조정하세요.",
        goalId,
      };
    });
  })
    .flat()
    .filter((s) => s.date >= start);
}
export function summarize(sessions, activities, week = monday()) {
  const end = day(7, new Date(week));
  const inWeek = (x) => x.date >= week && x.date < end;
  const a = activities.filter(inWeek),
    s = sessions.filter(inWeek);
  const sum = (xs, k) => xs.reduce((n, x) => n + (Number(x[k]) || 0), 0);
  return {
    distance: sum(a, "distance"),
    duration: sum(a, "duration"),
    elevation: sum(a, "elevation"),
    plannedDistance: sum(s, "distance"),
    plannedCount: s.filter((x) => x.type !== "rest").length,
    completedCount: s.filter((x) => x.activityId).length,
    count: a.length,
    pace: sum(a, "distance") ? sum(a, "duration") / sum(a, "distance") : null,
  };
}
export function normalizeActivity(a) {
  if (
    !a.id ||
    !a.start_date_local ||
    !Number.isFinite(a.distance) ||
    a.distance <= 0 ||
    !Number.isFinite(a.moving_time) ||
    a.moving_time <= 0
  )
    return null;
  return {
    id: `icu-${a.id}`,
    externalId: String(a.id),
    source: "intervals",
    name: a.name || "Garmin 러닝",
    date: a.start_date_local.slice(0, 10),
    type: /trail/i.test(a.type || "") ? "trail" : "road",
    distance: a.distance / 1000,
    duration: a.moving_time / 60,
    elevation: a.total_elevation_gain || 0,
    hr: a.average_heartrate || null,
    rpe: a.icu_rpe || null,
    load: a.icu_training_load ?? null,
    notes: "",
    raw: a,
  };
}
