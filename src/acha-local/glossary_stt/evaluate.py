"""단어장이 정말 도움이 되는지 잰다.

같은 녹음을 네 가지로 받아써서 정답 글과 비교한다.
- 단어장 없이
- 첫머리 힌트만(initial_prompt) — 흔히 쓰는 방식
- 30초마다 힌트(hotwords)
- 30초마다 힌트 + 받아쓴 뒤 고치기 — 이 프로그램의 기본

숫자 두 개를 낸다.
- 글자 오류율(CER): 띄어쓰기 · 문장부호를 빼고 글자 단위로 몇 % 틀렸나. 낮을수록 좋다.
- 낱말 맞힘: 정답 글에 나오는 단어장 낱말 중 받아쓴 글에도 그대로 나온 비율. 높을수록 좋다.
"""
from __future__ import annotations

from . import jamo
from .correct import pieces_text
from .engine import Engine
from .glossary import Glossary
from . import pipeline

CONDITIONS = [
    ("none", "단어장 없이", dict(glossary=False, hint_mode="none", correct=False)),
    ("prompt", "첫머리 힌트만", dict(glossary=True, hint_mode="prompt", correct=False)),
    ("hotwords", "30초마다 힌트", dict(glossary=True, hint_mode="hotwords", correct=False)),
    ("full", "힌트 + 고치기", dict(glossary=True, hint_mode="hotwords", correct=True)),
]


def char_errors(ref: str, hyp: str) -> tuple[int, int]:
    r, h = jamo.squash(ref), jamo.squash(hyp)
    prev = list(range(len(h) + 1))
    for i, rc in enumerate(r, 1):
        cur = [i]
        for j, hc in enumerate(h, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (rc != hc)))
        prev = cur
    return prev[-1], len(r)


def term_hits(glossary: Glossary, ref: str, hyp: str) -> tuple[int, int, list[str]]:
    r, h = jamo.squash(ref), jamo.squash(hyp)
    total = hit = 0
    missed = []
    for e in glossary.entries:
        t = jamo.squash(e.term)
        if not t:
            continue
        n_ref = r.count(t)
        if n_ref:
            n_hyp = min(n_ref, h.count(t))
            total += n_ref
            hit += n_hyp
            if n_hyp < n_ref:
                missed.append(e.term)
    return hit, total, missed


def final_text(result: dict) -> str:
    return " ".join(pieces_text(s["pieces"]) for s in result["segments"])


def compare(engine: Engine, audio, reference: str, glossary: Glossary, context: str = "",
            language: str | None = "ko", progress=None, cancel=None) -> dict:
    rows = []
    cache: dict[tuple, dict] = {}
    for i, (key, label, opt) in enumerate(CONDITIONS):
        if progress:
            progress(f"{label} 받아쓰는 중", i / len(CONDITIONS))
        ck = (opt["glossary"], opt["hint_mode"])
        if ck in cache:
            base = cache[ck]
            # 같은 받아쓰기에 고치기만 다시 적용
            res = _recorrect(base, glossary if opt["correct"] else None)
        else:
            res = pipeline.run(engine, audio, glossary if opt["glossary"] else None, context, language,
                               hint_mode=opt["hint_mode"], correct=opt["correct"], two_pass="auto",
                               cancel=cancel)
            cache[ck] = res
        text = final_text(res)
        err, n = char_errors(reference, text)
        hit, total, missed = term_hits(glossary, reference, text)
        rows.append({
            "key": key, "label": label, "cer": round(err / n, 4) if n else None, "charErrors": err, "chars": n,
            "termHit": hit, "termTotal": total, "missed": missed, "text": text,
            "elapsed": res["meta"]["elapsed"],
        })
    if progress:
        progress("끝", 1.0)
    first = next(iter(cache.values()))
    hinted = cache.get((True, "hotwords"), first)
    return {"rows": rows, "duration": first["meta"]["duration"], "hints": hinted["hints"]}


def _recorrect(res: dict, glossary: Glossary | None) -> dict:
    from .correct import Corrector, to_pieces
    c = Corrector(glossary) if glossary else None
    segs = []
    for s in res["segments"]:
        fixes = c.find(s["raw"]) if c else []
        segs.append({**s, "pieces": to_pieces(s["raw"], fixes)})
    return {**res, "segments": segs}
