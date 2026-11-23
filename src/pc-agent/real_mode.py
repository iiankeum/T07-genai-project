#!/usr/bin/env python3
"""실제 녹음 처리 — 대표님 PC 안에서: 받아쓰기 → 가림 → (가린 글만) Claude 로 카드 → 원래 값으로 되돌리기.

AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 한결(총괄·서버) 작업방 · 2026-11-12
대표님 결정(2026-11-12): 실제 녹음은 「가린 뒤 Claude 사용」.

  python real_mode.py preview          # 받아쓰기 + 가림까지만. 아무것도 보내지 않는다. 미리 보기 화면을 만든다.
  python real_mode.py run              # 가림 검사를 통과한 통화만 가린 글을 Claude 로 보내 카드를 만든다.
  python real_mode.py status           # 어디까지 했는지

데이터는 모두 저장소 밖 %USERPROFILE%\\.t07-real\\ 에 있다(바꾸려면 --home).
  inbox\\          ← 실제 녹음을 넣는 곳(m4a · mp3 · wav · amr · 3gp …)
  customers.txt   ← (있으면) 실제 거래처 목록, 한 줄에 하나 — 더 잘 가리고 이름을 목록 표기로 맞춘다
  names.txt       ← (있으면) 직원 · 손님 이름 목록
  extra.txt       ← (있으면) 그 밖에 가릴 말(우리 회사 이름 등)
  work\\<번호>\\    ← 통화마다 받아쓴 글 · 가린 글 · 대응표 · 검사 결과 · 카드
  preview\\        ← 미리 보기 화면(원래 글 ↔ 가린 글)
  out\\            ← 카드 모음(cards.html · cards.csv)

안전 약속
  - 이 파일에서 바깥(인터넷)으로 나가는 것은 send_masked() 한 곳뿐이고, 그 함수는 MaskedCall(가림 + 검사를 통과한 것)만 받는다.
    받아쓴 원래 글 · 대응표 · 거래처 목록은 어떤 요청에도 넣지 않는다.
  - 보내기 직전에 검사를 한 번 더 한다. 하나라도 걸리면 그 통화는 보내지 않고 멈춘다(work\\<번호>\\check.json).
  - 녹음 · 받아쓴 글 · 대응표 · 카드는 저장소 · 데모 서버 · S3 에 올리지 않는다(이 프로그램은 그런 기능이 없다).
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import card_prompt as cp  # noqa: E402
import masking as mk  # noqa: E402

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
DEFAULT_HOME = Path(os.environ.get("CALLNOTE_REAL_HOME", str(Path.home() / ".t07-real")))
SECRETS = Path(os.environ.get("CALLNOTE_SECRETS_DIR", str(Path.home() / ".t07-secrets")))
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".opus", ".amr", ".3gp", ".flac", ".webm", ".mp4"}
MODEL = os.environ.get("CALLNOTE_CLAUDE_MODEL", "claude-opus-5-5")
KST = dt.timezone(dt.timedelta(hours=9))


def now() -> str:
    return dt.datetime.now(KST).isoformat(timespec="seconds")


def log(msg: str) -> None:
    print(f"{dt.datetime.now(KST).strftime('%H:%M:%S')} {msg}", flush=True)


def read_lines(p: Path) -> list[str]:
    if not p.exists():
        return []
    return [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip() and not l.strip().startswith("#")]


def write_json(p: Path, data) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, p)


def read_json(p: Path, default=None):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return default


class Home:
    def __init__(self, root: Path):
        self.root = root
        self.inbox, self.work, self.preview, self.out = (root / x for x in ("inbox", "work", "preview", "out"))
        for d in (self.inbox, self.work, self.preview, self.out):
            d.mkdir(parents=True, exist_ok=True)

    def masker(self) -> mk.Masker:
        return mk.Masker(read_lines(self.root / "customers.txt"), read_lines(self.root / "names.txt"),
                         read_lines(self.root / "extra.txt"))

    def recordings(self) -> list[Path]:
        return sorted(p for p in self.inbox.rglob("*") if p.is_file() and p.suffix.lower() in AUDIO_EXT)


def rec_id(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:12]


# ───────────────────────── 1. 받아쓰기 (PC 안) ─────────────────────────

def load_audio_local(path: Path):
    """대표님이 넣은 녹음 파일을 이 PC 의 ffmpeg 로 16kHz mono 로 읽는다(인터넷에서 온 파일이 아님)."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def glossary_prompt(glossary: Path) -> str:
    terms = [l.split("=", 1)[0].strip() for l in read_lines(glossary) if "=" in l]
    return "자동차 부품 대리점 주문 전화입니다. " + ", ".join(terms) + "." if terms else ""


def transcribe_one(path: Path, wdir: Path, get_tr, prompt: str) -> dict:
    tf = wdir / "transcript.json"
    done = read_json(tf)
    if done:
        return done
    tr = get_tr()
    audio = load_audio_local(path)
    out = tr.transcribe(audio, prompt)
    data = {"source": path.name, "recordedAt": dt.datetime.fromtimestamp(path.stat().st_mtime, KST).isoformat(timespec="seconds"),
            "engine": tr.engine, "durationSec": out["durationSec"], "elapsedSec": out["elapsedSec"],
            "segments": out["segments"], "text": out["text"], "at": now()}
    write_json(tf, data)
    return data


# ───────────────────────── 2. 가림 (PC 안) ─────────────────────────

class MaskedCall:
    """가림과 보내기 전 검사를 거친 통화. 이것만 send_masked() 에 들어갈 수 있다."""
    __slots__ = ("rec_id", "lines", "table", "problems")

    def __init__(self, rec_id: str, lines: list[str], table: mk.AliasTable, problems: list[str]):
        self.rec_id, self.lines, self.table, self.problems = rec_id, lines, table, problems

    @property
    def ok(self) -> bool:
        return not self.problems and any(l.strip() for l in self.lines)

    @property
    def text(self) -> str:
        return "\n".join(self.lines)


def mask_transcript(rid: str, transcript: dict, masker: mk.Masker) -> MaskedCall:
    table = mk.AliasTable()
    lines = masker.mask_lines([s["text"] for s in transcript.get("segments") or []], table)
    if not lines and transcript.get("text"):
        lines = [masker.mask(transcript["text"], table)]
    problems = mk.find_leaks("\n".join(lines), table, masker)
    return MaskedCall(rid, lines, table, problems)


def save_masked(wdir: Path, mc: MaskedCall, transcript: dict) -> None:
    segs = transcript.get("segments") or []
    write_json(wdir / "masked.json", {
        "lines": [{"start": s.get("start"), "end": s.get("end"), "text": t} for s, t in zip(segs, mc.lines)]
                 if len(segs) == len(mc.lines) else [{"text": t} for t in mc.lines],
        "at": now()})
    write_json(wdir / "mapping.json", {"_설명": "가명 대응표 — 이 PC 밖으로 내보내지 않는다", **mc.table.to_json()})
    write_json(wdir / "check.json", {"ok": mc.ok, "problems": mc.problems,
                                     "counts": _count_kinds(mc.table), "at": now()})


def _count_kinds(table: mk.AliasTable) -> dict:
    out: dict = {}
    for e in table.entries.values():
        out[e["kind"]] = out.get(e["kind"], 0) + 1
    return out


# ───────────────────────── 3. 보내기 (가린 글만) ─────────────────────────

def _dictionary(glossary: Path, car_models: Path) -> str:
    """Claude 에 함께 보내는 사전 — 현장 말과 차종만. 거래처 · 사람 이름 목록은 보내지 않는다."""
    parts = []
    g = [l for l in read_lines(glossary) if "=" in l]
    if g:
        parts.append("[현장 말 사전] (왼쪽 말이 나오면 오른쪽 표준 말로 알아듣는다. 받아쓴 글에 비슷하게 틀린 낱말이 있으면 이 낱말로 고쳐 읽는다)\n"
                     + "\n".join(f"- {a.strip()} = {b.strip()}" for a, b in (l.split("=", 1) for l in g)))
    cars = read_lines(car_models)
    if cars:
        parts.append("[차종 목록] (받아쓴 차종이 이 중 하나와 소리가 같으면 이 표기로 적는다)\n" + ", ".join(cars[:200]))
    return "\n\n".join(parts)


class Sender:
    def __init__(self, masker: mk.Masker, dictionary: str):
        import anthropic
        key = os.environ.get("ANTHROPIC_API_KEY") or _read_key()
        if not key:
            raise SystemExit("Claude API 키를 찾지 못했다(저장소 밖 비밀 폴더의 server.env)")
        self.anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=key, max_retries=2, timeout=120)
        self.masker, self.dictionary = masker, dictionary

    def send_masked(self, mc: MaskedCall) -> dict:
        """가린 글만 Claude 로 보내 카드(가명이 든 채)를 받는다. 이 파일에서 바깥으로 나가는 유일한 길."""
        if type(mc) is not MaskedCall:
            raise TypeError("MaskedCall 만 보낼 수 있다")
        again = mk.find_leaks(mc.text, mc.table, self.masker)   # 보내기 직전 한 번 더
        if again or not mc.ok:
            raise PermissionError("가림 검사를 통과하지 못해 보내지 않는다: " + "; ".join(again or mc.problems or ["빈 글"]))
        user = (f"{self.dictionary}\n\n" if self.dictionary else "") + \
            f"[받아쓴 통화] (한 줄이 한 대목 · 화자 구분 없음 · 개인정보는 가명으로 가림)\n<<<\n{mc.text[:20000]}\n>>>\n\n위 통화로 주문 카드를 만든다."
        params = dict(model=MODEL, max_tokens=8000, system=cp.CARD_SYSTEM + "\n\n" + cp.MASK_NOTE,
                      output_config={"effort": "low", "format": {"type": "json_schema", "schema": cp.CARD_SCHEMA}},
                      messages=[{"role": "user", "content": user}])
        try:
            resp = self.client.beta.messages.create(**params, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
        except (self.anthropic.BadRequestError, TypeError):
            resp = self.client.messages.create(**params)   # 대체 모델 설정이 안 받아지면 기본 호출(같은 가린 글)
        if resp.stop_reason == "refusal":
            raise RuntimeError("Claude 가 답하지 않음(refusal)")
        text = next((b.text for b in resp.content if getattr(b, "type", "") == "text"), "")
        card = json.loads(text)
        card["_model"] = getattr(resp, "model", MODEL)
        return card


def _read_key() -> str:
    for line in (SECRETS / "server.env").read_text(encoding="utf-8").splitlines() if (SECRETS / "server.env").exists() else []:
        if line.startswith("ANTHROPIC_API_KEY="):
            return line.split("=", 1)[1].strip().strip("\"'")
    return ""


def finish_card(masked_card: dict, mc: MaskedCall) -> dict:
    """가명을 원래 값(거래처는 목록 표기)으로 되돌리고, 가림 단계에서 알게 된 「들어 보기」를 보탠다."""
    card = mk.unmask_obj(masked_card, mc.table)
    if isinstance(card.get("plate"), str):     # 받아쓰기의 띄어쓰기 · 쉼표(48고, 7531)를 뗀다
        card["plate"] = re.sub(r"[\s,.·]", "", card["plate"]) or None
    unsure = list(card.get("unsure") or [])
    for tag, e in mc.table.entries.items():
        if e.get("note") and tag in json.dumps(masked_card, ensure_ascii=False):
            unsure.append({"field": "customer", "item": -1, "reason": f"거래처 이름 — {e['note']}(받아쓴 그대로 둠)", "quote": e["original"]})
    card["unsure"] = unsure
    left = mk.LOOSE_ALIAS_RX.findall(json.dumps(card, ensure_ascii=False))
    if left:
        card.setdefault("unsure", []).append({"field": "other", "item": -1, "reason": "되돌리지 못한 가명이 남음", "quote": ""})
    return card


# ───────────────────────── 화면 ─────────────────────────

_CSS = """body{font:15px/1.6 -apple-system,'Malgun Gothic',sans-serif;margin:16px;color:#1d2433;background:#f6f7f9}
h1{font-size:20px} .card{background:#fff;border:1px solid #e3e6ec;border-radius:12px;padding:14px;margin:12px 0}
table{border-collapse:collapse;width:100%} td,th{border-top:1px solid #eee;padding:6px;vertical-align:top;text-align:left}
.m{color:#2f6fed;font-weight:600} .bad{color:#c62828;font-weight:700} .ok{color:#2e7d32} small{color:#5b6476}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px} @media(max-width:720px){.cols{grid-template-columns:1fr}}"""


def _mark(text: str) -> str:
    return mk.ALIAS_RX.sub(lambda m: f'<span class="m">{html.escape(m.group(0))}</span>', html.escape(text))


def write_preview(home: Home, rows: list[tuple[str, dict, MaskedCall]]) -> Path:
    stamp = dt.datetime.now(KST).strftime("%Y%m%d-%H%M")
    p = home.preview / f"미리보기-{stamp}.html"
    parts = [f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
             f"<title>가림 미리 보기</title><style>{_CSS}</style><h1>가림 미리 보기 · {html.escape(stamp)}</h1>"
             "<p><small>이 파일은 이 PC 에만 있다. 왼쪽이 받아쓴 원래 글, 오른쪽이 Claude 로 보낼 가린 글이다. "
             "오른쪽에 이름 · 번호 · 상호가 남아 있으면 run 하지 말고 거래처 · 이름 목록을 보태 다시 미리 본다.</small></p>"]
    for rid, tr, mc in rows:
        status = '<span class="ok">검사 통과 — 보낼 수 있음</span>' if mc.ok else \
            '<span class="bad">검사 걸림 — 보내지 않음: ' + html.escape("; ".join(mc.problems)) + "</span>"
        table_rows = "".join(f"<tr><td class=m>{html.escape(tag)}</td><td>{html.escape(e['kind'])}</td>"
                             f"<td>{html.escape(e['original'])}</td><td>{html.escape(e.get('canonical') or '')}"
                             f"{(' · ' + html.escape(e['note'])) if e.get('note') else ''}</td></tr>"
                             for tag, e in mc.table.entries.items())
        parts.append(f"<div class=card><b>{html.escape(rid)}</b> <small>{html.escape(tr.get('source', ''))} · "
                     f"{tr.get('durationSec')}초</small><br>{status}<div class=cols><div><h3>받아쓴 글</h3>"
                     + "<br>".join(html.escape(s['text']) for s in tr.get('segments') or [])
                     + "</div><div><h3>보낼 글(가림)</h3>" + "<br>".join(_mark(l) for l in mc.lines)
                     + f"</div></div><details><summary>대응표 {len(mc.table.entries)}개</summary><table>"
                     f"<tr><th>가명</th><th>종류</th><th>원래</th><th>목록 표기</th></tr>{table_rows}</table></details></div>")
    p.write_text("\n".join(parts), encoding="utf-8")
    return p


def write_out(home: Home) -> Path:
    rows = []
    for wdir in sorted(home.work.iterdir()):
        card, tr = read_json(wdir / "card.json"), read_json(wdir / "transcript.json") or {}
        if not card:
            continue
        rows.append((wdir.name, tr, card))
    rows.sort(key=lambda r: r[1].get("recordedAt", ""))
    with (home.out / "cards.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["번호", "녹음 시각", "파일", "종류", "거래처", "담당", "차종", "연식", "차번호", "부품", "급함", "때", "받는 법", "되물을 것", "들어 보기", "요약"])
        for rid, tr, c in rows:
            w.writerow([rid, tr.get("recordedAt"), tr.get("source"), c.get("call_type"), c.get("customer"), c.get("contact"),
                        c.get("car_model"), c.get("model_year"), c.get("plate"),
                        " / ".join(f"{i.get('part')}{(' ' + i['side']) if i.get('side') else ''} ×{i.get('qty')}"
                                   f"{(' ' + i['part_no']) if i.get('part_no') else ''}" for i in c.get("items") or []),
                        c.get("urgent"), c.get("due"), c.get("delivery"), "; ".join(c.get("ask_back") or []),
                        "; ".join(u.get("reason", "") for u in c.get("unsure") or []), c.get("summary")])
    p = home.out / "cards.html"
    body = "".join(
        f"<div class=card><b>{html.escape(str(c.get('summary') or ''))}</b><br><small>{html.escape(str(tr.get('recordedAt')))} · "
        f"{html.escape(str(tr.get('source')))} · {html.escape(rid)}</small><table>"
        + "".join(f"<tr><th>{k}</th><td>{html.escape(str(v))}</td></tr>" for k, v in (
            ("종류", c.get("call_type")), ("거래처", c.get("customer")), ("담당", c.get("contact")),
            ("차", f"{c.get('car_model') or ''} {c.get('model_year') or ''} {c.get('plate') or ''}"),
            ("부품", " / ".join(f"{i.get('part')} ×{i.get('qty')}" for i in c.get("items") or [])),
            ("급함 · 때", f"{'급함' if c.get('urgent') else ''} {c.get('due') or ''} {c.get('delivery') or ''}"),
            ("되물을 것", "; ".join(c.get("ask_back") or [])),
            ("들어 보기", "; ".join(u.get("reason", "") for u in c.get("unsure") or []))) if v and str(v).strip())
        + "</table></div>" for rid, tr, c in rows)
    p.write_text(f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                 f"<title>실제 녹음 카드</title><style>{_CSS}</style><h1>실제 녹음 카드 · {len(rows)}건</h1>"
                 "<p><small>이 PC 에만 있다. 저장소 · 데모 사이트에 올리지 않는다.</small></p>" + body, encoding="utf-8")
    return p


# ───────────────────────── 실행 ─────────────────────────

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="실제 녹음 처리 — 받아쓰기 → 가림 → (가린 글만) Claude → 카드")
    ap.add_argument("mode", choices=["preview", "run", "status"])
    ap.add_argument("--home", default=str(DEFAULT_HOME), help="데이터 폴더(기본 %%USERPROFILE%%\\.t07-real)")
    ap.add_argument("--limit", type=int, default=0, help="앞에서부터 몇 건만")
    ap.add_argument("--model", default="large-v3", help="Whisper 모델")
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--glossary", default=str(REPO / "src" / "demo-data" / "glossary.txt"))
    ap.add_argument("--car-models", default=str(REPO / "src" / "demo-data" / "car_models.txt"))
    args = ap.parse_args(argv)

    home = Home(Path(args.home))
    gloss = Path(args.glossary) if Path(args.glossary).exists() else home.root / "glossary.txt"
    cars = Path(args.car_models) if Path(args.car_models).exists() else home.root / "car_models.txt"
    recs = home.recordings()
    if args.limit:
        recs = recs[:args.limit]

    if args.mode == "status":
        print(f"데이터 폴더: {home.root}\n녹음 {len(home.recordings())}건 · 받아씀 {len(list(home.work.glob('*/transcript.json')))} · "
              f"가림 검사 통과 {sum(1 for p in home.work.glob('*/check.json') if (read_json(p) or {}).get('ok'))} · "
              f"카드 {len(list(home.work.glob('*/card.json')))}\n목록: 거래처 {len(read_lines(home.root / 'customers.txt'))} · "
              f"이름 {len(read_lines(home.root / 'names.txt'))} · 가릴 말 {len(read_lines(home.root / 'extra.txt'))}")
        return 0
    if not recs:
        print(f"녹음이 없다. {home.inbox} 에 녹음 파일을 넣는다.")
        return 1
    masker = home.masker()
    if not masker.customers:
        log("알림: 거래처 목록(customers.txt)이 없어 상호 꼴(…카센터 · …공업사)과 패턴으로만 가린다. 목록을 주면 더 잘 가린다.")

    tr_holder = {}

    def get_tr():
        if "tr" not in tr_holder:
            import callnote_agent as ca
            log("음성 인식 모델을 올리는 중…")
            tr_holder["tr"] = ca.WhisperTranscriber(args.model, args.device)
        return tr_holder["tr"]

    prompt = glossary_prompt(gloss)
    rows = []
    for i, path in enumerate(recs, 1):
        rid = rec_id(path)
        wdir = home.work / rid
        try:
            tr = transcribe_one(path, wdir, get_tr, prompt)
        except subprocess.CalledProcessError:
            log(f"[{i}/{len(recs)}] {rid} 녹음을 읽지 못함(ffmpeg) — 건너뜀")
            continue
        mc = mask_transcript(rid, tr, masker)
        save_masked(wdir, mc, tr)
        rows.append((rid, tr, mc))
        log(f"[{i}/{len(recs)}] {rid} 받아씀 {tr['durationSec']}초 · 가림 {len(mc.table.entries)}개 · "
            f"{'검사 통과' if mc.ok else '검사 걸림(보내지 않음): ' + '; '.join(mc.problems)}")

    pv = write_preview(home, rows)
    log(f"미리 보기: {pv}")
    if args.mode == "preview":
        log("미리 보기 모드라 아무것도 보내지 않았다. 확인한 뒤 run 으로 카드를 만든다.")
        return 0

    sender = Sender(masker, _dictionary(gloss, cars))
    sent = held = 0
    for rid, tr, mc in rows:
        wdir = home.work / rid
        if read_json(wdir / "card.json"):
            continue
        if not mc.ok:
            held += 1
            continue
        t0 = time.time()
        try:
            masked_card = sender.send_masked(mc)
        except PermissionError as e:
            held += 1
            log(f"{rid} 보내지 않음: {e}")
            continue
        except Exception as e:  # noqa: BLE001
            log(f"{rid} 카드 만들기 실패({type(e).__name__}) — 다음에 run 하면 다시 한다")
            continue
        write_json(wdir / "card.masked.json", masked_card)
        write_json(wdir / "card.json", finish_card(masked_card, mc))
        sent += 1
        log(f"{rid} 카드 완성({time.time() - t0:.1f}초)")
    out = write_out(home)
    log(f"카드 {sent}건 새로 만듦 · 검사에 걸려 보내지 않음 {held}건 · 모음: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
