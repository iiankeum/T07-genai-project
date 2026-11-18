# 아맞다 웹 서버

> AI 초안 · 돌린 사람: 신*림 · Codex · 2026-11-18

Node.js 24 · ES 모듈 · SQLite로 실행한다. 화면은 빌드 없이 정적 파일로 제공한다. 운영 설치와 데이터 백업은 [자가 호스팅 안내](../../docs/self-hosting.md)를 따른다.

## 개발 환경에서 실행

```sh
cd src/app
npm ci
npm run start:offline
```

[http://127.0.0.1:5600](http://127.0.0.1:5600)에서 가짜 샘플을 사용한다. `start:offline`은 fixture를 선택하고 유료 AI 호출을 끈다. 이름의 offline은 테스트 모드를 뜻하며 실제 로컬 모델 추론이 아니다. 실제 로컬 모델은 Ollama를 별도로 설치하고 `AI_PROVIDER=ollama`로 Node를 직접 실행한다. Docker는 필수가 아니다. [Mac 앱 안내](../../docs/mac-app.md)는 앱 빌드·음성 모델·언어 모델 준비와 검증 범위를 나눈다. 직접 설정해서 실행하려면 `.env.example`을 `.env`에 복사하고 `node --env-file=.env server.mjs`를 실행한다. `.env` 파일은 Git에서 제외한다.

## 테스트

```sh
npm test
npm run test:offline
```

업로드·오디오 변환을 시험하려면 `ffmpeg`와 `ffprobe`를 PATH에 둔다. 일반 테스트와 오프라인 테스트는 유료 API 키 없이 실행한다. 오프라인 테스트는 합성 WAV·받아쓰기 일꾼 대역·AI fixture로 업로드부터 카드 저장까지 확인한다. fixture는 미리 준비한 샘플을 재현한다. 모델 품질과 지연 시간은 별도로 측정한다.

## 주요 경로

| 경로 | 역할 |
|---|---|
| `server.mjs` · `routes/` | HTTP 서버와 API |
| `lib/` | SQLite · 인증 · 오디오 변환 · 일감 · 카드 검증 · AI 호출 |
| `public/` | 웹 화면과 실시간 받아쓰기 |
| `seed/` | 공개 데모 전용 가짜 통화·사전 |
| `tools/` | 개발·운영 보조 도구 |
| `test/` | Node.js 테스트 |

[시스템 구조](../../docs/architecture.md) · [기존 데모 설계](docs/설계.md) · [받아쓰기 일꾼 API](docs/worker-api.md)

## 기존 팀 데모 배포

팀의 `dev` 가지 푸시는 기존 데모 배포를 시작한다. 서버는 `npm ci --omit=dev` 후 `node src/app/server.mjs`로 뜬다. 상태는 `/healthz`와 `/_deploy/status.json`을 확인한다. 팀 데모에 올리는 모든 녹음은 가짜다.
