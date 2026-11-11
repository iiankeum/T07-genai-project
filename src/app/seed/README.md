# seed — 가짜 데모 데이터

> AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 태림(개발) 작업방 · 2026-11-11

공개 저장소다. 여기 있는 거래처 · 사람 · 차번호 · 품번 · 전화번호는 **모두 지어낸 것**이다. 실제 통화 · 실제 회사 · 실제 번호는 넣지 않는다.

| 파일 | 내용 |
|---|---|
| `calls.json` | 가짜 통화 20건(대본 + 정답 카드). 01~10 은 대표님 프로토타입 10건, 11~20 은 같은 말투로 더 지음 |
| `calls-*.json` | (더 넣을 때) 같은 형식의 파일을 이 이름으로 두면 함께 읽는다. 통화 `id` 는 모든 파일에서 달라야 한다 |
| `glossary.json` | 낱말 사전 기본 항목 `{kind: 현장말 · 오인식 · 차종, term, standard, note}` |
| `customers.json` | 가짜 거래처 28곳 `{name, phone}` — 번호는 `010-0000-01xx` 꼴 |

## 언제 들어가나

- 서버가 뜰 때(`routes/admin.mjs` 의 `start()`): 통화가 하나도 없으면 통화를, 사전이 비었으면 사전을 넣는다.
- 관리자 「데모 초기화」: 통화 · 카드 · 일감 · 브리핑 · 사전을 비우고 다시 넣는다(체험 신청 · 오디오 파일은 그대로).
- 날짜: 통화 시각은 「오늘 09:00 KST + `offsetMin`분」. 오늘 통화가 하나도 없으면 서버가 시작할 때와 한 시간마다 시드 통화 날짜를 오늘로 옮긴다(시각은 그대로).

## 통화 하나의 형식

```json
{
  "id": "seed-call21",
  "offsetMin": 185,
  "callerNumber": "010-0000-0101",
  "turns": [{"who": "dealer", "say": "네, 부품입니다."}, {"who": "shop", "say": "새한카센터인데요, ..."}],
  "card": {"customer": "새한카센터", "contact": null, "carModel": "아반떼 AD", "modelYear": "2017", "plate": null,
           "items": [{"part": "앞범퍼", "side": null, "qty": 1, "partNo": null}],
           "urgent": true, "due": "오전 중", "delivery": "배송", "askBack": [], "unsure": [], "note": null},
  "status": "draft",
  "callback": false, "callbackReason": null
}
```

- `offsetMin`: 오늘 09:00 KST 에서 몇 분 뒤(음수면 그 전, `-1440` 이면 어제 09:00).
- `turns`: `who` 는 `dealer`(대리점) · `shop`(정비소). `say` 는 전화에서 읽는 대로(숫자 · 영문을 한글 소리로). 문장마다 시각을 「공백 뺀 글자 수 ÷ 6.5초 + 0.4초 쉼」으로 매긴다.
- `card`: 정답 카드. 품번(`partNo`)은 **통화에서 불러 준 것만** 적는다. `askBack` 은 통화에서 물었는데 답이 안 정해진 것, `unsure` 는 `[{field, reason, say?, item?}]`(받아쓰기가 틀렸을 수 있는 값). 고쳐 읽은 낱말은 `fixes: [{heard, fixed}]`.
- 부품 줄의 `action`(주문 · 취소 · 반품 · 교환 · 문의)과 `car` 는 넣을 때(`lib/seed.mjs`) 이렇게 다룬다. 출고 목록에 들고 나갈 물건만 남기기 위해서다.
  - `주문`(또는 없음): 그대로 부품 줄.
  - `반품` · `교환`: 통화 종류(`callType`)가 `반품·교환` 일 때만 부품 줄로 남기고 이름에 「(반품)」 등을 붙인다(이름에 반품 · 교환 · 회수가 이미 있으면 그대로).
  - 그 밖(취소 · 문의, 반품·교환 통화가 아닌 반품 줄): 부품 줄에서 빼고 메모(`note`)에 「취소: 라디에이터 1」처럼 덧붙인다. 그래서 부품이 하나도 안 남은 `주문` 통화는 `기타` 가 된다.
  - `car` 가 카드 `carModel` 과 다르면 부품 이름 뒤에 「(레이 TAM)」처럼 차종을 붙인다.
- 부품 이름 · `summary` · `note` 의 대본 번호(`c02`)는 「앞 통화」로 바꾸고, 굳은 날짜(`10/30`)는 지운다. 부품 이름에서는 번호 · 날짜가 든 괄호를 통째로 지운다. 날짜를 굴리면 실제 날짜와 어긋나므로 새로 쓸 때도 「지난번」처럼 상대 말로 쓴다.
- `status`: `draft`(확인 필요) · `confirmed`(확정) · `shipped`(출고 완료). 확정 · 출고 카드에는 `askBack` 을 남기지 않는다.
- `callerNumber`: 가짜 번호만. `customers.json` 의 그 거래처 번호와 같으면 카드에 「번호로 확인」(F11)이 붙는다.

### 고를 수 있는 칸

| 칸 | 뜻 |
|---|---|
| `durationSec` | 통화 길이(초). 없으면 문장 시각으로 계산 |
| `say` | 근거 문장 · 강조를 찾을 낱말. `{customer, contact, carModel, modelYear, plate, urgent, due, delivery, items:[{part, qty}], ask:[...]}`. 카드 값이 대본에 그대로 없을 때(예: 카드 `K5` ↔ 대본 「케이파이브」) 대본 속 말을 적는다 |
| `aiDraftDiff` | AI 초안이 정답과 달랐던 칸 `{note: "렌터카"}` — 화면에 「고침」으로 보인다 |
| `confirmedOffsetMin` · `shippedOffsetMin` | 확정 · 출고 시각(오늘 09:00 KST 기준 분). 없으면 통화 10분 뒤 · 그 40분 뒤 |

## 고친 뒤 검사

```
cd src/app
node tools/build-seed.mjs --verbose   # 근거 문장을 못 찾은 칸 · 같은 id · 상태 오류를 알려 준다
node --test test/seed.test.mjs
```

녹음(음성)까지 있는 가짜 통화는 여기 말고 `tools/folder-sender.mjs` 로 ingest 에 흘려 실제 받아쓰기 → 카드 길을 태운다.
