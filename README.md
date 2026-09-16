# Stride

**내 노트북에 기록을 보관하는 개인용 러닝 웹앱.**

로드·트레일 러닝 기록, 훈련 계획, Garmin 활동 분석과 AI 코칭을 한곳에서 관리합니다.
한국어 UI와 모바일 반응형 화면을 제공합니다. 각 사용자가 자기 컴퓨터에 설치하고
자신의 Garmin·ChatGPT 계정을 연결하는 방식입니다.

## 설치

**[한글 설치 가이드 →](docs/INSTALL.ko.md)**

Node.js 24와 Git이 준비된 macOS 터미널에서:

```sh
git clone https://github.com/leewnsdud/stride.git
cd stride
npm ci
npm run build
npm start
```

브라우저에서 **http://127.0.0.1:4318** 을 엽니다. 중지는 `Ctrl+C`입니다.
첫 실행은 빈 개인 기록으로 시작합니다. 계정 연결 없이도 수동 기록·훈련 관리를 사용할 수 있습니다.
Garmin 가져오기는 Python 3.12 이상의 별도 환경, AI 코칭은 Codex CLI와 본인의 ChatGPT 로그인이 필요합니다.
두 연동의 설정법과 Mac 자동 실행은 설치 가이드를 확인하세요.
휴대폰 접속은 [Tailscale 연결 안내](docs/INSTALL.ko.md#tailscale)를 따라 설정할 수 있습니다.

| 기능 | 필요한 연결 |
| --- | --- |
| 수동 기록·분석·훈련 계획 생성과 적용 | 외부 계정 없이 사용 |
| Garmin 활동 동기화 | 본인 Garmin 계정 |
| 새 AI 리뷰·코칭 답변·계획에 관한 AI 질문 | 본인 ChatGPT/Codex 연결 |
| 휴대폰에서 노트북의 기록 보기 | 두 기기의 Tailscale 연결 |

현재 macOS에서 검증했습니다. Linux·Windows WSL2 설치 방법은 참고용이며 해당 OS 실기기 검증은 아직 하지 않았습니다.
여러 사람이 하나의 서버를 공유하는 서비스나 인터넷 공개 서버 용도는 지원하지 않습니다.

## 주요 기능

- 주간 대시보드, 러닝 캘린더, 월 단위 거리·훈련 추이
- 수동 활동 기록, Garmin Connect 활동 및 상세 지표 가져오기
- GPS 지도, 페이스·심박·파워·러닝 다이내믹스와 랩 분석
- 활동별 AI 리뷰와 후속 대화, AI 코칭 탭의 동일 대화 연결
- 로드·트레일·병행 훈련 계획 상담과 검토 후 일정 적용
- 기록 검색, 계획과 활동 연결, 휴지통 복원, JSON 내보내기·SQLite 백업

AI·추정 지표는 참고 자료입니다. 통증·부상 진단이나 의료 판단을 제공하지 않습니다.
Garmin 연동은 비공식 라이브러리를 사용하며 Garmin·OpenAI의 공식 제품이 아닙니다.

## 개인정보

이 저장소에는 운영자의 활동 기록, GPS 경로, 대화, 로그인 토큰, 백업 또는 개인 서버 주소를 포함하지 않습니다.
앱을 실행하면 **각자의 로컬 `data/` 폴더**에 데이터가 만들어집니다. 로컬 DB는 암호화되지 않으므로
운영체제 계정·디스크 암호화로 보호하세요.

AI 질문을 전송하면 선택한 기록·메모·질문과 대화 문맥이 OpenAI로 전달됩니다.
지도·웹폰트는 외부 서비스를 사용합니다. 로컬 저장은 모든 통신이 오프라인이라는 뜻이 아닙니다.
자세한 범위는 **[데이터 저장과 외부 전송 안내](docs/PRIVACY.ko.md)**를 확인하세요.

## 개발

```sh
npm run dev          # 화면 4317 / API 4318
npm test             # 임시 DB·모의 연동으로 검사
npm run build
npm run test:build
npm run check:privacy
```

실제 계정을 이용한 AI 호출은 기본 테스트에 포함하지 않습니다.
`src/`는 React UI, `server/`는 Express·SQLite·연동, `shared/`는 공통 계산,
`skills/running-coach/`는 코칭 지침입니다.

- [기여 안내](CONTRIBUTING.md)
- [보안 제보](SECURITY.md)
- [서드파티 고지](NOTICE.md)

## 라이선스

[MIT](LICENSE). 포함된 서드파티 폰트·아이콘은 각 원저작자의 라이선스를 따릅니다.
