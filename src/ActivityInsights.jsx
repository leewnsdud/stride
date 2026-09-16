import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartBar } from "./icons.jsx";
import { formatDuration, formatPace } from "../shared/time.mjs";

export default function ActivityInsights({
  stats = {},
  laps = [],
  showLaps = false,
}) {
  const valid = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const paced = laps
    .filter((l) => valid(l.pace) && l.pace > 0)
    .map((l) => ({ ...l, name: `랩 ${l.index}` }));
  const effects = [
    { name: "유산소", value: stats.aerobicEffect, color: "#547b46" },
    { name: "무산소", value: stats.anaerobicEffect, color: "#b78959" },
  ].filter((x) => valid(x.value) && x.value <= 5);
  if (!(showLaps && paced.length) && !effects.length) return null;
  return (
    <section className="activity-insights" aria-label="활동 인사이트">
      {!showLaps && (
        <>
          <div className="analysis-heading">
            <div>
              <small>ACTIVITY INSIGHTS</small>
              <h3>
                {showLaps ? "랩별 페이스 분석" : "이번 달리기의 훈련 반응"}
              </h3>
            </div>
            <span className="tag">시계 기록 기준</span>
          </div>
        </>
      )}
      <div className="insight-grid">
        {effects.length > 0 && (
          <section className="insight-panel">
            <h3>훈련 효과</h3>
            <p className="helper">Garmin이 제공한 효과 · 0–5 척도</p>
            <div className="effect-bars">
              {effects.map((e) => (
                <div key={e.name}>
                  <div className="row between">
                    <span>{e.name}</span>
                    <strong>
                      {e.value.toFixed(1)} <small>/ 5</small>
                    </strong>
                  </div>
                  <div
                    className="insight-track effect-track"
                    role="meter"
                    aria-label={e.name}
                    aria-valuemin={0}
                    aria-valuemax={5}
                    aria-valuenow={e.value}
                  >
                    <i
                      style={{
                        width: `${(e.value / 5) * 100}%`,
                        background: e.color,
                      }}
                    />
                  </div>
                  <div className="scale-labels">
                    <span>0</span>
                    <span>1</span>
                    <span>2</span>
                    <span>3</span>
                    <span>4</span>
                    <span>5</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      {showLaps && paced.length > 0 && (
        <section className="insight-panel lap-visual">
          <div className="analysis-toolbar">
            <h3>
              <ChartBar size={19} weight="regular" /> 랩별 페이스 비교
            </h3>
            <span className="tag">분:초 / km</span>
          </div>
          <p className="helper">
            막대가 짧을수록 빠른 페이스입니다. 거리·지형·워밍업 여부가 다른 랩은
            함께 고려하세요.
          </p>
          <div
            className="lap-chart-scroll"
            tabIndex={0}
            aria-label="랩별 페이스 차트, 많은 랩은 가로로 스크롤"
          >
            <div
              style={{
                width: "100%",
                minWidth: Math.max(300, paced.length * 38),
                height: 210,
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={paced}
                  margin={{ top: 16, right: 10, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="#e5e6e5"
                    strokeDasharray="2 5"
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(v) => (v === 0 ? "0:00" : formatPace(v))}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#eef0ee" }}
                    content={({ active, payload }) => {
                      const l = payload?.[0]?.payload;
                      return active && l ? (
                        <div className="insight-tooltip">
                          <strong>{l.name}</strong>
                          <span>{formatPace(l.pace)} /km</span>
                          <span>
                            {(l.distance / 1000).toFixed(2)} km ·{" "}
                            {formatDuration(l.duration)}
                          </span>
                          {valid(l.hr) && (
                            <span>평균 심박 {Math.round(l.hr)} bpm</span>
                          )}
                        </div>
                      ) : null;
                    }}
                  />
                  <Bar
                    dataKey="pace"
                    radius={[6, 6, 2, 2]}
                    maxBarSize={32}
                    isAnimationActive={false}
                  >
                    {paced.map((l, i) => (
                      <Cell
                        key={i}
                        fill={
                          l.label === "recovery" || l.label === "rest"
                            ? "#c6ccd0"
                            : "#81a777"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="helper">
            정확한 수치와 심박·파워는 아래 구간별 달리기 표에서 확인할 수
            있습니다.
          </p>
        </section>
      )}
    </section>
  );
}
