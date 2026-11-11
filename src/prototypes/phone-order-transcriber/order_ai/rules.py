"""규칙 기반 주문 추출 (AI 없이 동작하는 기본값).

API 키가 없어도 데모가 돌도록 만든 간단한 추출기다. 생성형 AI 추출의
비교 기준(베이스라인)으로도 쓴다. 놓치는 것이 많으니 실제 쓰임은 LLM 쪽이다.

check_missing()은 어떤 추출기를 쓰든 마지막에 한 번 더 돌려
"다시 물어봐야 할 것"을 빠짐없이 채운다.
"""
from __future__ import annotations

import re

from .models import OrderCard, OrderItem

VEHICLES: dict[str, list[str]] = {
    "아반떼": ["아반떼", "avante"],
    "쏘나타": ["쏘나타", "sonata"],
    "그랜저": ["그랜저", "grandeur"],
    "싼타페": ["싼타페"],
    "투싼": ["투싼"],
    "코나": ["코나"],
    "팰리세이드": ["팰리세이드"],
    "캐스퍼": ["캐스퍼"],
    "스타렉스": ["스타렉스"],
    "스타리아": ["스타리아"],
    "포터": ["포터2", "포터"],
    "봉고": ["봉고3", "봉고"],
    "모닝": ["모닝"],
    "레이": ["레이"],
    "K3": ["K3", "k3"],
    "K5": ["K5", "k5"],
    "K7": ["K7", "k7"],
    "K8": ["K8", "k8"],
    "스포티지": ["스포티지"],
    "쏘렌토": ["쏘렌토"],
    "카니발": ["카니발"],
    "셀토스": ["셀토스"],
    "니로": ["니로"],
    "스파크": ["스파크"],
    "트랙스": ["트랙스"],
    "말리부": ["말리부"],
    "QM6": ["QM6", "qm6"],
    "SM6": ["SM6", "sm6"],
    "티볼리": ["티볼리"],
    "렉스턴": ["렉스턴"],
    "제네시스": ["제네시스", "G80", "G90", "GV80", "GV70"],
}

PARTS: dict[str, list[str]] = {
    "앞범퍼": ["앞범퍼", "앞 범퍼", "프론트 범퍼", "프론트범퍼"],
    "뒷범퍼": ["뒷범퍼", "뒤 범퍼", "뒤범퍼"],
    "범퍼": ["범퍼"],
    "펜더": ["펜더"],
    "후드": ["후드"],
    "도어": ["도어", "문짝"],
    "라디에이터 그릴": ["라디에이터 그릴", "그릴"],
    "헤드램프": ["헤드램프", "헤드라이트", "전조등"],
    "테일램프": ["테일램프", "후미등"],
    "안개등": ["안개등", "포그램프"],
    "사이드미러": ["사이드미러", "사이드 미러", "백미러"],
    "브레이크 패드": ["브레이크 패드", "브레이크패드", "패드"],
    "브레이크 디스크": ["브레이크 디스크", "디스크", "로터"],
    "쇼크업소버": ["쇼크업소버", "쇼크 업소버"],
    "엔진오일": ["엔진오일", "엔진 오일"],
    "오일필터": ["오일필터", "오일 필터"],
    "에어필터": ["에어필터", "에어 필터"],
    "에어컨필터": ["에어컨필터", "에어컨 필터", "항균필터"],
    "라디에이터": ["라디에이터"],
    "배터리": ["배터리"],
    "와이퍼": ["와이퍼"],
    "미션마운트": ["미션마운트", "미션 마운트", "미션 쪽 미미", "미션쪽 미미", "미션 미미"],
    "엔진마운트": ["엔진마운트", "엔진 마운트", "미미"],
    "점화플러그": ["점화플러그", "점화 플러그", "스파크 플러그", "플러그"],
    "점화코일": ["점화코일", "점화 코일", "이그니션 코일"],
    "타이밍벨트": ["타이밍벨트", "타이밍 벨트"],
    "겉벨트": ["겉벨트", "팬벨트", "구동벨트"],
    "발전기": ["발전기", "알터네이터"],
    "스타터모터": ["스타터모터", "스타터"],
    "머플러": ["머플러"],
    "로어암": ["로어암", "로워암", "하박"],
    "타이로드엔드": ["타이로드엔드", "타이로드 엔드", "타이로드"],
    "등속조인트": ["등속조인트", "등속 조인트"],
    "워터펌프": ["워터펌프", "워터 펌프", "물펌프"],
    "냉각수": ["냉각수", "부동액"],
    "미션오일": ["미션오일", "미션 오일"],
}

# 좌/우를 물어봐야 하는 부품, 앞/뒤를 물어봐야 하는 부품
NEEDS_SIDE = {"펜더", "도어", "헤드램프", "테일램프", "사이드미러", "안개등", "로어암", "타이로드엔드", "등속조인트"}
NEEDS_FRONT_REAR = {"브레이크 패드", "브레이크 디스크", "쇼크업소버", "도어", "범퍼"}

POSITION_WORDS = [
    ("운전석", "운전석"), ("조수석", "조수석"), ("왼쪽", "좌"), ("오른쪽", "우"),
    ("좌측", "좌"), ("우측", "우"), ("양쪽", "양쪽"), ("좌우", "양쪽"),
    ("앞쪽", "앞"), ("뒤쪽", "뒤"), ("앞바퀴", "앞"), ("뒷바퀴", "뒤"),
    ("프론트", "앞"), ("리어", "뒤"), ("앞", "앞"), ("뒤", "뒤"), ("좌", "좌"), ("우", "우"),
]

NUM_WORDS = {
    "한": 1, "하나": 1, "두": 2, "둘": 2, "세": 3, "셋": 3, "석": 3, "네": 4, "넷": 4, "넉": 4,
    "다섯": 5, "여섯": 6, "일곱": 7, "여덟": 8, "아홉": 9, "열": 10,
}
UNITS = r"(?:개|짝|세트|셋트|대|통|장|쌍|박스|병|리터|EA|ea)"
_NUM_WORD_RE = "|".join(sorted(NUM_WORDS, key=len, reverse=True))
# "두 개", "2개", "2짝" / 단위 없이 단독으로 쓰는 "하나", "두 개요"
QTY_RE = re.compile(
    rf"(?<![0-9가-힣])(?:(\d{{1,3}})\s*{UNITS}|({_NUM_WORD_RE})\s*{UNITS}|(하나|둘|셋|넷)(?=$|[\s,.?!요만씩도]|하고|랑))"
)
QTY_ANSWER_RE = re.compile(rf"^\s*(?:(\d{{1,3}})|({_NUM_WORD_RE}))\s*{UNITS}?\s*(?:요|이요|만|씩)?\s*[.?!]*\s*$")
PLATE_RE = re.compile(r"\d{2,3}\s?[가-힣]\s?\d{4}")
YEAR_RE = re.compile(r"(?<!\d)(\d{2}|20\d{2})\s*년\s*(?:식|형|도)")
CUSTOMER_RE = re.compile(r"([가-힣A-Za-z0-9]{1,10}\s?(?:공업사|정비소|카센터|카센타|모터스|오토|자동차정비|정비))")
SPEAKER_RE = re.compile(r"^\s*\[?([^\]:：]{1,8})\]?\s*[:：]\s*")
CORRECTION_RE = re.compile(r"아니|말고|정정|바꿔|변경|취소|아 참|아참")
URGENT_RE = re.compile(r"급해|급한|급하|빨리|바로|당장|지금 바로|퀵으로|오늘 중|오전 중|오전중|점심 전|최대한")
DUE_RE = re.compile(r"(오늘|내일|모레)\s*(오전|오후|점심|저녁|중|까지|안에)?(?:\s*중)?|(?:이따\s*)?(\d{1,2})\s*시\s*(?:까지|전|에)?|점심\s*전|오전\s*중")
DELIVERY_WORDS = [("퀵", "퀵"), ("화물", "화물"), ("택배", "택배"), ("가지러", "직접 수령"), ("찾으러", "직접 수령"), ("들를게", "직접 수령"), ("배달", "배달"), ("갖다", "배달"), ("보내", "배달")]
SELF_INTRO_RE = re.compile(r"(?:여기|저|저희)\s*(?:는|요)?\s*([가-힣A-Za-z0-9]{2,10})\s*(?:인데요|에요|예요|입니다)")


def _strip_speaker(line: str) -> tuple[str, str]:
    m = SPEAKER_RE.match(line)
    if m:
        return m.group(1).strip(), line[m.end():].strip()
    return "", line.strip()


def _utterances(text: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for raw in text.splitlines():
        if not raw.strip():
            continue
        speaker, body = _strip_speaker(raw)
        # 한 줄 안의 여러 문장도 나눈다 (받아쓰기 결과는 한 줄로 길게 나올 때가 많다)
        for sent in re.split(r"(?<=[.?!])\s+", body):
            if sent.strip():
                out.append((speaker, sent.strip()))
    return out


def _to_int(digits: str | None, word: str | None) -> int | None:
    if digits:
        return int(digits)
    if word:
        return NUM_WORDS.get(word)
    return None


def _find_qty(text: str) -> int | None:
    masked = PLATE_RE.sub(" ", YEAR_RE.sub(" ", text))
    found = None
    for m in QTY_RE.finditer(masked):
        found = _to_int(m.group(1), m.group(2) or m.group(3))  # 마지막 값이 정정된 값
    return found


def _find_parts(text: str) -> list[tuple[int, int, str]]:
    """(시작, 끝, 표준이름) — 긴 별칭부터 잡고 겹치는 짧은 별칭은 버린다."""
    aliases = sorted(((a, std) for std, al in PARTS.items() for a in al), key=lambda x: len(x[0]), reverse=True)
    taken: list[tuple[int, int, str]] = []
    for alias, std in aliases:
        for m in re.finditer(re.escape(alias), text):
            s, e = m.start(), m.end()
            if any(s < te and e > ts for ts, te, _ in taken):
                continue
            taken.append((s, e, std))
    return sorted(taken)


def _find_vehicles(text: str) -> list[tuple[int, str]]:
    """(위치, 표준 차종). '브레이크' 안의 '레이'처럼 낱말 중간에 걸린 것은 뺀다."""
    hits: list[tuple[int, str]] = []
    for std, aliases in VEHICLES.items():
        for a in aliases:
            m = re.search(rf"(?<![가-힣A-Za-z]){re.escape(a)}", text)
            if m:
                hits.append((m.start(), std))
                break
    return sorted(hits)


def _positions_in(window: str) -> list[str]:
    found: list[str] = []
    for word, label in POSITION_WORDS:
        if len(word) == 1:  # 한 글자(앞·뒤·좌·우)는 따로 떨어진 낱말일 때만
            if not re.search(rf"(?<![가-힣]){word}(?=$|[\s에쪽거것꺼]|바퀴)", window):
                continue
        elif word not in window:
            continue
        if label not in found:
            found.append(label)
        window = window.replace(word, " ")
    return found


def _position(before: str, part_text: str, after: str) -> str:
    """부품 앞뒤에서 위치 낱말을 찾는다. '펜더 조수석 거' / '조수석 펜더' 둘 다."""
    if part_text.startswith(("앞", "뒷", "뒤", "프론트")):
        return ""  # 부품 이름에 이미 들어 있음 (앞범퍼)
    # 뒤쪽: 수량이 나오기 전까지만 본다
    m = QTY_RE.search(after)
    found = _positions_in(after[: m.start() if m else 10][:10])
    if not found:
        # 앞쪽: 바로 앞 수량 표현 이후만 본다 (앞 부품의 위치를 빌려오지 않도록)
        last = None
        for last in QTY_RE.finditer(before):
            pass
        found = _positions_in((before[last.end():] if last else before)[-8:])
    return " ".join(found)


def _snippet(u: str, start: int, end: int, limit: int = 60) -> str:
    """근거 발화. 한 줄로 길게 받아쓴 경우엔 부품 주변만 자른다."""
    if len(u) <= limit:
        return u
    s, e = max(0, start - 15), min(len(u), end + 3)
    return ("…" if s > 0 else "") + u[s:e].strip() + ("…" if e < len(u) else "")


def rule_extract(text: str) -> OrderCard:
    card = OrderCard()
    utts = _utterances(text)
    full = " ".join(u for _, u in utts)
    vehicles_seen: list[str] = []
    years: dict[str, str] = {}  # 차종 → 연식 (한 통화에 차가 여럿일 때 섞이지 않게)
    last_item: OrderItem | None = None
    asked_qty = False  # 대리점 쪽이 "몇 개요?" 하고 물었는지

    for _speaker, u in utts:
        if not card.customer:
            m = CUSTOMER_RE.search(u) or SELF_INTRO_RE.search(u)
            if m:
                card.customer = m.group(1).strip()
        found_v = _find_vehicles(u)
        for _, v in found_v:
            if v not in vehicles_seen:
                vehicles_seen.append(v)
        for m in YEAR_RE.finditer(u):
            y = m.group(1)
            y = f"{y}년식" if len(y) == 2 else f"{y[2:]}년식"
            before = [v for pos, v in found_v if pos < m.start()]
            owner = before[-1] if before else (vehicles_seen[-1] if vehicles_seen else "")
            years.setdefault(owner, y)
        if not card.plate:
            m = PLATE_RE.search(u)
            if m:
                card.plate = m.group(0).replace(" ", "")

        parts = _find_parts(u)
        if parts:
            for idx, (s, e, std) in enumerate(parts):
                seg_end = parts[idx + 1][0] if idx + 1 < len(parts) else len(u)
                qty = _find_qty(u[e:seg_end])
                item = OrderItem(part=std, quantity=qty, position=_position(u[:s], u[s:e], u[e:seg_end]),
                                 evidence=_snippet(u, s, seg_end))
                # 같은 부품을 다시 말한 경우(복창·정정)는 합친다
                same = next((i for i in card.items if i.part == item.part
                             and (i.position == item.position or not i.position or not item.position)), None)
                if same:
                    if qty is not None:
                        same.quantity = qty
                    same.position = same.position or item.position
                    snip = _snippet(u, s, seg_end)
                    if snip not in same.evidence:
                        same.evidence = f"{same.evidence} / {snip}"
                    last_item = same
                else:
                    card.items.append(item)
                    last_item = item
            asked_qty = False
            continue

        if last_item is not None:
            qty = _find_qty(u)
            ans = QTY_ANSWER_RE.match(u)
            if ans and asked_qty:
                qty = _to_int(ans.group(1), ans.group(2))
            if qty is not None and (CORRECTION_RE.search(u) or last_item.quantity is None or asked_qty):
                last_item.quantity = qty
                last_item.evidence = f"{last_item.evidence} / {u}"
        asked_qty = bool(re.search(r"몇\s*개|몇\s*짝|수량", u))

    if vehicles_seen:
        card.vehicle_model = vehicles_seen[0]
        card.vehicle_year = years.get(vehicles_seen[0]) or years.get("", "")
        if len(vehicles_seen) > 1:
            names = ", ".join(f"{v}{(' ' + years[v]) if v in years else ''}" for v in vehicles_seen)
            card.memo = f"통화 중 여러 차종이 나옴: {names} — 차량별로 카드를 나눠야 하는지 확인"
    else:
        card.vehicle_year = years.get("", "")

    card.urgent = bool(URGENT_RE.search(full))
    m = DUE_RE.search(full)
    if m:
        card.due = re.sub(r"\s+", " ", m.group(0)).strip()
    for word, label in DELIVERY_WORDS:
        if word in full:
            card.delivery = label
            break
    return card


def check_missing(card: OrderCard) -> OrderCard:
    """빠진 정보를 '다시 물어봐야 할 것'에 넣는다. 이미 비슷한 질문이 있으면 넣지 않는다."""
    asks: list[str] = []
    if not card.customer:
        asks.append("거래처(정비소) 이름 확인")
    if not card.vehicle_model:
        asks.append("차종 확인")
    elif not card.vehicle_year and not card.plate:
        asks.append(f"{card.vehicle_model} 연식 또는 차번호 확인 (연식에 따라 품번이 다름)")
    if not card.items:
        asks.append("주문 부품 확인")
    for it in card.items:
        if it.quantity is None:
            asks.append(f"{it.part} 수량 확인")
        if it.part in NEEDS_SIDE and not any(p in it.position for p in ("좌", "우", "운전석", "조수석", "양쪽")):
            asks.append(f"{it.part} 좌/우(운전석/조수석) 확인")
        if it.part in NEEDS_FRONT_REAR and not any(p in it.position for p in ("앞", "뒤")):
            asks.append(f"{it.part} 앞/뒤 확인")

    def _key(s: str) -> str:
        return re.sub(r"\s|확인|\(.*?\)", "", s)

    existing = {_key(f) for f in card.follow_ups}
    for a in asks:
        if _key(a) not in existing and not any(_key(a) in e or e in _key(a) for e in existing if e):
            card.follow_ups.append(a)
            existing.add(_key(a))
    return card
