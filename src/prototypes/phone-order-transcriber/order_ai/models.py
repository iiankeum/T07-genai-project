"""주문 카드 자료 구조."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

STATUS_LABELS = {
    "draft": "확인 필요",
    "confirmed": "확정",
    "shipped": "출고 완료",
    "canceled": "취소",
}


@dataclass
class OrderItem:
    part: str                       # 부품명 (표준 이름)
    quantity: int | None = None     # 말하지 않았으면 None
    position: str = ""              # 앞/뒤/좌/우/운전석/조수석 등
    part_number: str = ""           # 품번 — 사람이 채운다 (AI는 비워 둔다)
    evidence: str = ""              # 근거가 된 발화 (분쟁 시 확인용)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "OrderItem":
        qty = d.get("quantity")
        try:
            qty = int(qty) if qty not in (None, "") else None
        except (TypeError, ValueError):
            qty = None
        return cls(
            part=str(d.get("part") or "").strip(),
            quantity=qty,
            position=str(d.get("position") or "").strip(),
            part_number=str(d.get("part_number") or "").strip(),
            evidence=str(d.get("evidence") or "").strip(),
        )


@dataclass
class OrderCard:
    customer: str = ""              # 거래처 (정비소·공업사)
    vehicle_model: str = ""         # 차종
    vehicle_year: str = ""          # 연식
    plate: str = ""                 # 차번호
    items: list[OrderItem] = field(default_factory=list)
    urgent: bool = False
    due: str = ""                   # 언제까지 (예: 오늘 오후)
    delivery: str = ""              # 퀵 / 배달 / 직접 수령
    follow_ups: list[str] = field(default_factory=list)  # 다시 물어봐야 할 것
    memo: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "OrderCard":
        items = [OrderItem.from_dict(i) for i in (d.get("items") or []) if isinstance(i, dict)]
        items = [i for i in items if i.part]
        follow = d.get("follow_ups") or []
        if isinstance(follow, str):
            follow = [follow]
        urgent = d.get("urgent")
        if isinstance(urgent, str):
            urgent = urgent.strip().lower() in ("true", "1", "yes", "y", "급함", "on")
        return cls(
            customer=str(d.get("customer") or "").strip(),
            vehicle_model=str(d.get("vehicle_model") or "").strip(),
            vehicle_year=str(d.get("vehicle_year") or "").strip(),
            plate=str(d.get("plate") or "").strip(),
            items=items,
            urgent=bool(urgent),
            due=str(d.get("due") or "").strip(),
            delivery=str(d.get("delivery") or "").strip(),
            follow_ups=[str(f).strip() for f in follow if str(f).strip()],
            memo=str(d.get("memo") or "").strip(),
        )
