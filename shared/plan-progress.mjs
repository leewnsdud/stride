// A rest day is part of the schedule, but never requires an activity link.
export function planProgress(sessions, activities, today) {
  const linked = new Set(activities.map((a) => a.id));
  const runs = sessions.filter((s) => s.type !== "rest");
  return {
    planned: runs.length,
    rest: sessions.length - runs.length,
    completed: runs.filter((s) => linked.has(s.activityId)).length,
    upcoming: runs.filter((s) => !linked.has(s.activityId) && s.date >= today)
      .length,
  };
}
export function planSessionStatus(session, activities, today) {
  if (session.type === "rest") return "휴식";
  if (activities.some((a) => a.id === session.activityId)) return "완료";
  return session.date < today ? "기록 미연결" : "예정";
}
