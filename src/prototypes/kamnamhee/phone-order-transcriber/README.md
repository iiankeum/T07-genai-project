# AI 전화 주문 받아쓰기 — 프로토타입

자동차 부품 대리점에 걸려 온 주문 전화 녹음을 **주문 카드**로 정리한다.
아이디어 문서: [docs/ideas/한결-AI-전화-주문-받아쓰기.md](../../../../docs/ideas/한결-AI-전화-주문-받아쓰기.md)

```
통화 녹음 ──▶ 음성 인식 ──▶ 낱말 사전 교정 ──▶ 생성형 AI 추출 ──▶ 주문 카드 ──▶ 담당자 확인·품번 입력 ──▶ 확정 / 출고
 (업로드·폴더 감시)  (Whisper)   (휀다→펜더)       (Claude·GPT·로컬)    (초안)                                     └─▶ 하루 마감 요약
```

## 바로 실행 (API 키 없이 3분)

```bash
cd src/prototypes/kamnamhee/phone-order-transcriber
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

브라우저에서 http://localhost:5000 을 열고 **가짜 주문 통화 불러오기**를 누른다.
기본값은 녹음 대신 받아쓴 글(.txt)을 처리하고, 주문 추출은 규칙 기반이다.

## 화면

| 화면 | 하는 일 |
|---|---|
| 주문 카드 | 녹음·글 파일 올리기, 날짜·상태별 카드 목록. 급함 / 다시 물어볼 것 표시 |
| 카드 상세 | 거래처·차종·연식·차번호·부품·수량 고치기, **품번 입력**, 확정 → 출고 완료. 통화 글·녹음 재생·근거 발화·AI 초안과 비교 |
| 오늘 마감 요약 | 오늘 주문 n건 · 아직 확정 안 됨 · 급한데 미출고 · 다시 전화할 곳. 카톡 등에 붙여 넣을 글 |

**AI는 초안까지만, 품번은 사람이 정한다**는 원칙을 서버에서 강제한다.

- 확정 조건: 부품 1개 이상, 모든 부품에 품번과 수량(1 이상), ‘다시 물어볼 것’이 모두 해결(삭제)됨
- 상태 변경은 서버가 이전 상태를 검사한다: 확인 필요 → 확정 → 출고 완료. 확정·출고·취소된 카드는 ‘다시 열기’ 전까지 고칠 수 없다
- AI가 품번을 만들어 내도 코드에서 지운다
- **AI 결과는 통화 원문과 대조한다.** 원문에 없는 차종·차번호·연식·거래처·부품·수량·근거 문장은 지우지 않고 ⚠ ‘원문 미확인’으로 표시하고, ‘다시 물어볼 것’에 넣는다 (`order_ai/verify.py`)
- 통화 글은 세 가지를 따로 보관한다: 음성 인식 원문, 원문 + 낱말 사전 교정(대조 기준), AI가 다듬은 글(참고용)

## AI 켜기

`.env.example`을 `.env`로 복사하고 값을 바꾼다.

| 단계 | 설정 | 녹음·통화 글이 PC 밖으로 나가나 |
|---|---|---|
| 음성 인식 | `STT_BACKEND=faster-whisper` (`pip install -r requirements-stt.txt`) | 안 나감 |
| 음성 인식 | `STT_BACKEND=openai` (`pip install openai`, `OPENAI_API_KEY`) | 나감 |
| 주문 추출 | `LLM_PROVIDER=ollama` ([Ollama](https://ollama.com) 설치 후 `ollama pull qwen2.5:7b`) | 안 나감 |
| 주문 추출 | `LLM_PROVIDER=anthropic` (`ANTHROPIC_API_KEY`) 또는 `openai` | 나감 |

실제 대리점 시범 사용에서는 **faster-whisper + ollama** 조합이 개인정보 처리 위탁·국외 이전 문제를 피하는 선택지다.
AI 호출이 실패하면(키 없음, HTTP 오류, 연결 끊김, 시간 초과, 이상한 응답) 규칙 기반 추출로 자동 대체하고, 카드에 그 사실을 남긴다.

- `requirements-stt.txt`는 실제 디코딩을 확인한 `faster-whisper==1.2.1` + `av==15.1.0` 조합이다 (PyAV 19.0.2와는 WAV 디코딩 오류). 설치 후 `python -m pytest -q tests`를 돌리면 `tests/test_stt_decode.py`가 짧은 WAV를 실제로 디코딩해 확인한다
- CPU만 있는 PC에서 `qwen2.5:7b`는 한 건에 몇 분이 걸릴 수 있다 (리뷰 환경에서 4분 이상). 대기 시간은 `LLM_TIMEOUT`(초)으로 늘리고, 더 작은 모델이나 GPU를 검토한다
- 워크스페이스에 묶이지 않은 Claude API 키라면 `.env`에 `ANTHROPIC_WORKSPACE_ID`를 넣는다

## 녹음 폴더 감시

통화 녹음이 자동으로 쌓이는 폴더(녹취 프로그램 저장 폴더 등)를 지정해 두면 새 파일만 카드로 만든다.
처리에 실패한 파일(잠겨 있거나 음성 인식 오류)은 원인과 함께 기록하고 다음 확인 때 다시 시도한다(같은 파일 최대 5회, 파일이 바뀌면 처음부터). 실패 목록은 웹 첫 화면에 나온다.

```bash
python cli.py watch "D:/통화녹음" --interval 5
python cli.py process 녹음1.m4a 녹음2.txt   # 파일 몇 개만
python cli.py summary --date 2026-11-11       # 마감 요약을 터미널에
```

## 현장 말 사전

[`glossary.csv`](glossary.csv)에 `틀린말,고칠말,종류`를 한 줄씩 추가한다.

- **오인식**: 음성 인식이 틀리게 받아쓴 말 (아반대 → 아반떼)
- **현장말**: 현장에서 쓰는 말 → 표준 부품명 (휀다 → 펜더, 쇼바 → 쇼크업소버, 미미 → 마운트)

사전은 세 군데에 쓰인다: Whisper 인식 힌트, 받아쓴 글 교정, 생성형 AI 프롬프트.

## 가짜 주문 통화

[`samples/`](samples/)의 대본은 모두 지어낸 것이다(거래처·차번호 포함). 실제 고객 통화는 저장소에 올리지 않는다.
팀원이 정비소·대리점 역할을 나눠 이 대본을 읽어 녹음하면 음성 인식까지 시험할 수 있다. 녹음 파일도 같은 폴더에 두면 된다.

| 파일 | 확인하는 것 |
|---|---|
| 01_급한_앞범퍼 | 기본: 거래처·차종·연식·차번호·급함·퀵 |
| 02_여러부품_정정 | 한 통화 여러 부품, "아 아니다 두 개만" 정정 → 마지막 값 + 근거 발화 |
| 03_정보부족 | 수량을 되물은 답("하나요"), 좌/우·연식 누락 → 다시 물어볼 것 |
| 04_받아쓰기_원문_한줄 | 화자 구분 없는 한 줄 받아쓰기, 오인식·현장 말 교정 |
| 05_두차량_한통화 | 한 통화에 차 두 대 → 연식이 섞이지 않고 메모로 분리 확인 |
| 06_직접수령_엔진마운트 | "엔진 미미 / 미션 쪽 미미" 구분, 직접 수령 |

## 구조

```
app.py               웹 화면 (Flask)
cli.py               명령줄 (process / watch / summary / samples)
glossary.csv         현장 말 사전
order_ai/
  stt.py             음성 인식 (none · faster-whisper · openai)
  glossary.py        낱말 사전 교정
  extract.py         주문 추출 흐름 + 생성형 AI 프롬프트
  verify.py          AI 결과를 통화 원문과 대조해 ⚠ 원문 미확인 표시
  llm.py             AI 호출 (anthropic · openai · ollama, SDK 없이 urllib)
  rules.py           규칙 기반 추출 + 빠진 정보 점검(check_missing)
  models.py          주문 카드 자료 구조
  store.py           SQLite 저장 (AI 초안과 담당자 수정본을 따로 보관)
  summary.py         하루 마감 요약
  pipeline.py        파일 → 카드, 폴더 감시
samples/             가짜 주문 통화 대본
tests/               pytest
```

## 테스트

```bash
python -m pytest -q tests
```

`tests/test_review_fixes.py`는 코드 리뷰에서 지적된 동작(빈 수량·빈 주문 확정, 확인 전 출고, 원문에 없는 AI 값, 폴더 감시 실패 누락, AI 시간 초과)을 재현하는 회귀 테스트다.

## 보안 메모 (시연용 프로토타입)

- 로그인이 없다. `127.0.0.1`에서 담당자 혼자 쓰는 것을 전제로 한다
- 디버그 모드는 `FLASK_DEBUG=1`일 때만 켜진다. 비밀키는 실행할 때마다 무작위로 만든다(`SECRET_KEY`로 지정 가능)

## 아직 안 한 것

- 실제 녹음으로 음성 인식 정확도 측정 (팀 녹음 → 대리점 녹음 순서)
- 생성형 AI 추출 vs 규칙 기반 비교표 (같은 샘플, 항목별 정답률)
- 화자 분리(정비소/대리점), 통화 시각을 녹음 파일 이름에서 읽기
- 대리점 업무 프로그램(전산)으로 카드 내보내기
