// Only a generic disconnected screen is cached. Personal records, API responses,
// app HTML and compiled bundles always go to the live server.
const CACHE = "stride-offline-v3";
const OFFLINE = "/offline.html";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE, "/icons/stride-192.png"]))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("stride-offline-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    (url.pathname === "/api" || url.pathname.startsWith("/api/"))
  )
    return;
  if (url.pathname === "/icons/stride-192.png") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/icons/stride-192.png")),
    );
  } else if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) =>
          response.status >= 500 ? disconnected() : response,
        )
        .catch(disconnected),
    );
  }
});
async function disconnected() {
  return (
    (await caches.match(OFFLINE)) ||
    new Response(
      "Stride에 연결할 수 없습니다. 인터넷, Tailscale, Mac 연결을 확인한 뒤 다시 여세요.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    )
  );
}
