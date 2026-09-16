// Explicit demo-only illustrations. Never used for live records or connection status.
import { kilometerSplits, analyzePoints } from "./metrics.mjs";
export function demoDetail(activity) {
  const duration = activity.duration * 60,
    meters = activity.distance * 1000;
  const points = Array.from({ length: 361 }, (_, i) => {
    const t = i / 360,
      time = t * duration,
      speed = (meters / duration) * (1 + 0.08 * Math.sin(i / 15));
    return {
      time,
      timer: time,
      distance: t * meters,
      pace: 1000 / speed / 60,
      speed,
      hr: Math.round((activity.hr || 140) + 9 * Math.sin(i / 34)),
      altitude: 30 + 20 * Math.sin(i / 70),
      cadence: 174 + 4 * Math.sin(i / 17),
      power: 235 + 20 * Math.sin(i / 15),
      strideLength: 103 + 4 * Math.sin(i / 15),
      groundContactTime: 252 + 8 * Math.sin(i / 30),
      verticalOscillation: 8.1 + 0.4 * Math.sin(i / 10),
      verticalRatio: 7.8 + 0.3 * Math.sin(i / 20),
      balance: 50 + 0.4 * Math.sin(i / 20),
      lat: 37.52 + 0.018 * Math.sin(t * Math.PI * 2),
      lon: 126.97 + 0.042 * t,
      stamina: 100 - 25 * t,
    };
  });
  const splits = kilometerSplits(points);
  return {
    id: activity.id,
    points,
    splits,
    laps: splits.map((x, i) => ({
      ...x,
      label:
        i === 0 ? "warmup" : i === splits.length - 1 ? "cooldown" : "active",
      hr: 142 + i,
      cadence: 174,
      power: 238,
      ascent: 4,
      descent: 3,
    })),
    stats: {
      timerSeconds: duration,
      movingSeconds: duration - 10,
      elapsedSeconds: duration + 30,
      maxHr: 159,
      cadence: 174,
      maxCadence: 184,
      power: 238,
      maxPower: 295,
      strideLength: 103,
      groundContactTime: 252,
      verticalOscillation: 8.1,
      verticalRatio: 7.8,
      groundContactBalance: 50,
      aerobicEffect: 3.1,
      anaerobicEffect: 0.3,
      trainingLoad: 95,
      calories: 480,
      descent: 48,
      minElevation: 10,
      maxElevation: 50,
    },
    hrZones: [
      { zone: 1, seconds: duration * 0.1, low: 100 },
      { zone: 2, seconds: duration * 0.6, low: 120 },
      { zone: 3, seconds: duration * 0.3, low: 145 },
    ],
    powerZones: [],
    analysis: analyzePoints(points),
    errors: {},
    available: [],
    demo: true,
  };
}
