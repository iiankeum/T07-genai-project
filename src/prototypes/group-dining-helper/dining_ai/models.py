"""조건·식당 자료 구조."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

# 조건 종류
TYPES = ("area", "headcount", "budget", "day", "slot", "diet", "room", "walk",
         "one_table", "like", "avoid", "quiet", "parking", "drinks")
MUST_BY_DEFAULT = {"area", "headcount", "budget", "day", "slot", "diet"}
DAYS = ("월", "화", "수", "목", "금", "토", "일")
SLOTS = ("점심", "저녁")

# 못 먹는 음식 → 메뉴 재료 태그 중 걸리는 것
DIET_TAGS: dict[str, set[str]] = {
    "회": {"회"},
    "해산물": {"회", "해산물", "갑각류"},
    "갑각류": {"갑각류"},
    "돼지고기": {"돼지고기"},
    "소고기": {"소고기"},
    "닭고기": {"닭고기"},
    "양고기": {"양고기"},
    "고기": {"돼지고기", "소고기", "닭고기", "양고기"},
    "매운맛": {"매운맛"},
}
DIET_LABEL = {"고기": "고기(채식)", "매운맛": "매운 음식"}

WEIGHT_LABEL = {1: "조금", 2: "보통", 3: "높음"}
KIND_LABEL = {"must": "필수", "prefer": "선호", "info": "계산", "off": "뺌"}


def won(v: int | float | None) -> str:
    """40000 → '4만 원', 42000 → '4.2만 원', 9500 → '9,500원'."""
    if v is None:
        return "-"
    v = int(round(v))
    if v >= 10000 and v % 1000 == 0:
        return f"{v / 10000:g}만 원"
    return f"{v:,}원"


@dataclass
class Condition:
    type: str
    value: Any = None
    kind: str = "prefer"      # must | prefer | info | off
    weight: int = 2           # 선호 조건 중요도 1~3
    count: int = 1            # diet: 해당하는 사람 수
    detail: str = ""          # 표시용 보충 (예: 날짜)
    author: str = ""          # 누가 말했나
    quote: str = ""           # 근거가 된 말

    @property
    def key(self) -> str:
        if self.type in ("diet", "like", "avoid"):
            return f"{self.type}:{self.value}"
        return self.type

    @property
    def active(self) -> bool:
        return self.kind in ("must", "prefer")

    def label(self) -> str:
        t, v = self.type, self.value
        if t == "area":
            return f"{'·'.join(v)} 근처"
        if t == "headcount":
            return f"{v}명"
        if t == "budget":
            return f"인당 {won(v)} 이하"
        if t == "day":
            return f"{self.detail + ' ' if self.detail else ''}{v}요일"
        if t == "slot":
            return str(v)
        if t == "diet":
            return f"{DIET_LABEL.get(v, v)} 못 먹는 분 {self.count}명"
        if t == "room":
            return "룸(독립된 방)"
        if t == "walk":
            return f"역에서 도보 {v}분 이내"
        if t == "one_table":
            return "한 테이블에 다 같이"
        if t == "like":
            return f"{v} 희망"
        if t == "avoid":
            return f"{v} 피하기"
        if t == "quiet":
            return "조용한 곳"
        if t == "parking":
            return "주차 가능"
        if t == "drinks":
            return "주류 포함해 계산" if v else "주류 빼고 계산"
        return f"{t}={v}"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Condition":
        return cls(**{k: d[k] for k in cls.__dataclass_fields__ if k in d})


@dataclass
class Menu:
    name: str
    price: int
    unit: str
    kind: str                 # 메인 / 코스 / 식사 / 사이드 / 주류
    tags: list[str] = field(default_factory=list)

    @property
    def is_main(self) -> bool:
        return self.kind in ("메인", "코스")


@dataclass
class Restaurant:
    id: str
    name: str
    category: str
    station: str
    walk_min: int
    max_group: int
    max_table: int
    rooms: list[int]
    room_note: str
    closed_days: list[str]
    lunch: bool
    dinner: bool
    parking: bool
    moods: list[str]
    basis: str                # 예상 금액의 기준 메뉴
    food_pp: int              # 기준 메뉴 인당 식사비
    drinks_pp: int            # 인당 주류비
    catchtable: str
    price_as_of: str
    note: str
    menus: list[Menu] = field(default_factory=list)

    def per_person(self, drinks: bool) -> int:
        return self.food_pp + (self.drinks_pp if drinks else 0)

    def edible_mains(self, food: str) -> list[Menu]:
        bad = DIET_TAGS.get(food, {food})
        return [m for m in self.menus if m.is_main and not (set(m.tags) & bad)]
