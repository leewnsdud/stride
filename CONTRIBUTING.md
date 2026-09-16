# 기여 안내

Node.js 24를 사용하고 `npm ci`로 의존성을 설치합니다.

```sh
npm run dev
npm test
python3 -m unittest discover -s tests -p 'test_garmin_bridge.py'
npm run build
npm run test:build
npm run check:privacy
```

테스트는 임시 DB와 모의 연동을 사용합니다. 실제 Garmin·AI 계정으로 테스트를 자동 실행하지 마세요.
새 테스트 자료는 합성 데이터를 사용하고 운영 DB·응답·사진을 복사하지 마세요.

Pull Request에는 변경 목적, 확인한 동작, 남은 제약을 적어주세요.
공개 파일은 `.gitignore` 허용 목록으로 관리합니다. 새로운 문서를 추가하려면 그 파일만
허용하고 스테이징된 내용을 검토하세요. `git add -f`로 개인 파일을 강제 추가하지 마세요.

제출한 기여는 이 프로젝트의 MIT 라이선스로 제공됩니다. 서드파티 자료는 원저작자 고지를 보존하세요.
