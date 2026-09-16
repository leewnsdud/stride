// Stored activity/session durations use minutes; Garmin detail durations use seconds.
// Round once before splitting to avoid 59:60 and preserve fractional-minute records.
export function formatDuration(
  seconds,
  { unknown = "—", signed = false, forceHours = false } = {},
) {
  if (seconds == null || seconds === "" || !Number.isFinite(Number(seconds)))
    return unknown;
  const value = Number(seconds);
  if (value < 0 && !signed) return unknown;
  const total = Math.round(Math.abs(value));
  const sign = signed && total ? (value < 0 ? "−" : "+") : "";
  if (total < 3600 && !forceHours)
    return `${sign}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  return `${sign}${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
export function formatMinutes(minutes, options) {
  return formatDuration(
    minutes == null || minutes === "" ? null : Number(minutes) * 60,
    options,
  );
}
export function formatPace(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const s = Math.round(minutes * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
