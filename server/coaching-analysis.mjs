import { kilometerSplits, analyzePoints } from "./metrics.mjs";
import { intensityNumber } from "../shared/workout.mjs";

const valid = (n) => typeof n === "number" && Number.isFinite(n);
const positive = (n) => valid(n) && n > 0;
const round = (n) => (valid(n) ? Math.round(n * 100) / 100 : null);
const sum = (xs, key) =>
  xs.reduce((s, x) => s + (valid(x[key]) ? x[key] : 0), 0);
export function scenarioFor(activity, session, requested = "auto") {
  return {
    race:
      requested === "race" ||
      (requested === "auto" &&
        (session?.type === "race" || !!session?.workout?.race)),
    trail: requested === "trail" || activity.type === "trail",
    purpose: session?.workout?.purpose || null,
    basis:
      requested === "auto"
        ? "linked-plan-and-activity-type"
        : "runner-selected",
  };
}

// Full-resolution local calculations. Never derive precise totals from AI excerpts.
export function activityEvidence(activity, detail, session) {
  const points = detail?.points || [];
  const durationSeconds = positive(activity.duration)
    ? activity.duration * 60
    : null;
  const comparison = session
    ? Object.fromEntries(
        ["distance", "duration", "elevation"].map((key) => [
          key,
          {
            planned: valid(session[key]) ? session[key] : null,
            actual: valid(activity[key]) ? activity[key] : null,
            delta:
              valid(activity[key]) && valid(session[key])
                ? round(activity[key] - session[key])
                : null,
            percentOfPlan:
              positive(session[key]) && valid(activity[key])
                ? round((activity[key] / session[key]) * 100)
                : null,
          },
        ]),
      )
    : null;
  const splits = kilometerSplits(points).filter(
    (s) => s.distance === 1000 && positive(s.duration),
  );
  let pacing = null;
  if (splits.length >= 4) {
    const half = Math.floor(splits.length / 2);
    const early = sum(splits.slice(0, half), "duration") / half;
    const late = sum(splits.slice(-half), "duration") / half;
    pacing = {
      estimated: true,
      completeKm: splits.length,
      comparedKmEach: half,
      omittedMiddleKm: splits.length % 2,
      earlyPaceSecondsPerKm: round(early),
      latePaceSecondsPerKm: round(late),
      laterSlowerPercent: round((late / early - 1) * 100),
      limitation:
        "Timer-interpolated complete km only; not official halves or a fatigue diagnosis. Check terrain and workout structure.",
    };
  }
  const target = session?.workout?.intensity;
  const varied = !!session?.workout?.steps?.length;
  let intensity = null;
  if (target && !varied && ["pace", "hr", "power"].includes(target.metric)) {
    const low = intensityNumber(target.low, target.metric),
      high = intensityNumber(target.high || target.low, target.metric);
    if (positive(low) && positive(high) && low <= high) {
      let covered = 0,
        inside = 0;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i];
        const elapsed = b.time - a.time;
        const dt = valid(a.timer) && valid(b.timer) ? b.timer - a.timer : null;
        const value = positive(a[target.metric])
          ? a[target.metric] * (target.metric === "pace" ? 60 : 1)
          : null;
        if (
          !positive(dt) ||
          dt > 30 ||
          elapsed <= 0 ||
          elapsed > 30 ||
          dt > elapsed + 1 ||
          !positive(value)
        )
          continue;
        covered += dt;
        if (value >= low && value <= high) inside += dt;
      }
      const coveragePercent = durationSeconds
        ? round((covered / durationSeconds) * 100)
        : null;
      intensity = {
        metric: target.metric,
        low,
        high,
        coveredSeconds: round(covered),
        inRangeSeconds: round(inside),
        coveragePercent,
        percentOfCovered: covered > 0 ? round((inside / covered) * 100) : null,
        suitableForOverallAssessment:
          coveragePercent >= 80 && coveragePercent <= 105,
        method:
          "Left-sample timer weighting; gaps >30s excluded. 80–105% is an app data-quality gate, not a physiological standard.",
      };
    }
  }
  const recordedHrZones = (detail?.hrZones || []).filter(
    (z) => valid(z.seconds) && z.seconds >= 0,
  );
  const hrZoneSeconds = recordedHrZones.length
    ? sum(recordedHrZones, "seconds")
    : null;
  return {
    averagePaceSecondsPerKm:
      positive(activity.distance) && durationSeconds
        ? round(durationSeconds / activity.distance)
        : null,
    ascentMetersPerKm:
      positive(activity.distance) && valid(activity.elevation)
        ? round(activity.elevation / activity.distance)
        : null,
    sessionRpeLoadAu:
      valid(activity.rpe) &&
      activity.rpe >= 0 &&
      activity.rpe <= 10 &&
      positive(activity.duration)
        ? round(activity.rpe * activity.duration)
        : null,
    planComparison: comparison,
    plannedTotalKind: session?.workout?.totalKind || "unknown",
    stepMapping: varied
      ? "Not aligned: watch laps are not necessarily workout steps."
      : null,
    intensity,
    pacing,
    terrain: {
      ...analyzePoints(points),
      estimated: true,
      gradeBoundaryPercent: 3,
    },
    coverage: {
      points: points.length,
      laps: detail?.laps?.length || 0,
      hrZoneSeconds,
      hrZonePercentOfTimer:
        durationSeconds && hrZoneSeconds != null
          ? round((hrZoneSeconds / durationSeconds) * 100)
          : null,
      detailsAvailable: !!detail,
      rpeAvailable: valid(activity.rpe),
    },
  };
}

export function periodEvidence(activities, sessions, start, end, today) {
  const items = activities.filter((a) => a.date >= start && a.date <= end);
  const planned = sessions.filter(
    (s) => s.date >= start && s.date <= end && s.type !== "rest",
  );
  const linkedIds = new Set(sessions.map((s) => s.activityId).filter(Boolean));
  const allIds = new Set(activities.map((a) => a.id));
  const rpeItems = items.filter(
    (a) => valid(a.rpe) && a.rpe >= 0 && a.rpe <= 10 && positive(a.duration),
  );
  const metrics = Object.fromEntries(
    ["distance", "duration", "elevation"].map((key) => [
      key,
      {
        total: round(sum(items, key)),
        recordedActivities: items.filter((a) => valid(a[key])).length,
      },
    ]),
  );
  return {
    start,
    end,
    includesFutureDates: end > today,
    activities: items.length,
    runDays: new Set(items.map((a) => a.date)).size,
    ...metrics,
    roadKm: round(
      sum(
        items.filter((a) => a.type === "road"),
        "distance",
      ),
    ),
    trailKm: round(
      sum(
        items.filter((a) => a.type === "trail"),
        "distance",
      ),
    ),
    rpeLoadAu: rpeItems.length
      ? round(rpeItems.reduce((s, a) => s + a.duration * a.rpe, 0))
      : null,
    rpeRecordedActivities: rpeItems.length,
    detailedActivities: items.filter((a) => !!a.detail).length,
    plannedSessions: planned.length,
    linkedSessions: planned.filter((s) => allIds.has(s.activityId)).length,
    pastSessionsWithoutLinkedActivity: planned.filter(
      (s) => s.date < today && !allIds.has(s.activityId),
    ).length,
    upcomingSessions: planned.filter(
      (s) => s.date >= today && !allIds.has(s.activityId),
    ).length,
    unlinkedActivities: items.filter((a) => !linkedIds.has(a.id)).length,
  };
}
