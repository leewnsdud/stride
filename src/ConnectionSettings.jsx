import { ArrowsClockwise } from "./icons.jsx";
import React, { useState, useEffect } from "react";
export default function ConnectionSettings({
  kind,
  status,
  api,
  busy,
  act,
  onStatus,
  access,
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [mfa, setMfa] = useState(false),
    [login, setLogin] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [models, setModels] = useState([]);
  const [modelError, setModelError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [model, setModel] = useState(
    status?.codex?.selectedModel || "gpt-5.6-sol",
  );
  const [effort, setEffort] = useState(
    status?.codex?.reasoningEffort || "medium",
  );
  useEffect(() => {
    setEffort(status?.codex?.reasoningEffort || "medium");
  }, [status?.codex?.reasoningEffort]);
  const selected = models.find((m) => m.id === model);
  const efforts = selected?.reasoningEfforts?.length
    ? selected.reasoningEfforts
    : ["medium"];
  const changed =
    model !== (status?.codex?.selectedModel || "gpt-5.6-sol") ||
    effort !== (status?.codex?.reasoningEffort || "medium");
  useEffect(() => {
    setModel(status?.codex?.selectedModel || "gpt-5.6-sol");
  }, [status?.codex?.selectedModel]);
  const loadModels = async () => {
    try {
      setModels(await api("/integrations/codex/models"));
      setModelError("");
    } catch (e) {
      setModelError(e.message);
    }
  };
  useEffect(() => {
    if (kind === "codex" && status?.codex?.connected) loadModels();
  }, [kind, status?.codex?.connected]);
  const refresh = async () => onStatus(await api("/integrations"));
  useEffect(() => {
    if (!login || status?.codex?.connected) return;
    const timer = setInterval(() => refresh().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [login, status?.codex?.connected]);
  if (kind === "garmin")
    return (
      <>
        <div className="settings-heading">
          <h2>Garmin Connect</h2>
          {status?.garmin?.configured ? (
            <details
              className="account-menu"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.open = false;
                  e.currentTarget.querySelector("summary").focus();
                }
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget))
                  e.currentTarget.open = false;
              }}
            >
              <summary aria-label="Garmin 계정 관리">
                <span className="settings-status">
                  연결 저장됨
                  <span className="status-chevron" />
                </span>
              </summary>
              <div className="account-menu-panel">
                <button
                  type="button"
                  disabled={busy || mfa || status?.garmin?.pendingMfa}
                  onClick={(e) => {
                    setShowLogin(!showLogin);
                    setPassword("");
                    e.currentTarget.closest("details").open = false;
                  }}
                >
                  {showLogin ? "로그인 취소" : "새로 로그인"}
                </button>
              </div>
            </details>
          ) : (
            <span className="settings-status">연결 필요</span>
          )}
        </div>
        <p className="settings-description">
          시계에 기록한 달리기와 경로, 페이스, 심박을 가져옵니다.
        </p>
        {(!status?.garmin?.configured ||
          showLogin ||
          mfa ||
          status?.garmin?.pendingMfa) && (
          <>
            <p className="small-note">
              python-garminconnect를 사용하는 비공식 연동입니다. 로그인 정보는
              이 Mac을 거쳐 Garmin에 전달됩니다. 비밀번호는 저장하지 않고 갱신
              가능한 세션 토큰만 Mac에 보관합니다.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const credentials = { email, password };
                setPassword("");
                act(
                  async () => {
                    const r = await api(
                      "/integrations/garmin/login",
                      credentials,
                    );
                    setMfa(!!r.mfa);
                    if (!r.mfa) setShowLogin(false);
                    await refresh();
                  },
                  "로그인 요청을 처리했습니다.",
                  false,
                );
              }}
            >
              <label className="field">
                Garmin 이메일
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                Garmin 비밀번호
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button
                className="button primary"
                disabled={busy || mfa || status?.garmin?.pendingMfa}
              >
                {busy ? "연결 중…" : "Garmin 로그인"}
              </button>
            </form>
          </>
        )}
        {(mfa || status?.garmin?.pendingMfa) && (
          <form
            className="analysis-section"
            onSubmit={(e) => {
              e.preventDefault();
              act(
                async () => {
                  const r = await api("/integrations/garmin/mfa", { code });
                  setCode("");
                  setMfa(!!r.mfa);
                  if (!r.mfa) setShowLogin(false);
                  await refresh();
                },
                "인증 요청을 처리했습니다.",
                false,
              );
            }}
          >
            <label className="field">
              Garmin 인증 코드
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4,10}"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            <button className="button primary" disabled={busy}>
              인증 완료
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                act(
                  async () => {
                    await api("/integrations/garmin/cancel", {});
                    setMfa(false);
                    setCode("");
                    await refresh();
                  },
                  "로그인을 취소했습니다.",
                  false,
                )
              }
            >
              취소
            </button>
          </form>
        )}
        {status?.garmin?.available === false && (
          <p role="alert">
            Garmin 연결 모듈이 준비되지 않았습니다. 서버의 Python 환경을
            확인하세요.
          </p>
        )}
      </>
    );
  return (
    <>
      <div className="settings-heading">
        <h2>Codex 구독 코칭</h2>
        <button
          className="settings-status-button"
          disabled={busy}
          title="연결 상태 새로고침"
          aria-label="구독 연결 상태 새로고침"
          onClick={() =>
            act(
              async () => {
                setRefreshing(true);
                try {
                  await refresh();
                  await loadModels();
                } finally {
                  setRefreshing(false);
                }
              },
              "연결 상태를 확인했습니다.",
              false,
            )
          }
        >
          <span className="settings-status">
            <ArrowsClockwise size={14} className={refreshing ? "spin" : ""} />
            {status?.codex?.connected ? "구독 연결됨" : "로그인 필요"}
          </span>
        </button>
      </div>
      <p className="settings-description">
        ChatGPT 구독의 Codex 사용 한도로 코칭을 받습니다.
      </p>
      {!status?.codex?.connected && (
        <button
          className="button primary"
          disabled={busy || status?.codex?.connected}
          onClick={() =>
            act(
              async () => {
                setLogin(await api("/integrations/codex/login", {}));
              },
              "로그인 안내를 열었습니다.",
              false,
            )
          }
        >
          ChatGPT로 로그인
        </button>
      )}
      {login && !status?.codex?.connected && (
        <div className="analysis-section">
          <a
            className="button"
            href={login.authUrl || login.verificationUrl}
            target="_blank"
            rel="noreferrer"
          >
            ChatGPT 로그인 페이지 열기
          </a>
          {login.userCode && (
            <p>
              인증 코드: <strong>{login.userCode}</strong>
            </p>
          )}
          <p className="helper">
            {access?.remote
              ? "휴대폰에서도 위 링크와 코드로 로그인할 수 있습니다. 계정에서 기기 코드 로그인이 허용되어 있어야 합니다."
              : "이 Mac의 브라우저에서 로그인을 완료하세요."}
          </p>
        </div>
      )}
      {status?.codex?.login?.error && (
        <p role="alert">{status.codex.login.error}</p>
      )}
      <section
        className="settings-section model-settings"
        aria-labelledby="coaching-settings-title"
      >
        <h3 id="coaching-settings-title">코칭 설정</h3>
        <div className="settings-fields">
          <label className="field">
            코칭 모델
            <select
              aria-label="코칭 모델"
              value={model}
              disabled={busy || !status?.codex?.connected || !models.length}
              onChange={(e) => {
                const next = models.find((m) => m.id === e.target.value);
                const supported = next?.reasoningEfforts?.length
                  ? next.reasoningEfforts
                  : ["medium"];
                setModel(e.target.value);
                if (!supported.includes(effort))
                  setEffort(
                    supported.includes("medium")
                      ? "medium"
                      : supported.includes(next?.defaultReasoningEffort)
                        ? next.defaultReasoningEffort
                        : supported[0],
                  );
              }}
            >
              {!selected && <option value={model}>{model}</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {(m.name || m.id)
                    .replace("GPT-5.6-", "GPT-5.6 ")
                    .replace("GPT-6-", "GPT-6 ")}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            추론 수준
            <select
              aria-label="추론 수준"
              value={effort}
              disabled={busy || !status?.codex?.connected || !selected}
              onChange={(e) => setEffort(e.target.value)}
            >
              {!efforts.includes(effort) && (
                <option value={effort} disabled>
                  {effort} · 지원 안 됨
                </option>
              )}
              {efforts.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="settings-actions">
          <p className="settings-caption" aria-live="polite">
            {changed
              ? "변경한 설정을 적용해주세요."
              : "현재 적용된 설정입니다."}
          </p>
          <button
            className="button primary"
            disabled={
              busy ||
              !status?.codex?.connected ||
              !changed ||
              !selected ||
              !efforts.includes(effort)
            }
            onClick={() =>
              act(
                async () => {
                  await api("/integrations/codex/model", { model, effort });
                  await refresh();
                },
                "코칭 설정을 변경했습니다.",
                false,
              )
            }
          >
            설정 적용
          </button>
        </div>
        <p className="settings-caption">
          활동 리뷰·AI 코치·계획 상담에 적용됩니다.{" "}
          {model === "gpt-5.6-luna"
            ? "Luna의 계정 사용 한도가 적용됩니다."
            : "사용 한도에 도달하면 Luna · medium으로 한 번 재시도합니다."}
        </p>
        {modelError && <p role="alert">{modelError}</p>}
      </section>
    </>
  );
}
