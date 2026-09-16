import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CoachIcon,
  ArrowsClockwise,
} from "./icons.jsx";
import Markdown from "./Markdown.mjs";
import WorkoutSummary from "./WorkoutSummary.jsx";
import DurationFields from "./DurationFields.jsx";
import { formatMinutes } from "../shared/time.mjs";
import {
  methodLabels,
  policySources,
  trailApproaches,
  methodDescriptions,
} from "../shared/training-policy.mjs";
const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
const questions = [
  [
    "어떤 목표로 달리나요?",
    "종목과 목표를 선택하세요. 로드와 트레일을 병행하면 주목표를 먼저 정합니다.",
  ],
  [
    "최근에 실제로 소화한 훈련은 어느 정도인가요?",
    "Garmin 기록은 출발점입니다. 빠진 기록이나 휴식 기간을 확인하고, 몸이 감당했던 훈련량으로 수정해주세요.",
  ],
  [
    "최근 피로와 통증은 어떤가요?",
    "수면·피로·통증은 페이스보다 먼저 결정해야 할 조건입니다. 회복이 부족하면 훈련을 줄이겠습니다.",
  ],
  [
    "일상에서 지킬 수 있는 요일과 시간은 어떻게 되나요?",
    "0분은 쉬는 날입니다. 러닝에 쓸 수 있는 실제 시간만 적어주세요. 선택한 요일 안에서 롱런과 회복 간격을 확보하겠습니다.",
  ],
  [
    "어떤 지형과 보조 훈련을 활용할 수 있나요?",
    "평지 속도와 산에서의 기술은 다릅니다. 상승 고도, 내려오기 경험, 보급과 근력도 함께 고려하겠습니다.",
  ],
  [
    "선호하는 훈련 방식이 있나요?",
    "추천을 선택하면 지금까지의 답으로 방법론을 고릅니다. 직접 선택해도 현재 기반·회복 조건이 우선합니다.",
  ],
  [
    "계획과 가능한 시간을 확인해주세요.",
    "주간 배정과 확인 사항을 살펴보세요. 조건을 바꾸려면 이전 답변으로 돌아갈 수 있습니다.",
  ],
];
function Field({ label, children, help }) {
  return (
    <label className="planning-field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>
          선택해주세요
        </option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}
const raceDistances = [
  ["5", "5km"],
  ["10", "10km"],
  ["21.0975", "하프마라톤 · 21.0975km"],
  ["42.195", "풀마라톤 · 42.195km"],
];
function RaceDistance({ value, onChange, required, readOnly }) {
  const preset = raceDistances.find(([n]) => Number(n) === Number(value))?.[0];
  const [custom, setCustom] = useState(
    value !== "" && value != null && !preset,
  );
  return (
    <div className="planning-field">
      <label>
        목표 거리
        <select
          aria-label="목표 거리"
          disabled={readOnly}
          required={required}
          value={custom ? "custom" : preset || ""}
          onChange={(e) => {
            const next = e.target.value;
            setCustom(next === "custom");
            if (next !== "custom") onChange(next);
          }}
        >
          <option value="">선택해주세요</option>
          {raceDistances.map(([n, text]) => (
            <option key={n} value={n}>
              {text}
            </option>
          ))}
          <option value="custom">직접 입력</option>
        </select>
      </label>
      {custom && (
        <label>
          직접 입력 (km)
          <input
            aria-label="목표 거리 직접 입력 (km)"
            type="number"
            min="1"
            max="300"
            step="any"
            required={required}
            readOnly={readOnly}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
export default function PlanCoach({
  goals,
  modal,
  today,
  api,
  busy,
  onApply,
  dataset,
}) {
  const [v, setV] = useState(null),
    [step, setStep] = useState(0),
    [baseline, setBaseline] = useState(null),
    [preview, setPreview] = useState(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [agreed, setAgreed] = useState(false),
    [question, setQuestion] = useState(""),
    [discussion, setDiscussion] = useState([]),
    [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setError("");
    api("/plan/intake")
      .then(({ draft, baseline: b }) => {
        if (!alive) return;
        setBaseline(b);
        setDiscussion(draft?.discussion || []);
        const initial = {
          mode: modal.type || "road",
          priority: modal.type || "road",
          start: today,
          goalId: null,
          secondaryGoalId: null,
          raceDate: "",
          raceDistance: "",
          raceElevation: "",
          targetMinutes: "",
          secondaryDate: "",
          secondaryDistance: "",
          secondaryElevation: "",
          objective: "base",
          baselineConfirmed: false,
          baselineMinutes: b.baselineMinutes,
          baselineKm: b.baselineKm,
          baselineElevation: b.baselineElevation,
          longestMinutes: b.longestMinutes,
          longestKm: b.longestKm,
          consistency: "",
          experience: "",
          qualityExperience: false,
          qualityDaysPerWeek: 1,
          currentRunsPerWeek: "",
          allowDoubles: false,
          qualityMinutesPerWeek: 15,
          walkingMinutes: "",
          nightRunning: false,
          recovery: "",
          recentInjury: false,
          sleep: "",
          availability: [0, 45, 0, 45, 0, 30, 90],
          longDay: 6,
          weeklyLimit: b.baselineMinutes || 180,
          terrain: "",
          descent: "new",
          strength: "none",
          fueling: "new",
          method: "auto",
          trailApproach: "auto",
          recentRaceDistance: "",
          recentRaceMinutes: "",
          recentRaceDate: "",
          notes: "",
        };
        const saved = draft?.answers;
        const goal = goals.find((g) => g.id === modal.goalId);
        setV(
          goal
            ? {
                ...initial,
                mode: goal.type,
                priority: goal.type,
                objective: goal.targetMinutes ? "performance" : "finish",
                goalId: goal.id,
                raceDate: goal.date,
                raceDistance: goal.distance,
                raceElevation: goal.elevation,
                targetMinutes: goal.targetMinutes || "",
              }
            : saved
              ? { ...initial, ...saved }
              : initial,
        );
        setStep(goal ? 0 : Math.min(draft?.step || 0, 5));
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [loadAttempt]);
  const change = (key, value) => {
    setV((p) => ({
      ...p,
      [key]: value,
      ...(key === "experience" && value !== "experienced"
        ? { allowDoubles: false }
        : {}),
    }));
    setPreview(null);
    setAgreed(false);
  };
  const number = (key, label, min, max, required = true, help) => (
    <Field label={label} help={help}>
      <input
        type="number"
        readOnly={
          (!!v.goalId &&
            ["raceDistance", "raceElevation", "targetMinutes"].includes(key)) ||
          (!!v.secondaryGoalId &&
            ["secondaryDistance", "secondaryElevation"].includes(key))
        }
        required={required}
        min={min}
        max={max}
        step={
          ["consistency", "currentRunsPerWeek", "qualityDaysPerWeek"].includes(
            key,
          )
            ? "1"
            : "any"
        }
        value={v[key] ?? ""}
        onChange={(e) => change(key, e.target.value)}
      />
    </Field>
  );
  const selectGoal = (id, secondary = false) => {
    const g = goals.find((x) => x.id === id);
    setV((p) =>
      secondary
        ? {
            ...p,
            secondaryGoalId: g?.id || null,
            secondaryDate: g?.date || "",
            secondaryDistance: g?.distance || "",
            secondaryElevation: g?.elevation ?? "",
          }
        : {
            ...p,
            goalId: g?.id || null,
            raceDate: g?.date || "",
            raceDistance: g?.distance || "",
            raceElevation: g?.elevation ?? "",
            targetMinutes: g?.targetMinutes || "",
            objective: g
              ? g.targetMinutes
                ? "performance"
                : "finish"
              : p.objective,
          },
    );
    setPreview(null);
  };
  const save = async (next) => {
    await api("/plan/intake", { answers: v, step: next }, "PUT");
  };
  const build = async () => {
    const plan = await api("/plan/coaching-preview", v);
    setPreview(plan);
    setAgreed(false);
    return plan;
  };
  if (!v)
    return (
      <div>
        <p role={error ? "alert" : "status"}>
          {error || "최근 활동과 저장한 상담을 불러오는 중…"}
        </p>
        {error && (
          <button
            className="button"
            onClick={() => setLoadAttempt((n) => n + 1)}
          >
            다시 불러오기
          </button>
        )}
      </div>
    );
  const primary = v.mode === "hybrid" ? v.priority : v.mode;
  return (
    <div className="plan-coach">
      {dataset === "demo" && (
        <p className="planning-demo">
          샘플 기록으로 상담 중입니다. 실제 훈련 계획과 별도로 저장됩니다.
        </p>
      )}
      <div className="planning-progress" aria-label="계획 상담 단계">
        {questions.map(([q], i) => (
          <button
            key={q}
            type="button"
            disabled={pending || i > step}
            aria-current={i === step ? "step" : undefined}
            onClick={() => {
              setStep(i);
              setError("");
            }}
          >
            {i + 1}
            <span>
              {
                [
                  "목표",
                  "현재 기반",
                  "회복",
                  "일정",
                  "지형·보급",
                  "방법론",
                  "검토",
                ][i]
              }
            </span>
          </button>
        ))}
      </div>
      <div className="planning-question">
        <CoachIcon size={25} />
        <div>
          <small>STRIDE COACH · {step + 1} / 7</small>
          <h3>{questions[step][0]}</h3>
          <p>{questions[step][1]}</p>
        </div>
      </div>
      {error && (
        <p className="coach-error" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError("");
          try {
            if (
              step === 0 &&
              v.objective === "performance" &&
              (!v.targetMinutes ||
                Number(v.targetMinutes) < 10 ||
                Number(v.targetMinutes) > 5000)
            ) {
              throw new Error(
                "목표 완주 시간을 10분부터 83시간 20분 사이로 입력해주세요.",
              );
            }
            await save(Math.min(step + 1, 6));
            if (step === 5) await build();
            setStep(Math.min(step + 1, 6));
          } catch (e) {
            setError(e.message);
          } finally {
            setPending(false);
          }
        }}
      >
        {step === 0 && (
          <div className="planning-fields">
            <Select
              label="준비할 종목"
              value={v.mode}
              onChange={(x) => {
                setV((p) => ({
                  ...p,
                  mode: x,
                  priority: x === "hybrid" ? p.priority : x,
                  goalId: null,
                  secondaryGoalId: null,
                  raceDate: "",
                  secondaryDate: "",
                  raceDistance: "",
                  raceElevation: "",
                  targetMinutes: "",
                  secondaryDistance: "",
                  secondaryElevation: "",
                }));
                setPreview(null);
              }}
              options={[
                ["road", "로드 러닝"],
                ["trail", "트레일러닝"],
                ["hybrid", "로드 + 트레일 병행"],
              ]}
            />
            {v.mode === "hybrid" && (
              <Select
                label="이번 블록의 주목표"
                value={v.priority}
                onChange={(x) =>
                  setV((p) => ({
                    ...p,
                    priority: x,
                    goalId: null,
                    secondaryGoalId: null,
                    raceDate: "",
                    secondaryDate: "",
                    raceDistance: "",
                    raceElevation: "",
                    targetMinutes: "",
                    secondaryDistance: "",
                    secondaryElevation: "",
                  }))
                }
                options={[
                  ["road", "로드 우선 · 트레일 유지"],
                  ["trail", "트레일 우선 · 로드 능력 유지"],
                ]}
              />
            )}
            <Select
              label="목표의 성격"
              value={v.objective}
              onChange={(x) => change("objective", x)}
              options={[
                ["base", "기초 체력 / 꾸준한 훈련"],
                ["finish", "대회 완주"],
                ["performance", "대회 기록 도전"],
              ]}
            />
            <Field label="시작일">
              <input
                required
                type="date"
                min={today}
                value={v.start}
                onChange={(e) => change("start", e.target.value)}
              />
            </Field>
            <Field label="연결할 주목표">
              <select
                value={v.goalId || ""}
                onChange={(e) => selectGoal(e.target.value)}
              >
                <option value="">직접 조건 입력 / 목표 연결 안 함</option>
                {goals
                  .filter((g) => g.type === primary && g.date > today)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} · {g.date}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="주목표 대회 날짜 (기초 목표는 선택)">
              <input
                required={v.objective !== "base"}
                type="date"
                readOnly={!!v.goalId}
                value={v.raceDate}
                onChange={(e) => change("raceDate", e.target.value)}
              />
            </Field>
            <RaceDistance
              key={`${v.goalId || "manual"}-${primary}`}
              value={v.raceDistance}
              onChange={(n) => change("raceDistance", n)}
              required={v.objective !== "base"}
              readOnly={!!v.goalId}
            />
            {primary === "trail" &&
              number("raceElevation", "목표 상승 고도 (m)", 0, 30000, false)}
            {v.objective === "performance" && (
              <div className="planning-field">
                <span>목표 완주 시간 · 시:분:초</span>
                <fieldset
                  disabled={!!v.goalId}
                  style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                >
                  <DurationFields
                    label="목표 완주 시간"
                    maxHours={83}
                    value={
                      v.targetMinutes === "" || v.targetMinutes == null
                        ? null
                        : Number(v.targetMinutes) * 60
                    }
                    onChange={(seconds) =>
                      change(
                        "targetMinutes",
                        seconds == null ? "" : seconds / 60,
                      )
                    }
                  />
                </fieldset>
                <small>
                  10분부터 83시간 20분까지 입력하세요. 희망 기록이며 현재 훈련
                  페이스로 강제하지 않습니다.
                </small>
              </div>
            )}
            {v.mode === "hybrid" && (
              <>
                <Field label="연결할 보조목표">
                  <select
                    value={v.secondaryGoalId || ""}
                    onChange={(e) => selectGoal(e.target.value, true)}
                  >
                    <option value="">대회 없이 보조 종목 유지</option>
                    {goals
                      .filter((g) => g.type !== primary && g.date > today)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} · {g.date}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="보조 대회 날짜 (선택)">
                  <input
                    type="date"
                    readOnly={!!v.secondaryGoalId}
                    value={v.secondaryDate}
                    onChange={(e) => change("secondaryDate", e.target.value)}
                  />
                </Field>
                {number(
                  "secondaryDistance",
                  "보조 대회 거리 (km)",
                  1,
                  300,
                  false,
                )}
                {primary === "road" &&
                  number(
                    "secondaryElevation",
                    "보조 트레일 상승 고도 (m)",
                    0,
                    30000,
                    false,
                  )}
              </>
            )}
          </div>
        )}
        {step === 1 && (
          <>
            <div className="planning-baseline">
              <h4>
                {dataset === "demo"
                  ? "샘플 기록에서 본 출발점"
                  : "최근 실제 기록에서 본 출발점"}
              </h4>
              <p>{baseline.explanation}</p>
              <div className="planning-week-data">
                {baseline.weeks.map((w) => (
                  <div key={w.start}>
                    <small>{w.start}</small>
                    <strong>{formatMinutes(w.minutes)}</strong>
                    <span>
                      {w.km} km · {w.days}일
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="planning-fields">
              {number(
                "baselineMinutes",
                "지속 가능한 주간 러닝 시간 (분)",
                0,
                1800,
              )}
              {Number(v.baselineMinutes) === 0 &&
                number(
                  "walkingMinutes",
                  "무리 없이 연속으로 걸을 수 있는 시간 (분)",
                  0,
                  120,
                  false,
                  "러닝 경험이 없을 때 걷기·달리기 적응의 시작점으로 사용합니다.",
                )}
              {number("baselineKm", "지속 가능한 주간 거리 (km)", 0, 250)}
              {number(
                "longestMinutes",
                "최근 30일 최장 활동 시간 (분)",
                0,
                600,
              )}
              {number("longestKm", "최근 30일 최장 활동 거리 (km)", 0, 150)}
              {number("baselineElevation", "최근 주간 상승 고도 (m)", 0, 15000)}
              {v.experience === "experienced" &&
                number(
                  "currentRunsPerWeek",
                  "최근 주당 러닝 횟수 (하루 2회 포함)",
                  1,
                  14,
                  false,
                  "하루 두 번 달리기를 허용할 때 현재 빈도의 상한으로 사용합니다.",
                )}
              {number("consistency", "꾸준히 달려온 최근 연속 주수", 0, 104)}
              <Select
                label="달리기 경험"
                value={v.experience}
                onChange={(x) => change("experience", x)}
                options={[
                  ["new", "입문 / 복귀 초기"],
                  ["regular", "규칙적으로 달리는 중"],
                  ["experienced", "여러 훈련 사이클 경험"],
                ]}
              />
              <label className="planning-check">
                <input
                  type="checkbox"
                  checked={v.qualityExperience}
                  onChange={(e) =>
                    change("qualityExperience", e.target.checked)
                  }
                />
                최근 역치·인터벌 훈련에 적응한 경험이 있어요
              </label>
              {v.qualityExperience && (
                <>
                  {number(
                    "qualityDaysPerWeek",
                    "최근 주당 역치·인터벌 훈련 일수",
                    0,
                    4,
                    true,
                    "최근 4주에 꾸준히 소화한 횟수입니다. 롱런은 제외합니다.",
                  )}
                  {number(
                    "qualityMinutesPerWeek",
                    "최근 주당 강도 구간 합계 (분)",
                    0,
                    240,
                    true,
                    "워밍업·회복·쿨다운을 뺀 본훈련 시간입니다. 더 많은 경험도 계획에는 최대 주 2회까지만 반영합니다.",
                  )}
                </>
              )}
              <label className="planning-check">
                <input
                  type="checkbox"
                  required
                  checked={v.baselineConfirmed}
                  onChange={(e) =>
                    change("baselineConfirmed", e.target.checked)
                  }
                />
                누락 기록과 휴식 기간을 확인했고, 위 수치를 현재 기반으로
                사용할게요
              </label>
            </div>
          </>
        )}
        {step === 2 && (
          <div className="planning-fields">
            <Select
              label="현재 회복 상태"
              value={v.recovery}
              onChange={(x) => change("recovery", x)}
              options={[
                ["ready", "평소와 비슷하고 통증 없음"],
                ["tired", "누적 피로 / 회복 부족"],
                ["pain", "달릴 때 통증 또는 주법 변화"],
                ["illness", "질병 증상 / 회복 중"],
              ]}
            />
            {number("sleep", "최근 평균 수면 (시간)", 2, 12)}
            <label className="planning-check">
              <input
                type="checkbox"
                checked={v.recentInjury}
                onChange={(e) => change("recentInjury", e.target.checked)}
              />
              최근 부상으로 쉬었거나 복귀 중이에요
            </label>
            <p className="helper">
              통증·질병 상태에서는 계획 적용을 잠시 막고 복귀 조건을 먼저
              확인합니다. 피로 상태에서는 고강도·증량을 줄입니다.
            </p>
          </div>
        )}
        {step === 3 && (
          <>
            <div className="planning-availability">
              {weekdays.map((d, i) => (
                <Field key={d} label={`${d}요일 (분)`}>
                  <input
                    type="number"
                    min="0"
                    max="600"
                    step="5"
                    required
                    value={v.availability[i]}
                    onChange={(e) =>
                      change(
                        "availability",
                        v.availability.map((n, j) =>
                          i === j ? e.target.value : n,
                        ),
                      )
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="planning-fields">
              <Select
                label="롱런을 할 요일"
                value={String(v.longDay)}
                onChange={(x) => change("longDay", Number(x))}
                options={weekdays.map((d, i) => [String(i), d + "요일"])}
              />
              {number(
                "weeklyLimit",
                "주간 러닝 시간 상한 (분)",
                30,
                1800,
                true,
                "근력 보조 시간은 별도로 표시합니다. 하루 상한도 함께 적용합니다.",
              )}
              {v.experience === "experienced" && (
                <label className="planning-check">
                  <input
                    type="checkbox"
                    checked={v.allowDoubles}
                    onChange={(e) => change("allowDoubles", e.target.checked)}
                  />
                  이미 익숙한 하루 두 번 달리기를 허용해요 (요일별 시간은 하루
                  합계)
                </label>
              )}
              <p className="helper">
                주 2~7일을 선택해주세요. 주 7일은 충분한 최근 기반을 확인한 숙련
                러너에게만 배정합니다. 핵심 훈련 간 간격이 안 나오면 강도 훈련을
                줄이고 이지런으로 바꿉니다.
              </p>
            </div>
          </>
        )}
        {step === 4 && (
          <div className="planning-fields">
            <Select
              label="정기적으로 접근 가능한 지형"
              value={v.terrain}
              onChange={(x) => change("terrain", x)}
              options={[
                ["flat", "평지 / 트레드밀"],
                ["hills", "언덕 접근 가능"],
                ["trail", "실제 트레일 접근 가능"],
              ]}
            />
            {v.mode !== "road" && (
              <Select
                label="다운힐 경험"
                value={v.descent}
                onChange={(x) => change("descent", x)}
                options={[
                  ["new", "거의 없음 / 오랜만"],
                  ["some", "가끔 경험"],
                  ["experienced", "최근에도 규칙적으로 적응"],
                ]}
              />
            )}
            {v.mode !== "road" && (
              <Select
                label="트레일 훈련 접근"
                value={v.trailApproach || "auto"}
                onChange={(x) => change("trailApproach", x)}
                options={Object.entries(trailApproaches)}
              />
            )}
            <Select
              label="근력 보조 훈련"
              value={v.strength}
              onChange={(x) => change("strength", x)}
              options={[
                ["none", "이번 블록에서는 제외"],
                ["new", "주 1~2회 짧게 시작"],
                ["regular", "기존 루틴을 유지"],
              ]}
            />
            <Select
              label="롱런 중 보급 경험"
              value={v.fueling}
              onChange={(x) => change("fueling", x)}
              options={[
                ["new", "익숙하지 않아 연습 필요"],
                ["practiced", "익숙한 제품·섭취 방법 있음"],
              ]}
            />
            {v.mode !== "road" && (
              <label className="planning-check">
                <input
                  type="checkbox"
                  checked={v.nightRunning}
                  onChange={(e) => change("nightRunning", e.target.checked)}
                />
                목표 코스에 야간 구간이 있어요
              </label>
            )}
            <Field label="코치와 의논할 추가 조건">
              <textarea
                rows={3}
                maxLength={1500}
                placeholder="예: 대회가 기술적인 하강 코스라 걱정돼요. 일정 제약은 앞 단계의 요일·시간에 직접 반영해주세요."
                value={v.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </Field>
          </div>
        )}
        {step === 5 && (
          <>
            <div className="planning-fields">
              <Select
                label="훈련 방법론"
                value={v.method}
                onChange={(x) => change("method", x)}
                options={[
                  ["auto", "답변을 바탕으로 추천받기"],
                  ...Object.entries(methodLabels),
                ]}
              />
              {v.objective === "performance" && (
                <>
                  {number(
                    "recentRaceDistance",
                    "최근 로드 대회 거리 (km · 선택)",
                    3,
                    100,
                    false,
                  )}
                  {number(
                    "recentRaceMinutes",
                    "최근 로드 대회 시간 (분 · 선택)",
                    5,
                    1500,
                    false,
                  )}
                  <Field label="최근 로드 대회 날짜 (선택)">
                    <input
                      type="date"
                      max={today}
                      value={v.recentRaceDate}
                      onChange={(e) => change("recentRaceDate", e.target.value)}
                    />
                  </Field>
                </>
              )}
            </div>
            <div className="planning-principles">
              {Object.entries(methodDescriptions).map(([key, text]) => (
                <p key={key}>
                  <strong>{methodLabels[key]}: </strong>
                  {text}
                </p>
              ))}
              <p>
                방법론 이름보다 현재 기반과 회복이 우선합니다. 더블 역치·연속
                장거리·중량 등반은 자동 배치하지 않습니다.
              </p>
            </div>
          </>
        )}
        {step < 6 && (
          <div className="planning-actions">
            <button
              type="button"
              className="button"
              disabled={pending || step === 0}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft />
              이전 답변
            </button>
            <button className="button primary" disabled={pending}>
              {pending
                ? "상담 저장 중…"
                : step === 5
                  ? "결정 사항과 계획 보기"
                  : "답변하고 다음으로"}
              <ArrowRight />
            </button>
          </div>
        )}
      </form>
      {step === 6 && preview && (
        <div className="planning-review">
          <p className="helper">
            {methodLabels[preview.method]} · {preview.sessions.length}회 훈련 ·
            첫 주 {formatMinutes(preview.weeks[0]?.minutes ?? 0)}
          </p>
          <details className="planning-cautions">
            <summary>이렇게 배정한 이유</summary>
            <div className="planning-decisions">
              {preview.decisions.map((d) => (
                <article key={d.title}>
                  <h4>{d.title}</h4>
                  <p>{d.text}</p>
                </article>
              ))}
            </div>
            {preview.performance && (
              <p className="helper">
                거리 환산 참고:{" "}
                {formatMinutes(preview.performance.referenceMinutes)} ·{" "}
                {preview.performance.note}
              </p>
            )}
          </details>
          {!!preview.blockers.length && (
            <div className="coach-error" role="alert">
              <h4>먼저 해결할 조건</h4>
              <ul>
                {preview.blockers.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {!!preview.warnings.length && (
            <details open className="planning-cautions">
              <summary>확인할 사항 {preview.warnings.length}개</summary>
              <ul>
                {preview.warnings.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </details>
          )}
          <details className="planning-cautions">
            <summary>대회까지의 훈련 방향</summary>
            <div className="planning-decisions">
              {preview.roadmap.map((r) => (
                <article key={r.phase}>
                  <h4>{r.phase}</h4>
                  <p>{r.text}</p>
                </article>
              ))}
            </div>
          </details>
          <h3>다음 4주 · 실제 배정</h3>
          <p className="helper">
            대회가 가까우면 첫 대회 전날까지 단축합니다. 날짜별 상세 내용에서
            목적·단계·보급·변경 규칙을 확인하세요.
          </p>
          <div className="planning-week-data">
            {preview.weeks.map((w) => (
              <div key={w.start}>
                <small>
                  {w.start} · {w.phase}
                </small>
                <strong>{formatMinutes(w.minutes)}</strong>
                <span>
                  {w.sessions}회 · 강도 구간 {formatMinutes(w.qualityMinutes)}
                </span>
                <span>
                  {w.elevation}m 상승 상한 · 보조 근력{" "}
                  {formatMinutes(w.ancillaryMinutes)}
                </span>
              </div>
            ))}
          </div>
          <div className="planning-sessions">
            {preview.sessions.map((s) => (
              <details key={s.date}>
                <summary>
                  <span>{s.date}</span>
                  <strong>{s.title}</strong>
                  <span>{formatMinutes(s.duration)}</span>
                </summary>
                <WorkoutSummary session={s} />
              </details>
            ))}
          </div>
          <details className="planning-cautions">
            <summary>매주 어떤 기준으로 조정하나요?</summary>
            <ul>
              {preview.adjustmentRules.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p>다음 점검 권장일: {preview.nextCheck}</p>
          </details>
          <section className="planning-consult">
            <h3>결정이 어려운 부분은 코치와 의논하세요</h3>
            <p className="helper">
              Codex 구독으로 답변합니다. 상담 조언은 일정을 자동 변경하지
              않으므로 앞 단계의 답변을 수정한 뒤 다시 검토해주세요.
            </p>
            {discussion.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>
                {m.model && (
                  <small className="message-label">
                    {m.model}
                    {m.effort ? ` · ${m.effort}` : ""}
                    {m.fallback ? " · 사용 한도에 따라 전환" : ""}
                  </small>
                )}
                <Markdown>{m.text}</Markdown>
              </div>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!question.trim()) return;
                setPending(true);
                setError("");
                try {
                  const r = await api("/plan/coaching-question", {
                    answers: v,
                    question,
                  });
                  setDiscussion((xs) => [
                    ...xs,
                    { role: "user", text: question },
                    {
                      role: "assistant",
                      text: r.text,
                      model: r.model,
                      effort: r.effort,
                      fallback: r.fallback,
                    },
                  ]);
                  setQuestion("");
                } catch (e) {
                  setError(e.message);
                } finally {
                  setPending(false);
                }
              }}
            >
              <textarea
                aria-label="계획 상담 질문"
                rows={2}
                maxLength={2000}
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="예: 토요일 트레일과 일요일 롱런을 같이 해도 될까요?"
              />
              <button className="button" disabled={pending}>
                {pending ? <ArrowsClockwise className="spin" /> : <CoachIcon />}
                코치에게 질문
              </button>
            </form>
          </section>
          <details className="planning-cautions">
            <summary>방법론과 근거 · 2026년 9월 기준</summary>
            <p>
              문헌의 경향과 개인의 처방은 다릅니다. 증량·회복·상한 수치는
              보수적인 앱 정책이며 안전이나 기록 달성을 보장하지 않습니다.
            </p>
            <ul>
              {policySources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <label className="planning-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            조건·경고·실제 시간을 검토했고 이 블록을 적용할게요
          </label>
          <div className="planning-actions">
            <button
              className="button"
              disabled={pending || busy}
              onClick={() => {
                setStep(0);
                setPreview(null);
                setAgreed(false);
              }}
            >
              <ArrowLeft />
              답변 수정
            </button>
            <button
              className="button primary"
              disabled={
                pending ||
                busy ||
                !agreed ||
                !!preview.blockers.length ||
                !preview.sessions.length
              }
              onClick={() => onApply(preview.id)}
            >
              <Check />
              {busy ? "적용 중…" : "검토한 계획 적용"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
