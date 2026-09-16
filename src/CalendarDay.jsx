import ActivityMetrics from "./ActivityMetrics.jsx";
import { formatMinutes } from "../shared/time.mjs";
import { CalendarBlank, CheckCircle } from "./icons.jsx";
import React from "react";
import { calendarDay } from "./calendar-data.mjs";
const amount = (n) =>
  n == null
    ? "미정"
    : Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
export default function CalendarDay({
  day,
  sessions,
  activities,
  sessionCard,
  openActivity,
}) {
  const entries = calendarDay(day, sessions, activities);
  const completed = (s, a) => (
    <button
      className="calendar-completed"
      key={s.id}
      onClick={() => openActivity(a)}
    >
      <small>
        <CheckCircle size={14} /> 완료한 훈련
      </small>
      <strong>{s.title}</strong>
      <span>
        계획 {amount(s.distance)} km ·{" "}
        {formatMinutes(s.duration, { unknown: "미정" })}
      </span>
      <span>
        실제 {amount(a.distance)} km ·{" "}
        {formatMinutes(a.duration, { unknown: "미정" })}
      </span>
      {s.date !== a.date && (
        <small>
          훈련 {s.date} · 활동 {a.date}
        </small>
      )}
    </button>
  );
  return (
    <>
      {!entries.plans.length && !entries.activities.length && (
        <p className="day-empty">등록된 기록 없음</p>
      )}
      {entries.plans.map(({ session: s, activity: a }) =>
        a ? (
          completed(s, a)
        ) : (
          <div className="calendar-pair" key={s.id}>
            <small className="calendar-plan-label">
              <CalendarBlank size={14} /> 훈련 계획
            </small>
            {sessionCard(s)}
          </div>
        ),
      )}
      {entries.activities.map(({ activity: a, session: s }) =>
        s ? (
          completed(s, a)
        ) : (
          <button
            className="calendar-activity"
            key={a.id}
            onClick={() => openActivity(a)}
          >
            <span className="calendar-identity">
              <strong>{a.name}</strong>
              <small>
                <span>
                  {a.startTimeLocal?.match(/[T ](\d{2}:\d{2})/)?.[1] || a.date}
                </span>
                <span aria-hidden="true">·</span>
                {a.source === "garmin"
                  ? "Garmin"
                  : a.source === "demo"
                    ? "데모"
                    : "직접 기록"}
              </small>
            </span>
            <ActivityMetrics activity={a} />
          </button>
        ),
      )}
    </>
  );
}
