"""의견 → 조건 정리. 생성형 AI가 정리하고, 실패하면 규칙 기반으로 대신한다.

AI는 '조건 목록'만 만든다. 식당 거르기·점수·금액 계산은 engine.py의 코드가 한다.
그래서 AI가 없는 식당이나 틀린 가격을 지어낼 수 없다.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

from .config import Settings
from .llm import chat, parse_json
from .models import DAYS, DIET_TAGS, SLOTS, TYPES, Condition
from .parse_rules import finalize, parse_opinions

SYSTEM_PROMPT = """너는 회식·거래처 식사·부서 모임 장소를 정하는 담당자를 돕는다.
단체 채팅방 의견을 읽고, 식당을 고를 때 쓸 '조건 목록'을 JSON으로 만든다.

조건 type과 value 형식 (이 밖의 type은 쓰지 않는다):
- area: 역 이름 목록. 아래 '식당 데이터에 있는 역' 중에서만. 예: ["강남역"]
- headcount: 인원 (정수)
- budget: 1인당 예산, 원 단위 정수. 총액만 말했으면 인원으로 나눈다. "4만 원 이하"처럼 기준이 없으면 1인당으로 본다.
- day: "월"~"일" 중 하나. 날짜를 말했으면 detail에 "11월 20일"처럼 적는다.
- slot: "점심" 또는 "저녁"
- diet: 못 먹는 음식·식단. "회","해산물","갑각류","돼지고기","소고기","닭고기","양고기","고기","채식","비건","매운맛" 중 하나. count에 해당 인원.
  "고기"는 고기만 안 먹음(해산물은 먹음), "채식"은 고기·해산물 모두 안 먹음, "비건"은 계란·유제품까지 동물성 재료를 전부 안 먹음.
  셋을 섞지 않는다. 같은 사람이 여러 번 말하면 인원을 늘리지 않는다.
- room, one_table, quiet, parking: value는 true
- walk: 역에서 도보 몇 분 이내 (정수). "역에서 가까우면"은 5, "걸어서 갈 수 있는"은 10. 이미 더 짧은 값이 있으면 짧은 값을 유지.
- like / avoid: 가고 싶은 / 피하고 싶은 업종. 아래 '업종' 목록 중 하나.
- drinks: 주류 포함해서 예산을 볼지 (true/false). 말이 없으면 넣지 않는다.

kind:
- must: 꼭 지켜야 함. 지역·요일·시간대·인원·예산·못 먹는 음식은 기본이 must.
- prefer: 되면 좋음. 룸·역 거리·한 테이블·분위기·주차·메뉴 희망은 기본이 prefer. "꼭/반드시 ~해야"면 must.
- off: 앞에서 나온 조건을 나중에 철회함 (예: "룸이 없어도 돼요" → room off). 지우지 말고 off로 남긴다.
- info: drinks에만 쓴다.
weight (prefer 중요도): 1 조금(질문·한 사람의 메뉴 희망), 2 보통, 3 높음("제일", "꼭", "X 없어도 Y가 좋아"의 Y).

규칙:
1. 의견은 시간 순서다. 나중 의견이 앞 의견을 바꾸면 나중 것을 따른다.
2. 이전 조건 목록이 주어지면, 새 의견 때문에 달라지는 것만 바꾸고 나머지는 그대로 둔다.
3. author에는 그 조건을 (마지막으로) 정한 사람, quote에는 근거가 된 말을 원문 그대로 짧게 옮긴다.
4. 조건으로 바꿀 수 없는 의견(예: 케이크 가져가도 되나요?, 늦게 도착해요)은 unmatched에 넣는다. 인사·동의("다 좋아요")는 무시한다.
5. 식당 이름이나 가격을 지어내지 않는다. 조건만 만든다.

JSON만 출력한다:
{"conditions": [{"type": "...", "value": ..., "kind": "must|prefer|off|info", "weight": 2, "count": 1, "detail": "", "author": "...", "quote": "..."}],
 "unmatched": [{"author": "...", "text": "..."}]}"""


@dataclass
class ParseOutcome:
    conditions: list[Condition]
    unmatched: list[dict]
    parser: str
    warnings: list[str] = field(default_factory=list)


def _coerce(d: dict, stations: list[str], categories: list[str]) -> Condition | None:
    t = d.get("type")
    if t not in TYPES:
        return None
    kind = d.get("kind") if d.get("kind") in ("must", "prefer", "off", "info") else (
        "info" if t == "drinks" else "must" if t in ("area", "headcount", "budget", "day", "slot", "diet") else "prefer")
    try:
        weight = min(3, max(1, int(d.get("weight") or 2)))
        count = max(1, int(d.get("count") or 1))
    except (TypeError, ValueError):
        weight, count = 2, 1
    v = d.get("value")
    try:
        if t == "area":
            v = [s for s in (v if isinstance(v, list) else [v]) if s in stations]
            if not v:
                return None
        elif t in ("headcount", "budget", "walk"):
            v = int(float(str(v).replace(",", "")))
            if v <= 0:
                return None
        elif t == "day":
            v = str(v).replace("요일", "").strip()
            if v not in DAYS:
                return None
        elif t == "slot":
            if v not in SLOTS:
                return None
        elif t == "diet":
            v = {"베지테리언": "채식", "vegetarian": "채식", "vegan": "비건", "완전 채식": "비건"}.get(str(v).lower(), v)
            if v not in DIET_TAGS:
                return None
        elif t in ("like", "avoid"):
            if v not in categories:
                return None
        elif t == "drinks":
            v = bool(v) if not isinstance(v, str) else v.strip().lower() in ("true", "1", "yes", "포함")
            kind = "info"
        else:
            v = True
    except (TypeError, ValueError):
        return None
    return Condition(type=t, value=v, kind=kind, weight=weight, count=count,
                     detail=str(d.get("detail") or ""), author=str(d.get("author") or ""), quote=str(d.get("quote") or ""))


def validate(data: dict, stations: list[str], categories: list[str]) -> tuple[list[Condition], list[dict]]:
    state: dict[str, Condition] = {}
    for d in data.get("conditions") or []:
        if isinstance(d, dict):
            c = _coerce(d, stations, categories)
            if c:
                state[c.key] = c  # 같은 조건이 두 번 나오면 나중 것
    unmatched = [{"author": str(u.get("author") or ""), "text": str(u.get("text") or "")}
                 for u in (data.get("unmatched") or []) if isinstance(u, dict) and u.get("text")]
    return finalize(state), unmatched


def parse(opinions: list[dict], settings: Settings, stations: list[str], categories: list[str],
          previous: list[Condition] | None = None) -> ParseOutcome:
    warnings: list[str] = []
    if settings.llm_provider != "rule":
        prev = [c.to_dict() for c in previous or [] if c.author != "자동"]
        user = (
            f"식당 데이터에 있는 역: {', '.join(stations)}\n"
            f"업종: {', '.join(categories)}\n\n"
            f"이전 조건 목록:\n{json.dumps(prev, ensure_ascii=False) if prev else '(없음)'}\n\n"
            "의견 (오래된 것부터):\n"
            + "\n".join(f"{i + 1}. [{o['author'] or '익명'}] {o['text']}" for i, o in enumerate(opinions))
        )
        try:
            conds, unmatched = validate(parse_json(chat(SYSTEM_PROMPT, user, settings)), stations, categories)
            return ParseOutcome(conds, unmatched, settings.llm_provider, warnings)
        except Exception as e:  # 시간 초과·응답 형식 오류 등 무엇이든 규칙 기반으로 대체
            warnings.append(f"AI 정리 실패로 규칙 기반 정리를 썼습니다 ({type(e).__name__}: {e})")
    r = parse_opinions(opinions, stations)
    return ParseOutcome(r.conditions, r.unmatched, "rule", warnings)
