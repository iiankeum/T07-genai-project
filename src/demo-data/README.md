> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) 해결사 작업방 · 2026-11-11

# demo-data — 가짜 주문 통화 54건

부품 대리점이 정비소에서 받는 주문 전화를 **지어내서** 만든 시험 · 시연용 데이터다.
실제 녹음이 없어도 받아쓰기 → 주문 카드 → 대시보드 · 찾기 · 「지난 통화에 묻기」를 끝까지 돌려 볼 수 있게 한다.

**모두 가짜다.** 거래처 · 사람 호칭 · 전화번호(`010-0000-XXXX`) · 차번호 · 품번 · 금액은 지어낸 것이고, 실제 통화를 옮긴 것이 아니다.
음성은 합성(edge-tts)이라 사람보다 또박또박하다 — 실제 통화보다 쉽다는 것을 감안하고 쓴다.

## 들어 있는 것

| 파일 | 내용 |
|---|---|
| [calls.json](calls.json) | **54건**의 대본(화자 구분) · 정답 주문 카드 · 날짜 · 시각 · 거래처 · 시나리오 태그 · 이어지는 통화. 이것이 기준이다 |
| [validate.py](validate.py) | calls.json 검사(합성 음성이 못 읽는 글자, 카드 형식, 이어지는 통화) |
| [make_audio.py](make_audio.py) | calls.json → 전화 음질 음성 파일(저장소 밖에 만든다) |
| [build_dataset.py](build_dataset.py) | 처음 만들 때 대본 조각과 META(시각 · 거래처 · 태그)를 합친 스크립트. META 표가 시간표의 기준 |
| [scenario-design.md](scenario-design.md) | 54건 설계표와 대본 작성 지침 |
| [glossary.txt](glossary.txt) · [customers.txt](customers.txt) · [car_models.txt](car_models.txt) | 현장 말 사전 · 거래처 목록(비슷한 이름 일부러 섞음) · 차종 코드. 대표님 프로토타입 것을 잇고 늘렸다 |

## 통화 하나의 모양 (calls.json)

```json
{
  "id": "c38", "date": "2026-11-09", "time": "10:15", "weekday": "월", "days_ago": 3,
  "direction": "in", "phone": "010-0000-0103", "customer": "우리공업사",
  "speakers": {"dealer": "김 부장", "shop": "이 실장"},
  "tags": ["주문다툼", "같은거래처"], "refs": ["c30"], "audio_noise": null,
  "turns": [{"who": "dealer", "say": "네, 부품입니다."}, {"who": "shop", "say": "부장님, 우리공업사 이 실장인데요. …"}],
  "gold": {
    "intent": "주문다툼", "is_order": true, "customer": "우리공업사",
    "car": null, "car_kw": [], "year": null, "plate": null,
    "items": [{"action": "주문", "part": "엔진오일 4L", "part_kw": ["엔진오일", "…"], "qty": 2, "part_no": null, "car": null}],
    "urgent": false, "delivery": "오후", "needs_ask": false, "ask": [],
    "summary": "c30 엔진오일 수량 다툼, 녹음상 4통 정정 확인 · 4L 2통 추가 주문, 오후 배송",
    "dispute": {"claim": "…6통을 시켰는데 4통만 왔다", "record": "c30 에서 4통으로 정정", "who_right": "대리점", "resolution": "…"}
  }
}
```

- `turns[].say` 는 **합성 음성이 읽는 글**이라 숫자 · 영문을 한글 소리로 썼다(「케이파이브 디엘쓰리」「백오십칠 머, 이사육팔」「오팔일공일 다시 디사에이이오」). 화면에 「받아쓴 글」로 보여 줄 때는 이 글을 그대로 쓰거나, 받아쓰기 결과를 쓴다.
- `gold` 는 사람이 듣고 쓴 **정답 주문 카드**다. 프로토타입 `calls.json` 의 키(customer · car_kw · year · plate · items[part_kw · qty · part_no] · urgent · needs_ask)를 그대로 두고 intent · items[action · part · car] · delivery · ask · summary · dispute 를 더했다. 그래서 프로토타입 `evaluate.py` 로도 채점된다.
- `refs` 는 이 통화가 가리키는 앞 통화다(다툼 · 독촉 · 반품 · 교환 · 「저번에 그거」).
- 날짜는 기준일 **2026-11-12(목)** 에서 `days_ago` 를 뺀 것이다. 사이트 시드로 쓸 때는 `days_ago` 로 「오늘」에 맞춰 옮기면 언제 시연해도 대시보드의 「오늘 주문」이 비지 않는다(days_ago 0 이 5건, 모두 오전).

## 무엇을 시험할 수 있나

| 시험거리 | 통화 |
|---|---|
| 일반 주문 · 여러 부품 | c02 c05 c14 c21 c29 c35 c36 c40 c48 c49 … |
| 급한 주문(퀵 · 오전 중) | c04 c13 c18 c35 c41 c50 |
| 수량 고쳐 말하기(「여섯 통, 아니다 네 통」) | c30 c51 c53 |
| 품번 불러 주기(고쳐 말하기 포함) | c01 c26 c44 c45 |
| 차번호(「구」가 숫자처럼 들리는 것 포함) | c03 c08 c13 c15 c21 c32 c34 c41 c50 c51 |
| 재고만 묻기 · 신규 거래 · 잘못 건 전화(주문 아님) | c07 c52 · c12 · c27 |
| 반품 · 교환 · 취소 · 주문 추가 | c22 c23 · c33 c46 c47 · c20 c37 · c31 |
| **주문 다툼** — 앞 통화 녹음으로 누가 맞는지 | c18↔c14(거래처가 맞음) · c38↔c30(대리점이 맞음) · c46↔c40(거래처가 맞음) |
| 배송 독촉 · 결제 · 외상 | c16 c54 · c24 c34 · c12 c28 c39 |
| 잡담 섞인 긴 통화 | c11 c25 |
| 사투리(경상 · 전라 · 충청) | c04 c26 c52 · c08 c09 c39 · c05 c33 |
| 공장 소리(임팩 렌치 · 쇠 소리 · 에어) | c01 c32 c34 c41 c42 c44 c47 |
| 비슷한 거래처 이름(새한/세한, 우리공업사/우리카센터) | c19 c48 |
| 같은 거래처 여러 번 · 「지난 통화에 묻기」 | 새한카센터 6건(c02 c13 c16 c25 c43 c50), 우리공업사 5건, 중앙공업사 4건, 제일카서비스 4건, 한일카 4건 … · c10 c43 |
| 대리점이 건 전화 · 확인 회신 | c09 · c06 |

분포: 10/30(금) ~ 11/12(목) 일요일 빼고 12일, 오전 8~10시에 35건이 몰려 있다. 대리점 담당은 김 부장 · 이 대리 둘, 거래처는 19곳.

## 음성 파일 (저장소에 넣지 않는다)

용량과 합성 서비스 약관 때문에 음성은 저장소 밖에 둔다. 대표님 PC 에는 `C:\Users\pc\.t07-demo-audio\` 에 만들어져 있다.

| 폴더 | 내용 |
|---|---|
| `phone/cNN.wav` | **주로 쓸 것.** 8kHz 모노 · 300~3400Hz · mu-law · 선로 잡음. 공장소리 통화는 정비소 쪽에 공장 잡음이 섞였다 |
| `noisy/cNN.wav` | 더 나쁜 회선(잡음 크게 · 대역 좁게 · 잠깐 끊김) |
| `stereo/cNN.wav` | 8kHz 2채널 — 왼쪽 대리점, 오른쪽 정비소(화자 구분 정답 확인용) |
| `clean/cNN.wav` | 16kHz 합성 그대로 |
| `web/cNN.mp3` | phone 을 16kHz · 32kbps mp3 로 — 사이트에서 틀기 좋은 크기(한 건 150~300KB) |
| `timings/cNN.json` | 턴마다 시작 · 끝 초. 오디오를 틀면서 대본을 한 줄씩 띄우는 「실시간 받아쓰기」 시연에 쓸 수 있다 |
| `index.json` | 전체 목록(날짜 · 거래처 · 길이) |

다른 PC 에서 다시 만들기:

```bash
pip install edge-tts numpy
```

```bash
python make_audio.py --out ~/.t07-demo-audio
```

ffmpeg 가 PATH 에 있어야 한다. 합성 결과는 `_cache/` 에 남아 두 번째부터는 빠르다. 대본을 고치면 고친 턴만 다시 합성한다.

목소리: edge-tts 의 한국어 목소리 3개(InJoon · SunHi · Hyunsu)에 다국어 목소리 7개를 섞고, 사람마다 높낮이 · 빠르기를 달리했다(`make_audio.py` 의 `VOICES`). Whisper large-v3 로 모두 알아듣는 것을 확인했다.

## 고칠 때

1. `calls.json` 을 직접 고친다(대본 · 정답).
2. `python validate.py` — 문제 0개가 나와야 한다.
3. `python make_audio.py --only c03` 처럼 고친 통화만 다시 만든다.
