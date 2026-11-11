"""통화 글 → 주문 카드."""
from __future__ import annotations

from dataclasses import dataclass, field

from .config import Settings
from .glossary import Glossary
from .llm import chat, parse_json
from .models import OrderCard
from .rules import check_missing, rule_extract
from .verify import verify_card

SYSTEM_PROMPT = """너는 자동차 부품 대리점의 전화 주문 접수 보조다.
정비소(공업사)와 대리점 담당자의 통화 받아쓰기를 읽고 주문 카드 초안을 만든다.

규칙:
1. 통화에서 실제로 나온 내용만 적는다. 추측해서 채우지 않는다.
2. 품번(part_number)은 절대 만들지 않는다. 항상 빈 문자열로 둔다. 품번은 담당자가 정한다.
3. 수량을 말하지 않았으면 quantity는 null로 두고 follow_ups에 "○○ 수량 확인"을 넣는다.
4. 통화 중에 말을 바꾸면("아 아니다 두 개", "세 개 말고 두 개") 마지막에 말한 값을 쓰고, 그 정정 발화를 evidence에 넣는다.
5. 좌/우, 앞/뒤, 연식처럼 품번을 정하는 데 필요한데 빠진 정보는 follow_ups에 짧은 질문으로 넣는다.
6. 받아쓰기는 음질이 나쁘고, 두 사람 말이 한 줄로 섞여 있을 수 있다. 문맥으로 누가 한 말인지 판단한다.
7. 현장 말(휀다, 쇼바, 미미 등)은 표준 부품명으로 바꿔 part에 적는다.
8. evidence에는 근거가 된 발화를 받아쓰기에서 그대로 옮긴다 (나중에 "두 개라고 했다" 다툼을 확인하는 용도).
9. 차종이 둘 이상 나오면 첫 차를 vehicle_model에 쓰고, memo에 "차량별 카드 분리 확인"이라고 남긴다.

JSON 하나만 출력한다. 형식:
{
  "corrected_transcript": "받아쓰기 오류를 고친 통화 글 (화자를 알 수 있으면 '정비소:', '대리점:'으로 줄 나눔)",
  "customer": "거래처 이름 또는 빈 문자열",
  "vehicle_model": "차종", "vehicle_year": "연식 (예: 19년식)", "plate": "차번호",
  "items": [{"part": "부품명", "quantity": 1, "position": "앞/뒤/좌/우/운전석/조수석", "part_number": "", "evidence": "근거 발화"}],
  "urgent": true, "due": "언제까지 (예: 오늘 오후)", "delivery": "퀵/배달/직접 수령/빈 문자열",
  "follow_ups": ["다시 물어볼 것"], "memo": "기타 메모"
}"""


@dataclass
class ExtractResult:
    card: OrderCard
    transcript: str            # 원문 + 낱말 사전 교정 (코드가 고친 글, 대조 기준)
    extractor: str             # rule | anthropic | openai | ollama
    warnings: list[str] = field(default_factory=list)
    ai_transcript: str = ""    # AI가 다듬은 통화 글 (참고용, 원문과 다를 수 있음)


def extract(raw_text: str, settings: Settings, glossary: Glossary) -> ExtractResult:
    corrected, changes = glossary.correct(raw_text)
    warnings: list[str] = []
    if changes:
        warnings.append("낱말 사전 교정: " + ", ".join(f"{c.wrong}→{c.right}({c.count})" for c in changes))

    provider = settings.llm_provider
    if provider != "rule":
        user = (
            "참고 낱말 사전 (받아쓰기에서 자주 틀리는 말 → 맞는 말):\n"
            f"{glossary.as_prompt_table()}\n\n"
            "통화 받아쓰기:\n<<<\n"
            f"{corrected}\n>>>"
        )
        try:
            data = parse_json(chat(SYSTEM_PROMPT, user, settings))
            card = OrderCard.from_dict(data)
            for it in card.items:  # 규칙 2를 코드로도 강제
                it.part_number = ""
                it.unverified = []
            card.unverified = []
            card = verify_card(card, corrected, raw_text)  # 원문에 없는 값은 미확인 표시
            if card.flag_count:
                warnings.append(f"원문에서 확인되지 않은 값 {card.flag_count}개를 ⚠로 표시했습니다")
            return ExtractResult(check_missing(card), corrected, provider, warnings,
                                 ai_transcript=str(data.get("corrected_transcript") or ""))
        except Exception as e:  # 시간 초과·응답 형식 오류 등 무엇이든 규칙 기반으로 대체
            warnings.append(f"AI 추출 실패로 규칙 기반 추출을 썼습니다 ({type(e).__name__}: {e})")

    card = check_missing(rule_extract(corrected))
    return ExtractResult(card, corrected, "rule", warnings)
