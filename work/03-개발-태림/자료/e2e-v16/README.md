> AI 초안 · 돌린 사람: 신*림 · 도구: Codex · 2026-11-18

# 가짜 데이터 브라우저 E2E 증거

이 폴더는 실제 고객 정보가 없는 로컬 서버의 캡처다. 데모와 비공개 서버를 임시 데이터 디렉터리로 각각 실행한다. 외부 AI 키를 전달하지 않고 `AI_PROVIDER=fixture`, `ALLOW_PAID_AI=0`으로 고정한다. 브라우저의 외부 출처 요청도 차단한다. `results.json`이 최종 실행 결과다.

| 파일 | 실제 검증 동작 |
|---|---|
| 01-call-desktop-fake.png | 거래처 근거 클릭 → 원문 문장 강조 → SVG 연결선 |
| 02-shipped-locked-fake.png | 품번·메모 저장, 불확실 항목 확인, 확정, 재연락 독립 유지, 출고 확인과 잠금 |
| 03-call-mobile-fake.png | 360×800 화면, 가로 넘침 검사 |
| 04-assistant-fixture.png | 질문 입력, 서버 근거 응답, ‘테스트 응답’ 구분 |
| 05-knowledge-pending-fake.png | 지식 초안 저장, 별도 관리자 승인 |
| 06-live-paused-fake.png | 샘플 대화 진행, 일시 정지, 중도 종료 후 저장 |
| 07-private-settings-fake.png | 가입, 일회 인증, 로그인, 비공개 작업공간 생성, 설정 열기 |
| 08-workspace-conflict-fake.png | 다른 탭에서 작업공간을 바꾼 뒤 이전 탭의 저장·내보내기가 409로 차단됨 |

가입 검증은 로컬 outbox의 가짜 이메일 인증 링크를 사용한다. 실제 이메일 배달, 실제 음성의 Whisper 인식 정확도, 유료 모델 품질을 검증한 결과가 아니다. 출고 후 다시 불러와 저장 유지, 잠긴 카드 수정 409, 출고 되돌리기, 비공개 작업공간의 데모 통화 접근 404도 스크립트로 확인한다.

```sh
cd src/app
npm ci
npx playwright install chromium
npm run test:e2e
```

기본 결과 경로는 `src/app/artifacts/e2e/`다. `E2E_OUTPUT_DIR`로 변경할 수 있다. 설치된 Chrome을 쓰는 경우 `E2E_CHROMIUM_PATH`를 지정한다. `PLAYWRIGHT_MODULE`은 개발 환경의 기존 설치를 사용할 때만 필요한 선택 옵션이다. 테스트는 5627·5628 포트를 사용하며 `E2E_DEMO_PORT`, `E2E_PRIVATE_PORT`로 변경한다.
