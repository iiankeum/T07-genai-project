"""AI가 만든 주문 카드를 통화 원문과 대조한다.

생성형 AI는 원문에 없는 차종·차번호·수량·인용문을 만들어 낼 수 있다.
원문(음성 인식 결과 + 낱말 사전 교정)에서 뒷받침되지 않는 값은 지우지 않고
'미확인'으로 표시한 뒤 '다시 물어볼 것'에 넣는다. 확정하려면 담당자가 이를 확인해 지워야 한다.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher

from .models import OrderCard
from .rules import PARTS, PLATE_RE, QTY_RE, VEHICLES, YEAR_RE, _to_int

_STRIP = re.compile(r"[\s.,!?~·…'\"“”‘’()\[\]\-_/:;]+")
_BARE_NUM = re.compile(r"(?<![\d가-힣A-Za-z])(\d{1,3})(?!\d)(?!\s*(?:시|분|초|년|월|일|만|천|원|번|호|km|키로|층))")


def norm(text: str) -> str:
    return _STRIP.sub("", text or "").lower()


def quote_found(quote: str, src: str, min_cover: float = 0.85) -> bool:
    """인용문이 원문에 (거의) 그대로 있는지. src는 norm() 된 원문."""
    q = norm(quote)
    if not q or q in src:
        return True
    blk = SequenceMatcher(None, q, src, autojunk=False).find_longest_match(0, len(q), 0, len(src))
    if blk.size == 0:
        return False
    start = max(0, blk.b - blk.a - 4)
    window = src[start:start + len(q) + 8]
    matched = sum(b.size for b in SequenceMatcher(None, q, window, autojunk=False).get_matching_blocks())
    return matched >= min_cover * len(q)


def mentioned_numbers(text: str) -> set[int]:
    """통화에서 수량으로 말한 숫자들 ('두 개', '3개', '하나', 단위 없이 '2')."""
    masked = PLATE_RE.sub(" ", YEAR_RE.sub(" ", text))
    nums = {n for m in QTY_RE.finditer(masked) if (n := _to_int(m.group(1), m.group(2) or m.group(3))) is not None}
    nums |= {int(m.group(1)) for m in _BARE_NUM.finditer(masked)}
    return nums


def _dict_found(value: str, table: dict[str, list[str]], src: str) -> bool | None:
    """사전에 있는 이름이면 그 별칭 중 하나라도 원문에 있는지. 사전에 없으면 None."""
    v = norm(value)
    for exact in (True, False):  # 정확히 같은 이름을 먼저, 없으면 포함하는 이름
        for std, aliases in table.items():
            names = [std, *aliases]
            if any(norm(a) == v if exact else norm(a) in v for a in names):
                return any(norm(a) in src for a in names)
    return None


def verify_card(card: OrderCard, *texts: str) -> OrderCard:
    src = norm(" ".join(texts))
    raw = " ".join(texts)
    nums = mentioned_numbers(raw)
    asks: list[str] = []

    def flag(field: str, ask: str) -> None:
        if field not in card.unverified:
            card.unverified.append(field)
        asks.append(f"원문 확인: {ask}")

    if card.customer and norm(card.customer) not in src:
        flag("customer", f"거래처 '{card.customer}'가 통화에 없음")
    if card.vehicle_model:
        found = _dict_found(card.vehicle_model, VEHICLES, src)
        if found is False or (found is None and norm(card.vehicle_model.split()[0]) not in src):
            flag("vehicle_model", f"차종 '{card.vehicle_model}'가 통화에 없음")
    if card.vehicle_year:
        digits = re.findall(r"\d+", card.vehicle_year)
        if digits and not any(d.endswith(digits[0][-2:]) for d in re.findall(r"\d+", raw)):
            flag("vehicle_year", f"연식 '{card.vehicle_year}'가 통화에 없음")
    if card.plate and norm(card.plate) not in src:
        flag("plate", f"차번호 '{card.plate}'가 통화에 없음")

    for it in card.items:
        found = _dict_found(it.part, PARTS, src)
        if found is False or (found is None and norm(it.part) not in src):
            it.unverified.append("part")
            asks.append(f"원문 확인: 부품 '{it.part}'가 통화에 없음")
        if it.quantity is not None and it.quantity not in nums:
            it.unverified.append("quantity")
            asks.append(f"원문 확인: {it.part} 수량 {it.quantity}개가 통화에 없음")
        pieces = [p for p in re.split(r"\s*/\s*|…", it.evidence) if p.strip()]
        if pieces and not all(quote_found(p, src) for p in pieces):
            it.unverified.append("evidence")
            asks.append(f"원문 확인: {it.part}의 근거 문장이 통화에 없음")

    for a in asks:
        if a not in card.follow_ups:
            card.follow_ups.append(a)
    return card


def carry_flags(ai_card: OrderCard, new_card: OrderCard) -> OrderCard:
    """담당자가 저장할 때, 값을 바꾸지 않은 미확인 표시는 그대로 남긴다."""
    for f in ai_card.unverified:
        if getattr(new_card, f, None) == getattr(ai_card, f, None) and f not in new_card.unverified:
            new_card.unverified.append(f)
    by_part = {i.part: i for i in ai_card.items if i.unverified}
    for it in new_card.items:
        old = by_part.get(it.part)
        if not old:
            continue
        for f in old.unverified:
            same = {"part": True, "quantity": it.quantity == old.quantity, "evidence": it.evidence == old.evidence}.get(f)
            if same and f not in it.unverified:
                it.unverified.append(f)
    return new_card
