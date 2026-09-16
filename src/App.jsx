import ActivityMetrics from "./ActivityMetrics.jsx";
import { requestJson } from "./http-client.mjs";
import { matchesActivityName } from "../shared/activity-search.mjs";
import {
  optionalNumber,
  measurementDifference,
} from "../shared/record-values.mjs";
import PwaInstall from "./PwaInstall.jsx";
import TrainingPlans from "./TrainingPlans.jsx";
import { planProgress, planSessionStatus } from "../shared/plan-progress.mjs";
import {
  trackInputModality,
  allowUiMotion,
  uiEase,
  reveal,
} from "./ui-motion.mjs";
import OverviewPeriodPicker from "./OverviewPeriodPicker.jsx";
import DateRangePicker from "./DateRangePicker.jsx";
import {
  trendPeriods,
  monthDays,
  movePeriod,
  inDateRange,
} from "../shared/period.mjs";
import { summarizePeriod } from "../shared/period.mjs";
import DurationFields from "./DurationFields.jsx";
import WorkoutRecipePicker from "./WorkoutRecipePicker.jsx";
import { formatMinutes } from "../shared/time.mjs";
import WorkoutFields from "./WorkoutFields.jsx";
import WorkoutSummary from "./WorkoutSummary.jsx";
import { workoutTypes, templateSteps } from "../shared/workout.mjs";
import CalendarDay from "./CalendarDay.jsx";
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  House,
  Archive,
  CalendarBlank,
  ChartLineUp,
  Mountains,
  Target,
  ArrowsClockwise,
  GearSix,
  ArrowUpRight,
  ArrowRight,
  Plus,
  X,
  Check,
  LinkSimple,
  ArrowLeft,
  CaretLeft,
  CaretRight,
  CoachIcon,
  RunIcon,
  ActivityIcon,
  Clock,
  Heartbeat,
  Steps,
  ChatCircleDots,
  PaperPlaneTilt,
  DownloadSimple,
  SignOut,
  Trash,
  Leaf,
  Flag,
  Info,
  Plug,
  TrendUp,
  Path,
  CheckCircle,
  WarningCircle,
} from "./icons.jsx";
import {
  ResponsiveContainer,
  BarChart,
  Rectangle,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "./styles.css";
import "./superpower.css";
import "./materials.css";
import "./responsive.css";
import FeatureBoundary from "./FeatureBoundary.jsx";
const ActivityAnalysis = React.lazy(() => import("./ActivityAnalysis.jsx"));
const Coach = React.lazy(() => import("./Coach.jsx"));
const PlanCoach = React.lazy(() => import("./PlanCoach.jsx"));
const ActivityReview = React.lazy(() => import("./ActivityReview.jsx"));
import ConnectionSettings from "./ConnectionSettings.jsx";
const types = {
  ...workoutTypes,
  easy: "이지 러닝",
  tempo: "템포",
  interval: "인터벌",
  long: "롱런",
  trail: "트레일",
  rest: "휴식",
  road: "로드",
};
const navs = [
  ["overview", "대시보드", House],
  ["plan", "러닝 캘린더", CalendarBlank],
  ["progress", "성과 분석", ChartLineUp],
  ["goals", "훈련 계획", Target],
  ["coach", "AI 코치", CoachIcon],
];
const date = (
  offset = 0,
  base = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const monday = (d) => date(-((new Date(d).getUTCDay() + 6) % 7), d);
const nice = (d) =>
  new Date(d + "T12:00:00").toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
const num = (n) =>
  Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
const pace = (n) =>
  !n
    ? "—"
    : `${Math.floor(Math.round(n * 60) / 60)}′${String(Math.round(n * 60) % 60).padStart(2, "0")}″`;
const minutes = formatMinutes;
function IconButton({ label, children, ...p }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...p}>
      {children}
    </button>
  );
}
function Tag({ children, tone = "" }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function Empty({ title, children, action, icon: EmptyIcon = RunIcon }) {
  return (
    <div className="empty">
      <EmptyIcon size={36} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Modal({ title, onClose, children, wide = false, className = "" }) {
  const ref = useRef();
  const closing = useRef(false),
    alive = useRef(true),
    latestClose = useRef(onClose);
  latestClose.current = onClose;
  const close = () => {
    if (closing.current) return;
    if (!allowUiMotion()) return latestClose.current();
    closing.current = true;
    const el = ref.current;
    const start = getComputedStyle(el);
    const animation = el.animate(
      [
        { opacity: start.opacity, transform: start.transform },
        { opacity: 0, transform: "translateY(16px) scale(.985)" },
      ],
      { duration: 160, easing: uiEase, fill: "forwards" },
    );
    el.parentElement.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 160,
      fill: "forwards",
    });
    animation.finished
      .then(() => {
        if (alive.current) latestClose.current();
      })
      .catch(() => {});
  };
  useEffect(() => {
    alive.current = true;
    const prev = document.activeElement;
    const el = ref.current;
    const background = [...el.parentElement.parentElement.children]
      .filter((node) => node !== el.parentElement)
      .map((node) => [node, node.inert]);
    background.forEach(([node]) => {
      node.inert = true;
    });
    if (allowUiMotion()) {
      el.animate(
        [
          { opacity: 0, transform: "translateY(24px) scale(.97)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 240, easing: uiEase },
      );
      el.parentElement.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 180,
        easing: uiEase,
      });
    }
    el?.querySelector("input,select,textarea,button")?.focus();
    function key(e) {
      if (e.key === "Escape") latestClose.current();
      if (e.key === "Tab") {
        const fs = Array.from(
          el.querySelectorAll(
            "button,input,select,textarea,a[href],summary,[tabindex]",
          ),
        ).filter(
          (x) => !x.disabled && x.getClientRects().length && x.tabIndex >= 0,
        );
        if (e.shiftKey && document.activeElement === fs[0]) {
          e.preventDefault();
          fs.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === fs.at(-1)) {
          e.preventDefault();
          fs[0]?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      alive.current = false;
      el.getAnimations().forEach((a) => a.cancel());
      el.parentElement?.getAnimations().forEach((a) => a.cancel());
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      background.forEach(([node, wasInert]) => {
        node.inert = wasInert;
      });
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""} ${className}`}
      >
        <header>
          <h2>{title}</h2>
          <IconButton label="닫기" onClick={close}>
            <X />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  );
}
export default function App() {
  useEffect(trackInputModality, []);
  const [coachTarget, setCoachTarget] = useState(null);
  const [planningRevision, setPlanningRevision] = useState(0);
  const [page, setPage] = useState("overview"),
    [mode, setMode] = useState("live"),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(null),
    [busy, setBusy] = useState(false),
    [week, setWeek] = useState(monday(date())),
    [overviewAnchor, setOverviewAnchor] = useState(date()),
    [overviewUnit, setOverviewUnit] = useState("week"),
    [filter, setFilter] = useState("all"),
    [activityQuery, setActivityQuery] = useState(""),
    [coachVisited, setCoachVisited] = useState(false),
    [activityDates, setActivityDates] = useState(null),
    [status, setStatus] = useState(null),
    [details, setDetails] = useState(null),
    [range, setRange] = useState(8),
    [progressMonth, setProgressMonth] = useState(0);
  async function api(url, body, method, requestId) {
    return requestJson("/api" + url, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        "X-Dataset": mode,
        ...(requestId ? { "Idempotency-Key": requestId } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function refresh() {
    try {
      setData(await api("/state"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    setData(null);
    refresh();
    localStorage.setItem("stride-mode", mode);
  }, [mode]);
  useEffect(() => {
    if (data?.today) setWeek(monday(data.today));
  }, [data?.today]);
  useEffect(() => {
    if (page === "settings" || page === "coach")
      api("/integrations")
        .then(setStatus)
        .catch((e) => setError(e.message));
  }, [page]);
  useEffect(() => {
    if (page === "coach") setCoachVisited(true);
  }, [page]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const actionPending = useRef(false);
  async function act(fn, message, close = true) {
    if (actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      if (message) setToast(message);
      if (close) setModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      actionPending.current = false;
      setBusy(false);
    }
  }
  const contentRef = useRef(null),
    calendarRef = useRef(null);
  const priorPage = useRef(page),
    priorWeek = useRef(week);
  useLayoutEffect(() => {
    if (priorPage.current !== page)
      reveal(contentRef.current, { duration: 125 });
    priorPage.current = page;
  }, [page]);
  useLayoutEffect(() => {
    if (priorWeek.current !== week)
      reveal(calendarRef.current, {
        duration: 160,
        offset: week > priorWeek.current ? 8 : -8,
      });
    priorWeek.current = week;
  }, [week]);
  function go(p) {
    window.scrollTo({ top: 0, behavior: "instant" });
    setPage(p);
    setError("");
  }
  const activities = data?.activities || [],
    sessions = data?.sessions || [],
    goals = data?.goals || [];
  const filteredActivities = [...activities]
    .filter(
      (a) =>
        (filter === "all" || a.type === filter) &&
        matchesActivityName(a, activityQuery) &&
        inDateRange(a.date, activityDates),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const overview = summarizePeriod(
    activities,
    sessions,
    overviewAnchor,
    overviewUnit,
  );
  const periodLabel = overviewUnit === "month" ? "월간" : "주간";
  const inWeek = (x) => x.date >= week && x.date < date(7, week);
  const weekly = activities.filter(inWeek),
    planned = sessions
      .filter(inWeek)
      .sort((a, b) => a.date.localeCompare(b.date));
  const total = (xs, k) => xs.reduce((n, x) => n + (x[k] || 0), 0);
  const distance = total(weekly, "distance"),
    targetDistance = total(
      planned.filter((s) => s.type !== "rest"),
      "distance",
    );
  const weekProgress = planProgress(planned, activities, data?.today);
  const percent = targetDistance
    ? Math.round((distance / targetDistance) * 100)
    : 0;
  const next = sessions
    .filter(
      (s) =>
        s.type !== "rest" &&
        !activities.some((a) => a.id === s.activityId) &&
        s.date >= data?.today,
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const chart =
    range === "month"
      ? monthDays(
          activities,
          sessions,
          movePeriod(data?.today || date(), "month", progressMonth),
        )
      : trendPeriods(activities, sessions, data?.today || date(), range);
  const chartTicks =
    range === "month"
      ? chart
          .filter(
            (_, i) =>
              (i % 7 === 0 && i < chart.length - 3) || i === chart.length - 1,
          )
          .map((d) => d.label)
      : undefined;
  const syncActivities = ({ start, end }) =>
    mode === "demo"
      ? go("settings")
      : act(
          () => api("/sync", { oldest: start, newest: end }),
          "활동 동기화가 완료되었습니다.",
          false,
        );
  const detailRequest = useRef(0);
  async function openActivity(a, refresh = false) {
    const request = ++detailRequest.current;
    setDetails(null);
    setModal({ kind: "detail", item: a });
    try {
      const result = await api(
        `/activities/${a.id}/detail${refresh ? "?refresh=1" : ""}`,
      );
      if (request === detailRequest.current) setDetails(result);
    } catch (e) {
      if (request === detailRequest.current)
        setDetails({ id: a.id, error: e.message });
    }
  }
  function sessionCard(s) {
    const a = activities.find((a) => a.id === s.activityId);
    return (
      <button
        key={s.id}
        className={`session-card ${s.type}`}
        onClick={() => setModal({ kind: "session", item: s })}
      >
        <div className="row between">
          <span className="session-type">{types[s.type]}</span>
          {a ? (
            <CheckCircle size={18} weight="regular" />
          ) : (
            <ArrowUpRight size={16} />
          )}
        </div>
        <strong>{s.title}</strong>
        {s.type !== "rest" && (
          <span>
            {s.distance == null ? "거리 미정" : `${num(s.distance)} km`}{" "}
            <i>·</i>{" "}
            {s.elevation
              ? `${num(s.elevation)} m ↑`
              : s.duration == null
                ? "시간 미정"
                : minutes(s.duration)}
          </span>
        )}
        <small>{planSessionStatus(s, activities, data?.today)}</small>
      </button>
    );
  }
  function activityList(list, compact = false) {
    return list.length ? (
      <div className={`activity-list${compact ? " compact" : ""}`}>
        {list.map((a) => (
          <button
            key={a.id}
            className="activity-row"
            onClick={() => openActivity(a)}
          >
            <span className={`activity-icon ${a.type}`}>
              <ActivityIcon activity={a} size={23} />
            </span>
            <span className="activity-name">
              <strong>{a.name}</strong>
              <small>
                {nice(a.date)} ·{" "}
                {a.source === "demo"
                  ? "데모"
                  : a.source === "garmin"
                    ? "Garmin"
                    : a.source === "intervals"
                      ? "Intervals.icu"
                      : "수동 기록"}
                {sessions.some((s) => s.activityId === a.id) ? " · 연결됨" : ""}
              </small>
            </span>
            <ActivityMetrics activity={a} compact={compact} />
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
    ) : (
      <Empty title="첫 달리기를 기다리고 있어요">
        Garmin 활동을 동기화하거나 직접 기록해보세요.
      </Empty>
    );
  }
  const heading = {
    overview: [
      "오늘도, 나만의 페이스로.",
      "작은 달리기가 모여, 더 멀리 나아갑니다.",
    ],
    plan: ["러닝 캘린더", "훈련 계획과 달리기 기록을 날짜별로 확인하세요."],
    activities: ["달리기 기록", "이름, 날짜, 종류로 원하는 기록을 찾아보세요."],
    progress: ["훈련 추이", "주간·월간 거리와 훈련 구성을 확인하세요."],
    goals: [
      "훈련 계획",
      "목표와 훈련을 함께 설계하고, 전체 일정과 진행 상황을 확인하세요.",
    ],
    coach: [
      "러닝 코치",
      "궁금한 점을 물어보세요. 활동을 첨부하면 기록도 함께 검토합니다.",
    ],
    settings: ["연결 및 설정", "기록은 Mac에, 코칭은 나의 Codex 구독으로."],
  }[page];
  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => go("overview")}>
          <img
            className="brand-mark"
            src="/icons/stride-v3.svg"
            width="32"
            height="32"
            alt=""
          />
          <span>
            stride<span className="brand-dot">.</span>
          </span>
        </button>
        <small className="nav-label">YOUR RUNNING JOURNEY</small>
        <nav
          className="primary-nav"
          data-active={page === "settings" ? "false" : "true"}
          style={{
            "--nav-index": Math.max(
              0,
              navs.findIndex(
                ([id]) => id === (page === "activities" ? "plan" : page),
              ),
            ),
          }}
        >
          {navs.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={
                page === id || (page === "activities" && id === "plan")
                  ? "page"
                  : undefined
              }
              className={
                page === id || (page === "activities" && id === "plan")
                  ? "active"
                  : ""
              }
              onClick={() => go(id)}
            >
              <Icon size={21} weight="regular" />
              <span>{label}</span>
              {id === "coach" && <span className="ai-tag">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`settings-nav ${page === "settings" ? "active" : ""}`}
            aria-current={page === "settings" ? "page" : undefined}
            onClick={() => go("settings")}
          >
            <GearSix size={21} />
            설정
          </button>
          <div className="local-status">
            <span /> {data?.access?.remote ? "Tailscale" : "Local"} · 이 Mac에
            저장
          </div>
        </div>
      </aside>
      <main>
        <div ref={contentRef} className={`main-content page-${page}`}>
          {page === "activities" && (
            <button
              className="text-button calendar-back"
              onClick={() => go("plan")}
            >
              <ArrowLeft size={17} />
              러닝 캘린더로 돌아가기
            </button>
          )}
          <div className="page-heading">
            <button
              className="mobile-settings-button icon-button"
              aria-label="설정"
              aria-pressed={page === "settings"}
              onClick={() => go("settings")}
            >
              <GearSix size={21} />
            </button>
            <div className="page-heading-copy">
              <div className="eyebrow">
                {page === "overview"
                  ? "A LITTLE FURTHER, EVERY DAY"
                  : "YOUR PERSONAL RUNNING STUDIO"}
              </div>
              <h1>{heading[0]}</h1>
              <p>{heading[1]}</p>
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              <WarningCircle size={20} />
              <span>{error}</span>
              <IconButton label="오류 닫기" onClick={() => setError("")}>
                <X />
              </IconButton>
            </div>
          )}
          {mode === "demo" && (
            <div className="demo-banner">
              <Info size={17} />
              <span>
                지금은 샘플 기록으로 둘러보고 있어요. 개인 기록과 별도로
                저장됩니다.
              </span>
              <button onClick={() => setMode("live")}>
                내 훈련 시작하기 <ArrowRight size={15} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="empty">
              <ArrowsClockwise className="spin" size={30} />
              <p>
                {error
                  ? "서버 연결을 확인하세요."
                  : "러닝 스페이스를 불러오는 중…"}
              </p>
              {error && (
                <button className="button" onClick={refresh}>
                  다시 시도
                </button>
              )}
            </div>
          ) : (
            <>
              {page === "overview" && (
                <>
                  <div className="section-heading overview-period-heading">
                    <h2>{periodLabel} 러닝 리듬</h2>
                    <div className="section-actions">
                      <OverviewPeriodPicker
                        anchor={overviewAnchor}
                        unit={overviewUnit}
                        today={data.today || date()}
                        onChange={({ anchor, unit }) => {
                          setOverviewAnchor(anchor);
                          setOverviewUnit(unit);
                        }}
                      />
                      <DateRangePicker
                        action
                        today={data.today || date()}
                        disabled={busy}
                        onApply={syncActivities}
                      />
                    </div>
                  </div>
                  <div className="overview-grid">
                    <section className="card weekly-card">
                      <div className="row between">
                        <span>{periodLabel} 거리 달성률</span>
                      </div>
                      <div className="score-display">
                        <strong>
                          {overview.target ? overview.percent : "-"}
                          <small>{overview.target ? "%" : ""}</small>
                        </strong>
                        <span>
                          {overview.target
                            ? "계획한 거리를 향해"
                            : "첫 훈련 계획을 추가하세요"}
                        </span>
                        <progress
                          value={Math.min(overview.percent, 100)}
                          max="100"
                          aria-label={`${periodLabel} 거리 달성률`}
                        />
                      </div>
                      <div className="weekly-bottom">
                        <div>
                          <strong>
                            {num(overview.distance)}
                            <small> km</small>
                          </strong>
                          <span>달린 거리</span>
                        </div>
                        <span className="divider" />
                        <div>
                          <strong>
                            {num(overview.target)}
                            <small> km</small>
                          </strong>
                          <span>
                            계획한 거리
                            {overview.unknownDistance
                              ? " · 거리 미정 포함"
                              : ""}
                          </span>
                        </div>
                      </div>
                    </section>
                    <section className="card distance-card">
                      <div className="row between">
                        <h3>달리기의 흐름</h3>
                        <button
                          className="text-button"
                          onClick={() => go("progress")}
                        >
                          전체 분석 <ArrowUpRight size={15} />
                        </button>
                      </div>
                      <div className="big-stat">
                        {num(overview.distance)}
                        <span>km</span>
                      </div>
                      <p className="muted">
                        선택한 {overviewUnit === "week" ? "주" : "달"}의 누적
                        거리 · 일별 기록
                      </p>
                      <div className="chart">
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={overview.days} maxBarSize={20}>
                            <CartesianGrid
                              vertical={false}
                              stroke="#e7ebee"
                              strokeDasharray="3 4"
                            />
                            <XAxis
                              dataKey="label"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#7e90a2" }}
                            />
                            <Tooltip
                              cursor={{ fill: "#eff2f4" }}
                              formatter={(v) => [`${num(v)} km`, "실제 거리"]}
                            />
                            <Bar
                              isAnimationActive={false}
                              dataKey="distance"
                              radius={[5, 5, 3, 3]}
                            >
                              {overview.days.map((d, i) => (
                                <Cell
                                  key={i}
                                  fill={
                                    d.date === data.today
                                      ? "#405f7c"
                                      : "#829db8"
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                    <div className="metric-stack">
                      <section className="card metric-card">
                        <div className="row between">
                          <span>
                            <Mountains size={19} />
                            {periodLabel} 상승 고도
                          </span>
                          <ArrowUpRight size={17} />
                        </div>
                        <strong>
                          {num(overview.elevation)}
                          <small>m</small>
                        </strong>
                        <p>선택한 기간의 누적 상승 고도</p>
                      </section>
                      <section className="card metric-card warm">
                        <div className="row between">
                          <span>
                            <CheckCircle size={19} />
                            훈련 연결
                          </span>
                          <Tag>
                            {overview.completed
                              ? "잘 쌓고 있어요"
                              : "시작해보세요"}
                          </Tag>
                        </div>
                        <strong>
                          {overview.completed}
                          <small>
                            /{" "}
                            {
                              overview.plans.filter((s) => s.type !== "rest")
                                .length
                            }{" "}
                            회
                          </small>
                        </strong>
                        <p>실제 활동과 연결된 훈련</p>
                      </section>
                    </div>
                  </div>
                  <div className="middle-grid">
                    <section className="card next-card">
                      <div className="row between">
                        <div className="eyebrow">YOUR NEXT RUN</div>
                        {next && <Tag tone="green">{nice(next.date)}</Tag>}
                      </div>
                      <div className="next-body">
                        <span className="next-icon">
                          {next?.type === "trail" ? (
                            <Mountains size={36} weight="regular" />
                          ) : (
                            <RunIcon size={36} weight="regular" />
                          )}
                        </span>
                        <div>
                          <h2>
                            {next?.title || "다음 달리기를 계획해볼까요?"}
                          </h2>
                          <p>
                            {next
                              ? `${types[next.type]} · ${next.distance == null ? "거리 미정" : `${num(next.distance)} km`} · ${minutes(next.duration)}`
                              : "가능한 날짜에 훈련을 추가해보세요."}
                          </p>
                        </div>
                      </div>
                      <div className="next-footer">
                        <span>
                          {next?.notes ||
                            "계획은 언제든 내 일상에 맞게 바꿀 수 있어요."}
                        </span>
                        <button
                          className="circle-button"
                          aria-label="다음 훈련 보기"
                          onClick={() =>
                            next
                              ? setModal({ kind: "session", item: next })
                              : go("plan")
                          }
                        >
                          <ArrowUpRight size={21} />
                        </button>
                      </div>
                    </section>
                    <section className="card coach-card">
                      <div className="row between">
                        <span className="row">
                          <CoachIcon size={19} weight="regular" />
                          STRIDE COACH
                        </span>
                      </div>
                      <h2>이번 훈련, 어떻게 달렸나요?</h2>
                      <p>기록을 첨부하고 페이스·강도·회복에 대해 물어보세요.</p>
                      <button
                        className="text-button"
                        onClick={() => go("coach")}
                      >
                        코치와 이야기하기 <ArrowUpRight size={18} />
                      </button>
                    </section>
                  </div>
                  <div className="bottom-grid">
                    <section className="card">
                      <div className="row between">
                        <h3>최근 달리기</h3>
                        <button
                          className="text-button"
                          onClick={() => go("activities")}
                        >
                          모든 활동 <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {activityList(
                        [...activities]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .slice(0, 3),
                        true,
                      )}
                    </section>
                    <section className="card goal-preview">
                      <div className="row between">
                        <h3>훈련의 목표</h3>
                        <Flag size={18} />
                      </div>
                      {goals.length ? (
                        <>
                          <Tag tone="warm">
                            {goals[0].type === "road"
                              ? "ROAD MARATHON"
                              : "TRAIL RUNNING"}
                          </Tag>
                          <h2>{goals[0].name}</h2>
                          <p>
                            {nice(goals[0].date)} · {num(goals[0].distance)} km
                          </p>
                          <div className="row between goal-count">
                            <strong>
                              {Math.ceil(
                                (new Date(goals[0].date) -
                                  new Date(data.today)) /
                                  86400000,
                              ) >= 0
                                ? "D−"
                                : "D+"}
                              {Math.abs(
                                Math.ceil(
                                  (new Date(goals[0].date) -
                                    new Date(data.today)) /
                                    86400000,
                                ),
                              )}
                            </strong>
                            <button
                              className="circle-button"
                              aria-label="목표 보기"
                              onClick={() => go("goals")}
                            >
                              <ArrowUpRight />
                            </button>
                          </div>
                        </>
                      ) : (
                        <Empty title="나의 훈련 계획" icon={Target}>
                          <button
                            className="button"
                            onClick={() => go("goals")}
                          >
                            훈련 계획 보기
                          </button>
                        </Empty>
                      )}
                    </section>
                  </div>
                </>
              )}
              {page === "plan" && (
                <>
                  <div className="section-heading calendar-toolbar">
                    <div className="row calendar-period">
                      <IconButton
                        label="이전 주"
                        onClick={() => setWeek(date(-7, week))}
                      >
                        <CaretLeft />
                      </IconButton>
                      <h2>
                        {nice(week)} – {nice(date(6, week))}
                      </h2>
                      <IconButton
                        label="다음 주"
                        onClick={() => setWeek(date(7, week))}
                      >
                        <CaretRight />
                      </IconButton>
                      <button
                        className="text-button calendar-today"
                        aria-label="이번 주"
                        onClick={() => setWeek(monday(data.today))}
                      >
                        <ArrowsClockwise size={14} />
                        <span>이번 주</span>
                      </button>
                    </div>
                    <button
                      className="button"
                      onClick={() => setModal({ kind: "session" })}
                    >
                      <Plus />
                      훈련 추가
                    </button>
                  </div>
                  <div className="plan-summary">
                    <span>
                      계획 <strong>{num(targetDistance)} km</strong>
                      {planned.some(
                        (s) => s.type !== "rest" && s.distance == null,
                      ) && <small> · 거리 미정 포함</small>}
                    </span>
                    <span>
                      실제 <strong>{num(distance)} km</strong>
                    </span>
                    <span>
                      연결{" "}
                      <strong>
                        {weekProgress.completed} / {weekProgress.planned} 회
                      </strong>
                    </span>
                  </div>
                  <div className="calendar-shell">
                    <div className="calendar" ref={calendarRef}>
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = date(i, week);
                        return (
                          <section
                            key={d}
                            className={`day-column ${d === data.today ? "today" : ""}`}
                          >
                            <header>
                              <span>
                                {["월", "화", "수", "목", "금", "토", "일"][i]}
                              </span>
                              <strong>{Number(d.slice(8))}</strong>
                              {d === data.today && <small>TODAY</small>}
                            </header>
                            <div className="day-sessions">
                              <CalendarDay
                                day={d}
                                sessions={sessions}
                                activities={activities}
                                sessionCard={sessionCard}
                                openActivity={openActivity}
                              />
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
              {page === "plan" && (
                <section className="card calendar-records-link">
                  <div>
                    <h3>전체 러닝 기록</h3>
                    <p>
                      지금까지 쌓인 {activities.length}개의 활동을 검색하고
                      돌아보세요.
                    </p>
                  </div>
                  <button className="button" onClick={() => go("activities")}>
                    전체 러닝 보기
                    <ArrowRight size={18} />
                  </button>
                </section>
              )}
              {page === "activities" && (
                <>
                  <div className="section-heading activity-toolbar">
                    <h2>러닝 기록</h2>
                    <div className="section-actions">
                      <DateRangePicker
                        action
                        today={data.today || date()}
                        disabled={busy}
                        onApply={syncActivities}
                      />
                      <button
                        className="button"
                        onClick={() => setModal({ kind: "activity" })}
                      >
                        <Plus size={18} />
                        직접 기록
                      </button>
                    </div>
                  </div>
                  <section className="card activity-list-card">
                    <h3>
                      {activityDates || filter !== "all" || activityQuery.trim()
                        ? "조회 결과"
                        : "전체 러닝"}{" "}
                      <small className="activity-count">
                        {filteredActivities.length}개
                      </small>
                    </h3>
                    <div className="list-toolbar">
                      <DateRangePicker
                        value={activityDates}
                        today={data.today || date()}
                        onApply={setActivityDates}
                      />
                      <div className="tabs">
                        {[
                          ["all", "전체"],
                          ["road", "로드"],
                          ["trail", "트레일"],
                        ].map(([v, l]) => (
                          <button
                            className={filter === v ? "selected" : ""}
                            aria-pressed={filter === v}
                            onClick={() => setFilter(v)}
                            key={v}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      className="activity-name-search"
                      role="search"
                      aria-label="활동 이름 검색"
                    >
                      <input
                        type="search"
                        aria-label="활동 이름 검색"
                        placeholder="활동 이름 검색"
                        value={activityQuery}
                        onChange={(e) => setActivityQuery(e.target.value)}
                      />
                      {activityQuery && (
                        <button
                          className="text-button"
                          aria-label="검색어 지우기"
                          onClick={() => setActivityQuery("")}
                        >
                          지우기
                        </button>
                      )}
                    </div>
                    {filteredActivities.length || !activities.length ? (
                      activityList(filteredActivities)
                    ) : (
                      <div className="activity-search-empty">
                        <h3>검색 결과가 없습니다.</h3>
                        <p>검색어, 기간 또는 활동 종류를 바꿔보세요.</p>
                        <button
                          className="text-button"
                          onClick={() => {
                            setActivityDates(null);
                            setFilter("all");
                            setActivityQuery("");
                          }}
                        >
                          검색 초기화
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
              {page === "progress" && (
                <>
                  <div className="section-heading">
                    <h2>나의 훈련 추이</h2>
                    <div className="tabs">
                      {[4, 8, 12, "month"].map((n) => (
                        <button
                          key={n}
                          className={range === n ? "selected" : ""}
                          aria-pressed={range === n}
                          onClick={() => setRange(n)}
                        >
                          {n === "month" ? "월간" : `${n}주`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {range === "month" && (
                    <div className="progress-months" aria-label="분석할 월">
                      {[0, -1, -2].map((offset) => {
                        const month = movePeriod(
                          data.today || date(),
                          "month",
                          offset,
                        );
                        return (
                          <button
                            key={offset}
                            className="date-pill"
                            aria-pressed={progressMonth === offset}
                            onClick={() => setProgressMonth(offset)}
                          >
                            {month.slice(0, 4)}년 {Number(month.slice(5, 7))}월
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="stats-row">
                    {[
                      ["누적 거리", num(total(chart, "distance")), "km"],
                      ["상승 고도", num(total(chart, "elevation")), "m"],
                      ["활동 횟수", total(chart, "count"), "회"],
                      [
                        range === "month" ? "활동당 거리" : "주간 평균",
                        num(
                          total(chart, "distance") /
                            (range === "month"
                              ? total(chart, "count") || 1
                              : chart.length),
                        ),
                        "km",
                      ],
                    ].map(([l, v, u]) => (
                      <section key={l} className="card stat">
                        <span>{l}</span>
                        <strong>
                          {v}
                          <small>{u}</small>
                        </strong>
                      </section>
                    ))}
                  </div>
                  <section className="card">
                    <div className="row between">
                      <h3>계획과 실제 달리기</h3>
                      <span className="legend">
                        <i />
                        실제 거리 <i className="pale" />
                        계획 거리
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={270}>
                      <BarChart
                        data={chart}
                        barGap={range === "month" ? 0 : 5}
                        barCategoryGap={range === "month" ? "15%" : "10%"}
                      >
                        <CartesianGrid vertical={false} stroke="#e8ebee" />
                        <XAxis
                          dataKey="label"
                          ticks={chartTicks}
                          interval={range === "month" ? 0 : "preserveEnd"}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis axisLine={false} tickLine={false} width={38} />
                        <Tooltip
                          formatter={(v, n) => [
                            `${num(v)} km`,
                            n === "distance" ? "실제" : "계획",
                          ]}
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="distance"
                          fill="#6985a1"
                          radius={[5, 5, 0, 0]}
                        />
                        <Bar
                          isAnimationActive={false}
                          dataKey="planned"
                          fill="#dae4ed"
                          radius={[5, 5, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </section>
                  <div className="analysis-grid">
                    <section className="card">
                      <div className="row between analysis-chart-heading">
                        <h3>로드 & 트레일</h3>
                        <span className="legend">
                          <i style={{ background: "#a5bcd1" }} />
                          로드
                          <i style={{ background: "#697a94" }} />
                          트레일
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chart}>
                          <CartesianGrid vertical={false} stroke="#e1e8ef" />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            width={52}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `${num(v)} km`}
                          />
                          <XAxis
                            dataKey="label"
                            ticks={chartTicks}
                            interval={range === "month" ? 0 : "preserveEnd"}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            formatter={(v, n) => [
                              `${num(v)} km`,
                              n === "road" ? "로드" : "트레일",
                            ]}
                          />
                          <Bar
                            isAnimationActive={false}
                            dataKey="road"
                            stackId="a"
                            fill="#a5bcd1"
                            shape={(props) => (
                              <Rectangle
                                {...props}
                                radius={
                                  props.payload?.trail > 0 ? 0 : [5, 5, 0, 0]
                                }
                              />
                            )}
                          />
                          <Bar
                            isAnimationActive={false}
                            dataKey="trail"
                            stackId="a"
                            fill="#697a94"
                            radius={[5, 5, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </section>
                    <section className="card">
                      <h3>
                        {range === "month"
                          ? "일별 상승 고도"
                          : "주간 상승 고도"}
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chart}>
                          <CartesianGrid vertical={false} stroke="#e1e8ef" />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            width={54}
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `${num(v)} m`}
                          />
                          <XAxis
                            dataKey="label"
                            ticks={chartTicks}
                            interval={range === "month" ? 0 : "preserveEnd"}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            formatter={(v) => [`${num(v)} m`, "상승 고도"]}
                          />
                          <Area
                            isAnimationActive={false}
                            type="monotone"
                            dataKey="elevation"
                            stroke="#697a94"
                            fill="#e2eaf3"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                      <p className="helper">
                        원본 활동에 기록된 누적 상승 고도를 합산합니다.
                      </p>
                    </section>
                  </div>
                </>
              )}
              {page === "goals" && (
                <TrainingPlans
                  key={`${mode}-${planningRevision}`}
                  api={api}
                  hasAppliedPlan={data.hasAppliedPlan}
                  onReview={(draftId) =>
                    setModal({ kind: "generate", draftId })
                  }
                  onContinue={() =>
                    setModal({ kind: "generate", continue: true })
                  }
                  sessions={sessions}
                  activities={activities}
                  goals={goals}
                  today={data.today}
                  onCreate={(g) =>
                    setModal({
                      kind: "generate",
                      ...(g ? { goalId: g.id, type: g.type } : {}),
                    })
                  }
                  onEditGoal={(g) => setModal({ kind: "goal", item: g })}
                  onOpen={(s) => {
                    const a = activities.find((a) => a.id === s.activityId);
                    if (a) openActivity(a);
                    else setModal({ kind: "session", item: s });
                  }}
                />
              )}
              {(page === "coach" || coachVisited) && (
                <div
                  className="coach-page"
                  hidden={page !== "coach"}
                  inert={page !== "coach"}
                >
                  <FeatureBoundary label="러닝 코치">
                    <Coach
                      key={mode}
                      dataset={mode}
                      targetConversation={coachTarget}
                      conversations={data.conversations || []}
                      messages={data.messages}
                      api={api}
                      refresh={refresh}
                      connected={status?.codex.connected}
                      goals={goals.length}
                      activities={[...activities].sort((a, b) =>
                        b.date.localeCompare(a.date),
                      )}
                      onSettings={() => go("settings")}
                    />
                  </FeatureBoundary>
                </div>
              )}
              {page === "settings" && (
                <Settings
                  status={status}
                  api={api}
                  busy={busy}
                  act={act}
                  mode={mode}
                  setMode={setMode}
                  sync={data.sync}
                  access={data.access}
                  onStatus={setStatus}
                  onTrash={() => setModal({ kind: "trash" })}
                />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>STRIDE · ONE RUN AT A TIME.</span>
            <span>
              {mode === "demo" ? "샘플 데이터" : "나의 기록"} · Asia/Seoul · km
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle weight="regular" size={20} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={
            {
              goal: modal.item ? "러닝 목표 수정" : "새로운 러닝 목표",
              session: modal.item ? "훈련 상세" : "훈련 추가",
              activity: modal.item ? "활동 수정" : "달리기 직접 기록",
              generate: "나에게 맞는 훈련 계획",
              detail: sessions.some((s) => s.activityId === modal.item?.id)
                ? "완료한 훈련"
                : "달리기 상세",
              trash: "삭제한 항목 보관함",
            }[modal.kind]
          }
          wide={["generate", "detail", "session"].includes(modal.kind)}
          className={modal.kind === "detail" ? "activity-detail-modal" : ""}
          onClose={() => setModal(null)}
        >
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {["goal", "session", "activity"].includes(modal.kind) && (
            <EntryForm
              key={modal.item?.id || modal.kind}
              modal={modal}
              goals={goals}
              activities={activities}
              sessions={sessions}
              today={data?.today || date()}
              busy={busy}
              onSave={(value, requestId) =>
                act(
                  () =>
                    api(
                      `/${modal.kind === "activity" ? "activities" : modal.kind + "s"}${modal.item ? "/" + modal.item.id : ""}`,
                      value,
                      modal.item ? "PUT" : "POST",
                      modal.item ? undefined : requestId,
                    ),
                  "저장되었습니다.",
                )
              }
              onDelete={() =>
                act(
                  () =>
                    api(
                      `/${modal.kind === "activity" ? "activities" : modal.kind + "s"}/${modal.item.id}`,
                      null,
                      "DELETE",
                    ),
                  "삭제되었습니다. 원본은 보관함에 보존됩니다.",
                )
              }
              onLink={(id) =>
                act(
                  () =>
                    api(`/sessions/${modal.item.id}/link`, { activityId: id }),
                  "활동을 연결했습니다.",
                )
              }
              onUnlink={() =>
                act(
                  () => api(`/sessions/${modal.item.id}/link`, null, "DELETE"),
                  "활동 연결을 해제했습니다.",
                )
              }
            />
          )}
          {modal.kind === "generate" && (
            <FeatureBoundary label="훈련 계획 상담">
              <PlanCoach
                dataset={mode}
                goals={goals}
                modal={modal}
                today={data.today}
                busy={busy}
                api={api}
                onBackground={() => {
                  setPlanningRevision((n) => n + 1);
                  setModal(null);
                  setPage("goals");
                }}
                onDiscard={() => setModal(null)}
                onApply={(id) =>
                  act(
                    () => api("/plan/coaching-apply", { id }),
                    "훈련 계획을 추가했습니다.",
                  )
                }
                setError={setError}
              />
            </FeatureBoundary>
          )}
          {modal.kind === "trash" && (
            <TrashView
              api={api}
              busy={busy}
              onRestore={(id) =>
                act(() => api(`/trash/${id}/restore`, {}), "복원했습니다.")
              }
            />
          )}{" "}
          {modal.kind === "detail" && (
            <>
              {sessions.find((s) => s.activityId === modal.item.id) && (
                <WorkoutSummary
                  session={sessions.find((s) => s.activityId === modal.item.id)}
                  onEdit={() =>
                    setModal({
                      kind: "session",
                      item: sessions.find(
                        (s) => s.activityId === modal.item.id,
                      ),
                    })
                  }
                />
              )}
              {sessions.some((s) => s.activityId === modal.item.id) && (
                <h2 className="completed-activity-heading">활동 내용</h2>
              )}
              <ActivityDetail
                item={modal.item}
                api={api}
                key={`${mode}-${modal.item.id}`}
                onConversationChange={refresh}
                onOpenCoach={(conversation) => {
                  setCoachTarget({
                    id: conversation.id,
                    archived: !!conversation.archived,
                    nonce: Date.now(),
                  });
                  setModal(null);
                  go("coach");
                }}
                onRefresh={() => openActivity(modal.item, true)}
                detail={details?.id === modal.item.id ? details : null}
                onEdit={() => setModal({ kind: "activity", item: modal.item })}
                sessions={sessions}
                onLink={(id) =>
                  act(
                    () =>
                      api(`/sessions/${id}/link`, {
                        activityId: modal.item.id,
                      }),
                    "훈련과 연결했습니다.",
                  )
                }
                busy={busy}
              />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function EntryForm({
  modal,
  goals,
  activities,
  sessions,
  today,
  busy,
  onSave,
  onDelete,
  onLink,
  onUnlink,
}) {
  const kind = modal.kind;
  const [createRequestId] = useState(() => crypto.randomUUID());
  const [v, setV] = useState(
    modal.item || {
      name: "",
      title: "",
      date: modal.date || today,
      type: kind === "session" ? "easy" : "road",
      distance: kind === "goal" ? 42.195 : kind === "session" ? null : "",
      duration: kind === "activity" ? "" : null,
      elevation: kind === "goal" ? 0 : null,
      workout:
        kind === "session"
          ? { steps: [], totalKind: "unknown", amountBasis: "distance" }
          : undefined,
      targetMinutes: 240,
      hr: "",
      rpe: "",
      notes: "",
      goalId: goals[0]?.id || null,
    },
  );
  const workoutDrafts = useRef({});
  const [link, setLink] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k, value) => setV({ ...v, [k]: value });
  const connected = activities.find((a) => a.id === modal.item?.activityId);
  const choices = activities
    .filter(
      (a) =>
        !sessions.some((s) => s.activityId === a.id && s.id !== modal.item?.id),
    )
    .sort(
      (a, b) =>
        Math.abs(new Date(a.date) - new Date(v.date)) -
        Math.abs(new Date(b.date) - new Date(v.date)),
    );
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          const values = { ...v };
          if (kind === "session")
            for (const key of ["distance", "duration", "elevation"])
              values[key] =
                v[key] === "" || v[key] == null ? null : Number(v[key]);
          if (kind === "activity") {
            values.hr = optionalNumber(v.hr);
            values.rpe = optionalNumber(v.rpe);
            values.elevation = optionalNumber(v.elevation);
          }
          if (kind === "goal")
            values.targetMinutes = optionalNumber(v.targetMinutes);
          onSave(values, createRequestId);
        }}
      >
        <Field
          label={
            kind === "goal"
              ? "목표 이름"
              : kind === "session"
                ? "훈련 이름"
                : "활동 이름"
          }
        >
          <input
            required
            maxLength={100}
            value={kind === "session" ? v.title : v.name}
            placeholder={
              kind === "goal" ? "예: 가을 마라톤 Sub 4" : "예: 한강 이지 러닝"
            }
            onChange={(e) =>
              set(kind === "session" ? "title" : "name", e.target.value)
            }
          />
        </Field>
        <div className="form-grid">
          <Field label="날짜">
            <input
              required
              type="date"
              value={v.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="종류">
            <select
              value={v.type}
              onChange={(e) => {
                if (kind !== "session") return set("type", e.target.value);
                const type = e.target.value;
                workoutDrafts.current[v.type] = v.workout;
                setV({
                  ...v,
                  type,
                  workout: workoutDrafts.current[type] || {
                    steps: templateSteps(type),
                    amountBasis:
                      type === "rest"
                        ? "rest"
                        : [
                              "interval",
                              "tempo",
                              "hill",
                              "repetition",
                              "marathon",
                            ].includes(type)
                          ? "steps"
                          : "distance",
                    totalKind: "unknown",
                  },
                });
              }}
            >
              {(kind === "session"
                ? Object.keys(workoutTypes)
                : ["road", "trail"]
              ).map((t) => (
                <option value={t} key={t}>
                  {types[t]}
                </option>
              ))}
            </select>
          </Field>
          {kind === "session" && (
            <div className="recipe-form-span">
              <WorkoutRecipePicker key={v.type} session={v} onChange={setV} />
            </div>
          )}
          <Field
            label={
              kind === "session"
                ? "전체 예정 거리 (km · 미정이면 비움)"
                : "거리 (km)"
            }
          >
            <input
              required={kind !== "session"}
              type="number"
              min={kind === "session" ? 0 : 0.1}
              max={kind === "session" ? 300 : 500}
              step="0.001"
              value={v.distance ?? ""}
              onChange={(e) => set("distance", e.target.value)}
            />
          </Field>
          <Field
            label={
              kind === "session"
                ? "전체 예정 상승 고도 (m · 선택)"
                : kind === "activity"
                  ? "상승 고도 (m · 선택)"
                  : "상승 고도 (m)"
            }
          >
            <input
              required={kind === "goal"}
              type="number"
              min="0"
              max="30000"
              value={v.elevation ?? ""}
              onChange={(e) => set("elevation", e.target.value)}
            />
          </Field>
          {kind === "goal" ? (
            <Field label="목표 시간 (분 · 비워두면 완주)">
              <input
                type="number"
                min="1"
                max="10000"
                value={v.targetMinutes ?? ""}
                onChange={(e) => set("targetMinutes", e.target.value)}
              />
            </Field>
          ) : kind === "session" ? (
            <div className="workout-field">
              <span>전체 예정 시간 · 미정이면 비움</span>
              <DurationFields
                label="전체 예정 시간"
                value={
                  v.duration == null || v.duration === ""
                    ? null
                    : Number(v.duration) * 60
                }
                onChange={(seconds) =>
                  set("duration", seconds == null ? null : seconds / 60)
                }
              />
            </div>
          ) : (
            <Field
              label={
                kind === "session"
                  ? "전체 예정 시간 (분 · 미정이면 비움)"
                  : "운동 시간 (분)"
              }
            >
              <input
                required={kind !== "session"}
                type="number"
                min={kind === "session" ? 0 : 0.1}
                max="3000"
                step="0.1"
                value={v.duration ?? ""}
                onChange={(e) => set("duration", e.target.value)}
              />
            </Field>
          )}
          {kind === "session" && (
            <Field label="연결할 목표">
              <select
                value={v.goalId || ""}
                onChange={(e) => set("goalId", e.target.value || null)}
              >
                <option value="">목표 없음</option>
                {goals.map((g) => (
                  <option value={g.id} key={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {kind === "activity" && (
            <>
              <Field label="평균 심박 (선택)">
                <input
                  type="number"
                  min="20"
                  max="250"
                  value={v.hr ?? ""}
                  onChange={(e) => set("hr", e.target.value)}
                />
              </Field>
              <Field label="운동 자각도 RPE (1–10 · 선택)">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={v.rpe ?? ""}
                  onChange={(e) => set("rpe", e.target.value)}
                />
              </Field>
            </>
          )}
        </div>
        {kind === "session" && <WorkoutFields session={v} onChange={setV} />}
        {kind !== "goal" && (
          <Field label="훈련 메모">
            <textarea
              rows={3}
              maxLength={3000}
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="운동 구성이나 몸의 느낌을 남겨보세요."
            />
          </Field>
        )}
        <div className="form-actions">
          {modal.item && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => setConfirmDelete(!confirmDelete)}
            >
              <Trash />
              삭제
            </button>
          )}
          <button className="button primary" disabled={busy}>
            <Check />
            {busy ? "저장 중…" : "저장하기"}
          </button>
        </div>
      </form>
      {confirmDelete && (
        <div className="delete-confirm">
          <span>이 항목을 삭제할까요? 원본은 로컬 보관함에 보존됩니다.</span>
          <button
            className="button"
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
          >
            취소
          </button>
          <button className="button" disabled={busy} onClick={onDelete}>
            삭제하기
          </button>
        </div>
      )}
      {kind === "session" &&
        modal.item &&
        (connected || (v.type !== "rest" && modal.item.type !== "rest")) && (
          <div className="link-panel">
            <h3>
              <LinkSimple size={19} />
              실제 활동 연결
            </h3>
            {connected ? (
              <>
                <p>
                  {connected.name} · {num(connected.distance)} km
                </p>
                <div className="comparison">
                  <span>
                    거리 차이{" "}
                    <strong>
                      {measurementDifference(connected.distance, v.distance) ==
                      null
                        ? "비교 불가"
                        : `${num(measurementDifference(connected.distance, v.distance))} km`}
                    </strong>
                  </span>
                  <span>
                    시간 차이{" "}
                    <strong>
                      {formatMinutes(
                        measurementDifference(connected.duration, v.duration),
                        { signed: true, unknown: "비교 불가" },
                      )}
                    </strong>
                  </span>
                  <span>
                    고도 차이{" "}
                    <strong>
                      {measurementDifference(
                        connected.elevation,
                        v.elevation,
                      ) == null
                        ? "비교 불가"
                        : `${num(measurementDifference(connected.elevation, v.elevation))} m`}
                    </strong>
                  </span>
                </div>
                <button className="button" disabled={busy} onClick={onUnlink}>
                  연결 해제
                </button>
              </>
            ) : (
              <>
                <p>
                  날짜가 가까운 활동부터 표시합니다. 하나의 활동은 하나의 훈련에
                  연결됩니다.
                </p>
                <div className="row">
                  <select
                    aria-label="연결할 활동"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                  >
                    <option value="">활동 선택</option>
                    {choices.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.date} · {a.name} · {num(a.distance)} km
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!link || busy}
                    className="button primary"
                    onClick={() => onLink(link)}
                  >
                    연결
                  </button>
                </div>
              </>
            )}
          </div>
        )}
    </>
  );
}
function ActivityDetail({
  onOpenCoach,
  onConversationChange,
  item,
  api,
  detail,
  sessions,
  onLink,
  onEdit,
  onRefresh,
  busy,
}) {
  const [selected, setSelected] = useState("");
  const linked = sessions.find((s) => s.activityId === item.id);
  return (
    <>
      <div className="detail-title">
        <h2>
          <ActivityIcon activity={item} size={24} />
          {item.name}
        </h2>
        <p className="activity-meta">
          <Tag tone="green">{types[item.type]}</Tag>
          <span className="activity-meta-date">{item.date}</span>
          <span>
            ·{" "}
            {item.source === "garmin"
              ? "Garmin"
              : item.source === "intervals"
                ? "Intervals.icu"
                : item.source === "demo"
                  ? "데모 활동"
                  : "직접 기록"}
          </span>
        </p>
      </div>
      <button className="text-button" onClick={onEdit}>
        활동 수정 및 메모 <ArrowUpRight />
      </button>
      <div className="detail-metrics">
        {[
          ["거리", num(item.distance), "km"],
          ["시간", minutes(item.duration), ""],
          ["평균 페이스", pace(item.duration / item.distance), "/km"],
          [
            "상승 고도",
            item.elevation == null ? "—" : num(item.elevation),
            "m",
          ],
          ["평균 심박", item.hr || "—", "bpm"],
          ["RPE", item.rpe || "—", "/10"],
        ].map(([l, n, u]) => (
          <div key={l}>
            <small>{l}</small>
            <strong>
              {n}
              <span>{u}</span>
            </strong>
          </div>
        ))}
      </div>
      {!detail && <p className="helper">상세 데이터를 불러오는 중…</p>}
      <FeatureBoundary label="AI 리뷰">
        <ActivityReview
          item={item}
          api={api}
          ready={!!detail}
          onConversationChange={onConversationChange}
          onOpenCoach={onOpenCoach}
        />
      </FeatureBoundary>
      {detail && (
        <FeatureBoundary label="상세 분석">
          <ActivityAnalysis
            item={item}
            detail={detail}
            linked={linked}
            onRefresh={onRefresh}
          />
        </FeatureBoundary>
      )}
      <div className="link-panel">
        <h3>
          <LinkSimple size={19} />
          계획과 연결
        </h3>
        {linked ? (
          <p>
            <CheckCircle size={18} /> {linked.date} · {linked.title}과 연결됨
          </p>
        ) : (
          <div className="row">
            <select
              aria-label="연결할 훈련"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">훈련 선택</option>
              {sessions
                .filter((s) => !s.activityId && s.type !== "rest")
                .sort(
                  (a, b) =>
                    Math.abs(new Date(a.date) - new Date(item.date)) -
                    Math.abs(new Date(b.date) - new Date(item.date)),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} · {s.title} ·{" "}
                    {s.distance == null ? "거리 미정" : `${num(s.distance)} km`}
                  </option>
                ))}
            </select>
            <button
              className="button primary"
              disabled={!selected || busy}
              onClick={() => onLink(selected)}
            >
              연결
            </button>
          </div>
        )}
      </div>
    </>
  );
}
function Settings({
  status,
  api,
  busy,
  act,
  mode,
  setMode,
  sync,
  onStatus,
  onTrash,
  access,
}) {
  const [from, setFrom] = useState(date(-90)),
    [to, setTo] = useState(date());
  const [importing, setImporting] = useState(false);
  return (
    <div className="settings-grid">
      <section className="card settings-card">
        <ConnectionSettings
          kind="garmin"
          status={status}
          api={api}
          busy={busy}
          act={act}
          onStatus={onStatus}
          access={access}
        />
        <section
          className="settings-section"
          aria-labelledby="sync-settings-title"
        >
          <h3 id="sync-settings-title">활동 가져오기</h3>
          <div className="settings-fields">
            <Field label="시작일">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="종료일">
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <div className="settings-actions">
            <p className="settings-caption">선택한 기간의 기록을 가져옵니다.</p>
            {mode === "demo" ? (
              <button className="button" onClick={() => setMode("live")}>
                실제 기록 모드로 전환 <ArrowRight />
              </button>
            ) : (
              <button
                className="button primary"
                disabled={busy || !status?.garmin?.configured}
                onClick={() =>
                  act(
                    async () => {
                      setImporting(true);
                      try {
                        await api("/sync", { oldest: from, newest: to });
                      } finally {
                        setImporting(false);
                      }
                    },
                    "동기화를 완료했습니다.",
                    false,
                  )
                }
              >
                <ArrowsClockwise className={importing ? "spin" : ""} />
                {importing ? "동기화 중…" : "지금 동기화"}
              </button>
            )}
          </div>
          {sync && (
            <p className="settings-caption">
              {sync.source === "garmin"
                ? "Garmin 최근 시도"
                : "이전 Intervals.icu 동기화"}
              : {new Date(sync.at).toLocaleString("ko-KR")}
              <br />
              {sync.error || `${sync.count}개 활동 가져옴`}
            </p>
          )}
        </section>
      </section>
      <div className="settings-stack">
        <section className="card settings-card">
          <ConnectionSettings
            kind="codex"
            status={status}
            api={api}
            busy={busy}
            act={act}
            onStatus={onStatus}
            access={access}
          />
        </section>
        <section className="card settings-card settings-data-card">
          <div className="settings-heading">
            <h2>데이터 관리</h2>
            <span className="settings-meta">
              {mode === "demo" ? "데모 데이터" : "개인 기록"}
            </span>
          </div>
          <p className="settings-description">내 기록은 이 Mac에 저장됩니다.</p>
          <div className="settings-data-body">
            <div className="settings-menu">
              <button
                className="settings-menu-row"
                disabled={busy}
                onClick={() =>
                  act(
                    async () => {
                      const value = await api("/export");
                      const url = URL.createObjectURL(
                        new Blob([JSON.stringify(value, null, 2)], {
                          type: "application/json",
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `stride-${mode}-${date()}.json`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    },
                    "백업을 다운로드했습니다.",
                    false,
                  )
                }
              >
                <DownloadSimple />
                <span>
                  <strong>기록 내보내기</strong>
                  <small>열람용 JSON 파일 · 앱으로 가져오기 미지원</small>
                </span>
                <ArrowRight />
              </button>
              <button className="settings-menu-row" onClick={onTrash}>
                <Trash />
                <span>
                  <strong>삭제한 항목 복원</strong>
                  <small>삭제한 활동과 훈련을 확인하고 복원</small>
                </span>
                <ArrowRight />
              </button>
            </div>
            {access?.url && (
              <section className="settings-section settings-remote">
                <h3>다른 기기에서 접속</h3>
                <a className="settings-address" href={access.url}>
                  <span>{access.url.replace(/^https?:\/\//, "")}</span>
                  <ArrowUpRight />
                </a>
                <p className="settings-caption">
                  휴대폰에서 같은 계정으로 Tailscale을 연결한 뒤 위 주소를
                  여세요. Mac이 켜져 있어야 합니다.
                </p>
              </section>
            )}
          </div>
          <PwaInstall />
        </section>
      </div>
    </div>
  );
}

function TrashView({ api, busy, onRestore }) {
  const [items, setItems] = useState(null),
    [err, setErr] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setErr("");
    api("/trash")
      .then((result) => {
        if (active) setItems(result);
      })
      .catch((e) => {
        if (active) setErr(e.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <div>
      {err && (
        <div className="error" role="alert">
          <p>{err}</p>
          <button className="button" onClick={() => setAttempt((n) => n + 1)}>
            다시 불러오기
          </button>
        </div>
      )}
      {err ? null : !items ? (
        <p>불러오는 중…</p>
      ) : !items.length ? (
        <Empty title="보관함이 비어 있어요" icon={Archive}>
          삭제한 목표, 훈련, 활동을 여기서 복원할 수 있습니다.
        </Empty>
      ) : (
        items.map((x) => (
          <div key={x.id} className="activity-row">
            <div className="activity-name">
              <strong>{x.entry.name || x.entry.title}</strong>
              <small>
                {x.entry.date} ·{" "}
                {x.kind === "goal"
                  ? "목표"
                  : x.kind === "session"
                    ? "훈련"
                    : "활동"}
              </small>
            </div>
            <button
              className="button"
              style={{ marginLeft: "auto" }}
              disabled={busy}
              onClick={() => onRestore(x.id)}
            >
              복원
            </button>
          </div>
        ))
      )}
      <p className="helper">복원 후 활동과 훈련의 연결은 다시 선택하세요.</p>
    </div>
  );
}
