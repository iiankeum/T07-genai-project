"""calls.json 검사 — 합성 음성이 읽을 글 · 정답 카드 형식 · 통화끼리 이어짐.

    python validate.py            # 문제가 있으면 줄마다 출력하고 1 로 끝난다
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
INTENTS = {"주문", "재고문의", "반품", "교환", "주문취소", "주문추가", "주문다툼", "배송독촉", "결제",
           "외상", "확인회신", "대리점발신", "신규거래", "잘못건전화"}
ACTIONS = {"주문", "반품", "교환", "취소", "문의"}
NOT_ORDER = {"재고문의", "결제", "외상", "주문취소", "배송독촉", "잘못건전화"}
BAD_IN_SAY = re.compile(r"[0-9A-Za-z\-()\[\]\"'“”‘’…/·:]")
PLATE = re.compile(r"^\d{2,3}[가-힣]\d{4}$")
PART_NO = re.compile(r"^\d{5}-[A-Z0-9]{5}$")
YEAR = re.compile(r"^20\d\d$")


def check(data: dict) -> list[str]:
    errs = []
    calls = data["calls"]
    ids = [c["id"] for c in calls]
    order = {cid: i for i, cid in enumerate(ids)}
    for c in calls:
        cid, g = c["id"], c["gold"]
        e = lambda msg: errs.append(f"{cid}: {msg}")  # noqa: E731
        t = c["turns"]
        if not 3 <= len(t) <= 16:
            e(f"턴 수 {len(t)}")
        for i, turn in enumerate(t):
            if turn.get("who") not in ("dealer", "shop"):
                e(f"turn {i} who={turn.get('who')}")
            bad = BAD_IN_SAY.findall(turn.get("say", ""))
            if bad:
                e(f"turn {i} 합성 음성이 못 읽는 글자 {sorted(set(bad))}: {turn['say'][:40]}")
            if len(turn.get("say", "")) > 160:
                e(f"turn {i} 너무 김({len(turn['say'])}자)")
        first = t[0]["who"]
        if c["direction"] == "in" and first != "dealer":
            e("인바운드인데 대리점이 먼저 받지 않음")
        if c["direction"] == "out" and first != "shop":
            e("아웃바운드인데 정비소가 먼저 받지 않음")
        if g.get("intent") not in INTENTS:
            e(f"intent {g.get('intent')}")
        if g.get("customer") != c["customer"]:
            e(f"gold.customer {g.get('customer')} ≠ {c['customer']}")
        if g.get("plate") is not None and not PLATE.match(g["plate"]):
            e(f"plate 형식 {g['plate']}")
        if g.get("year") is not None and not YEAR.match(str(g["year"])):
            e(f"year 형식 {g['year']}")
        for it in g.get("items", []):
            if it.get("action") not in ACTIONS:
                e(f"item action {it.get('action')}")
            if it.get("part_no") is not None and not PART_NO.match(it["part_no"]):
                e(f"part_no 형식 {it['part_no']}")
            if it.get("qty") is not None and not isinstance(it["qty"], int):
                e(f"qty 형식 {it['qty']}")
            if not it.get("part_kw"):
                e(f"part_kw 비었음 ({it.get('part')})")
        if g.get("intent") in NOT_ORDER and g.get("is_order"):
            e(f"{g['intent']} 인데 is_order true")
        if g.get("needs_ask") and not g.get("ask"):
            e("needs_ask 인데 ask 가 비었음")
        if not g.get("summary"):
            e("summary 없음")
        if ("주문다툼" in c["tags"]) and not g.get("dispute"):
            e("주문다툼 태그인데 dispute 없음")
        for r in c["refs"]:
            if r not in order:
                e(f"refs {r} 없음")
            elif order[r] >= order[cid]:
                e(f"refs {r} 가 나중 통화")
    return errs


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "calls.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    errs = check(data)
    for x in errs:
        print(x)
    n = len(data["calls"])
    turns = sum(len(c["turns"]) for c in data["calls"])
    print(f"{n}건 · {turns}턴 · 문제 {len(errs)}개")
    sys.exit(1 if errs else 0)
