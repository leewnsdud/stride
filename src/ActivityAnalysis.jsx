import AnimatedDetails from "./AnimatedDetails.jsx";
import ActivityMetricChart from "./ActivityMetricChart.jsx";
import { formatDuration, formatMinutes, formatPace } from "../shared/time.mjs";
import ActivityInsights from "./ActivityInsights.jsx";
import FeatureBoundary from "./FeatureBoundary.jsx";
import { zoneDistribution } from "../shared/zone-distribution.mjs";
import React, { useState, useMemo } from "react";
const RouteMap = React.lazy(() => import("./RouteMap.jsx"));
const number = (v, d = 1) =>
  typeof v === "number" && Number.isFinite(v)
    ? v.toLocaleString("ko-KR", { maximumFractionDigits: d })
    : "—";
const pace = formatPace;
const duration = formatDuration;
const metrics = [
  ["pace", "페이스", "분/km", "#76895a"],
  ["hr", "심박", "bpm", "#b77760"],
  ["altitude", "고도", "m", "#8d997a"],
  ["cadence", "케이던스", "spm", "#8a7a99"],
  ["power", "러닝 파워", "W", "#b38c43"],
  ["gap", "경사 보정 페이스", "분/km", "#657b8d"],
  ["strideLength", "보폭", "cm", "#7c948a"],
  ["groundContactTime", "지면 접촉 시간", "ms", "#aa8277"],
  ["verticalOscillation", "수직 진폭", "cm", "#8b86ac"],
  ["verticalRatio", "수직 비율", "%", "#78959b"],
  ["balance", "왼쪽 접촉 균형", "%", "#9e8e6f"],
  ["respiration", "호흡수", "회/분", "#839aaa"],
  ["stamina", "스태미나", "%", "#7a966e"],
  ["performance", "퍼포먼스 컨디션", "", "#927e8e"],
  ["temperature", "기기 온도", "°C", "#b09075"],
];
export default function ActivityAnalysis({ item, detail, linked, onRefresh }) {
  const [metric, setMetric] = useState("cadence"),
    [axis, setAxis] = useState("distance"),
    [table, setTable] = useState("laps"),
    [hover, setHover] = useState(null);
  const points = useMemo(
    () => detail?.points || legacyPoints(detail?.streams),
    [detail],
  );
  const available = metrics.filter(([key]) =>
    points.some((p) => Number.isFinite(p[key])),
  );
  const s = {
    ...item.stats,
    ...Object.fromEntries(
      Object.entries(detail?.stats || {}).filter(([, v]) => v != null),
    ),
  };
  const rows = table === "laps" ? detail?.laps : detail?.splits;
  const stride = [
    ["케이던스", s.cadence, "spm"],
    ["최대 케이던스", s.maxCadence, "spm"],
    ["평균 파워", s.power, "W"],
    ["최대 파워", s.maxPower, "W"],
    ["보폭", s.strideLength, "cm"],
    ["지면 접촉", s.groundContactTime, "ms"],
    ["수직 진폭", s.verticalOscillation, "cm"],
    ["수직 비율", s.verticalRatio, "%"],
    ["왼쪽 접촉 균형", s.groundContactBalance, "%"],
    ["평균 호흡수", s.respiration, "회/분"],
  ];
  return (
    <div className="activity-analysis">
      {item.source === "demo" && (
        <p className="analysis-notice">
          화면 체험용 샘플입니다. 아래 경로·센서·훈련 효과는 실제 Garmin
          측정값이 아닙니다.
        </p>
      )}
      {item.source === "intervals" && (
        <p className="helper">
          기존 Intervals.icu 기록입니다. Garmin에 로그인한 뒤 같은 기간을 다시
          동기화하면 직접 연동한 상세 기록으로 갱신됩니다.
        </p>
      )}
      {detail?.error && (
        <p role="alert" className="analysis-notice">
          {detail.error}
        </p>
      )}
      <div className="analysis-heading">
        <div>
          <small>RUN EXPLORER</small>
          <h3>한 번의 달리기, 더 깊이</h3>
        </div>
        {item.source === "garmin" && (
          <button className="button" onClick={onRefresh}>
            상세 다시 가져오기
          </button>
        )}
      </div>
      {linked && (
        <section className="analysis-section">
          <h3>계획 대비 수행</h3>
          <div className="analysis-stats">
            <Stat
              label="거리"
              value={`${number(item.distance)} / ${number(linked.distance)}`}
              unit="km"
            />
            <Stat
              label="시간"
              value={`${formatMinutes(item.duration)} / ${formatMinutes(linked.duration)}`}
              unit={item.duration >= 60 ? "시:분:초" : "분:초"}
            />
            <Stat
              label="상승 고도"
              value={`${number(item.elevation)} / ${number(linked.elevation)}`}
              unit="m"
            />
            <Stat
              label="거리 달성"
              value={
                linked.distance > 0
                  ? number((item.distance / linked.distance) * 100, 0)
                  : "—"
              }
              unit="%"
            />
          </div>
          <p className="helper">
            전체 세션 비교입니다. 랩별 목표 페이스가 등록되지 않은 경우 구간
            달성률을 추정하지 않습니다.
          </p>
        </section>
      )}
      {points.filter(
        (p) =>
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lon) &&
          Math.abs(p.lat) < 85.05 &&
          Math.abs(p.lon) <= 180 &&
          !(p.lat === 0 && p.lon === 0),
      ).length > 1 ? (
        <FeatureBoundary label="경로 지도">
          <RouteMap
            points={points}
            hover={hover}
            demo={item.source === "demo"}
          />
        </FeatureBoundary>
      ) : (
        <section className="analysis-section route-section">
          <h3>달린 경로</h3>
          <p className="analysis-empty">
            GPS 경로가 없는 활동입니다. 실내 활동과 위치 미기록 활동에는 지도를
            표시하지 않습니다.
          </p>
        </section>
      )}
      <section className="analysis-section segment-analysis">
        <div className="analysis-toolbar">
          <h3>페이스와 심박</h3>
          <select
            className="analysis-select"
            aria-label="차트 가로축"
            value={axis}
            onChange={(e) => setAxis(e.target.value)}
          >
            <option value="distance">누적 거리 (km)</option>
            <option value="time">경과 시간</option>
          </select>
        </div>
        <div className="segment-charts">
          <ActivityMetricChart
            points={points}
            metric="pace"
            title="페이스"
            unit="/km"
            axis={axis}
            onHover={setHover}
            forceHours={item.duration >= 60}
          />
          <ActivityMetricChart
            points={points}
            metric="hr"
            title="심박"
            unit="bpm"
            color="#b77971"
            axis={axis}
            onHover={setHover}
            forceHours={item.duration >= 60}
          />
        </div>
        <div className="analysis-toolbar">
          <h3>구간별 달리기</h3>
          <div className="metric-tabs">
            <button
              aria-pressed={table === "laps"}
              onClick={() => setTable("laps")}
            >
              시계 랩
            </button>
            <button
              aria-pressed={table === "splits"}
              onClick={() => setTable("splits")}
            >
              1km 스플릿
            </button>
          </div>
        </div>
        <p className="helper">
          {table === "laps"
            ? "시계가 기록한 랩입니다. 워밍업·운동·회복 구분은 원본이 제공할 때 표시합니다."
            : "누적 거리와 타이머 시간으로 보간한 추정값입니다. 기록 공백이 크면 계산하지 않습니다."}
        </p>
        {rows?.length ? (
          <div className="analysis-table-wrap">
            <table className="analysis-table">
              <thead>
                <tr>
                  {[
                    "구간",
                    "거리",
                    "시간",
                    "페이스",
                    "심박",
                    "케이던스",
                    "파워",
                    "상승 / 하강",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      {r.index}{" "}
                      {r.label && r.label !== "lap"
                        ? {
                            warmup: "워밍업",
                            cooldown: "쿨다운",
                            active: "운동",
                            rest: "휴식",
                            recovery: "회복",
                          }[r.label] || r.label
                        : ""}
                    </td>
                    <td>{number(r.distance / 1000, 2)} km</td>
                    <td>{duration(r.duration)}</td>
                    <td>{pace(r.pace)} /km</td>
                    <td>{number(r.hr, 0)}</td>
                    <td>{number(r.cadence, 0)}</td>
                    <td>{number(r.power, 0)}</td>
                    <td>
                      {number(r.ascent, 0)} / {number(r.descent, 0)} m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="analysis-empty">
            이 구간 데이터가 제공되지 않았습니다.
          </p>
        )}
      </section>
      <section className="analysis-section training-response">
        <h3>훈련 효과와 강도 분포</h3>
        <ActivityInsights stats={s} />
        <div className="analysis-columns">
          <Zones title="심박 구간" zones={detail?.hrZones} unit="bpm" />
          <Zones title="파워 구간" zones={detail?.powerZones} unit="W" />
        </div>
      </section>
      <AnimatedDetails className="analysis-section analysis-disclosure">
        <summary>러닝 다이내믹스 · 자세와 리듬</summary>
        <select
          className="analysis-select"
          aria-label="다이내믹스 그래프 지표"
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
        >
          {available
            .filter(
              (x) => !["pace", "hr", "altitude", "temperature"].includes(x[0]),
            )
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
        {available.find((x) => x[0] === metric) && (
          <ActivityMetricChart
            points={points}
            metric={metric}
            title={metrics.find((x) => x[0] === metric)[1]}
            unit={metrics.find((x) => x[0] === metric)[2]}
            color={metrics.find((x) => x[0] === metric)[3]}
            axis={axis}
            forceHours={item.duration >= 60}
          />
        )}

        <p className="helper">
          보폭과 착지 리듬을 함께 확인하세요. 기기·센서가 기록한 값만
          표시합니다.
        </p>
        <div className="analysis-stats">
          {stride
            .filter(([, value]) => Number.isFinite(value))
            .map(([label, value, unit]) => (
              <Stat
                key={label}
                label={label}
                value={number(value)}
                unit={unit}
              />
            ))}
        </div>
      </AnimatedDetails>
      <AnimatedDetails className="analysis-section analysis-disclosure">
        <summary>보조 지표 · 기록 시간과 부하</summary>
        <p className="helper">
          기록 방식이나 기기 데이터를 확인할 때 참고하세요.
        </p>
        <div className="analysis-stats">
          {[
            ["훈련 부하", number(s.trainingLoad), ""],
            ["최대 심박", number(s.maxHr, 0), "bpm"],
            ["칼로리", number(s.calories, 0), "kcal"],
            ["하강 고도", number(s.descent, 0), "m"],
            ["타이머 시간", duration(s.timerSeconds), ""],
            ["이동 시간", duration(s.movingSeconds), ""],
            ["경과 시간", duration(s.elapsedSeconds), ""],
          ].map(([label, value, unit]) => (
            <Stat key={label} label={label} value={value} unit={unit} />
          ))}
        </div>
        <p className="helper">
          Garmin이 계산한 훈련 효과·부하입니다. 타이머 시간은 일시정지를
          제외하며 이동·경과 시간과 다를 수 있습니다.
        </p>
      </AnimatedDetails>
      <AnimatedDetails className="analysis-section analysis-disclosure">
        <summary>지형과 환경 · 고도·노면 조건</summary>
        <ActivityMetricChart
          points={points}
          metric="altitude"
          title="고도"
          unit="m"
          color="#81976d"
          axis={axis}
          onHover={setHover}
          forceHours={item.duration >= 60}
        />

        <div className="analysis-stats">
          <Stat
            label="최저 / 최고 고도"
            value={`${number(s.minElevation, 0)} / ${number(s.maxElevation, 0)}`}
            unit="m"
          />
          <Stat
            label="오르막 표본 시간"
            value={
              detail?.analysis?.coveredSeconds
                ? duration(detail.analysis.uphillSeconds)
                : "—"
            }
            unit=""
          />
          <Stat
            label="내리막 표본 시간"
            value={
              detail?.analysis?.coveredSeconds
                ? duration(detail.analysis.downhillSeconds)
                : "—"
            }
            unit=""
          />
          <Stat
            label="기기 평균 온도"
            value={number(s.temperature)}
            unit="°C"
          />
          <Stat
            label="습도"
            value={number(detail?.weather?.relativeHumidity, 0)}
            unit="%"
          />
        </div>
        <p className="helper">
          오르막·내리막은 유효 GPS 표본의 ±3% 경사 기준 추정입니다. 표본
          공백·GPS 오차가 있어 전체 활동 시간과 다를 수 있습니다. 기기 온도는
          체온의 영향을 받을 수 있습니다.
        </p>
      </AnimatedDetails>
      <AnimatedDetails className="analysis-section analysis-disclosure">
        <summary>데이터 출처 및 제공 항목</summary>
        <p className="helper">
          {detail?.fetchedAt
            ? `상세 수신: ${new Date(detail.fetchedAt).toLocaleString("ko-KR")}`
            : "저장된 기록"}{" "}
          · —는 미기록입니다. Garmin Connect의 상세 응답은 원본 FIT보다 표본이
          줄어들 수 있습니다.
        </p>
        {Object.entries(detail?.errors || {}).map(([k, v]) => (
          <p key={k} className="helper">
            {k}: {v}
          </p>
        ))}
        <div className="metric-tabs">
          {detail?.available?.map((x) => (
            <span key={x.key}>
              {x.key} {x.unit && `(${x.unit})`}
            </span>
          ))}
        </div>
      </AnimatedDetails>
    </div>
  );
}
function Stat({ label, value, unit }) {
  return (
    <div>
      <small>{label}</small>
      <strong>
        {value} <em>{unit}</em>
      </strong>
    </div>
  );
}
function Zones({ title, zones, unit }) {
  const rows = zoneDistribution(zones);
  return (
    <section className="analysis-section">
      <h3>{title}</h3>
      {rows.length ? (
        rows.map((z) => (
          <div className="zone-row" key={z.zone}>
            <span>
              Z{z.zone}
              <small>{z.low != null ? `${z.low}+ ${unit}` : ""}</small>
            </span>
            <div className="zone-track">
              <i style={{ width: `${z.percent ?? 0}%` }} />
            </div>
            <strong>
              {duration(z.seconds)}{" "}
              <small>
                {z.percent == null ? "비율 미정" : `${number(z.percent, 0)}%`}
              </small>
            </strong>
          </div>
        ))
      ) : (
        <p className="analysis-empty">
          Garmin에서 제공한 {title} 데이터가 없습니다.
        </p>
      )}
    </section>
  );
}
function legacyPoints(streams = []) {
  const get = (k) => streams.find((s) => s.type === k)?.data || [];
  return get("time").map((t, i) => ({
    time: t,
    lat: get("latlng")[i]?.[0] ?? get("latitude")[i],
    lon: get("latlng")[i]?.[1] ?? get("longitude")[i],
    hr: get("heartrate")[i],
    altitude: get("altitude")[i],
    distance: get("distance")[i],
    speed: get("velocity_smooth")[i],
    pace:
      get("velocity_smooth")[i] > 0
        ? 1000 / get("velocity_smooth")[i] / 60
        : null,
  }));
}
