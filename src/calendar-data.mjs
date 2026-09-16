export function calendarDay(day, sessions, activities) {
  const daySessions = sessions.filter((s) => s.date === day);
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const paired = new Set(
    daySessions
      .filter((s) => activityById.get(s.activityId)?.date === day)
      .map((s) => s.activityId),
  );
  return {
    plans: daySessions.map((session) => ({
      session,
      activity: activityById.get(session.activityId) || null,
    })),
    activities: activities
      .filter((a) => a.date === day && !paired.has(a.id))
      .map((activity) => ({
        activity,
        session: sessions.find((s) => s.activityId === activity.id) || null,
      })),
  };
}
