"""calls.json + timings → 데모 사이트 시드 site-seed.json (태림 방 시드 로더 형식).

- 카드는 정답 카드(gold)를 「사람이 확인한 카드」로 넣는다. 지난 날 주문은 출고 완료 · 확정, 오늘 것은 확인 필요 위주.
- quote · evidence · highlights 는 segments 의 text 에 **글자 그대로 있는 대목**만 넣는다(사이트가 그 글로 시각을 찾는다).
- 시각은 offsetMin = 오늘 09:00(KST) 기준 분. 음수는 그 전.

    python make_site_seed.py [--audio ~/.t07-demo-audio]
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
SPK = {"dealer": "대리점", "shop": "정비소"}
CALL_TYPE = {"주문": "주문", "주문추가": "주문", "확인회신": "주문", "대리점발신": "주문", "신규거래": "주문",
             "주문다툼": "주문", "주문취소": "주문", "배송독촉": "배송 문의", "반품": "반품·교환", "교환": "반품·교환",
             "재고문의": "재고·단가 문의", "결제": "기타", "외상": "기타", "잘못건전화": "기타"}
URGENT_WORDS = ["퍼뜩", "퀵", "급해", "급하", "급한", "급혀", "빨리", "오전 중", "당장"]
QTY = re.compile(r"(하나|한 개|한 세트|한 쌍|한 박스|한 짝|한 통|한 장|[가-힣]{1,3} ?(?:개|통|장|세트|박스|짝|쌍))")
# 오늘 「다시 전화할 곳」과 「들어 보기」(받아쓰기가 틀렸을 수 있는 값) — 시연용으로 몇 건만
CALLBACK = {"c12", "c39", "c52", "c61"}  # 오늘 다시 전화할 곳: c52 재고 회신 · c61 K5 백미러 좌우(기획서 F10)
UNSURE = {
    "c51": [{"field": "plate", "reason": "차번호 가운데 글자를 「나」라고 했다가 「라」로 고쳐 말함 — 들어 보기"}],
    "c32": [{"field": "plate", "reason": "「구」가 숫자 9 로 들릴 수 있음(거북이 구)"}],
    "c44": [{"field": "partNo", "reason": "품번 뒤쪽을 「공일공」에서 「공이공」으로 고쳐 말함"}],
    "c48": [{"field": "customer", "reason": "우리카센터 · 우리공업사 — 비슷한 거래처 이름"}],
    "c19": [{"field": "customer", "reason": "새한카센터 · 세한모터스 — 비슷한 거래처 이름"}],
}


def squash(s: str) -> str:
    return re.sub(r"\s", "", s)


def loose(word: str) -> re.Pattern:
    """띄어쓰기가 달라도 찾는 패턴(「브레이크패드」 ↔ 「브레이크 패드」)."""
    return re.compile(r"\s?".join(re.escape(ch) for ch in squash(word)))


def clauses(text: str) -> list[str]:
    return [c.strip() for c in re.split(r"(?<=[,.?!])\s+", text) if c.strip()]


NUM_WORDS = {1: ("하나", "한"), 2: ("두", "둘"), 3: ("세", "셋"), 4: ("네", "넷"), 5: ("다섯",), 6: ("여섯",),
             7: ("일곱",), 8: ("여덟",), 9: ("아홉",), 10: ("열",), 12: ("열두",), 20: ("스무", "스물"), 24: ("한 박스", "스물네")}


def qty_after(text: str, start: int, qty):
    """text 의 start 뒤에서 정답 수량을 말한 대목(「네 통」)의 위치."""
    words = NUM_WORDS.get(qty, ())
    best = None
    for m in QTY.finditer(text, start):
        if any(m.group(0).startswith(w) for w in words):
            best = m  # 고쳐 말했으면 마지막 것이 정답
    return best


def find(turns, words, prefer="shop"):
    """words 중 하나가 처음 나오는 (턴 번호, 그 낱말이 든 마디, 낱말 그대로)."""
    for side in (prefer, None):
        for i, t in enumerate(turns):
            if side and t["who"] != side:
                continue
            for w in words:
                if not w:
                    continue
                m = loose(w).search(t["say"])
                if m:
                    clause = next((c for c in clauses(t["say"]) if loose(w).search(c)), t["say"])
                    return i, clause, m.group(0)
    return None, None, None


DIG = "공일이삼사오육칠팔구"


def num_ko(n: int) -> str:
    """34 → 삼십사, 157 → 백오십칠 (차번호 앞 숫자 읽기)."""
    out = ""
    for unit, name in ((100, "백"), (10, "십")):
        q, n = divmod(n, unit)
        if q:
            out += ("" if q == 1 else DIG[q]) + name
    return out + (DIG[n] if n else "")


def find_with_qty(turns, words, qty):
    """부품 낱말과 정답 수량이 한 턴에 같이 나오는 첫 턴(정비소 먼저). 없으면 부품 낱말만 처음 나온 곳."""
    if qty:
        for side in ("shop", None):
            for i, t in enumerate(turns):
                if side and t["who"] != side:
                    continue
                for w in words:
                    m = loose(w).search(t["say"]) if w else None
                    if m and qty_after(t["say"], m.start(), qty):
                        clause = next((c for c in clauses(t["say"]) if loose(w).search(c)), t["say"])
                        return i, clause, m.group(0)
    return find(turns, words)


def plate_phrase(turns, plate):
    m = re.match(r"(\d+)([가-힣])(\d{4})$", plate)
    front, tail = num_ko(int(m.group(1))), "".join(DIG[int(d)] for d in m.group(3))
    pat = re.compile(loose(front).pattern + r".{0,40}?" + loose(tail).pattern)
    for side in ("shop", None):
        for i, t in enumerate(turns):
            if side and t["who"] != side:
                continue
            mm = pat.search(t["say"])
            if mm:
                return i, mm.group(0)
    return None, None


def side_of(part: str):
    for s in ("운전석", "조수석", "좌우", "왼쪽", "오른쪽"):
        if s in part:
            return s
    return None


def build(audio: Path) -> dict:
    data = json.loads((HERE / "calls.json").read_text(encoding="utf-8"))
    calls = data["calls"]
    cancelled = {r for c in calls if c["gold"]["intent"] == "주문취소" for r in c["refs"]}
    out, missing = [], []
    for c in calls:
        g, turns = c["gold"], c["turns"]
        tpath = audio / "timings" / f"{c['id']}.json"
        if not tpath.exists():
            missing.append(c["id"])
            continue
        tim = json.loads(tpath.read_text(encoding="utf-8"))
        segs = [{"start": t["start"], "end": t["end"], "text": t["say"], "speaker": SPK[t["who"]]} for t in tim["turns"]]
        hl, evidence = [], {}

        def add_hl(text, kind):
            if text and all(h["text"] != text for h in hl):
                hl.append({"text": text, "kind": kind})

        items = []
        for it in g["items"]:
            i, clause, word = find_with_qty(turns, it["part_kw"], it["qty"])
            add_hl(word, "part")
            if clause and it["qty"]:
                text = turns[i]["say"]
                cstart = text.index(clause)
                q = qty_after(text, cstart, it["qty"])
                if q:
                    add_hl(q.group(0), "qty")
                    if q.end() > cstart + len(clause):  # 수량을 다음 마디에서 고쳐 말함 → 근거를 거기까지
                        tail = next((c for c in clauses(text[q.start():]) if c), "")
                        clause = text[cstart: q.start() + len(tail)].strip()
            items.append({"part": it["part"], "side": side_of(it["part"]), "qty": it["qty"], "partNo": it["part_no"],
                          "quote": clause, "action": it["action"], "car": it.get("car")})
        if g["customer"]:
            i, clause, word = find(turns, [g["customer"]])
            if clause:
                evidence["customer"] = clause
                add_hl(word, "customer")
        if g.get("car_kw"):
            i, clause, word = find(turns, [g["car_kw"][0].split("|")[0]])
            if clause:
                evidence["carModel"] = clause
                add_hl(word, "car")
        if g.get("plate"):
            i, phrase = plate_phrase(turns, g["plate"])
            if phrase:
                evidence["plate"] = phrase
                add_hl(phrase, "plate")
        if g["urgent"]:
            i, clause, word = find(turns, URGENT_WORDS)
            if clause:
                evidence["urgent"] = clause
                add_hl(word, "urgent")
        d = g.get("delivery")
        due = None if (not d or d == "퀵") else d
        delivery = "퀵" if d and "퀵" in d else None
        if due:
            i, clause, _ = find(turns, [due.split()[0]], prefer="dealer")
            if clause:
                evidence["due"] = clause
        if delivery:
            i, clause, _ = find(turns, ["퀵"], prefer="dealer")
            if clause:
                evidence["delivery"] = clause
        callback = c["id"] in CALLBACK
        ask = g.get("ask") or []

        if c["id"] in cancelled:
            status = "cancelled"
        elif c["days_ago"] >= 2:
            status = "shipped" if g["is_order"] else "confirmed"
        elif c["days_ago"] == 1:  # 어제 오전 주문은 이미 출고, 오후 것은 확정
            status = "shipped" if (g["is_order"] and c["time"] < "12:00") else "confirmed"
        else:
            status = "draft"
        # 확정 · 출고된 카드는 되물을 것이 남지 않는다 → 남은 확인 거리는 메모로
        ask_back = ask if (status == "draft" or callback) else []
        note = None if ask_back or not ask else "확인했던 것: " + " / ".join(ask)
        mins = c["days_ago"] * -1440 + int(c["time"][:2]) * 60 + int(c["time"][3:]) - 540
        out.append({
            "id": f"fx-{c['id']}", "offsetMin": mins, "durationSec": tim["duration"], "callerNumber": c["phone"],
            "turns": [{"who": t["who"], "say": t["say"]} for t in turns], "segments": segs,
            "callType": ("반품·교환" if g["intent"] == "주문다툼" and not g["is_order"] else CALL_TYPE[g["intent"]]),
            "card": {"customer": g["customer"], "contact": c["speakers"]["shop"] if c["customer"] else None,
                     "carModel": g.get("car"), "modelYear": g.get("year"), "plate": g.get("plate"), "items": items,
                     "urgent": bool(g["urgent"]), "due": due, "delivery": delivery, "askBack": ask_back,
                     "unsure": UNSURE.get(c["id"], []), "note": note, "evidence": evidence, "highlights": hl},
            "summary": g["summary"], "tags": c["tags"], "refs": [f"fx-{r}" for r in c["refs"]],
            "intent": g["intent"], "dispute": g.get("dispute"),
            "status": status, "callback": callback, "callbackReason": ask[0] if (callback and ask) else None,
            "audio": f"web/{c['id']}.mp3",
        })
    return {"_설명": "가짜 통화 61건 — 거래처 · 사람 · 전화번호 · 차번호 · 품번 · 금액 모두 지어냄. src/demo-data/calls.json 에서 만듦"
                     "(make_site_seed.py). offsetMin 은 오늘 09:00 KST 기준 분. audio 는 음성 폴더(~/.t07-demo-audio) 기준.",
            "calls": out}, missing


def check(seed: dict) -> list[str]:
    """quote · evidence · highlights 가 segments 글에 그대로 있는지."""
    errs = []
    for c in seed["calls"]:
        texts = [s["text"] for s in c["segments"]]
        has = lambda q: any(q in t for t in texts)  # noqa: E731
        card = c["card"]
        for it in card["items"]:
            if it["quote"] and not has(it["quote"]):
                errs.append(f"{c['id']} quote {it['quote']}")
        for k, v in card["evidence"].items():
            if not has(v):
                errs.append(f"{c['id']} evidence.{k} {v}")
        for h in card["highlights"]:
            if not has(h["text"]):
                errs.append(f"{c['id']} highlight {h['text']}")
    return errs


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", default=str(Path.home() / ".t07-demo-audio"))
    ap.add_argument("--out", default=str(HERE / "site-seed.json"))
    args = ap.parse_args()
    seed, missing = build(Path(args.audio))
    errs = check(seed)
    for e in errs:
        print(e)
    Path(args.out).write_text(json.dumps(seed, ensure_ascii=False, indent=1), encoding="utf-8")
    st = {}
    for c in seed["calls"]:
        st[c["status"]] = st.get(c["status"], 0) + 1
    print(f"site-seed.json — {len(seed['calls'])}건 · 상태 {st} · 다시 전화 {sum(c['callback'] for c in seed['calls'])} · "
          f"들어 보기 {sum(bool(c['card']['unsure']) for c in seed['calls'])} · 근거 문제 {len(errs)} · timings 없음 {missing}")
