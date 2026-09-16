import WorkoutFlow from "./WorkoutFlow.jsx";
import { formatDuration, formatMinutes } from "../shared/time.mjs";
import React from "react";
import { workoutTypes, stepTypes } from "../shared/workout.mjs";
const amount = (v, u) =>
  v == null
    ? "미정"
    : `${Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${u}`;
function intensity(v) {
  return !v || v.metric === "none"
    ? ""
    : `${v.low}${v.high && v.high !== v.low ? "–" + v.high : ""} ${{ pace: "분:초/km", hr: "bpm", rpe: "RPE", power: "W" }[v.metric]}${v.basis ? " · " + v.basis : ""}${v.date ? " · " + v.date : ""}`;
}
function Steps({ steps = [] }) {
  return (
    <ol className="workout-summary-steps">
      {steps.map((s) => (
        <li key={s.id}>
          <strong>{s.name || stepTypes[s.type]}</strong>
          {s.type === "repeat"
            ? ` · ${s.count}회 반복`
            : s.type === "sequence"
              ? " · 순서대로"
              : s.end === "manual"
                ? " · 수동 종료"
                : ` · ${s.end === "time" ? formatDuration(s.min, { unknown: "미정" }) : amount(s.min, "m")}${s.max !== s.min ? "–" + (s.end === "time" ? formatDuration(s.max, { unknown: "미정" }) : amount(s.max, "m")) : ""}`}
          {s.condition === "between" && " · 마지막 반복에서 생략"}
          {intensity(s.intensity) && <p>{intensity(s.intensity)}</p>}
          {s.notes && <p>{s.notes}</p>}
          {s.children?.length > 0 && <Steps steps={s.children} />}
        </li>
      ))}
    </ol>
  );
}
export default function WorkoutSummary({ session: s, onEdit }) {
  const w = s.workout || {};
  return (
    <section className="completed-plan">
      <div className="analysis-toolbar">
        <div>
          <small>훈련 내용</small>
          <h2>{s.title}</h2>
        </div>
        {onEdit && (
          <button className="button" onClick={onEdit}>
            훈련 수정
          </button>
        )}
      </div>
      <p>
        {[s.date, w.timeSlot, workoutTypes[s.type] || s.type]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="plan-summary">
        <span>
          예정 거리 <strong>{amount(s.distance, " km")}</strong>
        </span>
        <span>
          예정 시간{" "}
          <strong>{formatMinutes(s.duration, { unknown: "미정" })}</strong>
        </span>
        <span>
          상승 고도 <strong>{amount(s.elevation, " m")}</strong>
        </span>
      </div>
      <p>
        {w.totalKind === "estimate"
          ? "추정 대표값"
          : w.totalKind === "exact"
            ? "정확한 총량"
            : "입력된 예정량 기준"}
      </p>
      {w.purpose && (
        <p>
          <b>목적</b> {w.purpose}
        </p>
      )}
      {intensity(w.intensity) && (
        <p>
          <b>공통 강도</b> {intensity(w.intensity)}
        </p>
      )}
      <WorkoutFlow steps={w.steps} intensity={w.intensity} />
      <details className="workout-explanation">
        <summary>단계별 강도 근거와 수행 메모</summary>
        <Steps steps={w.steps} />
      </details>
      {Object.entries({
        terrain: "장소·지형",
        fueling: "보급",
        equipment: "장비",
        evaluation: "평가 기준",
        moveRule: "일정 조건",
        adjustmentRule: "조정 원칙",
      }).map(
        ([k, l]) =>
          w[k] && (
            <div className="workout-detail-row" key={k}>
              <strong>{l}</strong>
              <p>{w[k]}</p>
            </div>
          ),
      )}
      {s.type === "race" && w.race && (
        <>
          <h3>레이스 전략</h3>
          <p>
            {{ race: "레이스", tt: "TT", benchmark: "비교 훈련" }[w.race.kind]}{" "}
            ·{" "}
            {
              {
                goal: "주목표",
                checkpoint: "중간 점검",
                training: "훈련 일부",
              }[w.race.role]
            }
          </p>
          {Object.entries({
            strategy: "수행 전략",
            criteria: "판단 기준",
            before: "사전 조정",
            after: "이후 회복",
            resultUse: "결과 활용",
          }).map(
            ([k, l]) =>
              w.race[k] && (
                <p key={k}>
                  <b>{l}</b> {w.race[k]}
                </p>
              ),
          )}
        </>
      )}
      {s.notes && <p className="workout-summary-notes">{s.notes}</p>}
    </section>
  );
}
