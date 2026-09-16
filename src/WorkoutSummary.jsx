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
function DetailRow({ label, children }) {
  return (
    <div className="workout-detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
export default function WorkoutSummary({ session: s, onEdit }) {
  const w = s.workout || {};
  return (
    <section className="completed-plan">
      <div className="workout-summary-header">
        <div>
          <small>훈련 내용</small>
          <h2>{s.title}</h2>
          <p className="workout-summary-date">
            {[s.date, w.timeSlot].filter(Boolean).join(" · ")}
          </p>
        </div>
        {onEdit && (
          <button className="button" onClick={onEdit}>
            훈련 수정
          </button>
        )}
      </div>
      <div className="plan-summary">
        <span>
          훈련 종류 <strong>{workoutTypes[s.type] || s.type}</strong>
        </span>
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
      <p className="workout-amount-note">
        {w.totalKind === "estimate"
          ? "추정 대표값"
          : w.totalKind === "exact"
            ? "정확한 총량"
            : "입력된 예정량 기준"}
      </p>
      <dl className="workout-detail-list">
        {w.purpose && <DetailRow label="목적">{w.purpose}</DetailRow>}
        {intensity(w.intensity) && (
          <DetailRow label="공통 강도">{intensity(w.intensity)}</DetailRow>
        )}
      </dl>
      <WorkoutFlow steps={w.steps} intensity={w.intensity} />
      {!!w.steps?.length && (
        <details className="workout-explanation">
          <summary>단계별 강도 근거와 수행 메모</summary>
          <Steps steps={w.steps} />
        </details>
      )}
      <dl className="workout-detail-list">
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
              <DetailRow key={k} label={l}>
                {w[k]}
              </DetailRow>
            ),
        )}
      </dl>
      {s.type === "race" && w.race && (
        <section className="workout-race-section">
          <h3>레이스 전략</h3>
          <dl className="workout-detail-list">
            <DetailRow label="대회 역할">
              {
                { race: "레이스", tt: "TT", benchmark: "비교 훈련" }[
                  w.race.kind
                ]
              }{" "}
              ·{" "}
              {
                {
                  goal: "주목표",
                  checkpoint: "중간 점검",
                  training: "훈련 일부",
                }[w.race.role]
              }
            </DetailRow>
            {Object.entries({
              strategy: "수행 전략",
              criteria: "판단 기준",
              before: "사전 조정",
              after: "이후 회복",
              resultUse: "결과 활용",
            }).map(
              ([k, l]) =>
                w.race[k] && (
                  <DetailRow key={k} label={l}>
                    {w.race[k]}
                  </DetailRow>
                ),
            )}
          </dl>
        </section>
      )}
      {s.notes && (
        <dl className="workout-detail-list">
          <DetailRow label="메모">{s.notes}</DetailRow>
        </dl>
      )}
    </section>
  );
}
