"""녹음 하나를 단어장과 함께 받아쓰는 전체 흐름.

1. 단어장에서 힌트를 고른다(토큰 예산 안에서).
2. 30초마다 힌트를 넣으며 받아쓴다.
3. 단어장이 힌트 자리보다 크면 「두 번 듣기」: 1차 받아쓴 글에 소리가 비슷하게 나온 낱말을 골라 다시 받아쓴다.
4. 받아쓴 글을 단어장으로 고친다(다르게 들리는 말 · 띄어쓰기 · 소리 비슷).
5. 글에 나온 낱말의 「쓰인 횟수」를 올린다(다음에 힌트 고를 때 먼저 들어간다).
"""
from __future__ import annotations

import threading
from typing import Callable

from . import jamo
from .correct import Corrector, to_pieces
from .engine import Engine, transcribe, Segment
from .glossary import Glossary
from .hints import plan_hints, tokenizer_counter, HintPlan


def hits_in(glossary: Glossary, segments_text: list[str]) -> dict[str, int]:
    joined = jamo.squash(" ".join(segments_text))
    out = {}
    for e in glossary.entries:
        t = jamo.squash(e.term)
        if t:
            n = joined.count(t)
            if n:
                out[e.term] = n
    return out


def candidates_from(glossary: Glossary, segments: list[Segment], already: list[str]) -> list[str]:
    """1차 받아쓴 글에 (그대로든 비슷한 소리로든) 나온 낱말들. 두 번째 받아쓰기 힌트에 먼저 넣는다."""
    have = set(t.lower() for t in already)
    loose = Corrector(glossary)
    found: list[str] = []
    seen: set[str] = set()
    for s in segments:
        for f in loose.find(s.text):
            if f.after.lower() not in seen:
                seen.add(f.after.lower())
                found.append(f.after)
    joined = jamo.squash(" ".join(s.text for s in segments))
    for e in glossary.entries:
        sq = jamo.squash(e.term)
        if sq and sq in joined and e.term.lower() not in seen:
            seen.add(e.term.lower())
            found.append(e.term)
    return [t for t in found if t.lower() not in have] + [t for t in found if t.lower() in have]


def run(engine: Engine, audio, glossary: Glossary | None, context: str = "", language: str | None = "ko",
        hint_mode: str = "hotwords", correct: bool = True, two_pass: str = "auto",
        progress: Callable[[str, float], None] | None = None, cancel: threading.Event | None = None) -> dict:
    counter = tokenizer_counter(engine.tokenizer) if engine.tokenizer is not None else None
    plan = plan_hints(glossary, context, counter)
    long_on_cpu = engine.device == "cpu" and len(audio) / 16000 > 600
    do_two = glossary is not None and hint_mode == "hotwords" and (
        two_pass == "on" or (two_pass == "auto" and plan.excluded and not long_on_cpu))  # CPU 로 10분 넘는 녹음은 한 번만 듣는다

    def prog(stage: str, lo: float, hi: float):
        return (lambda x: progress(stage, lo + (hi - lo) * x)) if progress else None

    passes = []
    first_hi = 0.5 if do_two else 1.0
    if progress:
        progress("받아쓰는 중" if not do_two else "1차로 듣는 중", 0.0)
    segments, meta = transcribe(engine, audio, plan if hint_mode != "none" else None, language, hint_mode,
                                progress=prog("받아쓰는 중" if not do_two else "1차로 듣는 중", 0.0, first_hi),
                                cancel=cancel)
    passes.append({"included": len(plan.included), "elapsed": meta["elapsed"]})
    if do_two:
        boost = candidates_from(glossary, segments, [])
        plan = plan_hints(glossary, context, counter, boost=boost)
        if progress:
            progress("고른 낱말로 다시 듣는 중", 0.5)
        segments, meta2 = transcribe(engine, audio, plan, language, hint_mode,
                                     progress=prog("고른 낱말로 다시 듣는 중", 0.5, 1.0), cancel=cancel)
        passes.append({"included": len(plan.included), "elapsed": meta2["elapsed"], "boosted": boost[:50]})
        meta["elapsed"] = round(meta["elapsed"] + meta2["elapsed"], 1)

    corrector = Corrector(glossary) if (correct and glossary) else None
    out_segments = []
    for s in segments:
        fixes = corrector.find(s.text) if corrector else []
        out_segments.append({"start": s.start, "end": s.end, "raw": s.text, "pieces": to_pieces(s.text, fixes)})

    hits = {}
    if glossary is not None:
        from .correct import pieces_text
        hits = hits_in(glossary, [pieces_text(x["pieces"]) for x in out_segments])

    if progress:
        progress("끝", 1.0)
    return {"segments": out_segments, "meta": meta, "hints": plan.to_dict(), "passes": passes, "hits": hits}


def plan_for(glossary: Glossary | None, context: str, engine: Engine | None) -> HintPlan:
    counter = tokenizer_counter(engine.tokenizer) if engine is not None and engine.tokenizer is not None else None
    return plan_hints(glossary, context, counter)
