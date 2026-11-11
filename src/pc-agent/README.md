> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 한결(총괄·서버) 작업방 · 2026-11-11

# 콜노트 PC 프로그램 — 받아쓰기 일꾼 · 녹음 폴더 감시

킥오프에서 한결(총괄)이 맡은 「녹음 폴더 → 서버 전송 프로그램」과 「Whisper 등 PC 안 모델」의 첫 버전이다.
대표님 프로토타입(call-order-card)의 받아쓰기 부분(faster-whisper large-v3 · GPU · 낱말 사전 힌트)을 출발점으로 했다.

```
[녹음 폴더] ──watch──▶ POST /api/ingest ──▶ [데모 서버] ─ ffmpeg 로 16kHz WAV 변환 · 일감 줄 세움
                                                  ▲  │
                         [받아쓰기 일꾼(이 PC, GPU)] ─┘  └─ 받아쓴 글 → Claude 로 주문 카드
                          claim → WAV 받기 → Whisper → result
```

서버 API 는 개발(태림) 방의 [`src/app/docs/worker-api.md`](../app/docs/worker-api.md) v1 을 따른다.

## 두 가지 일

| 모드 | 하는 일 |
|---|---|
| `worker` | 서버에서 받아쓰기 일감을 가져와 이 PC 의 Whisper 로 받아쓰고 결과를 돌려준다. 20초마다 「살아 있음」을 알린다(끊기면 사이트에 「받아쓰기 일꾼 대기 중」). |
| `watch <폴더>` | 폴더에 새 녹음이 생기면 서버로 올린다. 아직 쓰는 중인 파일은 기다리고(크기 · 시각이 그대로일 때만), 같은 내용(SHA-256)은 두 번 올리지 않고, 서버가 바쁘거나 인터넷이 끊기면 30초 · 1분 · 2분 … 최대 30분 간격으로 다시 보낸다. |
| `run <폴더>` | 위 둘을 한 번에. |
| `send <파일>` | 파일 하나를 바로 올린다(시험용). |
| `check` | 서버 주소 · 토큰 유무 · 서버 응답 · GPU 를 확인한다. 토큰 값은 찍지 않는다. |

## 설치 (윈도우)

준비물: Python 3.10 이상. NVIDIA 그래픽카드가 있으면 빠르다(없으면 CPU 로 느리게 돈다). **ffmpeg 는 필요 없다** — 일꾼은 서버가 바꿔 둔 WAV 만 받는다.

```
cd src\pc-agent
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\pip install -r requirements-gpu.txt     # NVIDIA 그래픽카드가 있을 때만
```

처음 일꾼을 켜면 음성 인식 모델(약 3GB)을 내려받는다. 대표님 PC 에는 프로토타입 때 받은 것이 있어 바로 뜬다.

## 토큰 · 서버 주소

저장소 밖 비밀 폴더(`%USERPROFILE%\.t07-secrets\`)의 파일을 읽는다. 저장소에 넣지 않는다.

| 파일 | 줄 |
|---|---|
| `worker.env` | `SERVER_URL=https://t07.3-39-67-126.sslip.io` · `WORKER_TOKEN=…` |
| `ingest.env` | `SERVER_URL=…` · `INGEST_TOKEN=…` |

환경변수 `SERVER_URL` · `WORKER_TOKEN` · `INGEST_TOKEN` 이 있으면 그것이 먼저다. 토큰은 서버 관리자(한결 방)가 서버에서 만든 값이다.

## 실행

```
.venv\Scripts\python callnote_agent.py check
.venv\Scripts\python callnote_agent.py worker
.venv\Scripts\python callnote_agent.py watch D:\녹음\가짜통화
.venv\Scripts\python callnote_agent.py run D:\녹음\가짜통화 --name gpu-pc-1
.venv\Scripts\python callnote_agent.py send 가짜통화01.wav
```

- 멈출 때는 `Ctrl+C`. 받아쓰던 일감이 있으면 서버에 「다시 줄 세움」을 알리고 끝난다.
- 기록: `%LOCALAPPDATA%\callnote-agent\agent.log`, 폴더 감시 상태 `watch-<폴더 해시>.json`(어느 파일을 언제 올렸는지).
- 자주 쓰는 선택: `--skip-existing`(처음 켤 때 이미 있던 파일은 올리지 않음) · `--recursive`(하위 폴더까지) · `--device cpu` · `--model large-v3-turbo`.
- 재부팅 때 자동으로 켜는 설정은 아직 만들지 않았다(대표님이 정한다).

## 안전 약속

- **공개 데모 서버에는 가짜(연습) 녹음만 보낸다.** 프로그램은 `fake=true` 로 보내고, 서버는 가짜가 아닌 녹음을 거절한다. 실제 통화 녹음 폴더를 감시 폴더로 지정하지 않는다(실제 녹음은 동의 · 가림 절차를 정한 뒤 따로).
- 실제 통화 녹음 파일 이름에는 이름 · 전화번호가 들어가곤 해서, 기본으로 **중립 이름(`rec-<해시 앞 12자>.확장자`)** 으로 보낸다(`--keep-filename` 으로 끌 수 있다).
- 일꾼은 인터넷에서 누가 올렸는지 모르는 파일을 이 PC 의 디코더(ffmpeg)로 열지 않는다. 서버가 서버 안에서 16kHz mono 16bit WAV 로 바꾼 것만 받고, 파이썬 `wave` 로 형식 · SHA-256 을 확인한 뒤 읽는다. 약속과 다르면 받아쓰지 않고 실패로 돌려준다.
- 토큰은 `SERVER_URL` 과 같은 주소로만 보낸다. 일감이 다른 주소에서 오디오를 받으라고 하면 거절하고, 리다이렉트도 따라가지 않는다.
- 받아쓴 글 · 토큰 · 파일 경로는 로그에 찍지 않는다(길이 · 걸린 시간만).
- Whisper 가 녹음 끝 무음에서 지어내는 꼬리(「자막 제공 …」 「시청해 주셔서 감사합니다」)는 버리고 보낸다(프로토타입의 방식 + 자주 나오는 문장 몇 개).

## 시험

Whisper 없이 가짜 서버 · 가짜 받아쓰기로 돈다.

```
python -m unittest discover -s src/pc-agent/tests -v
```

확인하는 것: 일감 받기 → 받아쓰기 → 결과 보내기, 환각 꼬리 버리기, 다른 주소 · 형식이 다른 WAV 거절, 리다이렉트 안 따라감, 폴더 감시의 「쓰는 중 기다리기 · 중복 안 올리기 · 503 이면 미뤘다 다시 · 415 면 그만 · 원래 파일 이름(전화번호) 안 보내기 · 10MB 넘으면 안 보내기」.

## 파일

| 파일 | 내용 |
|---|---|
| `callnote_agent.py` | 프로그램 전체(표준 라이브러리 + faster-whisper · numpy) |
| `tests/test_agent.py` | 위 시험 |
| `requirements.txt` · `requirements-gpu.txt` | 설치 목록 |
