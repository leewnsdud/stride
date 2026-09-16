import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatDuration, formatPace } from "../shared/time.mjs";
import { paceRange, activityAxis } from "../shared/chart-range.mjs";
export default function ActivityMetricChart({
  points = [],
  metric,
  title,
  unit,
  color = "#477fb5",
  axis = "distance",
  onHover,
  forceHours = false,
}) {
  const isPace = ["pace", "gap"].includes(metric);
  const values = points
    .map((p) => p[metric])
    .filter((v) => Number.isFinite(v) && (!isPace || v > 0));
  if (!values.length)
    return (
      <div className="metric-chart-empty">
        {title} 시계열이 제공되지 않았습니다.
      </div>
    );
  const range = isPace ? paceRange(values) : null;
  const data = [];
  points.forEach((p, i) => {
    const previous = points[i - 1],
      gap = previous && p.time - previous.time > 30;
    const raw =
      Number.isFinite(p[metric]) && (!isPace || p[metric] > 0)
        ? p[metric]
        : null;
    const row = {
      ...p,
      raw,
      value:
        raw == null
          ? null
          : isPace
            ? Math.max(range.domain[0], Math.min(range.domain[1], raw))
            : raw,
      x:
        axis === "time"
          ? p.time
          : Number.isFinite(p.distance)
            ? p.distance / 1000
            : null,
    };
    if (gap) data.push({ ...row, value: null });
    // Keep missing boundaries and recording gaps while limiting dense rendering.
    if (
      gap ||
      i === points.length - 1 ||
      i % Math.max(1, Math.ceil(points.length / 1500)) === 0 ||
      Number.isFinite(previous?.[metric]) !== Number.isFinite(p[metric])
    )
      data.push(row);
  });
  const clock = (v) => formatDuration(v, { forceHours });
  const xAxis = activityAxis(points.map((p) => axis === "time" ? p.time : p.distance / 1000), axis);
  const display = (v) =>
    isPace ? formatPace(v) : Math.round(v).toLocaleString("ko-KR");
  return (
    <section className="activity-metric-chart" aria-label={`${title} 그래프`}>
      <div className="analysis-toolbar">
        <h4>{title}</h4>
        <small>{unit}</small>
      </div>
      <ResponsiveContainer width="100%" height={205}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          onMouseMove={(e) => {
            if (e?.activeIndex != null) onHover?.(data[Number(e.activeIndex)]);
          }}
          onMouseLeave={() => onHover?.(null)}
        >
          <CartesianGrid vertical={false} stroke="#e1e5e9" />
          <XAxis
            dataKey="x"
            type="number"
            domain={xAxis.domain}
            ticks={xAxis.ticks}
            interval={0}
            tickFormatter={(x) =>
              axis === "time" ? clock(x) : Number(x.toFixed(3))
            }
            unit={axis === "time" ? "" : "km"}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={44}
            reversed={isPace}
            domain={range?.domain || ["auto", "auto"]}
            ticks={range?.ticks}
            allowDataOverflow={isPace}
            tickFormatter={display}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload;
              return active && p?.raw != null ? (
                <div className="insight-tooltip">
                  <strong>
                    {title} {display(p.raw)} {unit}
                  </strong>
                  <span>
                    {axis === "time" ? clock(p.x) : `${p.x?.toFixed(2)} km`}
                  </span>
                  {p.raw !== p.value && (
                    <small>표시 범위 밖 · 원래 측정값</small>
                  )}
                </div>
              ) : null;
            }}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.3}
            strokeWidth={1.5}
            baseValue={isPace ? range.domain[1] : "dataMin"}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      {range?.clipped && (
        <p className="helper">
          일부 극단적인 페이스는 축 경계에 표시합니다. 터치하면 원래 값을 확인할
          수 있습니다.
        </p>
      )}
    </section>
  );
}
