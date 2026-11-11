# 작업 기록 — 03-개발-태림

새 기록을 맨 위에 쓴다. 형식은 [work/README.md](../README.md) 참고.

<!-- 새 기록은 이 줄 바로 아래에 -->

## 2026-11-11 22:44 KST · 첫 배포 뼈대 · 일꾼 API v1
- 돌린 사람 · 도구: 배*결(dmms0830-lang) · Claude Code(Opus 5.5) · 태림(개발) 작업방
- 한 일: `src/app/` 에 데모 서버 뼈대(Node 24 · ESM · 빌드 없음)를 만들었다 — `/healthz`(커밋 해시) · `/api/meta` · 보안 헤더(CSP 등) · IP 별 빈도 제한 · 하루 상한 · 관리자 세션 · node:sqlite 표 구조. 받아쓰기 일꾼 · 녹음 넣기 API 를 [worker-api.md](../../src/app/docs/worker-api.md) v1 로 확정했다.
- 왜: 배포 약속 v1(han-ops)에 맞춰 첫 화면 + /healthz 를 1시간 안에 올려 자동 배포를 함께 확인하고, 일꾼 쪽이 기다리지 않게 API 를 먼저 못 박기 위해.
- 어떻게: 회의록 · 아이디어 문서 · 세 프로토타입(태림 님 시안 callnote, 남희 님 phone-order-transcriber, 대표님 call-order-card)을 읽고 시작. 대표님 프로토타입의 카드 규칙(품번을 지어내지 않음 · 「들어 보기」 표시)과 남희 님 프로토타입의 상태 흐름(확인 필요 → 확정 → 출고)을 잇는다. Claude 호출 전에 `claude-api` 스킬로 모델 · 구조화 출력 · 거절 처리 문법을 확인했다(`@anthropic-ai/sdk` 1.8.0, `claude-opus-5-5`). 에이전트 0.
- 결과물: [src/app/server.mjs](../../src/app/server.mjs) · [src/app/lib/](../../src/app/lib/) · [worker-api.md](../../src/app/docs/worker-api.md)
- AI 가 판단한 것 · 사람이 확인할 것: 의존성은 Claude SDK 하나만 쓴다(multipart 는 웹 표준 `Request.formData()`). DB 는 node:sqlite. 공개 데모는 `fake=true` 인 녹음만 받는다.
- 다음 할 일: 설계.md(기능목록 v0 의 F01~F15 ↔ 모듈 대응) → 기능 모듈 병렬 구현.

