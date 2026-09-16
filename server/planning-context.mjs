import { day } from "./domain.mjs";

// The dated macrocycle is a roadmap. Only a freshly reviewed four-week block
// creates sessions; later load depends on actual activity and recovery.
export function planningContext(store, dataset, plan) {
  const p = plan.profile;
  const event = plan.events[0];
  const days = event
    ? Math.ceil((Date.parse(event) - Date.parse(p.start)) / 86400000)
    : 28;
  const totalWeeks = Math.ceil(days / 7);
  const cycle = Array.from({ length: Math.min(totalWeeks, 104) }, (_, i) => {
    const start = day(i * 7, p.start);
    const remaining = days - i * 7;
    const phase = plan.weeks[i]?.phase || (
      event && remaining <= 14
        ? "테이퍼"
        : event && remaining <= 56
          ? "대회 특이성"
          : "기초·발전");
    return {
      start,
      end: event && day(6, start) >= event ? day(-1, event) : day(6, start),
      phase,
      status: i < 4 ? "이번 검토 블록" : "실제 수행 후 재검토",
      checkpoint: i % 4 === 3,
    };
  });
  const previous = store
    .list(dataset, "plan-draft")
    .filter(
      (d) =>
        d.applied &&
        d.profile.start < p.start &&
        d.profile.raceDate === p.raceDate &&
        d.profile.mode === p.mode &&
        d.profile.raceDistance === p.raceDistance,
    )
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))[0];
  let continuity = null;
  if (previous) {
    const records = store.list(dataset, "activity");
    const sessions = store
      .sessions(dataset)
      .filter((s) => previous.sessionIds?.includes(s.id));
    const linked = sessions.filter((s) =>
      records.some((a) => a.id === s.activityId),
    );
    continuity = {
      previousId: previous.id,
      start: previous.profile.start,
      end: previous.weeks.at(-1)?.end,
      method: previous.method,
      planned: sessions.length,
      linked: linked.length,
      actualMinutes: linked.reduce(
        (n, s) =>
          n +
          (Number(records.find((a) => a.id === s.activityId)?.duration) || 0),
        0,
      ),
      note: "기록 미연결은 미수행으로 단정하지 않습니다. 다음 블록의 훈련량은 최근 실제 활동과 이번에 확인한 회복 상태로 다시 계산합니다.",
    };
  }
  return { ...plan, cycle, totalWeeks, continuity };
}
