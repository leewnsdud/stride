const normalize = (value) =>
  String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .trim();
export function matchesActivityName(activity, query) {
  const name = normalize(activity.name);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => name.includes(term));
}
