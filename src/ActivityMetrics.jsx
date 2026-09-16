import React from "react";
import { formatMinutes } from "../shared/time.mjs";
const amount = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
export default function ActivityMetrics({ activity: a, compact = false }) {
  const seconds =
    a.distance > 0 && a.duration > 0
      ? Math.round((a.duration / a.distance) * 60)
      : null;
  const pace =
    seconds == null
      ? "—"
      : `${Math.floor(seconds / 60)}′${String(seconds % 60).padStart(2, "0")}″`;
  return (
    <span className={`run-metrics${compact ? " is-compact" : ""}`}>
      <span className="run-distance">
        {amount(a.distance)} <small>km</small>
      </span>
      {!compact && (
        <span className="run-secondary">
          <span aria-label={`시간 ${formatMinutes(a.duration)}`}>
            {formatMinutes(a.duration)}
          </span>
          <span aria-label={`페이스 ${pace} /km`}>
            {pace}
            <small>/km</small>
          </span>
        </span>
      )}
    </span>
  );
}
