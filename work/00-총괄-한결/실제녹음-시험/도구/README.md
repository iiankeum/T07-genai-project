> AI 초안 · 돌린 사람: 배*결 · Claude Code(Fable 5.2) · 2026-11-24 · 검토: 아직 없음

# 실제 녹음 시험 도구

[시험 기록](../시험-기록.md)의 숫자를 뽑은 스크립트다. 제품 코드가 아니고, 한 번 쓴 시험 도구를 기록으로 남긴 것이다.

도구가 실제로 낸 글은 [결과-숫자/](../결과-숫자/README.md)에 있다.

**모든 도구는 개수 · 길이 · 시간만 출력한다.** 받아쓴 글 · 카드 값 · 파일 이름은 출력하지 않는다. 고칠 때도 이 약속을 지킨다.

## 무엇이 있나

| 파일 | 하는 일 | 자료를 바꾸는가 |
|---|---|---|
| `_paths.mjs` | 시험 자료 위치를 환경변수에서 읽는다 | — |
| `setup-account.mjs` | PC 안 시험 서버에 시험 계정 · 작업공간 · 녹음 연결 토큰을 만든다 | 만든다(시험 폴더에만) |
| `stats.mjs` | 통화 상태 · 녹음 길이 · 받아쓰기 시간 · 글 길이 | 읽기만 |
| `quiet-calls.mjs` | 글이 거의 안 나온 통화의 소리 크기(ffmpeg) | 읽기만 |
| `make-cards.mjs` | 받아쓰기가 끝난 통화의 카드를 v1.6 코드로 하나씩 만든다 | **바꾼다** |
| `card-stats.mjs` | 카드의 칸이 찼는지 · 경고 종류 | 읽기만 |
| `grounding.mjs` | 카드 값이 받아쓴 글에 있는지 · 프롬프트 예시와 같은지 | 읽기만 |
| `model-times.mjs` | Ollama 기록에서 카드 만들기 호출 시간 | 읽기만 |
| `compare-models.mjs` | 같은 통화를 두 모델로 정리한 카드를 통화별로 견준다(종류 · 칸 · 품목 · 수량 · 경고) | 읽기만 |
| `pick-samples.py` | 상호 · 이름 · 번호 · 주소가 안 나오는 통화를 고른다([예시 녹음](../예시-녹음/README.md)) | 읽기만 |
| `build-samples.py` | 고른 통화의 첫머리를 자르고 파일 꼬리표를 지워 예시 파일을 만든다 | 만든다(시험 폴더에만) |
| `recheck-samples.py` | 만든 예시 파일을 다시 받아써서 가림 검사를 한 번 더 한다 | 읽기만 |

## 미리 정할 것

| 환경변수 | 뜻 | 기본값 |
|---|---|---|
| `ACHA_TEST_HOME` | 시험 서버의 자료 폴더(서버 설정의 `DATA_DIR` 은 이 아래 `data`) | 사용자 홈의 `.t07-real/acha-v16` |
| `ACHA_WS_ID` | 작업공간 번호 | 시험 폴더의 `workspace-id.txt` |
| `ACHA_APP_DIR` | 시험하는 아차 코드의 `src/app` 폴더 | 없음 — `make-cards` · `grounding` 에 꼭 준다 |
| `ACHA_TEST_URL` | 시험 서버 주소(`setup-account` 만) | `http://127.0.0.1:5610` |
| `ACHA_PC_AGENT_DIR` | 아차 코드의 `src/pc-agent` 폴더(`pick-samples` · `recheck-samples` — 가림 코드를 쓴다) | 없음 — 꼭 준다 |
| `ACHA_INBOX_DIR` | 원본 녹음이 있는 폴더(`build-samples` 만) | 없음 — 꼭 준다 |
| `ACHA_SAMPLE_DIR` | 고른 목록과 만든 예시 파일을 두는 폴더(저장소 밖) | 사용자 홈의 `.t07-real/samples/work` |

Node.js 24 가 필요하다(`node:sqlite`). `quiet-calls.mjs` 는 ffmpeg 가 있어야 한다. `.py` 도구는 파이썬 3 과 ffmpeg 가 필요하고, `pick-samples.py` 는 PC 안 모델(Ollama)이, `recheck-samples.py` 는 받아쓰기 일꾼의 파이썬(faster-whisper)이 있어야 한다.

## 돌리는 순서

1. 아차 서버를 `HOST=127.0.0.1` · `DEMO_MODE=0` · `AUTH_MAIL_MODE=outbox` 로 켠다. 설정 파일은 시험 폴더에 두고 저장소에 넣지 않는다.
2. `node setup-account.mjs` — 서버 설정 파일에 작업공간 번호가 적히면 서버를 다시 켠다.
3. 받아쓰기 일꾼을 켜고 녹음을 넣는다. `src/pc-agent/callnote_agent.py` 의 `worker` 와 `send <파일> --not-fake` 를 쓴다. **`--server` 에 PC 안 주소를 꼭 적는다.**
4. `node stats.mjs` · `node quiet-calls.mjs`
5. 서버를 끄고, `AI_PROVIDER=ollama` 인 설정 파일로 `node --env-file=<설정 파일> make-cards.mjs` 를 돌린다. `--dry-run` 을 붙이면 대상 건수만 보여 주고 아무것도 바꾸지 않는다.
6. `node card-stats.mjs` · `node grounding.mjs` · `node model-times.mjs`
7. 다른 모델로 다시 잴 때만: 시험 폴더를 통째로 베끼고, 작업공간의 `callnote.sqlite` 를 받아쓰기만 끝난 상태의 사본으로 바꾼다. 베낀 폴더의 설정 파일에서 `OLLAMA_MODEL` 과 `DATA_DIR` 만 고치고 `ACHA_TEST_HOME` 을 그 폴더로 주어 5 ~ 6번을 다시 돌린다. 그 뒤 `node compare-models.mjs <처음 폴더> <베낀 폴더>`. `model-times.mjs` 에는 그 실행 구간만 잘라 낸 Ollama 기록을 준다.
8. 예시 녹음을 고를 때만: `python pick-samples.py 11` → 후보를 정한 뒤 `python build-samples.py <후보 번호>:<앞에서 자를 초> …` → `recheck-samples.py`. 세 도구는 숫자만 낸다. 고른 통화의 글을 읽어 확인하는 일은 도구에 넣지 않았다(가림 코드를 통과한 글만 일회용으로 읽었다).

## 지킬 것

- 실제 녹음은 공개 데모 서버에 보내지 않는다. `setup-account.mjs` 는 PC 안 주소가 아니면 멈춘다.
- 실제 녹음 · 받아쓴 글 · 카드 · 서버 설정 파일 · 토큰을 저장소에 넣지 않는다([AGENTS.md](../../../../AGENTS.md)의 「AI 작업 기록 규칙」). 예외는 총괄이 정한 [예시 녹음 5개](../예시-녹음/README.md)뿐이다.
- 출력에 통화 내용이 섞이는 도구를 여기에 추가하지 않는다.
