import React from "react";
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const scenarioOptions = [
  ["auto", "활동·연결된 훈련에 맞춰"],
  ["road", "일반 러닝"],
  ["race", "레이스 / 타임 트라이얼"],
  ["trail", "트레일러닝"],
];
export function ScenarioSelect({ value, onChange, disabled }) {
  return (
    <label>
      리뷰 관점
      <select
        className="review-perspective"
        aria-label="리뷰 관점"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {scenarioOptions.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
export default function CoachScope({ value, onChange, activities, disabled }) {
  const today = iso(new Date());
  const selectedActivity = activities.find((a) => a.id === value.activityId);
  const label =
    value.kind === "none"
      ? "선택 사항"
      : value.kind === "recent"
        ? "최근 6주"
        : value.kind === "activity"
          ? selectedActivity
            ? `${selectedActivity.date} · ${selectedActivity.name}`
            : "활동 선택"
          : `${value.start} ~ ${value.end}`;
  const preset = (kind) => {
    const d = new Date();
    if (kind === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    else d.setDate(1);
    onChange({ kind: "period", start: iso(d), end: today });
  };
  return (
    <details className="coach-scope">
      <summary>
        {value.kind === "none" ? "기록 첨부" : "첨부한 기록"}{" "}
        <span>{label}</span>
      </summary>
      <fieldset disabled={disabled}>
        <label>
          코칭 대상
          <select
            aria-label="코칭 대상"
            value={value.kind}
            onChange={(e) =>
              onChange(
                e.target.value === "activity"
                  ? {
                      kind: "activity",
                      activityId: activities[0]?.id || "",
                      scenario: "auto",
                    }
                  : e.target.value === "period"
                    ? { kind: "period", start: today, end: today }
                    : { kind: e.target.value },
              )
            }
          >
            <option value="none">기록 없이 질문</option>
            <option value="recent">최근 6주 돌아보기</option>
            <option value="activity">특정 달리기</option>
            <option value="period">기간 선택</option>
          </select>
        </label>
        {value.kind === "activity" && (
          <>
            <label>
              달리기 기록
              <select
                aria-label="달리기 기록"
                value={value.activityId}
                onChange={(e) =>
                  onChange({ ...value, activityId: e.target.value })
                }
              >
                {!selectedActivity && (
                  <option value={value.activityId || ""} disabled>
                    {activities.length
                      ? "기록을 다시 선택하세요"
                      : "저장된 활동이 없습니다"}
                  </option>
                )}
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.date} · {a.name} ·{" "}
                    {Number(a.distance).toLocaleString("ko-KR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    km
                  </option>
                ))}
              </select>
            </label>
            <ScenarioSelect
              value={value.scenario || "auto"}
              onChange={(scenario) => onChange({ ...value, scenario })}
            />
          </>
        )}
        {value.kind === "period" && (
          <>
            <div className="coach-period-fields">
              <label>
                시작일
                <input
                  type="date"
                  aria-label="코칭 시작일"
                  value={value.start}
                  max={value.end}
                  onChange={(e) =>
                    onChange({ ...value, start: e.target.value })
                  }
                />
              </label>
              <label>
                종료일
                <input
                  type="date"
                  aria-label="코칭 종료일"
                  value={value.end}
                  min={value.start}
                  onChange={(e) => onChange({ ...value, end: e.target.value })}
                />
              </label>
            </div>
            <div className="row">
              <button
                type="button"
                className="button small"
                onClick={() => preset("week")}
              >
                이번 주
              </button>
              <button
                type="button"
                className="button small"
                onClick={() => preset("month")}
              >
                이번 달
              </button>
            </div>
            <p className="helper">최대 92일 · 선택한 날짜를 모두 포함합니다.</p>
          </>
        )}
      </fieldset>
    </details>
  );
}
