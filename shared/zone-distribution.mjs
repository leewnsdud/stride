// Percentages require complete durations; a missing zone must not inflate the others.
export function zoneDistribution(zones = []) {
  const rows = (zones || []).map((zone) => ({
    ...zone,
    seconds:
      Number.isFinite(zone.seconds) && zone.seconds >= 0 ? zone.seconds : null,
  }));
  const total = rows.reduce((sum, row) => sum + (row.seconds ?? 0), 0);
  const complete = rows.every((row) => row.seconds !== null);
  return rows.map((row) => ({
    ...row,
    percent: complete && total > 0 ? (row.seconds / total) * 100 : null,
  }));
}
