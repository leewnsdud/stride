# Stride 한글 설치 가이드

Stride는 각자의 노트북에서 실행합니다. 다른 사람의 계정·데이터를 복사할 필요가 없습니다.
먼저 기본 앱을 실행한 다음 필요한 연동만 설정하세요.

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

## 2. 코드 다운로드와 첫 실행

원하는 작업 폴더에서 실행합니다.

```sh
git clone https://github.com/leewnsdud/stride.git
cd stride
npm ci
npm run build
npm start
```

브라우저에서 **http://127.0.0.1:4318** 을 여세요. 터미널은 실행 중인 채로 둡니다.
종료는 `Ctrl+C`, 다시 시작은 같은 `stride` 폴더에서 `npm start`입니다.

설치 상태는 `npm run doctor`로 확인할 수 있습니다. Garmin·Codex가 없어도 기본 앱은 실행됩니다.
첫 화면은 빈 개인 기록입니다. 예시 데이터가 내부 테스트용으로 존재하지만 개인 화면과 분리됩니다.
앱이 사용하는 `data/` 폴더는 첫 실행 시 자동 생성되고 Git에서 제외됩니다.

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

## 7. 휴대폰에서 보기

기본 주소 `127.0.0.1`은 **실행한 노트북 안에서만** 접속됩니다.
휴대폰 접속은 별도 선택 사항입니다. 앱은 Tailscale Serve의 사용자 인증 헤더와
`data/remote-access.json`의 본인 계정 허용 목록을 지원하지만 자동 설정하지 않습니다.
처음에는 노트북에서 사용하세요. 원격 접속을 구성한다면 본인의 Tailscale 사설망·계정만 허용하고,
공유기 포트 포워딩이나 공개 Funnel로 노출하지 마세요.

이 프로젝트는 GitHub Pages나 정적 사이트 업로드만으로 전체 기능을 실행할 수 없습니다.
로컬 Node 서버·SQLite·Garmin Python·Codex CLI가 필요합니다.

## 8. Linux·Windows

현재 배포 검증 기준은 macOS입니다. 아래 환경은 참고용이며 실기기 검증을 완료하지 않았습니다.

- **Linux:** Node 24, Python 3.12+, Git과 Codex CLI를 설치한 뒤 동일한 기본 명령을 사용합니다.
  `macos:install`은 사용할 수 없으며 터미널에서 `npm start`로 실행합니다.
- **Windows:** WSL2 안에 코드와 모든 런타임을 함께 설치하는 경로를 권장합니다.
  WSL2의 Linux 터미널에서 설치 단계를 진행하세요. Windows 네이티브 PowerShell 설치,
  자동 실행, 휴대폰 접속까지 검증한 설치 패키지는 아직 제공하지 않습니다.

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

실행 파일 경로를 직접 지정할 수도 있습니다.

```sh
cp .env.example .env
# .env를 편집한 다음 아래 명령으로 명시적으로 읽습니다.
node --env-file=.env server/index.mjs
```

`npm start`는 `.env`를 자동으로 읽지 않습니다. `PORT`, `AUTO_SYNC`, `GARMIN_PYTHON`,
`CODEX_BIN`은 선택 설정입니다. 계정 비밀번호나 토큰을 예제 파일에 넣지 마세요.
자동 실행은 설치 당시 PATH를 저장하며 별도 `.env` 파일을 자동으로 읽지 않습니다.
