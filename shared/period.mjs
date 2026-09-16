const iso = (d) => d.toISOString().slice(0, 10);
const shift = (day, n) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
export function periodBounds(anchor, unit = "week") {
  const d = new Date(anchor + "T00:00:00Z");
  const start =
    unit === "month"
      ? anchor.slice(0, 7) + "-01"
      : shift(anchor, -((d.getUTCDay() + 6) % 7));
  const end =
    unit === "month"
      ? iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))
      : shift(start, 7);
  return { start, end, last: shift(end, -1) };
}
export function movePeriod(anchor, unit, amount) {
  const { start } = periodBounds(anchor, unit);
  if (unit === "week") return shift(start, amount * 7);
  const d = new Date(start + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + amount);
  return iso(d);
}
export function summarizePeriod(activities, sessions, anchor, unit) {
  const { start, end, last } = periodBounds(anchor, unit);
  const inside = (x) => x.date >= start && x.date < end;
  const runs = activities.filter(inside),
    plans = sessions.filter(inside).filter((s) => s.type !== "rest");
  const sum = (rows, key) =>
    rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
  const distance = sum(runs, "distance"),
    target = sum(plans, "distance");
  const days = [];
  for (let d = start; d < end; d = shift(d, 1))
    days.push({
      date: d,
      label: `${Number(d.slice(5, 7))}.${Number(d.slice(8))}`,
      distance: sum(
        runs.filter((r) => r.date === d),
        "distance",
      ),
    });
  return {
    start,
    end,
    last,
    runs,
    plans,
    distance,
    target,
    elevation: sum(runs, "elevation"),
    completed: plans.filter((p) => p.activityId).length,
    percent: target ? Math.round((distance / target) * 100) : 0,
    unknownDistance: plans.some((p) => p.distance == null),
    days,
  };
}

// UI ranges include both selected dates; period aggregation uses an exclusive end.
export const recentDays = (today, count = 3) => ({
  start: shift(today, 1 - count),
  end: today,
});
export const inDateRange = (day, range) =>
  !range || (day >= range.start && day <= range.end);
export function trendPeriods(activities, sessions, today, range = 8) {
  const unit = range === "month" ? "month" : "week";
  const count = unit === "month" ? 3 : range;
  const sum = (rows, key) =>
    rows.reduce((n, row) => n + (Number(row[key]) || 0), 0);
  return Array.from({ length: count }, (_, index) => {
    const anchor = movePeriod(today, unit, index - count + 1);
    const p = summarizePeriod(activities, sessions, anchor, unit);
    return {
      start: p.start,
      end: p.end,
      label:
        unit === "month"
          ? `${p.start.slice(0, 4)}.${Number(p.start.slice(5, 7))}`
          : `${Number(p.start.slice(5, 7))}.${Number(p.start.slice(8))}`,
      distance: p.distance,
      planned: p.target,
      elevation: p.elevation,
      count: p.runs.length,
      pace: p.distance
        ? +(sum(p.runs, "duration") / p.distance).toFixed(2)
        : null,
      road: sum(
        p.runs.filter((a) => a.type === "road"),
        "distance",
      ),
      trail: sum(
        p.runs.filter((a) => a.type === "trail"),
        "distance",
      ),
    };
  });
}

// One selected calendar month, keeping every day (including zero-activity days).
export function monthDays(activities, sessions, anchor) {
  const p = summarizePeriod(activities, sessions, anchor, "month");
  const sum = (rows, key) =>
    rows.reduce((n, a) => n + (Number(a[key]) || 0), 0);
  return p.days.map((day) => {
    const runs = p.runs.filter((a) => a.date === day.date);
    const plans = p.plans.filter((a) => a.date === day.date);
    return {
      label: `${Number(day.date.slice(8))}일`,
      start: day.date,
      distance: day.distance,
      planned: sum(plans, "distance"),
      count: runs.length,
      elevation: sum(runs, "elevation"),
      road: sum(
        runs.filter((a) => a.type === "road"),
        "distance",
      ),
      trail: sum(
        runs.filter((a) => a.type === "trail"),
        "distance",
      ),
    };
  });
}
