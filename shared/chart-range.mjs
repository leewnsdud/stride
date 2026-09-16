// Display bounds only: retain original values for tooltips and stored records.
export function activityAxis(values, axis = "distance") {
  const finite = values.filter((v) => Number.isFinite(v) && v >= 0);
  const max = finite.reduce((largest, value) => Math.max(largest, value), 0);
  const target = max / 5;
  const magnitude = 10 ** Math.floor(Math.log10(target || 1));
  const candidates = axis === "time"
    ? [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400]
    : [1, 2, 2.5, 5, 10].map((n) => n * magnitude);
  // Small GPS overshoots (e.g. 10.03 km) keep the same readable 2 km grid.
  const step = candidates.find((n) => n * 1.05 >= target) || Math.ceil(target / 86400) * 86400;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => Number((i * step).toFixed(6)));
  return { domain: [0, max || step], ticks, step };
}

export function paceRange(values) {
  const a = values
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!a.length)
    return { domain: [3, 8], ticks: [3, 4, 5, 6, 7, 8], clipped: false };
  const q = (p) => a[Math.floor((a.length - 1) * p)];
  const low = a.length >= 20 ? q(0.05) : a[0],
    high = a.length >= 20 ? q(0.95) : a.at(-1);
  const pad = Math.max(0.25, (high - low) * 0.15);
  const step = high - low < 2 ? 0.5 : high - low < 5 ? 1 : 2;
  const min = Math.max(0.25, Math.floor((low - pad) / step) * step),
    max = Math.max(min + step, Math.ceil((high + pad) / step) * step);
  const ticks = [];
  for (let x = Math.ceil(min / step) * step; x <= max; x += step)
    if (x > 0) ticks.push(x);
  return { domain: [min, max], ticks, clipped: a[0] < min || a.at(-1) > max };
}
