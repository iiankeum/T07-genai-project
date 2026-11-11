"""하루 마감 요약: 오늘 주문 n건 · 아직 처리 안 된 것 · 다시 전화해야 할 곳."""
from __future__ import annotations

from collections import Counter, OrderedDict
from dataclasses import dataclass

from .models import STATUS_LABELS
from .store import CardRecord


@dataclass
class DaySummary:
    date: str
    total: int
    by_status: dict[str, int]
    pending: list[CardRecord]            # 아직 확정 안 됨
    urgent_pending: list[CardRecord]     # 급한데 아직 출고 안 됨
    callbacks: "OrderedDict[str, list[str]]"  # 거래처 → 물어볼 것
    part_totals: list[tuple[str, int]]   # 부품별 합계 (확정·출고 기준)

    def to_text(self) -> str:
        lines = [f"[{self.date} 전화 주문 마감]", f"- 주문 {self.total}건 · " + " · ".join(
            f"{STATUS_LABELS.get(k, k)} {v}" for k, v in self.by_status.items() if v)]
        if self.urgent_pending:
            lines.append("")
            lines.append(f"■ 급한데 아직 출고 안 됨 ({len(self.urgent_pending)})")
            for r in self.urgent_pending:
                lines.append(f"  · #{r.id} {r.call_time} {_who(r)} — {_items(r)} {('(' + r.card.due + ')') if r.card.due else ''}".rstrip())
        if self.pending:
            lines.append("")
            lines.append(f"■ 아직 확정 안 됨 ({len(self.pending)})")
            for r in self.pending:
                lines.append(f"  · #{r.id} {r.call_time} {_who(r)} — {_items(r)}")
        if self.callbacks:
            lines.append("")
            lines.append(f"■ 다시 전화할 곳 ({len(self.callbacks)})")
            for who, asks in self.callbacks.items():
                lines.append(f"  · {who}: " + " / ".join(asks))
        if self.part_totals:
            lines.append("")
            lines.append("■ 확정 부품 합계")
            lines.append("  " + ", ".join(f"{p} {q}" for p, q in self.part_totals))
        return "\n".join(lines)


def _who(r: CardRecord) -> str:
    c = r.card
    car = " ".join(x for x in (c.vehicle_model, c.vehicle_year) if x)
    return f"{c.customer or '거래처 미상'}{(' / ' + car) if car else ''}"


def _items(r: CardRecord) -> str:
    if not r.card.items:
        return "부품 미상"
    return ", ".join(
        f"{(i.position + ' ') if i.position else ''}{i.part} {i.quantity if i.quantity is not None else '?'}개"
        for i in r.card.items
    )


def summarize(date: str, records: list[CardRecord]) -> DaySummary:
    live = [r for r in records if r.status != "canceled"]
    by_status = Counter(r.status for r in records)
    live = sorted(live, key=lambda x: (x.call_time, x.id))
    pending = [r for r in live if r.status == "draft"]
    urgent_pending = [r for r in live if r.card.urgent and r.status in ("draft", "confirmed")]
    callbacks: "OrderedDict[str, list[str]]" = OrderedDict()
    for r in sorted(pending, key=lambda x: x.call_time):
        if r.card.follow_ups:
            key = f"{r.card.customer or '거래처 미상'} (#{r.id} {r.call_time})"
            callbacks[key] = list(r.card.follow_ups)
    totals: Counter[str] = Counter()
    for r in live:
        if r.status in ("confirmed", "shipped"):
            for i in r.card.items:
                totals[i.part] += i.quantity or 0
    return DaySummary(
        date=date,
        total=len(live),
        by_status={k: by_status.get(k, 0) for k in STATUS_LABELS},
        pending=pending,
        urgent_pending=urgent_pending,
        callbacks=callbacks,
        part_totals=totals.most_common(),
    )
