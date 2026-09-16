import { normalizeActivity } from "./domain.mjs";
export async function icuRequest(key, route, fetcher = fetch) {
  const res = await fetcher(`https://intervals.icu/api/v1/${route}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`API_KEY:${key}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const e = new Error(
      res.status === 401 || res.status === 403
        ? "Intervals.icu 인증에 실패했습니다. API 키를 확인하세요."
        : res.status === 429
          ? "동기화 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요."
          : `Intervals.icu 요청 실패 (${res.status})`,
    );
    e.status = 502;
    throw e;
  }
  return res.json();
}
export async function fetchActivities(key, oldest, newest) {
  const data = await icuRequest(
    key,
    `athlete/0/activities?oldest=${oldest}&newest=${newest}`,
  );
  if (!Array.isArray(data))
    throw new Error("활동 응답 형식이 올바르지 않습니다.");
  return data
    .filter((x) => ["Run", "TrailRun", "VirtualRun"].includes(x.type))
    .map(normalizeActivity)
    .filter(Boolean);
}
