const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const first = (...xs) => xs.find((x) => n(x) !== null) ?? null;
const arr = (x) => (Array.isArray(x) ? x : []);
const div = (a, b) => (n(a) !== null && b > 0 ? a / b : null);
export function normalizeGarmin(raw) {
  const s = raw.summaryDTO || raw;
  const id = raw.activityId;
  const type = raw.activityType?.typeKey || raw.activityTypeDTO?.typeKey || "";
  if (!id || !s.startTimeLocal || !(s.distance > 0) || !(s.duration > 0))
    return null;
  return {
    id: `garmin-${id}`,
    externalId: String(id),
    source: "garmin",
    name: raw.activityName || "Garmin 러닝",
    date: s.startTimeLocal.slice(0, 10),
    startTime: s.startTimeGMT || s.startTimeLocal,
    startTimeLocal: s.startTimeLocal,
    type: /trail|ultra/i.test(type) ? "trail" : "road",
    distance: s.distance / 1000,
    duration: s.duration / 60,
    elevation: n(s.elevationGain),
    hr: n(s.averageHR),
    rpe: n(s.activityTrainingLoadRPE),
    notes: "",
    stats: summaryStats(s),
    raw,
  };
}
function summaryStats(s) {
  return {
    timerSeconds: n(s.duration),
    movingSeconds: n(s.movingDuration),
    elapsedSeconds: n(s.elapsedDuration),
    maxHr: n(s.maxHR),
    minHr: n(s.minHR),
    cadence: first(
      s.averageRunCadence,
      s.averageRunningCadenceInStepsPerMinute,
    ),
    maxCadence: first(s.maxRunCadence, s.maxRunningCadenceInStepsPerMinute),
    power: first(s.averagePower, s.avgPower),
    maxPower: n(s.maxPower),
    normalizedPower: n(s.normPower),
    calories: n(s.calories),
    descent: n(s.elevationLoss),
    minElevation: n(s.minElevation),
    maxElevation: n(s.maxElevation),
    aerobicEffect: n(s.trainingEffect),
    anaerobicEffect: n(s.anaerobicTrainingEffect),
    trainingLoad: n(s.activityTrainingLoad),
    trainingEffectLabel: s.trainingEffectLabel || null,
    strideLength: first(s.averageStrideLength, s.avgStrideLength),
    groundContactTime: first(s.groundContactTime, s.avgGroundContactTime),
    verticalOscillation: first(s.verticalOscillation, s.avgVerticalOscillation),
    verticalRatio: first(s.verticalRatio, s.avgVerticalRatio),
    groundContactBalance: first(
      s.groundContactBalance,
      s.avgGroundContactBalance,
    ),
    maxSpeed: n(s.maxSpeed),
    averageSpeed: n(s.averageSpeed),
    respiration: n(s.avgRespirationRate),
    temperature: n(s.averageTemperature),
  };
}
export function normalizeGarminDetail(raw) {
  const descriptors = arr(raw.details?.metricDescriptors);
  const samples = arr(raw.details?.activityDetailMetrics).map((row) =>
    Object.fromEntries(
      descriptors
        .filter((d) => Number.isInteger(d.metricsIndex) && d.metricsIndex >= 0)
        .map((d) => [d.key, n(row.metrics?.[d.metricsIndex])]),
    ),
  );
  const initialTimestamp = samples.find(
    (s) => n(s.directTimestamp) !== null,
  )?.directTimestamp;
  const points = samples
    .map((s) => ({
      time: first(
        s.sumElapsedDuration,
        n(s.directTimestamp) !== null && n(initialTimestamp) !== null
          ? div(s.directTimestamp - initialTimestamp, 1000)
          : null,
      ),
      timer: s.sumDuration,
      moving: s.sumMovingDuration,
      distance: s.sumDistance,
      hr: s.directHeartRate,
      speed: s.directSpeed,
      pace: div(1000, (s.directSpeed || 0) * 60),
      gap: div(1000, (s.directGradeAdjustedSpeed || 0) * 60),
      altitude: first(
        s.directCorrectedElevation,
        s.directElevation,
        s.directUncorrectedElevation,
      ),
      cadence: first(
        s.directDoubleCadence,
        n(s.directRunCadence) !== null
          ? 2 * (s.directRunCadence + (s.directFractionalCadence || 0))
          : null,
      ),
      power: s.directPower,
      strideLength: s.directStrideLength,
      groundContactTime: s.directGroundContactTime,
      verticalOscillation: s.directVerticalOscillation,
      verticalRatio: s.directVerticalRatio,
      balance: s.directGroundContactBalanceLeft,
      respiration: s.directRespirationRate,
      temperature: s.directAirTemperature,
      stamina: s.directAvailableStamina,
      performance: s.directPerformanceCondition,
      lat: s.directLatitude,
      lon: s.directLongitude,
    }))
    .filter((p) => n(p.time) !== null)
    .sort((a, b) => a.time - b.time);
  const laps = arr(raw.laps?.lapDTOs || raw.laps).map((l, i) => ({
    index: i + 1,
    label: l.intensityType || "lap",
    distance: n(l.distance),
    duration: n(l.duration),
    pace: div(l.duration, ((l.distance || 0) * 60) / 1000),
    hr: n(l.averageHR),
    maxHr: n(l.maxHR),
    cadence: n(l.averageRunCadence),
    power: n(l.averagePower),
    ascent: n(l.elevationGain),
    descent: n(l.elevationLoss),
  }));
  const zones = (value) =>
    arr(value)
      .map((z) => ({
        zone: z.zoneNumber,
        seconds: n(z.secsInZone),
        low: n(z.zoneLowBoundary),
      }))
      .filter((z) => z.seconds !== null);
  const s = raw.summary?.summaryDTO || raw.summary || {};
  return {
    version: 2,
    fetchedAt: new Date().toISOString(),
    points,
    laps,
    splits: kilometerSplits(points),
    stats: summaryStats(s),
    hrZones: zones(raw.hrZones),
    powerZones: zones(raw.powerZones),
    weather: raw.weather || null,
    errors: raw.errors || {},
    available: descriptors.map((d) => ({
      key: d.key,
      unit: d.unit?.key || null,
    })),
    analysis: analyzePoints(points),
    raw,
  };
}
// Split estimates use cumulative timer time, interpolated at each km. Long gaps are rejected.
export function kilometerSplits(points) {
  const result = [];
  let boundary = 1000,
    previousTime = 0,
    previousDistance = 0;
  const valid = points.filter(
    (p) => n(p.distance) !== null && n(p.timer) !== null,
  );
  if (!valid.length || valid[0].distance > 50 || valid[0].timer > 30)
    return result;
  for (let i = 1; i < valid.length; i++) {
    const a = valid[i - 1],
      b = valid[i];
    if (b.distance < a.distance || b.timer < a.timer || b.time - a.time > 120)
      return [];
    while (b.distance >= boundary && a.distance < boundary) {
      const t =
        a.timer +
        ((b.timer - a.timer) * (boundary - a.distance)) /
          (b.distance - a.distance);
      result.push({
        index: result.length + 1,
        distance: 1000,
        duration: t - previousTime,
        pace: (t - previousTime) / 60,
        estimated: true,
      });
      previousTime = t;
      previousDistance = boundary;
      boundary += 1000;
    }
  }
  const last = valid.at(-1);
  if (last.distance - previousDistance > 10)
    result.push({
      index: result.length + 1,
      distance: last.distance - previousDistance,
      duration: last.timer - previousTime,
      pace:
        (last.timer - previousTime) /
        60 /
        ((last.distance - previousDistance) / 1000),
      estimated: true,
    });
  return result;
}
export function analyzePoints(points) {
  let uphillSeconds = 0,
    downhillSeconds = 0,
    flatSeconds = 0,
    coveredSeconds = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dt = b.time - a.time,
      dx = b.distance - a.distance;
    if (
      dt <= 0 ||
      dt > 30 ||
      dx <= 1 ||
      n(a.altitude) === null ||
      n(b.altitude) === null ||
      n(a.distance) === null ||
      n(b.distance) === null
    )
      continue;
    const grade = (b.altitude - a.altitude) / dx;
    if (Math.abs(grade) > 0.6) continue;
    coveredSeconds += dt;
    if (grade > 0.03) uphillSeconds += dt;
    else if (grade < -0.03) downhillSeconds += dt;
    else flatSeconds += dt;
  }
  return { uphillSeconds, downhillSeconds, flatSeconds, coveredSeconds };
}
