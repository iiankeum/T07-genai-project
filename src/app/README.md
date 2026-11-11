# 콜노트(가칭) 데모 사이트 — `src/app/`

> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 태림(개발) 작업방 · 2026-11-11 · 검토 전

자동차 부품 대리점의 **전화 주문 녹음 → 받아쓰기 → 주문 카드 → 확인 · 확정 → 출고**를 보여 주는 데모 사이트다.
**모든 통화는 가짜**다(거래처 · 차번호 · 전화번호 · 품번 모두 지어냄).

- 데모 주소: https://t07.3-39-67-126.sslip.io
- 설계: [docs/설계.md](docs/설계.md) · 일꾼 API: [docs/worker-api.md](docs/worker-api.md)
- 기능 목록(F01~F15)과 구현 상태: [work/03-개발-태림/산출물/구현-대조표.md](../../work/03-개발-태림/산출물/구현-대조표.md)

## 로컬에서 돌리기

준비물: Node.js 24 이상. (녹음 올리기를 시험하려면 ffmpeg · ffprobe)

```bash
cd src/app
npm ci
node server.mjs            # http://127.0.0.1:5600 — AI 키 없이도 화면이 뜬다(AI 기능만 「AI 키 없음」)
npm test                   # node --test test/
```

AI 까지 켜려면 저장소 **밖**의 env 파일을 읽게 한다(파일 내용은 출력하지 않는다).

```bash
node --env-file=C:\Users\pc\.t07-secrets\server.env server.mjs
```

데이터는 `DATA_DIR`(기본 `src/app/.data/`, 저장소에 안 올라감)에 쌓인다. 처음 뜰 때 가짜 통화 시드가 들어간다.

## 환경변수

| 이름 | 기본 | 뜻 |
|---|---|---|
| `PORT` · `HOST` | `5600` · `127.0.0.1` | 듣는 주소 |
| `DATA_DIR` | `src/app/.data` | DB(`callnote.sqlite`) · 오디오(`audio/`) — 앱이 쓰는 유일한 경로 |
| `PUBLIC_BASE_URL` | (없음) | 일꾼에게 주는 오디오 주소의 앞부분 |
| `ANTHROPIC_API_KEY` | (없음) | Claude API 키. 없으면 AI 기능만 꺼진다 |
| `CLAUDE_MODEL` | `claude-opus-5-5` | 카드 · 브리핑 · 묻기에 쓰는 모델 |
| `WORKER_TOKEN` | (없음) | 받아쓰기 일꾼 인증. 없으면 일꾼 API 꺼짐 |
| `INGEST_TOKEN` | (없음) | 녹음 PC 프로그램(ingest) 인증. 없으면 ingest 꺼짐 |
| `ADMIN_PASSCODE` | (없음) | 관리자(초기화 · 체험 신청 보기 · 지우기) 암호 |
| `DAILY_AI_LIMIT` · `DAILY_UPLOAD_LIMIT` | `400` · `100` | 하루 전체 상한(누구나 쓰는 데모라 비용 보호) |
| `PER_IP_DAILY_AI` | `40` | 한 기기(IP)가 하루에 쓸 수 있는 AI 횟수 |
| `MAX_UPLOAD_BYTES` · `MAX_AUDIO_SEC` | 10MB · 300초 | 올리기 제한 |
| `FFMPEG_PATH` · `FFPROBE_PATH` | `ffmpeg` · `ffprobe` | 변환기 |
| `S3_BUCKET` 등 | (없음) | 지금은 쓰지 않는다(오디오는 `DATA_DIR`) |

비밀값은 저장소 · 브라우저 · 응답 · 로그에 넣지 않는다. `.env` 는 `.gitignore` 에 있다.

빈도 제한(누구나 쓰는 데모): AI 는 IP 당 10분 12번 · 하루 40번 · 전체 하루 400번, 녹음 올리기는 IP 당 1시간 시도 30번 · 받아들이는 것 10건 · 전체 하루 100건, 동시에 받는 녹음은 2개(넘으면 503 busy).

시드 시각: 가짜 통화 54건은 서버가 10분마다 「오늘」에 맞춰 다시 놓는다. 08:05 KST 전(영업 전)에는 어제 하루로 두고 첫 화면은 「어제 흐름」을 안내와 함께 보여 준다. 그 뒤로는 오늘 통화를 08:00~지금 사이에 원래 간격 비율로 놓다가, 원래 시각이 지나면 원래 시각으로.

## 배포

`dev` 가지에 푸시하면 서버(han-ops 가 만든 자동 배포 장치)가 1분 안에 당겨 `npm ci --omit=dev` 후 `node src/app/server.mjs` 로 다시 띄운다.
30초 안에 `/healthz` 가 200 이 아니면 앞 버전으로 되돌린다. 결과는 `/_deploy/status.json`. 빌드 단계는 없다.

## 구조 한눈에

```
server.mjs        진입점 — routes/*.mjs 를 모두 읽어 주소를 단다
lib/              설정 · DB(node:sqlite) · 보안 · AI(Claude) · 카드 검증 · 오디오 변환 · 일감 줄 · 시드
routes/           API (설계.md 5.3 의 표)
public/           화면(빌드 없는 ES 모듈, 해시 라우팅, PWA)
tools/            attach-seed-audio.mjs(시드에 합성 음성 붙이기) · folder-sender.mjs(개발용 간이판 — F12 정본은 src/pc-agent/)
seed/             가짜 데모 통화 · 사전 · 거래처
test/             node --test
```
