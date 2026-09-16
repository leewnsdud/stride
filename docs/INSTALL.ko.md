# Stride 한글 설치 가이드

Stride는 각자의 노트북에서 실행합니다. 다른 사람의 계정·데이터를 복사할 필요가 없습니다.
먼저 기본 앱을 실행한 다음 필요한 연동만 설정하세요. 명령은 별도 표시가 없으면
**노트북의 터미널에서, 내려받은 `stride` 폴더 안에서** 실행합니다.

> [!NOTE]
> macOS 기준 안내입니다. Linux는 CI에서 설치·테스트·빌드를 확인했지만 데스크톱 연동은
> 실기기 검증하지 않았습니다. Windows는 [WSL2 안내](#other-os)를 확인하세요.

## 원하는 사용 방식 고르기

| 하고 싶은 일 | 필요한 설정 |
| --- | --- |
| 기록 직접 입력, 대시보드, 훈련 계획 생성·적용 | **1–2단계만** 진행 |
| Garmin 기록 가져오기 | 기본 설치 + 3단계 |
| AI에게 질문하거나 활동 리뷰 받기 | 기본 설치 + 4단계 |
| Mac 로그인 시 자동 실행 | 기본 설치 + 5단계 |
| 휴대폰에서도 같은 기록 보기 | 기본 설치 + 7단계 Tailscale |

훈련 계획 생성은 앱의 규칙으로 동작하므로 AI 로그인이 필요 없습니다.
계획의 ‘코치에게 질문’, 새 AI 리뷰, 채팅 답변에만 AI 연결이 필요합니다.
이미 저장한 리뷰·대화는 로그인 없이 읽을 수 있습니다.

**바로가기:** [준비물](#prerequisites) · [첫 실행](#quick-start) ·
[Garmin](#garmin) · [AI](#ai) · [자동 실행](#autostart) ·
[업데이트·백업](#maintenance) · [휴대폰·Tailscale](#tailscale) ·
[다른 OS](#other-os) · [문제 해결](#troubleshooting)

<a id="prerequisites"></a>

## 1. 준비물

| 항목 | 용도 |
| --- | --- |
| Node.js 24.x와 npm | 필수. 내장 SQLite 사용 |
| Git | 코드 다운로드·업데이트 |
| Python 3.12 이상 | Garmin 연동을 사용할 때 |
| Codex CLI와 ChatGPT 계정 | AI 기능을 사용할 때 |

Node.js는 [공식 다운로드](https://nodejs.org/en/download), Python은
[공식 다운로드](https://www.python.org/downloads/)에서 설치할 수 있습니다.
Mac에서는 터미널에서 `git --version`을 실행하면 개발자 도구 설치 안내가 나타날 수 있습니다.

```sh
node --version
npm --version
git --version
```

`node`가 `v24.`로 시작하는지 확인하세요. 이미 버전 관리자를 쓴다면 이 저장소의
`.nvmrc`를 이용할 수 있습니다. 최신 메이저 버전 전체의 호환성을 보장하지는 않습니다.

<a id="quick-start"></a>

## 2. 코드 다운로드와 첫 실행

### 2-1. 코드 받기

원하는 작업 폴더에서 실행합니다.

```sh
git clone https://github.com/leewnsdud/stride.git
cd stride
```

### 2-2. 설치하고 실행하기

```sh
npm ci
npm run build
npm start
```

브라우저에서 **http://127.0.0.1:4318** 을 여세요. 터미널은 실행 중인 채로 둡니다.
종료는 `Ctrl+C`, 다시 시작은 같은 `stride` 폴더에서 `npm start`입니다.

설치 상태는 `npm run doctor`로 확인할 수 있습니다. Garmin·Codex가 없어도 기본 앱은 실행됩니다.
첫 화면은 빈 개인 기록입니다. 예시 데이터가 내부 테스트용으로 존재하지만 개인 화면과 분리됩니다.
앱이 사용하는 `data/` 폴더는 첫 실행 시 자동 생성되고 Git에서 제외됩니다.

**완료 확인:** 대시보드가 열리고 수동으로 기록을 추가할 수 있으면 기본 설치가 끝났습니다.
이후 필요한 연동만 진행하세요. 서버를 켜 둔 채 다음 명령을 입력하려면 새 터미널 탭을 열고
같은 `stride` 폴더로 이동하세요.

<a id="garmin"></a>

## 3. Garmin 연결 (선택)

Python이 설치되어 있다면 저장소 안에서 가상환경을 만듭니다.
아래 `python3`가 3.12 미만이면 설치한 실행 파일(예: `python3.12`)로 바꾸세요.

```sh
python3 --version
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run doctor
```

1. Stride의 **설정 → Garmin Connect**에서 본인의 이메일·비밀번호로 로그인합니다.
2. 추가 인증이 요구되면 본인이 받은 인증 코드를 입력합니다.
3. 시작일·종료일을 정한 뒤 동기화를 실행합니다.
4. 시계 기록이 먼저 Garmin Connect에 업로드되어 있어야 합니다.

비밀번호는 DB에 저장하지 않지만, 재로그인을 위한 토큰은 `data/garmin/`에 저장됩니다.
이 폴더는 다른 사람에게 보내거나 공개 저장소에 올리지 마세요.
비공식 [python-garminconnect](https://github.com/cyberjunky/python-garminconnect)를 사용하므로
Garmin 측 변경·인증 만료·요청 제한에 따라 재연결이 필요할 수 있습니다.

<a id="ai"></a>

## 4. AI 코칭 연결 (선택)

[공식 Codex CLI 설치 안내](https://developers.openai.com/codex/cli)를 따라 CLI를 설치한 뒤
터미널에서 아래 명령이 작동하는지 확인합니다.

```sh
codex --version
codex app-server --help
```

Stride의 **설정 → Codex 구독 코칭 → ChatGPT로 로그인**에서 본인 계정으로 연결합니다.
이미 같은 OS 계정의 Codex에 로그인되어 있다면 기존 로그인을 재사용할 수 있습니다.
모델은 설정 화면에서 **본인 계정에 제공되는 항목**을 선택하세요.
특정 모델의 이용 가능 여부나 사용 한도는 계정에 따라 달라집니다.

Stride는 [Codex App Server](https://developers.openai.com/codex/app-server)를 통해 요청합니다.
OpenAI API 키를 입력하는 방식이 아니며 API 과금으로 자동 전환하지 않습니다.
Codex 인증 정보는 Codex가 관리하므로 `~/.codex/`를 공유하지 마세요.

- **AI 코칭**에서 질문하거나 기록을 선택해 첨부할 수 있습니다.
- **활동 상세 → AI 리뷰**에서 리뷰를 만들고 같은 대화에서 질문을 이어갈 수 있습니다.
- **AI 코칭으로 이동**을 누르면 활동 날짜·이름으로 된 해당 대화가 열립니다.
- AI 답변이나 훈련 계획은 확인 후 적용하세요. 실패한 요청을 자동 반복하지 않습니다.

<a id="autostart"></a>

## 5. Mac 로그인 시 자동 실행 (선택)

수동으로 실행한 서버를 `Ctrl+C`로 중지한 뒤 실행합니다.

```sh
npm run build
npm run macos:install
```

현재 사용자의 LaunchAgent로 등록됩니다. 이후 로그인 시 시작하며,
Mac이 켜져 있는 동안 매시간 최근 30일 Garmin 활동의 동기화를 시도합니다.
오래된 기록은 앱에서 날짜 범위를 선택해 직접 가져오세요. 잠자기 중에는 접속할 수 없습니다.

자동 실행 해제:

```sh
npm run macos:uninstall
```

해제해도 `data/`는 지우지 않습니다. 저장소 위치나 Node 설치 경로를 바꿨다면
이전 자동 실행을 해제한 뒤 새 위치에서 다시 등록하세요.
로그는 `data/server.log`, `data/server-error.log`이며 공개 이슈에 원문을 첨부하지 마세요.

<a id="maintenance"></a>

## 6. 업데이트·백업

터미널에서 저장소로 이동해 백업하고 업데이트합니다.

```sh
npm run backup
git pull --ff-only
npm ci
npm run build
```

Garmin 의존성이 변경되었다면 `.venv/bin/python -m pip install -r requirements.txt`도 실행합니다.
수동 실행은 서버를 재시작하고, Mac 자동 실행 사용자는 `npm run macos:install`로 다시 등록합니다.
업데이트는 `data/`를 지우지 않습니다. 직접 수정한 코드가 있으면 Git이 충돌을 알릴 수 있습니다.

백업은 `data/backups/`에 생성됩니다. JSON 내보내기는 앱 설정에서 할 수 있습니다.
SQLite 백업을 복원할 때는 먼저 서버를 완전히 중지하고 현재 `data/`를 별도로 보관하세요.
그다음 백업 DB를 `data/stride.sqlite`로 복사하고, 중지된 DB의 기존 `stride.sqlite-wal`과
`stride.sqlite-shm` 파일을 별도 위치로 옮긴 뒤 시작합니다. Garmin 토큰은 DB 백업에 포함되지 않습니다.

다른 노트북으로 옮길 때는 코드를 새로 설치하고 본인 백업만 안전하게 옮기세요.
Garmin·ChatGPT는 새 기기에서 다시 로그인하는 방법을 권장합니다.

<a id="tailscale"></a>

## 7. 휴대폰에서 보기 — Tailscale (선택)

Tailscale은 본인의 노트북과 휴대폰을 사설 네트워크로 연결합니다.
Stride는 노트북에서 계속 실행되고, 휴대폰은 HTTPS 주소로 같은 기록에 접속합니다.
휴대폰에 Node.js·Python·Codex를 설치할 필요는 없습니다.

```text
휴대폰 브라우저 → Tailscale 사설망 → 노트북의 Tailscale Serve → Stride (127.0.0.1:4318)
```

**시작 전:** 노트북에서 `http://127.0.0.1:4318`이 열리는지 먼저 확인하세요.
아래 절차는 macOS에서 기본 포트 `4318`을 사용하는 경우입니다.

### 7-1. 두 기기를 본인 계정으로 연결하기

1. [공식 다운로드](https://tailscale.com/download)에서 Mac용 Tailscale을 설치합니다.
   [macOS 설치 안내](https://tailscale.com/docs/install/mac)의 Standalone 버전을 사용할 수 있습니다.
2. Tailscale 앱을 열고 본인 계정으로 로그인한 뒤 VPN 구성 권한을 허용합니다.
3. 휴대폰에도 Tailscale 앱을 설치하고 **같은 계정·같은 네트워크(tailnet)**에 로그인합니다.
4. 두 기기 모두 Tailscale 연결을 켭니다.

노트북의 새 터미널 탭에서 CLI가 작동하는지 확인합니다.

```sh
tailscale version
tailscale status
```

`command not found`가 나오면 Mac 앱의 실행 파일을 이 터미널에서 사용하도록 지정할 수 있습니다.
Tailscale 앱을 `/Applications`에 설치한 경우에만 아래 경로가 맞습니다.

```sh
alias tailscale='/Applications/Tailscale.app/Contents/MacOS/Tailscale'
tailscale version
```

이 별칭은 현재 터미널 탭에서만 유효합니다. 새 탭에서는 다시 지정하세요.
[macOS CLI 안내](https://tailscale.com/docs/reference/tailscale-cli?tab=macos)

### 7-2. Serve로 Stride 연결하기

먼저 기존 연결을 확인합니다.

```sh
tailscale serve status
```

이미 HTTPS 443의 `/` 경로를 다른 앱이 사용 중이면 덮어쓰지 말고 기존 구성을 확인하세요.
비어 있는 새 설치라면 실행합니다.

```sh
tailscale serve --bg --https=443 http://127.0.0.1:4318
tailscale serve status
```

최초 실행 시 설정 승인 링크가 나오면 브라우저에서 열어 HTTPS/Serve를 활성화하고
명령을 다시 실행합니다. [공식 Serve 안내](https://tailscale.com/docs/features/tailscale-serve)를
따르세요. HTTPS 활성화 과정에서 인증서에 쓰이는 기기 DNS 이름이 공개 인증서 투명성 로그에
기록될 수 있다는 안내도 확인하세요.

출력된 **본인 기기의 `https://…ts.net` 주소**를 복사합니다. 예시 주소는 다음과 같으며
실제로 접속되는 주소가 아닙니다.

```text
https://my-laptop.example.ts.net
```

> [!IMPORTANT]
> 사설망용 **Serve**를 사용하세요. 공개 인터넷용 Funnel이나 공유기 포트 포워딩은
> 이 설치 방식에 포함되지 않습니다. Stride 서버는 계속 `127.0.0.1`에서만 실행합니다.
> 이 단계만 마친 상태에서 Stride의 접근 거부가 나오면 다음 계정 등록을 진행하세요.

### 7-3. Stride에 허용할 계정과 주소 등록하기

`stride` 폴더의 `data/remote-access.json`을 텍스트 편집기로 만듭니다.
이미 파일이 있으면 새로 덮어쓰지 말고 기존 값을 확인하세요.
Mac에서는 다음 명령으로 `data` 폴더를 Finder에서 열 수 있습니다.

```sh
open data
```

아래 내용을 **일반 텍스트 JSON 파일**로 저장합니다. TextEdit을 쓴다면 ‘포맷 → 일반 텍스트 만들기’를
선택하고, 파일명이 `remote-access.json.txt`가 되지 않도록 확인하세요.

```json
{
  "origin": "https://my-laptop.example.ts.net",
  "login": "you@example.com"
}
```

| 항목 | 입력할 값 |
| --- | --- |
| `origin` | 7-2에서 나온 본인 HTTPS 주소. `/coach` 같은 경로 없이 입력 |
| `login` | Tailscale 관리 콘솔 **Users**에 표시된 본인 로그인 식별자. 보통 이메일이며 표시 이름과 다름 |

예시의 두 값을 모두 바꾸세요. 비밀번호·인증 토큰을 넣는 파일이 아닙니다.
Stride는 Serve가 전달하는 `Tailscale-User-Login`과 `login`을 비교해 **한 계정만** 허용합니다.
접속하는 휴대폰은 사용자 소유 기기여야 하며, 태그가 붙은 기기는 사용자 인증 헤더가 없어
거부될 수 있습니다. [Serve의 사용자 식별 방식](https://tailscale.com/docs/features/tailscale-serve#identity-headers)

저장한 다음 파일 권한과 문법을 확인합니다. 아래 문법 검사는 파일 내용을 출력하지 않습니다.

```sh
chmod 600 data/remote-access.json
node --input-type=module -e "import {loadRemoteAccess} from './server/access.mjs'; if (!loadRemoteAccess('data')) throw new Error('설정 파일이 없습니다.'); console.log('원격 접속 설정 형식 정상');"
```

이 파일은 Git에서 제외됩니다. 본인의 실제 주소·계정이 들어간 파일을 GitHub 이슈에 첨부하지 마세요.

### 7-4. Stride 재시작 후 휴대폰에서 확인하기

설정은 서버 시작 시 읽으므로 **사용 중인 실행 방식 하나만** 선택해 재시작합니다.

| 실행 방식 | 재시작 방법 |
| --- | --- |
| 터미널에서 `npm start`로 실행 중 | 해당 터미널에서 `Ctrl+C` → `npm start` |
| 5단계 Mac 자동 실행 등록 완료 | `stride` 폴더에서 `npm run macos:install` |

휴대폰에서 Tailscale을 켠 뒤 Safari 또는 Chrome으로 7-2의 HTTPS 주소를 엽니다.
`127.0.0.1`, 노트북의 Wi-Fi IP, Tailscale의 `100.x` IP를 주소 대신 사용하지 마세요.

**완료 확인:** 휴대폰에서도 노트북과 같은 활동·훈련 일정이 보이면 연결이 완료됐습니다.
연결을 테스트하려면 휴대폰 Wi-Fi를 끄고, 모바일 데이터와 Tailscale을 켠 상태에서도 열어보세요.

### 7-5. 홈 화면에 추가하고 계속 사용하기

- **iPhone·iPad:** Safari 공유 메뉴 → 홈 화면에 추가. ‘웹 앱으로 열기’가 보이면 켭니다.
- **Android:** Chrome 메뉴 → 앱 설치 또는 홈 화면에 추가.
- 노트북은 켜져 있고 잠자기 상태가 아니어야 하며, Stride와 양쪽 Tailscale이 실행 중이어야 합니다.
- `--bg`는 Serve 연결을 유지하는 옵션입니다. Stride 자체 자동 실행은 [5단계](#autostart)로 따로 설정합니다.
- 홈 화면 설치는 오프라인 데이터 사용을 제공하지 않습니다. 노트북에 연결되지 않으면 기록을 불러올 수 없습니다.

### 7-6. 휴대폰 연결 해제하기

이 가이드대로 만든 HTTPS 443 Serve 연결을 끕니다. 같은 포트에 다른 앱을 추가했다면 먼저
상태를 확인하세요. 전체 Serve 설정을 지우는 `reset`은 필요하지 않습니다.

```sh
tailscale serve --bg --https=443 off
tailscale serve status
```

노트북의 `http://127.0.0.1:4318` 접속과 기록은 유지됩니다.
Stride의 원격 허용 설정까지 제거하려면 `data/remote-access.json`을 별도로 보관한 뒤
`data/` 밖으로 옮기고 Stride를 재시작하세요.

명령 옵션과 중지 방법: [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve).

<a id="other-os"></a>

## 8. Linux·Windows

현재 사용자 설치 검증 기준은 macOS입니다. Linux CI의 설치·테스트·빌드는 통과했지만,
아래 환경의 Garmin·Codex·휴대폰 연동까지 실기기 검증한 것은 아닙니다.

- **Linux:** Node 24, Python 3.12+, Git과 Codex CLI를 설치한 뒤 동일한 기본 명령을 사용합니다.
  `macos:install`은 사용할 수 없으며 터미널에서 `npm start`로 실행합니다.
- **Windows:** WSL2 안에 코드와 모든 런타임을 함께 설치하는 경로를 권장합니다.
  WSL2의 Linux 터미널에서 설치 단계를 진행하세요. Windows 네이티브 PowerShell 설치,
  자동 실행, 휴대폰 접속까지 검증한 설치 패키지는 아직 제공하지 않습니다.

<a id="troubleshooting"></a>

## 9. 문제 해결

| 증상 | 확인할 사항 |
| --- | --- |
| `node:sqlite` 오류 | Node 24.x인지 확인 |
| `npm ci` 실패 | Node 버전·네트워크 확인. lockfile을 지우기보다 오류를 확인 |
| 화면이 열리지 않음 | `npm run build` 후 서버 실행 여부, `http://127.0.0.1:4318` 확인 |
| 포트 사용 중 | 기존 수동 서버 또는 자동 실행과 중복인지 확인 |
| Garmin 모듈 없음 | `.venv/bin/python` 존재와 의존성 설치 확인 |
| Codex 실행 실패 | `codex --version`, `codex app-server --help` 확인 |
| 모델 사용 불가 | 설정에서 계정에 표시되는 모델 선택 |
| 수정 내용이 보이지 않음 | 빌드·서버 재시작 후 새로고침 |
| 휴대폰에서 연결 시간 초과 | 양쪽 Tailscale 연결, Mac 잠자기, Stride 실행, tailnet 접근 정책 확인 |
| Tailscale 주소에서 502 오류 | 노트북의 `127.0.0.1:4318` 접속부터 확인. Serve 대상 포트와 앱 포트 일치 여부 확인 |
| ‘허용되지 않은 원격 주소’ | `remote-access.json`의 `origin`과 Serve 주소 확인 후 Stride 재시작 |
| ‘본인 Tailscale 계정’ 오류 | `login`과 휴대폰 소유 계정 확인. 같은 tailnet의 다른 계정이나 태그 기기는 허용되지 않음 |
| ‘허용되지 않은 요청 출처’ | 저장한 HTTPS 주소로 다시 접속. 다른 별칭·IP·포트를 사용하지 않았는지 확인 |
| 설정 후 서버가 시작되지 않음 | 7-3의 JSON 형식 검사 실행. 일반 따옴표·쉼표·HTTPS 주소 확인 |

실행 파일 경로를 직접 지정할 수도 있습니다.

```sh
cp .env.example .env
# .env를 편집한 다음 아래 명령으로 명시적으로 읽습니다.
node --env-file=.env server/index.mjs
```

`npm start`는 `.env`를 자동으로 읽지 않습니다. `PORT`, `AUTO_SYNC`, `GARMIN_PYTHON`,
`CODEX_BIN`은 선택 설정입니다. 계정 비밀번호나 토큰을 예제 파일에 넣지 마세요.
자동 실행은 설치 당시 PATH를 저장하며 별도 `.env` 파일을 자동으로 읽지 않습니다.


## 관련 문서

- [프로젝트 소개](../README.md) · [개인정보·외부 전송](PRIVACY.ko.md) · [보안 제보](../SECURITY.md)
- [Tailscale HTTPS 인증서 안내](https://tailscale.com/docs/how-to/set-up-https-certificates)
- 문서 구성 참고: [Immich Quick start](https://docs.immich.app/overview/quick-start/).
  준비물 → 설정 → 실행 → 완료 확인 순서를 참고했으며, 명령과 설정은 Stride 구현에 맞게 작성했습니다.

GitHub Pages 같은 정적 호스팅만으로는 전체 기능이 실행되지 않습니다.
각 사용자의 노트북에서 Node 서버를 실행하고 필요한 연동을 설치하는 방식입니다.
