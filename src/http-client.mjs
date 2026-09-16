export async function requestJson(url, options, send = fetch) {
  let response;
  try {
    response = await send(url, options);
  } catch {
    throw new Error(
      "Mac에 연결하지 못했습니다. 인터넷과 Tailscale 연결을 확인한 뒤 다시 시도해주세요.",
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      response.status === 403
        ? "접속이 허용되지 않았습니다. 본인 Tailscale 계정과 접속 주소를 확인해주세요."
        : "서버 응답을 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof body?.error === "string" && body.error
        ? body.error
        : "요청을 처리하지 못했습니다. 다시 시도해주세요.",
    );
  return body;
}
