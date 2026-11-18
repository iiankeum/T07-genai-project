"""가짜 통화 몇 건을 데모 서버에 넣고(send_ingest.py), 받아쓰기 → AI 카드가 끝나면 정답(gold)과 칸별로 비교한다.

    python check_pipeline.py --only c18,c30,c44,c51
    python check_pipeline.py --calls c18=call_xxx,c30=call_yyy     # 이미 넣은 통화를 다시 비교만

결과는 마크다운 표로 출력한다(사람이 보고 프롬프트를 손볼 근거).
"""
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
DEFAULT_URL = "https://t07.3-39-67-126.sslip.io"


def squash(s):
    return re.sub(r"[\s\-·]", "", str(s or "")).upper()


def get(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def send(only: str) -> dict:
    out = subprocess.run([sys.executable, str(HERE / "send_ingest.py"), "--only", only],
                         capture_output=True, text=True, encoding="utf-8").stdout
    ids = {}
    for line in out.splitlines():
        m = re.match(r"(c\d+) (\d+) (\{.*\})", line)
        if m and m.group(2) in ("200", "201"):
            ids[m.group(1)] = json.loads(m.group(3))["callId"]
        else:
            print("보내기:", line)
    return ids


def compare(g: dict, card: dict) -> list[tuple[str, str, str, bool]]:
    rows = []
    rows.append(("거래처", g["customer"] or "-", card.get("customer") or "-", squash(g["customer"]) == squash(card.get("customer"))))
    car_ok = all(any(squash(alt) in squash(card.get("carModel")) for alt in k.split("|")) for k in g.get("car_kw", []))
    rows.append(("차종", g.get("car") or "-", card.get("carModel") or "-", car_ok))
    rows.append(("연식", g.get("year") or "-", card.get("modelYear") or "-", (g.get("year") or None) == (card.get("modelYear") or None)))
    rows.append(("차번호", g.get("plate") or "-", card.get("plate") or "-", squash(g.get("plate")) == squash(card.get("plate"))))
    want = [it for it in g["items"] if it["action"] in ("주문", "교환")]
    got = list(card.get("items") or [])
    for it in want:
        hit = next((x for x in got if any(squash(k) in squash(x.get("part")) for k in it["part_kw"])), None)
        if hit:
            got.remove(hit)
        ok = bool(hit) and (it["qty"] is None or hit.get("qty") == it["qty"]) and \
            (not it.get("part_no") or squash(hit.get("partNo")) == squash(it["part_no"]))
        rows.append((f"부품 · {it['action']}", f"{it['part']} ×{it['qty']}" + (f" {it['part_no']}" if it.get("part_no") else ""),
                     f"{hit['part']} ×{hit.get('qty')}" + (f" {hit.get('partNo')}" if hit.get("partNo") else "") if hit else "(없음)", ok))
    for x in got:
        rows.append(("부품 · 더 있음", "-", f"{x.get('part')} ×{x.get('qty')}", False))
    rows.append(("급함", str(g["urgent"]), str(card.get("urgent")), bool(g["urgent"]) == bool(card.get("urgent"))))
    rows.append(("배송", g.get("delivery") or "-", " / ".join(str(card.get(k)) for k in ("due", "delivery") if card.get(k)) or "-", True))
    rows.append(("되물을 것", "; ".join(g.get("ask") or []) or "-", "; ".join(card.get("askBack") or []) or "-",
                 bool(g.get("needs_ask")) == bool(card.get("askBack"))))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--calls", default="", help="c18=call_xxx,... 이미 넣은 통화")
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--wait", type=int, default=600)
    args = ap.parse_args()
    gold = {c["id"]: c for c in json.loads((HERE / "calls.json").read_text(encoding="utf-8"))["calls"]}
    ids = dict(kv.split("=") for kv in args.calls.split(",") if kv) if args.calls else send(args.only)
    if not ids:
        raise SystemExit("넣은 통화가 없습니다.")
    deadline, done = time.time() + args.wait, {}
    while time.time() < deadline and len(done) < len(ids):
        for cid, call in ids.items():
            if cid in done:
                continue
            d = get(f"{args.url}/api/calls/{call}")
            if d.get("status") in ("ready", "failed"):
                done[cid] = d
        time.sleep(5)
    total = ok = 0
    for cid, call in ids.items():
        d = done.get(cid)
        print(f"\n### {cid} · {gold[cid]['customer']} · {', '.join(gold[cid]['tags'])} · `{call}`")
        if not d:
            print("시간 안에 끝나지 않음")
            continue
        if d["status"] == "failed" or not d.get("card"):
            print(f"실패: {d.get('error')}")
            continue
        print("\n| 칸 | 정답 | AI 카드 | |\n|---|---|---|---|")
        for name, gv, cv, good in compare(gold[cid]["gold"], d["card"]):
            total += 1
            ok += good
            print(f"| {name} | {gv} | {cv} | {'✅' if good else '❌'} |")
        fx = d["card"].get("fixes") or []
        if fx:
            pairs = [f"{x.get('heard')}→{x.get('fixed')}" for x in fx]
            print("\n고친 낱말: " + ", ".join(pairs))
        if d["card"].get("note"):
            print(f"메모: {d['card']['note']}")
    print(f"\n맞은 칸 {ok}/{total}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
