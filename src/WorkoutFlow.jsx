import React from "react";
import { formatDuration } from "../shared/time.mjs";
import { stepTypes, stepTotals } from "../shared/workout.mjs";
export function stepAmount(s) {
  if (s.type === "repeat") return `${s.count}회 반복`;
  if (s.type === "sequence") return "순서대로";
  if (s.end === "manual") return "수동 종료";
  const show = (v) =>
    v == null ? "미정" : s.end === "time" ? formatDuration(v) : `${v}m`;
  return show(s.min) + (s.max !== s.min ? `–${show(s.max)}` : "");
}
export default function WorkoutFlow({ steps = [], intensity }) {
  if (!steps.length) return null;
  const totals = stepTotals(steps);
  function nodes(items, depth = 0) {
    return (
      <ol className="workout-flow-list">
        {items.map((s) => (
          <li key={s.id} className={`flow-${s.type}`}>
            <div>
              <span>{stepTypes[s.type]}</span>
              <strong>{s.name}</strong>
              <b>{stepAmount(s)}</b>
              {s.condition === "between" && (
                <small>반복 사이만 · 마지막 생략</small>
              )}
              {(() => {
                const v =
                  s.intensity?.metric && s.intensity.metric !== "none"
                    ? s.intensity
                    : intensity;
                return (
                  v &&
                  v.metric !== "none" && (
                    <small>
                      {v.low}
                      {v.high && v.high !== v.low ? `–${v.high}` : ""}{" "}
                      {
                        { rpe: "RPE", pace: "분:초/km", hr: "bpm", power: "W" }[
                          v.metric
                        ]
                      }
                    </small>
                  )
                );
              })()}
            </div>
            {s.children?.length > 0 && nodes(s.children, depth + 1)}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <section className="workout-flow" aria-label="훈련 순서 미리보기">
      <div className="flow-heading">
        <h4>한눈에 보는 훈련 순서</h4>
        <small>블록 크기는 수행 시간·거리에 비례하지 않습니다.</small>
      </div>
      {nodes(steps)}
      <p className="helper">
        {totals.duration.complete
          ? "시간 단계 전체 합계"
          : "시간으로 지정한 구간만"}{" "}
        {formatDuration(totals.duration.min * 60)}
        {totals.duration.max !== totals.duration.min
          ? `–${formatDuration(totals.duration.max * 60)}`
          : ""}{" "}
        ·{" "}
        {totals.distance.complete
          ? "거리 단계 전체 합계"
          : "거리로 지정한 구간만"}{" "}
        {Number(totals.distance.min.toFixed(3))}
        {totals.distance.max !== totals.distance.min
          ? `–${Number(totals.distance.max.toFixed(3))}`
          : ""}
        km. 수동 종료·다른 단위 구간은 환산하지 않습니다.
      </p>
    </section>
  );
}
