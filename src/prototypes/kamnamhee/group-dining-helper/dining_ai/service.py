"""모임 하나를 다루는 흐름: 의견 추가 → 조건 정리 → 후보 고르기 → 달라진 점 설명 → 투표 → 결정."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from .changes import explain
from .config import Settings, load_settings
from .data import load_restaurants
from .engine import rank
from .models import KIND_LABEL, Condition, won
from .parse import parse
from .store import Store

# "민수: 저 회 못 먹어요" / "[민수] [오후 3:12] 저 회 못 먹어요" (카톡 PC) /
# "2026. 11. 10. 오후 3:12, 민수 : 저 회 못 먹어요" (카톡 모바일)
_KAKAO_PC = re.compile(r"^\[([^\]]{1,20})\]\s*\[(?:오전|오후)\s*\d{1,2}:\d{2}\]\s*(.+)$")
_KAKAO_MOBILE = re.compile(r"^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:오전|오후)\s*\d{1,2}:\d{2},\s*([^:]{1,20}?)\s*:\s*(.+)$")
_NAME_COLON = re.compile(r"^([^:：\s][^:：]{0,11})\s*[:：]\s*(.+)$")


def split_opinions(text: str, default_author: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or re.match(r"^-+\s*\d{4}년", line):  # 카톡 날짜 구분선
            continue
        m = _KAKAO_PC.match(line) or _KAKAO_MOBILE.match(line) or _NAME_COLON.match(line)
        if m and not re.search(r"\d$", m.group(1)):  # "인당 4만 원: ..." 같은 오인 방지
            out.append((m.group(1).strip(), m.group(2).strip()))
        else:
            out.append((default_author, line))
    return out


def apply_overrides(conds: list[Condition], overrides: dict[str, str]) -> list[Condition]:
    out: list[Condition] = []
    for c in conds:
        ov = overrides.get(c.key)
        if ov is None:
            out.append(c)
            continue
        c = Condition.from_dict(c.to_dict())
        if c.type == "drinks":
            c.value = ov == "true"
        else:
            c.kind = ov
        c.author, c.quote = "담당자", "직접 바꿈"
        out.append(c)
    return out


class Service:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or load_settings()
        self.store = Store(self.settings.db_path)
        self.restaurants = load_restaurants(self.settings.restaurant_dir)
        self.by_id = {r.id: r for r in self.restaurants}
        self.stations = sorted({r.station for r in self.restaurants if r.station})
        self.categories = sorted({r.category for r in self.restaurants if r.category})

    # ── 모임 ──────────────────────────────────────────
    def create_meeting(self, title: str, request_text: str, author: str = "담당자",
                       suggestions: list[str] | None = None) -> int:
        mid = self.store.create_meeting(title.strip() or "새 모임", suggestions)
        for a, t in split_opinions(request_text, author):
            self.store.add_opinion(mid, a, t)
        self.recompute(mid, "모임 만듦")
        return mid

    def add_opinions(self, mid: int, text: str, author: str = "") -> int:
        pairs = split_opinions(text, author.strip() or "담당자")
        for a, t in pairs:
            self.store.add_opinion(mid, a, t)
        if pairs:
            who = ", ".join(dict.fromkeys(a for a, _ in pairs))
            self.recompute(mid, f"{who} 의견 추가")
        return len(pairs)

    def delete_opinion(self, mid: int, oid: int) -> None:
        op = self.store.delete_opinion(mid, oid)
        if op:
            self.recompute(mid, f"{op['author']} 의견 삭제")

    def set_override(self, mid: int, key: str, value: str) -> None:
        m = self.store.meeting(mid)
        ov = dict(m["overrides"])
        if value == "reset":
            ov.pop(key, None)
        else:
            ov[key] = value
        self.store.set_overrides(mid, ov)
        latest = self.store.latest_round(mid)
        label = next((Condition.from_dict(c).label() for c in latest["data"]["parsed"] if Condition.from_dict(c).key == key), key) if latest else key
        what = "원래대로" if value == "reset" else {"true": "주류 포함", "false": "주류 제외"}.get(value, KIND_LABEL.get(value, value))
        self.recompute(mid, f"담당자가 '{label}' 조건을 {what}(으)로 바꿈")

    def adopt_comment(self, mid: int, vid: int) -> None:
        v = self.store.vote_by_id(mid, vid)
        if v and v["comment"].strip():
            self.store.add_opinion(mid, v["voter"], v["comment"].strip(), source="vote")
            self.store.clear_vote_comment(mid, vid)
            self.recompute(mid, f"{v['voter']} 투표 의견 반영")

    def recompute(self, mid: int, trigger: str) -> dict[str, Any]:
        meeting = self.store.meeting(mid)
        ops = [{"author": o["author"], "text": o["text"]} for o in self.store.opinions(mid)]
        prev = self.store.latest_round(mid)
        prev_parsed = [Condition.from_dict(c) for c in prev["data"]["parsed"]] if prev else None
        prev_conds = [Condition.from_dict(c) for c in prev["data"]["conditions"]] if prev else None
        parsed = parse(ops, self.settings, self.stations, self.categories, previous=prev_parsed)
        conds = apply_overrides(parsed.conditions, meeting["overrides"])
        ranking = rank(self.restaurants, conds)
        data = {
            "conditions": [c.to_dict() for c in conds],
            "parsed": [c.to_dict() for c in parsed.conditions],
            "unmatched": parsed.unmatched,
            "parser": parsed.parser,
            "warnings": parsed.warnings,
            "ranking": ranking,
            "changes": explain(prev_conds, prev["data"]["ranking"] if prev else None, conds, ranking),
        }
        self.store.add_round(mid, trigger, data)
        return data

    # ── 투표·결정 ──────────────────────────────────────
    def tally(self, mid: int, candidate_ids: list[str]) -> dict[str, Any]:
        votes = self.store.votes(mid)
        by: dict[str, list[str]] = {rid: [] for rid in candidate_ids}
        stale: list[dict] = []
        for v in votes:
            if v["restaurant_id"] in by:
                by[v["restaurant_id"]].append(v["voter"])
            else:
                stale.append(v)  # 후보에서 빠진 식당에 투표한 사람 → 다시 투표 필요
        return {"by": by, "total": len(votes), "stale": stale,
                "comments": [v for v in votes if v["comment"].strip()]}

    def decide(self, mid: int, rid: str | None) -> None:
        self.store.decide(mid, rid)

    def booking(self, mid: int) -> dict[str, Any] | None:
        """결정 후 예약 안내: 캐치테이블 링크, 확인할 것, 단체방 공지 문구, 걸린 시간."""
        m = self.store.meeting(mid)
        latest = self.store.latest_round(mid)
        if not m or m["status"] != "decided" or not latest:
            return None
        r = self.by_id.get(m["decided_id"])
        if not r:
            return None
        data = latest["data"]
        conds = [Condition.from_dict(c) for c in data["conditions"]]
        get = {c.type: c for c in conds if c.active and c.type not in ("diet", "like", "avoid")}
        cand = next((c for c in data["ranking"]["candidates"] if c["id"] == r.id), None)
        drinks = data["ranking"]["drinks"]
        n = get["headcount"].value if "headcount" in get else None
        when = " ".join(x for x in (
            get["day"].label() if "day" in get else "", get["slot"].value if "slot" in get else "") if x) or "(날짜 미정)"
        pp = r.per_person(drinks)
        checks = [f"{when} {n or ''}명 좌석 예약 가능 여부".replace("  ", " ")]
        if any(c.type == "room" and c.active for c in conds) and r.rooms:
            checks.append(f"룸 예약 ({'·'.join(map(str, r.rooms))}인 룸)")
        for c in conds:
            if c.type == "diet" and c.active:
                checks.append(f"{c.label()} — 주문 때 메뉴 확인")
        checks += (cand["checks"] if cand else [])
        checks += [f"단체방 질문: {u['text']} ({u['author']})" for u in data.get("unmatched", [])]
        checks += [f"메뉴 가격 ({r.price_as_of} 기준 데이터) 변동 여부", "단체 예약 취소·노쇼 규정"]
        checks = list(dict.fromkeys(checks))
        notice = "\n".join(x for x in [
            f"[{m['title']} 장소 안내]",
            f"- 일시: {when}",
            f"- 장소: {r.name} ({r.station} 도보 {r.walk_min}분)",
            f"- 인원: {n}명" if n else "",
            f"- 예상: 인당 약 {won(pp)} ({r.basis}{', 주류 포함' if drinks else ''} 기준)",
            "※ 예약 확정 후 시간과 함께 다시 알려 드립니다.",
        ] if x)
        created = datetime.fromisoformat(m["created_at"])
        decided = datetime.fromisoformat(m["decided_at"]) if m["decided_at"] else datetime.now()
        rounds = self.store.rounds(mid)
        metrics = {
            "minutes": max(0, round((decided - created).total_seconds() / 60)),
            "opinions": len(self.store.opinions(mid)),
            "conditions": sum(1 for c in conds if c.active),
            "rounds": len(rounds),
            "votes": len(self.store.votes(mid)),
        }
        return {"restaurant": r, "candidate": cand, "per_person": pp, "total": pp * n if n else None,
                "headcount": n, "when": when, "checks": checks, "notice": notice, "metrics": metrics, "drinks": drinks}
