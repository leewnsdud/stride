import { Plus } from "./icons.jsx";
import React, { useState } from "react";
import { formatMinutes } from "../shared/time.mjs";
import { workoutTypes } from "../shared/workout.mjs";
import { planProgress, planSessionStatus } from "../shared/plan-progress.mjs";

const weekOf = (value) => {
  const d = new Date(`${value}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export default function TrainingPlans({
  sessions,
  activities,
  goals,
  today,
  onCreate,
  onOpen,
  onEditGoal,
}) {
  const [scope, setScope] = useState("all");
  const ordered = [...sessions]
    .filter((s) => scope === "all" || s.goalId === scope)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
    );
  const linked = new Set(activities.map((a) => a.id));
  const progress = planProgress(ordered, activities, today);
  const weeks = Object.groupBy(ordered, (s) => weekOf(s.date));
  const goal = goals.find((g) => g.id === scope);
  return (
    <div className="training-plan-space">
      <div className="section-heading">
        <h2>나의 훈련 계획</h2>
        <button className="button primary" onClick={() => onCreate()}>
          <Plus size={18} />
          훈련 계획 만들기
        </button>
      </div>
      <section className="card training-plan-overview">
        <div className="row between">
          <h2>훈련 진행 상황</h2>
          <span>
            {progress.planned}개 훈련
            {progress.rest > 0 ? ` · 휴식 ${progress.rest}일` : ""}
          </span>
        </div>
        <p>
          {ordered.length
            ? `${ordered[0].date} — ${ordered.at(-1).date}`
            : "상담을 통해 목표와 일정을 함께 정해보세요."}
        </p>
        <div className="training-plan-stats">
          <div>
            <span>계획된 주</span>
            <strong>
              {Object.keys(weeks).length}
              <small>주</small>
            </strong>
          </div>
          <div>
            <span>완료한 훈련</span>
            <strong>
              {progress.completed}
              <small>/ {progress.planned}회</small>
            </strong>
          </div>
          <div>
            <span>예정된 훈련</span>
            <strong>
              {progress.upcoming}
              <small>회</small>
            </strong>
          </div>
        </div>
        <progress
          aria-label="전체 훈련 완료율"
          value={progress.completed}
          max={Math.max(progress.planned, 1)}
        />
        <p className="muted">
          활동이 연결된 훈련만 완료로 집계하며, 휴식일은 완료율에서 제외합니다.
          기록이 연결되지 않은 지난 훈련도 아래에서 확인할 수 있어요.
        </p>
      </section>
      {goals.length > 0 && (
        <section className="card">
          <label className="field">
            <span>계획의 목표</span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">전체 훈련</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          {goal && (
            <>
              <h3>{goal.name}</h3>
              <p>
                {goal.date} · {goal.distance} km
                {goal.targetMinutes
                  ? ` · ${formatMinutes(goal.targetMinutes)}`
                  : ""}
              </p>
              <div className="row training-plan-actions">
                <button className="button" onClick={() => onEditGoal(goal)}>
                  목표 조건 수정
                </button>
                <button className="button" onClick={() => onCreate(goal)}>
                  이 목표로 계획 세우기
                </button>
              </div>
            </>
          )}
        </section>
      )}
      {!ordered.length ? (
        <section className="card training-plan-empty">
          <h2>현재 훈련량부터 확인해보세요</h2>
          <p>
            로드, 트레일, 두 종목 병행 중에서 선택하고 최근 기록과 가능한
            일정으로 다음 4주를 계획합니다.
          </p>
          <p className="muted">
            단발성 대회는 러닝 캘린더에서 ‘레이스’ 훈련으로 추가할 수 있어요.
          </p>
        </section>
      ) : (
        Object.entries(weeks).map(([week, items]) => (
          <section className="card training-plan-week" key={week}>
            <div className="row between">
              <h3>{week} 시작 주</h3>
              <span>
                {planProgress(items, activities, today).completed} /{" "}
                {planProgress(items, activities, today).planned} 완료
              </span>
            </div>
            <div className="training-plan-sessions">
              {items.map((s) => (
                <button
                  key={s.id}
                  className={`training-plan-session ${linked.has(s.activityId) ? "is-complete" : ""}`}
                  onClick={() => onOpen(s)}
                >
                  <span className="training-plan-date">{s.date}</span>
                  <span>
                    <strong>{s.title}</strong>
                    <small>
                      {s.type === "rest" ? (
                        "달리기 없이 회복하는 날"
                      ) : (
                        <>
                          {workoutTypes[s.type] || s.type} ·{" "}
                          {s.distance == null
                            ? "거리 미정"
                            : `${s.distance} km`}{" "}
                          ·{" "}
                          {s.duration == null
                            ? "시간 미정"
                            : formatMinutes(s.duration)}
                        </>
                      )}
                    </small>
                  </span>
                  <span className="training-plan-status">
                    {planSessionStatus(s, activities, today)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
