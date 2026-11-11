"""의견이 바뀌었을 때 '무엇이 달라졌나' 설명.

이전 결과와 지금 결과의 조건·점수를 비교해 문장으로 만든다.
점수 차이에서만 이유를 뽑기 때문에 없는 사실을 지어내지 않는다.
"""
from __future__ import annotations

from typing import Any

from .models import KIND_LABEL, WEIGHT_LABEL, Condition

SHORT = {"room": "룸", "walk": "역 거리", "one_table": "한 테이블", "quiet": "조용함", "parking": "주차",
         "budget": "예산", "_tiebreak": "예산 여유·거리"}


def _josa_ro(word: str) -> str:
    """'모퉁이 삼겹' → '으로', '청운각' → '으로', '샤브정원' → '으로', '포 사이공' → '으로'."""
    ch = word.strip()[-1:] if word.strip() else ""
    if "가" <= ch <= "힣":
        jong = (ord(ch) - 0xAC00) % 28
        return "로" if jong in (0, 8) else "으로"  # 받침 없음 / ㄹ받침
    return "(으)로"


def _short(key: str) -> str:
    if ":" in key:
        t, v = key.split(":", 1)
        return {"like": f"{v} 희망", "avoid": f"{v} 기피", "diet": f"{v} 못 먹음"}.get(t, key)
    return SHORT.get(key, key)


def _src(c: Condition) -> str:
    if not c.author or c.author == "자동":
        return ""
    return f" — {c.author} 「{c.quote}」" if c.quote else f" — {c.author}"


def condition_changes(prev: list[Condition], cur: list[Condition]) -> list[str]:
    p = {c.key: c for c in prev}
    q = {c.key: c for c in cur}
    out: list[str] = []
    for k, c in q.items():
        o = p.get(k)
        if c.type == "drinks":
            if o and o.value != c.value:
                out.append(f"~ {o.label()} → {c.label()}{_src(c)}")
            continue
        if c.active and (o is None or not o.active):
            w = f", 중요도 {WEIGHT_LABEL.get(c.weight)}" if c.kind == "prefer" else ""
            out.append(f"+ {c.label()} ({KIND_LABEL[c.kind]}{w}){_src(c)}")
        elif not c.active and o is not None and o.active:
            out.append(f"− {o.label()}: 조건에서 뺌{_src(c)}")
        elif c.active and o is not None:
            if o.label() != c.label():
                out.append(f"~ {o.label()} → {c.label()}{_src(c)}")
            elif o.kind != c.kind:
                out.append(f"~ {c.label()}: {KIND_LABEL[o.kind]} → {KIND_LABEL[c.kind]}{_src(c)}")
            elif c.kind == "prefer" and o.weight != c.weight:
                arrow = "↑" if c.weight > o.weight else "↓"
                out.append(f"{arrow} {c.label()}: 중요도 {WEIGHT_LABEL.get(o.weight)} → {WEIGHT_LABEL.get(c.weight)}{_src(c)}")
    for k, o in p.items():
        if k not in q and o.active:
            out.append(f"− {o.label()}: 조건에서 빠짐")
    return out


def _why(rid: str, prev: dict, cur: dict) -> str:
    a = prev["scores"].get(rid, {}).get("points", {})
    b = cur["scores"].get(rid, {}).get("points", {})
    deltas = [(k, round(b.get(k, 0) - a.get(k, 0), 2)) for k in set(a) | set(b) if k != "_tiebreak"]
    deltas = [d for d in deltas if abs(d[1]) >= 0.05]
    deltas.sort(key=lambda d: -abs(d[1]))
    if not deltas:
        return "다른 후보의 점수가 바뀌면서 순서가 밀리거나 올라감"
    parts = []
    for k, d in deltas[:2]:
        fact = f"(도보 {cur['walk'].get(rid)}분)" if k == "walk" else ""
        parts.append(f"{_short(k)} {'+' if d > 0 else '−'}{abs(d):.1f}점{fact}")
    return ", ".join(parts)


def ranking_changes(prev: dict[str, Any], cur: dict[str, Any]) -> tuple[str, list[str]]:
    pt = [c["id"] for c in prev["candidates"]]
    ct = [c["id"] for c in cur["candidates"]]
    names = {**prev.get("names", {}), **cur.get("names", {})}
    out: list[str] = []
    for i, rid in enumerate(ct):
        if rid in pt:
            j = pt.index(rid)
            if j != i:
                out.append(f"{'▲' if j > i else '▼'} {names[rid]} {j + 1}위 → {i + 1}위 — {_why(rid, prev, cur)}")
        else:
            before = f"이전 {prev['order'].index(rid) + 1}위" if rid in prev["order"] else "이전엔 필수 조건 탈락"
            out.append(f"★ {names[rid]} 새로 후보 {i + 1}위 ({before}) — {_why(rid, prev, cur)}")
    for rid in pt:
        if rid in ct:
            continue
        if rid in cur["order"]:
            out.append(f"✕ {names[rid]} 후보에서 빠짐 (지금 {cur['order'].index(rid) + 1}위) — {_why(rid, prev, cur)}")
        else:
            why = next((x["reasons"] for x in cur["excluded"] if x["id"] == rid), [])
            out.append(f"✕ {names[rid]} 후보에서 빠짐 — 필수 조건 탈락: {', '.join(why)}")

    a, b = len(prev["order"]), len(cur["order"])
    if a != b:
        out.append(f"· 조건을 모두 맞춘 식당 {a}곳 → {b}곳")

    if not ct:
        headline = "조건에 맞는 식당이 없습니다. 필수 조건을 하나 풀어 보세요."
    elif pt and ct[0] != pt[0]:
        headline = f"1위가 {names[pt[0]]} → {names[ct[0]]}{_josa_ro(names[ct[0]])} 바뀌었습니다."
    elif set(ct) != set(pt):
        headline = "후보 구성이 바뀌었습니다."
    elif ct != pt:
        headline = "후보 순서가 바뀌었습니다."
    else:
        headline = "후보와 순서는 그대로입니다."
    return headline, out


def explain(prev_conds: list[Condition] | None, prev_rank: dict | None,
            cur_conds: list[Condition], cur_rank: dict) -> dict[str, Any]:
    if prev_rank is None:
        n = len(cur_rank["candidates"])
        return {"headline": f"조건에 맞는 후보 {n}곳을 골랐습니다." if n else "조건에 맞는 식당이 없습니다.",
                "conditions": [], "ranking": []}
    headline, ranking = ranking_changes(prev_rank, cur_rank)
    return {"headline": headline, "conditions": condition_changes(prev_conds or [], cur_conds), "ranking": ranking}
