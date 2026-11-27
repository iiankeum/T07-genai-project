# 시스템 구성도 — 콜노트(가칭)

> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) + Codex(그림) · 2026-11-12 — 팀 검토 전

7번 「AI 전화 주문 받아쓰기」 데모가 어떻게 도는지 **A3 가로 한 장**에 모은 그림이다. 서버, 사이트 기능, AI 모델, 음성 처리가 어떻게 이어지는지 팀원 누구나 볼 수 있게 만들었다.

- **보기**: [T07-시스템구성도.pdf](T07-시스템구성도.pdf). 화면으로 봐도 되고 A3 로 뽑아도 된다.
- **기준**: 2026-11-12 아침의 `dev` 가지 코드, 그리고 [기획서 v1.3](../../work/01-기획-남희/산출물/) · 구현-대조표.

## 한 장에 들어 있는 것

| 구역 | 내용 |
|---|---|
| ① 쓰는 사람 · PC | 휴대폰 · 태블릿 · PC 브라우저, 대리점 PC 의 폴더 감시 프로그램, 받아쓰기 일꾼(그래픽카드 PC 의 Whisper) |
| ② 데모 서버 | AWS Lightsail(서울). 사이트, 저장소(SQLite), 일 줄 세우기, 사용량 한도 |
| ③ Claude API | 카드 뽑기, 하루 요약 · 할 일, 질문 답하기(근거 통화 표시) |
| A | 녹음 한 건이 카드가 되기까지의 순서 |
| B | 기능 F01~F15 가 어디서(브라우저 · 서버 · PC · Claude) 도는지 |
| C | 배포: `dev` 에 푸시하면 서버가 1분 안에 당겨 가서 바꾸고, 실패하면 이전 상태로 되돌린다 |
| D | 비밀값을 어디에 두는지, 실제 녹음을 처리하는 길(PC 안에서 가린 글만 Claude 로 보낸다) |

## 고칠 때

코드가 바뀌어 그림과 실제가 달라지면 `원본/index.html` 을 고친 뒤 PDF 를 다시 굽는다. 윈도우에서는 Edge 로 굽는다.

```powershell
cd docs\시스템구성도
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu --no-pdf-header-footer --user-data-dir="$env:TEMP\edge-sysdiag" --print-to-pdf="$PWD\T07-시스템구성도.pdf" "file:///$((Resolve-Path 원본\index.html) -replace '\\','/')"
```

- 결과가 한 장(A3 가로)인지 확인한다. 넘치면 `index.html` 에서 글을 줄인다.
- 그림 9장(`원본/web/`)은 Codex 로 그렸다. 그림 안에는 글자 · 로고가 없다.
- 글꼴은 SUIT(sun-typeface, SIL Open Font License 1.1)이다. OFL 이 허락하는 범위에서 `원본/fonts/` 에 함께 두었다.

## 만든 과정

[work/00-총괄-한결/관제소/LOG.md](../../work/00-총괄-한결/관제소/LOG.md) 의 2026-11-12 13:51 기록에 있다.
