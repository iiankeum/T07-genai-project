# 그림 만든 법

> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 남희(기획) 작업방 · 2026-11-11

- 그린 도구: Codex 명령줄(`codex exec`, 모델 `gpt-5.6-sol`)의 내장 그림 기능 — 대표님 ChatGPT 구독. 다른 유료 크레딧은 쓰지 않았다.
- 순서: ① 캐릭터 시트(`briefs/char-sheet.txt` → `../char-sheet.png`)를 먼저 그리고 ② 장면마다 그 시트를 참고 그림으로 넣어 같은 인물 · 같은 화풍으로 그렸다(`scenes.py` 의 `SCENES`).
- 규칙: 그림 안에 글자 · 숫자 · 로고를 넣지 않는다(한글이 깨지기 쉽고, 실제 회사 로고를 피하려고). 글은 기획서 HTML 에서 얹는다. 화면은 모양만 그린다.
- 인물(박 부장 · 김 사장 · 이 기사)은 모두 지어낸 가짜 인물이다.
- 저장소에는 가로 1400px · 256색 PNG 로 줄여 넣었다(`publish.py`). 원본(1536px)은 작업 PC 에만 있다.
- 다시 그리기: `python scenes.py briefs` → `python scenes.py run 4 <id>` (작업 폴더에 `ref/char-sheet.png` 가 있어야 한다).
