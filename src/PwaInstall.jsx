import React, { useState, useSyncExternalStore } from "react";
import { pwaState, subscribePwa, installPwa } from "./pwa.mjs";
import { DownloadSimple, CheckCircle } from "./icons.jsx";
export default function PwaInstall() {
  const state = useSyncExternalStore(subscribePwa, pwaState);
  const [message, setMessage] = useState("");
  return (
    <section className="settings-section pwa-install">
      <h3>홈 화면에서 Stride 열기</h3>
      {state === "installed" ? (
        <p className="pwa-installed">
          <CheckCircle size={18} /> 앱 모드로 사용 중입니다.
        </p>
      ) : (
        <>
          <p className="settings-caption">
            홈 화면에 추가하면 아이콘을 눌러 앱처럼 바로 열 수 있어요.
          </p>
          {state === "available" && (
            <button
              className="button"
              onClick={async () => {
                try {
                  const result = await installPwa();
                  setMessage(
                    result === "accepted"
                      ? "설치를 요청했습니다. 홈 화면이나 앱 목록에서 확인해주세요."
                      : "언제든 다시 추가할 수 있어요.",
                  );
                } catch {
                  setMessage(
                    "브라우저 메뉴에서 홈 화면에 추가를 선택해주세요.",
                  );
                }
              }}
            >
              <DownloadSimple /> Stride 설치
            </button>
          )}
          <details className="pwa-instructions">
            <summary>기기별 추가 방법</summary>
            <div>
              <p>
                <strong>iPhone · iPad</strong>
                <br />
                Safari에서 Stride를 열고 공유 → 홈 화면에 추가 → 추가를
                눌러주세요. ‘웹 앱으로 열기’가 보이면 켜주세요.
              </p>
              <p>
                <strong>Android</strong>
                <br />
                Chrome 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택해주세요.
              </p>
              <p>
                <strong>Mac · PC</strong>
                <br />
                Chrome 주소창의 설치 아이콘을 사용하거나, Mac Safari의 파일 →
                Dock에 추가를 선택해주세요.
              </p>
            </div>
          </details>
          {message && (
            <p className="settings-caption" role="status">
              {message}
            </p>
          )}
        </>
      )}
      <p className="settings-caption">
        기록과 코칭을 사용하려면 Mac과 Tailscale이 연결되어 있어야 합니다.
      </p>
    </section>
  );
}
