# 받아쓰기 일꾼 API · 녹음 넣기 API — v1

> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 태림(개발) 작업방 · 2026-11-11
> 이 문서의 주인은 태림(개발) 방이다. 바꿀 때는 버전을 올리고 han-ops(서버) 방에 알린다.

## 한눈에

```
[녹음 PC 프로그램]──POST /api/ingest──▶ [데모 서버] ◀──claim / result── [받아쓰기 일꾼 (GPU PC, Whisper)]
[웹 화면 녹음 올리기]──POST /api/calls/upload──▶ │
                                              ├─ ffmpeg 로 16kHz mono WAV 로 바꿔 저장
                                              ├─ 받아쓰기 일감을 줄 세움 (일꾼이 없으면 「받아쓰기 일꾼 대기 중」)
                                              └─ 받아쓴 글이 오면 Claude 로 주문 카드 초안 → 대시보드 · 찾기 · 묻기
```

- 일꾼은 **서버에 접속만** 한다(서버가 일꾼에게 접속하지 않는다). 그래서 일꾼 PC 는 방화벽을 열 필요가 없다.
- 일꾼은 서버가 바꿔 둔 **16kHz mono WAV 만** 받는다. 사용자가 올린 원본 파일은 일꾼 PC 로 가지 않는다.
- 모든 주소는 `PUBLIC_BASE_URL` 기준이다. 데모: `https://t07.3-39-67-126.sslip.io`

## 인증

| 쓰는 곳 | 헤더 | 서버 환경변수 |
|---|---|---|
| 받아쓰기 일꾼 | `Authorization: Bearer <WORKER_TOKEN>` | `WORKER_TOKEN` |
| 녹음 PC 프로그램 | `Authorization: Bearer <INGEST_TOKEN>` | `INGEST_TOKEN` |

- 토큰이 틀리면 `401 {"error":"unauthorized"}`. 서버에 그 환경변수가 비어 있으면 그 API 는 꺼져 있고 `503 {"error":"disabled"}`.
- 토큰 값은 저장소 · 로그 · 화면에 쓰지 않는다. 일꾼 PC 에서는 환경변수나 저장소 밖 파일(예: `C:\Users\pc\.t07-secrets\worker.env`)로 읽는다.
- 모든 요청 · 응답 본문은 `application/json; charset=utf-8` (오디오 받기 · ingest 업로드 제외).

## 일꾼 API

### 1. `POST /api/worker/heartbeat` — 살아 있음 알리기

20초마다 보낸다. 마지막 신호가 **60초** 넘게 없으면 화면에 「받아쓰기 일꾼 대기 중」이 뜬다(claim 도 신호로 친다).

요청
```json
{"worker": "gpu-pc-1", "engine": "faster-whisper large-v3", "gpu": "RTX 5060 Ti 16GB", "version": "0.1.0"}
```
- `worker`: 일꾼 이름(영문 · 숫자 · `-` · `_`, 40자 이하). 여러 대를 돌리면 이름을 다르게.

응답 `200`
```json
{"ok": true, "serverTime": "2026-11-11T14:00:00.000Z", "queue": {"waiting": 2, "working": 0}}
```

### 2. `POST /api/worker/claim` — 일감 하나 가져오기

요청
```json
{"worker": "gpu-pc-1"}
```

응답
- `204` (본문 없음) — 일감이 없다. 3~5초 뒤 다시 묻는다.
- `200` — 일감 하나를 이 일꾼에게 맡겼다(임대). `leaseSec` 안에 result 나 fail 을 보내야 한다. 시간이 지나면 일감은 다시 줄로 돌아가고, 3번 넘게 돌아오면 실패로 끝난다.

```json
{
  "jobId": "job_01J...",
  "callId": "call_01J...",
  "audioUrl": "https://t07.3-39-67-126.sslip.io/api/worker/jobs/job_01J.../audio",
  "audioFormat": "wav-16k-mono-s16le",
  "audioBytes": 1920044,
  "audioSha256": "9f2c...",
  "durationSec": 60.0,
  "language": "ko",
  "initialPrompt": "자동차 부품 대리점 주문 전화입니다. 휀다, 쇼바, 라지에다, ...",
  "glossary": [{"term": "휀다", "standard": "펜더"}],
  "customers": ["새한카센터", "우리공업사"],
  "carModels": ["아반떼 CN7", "쏘나타 DN8"],
  "leaseSec": 600
}
```
- `initialPrompt` 는 Whisper `initial_prompt` 에 그대로 넣는다(낱말 사전의 현장 말을 이은 것).
- `glossary` · `customers` · `carModels` 는 참고용이다. 고쳐 읽기는 서버의 카드 추출(Claude)이 한다. 일꾼은 받아쓴 그대로 돌려준다.

### 3. `GET /api/worker/jobs/:jobId/audio` — 오디오 받기

- 같은 `Authorization: Bearer <WORKER_TOKEN>`.
- 이 일감을 임대한 동안에만 받을 수 있다(아니면 `409`).
- 응답: `200 audio/wav` — 16kHz · mono · 16bit PCM WAV. `Content-Length` 와 claim 의 `audioSha256` 로 확인할 수 있다.

### 4. `POST /api/worker/jobs/:jobId/result` — 받아쓴 결과 보내기

요청
```json
{
  "worker": "gpu-pc-1",
  "text": "네 부품입니다. 예 새한카센터인데요 ...",
  "segments": [
    {"start": 0.0, "end": 1.4, "text": "네, 부품입니다."},
    {"start": 1.6, "end": 5.2, "text": "예, 새한카센터인데요. 아반떼 AD 앞범퍼 하나 있어요?", "speaker": "A"}
  ],
  "engine": "faster-whisper large-v3 (cuda, float16)",
  "durationSec": 24.3,
  "elapsedSec": 1.9,
  "language": "ko"
}
```
- `segments[].start/end` 는 초(소수 첫째 자리면 충분). 화면에서 그 대목부터 녹음을 들려 줄 때 쓴다.
- `speaker` 는 있으면 넣는다(화자 분리를 안 하면 빼도 된다).
- 제한: `text` 20,000자 · `segments` 2,000개 · 한 segment 의 `text` 1,000자. 넘으면 `413`.
- Whisper 가 녹음 끝 무음에서 지어내는 꼬리(「자막 제공 ...」 등)는 일꾼이 버리고 보낸다(대표님 프로토타입 `ordercard.py` 의 방식).

응답 `200`
```json
{"ok": true, "callId": "call_01J...", "next": "extracting"}
```
- 서버는 이어서 Claude 로 주문 카드 초안을 만든다(일꾼은 기다리지 않는다).
- 이미 끝났거나 다른 일꾼이 임대한 일감이면 `409 {"error":"not_leased"}`.

### 5. `POST /api/worker/jobs/:jobId/fail` — 실패 알리기

```json
{"worker": "gpu-pc-1", "error": "ffmpeg decode error", "retryable": true}
```
- `retryable: true` 면 줄 맨 뒤로 돌아간다(최대 3번). `false` 면 바로 실패로 끝나고 화면에 이유가 보인다.
- `error` 는 500자 이하. 파일 경로 · 토큰을 넣지 않는다.

### 6. `GET /api/worker/status` — 일꾼 상태(공개, 토큰 없음)

화면이 쓰는 공개 정보다. 비밀값은 없다.
```json
{"online": true, "lastSeen": "2026-11-11T14:00:00.000Z", "worker": "gpu-pc-1", "engine": "faster-whisper large-v3", "gpu": "RTX 5060 Ti 16GB", "queue": {"waiting": 0, "working": 1}}
```

## 녹음 넣기 API (PC 프로그램 → 서버)

### `POST /api/ingest`

- `Authorization: Bearer <INGEST_TOKEN>`
- `Content-Type: multipart/form-data`

| 필드 | 필수 | 설명 |
|---|---|---|
| `file` | ✔ | 녹음 파일. wav · mp3 · m4a · aac · amr · ogg · opus · webm · 3gp · flac. 10MB · 5분 이하 |
| `recordedAt` | ✔ | 녹음 시각 ISO 8601 (예: `2026-11-11T14:42:00+09:00`). 파일 수정 시각을 써도 된다 |
| `deviceName` | ✔ | 보낸 PC 이름(40자 이하). 예: `fake-sender-1` |
| `callerNumber` | | 걸려 온 번호. **공개 데모에서는 가짜 번호만**. 화면에는 가운데를 가려 보여 준다 |
| `title` | | 파일 이름 대신 보일 이름(선택) |
| `fake` | | 가짜 통화면 `true`. 공개 데모는 `true` 만 받는다(아니면 `422 real_recording_not_accepted`) |

응답
- `201 {"callId":"call_...","jobId":"job_...","status":"queued"}`
- `200 {"callId":"call_...","status":"duplicate"}` — 같은 파일(SHA-256)이 이미 들어와 있다. 다시 보내도 안전하다.
- `413` 크기 초과 · `415` 오디오가 아님 · `422` 5분 초과 또는 읽을 수 없는 오디오 · `429` 너무 자주 보냄 · `503 converter_missing` 서버에 ffmpeg 가 없음.

## 웹 화면 녹음 올리기 (참고)

`POST /api/calls/upload` — 누구나 쓰는 화면용. 토큰 대신 IP 별 빈도 제한(시간당 5건) + 하루 전체 상한(100건). 형식 · 크기 · 길이 제한은 ingest 와 같다. 공개 데모에서는 「가짜(연습) 녹음만 올리세요」 안내와 확인 체크를 받는다.

## 일꾼 쪽 의사코드

```python
while True:
    post("/api/worker/heartbeat", info)            # 20초마다
    r = post("/api/worker/claim", {"worker": name})
    if r.status == 204: sleep(4); continue
    job = r.json()
    wav = get(job["audioUrl"])                     # 16k mono WAV
    try:
        segs = whisper.transcribe(wav, language="ko", initial_prompt=job["initialPrompt"], vad_filter=True)
        post(f"/api/worker/jobs/{job['jobId']}/result", {...})
    except Exception as e:
        post(f"/api/worker/jobs/{job['jobId']}/fail", {"error": str(e)[:300], "retryable": True})
```

## 구현에서 정해진 것(v1.1 보탬 — 호환됨)

- claim 의 `audioUrl` 에는 `?worker=<이름>` 이 붙는다. 오디오 받기는 그 일감을 임대한 일꾼만, 임대 기한 안에서만 된다(`X-Worker` 헤더도 됨).
- claim 응답에 `attempt`(몇 번째 시도) 칸이 있다.
- 다시 줄에 선 일감은 「마지막으로 가져간 시각」 기준으로 줄 뒤에 선다.
- 실패했던 통화를 같은 파일로 다시 ingest 하면 `200 {status:"duplicate", requeued:true}` 로 다시 줄에 선다.
- ingest 빈도 제한: IP 당 10분 300번 · 하루 1000건.
- 시드(가짜 대본) 통화에 합성 음성을 붙이는 관리 주소: `POST /api/admin/seed-audio` (Bearer INGEST_TOKEN, multipart `callId` · `file`). 도구: `tools/attach-seed-audio.mjs`.

## 바뀐 기록
- v1.1 (2026-11-11 23:30) — 위 「구현에서 정해진 것」 보탬. 일꾼 쪽 바꿀 것 없음.

- v1 (2026-11-11) — 첫 확정. 초안 v0 에서 바꾼 점: claim 응답에 `callId · audioSha256 · durationSec · initialPrompt · carModels · leaseSec` 추가, `GET /api/worker/status` 추가, ingest 에 `fake` · `title` 추가, 중복 파일은 `200 duplicate`.
