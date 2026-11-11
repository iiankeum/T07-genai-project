"""조건 → 식당 후보 (최대 3곳).

필수 조건은 하나라도 안 맞으면 뺀다. 선호 조건은 점수(중요도 × 맞는 정도)로 줄을 세운다.
금액은 식당 데이터의 '기준 메뉴' 인당 금액 × 인원으로 계산한다. AI는 이 계산에 끼지 않는다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .models import NEEDS_STORE_CHECK, Condition, Restaurant, diet_who, diet_without, won

TOP_N = 3


@dataclass
class Evaluation:
    r: Restaurant
    failed: list[str] = field(default_factory=list)       # 필수 조건 탈락 이유
    budget_over: int = 0                                  # 예산 초과액 (예산만 걸렸을 때 '조금만 올리면' 안내용)
    points: dict[str, float] = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)      # 추천 이유
    cons: list[str] = field(default_factory=list)         # 아쉬운 점
    checks: list[str] = field(default_factory=list)       # 확인 필요
    per_person: int = 0
    total: int | None = None
    score: float = 0.0

    @property
    def ok(self) -> bool:
        return not self.failed


def _walk_match(walk: int, target: int) -> float:
    within = 1.0 if walk <= target else max(0.0, 1 - (walk - target) / 8)
    closeness = max(0.0, 1 - walk / 15)
    return 0.7 * within + 0.3 * closeness


def evaluate(r: Restaurant, conds: list[Condition]) -> Evaluation:
    active = [c for c in conds if c.active]
    get = {c.type: c for c in active if c.type not in ("diet", "like", "avoid")}
    n = get["headcount"].value if "headcount" in get else None
    drinks_c = next((c for c in conds if c.type == "drinks"), None)
    drinks = bool(drinks_c.value) if drinks_c else True
    when = " ".join(x for x in (
        f"{get['day'].value}요일" if "day" in get else "", get["slot"].value if "slot" in get else "") if x) or "모임 날"

    e = Evaluation(r=r, per_person=r.per_person(drinks))
    e.total = e.per_person * n if n else None

    def add(c: Condition, match: float, good: str = "", bad: str = "", fail: str = "") -> None:
        """must면 통과/탈락, prefer면 점수. good/bad는 설명 문구."""
        if c.kind == "must":
            if match >= 1 or (c.type == "avoid" and match >= 0):
                if good:
                    e.reasons.append(good)
            else:
                e.failed.append(fail or bad)
        else:
            e.points[c.key] = round(c.weight * match, 3)
            if match > 0 and good:
                e.reasons.append(good)
            elif match <= 0 and bad:
                e.cons.append(bad)

    for c in active:
        t, v = c.type, c.value
        if t == "area":
            add(c, 1.0 if r.station in v else 0.0, fail=f"{r.station} 식당 (요청: {'·'.join(v)})")
        elif t == "headcount":
            ok = r.max_group >= v
            add(c, 1.0 if ok else 0.0, fail=f"단체 최대 {r.max_group}명 — {v}명 불가")
            if ok and r.max_group - v <= 2:
                e.checks.append(f"단체석이 최대 {r.max_group}명 — 인원이 늘면 다시 확인")
        elif t == "budget":
            pp = e.per_person
            if pp <= v:
                gap = v - pp
                good = f"인당 약 {won(pp)} — 예산보다 {won(gap)} 여유" if gap >= 2000 else f"인당 약 {won(pp)} — 예산에 딱 맞음"
                if gap < 2000:
                    e.checks.append("예산에 여유가 없음 — 추가 주문하면 넘을 수 있음")
                add(c, 1.0, good=good)
            else:
                e.budget_over = pp - v
                add(c, max(0.0, 1 - (pp - v) / v * 4),
                    bad=f"예상 인당 {won(pp)} — 예산보다 {won(pp - v)} 많음",
                    fail=f"예상 인당 {won(pp)} — 예산보다 {won(pp - v)} 많음")
        elif t == "day":
            add(c, 0.0 if v in r.closed_days else 1.0, fail=f"{v}요일 휴무")
        elif t == "slot":
            add(c, 1.0 if (r.lunch if v == "점심" else r.dinner) else 0.0, fail=f"{v} 영업 안 함")
        elif t == "diet":
            who, without = diet_who(v), diet_without(v)
            edible = r.edible_mains(v)
            names = ", ".join(m.name for m in edible[:3]) + (" 등" if len(edible) > 3 else "")
            unsure = v in NEEDS_STORE_CHECK
            good = (f"{who}도 고를 수 있어 보이는 메인 {len(edible)}가지 ({names})" if unsure
                    else f"{who}도 고를 메인 {len(edible)}가지 ({names})") if edible else ""
            add(c, 1.0 if edible else 0.0, good=good,
                bad=f"{without} 먹을 메인 메뉴가 없음", fail=f"{without} 먹을 메인 메뉴가 없음")
            if edible and unsure:
                e.checks.append(f"{who}: {NEEDS_STORE_CHECK[v]} — 매장 확인 필요")
            if len(edible) == 1:
                e.checks.append(f"{who}이 고를 메인이 '{edible[0].name}' 하나뿐")
        elif t == "room":
            fitting = [x for x in r.rooms if not n or x >= n]
            if fitting:
                good = f"{fitting[0]}인 룸 있음" if n else f"룸 있음 ({'·'.join(map(str, r.rooms))}인)"
                add(c, 1.0, good=good)
                e.checks.append(f"룸은 미리 예약 — {when}에 빈 룸이 있는지 확인")
                if r.room_note:
                    e.checks.append(f"룸 조건: {r.room_note}")
            else:
                bad = f"룸 최대 {r.rooms[-1]}인 — {n}명은 홀 좌석" if r.rooms else "룸 없음 (홀 좌석)"
                add(c, 0.0, bad=bad)
        elif t == "walk":
            ok = r.walk_min <= v
            match = _walk_match(r.walk_min, v) if c.kind == "prefer" else (1.0 if ok else 0.0)
            if c.kind == "prefer":
                e.points[c.key] = round(c.weight * match, 3)
                (e.reasons if ok else e.cons).append(
                    f"{r.station} 도보 {r.walk_min}분" if ok else f"도보 {r.walk_min}분 — 희망({v}분 이내)보다 멂")
            else:
                add(c, match, good=f"{r.station} 도보 {r.walk_min}분", fail=f"도보 {r.walk_min}분 — {v}분 넘음")
        elif t == "one_table":
            if not n:
                continue
            by_table = r.max_table >= n
            by_room = any(x >= n for x in r.rooms)
            good = f"{n}명이 한 테이블에 앉을 수 있음 (최대 {r.max_table}명)" if by_table else (
                f"{n}인 이상 룸에서 다 같이 앉을 수 있음" if by_room else "")
            add(c, 1.0 if (by_table or by_room) else 0.0, good=good,
                bad=f"한 테이블 최대 {r.max_table}명 — 나눠 앉아야 할 수 있음")
            if not (by_table or by_room):
                e.checks.append("테이블을 붙여 다 같이 앉을 수 있는지 확인")
        elif t == "like":
            add(c, 1.0 if r.category == v else 0.0, good=f"{v} 희망 반영")
        elif t == "avoid":
            if r.category == v:
                add(c, -1.0, bad=f"{v} 피하고 싶다는 의견 있음", fail=f"{v} 제외 요청")
            elif c.kind == "prefer":
                e.points[c.key] = 0.0
        elif t == "quiet":
            quiet = "조용함" in r.moods
            add(c, 1.0 if quiet else 0.0, good="조용한 편이라 대화하기 좋음",
                bad="시끌벅적한 편" if "시끌벅적" in r.moods else "")
        elif t == "parking":
            add(c, 1.0 if r.parking else 0.0, good="주차 가능", bad="주차 안 됨")
            if r.parking:
                e.checks.append("주차 대수·요금 확인")

    tiebreak = -0.005 * r.walk_min
    if "budget" in get and get["budget"].value:
        tiebreak += 0.5 * max(0, get["budget"].value - e.per_person) / get["budget"].value
    e.points["_tiebreak"] = round(tiebreak, 3)
    e.score = round(sum(e.points.values()), 3)
    return e


def _candidate(e: Evaluation, drinks: bool) -> dict[str, Any]:
    r = e.r
    return {
        "id": r.id, "name": r.name, "category": r.category, "station": r.station, "walk_min": r.walk_min,
        "per_person": e.per_person, "total": e.total, "basis": r.basis, "drinks": drinks,
        "food_pp": r.food_pp, "drinks_pp": r.drinks_pp, "price_as_of": r.price_as_of,
        "reasons": e.reasons, "cons": e.cons, "checks": list(dict.fromkeys(e.checks)),
        "score": e.score, "points": e.points, "catchtable": r.catchtable, "note": r.note,
    }


def rank(restaurants: list[Restaurant], conds: list[Condition], top_n: int = TOP_N) -> dict[str, Any]:
    drinks_c = next((c for c in conds if c.type == "drinks"), None)
    drinks = bool(drinks_c.value) if drinks_c else True
    head = next((c.value for c in conds if c.type == "headcount" and c.active), None)
    evals = [evaluate(r, conds) for r in restaurants]
    passing = sorted((e for e in evals if e.ok), key=lambda e: (-e.score, e.per_person, e.r.walk_min, e.r.id))
    failing = sorted((e for e in evals if not e.ok), key=lambda e: (len(e.failed), e.r.name))
    near = [e for e in failing if len(e.failed) == 1 and e.budget_over and e.budget_over <= 0.1 * (e.per_person - e.budget_over)]
    as_of = sorted({r.price_as_of for r in restaurants if r.price_as_of})
    return {
        "candidates": [_candidate(e, drinks) for e in passing[:top_n]],
        "order": [e.r.id for e in passing],
        "scores": {e.r.id: {"score": e.score, "points": e.points} for e in passing},
        "names": {e.r.id: e.r.name for e in evals},
        "walk": {e.r.id: e.r.walk_min for e in evals},
        "excluded": [{"id": e.r.id, "name": e.r.name, "category": e.r.category, "reasons": e.failed} for e in failing],
        "near_misses": [{"id": e.r.id, "name": e.r.name, "per_person": e.per_person, "over": e.budget_over} for e in near],
        "considered": len(restaurants),
        "headcount": head,
        "drinks": drinks,
        "price_as_of": as_of[-1] if as_of else "",
    }
