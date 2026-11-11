"""규칙 기반 조건 정리 (AI 없이 동작하는 기본값).

단체 채팅방 의견을 차례대로 읽어 조건 목록을 만든다. 나중 의견이 앞 의견을 바꾼다.
API 키 없이 데모가 돌도록 만든 것이고, 생성형 AI 정리의 비교 기준(베이스라인)으로도 쓴다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from .models import DAYS, Condition

# ── 낱말 사전 ─────────────────────────────────────────────
NUM_WORDS = {"한": 1, "두": 2, "세": 3, "네": 4, "다섯": 5, "여섯": 6, "일곱": 7, "여덟": 8,
             "아홉": 9, "열": 10, "열한": 11, "열두": 12, "열세": 13, "열네": 14, "열다섯": 15}
_NUM = "|".join(sorted(NUM_WORDS, key=len, reverse=True))
_P = r"(?=[은는이가을를도요만랑나\s,.!?~]|$)"  # 낱말 끝(조사·공백·문장부호)

# 못 먹는 음식 (diet) — 순서대로 먼저 잡힌 것이 이긴다
DIET_WORDS: list[tuple[str, str]] = [
    (r"생선회|날생선|사시미|(?<![가-힣])회" + _P, "회"),
    (r"해산물|해물|생선", "해산물"),
    (r"갑각류|새우|꽃게|대게|게장|게살|랍스터|킹크랩", "갑각류"),
    (r"돼지\s*고기|돼지|삼겹살?|목살", "돼지고기"),
    (r"소\s*고기|쇠고기|한우", "소고기"),
    (r"닭\s*고기|닭|치킨", "닭고기"),
    (r"양\s*고기|양꼬치", "양고기"),
    (r"매운\s*(?:거|것|걸|건|음식|맛)|매운", "매운맛"),
    (r"(?<![가-힣])고기|육류", "고기"),
]
DIET_NEG = re.compile(r"못\s*먹|안\s*먹|못\s*드|안\s*드|먹지\s*(?:못|않|말)|알레르기|알러지|드시면\s*안|먹으면\s*안")
VEGAN = re.compile(r"비건|vegan|완전\s*채식", re.I)
VEGETARIAN = re.compile(r"채식|베지테리언|vegetarian", re.I)
MEATLESS = re.compile(r"고기[는를]?\s*(?:안|못)\s*먹|육류[는를]?\s*(?:안|못)\s*먹|페스코")
SPICY_WEAK = re.compile(r"맵찔이|매운\s*거?\s*약|매운\s*걸?\s*잘\s*못")

# 업종 (like / avoid) — data/restaurants.csv의 '업종'과 맞춘다
CATEGORY_WORDS: list[tuple[str, str]] = [
    (r"횟집|생선회|(?<![가-힣])회" + _P, "횟집"),
    (r"삼겹살?|목살|갈비|고깃집|고기\s*집|고기|한우|소고기|숯불", "고기구이"),
    (r"중식|중국\s*집|중국\s*요리|중화\s*요리|짜장|탕수육|마라", "중식"),
    (r"이자카야|선술집", "이자카야"),
    (r"일식|초밥|스시|오마카세|돈카츠|라멘", "일식"),
    (r"양식|파스타|피자|이탈리안|스테이크", "양식"),
    (r"샤브\s*샤브|샤브", "샤브샤브"),
    (r"양꼬치", "양꼬치"),
    (r"곱창|막창|대창", "곱창"),
    (r"조개\s*구이|해산물|해물", "해산물"),
    (r"쌀국수|베트남", "베트남"),
    (r"한정식|한식|백반|국밥|닭한마리", "한식"),
]
LIKE = re.compile(r"먹고\s*싶|먹었으면|좋겠|좋아요|좋아|땡기|땡겨|당기|어때|어떨까|가요|가자|로\s*하|으로\s*하")
AVOID = re.compile(r"말고|빼고|싫|별로|지겨|질려|그만|안\s*갔으면|피했으면|제외")

ROOM = re.compile(r"룸|개별실|독립된\s*(?:방|공간)|프라이빗|방이\s*따로|따로\s*된\s*방")
ROOM_OFF = re.compile(r"(?:룸|방)[이은가는]?\s*(?:없어도|아니어도|아니라도|안\s*돼도|필요\s*없|상관\s*없|안\s*해도)")
WALK_NUM = re.compile(r"도보\s*(\d{1,2})\s*분")
WALK_NEAR = re.compile(r"역에서\s*(?:가까|멀지\s*않)|역\s*(?:바로\s*)?앞|역세권|가까우면|가까운\s*(?:곳|데)|가까웠으면")
WALK_WALKABLE = re.compile(r"걸어서|걸어\s*갈|도보로|도보권")
WALK_OFF = re.compile(r"멀어도\s*(?:괜찮|돼|상관)|거리는?\s*상관\s*없")
ONE_TABLE = re.compile(r"한\s*테이블|한\s*자리에|같이\s*앉|모여\s*앉|한\s*상에|떨어져\s*앉|나눠\s*앉")
QUIET = re.compile(r"조용|대화하기\s*좋|시끄럽지\s*않|(?:얘기|이야기)\s*나누기")
PARKING = re.compile(r"주차")
PARKING_OFF = re.compile(r"주차\s*(?:안\s*돼도|필요\s*없|상관\s*없|안\s*해도)")
DRINKS_OFF = re.compile(r"술[은는을]?\s*(?:안|없이|빼|제외|못|마시지)|음주\s*(?:없|안)|주류\s*(?:제외|빼)|논알콜|무알콜|마시는\s*사람\s*없")
DRINKS_ON = re.compile(r"술|한\s*잔|소맥|맥주|와인|2차|하이볼")
DAY = re.compile(r"(월|화|수|목|금|토|일)요일")
DATE = re.compile(r"(\d{1,2})\s*월\s*(\d{1,2})\s*일")
SLOT_LUNCH = re.compile(r"점심|런치")
SLOT_DINNER = re.compile(r"저녁|디너|퇴근\s*후")
HEADCOUNT = re.compile(rf"(?:(\d{{1,3}})\s*(?:명|인(?!\s*당|분|\s*룸|\s*테이블))|({_NUM})\s*명)")
DIET_COUNT_AFTER = re.compile(rf"(?:사람|분|인원|동료|팀원)[이가은는도]?\s*(?:(\d{{1,2}})|({_NUM}))\s*(?:명|분)")
DIET_COUNT_BEFORE = re.compile(rf"(?:(\d{{1,2}})|({_NUM}))\s*(?:명|분)\s*(?:은|는|이|이가|가|정도)?\s*$")
MONEY = re.compile(r"(\d+(?:\.\d+)?)\s*만(?:\s*(\d)\s*천)?\s*원?|(\d{1,3}(?:,\d{3})+|\d{4,7})\s*원")
PER_PERSON = re.compile(r"인당|1인|일인|한\s*사람|각자|머릿수")
TOTAL = re.compile(r"총|전체|다\s*해서|합쳐서|모두\s*합")
MUST_WORD = re.compile(r"(?:꼭|반드시|무조건)[^,.!?]{0,12}(?:있어야|해야|돼야|되어야|여야|이어야|필수)|필수|아니면\s*안")
EMPHASIS = re.compile(r"꼭|반드시|무조건|제일|가장|무엇보다|최우선|중요")
PRIORITY_SHIFT = re.compile(r"없어도|아니어도|아니라도|상관\s*없고|대신|보다는?")
QUESTION = re.compile(r"\?|나요|까요|있나|되나|될까|가능한가|가능해요\?")
NOOP = re.compile(r"다\s*좋아|아무\s*거나|아무데나|상관\s*없어요|다\s*괜찮|저는\s*좋아요|좋습니다|찬성|동의")
SELF = re.compile(r"^(?:저|제가|전|저는|나|난|나는)(?=[\s도는가])|^저도|^나도")


@dataclass
class Hit:
    cond: Condition
    additive: bool = False      # area: "역삼역도 괜찮아요"
    explicit: bool = False      # walk: 분을 직접 말함
    self_report: bool = False   # diet: 본인 이야기


@dataclass
class ParseResult:
    conditions: list[Condition]
    unmatched: list[dict] = field(default_factory=list)


def _clauses(text: str) -> list[str]:
    parts = re.split(r"(?<=[,.!?~])\s*|\n+|ㅠ+|ㅜ+|ㅋ{2,}|ㅎ{2,}", text)
    return [p.strip() for p in parts if p and p.strip()]


def _num(digits: str | None, word: str | None) -> int | None:
    if digits:
        return int(digits)
    if word:
        return NUM_WORDS.get(word)
    return None


def _money(m: re.Match) -> int:
    if m.group(1):
        v = float(m.group(1)) * 10000 + (int(m.group(2)) * 1000 if m.group(2) else 0)
        return int(round(v))
    return int(m.group(3).replace(",", ""))


def _weight(clause: str, local: str, base: int = 2) -> int:
    if EMPHASIS.search(local) or PRIORITY_SHIFT.search(clause):
        return 3
    return base


def _kind(local: str) -> str:
    return "must" if MUST_WORD.search(local) else "prefer"


def _date_weekday(month: int, day: int, today: date | None = None) -> tuple[str, str]:
    today = today or date.today()
    year = today.year
    try:
        d = date(year, month, day)
        if (today - d).days > 60:  # 이미 한참 지난 날짜면 내년
            d = date(year + 1, month, day)
    except ValueError:
        return "", ""
    return DAYS[d.weekday()], f"{month}월 {day}일"


def extract_clause(clause: str, author: str, stations: list[str], today: date | None = None) -> list[Hit]:
    hits: list[Hit] = []
    used: list[tuple[int, int]] = []  # 인원수로 다시 읽으면 안 되는 구간 ("한 명은 회를 못 먹고")

    def C(**kw) -> Condition:
        return Condition(author=author, quote=clause, **kw)

    def local(m: re.Match, before: int = 8, after: int = 16) -> str:
        return clause[max(0, m.start() - before): m.end() + after]

    is_self = bool(SELF.search(clause))

    # 못 먹는 음식 (필수)
    diet_done: set[str] = set()
    # 식단: 비건(동물성 전부) > 채식(고기·해산물) > 고기만 안 먹음 — 서로 다르게 다룬다
    if VEGAN.search(clause):
        hits.append(Hit(C(type="diet", value="비건", kind="must"), self_report=is_self))
        diet_done |= {"비건", "고기"}
    elif VEGETARIAN.search(clause):
        hits.append(Hit(C(type="diet", value="채식", kind="must"), self_report=is_self))
        diet_done |= {"채식", "고기"}
    elif MEATLESS.search(clause):
        hits.append(Hit(C(type="diet", value="고기", kind="must"), self_report=is_self))
        diet_done.add("고기")
    if SPICY_WEAK.search(clause):
        hits.append(Hit(C(type="diet", value="매운맛", kind="must"), self_report=is_self))
        diet_done.add("매운맛")
    for pat, food in DIET_WORDS:
        for m in re.finditer(pat, clause):
            if food in diet_done or not DIET_NEG.search(clause[m.end(): m.end() + 14]):
                continue
            b0 = max(0, m.start() - 12)
            cm = DIET_COUNT_BEFORE.search(clause[b0: m.start()])
            count = _num(cm.group(1), cm.group(2)) if cm else 1
            if cm:
                used.append((b0 + cm.start(), m.start()))
            else:  # "매운 거 못 먹는 사람 두 명"
                am = DIET_COUNT_AFTER.search(clause, m.end(), m.end() + 24)
                if am:
                    cm = am
                    count = _num(am.group(1), am.group(2))
                    used.append((am.start(), am.end()))
            hits.append(Hit(C(type="diet", value=food, kind="must", count=count or 1), self_report=is_self and not cm))
            diet_done.add(food)
            break

    # 업종 희망·기피 (선호) — 못 먹는 음식으로 이미 잡힌 말은 건너뜀
    for pat, cat in CATEGORY_WORDS:
        for m in re.finditer(pat, clause):
            after = clause[m.end(): m.end() + 12]
            if DIET_NEG.search(after):
                continue
            if AVOID.search(after):
                hits.append(Hit(C(type="avoid", value=cat, kind="prefer", weight=_weight(clause, local(m)))))
            elif LIKE.search(after):
                base = 1 if re.search(r"먹고\s*싶|땡기|땡겨|당기", after) else 2  # 한 사람의 메뉴 희망은 가볍게
                hits.append(Hit(C(type="like", value=cat, kind="prefer", weight=_weight(clause, local(m), base))))
            else:
                continue
            break

    # 룸
    m = ROOM.search(clause)
    if m:
        if ROOM_OFF.search(clause):
            hits.append(Hit(C(type="room", value=True, kind="off")))
        else:
            hits.append(Hit(C(type="room", value=True, kind=_kind(local(m)), weight=_weight(clause, local(m)))))

    # 역에서 거리
    if WALK_OFF.search(clause):
        hits.append(Hit(C(type="walk", value=10, kind="off")))
    else:
        m = WALK_NUM.search(clause)
        if m:
            hits.append(Hit(C(type="walk", value=int(m.group(1)), kind=_kind(local(m)), weight=_weight(clause, local(m))), explicit=True))
        else:
            m = WALK_NEAR.search(clause) or WALK_WALKABLE.search(clause)
            if m:
                target = 5 if WALK_NEAR.search(clause) else 10
                hits.append(Hit(C(type="walk", value=target, kind=_kind(local(m)), weight=_weight(clause, local(m)))))

    # 한 테이블
    m = ONE_TABLE.search(clause)
    if m:
        base = 1 if QUESTION.search(clause) else 2
        hits.append(Hit(C(type="one_table", value=True, kind=_kind(local(m)), weight=_weight(clause, local(m), base))))

    m = QUIET.search(clause)
    if m:
        hits.append(Hit(C(type="quiet", value=True, kind=_kind(local(m)), weight=_weight(clause, local(m)))))
    m = PARKING.search(clause)
    if m:
        if PARKING_OFF.search(clause):
            hits.append(Hit(C(type="parking", value=True, kind="off")))
        else:
            hits.append(Hit(C(type="parking", value=True, kind=_kind(local(m)), weight=_weight(clause, local(m)))))

    # 술
    if DRINKS_OFF.search(clause):
        hits.append(Hit(C(type="drinks", value=False, kind="info")))
    elif DRINKS_ON.search(clause):
        hits.append(Hit(C(type="drinks", value=True, kind="info")))

    # 요일·날짜·시간대
    m = DATE.search(clause)
    if m:
        wd, detail = _date_weekday(int(m.group(1)), int(m.group(2)), today)
        if wd:
            hits.append(Hit(C(type="day", value=wd, kind="must", detail=detail)))
    else:
        m = DAY.search(clause)
        if m:
            hits.append(Hit(C(type="day", value=m.group(1), kind="must")))
    if SLOT_LUNCH.search(clause):
        hits.append(Hit(C(type="slot", value="점심", kind="must")))
    elif SLOT_DINNER.search(clause):
        hits.append(Hit(C(type="slot", value="저녁", kind="must")))

    # 지역 (식당 데이터에 있는 역만)
    for st in stations:
        base = st[:-1] if st.endswith("역") else st
        m = re.search(rf"{re.escape(base)}\s*역|{re.escape(base)}(?=\s*(?:근처|쪽|부근|인근|에서|으로|주변))", clause)
        if m:
            additive = bool(re.match(r"\s*(?:역)?\s*(?:근처|쪽)?\s*도", clause[m.end():]))
            hits.append(Hit(C(type="area", value=[st], kind="must"), additive=additive))

    # 인원
    for m in HEADCOUNT.finditer(clause):
        if any(s <= m.start() < e for s, e in used):
            continue
        n = _num(m.group(1), m.group(2))
        if n and 1 < n < 200:
            hits.append(Hit(C(type="headcount", value=n, kind="must")))
            break

    # 예산
    for m in MONEY.finditer(clause):
        amount = _money(m)
        before = clause[max(0, m.start() - 8): m.start()]
        if amount < 5000:
            continue
        is_total = bool(TOTAL.search(before)) and not PER_PERSON.search(before)
        hits.append(Hit(C(type="budget", value=amount, kind="must", detail="총액" if is_total else "")))
        break
    return hits


def _merge(state: dict[str, Condition], hit: Hit, reporters: dict[str, set[str]]) -> None:
    new = hit.cond
    if new.type in ("like", "avoid"):  # 같은 업종의 반대 의견은 지운다
        state.pop(f"{'avoid' if new.type == 'like' else 'like'}:{new.value}", None)
    k = new.key
    old = state.get(k)
    if new.type == "diet":
        rs = reporters.setdefault(k, set())
        if hit.self_report and new.author:
            rs.add(new.author)
        new.count = max(new.count, len(rs), old.count if old and old.active else 0)
    if old is None or not old.active:
        state[k] = new
        return
    if new.kind == "off":
        state[k] = Condition(type=old.type, value=old.value, kind="off", weight=old.weight, count=old.count,
                             detail=old.detail, author=new.author, quote=new.quote)
        return
    merged = Condition(**{**old.to_dict()})
    if new.type == "area":
        merged.value = old.value + [v for v in new.value if v not in old.value] if hit.additive else new.value
    elif new.type == "walk" and not hit.explicit:
        merged.value = min(old.value, new.value)
    else:
        merged.value = new.value
    merged.kind = new.kind
    merged.count = new.count
    merged.detail = new.detail or (old.detail if merged.value == old.value else "")
    if new.kind == "prefer":
        merged.weight = new.weight
    if (merged.value, merged.kind, merged.weight, merged.count) != (old.value, old.kind, old.weight, old.count):
        merged.author, merged.quote = new.author, new.quote
    state[k] = merged


def finalize(state: dict[str, Condition]) -> list[Condition]:
    """인당 예산으로 맞추고, 주류 포함 여부 기본값을 채운다."""
    head = state.get("headcount")
    bud = state.get("budget")
    if bud and bud.detail == "총액" and head and head.active:
        bud.value = int(bud.value / head.value)
        bud.detail = ""
    if "drinks" not in state:
        slot = state.get("slot")
        lunch = bool(slot and slot.active and slot.value == "점심")
        state["drinks"] = Condition(type="drinks", value=not lunch, kind="info", author="자동",
                                    quote="점심 모임이라 주류 빼고 계산" if lunch else "저녁 모임이라 주류 포함해 계산")
    order = {t: i for i, t in enumerate(("area", "day", "slot", "headcount", "budget", "diet", "room", "walk",
                                         "one_table", "like", "avoid", "quiet", "parking", "drinks"))}
    return sorted(state.values(), key=lambda c: (c.kind == "off", order.get(c.type, 99), str(c.value)))


def parse_opinions(opinions: list[dict], stations: list[str], today: date | None = None) -> ParseResult:
    """opinions: [{"author": "민수", "text": "저 회는 못 먹어요"}, ...] (오래된 것부터)"""
    state: dict[str, Condition] = {}
    reporters: dict[str, set[str]] = {}
    unmatched: list[dict] = []
    for op in opinions:
        author, text = op.get("author", ""), op.get("text", "")
        found_any = False
        for clause in _clauses(text):
            hits = extract_clause(clause, author, stations, today)
            for h in hits:
                _merge(state, h, reporters)
            if hits:
                found_any = True
            elif QUESTION.search(clause) and not NOOP.search(clause):
                unmatched.append({"author": author, "text": clause})
        if not found_any and not NOOP.search(text) and not any(u["author"] == author and u["text"] in text for u in unmatched):
            unmatched.append({"author": author, "text": text.strip()})
    return ParseResult(finalize(state), unmatched)
