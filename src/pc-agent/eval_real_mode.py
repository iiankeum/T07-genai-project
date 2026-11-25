#!/usr/bin/env python3
"""「실제 모드(가린 뒤 Claude)」를 가짜 통화로 시험한다 — 가림이 새지 않는지, 카드 점수가 얼마나 떨어지는지.

AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 한결(총괄·서버) 작업방 · 2026-11-12

  python eval_real_mode.py --calls <calls.json> --audio <phone 폴더> --customers <customers.txt> [--limit N]
  python eval_real_mode.py ... --baseline     # 비교 기준: 지금 데모 서버의 카드 뽑기(/api/live/extract)

- 가짜 데이터 전용이다. calls.json 의 설명에 「가짜」가 없거나, 데이터 폴더가 실제 녹음 폴더면 멈춘다.
- 실제 모드는 real_mode.py 의 함수를 그대로 쓴다(가림 → 검사 → 가린 글만 Claude → 되돌리기).
- 비교 기준(--baseline)은 데모 서버가 원래 하는 일(가리지 않은 가짜 통화 글로 카드 만들기)을 그 서버 기능으로 잰 것이다.
  이 길은 이 평가 스크립트에만 있고, 실제 녹음 프로그램(real_mode.py)에는 없다.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import masking as mk  # noqa: E402
import real_mode as rm  # noqa: E402

DEMO = "https://t07.3-39-67-126.sslip.io"
TITLE_RX = re.compile(r"^(\S+)\s*(" + "|".join(mk.TITLES) + r")$")
COMMON_STEMS = set("우리 미래 중앙 대한 제일 한일 태양 그 이 저".split())


def squash(s) -> str:
    return re.sub(r"[\s\-·.,]", "", str(s or "")).upper()


def pick(card: dict, *keys):
    for k in keys:
        if k in card and card[k] not in (None, ""):
            return card[k]
    return None


def score(g: dict, card: dict) -> dict:
    """정답 카드와 견준다(해결사 방 check_pipeline.py 와 같은 기준)."""
    r = {}
    r["거래처"] = squash(g.get("customer")) == squash(pick(card, "customer"))
    car = pick(card, "car_model", "carModel")
    r["차종"] = all(any(squash(a) in squash(car) for a in k.split("|")) for k in g.get("car_kw") or []) if g.get("car_kw") else None
    r["연식"] = (g.get("year") or None) == (pick(card, "model_year", "modelYear") or None)
    r["차번호"] = squash(g.get("plate")) == squash(pick(card, "plate"))
    want = [it for it in g.get("items") or [] if it.get("action") in ("주문", "교환")]
    got = list(pick(card, "items") or [])
    ok_items = 0
    for it in want:
        hit = next((x for x in got if any(squash(k) in squash(x.get("part")) for k in it["part_kw"])), None)
        if hit:
            got.remove(hit)
        pno = pick(hit or {}, "part_no", "partNo")
        if hit and (it["qty"] is None or hit.get("qty") == it["qty"]) and (not it.get("part_no") or squash(pno) == squash(it["part_no"])):
            ok_items += 1
    r["부품"] = (ok_items, len(want))
    r["부품 더 있음"] = len(got)
    r["급함"] = bool(g.get("urgent")) == bool(pick(card, "urgent"))
    r["되물을 것"] = bool(g.get("needs_ask")) == bool(pick(card, "ask_back", "askBack"))
    r["카드 전체"] = all(v for k, v in r.items() if k in ("거래처", "차종", "연식", "차번호", "급함", "되물을 것") and v is not None) \
        and ok_items == len(want) and len(got) == 0
    return r


def truth_leaks(masked: str, call: dict, dataset: dict) -> dict:
    """정답을 아는 가짜 데이터로, 가린 글에 원래 값이 남았는지 따로 본다(가림 모듈과 다른 방법)."""
    plain = mk.ALIAS_RX.sub(" ", masked)
    pn = mk.norm(plain)
    leaks = {"전화": [], "차번호": [], "이름": [], "거래처": []}
    digits = re.sub(r"\D", "", plain)
    for cust, info in (dataset.get("customers") or {}).items():
        ph = re.sub(r"\D", "", info.get("phone") or "")
        if ph and ph in digits:
            leaks["전화"].append("거래처 번호")
        if mk.norm(cust) in pn:
            leaks["거래처"].append("목록 이름")
        stem = mk.split_suffix(cust)[0]
        if len(stem) >= 2 and stem not in COMMON_STEMS and stem in pn:
            leaks["거래처"].append("이름 앞부분")
    plate = (call.get("gold") or {}).get("plate")
    if plate:
        m = re.match(r"(\d+)\D+(\d{4})", plate)
        if m and re.search(m.group(1) + r"\D{0,4}" + m.group(2), plain):
            leaks["차번호"].append("정답 차번호")
        if m and m.group(2) in re.sub(r"\s", "", plain):
            leaks["차번호"].append("차번호 뒷자리")
    for who in list((call.get("speakers") or {}).values()) + list(dataset.get("staff") or {}):
        m = TITLE_RX.match(who.strip())
        if m and re.search(re.escape(m.group(1)) + r"\s?" + re.escape(m.group(2)), plain):
            leaks["이름"].append("성 + 직함")
    for m in mk.RX["상호"].finditer(plain):
        if m.group(1) not in mk.NOT_NAME:
            leaks["거래처"].append("상호 꼴")
    # 받아쓰기가 틀린 이름(산성정비 ≈ 한성정비)까지: 낱말 하나 · 둘씩 묶어 정답 거래처와 소리를 견준다
    gold_c = (call.get("gold") or {}).get("customer") or call.get("customer")
    if gold_c:
        toks = re.findall(r"[가-힣A-Za-z0-9]+", plain)
        n = len(mk.norm(gold_c))
        for a, b in zip(toks, toks[1:] + [""]):
            ab = a + b
            for L in (n - 1, n, n + 1):          # 조사가 붙은 낱말(산성정비인데요)도 앞에서부터 잘라 견준다
                for st in range(0, max(1, len(ab) - L + 1)):
                    cand = ab[st:st + L]
                    if len(cand) >= 3 and mk.similarity(cand, gold_c) >= 0.8:
                        leaks["거래처"].append("소리가 비슷한 상호")
                        break
    if gold_c:
        stem = mk.split_suffix(gold_c)[0]
        first = "\n".join(plain.split("\n")[:4])
        if len(stem) >= 2 and re.search(re.escape(stem) + r"\s?(?:이야|이요|인데|이에요|예요|입니다|요)", first):
            leaks["거래처"].append("첫머리에 상호 앞부분")
        if len(stem) >= 2 and stem not in COMMON_STEMS:
            for w in re.findall(r"[가-힣]+", plain):
                for st in range(0, max(1, len(w) - len(stem) + 1)):
                    if mk.similarity(w[st:st + len(stem)], stem) >= 0.8:
                        leaks["거래처"].append("소리가 비슷한 상호 앞부분")
                        break
    return {k: sorted(set(v)) for k, v in leaks.items() if v}


def demo_card(text: str) -> dict | None:
    """비교 기준 — 지금 데모 서버의 카드 뽑기(가짜 통화 글). 서버의 빈도 제한(10분에 12번)을 지킨다."""
    body = json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")
    for attempt in range(6):
        req = urllib.request.Request(DEMO + "/api/live/extract", data=body, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "callnote-eval/0.1"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                d = json.loads(r.read().decode("utf-8"))
                return d.get("card")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(70)
                continue
            raise
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calls", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--customers", required=True)
    ap.add_argument("--home", default=str(Path.home() / ".t07-real-fake-eval"))
    ap.add_argument("--glossary", default=str(rm.REPO / "src" / "demo-data" / "glossary.txt"))
    ap.add_argument("--car-models", default=str(rm.REPO / "src" / "demo-data" / "car_models.txt"))
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", default="")
    ap.add_argument("--baseline", action="store_true", help="지금 데모 서버 카드도 받아 견준다(느림: 10분에 12건)")
    ap.add_argument("--no-send", action="store_true", help="가림 · 검사만(보내지 않음)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    dataset = json.loads(Path(args.calls).read_text(encoding="utf-8"))
    if "가짜" not in json.dumps(dataset.get("_설명", ""), ensure_ascii=False):
        raise SystemExit("가짜 데이터셋이 아니다(calls.json 설명에 「가짜」가 없음) — 멈춤")
    home = rm.Home(Path(args.home))
    if home.root.resolve() == rm.DEFAULT_HOME.resolve():
        raise SystemExit("평가는 실제 녹음 폴더에서 돌리지 않는다 — 멈춤")
    calls = [c for c in dataset["calls"] if (Path(args.audio) / f"{c['id']}.wav").exists()]
    if args.only:
        calls = [c for c in calls if c["id"] in args.only.split(",")]
    if args.limit:
        calls = calls[:args.limit]
    masker = mk.Masker(rm.read_lines(Path(args.customers)))
    prompt = rm.glossary_prompt(Path(args.glossary))
    holder = {}

    def get_tr():
        if "tr" not in holder:
            import callnote_agent as ca
            holder["tr"] = ca.WhisperTranscriber("large-v3", "auto")
        return holder["tr"]

    sender = None if args.no_send else rm.Sender(masker, rm._dictionary(Path(args.glossary), Path(args.car_models)))
    results = rm.read_json(Path(args.out), {}) or {}
    for i, c in enumerate(calls, 1):
        cid = c["id"]
        wdir = home.work / cid
        tr = rm.transcribe_one(Path(args.audio) / f"{cid}.wav", wdir, get_tr, prompt)
        mc = rm.mask_transcript(cid, tr, masker)
        rm.save_masked(wdir, mc, tr)
        row = results.get(cid, {})
        row.update({"checkOk": mc.ok, "problems": mc.problems, "aliases": rm._count_kinds(mc.table),
                    "truthLeaks": truth_leaks(mc.text, c, dataset)})
        if sender and mc.ok and "masked" not in row:
            t0 = time.time()
            try:
                masked_card = sender.send_masked(mc)
                card = rm.finish_card(masked_card, mc)
                rm.write_json(wdir / "card.json", card)
                row["masked"] = score(c["gold"], card)
                row["maskedSec"] = round(time.time() - t0, 1)
            except Exception as e:  # noqa: BLE001
                row["maskedError"] = f"{type(e).__name__}: {str(e)[:120]}"
        if args.baseline and "demo" not in row:
            t0 = time.time()
            try:
                card = demo_card(tr["text"] if not tr.get("segments") else "\n".join(s["text"] for s in tr["segments"]))
                if card:
                    rm.write_json(wdir / "card.demo.json", card)
                    row["demo"] = score(c["gold"], card)
                row["demoSec"] = round(time.time() - t0, 1)
            except Exception as e:  # noqa: BLE001
                row["demoError"] = f"{type(e).__name__}: {str(e)[:120]}"
            time.sleep(max(0, 60 - (time.time() - t0)))   # 10분에 10번 — 서버 제한(12번)보다 여유 있게
        results[cid] = row
        rm.write_json(Path(args.out), results)
        print(f"[{i}/{len(calls)}] {cid} 검사 {'통과' if mc.ok else '걸림 ' + str(mc.problems)} · 가림 {rm._count_kinds(mc.table)} · "
              f"정답 대조 새는 것 {row['truthLeaks'] or '없음'} · 실제 모드 카드 {'정답' if (row.get('masked') or {}).get('카드 전체') else row.get('masked') and '틀림' or row.get('maskedError', '-')}"
              + (f" · 데모 {'정답' if (row.get('demo') or {}).get('카드 전체') else '틀림'}" if row.get("demo") else ""), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
