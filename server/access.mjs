import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Only the local Tailscale Serve proxy may assert remote identity. Keep the
// HTTP server bound to loopback; never enable Express's blanket trust proxy.
export function loadRemoteAccess(dataDir) {
  const file = path.join(dataDir, "remote-access.json");
  if (!existsSync(file)) return null;
  const config = JSON.parse(readFileSync(file, "utf8"));
  const url = new URL(config.origin);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".ts.net") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    typeof config.login !== "string" ||
    !config.login.trim()
  ) {
    throw new Error("Tailscale 원격 접속 설정을 확인하세요.");
  }
  return {
    origin: url.origin,
    host: url.host,
    login: config.login.trim().toLowerCase(),
  };
}

export function checkAccess({
  headers,
  address,
  remote,
  devOrigin,
  method = "GET",
}) {
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address))
    return { error: "로컬 프록시를 통한 접근만 허용됩니다." };
  const host = headers.host;
  if (typeof host !== "string")
    return { error: "올바른 서버 주소가 필요합니다." };
  let local = false;
  try {
    const url = new URL(`http://${host}`);
    local =
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.host === host &&
      !url.username &&
      !url.password;
  } catch {
    return { error: "올바른 서버 주소가 필요합니다." };
  }
  const proxyHeaders = [
    "x-forwarded-for",
    "x-forwarded-proto",
    "x-forwarded-host",
    "tailscale-user-login",
    "tailscale-user-name",
    "tailscale-user-profile-pic",
    "tailscale-app-capabilities",
  ];
  const proxied = proxyHeaders.some((key) => headers[key] !== undefined);
  const isRemote = !local || proxied;
  if (isRemote) {
    if (!remote || (!local && host !== remote.host))
      return { error: "허용되지 않은 원격 주소입니다." };
    const login = headers["tailscale-user-login"];
    if (typeof login !== "string" || login.toLowerCase() !== remote.login)
      return { error: "본인 Tailscale 계정으로 연결한 기기에서 접속하세요." };
  }
  const origins = isRemote
    ? [remote.origin]
    : [`http://${host}`, ...(devOrigin ? [devOrigin] : [])];
  if (headers.origin !== undefined && !origins.includes(headers.origin))
    return { error: "허용되지 않은 요청 출처입니다." };
  if (
    headers["sec-fetch-site"] === "cross-site" &&
    !["GET", "HEAD", "OPTIONS"].includes(method)
  )
    return { error: "외부 사이트에서 시작한 요청은 허용되지 않습니다." };
  return { remote: isRemote };
}
