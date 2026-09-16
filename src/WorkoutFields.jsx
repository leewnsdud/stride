import DurationFields from "./DurationFields.jsx";
import WorkoutFlow, { stepAmount } from "./WorkoutFlow.jsx";
import { ArrowUp, ArrowDown } from "./icons.jsx";
import { formatMinutes } from "../shared/time.mjs";
import React, { useState } from "react";
import {
  blankStep,
  stepTypes,
  stepTotals,
  guidance,
  templateSteps,
  withStepMinimum,
  withRepeatCount,
} from "../shared/workout.mjs";
const Field = ({ label, children }) => (
  <label className="workout-field">
    <span>{label}</span>
    {children}
  </label>
);
const num = (v) => (v === "" ? null : Number(v));
export function IntensityFields({ value = {}, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="intensity-fields">
      <Field label="강도 기준">
        <select
          value={value.metric || "none"}
          onChange={(e) =>
            onChange({
              metric: e.target.value,
              low: "",
              high: "",
              basis: value.basis || "",
              date: value.date || "",
            })
          }
        >
          {Object.entries({
            none: "강도 미정",
            pace: "페이스 (분:초/km)",
            hr: "심박 (bpm)",
            rpe: "RPE (1–10)",
            power: "파워 (W)",
          }).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      {value.metric && value.metric !== "none" && (
        <>
          <Field label="목표 하한 / 빠른 페이스">
            <input
              required
              value={value.low || ""}
              placeholder={value.metric === "pace" ? "5:00" : "목표값"}
              onChange={(e) => set("low", e.target.value)}
            />
          </Field>
          <Field label="상한 / 느린 페이스 (선택)">
            <input
              value={value.high || ""}
              placeholder="단일 목표면 비움"
              onChange={(e) => set("high", e.target.value)}
            />
          </Field>
          <Field label="강도 근거">
            <input
              value={value.basis || ""}
              placeholder="최근 기록 / 코치 처방 / 목표 가정"
              onChange={(e) => set("basis", e.target.value)}
            />
          </Field>
          <Field label="기준일">
            <input
              type="date"
              value={value.date || ""}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
        </>
      )}
    </div>
  );
}
function Steps({ value, onChange, parent = null, depth = 0 }) {
  const [ranges, setRanges] = useState({});
  const update = (i, v) => onChange(value.map((s, j) => (i === j ? v : s)));
  const move = (i, d) => {
    const copy = [...value];
    [copy[i], copy[i + d]] = [copy[i + d], copy[i]];
    onChange(copy);
  };
  return (
    <div className="workout-steps">
      {value.map((s, i) => {
        const group = ["repeat", "sequence"].includes(s.type);
        return (
          <details
            className="workout-step"
            key={s.id}
            onInvalid={(e) => {
              let node = e.target.closest("details");
              while (node) {
                node.open = true;
                node = node.parentElement.closest("details");
              }
            }}
          >
            <summary className="workout-step-summary">
              <span>
                {i + 1}. {s.name || stepTypes[s.type]}
              </span>
              <strong>{stepAmount(s)}</strong>
              <small>편집</small>
            </summary>
            <div className="workout-step-head">
              <strong>
                {i + 1}. {stepTypes[s.type]}
              </strong>
              <div>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`${s.name} 위로`}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  disabled={i === value.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`${s.name} 아래로`}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, j) => i !== j))}
                >
                  단계 삭제
                </button>
              </div>
            </div>
            <div className="form-grid">
              <Field label="단계 이름">
                <input
                  required
                  maxLength={100}
                  value={s.name}
                  onChange={(e) => update(i, { ...s, name: e.target.value })}
                />
              </Field>
              {parent === "repeat" && (
                <Field label="실행 조건">
                  <select
                    value={s.condition}
                    onChange={(e) =>
                      update(i, { ...s, condition: e.target.value })
                    }
                  >
                    <option value="always">매 반복 실행</option>
                    <option value="between">반복 사이만 (마지막 생략)</option>
                  </select>
                </Field>
              )}
              {s.type === "repeat" && (
                <Field label="반복 횟수">
                  <input
                    required
                    type="number"
                    min="1"
                    max="100"
                    value={s.count}
                    onChange={(e) =>
                      update(i, withRepeatCount(s, num(e.target.value)))
                    }
                  />
                </Field>
              )}
              {!group && (
                <>
                  <Field label="구간 종료 기준">
                    <select
                      value={s.end}
                      onChange={(e) =>
                        update(i, {
                          ...s,
                          end: e.target.value,
                          min: null,
                          max: null,
                        })
                      }
                    >
                      <option value="distance">거리 (m)</option>
                      <option value="time">시간 (시·분·초)</option>
                      <option value="manual">수동 종료</option>
                    </select>
                  </Field>
                  {s.end !== "manual" && (
                    <>
                      {s.end === "time" ? (
                        <div className="workout-field">
                          <span>
                            {ranges[s.id] || s.min !== s.max
                              ? "최소 시간"
                              : "구간 시간"}
                          </span>
                          <DurationFields
                            label={`${s.name} 구간 시간`}
                            value={s.min}
                            required
                            onChange={(n) =>
                              update(i, withStepMinimum(s, n, ranges[s.id]))
                            }
                          />
                        </div>
                      ) : (
                        <Field label="구간 거리 (m)">
                          <input
                            required
                            type="number"
                            min="1"
                            max="100000"
                            value={s.min ?? ""}
                            onChange={(e) =>
                              update(
                                i,
                                withStepMinimum(
                                  s,
                                  num(e.target.value),
                                  ranges[s.id],
                                ),
                              )
                            }
                          />
                        </Field>
                      )}
                      <button
                        type="button"
                        className="button range-toggle"
                        onClick={() => {
                          const active = ranges[s.id] || s.min !== s.max;
                          setRanges({ ...ranges, [s.id]: !active });
                          if (active) update(i, { ...s, max: s.min });
                        }}
                      >
                        {ranges[s.id] || s.min !== s.max
                          ? "고정 수행량으로"
                          : "범위로 입력"}
                      </button>
                      {(ranges[s.id] || s.min !== s.max) &&
                        (s.end === "time" ? (
                          <div className="workout-field">
                            <span>최대 시간</span>
                            <DurationFields
                              label={`${s.name} 최대 시간`}
                              value={s.max}
                              required
                              maxHours={27}
                              onChange={(n) => update(i, { ...s, max: n })}
                            />
                          </div>
                        ) : (
                          <Field label="최대 거리 (m)">
                            <input
                              required
                              type="number"
                              min="1"
                              max="100000"
                              value={s.max ?? ""}
                              onChange={(e) =>
                                update(i, { ...s, max: num(e.target.value) })
                              }
                            />
                          </Field>
                        ))}
                    </>
                  )}
                </>
              )}
            </div>
            {!group && (
              <IntensityFields
                value={s.intensity}
                onChange={(v) => update(i, { ...s, intensity: v })}
              />
            )}
            <Field
              label={
                s.end === "manual" && !group
                  ? "수동 종료 조건 (필수)"
                  : "단계 메모 · 지형 · 보급"
              }
            >
              <input
                required={s.end === "manual" && !group}
                value={s.notes || ""}
                onChange={(e) => update(i, { ...s, notes: e.target.value })}
              />
            </Field>
            {group && (
              <Steps
                value={s.children || []}
                onChange={(v) => update(i, { ...s, children: v })}
                parent={s.type}
                depth={depth + 1}
              />
            )}
          </details>
        );
      })}
      <div className="step-add">
        {Object.entries(stepTypes)
          .filter(([k]) => depth < 3 || !["repeat", "sequence"].includes(k))
          .map(([k, l]) => (
            <button
              className="button"
              type="button"
              key={k}
              onClick={() => onChange([...value, blankStep(k)])}
            >
              + {l}
            </button>
          ))}
      </div>
    </div>
  );
}
export default function WorkoutFields({ session, onChange }) {
  const w = session.workout || {},
    steps = w.steps || [];
  const set = (k, v) => {
    const next = { ...session, workout: { ...w, [k]: v } };
    if (k === "steps" && w.totalKind === "exact") {
      const before = stepTotals(steps),
        after = stepTotals(v);
      for (const key of ["distance", "duration"]) {
        if (before[key].complete || session[key] == null)
          next[key] =
            after[key].complete && after[key].min === after[key].max
              ? after[key].min
              : null;
      }
    }
    onChange(next);
  };
  const totals = stepTotals(steps);
  return (
    <section className="workout-builder">
      <h3>목적과 수행 조건</h3>
      <p className="helper">{guidance[session.type]}</p>
      <div className="form-grid">
        <Field label="훈련 목적">
          <input
            value={w.purpose || ""}
            placeholder="이번 훈련으로 확인하거나 개선할 점"
            onChange={(e) => set("purpose", e.target.value)}
          />
        </Field>
        <Field label="시간대">
          <input
            value={w.timeSlot || ""}
            placeholder="오전 / 저녁 / 07:00"
            onChange={(e) => set("timeSlot", e.target.value)}
          />
        </Field>
        <Field label="수행량 기준">
          <select
            value={w.amountBasis || "distance"}
            onChange={(e) => set("amountBasis", e.target.value)}
          >
            {Object.entries({
              distance: "거리",
              time: "시간",
              steps: "상세 단계",
              rest: "휴식",
            }).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="총량 성격">
          <select
            value={w.totalKind || "unknown"}
            onChange={(e) => set("totalKind", e.target.value)}
          >
            <option value="unknown">미정 / 입력된 값만 참고</option>
            <option value="exact">정확한 총량</option>
            <option value="estimate">추정 대표값</option>
          </select>
        </Field>
        <Field label="중요도">
          <select
            value={w.priority || "normal"}
            onChange={(e) => set("priority", e.target.value)}
          >
            <option value="normal">일반</option>
            <option value="key">핵심</option>
            <option value="optional">선택</option>
          </select>
        </Field>
        <Field label="장소 · 지형">
          <input
            value={w.terrain || ""}
            placeholder="로드 / 트랙 / 기술적 트레일 / 경사"
            onChange={(e) => set("terrain", e.target.value)}
          />
        </Field>
      </div>
      {session.type !== "rest" && (
        <>
          <h4>공통 목표 강도</h4>
          <IntensityFields
            value={w.intensity}
            onChange={(v) => set("intensity", v)}
          />
          <p className="helper">
            단계에 강도를 지정하면 해당 단계의 기준을 우선합니다. 정확한 총량은
            단계 수정 시 같은 단위의 합계로 갱신합니다. VDOT 수치는 자동
            생성하지 않습니다.
          </p>
          <WorkoutFlow steps={steps} intensity={w.intensity} />
          <h4>단계 편집</h4>
          <p className="helper">
            단계를 눌러 수정하세요. 반복 묶음의 회복은 마지막 반복에서 생략할 수
            있습니다.
          </p>
          {!steps.length && (
            <p className="helper">
              단순 러닝은 위의 전체 거리·시간과 공통 강도로 작성할 수 있습니다.
            </p>
          )}
          {!steps.length && templateSteps(session.type).length > 0 && (
            <button
              type="button"
              className="button"
              onClick={() => set("steps", templateSteps(session.type))}
            >
              종류에 맞는 구성 불러오기
            </button>
          )}
          <Steps value={steps} onChange={(v) => set("steps", v)} />
          {!!steps.length && (
            <div className="step-totals">
              {Object.entries(totals).map(([k, t]) => (
                <p key={k}>
                  {k === "distance" ? "거리" : "시간"}{" "}
                  {k === "distance" ? t.min.toFixed(2) : formatMinutes(t.min)}–
                  {k === "distance"
                    ? t.max.toFixed(2) + " km"
                    : formatMinutes(t.max)}{" "}
                  ·{" "}
                  {t.complete
                    ? "전체 단계 합계"
                    : "해당 단위로 입력된 구간만 합산"}
                </p>
              ))}
              {(totals.duration.complete || totals.distance.complete) && (
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    onChange({
                      ...session,
                      duration:
                        totals.duration.complete &&
                        totals.duration.min === totals.duration.max
                          ? totals.duration.min
                          : null,
                      distance:
                        totals.distance.complete &&
                        totals.distance.min === totals.distance.max
                          ? totals.distance.min
                          : null,
                      workout: {
                        ...w,
                        totalKind: "exact",
                        amountBasis: "steps",
                      },
                    })
                  }
                >
                  단계 합계를 전체 예정량에 반영
                </button>
              )}
              <p className="helper">
                시간 구간을 임의의 페이스로 거리 환산하지 않습니다. 총량은 위의
                전체 예정량에 별도로 작성하세요.
              </p>
            </div>
          )}
        </>
      )}
      {["long", "trail", "race", "hill"].includes(session.type) && (
        <div className="form-grid">
          <Field label="보급 계획">
            <textarea
              value={w.fueling || ""}
              placeholder="보급 시점, 수분·탄수화물, 보급소"
              onChange={(e) => set("fueling", e.target.value)}
            />
          </Field>
          <Field label="장비 · 코스 주의점">
            <textarea
              value={w.equipment || ""}
              onChange={(e) => set("equipment", e.target.value)}
            />
          </Field>
        </div>
      )}
      {session.type === "race" && (
        <section className="race-fields">
          <h4>레이스 · TT 계획</h4>
          <div className="form-grid">
            <Field label="점검 형태">
              <select
                value={w.race?.kind || "race"}
                onChange={(e) =>
                  set("race", { ...w.race, kind: e.target.value })
                }
              >
                <option value="race">레이스</option>
                <option value="tt">타임 트라이얼 (TT)</option>
                <option value="benchmark">비교 훈련</option>
              </select>
            </Field>
            <Field label="계획에서의 역할">
              <select
                value={w.race?.role || "goal"}
                onChange={(e) =>
                  set("race", { ...w.race, role: e.target.value })
                }
              >
                <option value="goal">주목표</option>
                <option value="checkpoint">중간 점검</option>
                <option value="training">훈련 일부</option>
              </select>
            </Field>
            {Object.entries({
              strategy: "수행 전략 · 목표 페이스",
              criteria: "사전에 정한 판단 기준",
              before: "사전 훈련 조정",
              after: "이후 회복 계획",
              resultUse: "결과를 다음 계획에 활용할 방법",
            }).map(([k, l]) => (
              <Field label={l} key={k}>
                <textarea
                  value={w.race?.[k] || ""}
                  onChange={(e) =>
                    set("race", { ...w.race, [k]: e.target.value })
                  }
                />
              </Field>
            ))}
          </div>
        </section>
      )}
      <details>
        <summary>평가 기준과 일정 조정</summary>
        <div className="form-grid">
          {Object.entries({
            evaluation: "평가 기준",
            moveRule: "이동 가능한 요일 · 고정 일정",
            adjustmentRule: "유지할 요소 · 축소 / 대체 원칙",
          }).map(([k, l]) => (
            <Field label={l} key={k}>
              <textarea
                value={w[k] || ""}
                onChange={(e) => set(k, e.target.value)}
              />
            </Field>
          ))}
        </div>
      </details>
    </section>
  );
}
