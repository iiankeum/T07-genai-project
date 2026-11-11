#!/usr/bin/env python3
"""가짜 주문 통화로 PC 안 음성 인식(faster-whisper) 모델을 비교한다 — 속도 · 현장 말 알아듣기.

AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 한결(총괄·서버) 작업방 · 2026-11-11

정답은 해결사 방의 가짜 통화 데이터셋(src/demo-data/calls.json)의 정답 카드(gold)다.
받아쓴 글에 정답 카드의 낱말(부품 · 차종 · 거래처)이 들어 있는지를 센다(띄어쓰기 · 문장부호 무시).
Claude 가 고쳐 읽기 전의 「날것」 받아쓰기 점수라서, 카드 점수보다 낮게 나오는 것이 정상이다.

  python bench_stt.py --calls <calls.json> --audio <음성 폴더> --glossary <glossary.txt> \
      --models large-v3,large-v3-turbo,medium,small --device cuda --out result.json
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import callnote_agent as ca  # noqa: E402


def norm(s: str) -> str:
    return re.sub(r"[\s\W_]+", "", (s or "").lower())


def hit(text_n: str, alternatives: str | list[str]) -> bool:
    alts = alternatives if isinstance(alternatives, list) else alternatives.split("|")
    return any(norm(a) and norm(a) in text_n for a in alts)


def score(text: str, gold: dict) -> dict:
    t = norm(text)
    items = gold.get("items") or []
    parts = [hit(t, it.get("part_kw") or [it.get("part", "")]) for it in items]
    car_kw = gold.get("car_kw") or []
    car = all(hit(t, kw) for kw in car_kw) if car_kw else None
    cust = gold.get("customer")
    return {
        "parts_hit": sum(parts), "parts_total": len(parts),
        "car": car, "customer": (norm(cust) in t) if cust else None,
    }


def load_audio(path: Path):
    """우리가 만든 가짜 음성 파일만 읽는다(인터넷에서 온 파일이 아님)."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def gpu_mem_used() -> int | None:
    try:
        out = subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                             capture_output=True, text=True, timeout=10).stdout.strip().splitlines()
        return int(out[0]) if out else None
    except Exception:  # noqa: BLE001
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--calls", required=True)
    ap.add_argument("--audio", required=True, help="c01.wav … 이 있는 폴더")
    ap.add_argument("--glossary")
    ap.add_argument("--models", default="large-v3")
    ap.add_argument("--device", default="cuda", choices=["cuda", "cpu"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--no-prompt", action="store_true")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    calls = json.loads(Path(args.calls).read_text(encoding="utf-8"))["calls"]
    audio_dir = Path(args.audio)
    calls = [c for c in calls if (audio_dir / f"{c['id']}.wav").exists() or (audio_dir / f"{c['id']}.mp3").exists()]
    if args.limit:
        calls = calls[:args.limit]
    prompt = None
    if args.glossary and not args.no_prompt:
        terms = []
        for line in Path(args.glossary).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                terms.append(line.split("=", 1)[0].strip())
        prompt = "자동차 부품 대리점 주문 전화입니다. " + ", ".join(terms) + "."
    audios = {}
    for c in calls:
        p = audio_dir / f"{c['id']}.wav"
        audios[c["id"]] = load_audio(p if p.exists() else audio_dir / f"{c['id']}.mp3")

    results = {"device": args.device, "audio": audio_dir.name, "n": len(calls), "prompt": bool(prompt), "models": {}}
    for m in [x.strip() for x in args.models.split(",") if x.strip()]:
        before = gpu_mem_used() if args.device == "cuda" else None
        t0 = time.time()
        tr = ca.WhisperTranscriber(m, args.device)
        load = time.time() - t0
        after = gpu_mem_used() if args.device == "cuda" else None
        rows, dur, el = [], 0.0, 0.0
        for c in calls:
            out = tr.transcribe(audios[c["id"]], prompt)
            s = score(out["text"], c["gold"])
            rows.append({"id": c["id"], "noise": c.get("audio_noise"), "dur": out["durationSec"],
                         "elapsed": out["elapsedSec"], **s})
            dur += out["durationSec"]
            el += out["elapsedSec"]
        ph = sum(r["parts_hit"] for r in rows)
        pt = sum(r["parts_total"] for r in rows)
        cars = [r["car"] for r in rows if r["car"] is not None]
        custs = [r["customer"] for r in rows if r["customer"] is not None]
        summ = {
            "engine": tr.engine, "loadSec": round(load, 1), "audioSec": round(dur, 1), "elapsedSec": round(el, 1),
            "rtf": round(el / dur, 3) if dur else None,
            "vramMB": (after - before) if (before is not None and after is not None) else None,
            "parts": f"{ph}/{pt}", "car": f"{sum(cars)}/{len(cars)}", "customer": f"{sum(custs)}/{len(custs)}",
        }
        results["models"][m] = {"summary": summ, "rows": rows}
        print(json.dumps({m: summ}, ensure_ascii=False), flush=True)
        del tr
        import gc
        gc.collect()
    Path(args.out).write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
