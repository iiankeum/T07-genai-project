> AI 초안 · 돌린 사람: 배*결 · Claude Code(Fable 5.2) · 2026-11-24 · 검토: 아직 없음

# 도구가 낸 숫자 원본

[시험 기록](../시험-기록.md)의 숫자가 나온 곳이다. [도구](../도구/README.md)가 화면에 낸 글을 고치지 않고 그대로 담았다.

**통화 내용은 없다.** 개수 · 길이 · 시간뿐이다. 올리기 전에 전화번호 · 차번호 · 경로 · 작업공간 번호 · 비밀값 꼴이 있는지 검사했고 걸린 곳이 없었다.

## 파일

| 파일 | 낸 도구 | 무엇 |
|---|---|---|
| `stats.txt` | `stats.mjs` | 통화 상태 · 녹음 길이 · 받아쓰기 시간 · 글 길이. 맨 끝 「카드」 줄은 qwen3:4b 카드 기준이다 |
| `quiet-calls.txt` | `quiet-calls.mjs` | 글이 거의 안 나온 통화의 소리 크기 |
| `qwen3-4b-make-cards.log` | `make-cards.mjs` | qwen3:4b 로 카드를 만든 진행 기록. 본 195건만 있다 — 먼저 해 본 5건의 기록은 남아 있지 않다 |
| `qwen3-4b-card-stats.txt` | `card-stats.mjs` | qwen3:4b 카드의 칸이 찼는지 · 경고 종류 |
| `qwen3-4b-grounding.txt` | `grounding.mjs` | qwen3:4b 카드의 값이 받아쓴 글에 있는지 |
| `qwen3-4b-model-times.txt` | `model-times.mjs` | qwen3:4b 호출 200번의 시간. 카드를 만든 구간(11/23 밤 ~ 11/24 00시대)의 Ollama 기록만 잘라서 뽑았다 |
| `qwen3-14b-make-cards.log` | `make-cards.mjs` | qwen3:14b 로 카드를 만든 진행 기록(먼저 5건 · 그다음 195건) |
| `qwen3-14b-card-stats.txt` | `card-stats.mjs` | qwen3:14b 카드의 칸이 찼는지 · 경고 종류 |
| `qwen3-14b-grounding.txt` | `grounding.mjs` | qwen3:14b 카드의 값이 받아쓴 글에 있는지 |
| `qwen3-14b-model-times.txt` | `model-times.mjs` | qwen3:14b 호출 200번의 시간 |
| `compare-models.txt` | `compare-models.mjs` | 같은 통화를 두 모델이 어떻게 다르게 봤는지(A = qwen3:4b · B = qwen3:14b) |

## 읽을 때 알아 둘 것

- 「공개 프롬프트의 예시를 그대로 가져온 값」 줄에 나오는 낱말(「우리공업사」 「아반떼 AD」 「34나5678」 따위)은 고객 자료가 아니다. `src/app/lib/ai.mjs` 같은 공개 코드에 적힌 예시와 글자가 같은 값만 출력하게 만들었다.
- 그 줄의 「null」은 모델이 값 대신 글자 그대로 「null」이라고 적은 것이다(시험 기록 5절 12번).
- `card-stats` 의 「빈 카드 통화의 글 길이 · 녹음 길이」는 통화 하나하나의 숫자다. 어느 통화인지는 적혀 있지 않다.
- `stats.txt` 와 `quiet-calls.txt` 는 11/24 13:49 에 다시 뽑았다. 받아쓴 글은 11/23 밤 이후 바뀌지 않았다.
- 다시 뽑으려면 같은 자료가 있어야 한다. 자료는 총괄 PC 안에만 있다.
