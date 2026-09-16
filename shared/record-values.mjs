export function optionalNumber(value) {
  if (value == null || (typeof value === "string" && value.trim() === ""))
    return null;
  return Number(value);
}

export function measurementDifference(actual, planned) {
  const a = optionalNumber(actual),
    p = optionalNumber(planned);
  return a != null && p != null && Number.isFinite(a) && Number.isFinite(p)
    ? a - p
    : null;
}
