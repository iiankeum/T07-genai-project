"""가짜 통화 10건으로 "얼마나 맞히는지" 잰다.

    python evaluate.py

음질 3가지(깨끗한 합성 음성 / 전화 음질 / 잡음 심한 전화)와 도움 자료(낱말 사전 · 거래처 목록)를
바꿔 가며 돌려 정답 카드(data/calls.json 의 gold)와 항목별로 비교한다. 결과는 out/eval.md 에 적는다.
"""
import json
import re
import sys
from pathlib import Path

import ordercard

HERE = Path(__file__).parent
OUT = HERE / "out"

# (음성 폴더, 낱말 사전·차종 목록, 거래처 목록, 이름)
CONDITIONS = [
    ("clean", False, False, "깨끗한 음성 · 도움 없음"),
    ("phone", False, False, "전화 음질 · 도움 없음"),
    ("phone", True, False, "전화 음질 · 사전"),
    ("phone", True, True, "전화 음질 · 사전 + 거래처 목록"),
    ("noisy", True, True, "잡음 심한 전화 · 사전 + 거래처 목록"),
]
FIELDS = ["거래처", "차종", "연식", "차번호", "부품", "수량", "품번", "급함", "되물음 판정"]

# 틀린 칸에 「들어 보기」 표시가 붙었는지 볼 때, 표시 문장에 이 말이 들어 있으면 그 칸을 짚은 것으로 본다.
# 남희 리뷰(PR #47 · 2026-11-26): 정답률만으로는 「경고 없이 출고로 넘어갈 위험」이 안 보인다.
FLAG_WORDS = {
    "거래처": ["거래처", "상호"], "차종": ["차종"], "연식": ["연식"], "차번호": ["차번호", "차량 번호"],
    "부품": ["부품", "품목"], "수량": ["수량"], "품번": ["품번"], "급함": ["급"], "되물음 판정": ["되물"],
}
SILENT_ROW = "표시 없이 틀린 카드 (적을수록 좋음)"


def unflagged(fields_wrong: list[str], unsure: list[str]) -> list[str]:
    """틀린 칸 가운데 AI 의 「들어 보기」 표시가 짚지 않은 칸."""
    return [f for f in fields_wrong if not any(w in u for u in (unsure or []) for w in FLAG_WORDS[f])]


def norm(value) -> str:
    return re.sub(r"[\s\-·()]", "", str(value or "")).upper()


def score(card: dict, gold: dict) -> tuple[dict, list[str], list[str]]:
    """항목별 (맞은 수, 전체 수), 틀린 내용 설명, 틀린 칸 이름을 돌려준다."""
    s = {f: [0, 0] for f in FIELDS}
    wrong = []
    fields_wrong: list[str] = []

    def check(field: str, ok: bool, expected, got) -> None:
        s[field][1] += 1
        if ok:
            s[field][0] += 1
        else:
            wrong.append(f"{field}: 정답 {expected!r} ↔ 카드 {got!r}")
            fields_wrong.append(field)

    check("거래처", norm(card["customer"]) == norm(gold["customer"]), gold["customer"], card["customer"])

    car = norm(card["car_model"])
    # "싼타페|산타페" 처럼 | 로 나눈 것은 어느 표기든 맞는 것으로 본다
    car_ok = all(any(norm(a) in car for a in k.split("|")) for k in gold["car_kw"]) if gold["car_kw"] else not car
    check("차종", car_ok, " ".join(gold["car_kw"]) or None, card["car_model"])

    year = re.sub(r"\D", "", str(card["model_year"] or ""))[-2:]
    check("연식", year == (gold["year"] or "")[-2:], gold["year"], card["model_year"])
    check("차번호", norm(card["plate"]) == norm(gold["plate"]), gold["plate"], card["plate"])

    left = list(card["items"])
    for g in gold["items"]:
        name = g["part_kw"][0]
        hit = next((i for i in left if any(norm(k) in norm(i["part"]) for k in g["part_kw"])), None)
        check("부품", hit is not None, name, [i["part"] for i in card["items"]])
        if hit is None:
            s["수량"][1] += 1
            s["품번"][1] += 1
            continue
        left.remove(hit)
        check("수량", hit["qty"] == g["qty"], f"{name} {g['qty']}", hit["qty"])
        check("품번", norm(hit["part_no"]) == norm(g["part_no"]), f"{name} {g['part_no']}", hit["part_no"])
    if left:
        wrong.append(f"없는 품목을 적음: {[i['part'] for i in left]}")
        fields_wrong.append("부품")

    check("급함", card["urgent"] == gold["urgent"], gold["urgent"], card["urgent"])
    check("되물음 판정", bool(card["ask_back"]) == gold["needs_ask"], gold["needs_ask"], card["ask_back"])
    return s, wrong, fields_wrong


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    calls = json.loads((HERE / "data" / "calls.json").read_text(encoding="utf-8"))["calls"]
    gold = {c["id"]: c["gold"] for c in calls}
    (OUT / "eval").mkdir(parents=True, exist_ok=True)

    table = {}
    details = []
    for folder, use_glossary, use_customers, label in CONDITIONS:
        print(f"\n== {label}", flush=True)
        paths = [HERE / "samples" / folder / f"{c['id']}.wav" for c in calls]
        results = ordercard.process(paths, use_glossary=use_glossary, use_customers=use_customers)
        tag = f"{folder}-{'glossary' if use_glossary else 'plain'}{'-customers' if use_customers else ''}"
        (OUT / "eval" / f"{tag}.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

        total = {f: [0, 0] for f in FIELDS}
        perfect = 0
        silent = 0
        details.append(f"\n### {label}\n")
        for r in results:
            call_id = Path(r["file"]).stem
            s, wrong, fields_wrong = score(r["card"], gold[call_id])
            for f in FIELDS:
                total[f][0] += s[f][0]
                total[f][1] += s[f][1]
            perfect += not wrong
            missed = unflagged(fields_wrong, r["card"]["unsure"])
            silent += bool(missed)
            if wrong:
                details.append(f"- **{call_id}** — " + " / ".join(wrong))
                details.append(f"  - 받아쓴 글: {r['text']}")
                if r["card"]["unsure"]:
                    details.append(f"  - AI 가 의심스럽다고 표시함: {r['card']['unsure']}")
                if missed:
                    details.append(f"  - **표시 없이 틀림**: {missed}")
        if perfect == len(results):
            details.append("- 틀린 카드 없음")
        total["카드 전체가 정답"] = [perfect, len(results)]
        total[SILENT_ROW] = [silent, len(results)]
        table[label] = total
        print("   " + "  ".join(f"{f} {a}/{b}" for f, (a, b) in total.items()), flush=True)

    rows = FIELDS + ["카드 전체가 정답", SILENT_ROW]
    lines = [
        "# 평가 결과",
        "",
        "가짜 주문 통화 10건(합성 음성)을 돌려 정답 카드와 비교했다. 숫자는 `맞은 수/전체 수`다.",
        f"마지막 줄 「{SILENT_ROW}」만 `해당 카드 수/전체 수`다 — 틀린 칸 가운데 하나라도 「들어 보기」 표시가 짚지 않은 카드.",
        "",
        "| 항목 | " + " | ".join(table) + " |",
        "|---|" + "---|" * len(table),
    ]
    for f in rows:
        lines.append(f"| {f} | " + " | ".join(f"{t[f][0]}/{t[f][1]}" for t in table.values()) + " |")
    lines += ["", "## 틀린 곳"] + details + [""]
    (OUT / "eval.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"\n결과: {OUT / 'eval.md'}")


if __name__ == "__main__":
    main()
