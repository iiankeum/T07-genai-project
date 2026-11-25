> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 2026-11-25 · 검토: 아직 없음

# 결과 숫자 원본 — 아차(로컬) v0.1

[시험 기록](../시험-기록.md)의 숫자가 나온 곳이다. 녹음은 모두 **가짜**(합성 목소리 · 지어낸 내용)다.

| 파일 | 무엇 | 뽑은 법 |
|---|---|---|
| `효과-부품주문-전화-large-v3-turbo.txt` · `…-large-v3.txt` | 가짜 부품 주문 전화(83초)를 네 방법으로 받아쓴 오류율 · 낱말 맞힘 · 받아쓴 글 | `src/acha-local/tools/eval.py` `--show-text` · 22:1x 에 다시 뽑음 |
| `효과-AI수업-강의-large-v3-turbo.txt` · `…-large-v3.txt` | 가짜 AI 수업 강의(72초) — 같은 내용 | 위와 같음 |
| `원리-검사.txt` | 원리 검사 20개 결과 | `python -m unittest discover -s tests -v` |
| `힌트-자리-재기.txt` | 부품 · 차종 이름 56개가 힌트 자리(223 토큰)에 몇 개 들어가나 | Whisper large-v3 토크나이저 |
| `CPU-속도.txt` | 30초 녹음을 CPU 로 받아쓴 시간 — 겹친 상태 · 혼자 · MKL 켬/끔 | 시험 스크립트 출력을 옮겨 적음 |
| `설치본-시험.txt` | 설치본을 깔아 CPU · GPU 로 돌린 결과와 멈춘 일 · Release 파일 SHA-256 | 서버 요청 결과를 옮겨 적음 |

다시 뽑으려면 PR #48 의 `src/acha-local/` 에서 `tools/eval.py samples\가짜-부품주문-전화 glossary_stt\examples\자동차부품-가짜예시.csv --model large-v3-turbo --context "자동차 부품 대리점 주문 전화입니다." --show-text`. 그래픽 카드와 받아 둔 모델이 필요하다. 걸린 시간은 PC 마다 다르다.
