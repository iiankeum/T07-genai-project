"""단어장에서 받아쓰기 엔진에 넘길 힌트를 고른다.

알아 둘 것(faster-whisper 1.2 기준, 코드에서 확인):
- 엔진은 30초씩 끊어 듣는다. 힌트 자리는 223 토큰이다(문맥 창 448 의 절반 - 1). 넘치면 잘린다.
- 한국어는 거의 한 글자가 한 토큰이라 낱말 40개 안팎만 들어간다.
- initial_prompt 는 condition_on_previous_text=False 일 때 「첫 30초」에만 쓰인다.
- hotwords 는 30초마다 다시 넣는다. 그래서 단어장은 hotwords 로 넘긴다.

그래서 고르는 순서가 중요하다: 항상 넣기 → (두 번 듣기면) 1차 받아쓰기에 비슷한 소리가 나온 낱말 → 많이 쓰인 낱말 → 단어장 순서.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Iterable

from .glossary import Glossary, Entry

HOTWORD_TOKEN_LIMIT = 223          # faster-whisper get_prompt: hotwords[: max_length // 2 - 1]
DEFAULT_BUDGET = 215               # 몇 토큰 여유를 둔다
CONTEXT_TOKEN_LIMIT = 60           # 「이 녹음은 …」 설명이 낱말 자리를 다 먹지 않게

TokenCounter = Callable[[str], int]


def approx_tokens(text: str) -> int:
    """토크나이저가 없을 때의 어림값. 한글 1글자 ≈ 1토큰, 영문 4글자 ≈ 1토큰."""
    n = 0.0
    for ch in text:
        if "가" <= ch <= "힣":
            n += 1.05
        elif ch.isascii() and ch.isalnum():
            n += 0.3
        elif not ch.isspace():
            n += 0.6
    return int(n) + 1


def tokenizer_counter(hf_tokenizer) -> TokenCounter:
    return lambda s: len(hf_tokenizer.encode(" " + s.strip()).ids)


@dataclass
class HintPlan:
    hotwords: str = ""
    context: str = ""
    included: list[str] = field(default_factory=list)
    excluded: list[str] = field(default_factory=list)
    tokens: int = 0
    budget: int = DEFAULT_BUDGET
    exact_tokens: bool = False

    def to_dict(self) -> dict:
        return {
            "hotwords": self.hotwords, "context": self.context, "included": self.included,
            "excluded": self.excluded, "tokens": self.tokens, "budget": self.budget,
            "exactTokens": self.exact_tokens,
        }


def _compose(context: str, terms: list[str]) -> str:
    body = ", ".join(terms)
    if context and body:
        return f"{context} {body}."
    return context or (body + "." if body else "")


def priority_order(entries: Iterable[Entry], boost: Iterable[str] = ()) -> list[Entry]:
    entries = list(entries)
    boost_rank = {t.lower(): i for i, t in enumerate(boost)}
    index = {id(e): i for i, e in enumerate(entries)}

    def key(e: Entry):
        b = boost_rank.get(e.term.lower())
        return (0 if e.pinned else 1, 0 if b is not None else 1, b if b is not None else 0, -e.hits, index[id(e)])

    return sorted(entries, key=key)


def plan_hints(glossary: Glossary | None, context: str = "", count: TokenCounter | None = None,
               budget: int = DEFAULT_BUDGET, boost: Iterable[str] = ()) -> HintPlan:
    """예산 안에 들어가는 낱말을 우선순위대로 고른다."""
    exact = count is not None
    count = count or approx_tokens
    context = (context or "").strip()
    while context and count(context) > CONTEXT_TOKEN_LIMIT:
        context = context[: max(1, int(len(context) * 0.85))].rstrip()
    plan = HintPlan(context=context, budget=budget, exact_tokens=exact)
    if glossary is None:
        plan.hotwords = context
        plan.tokens = count(context) if context else 0
        return plan

    chosen: list[str] = []
    excluded: list[str] = []
    used = count(context) if context else 0
    for e in priority_order(glossary.entries, boost):
        trial = _compose(context, chosen + [e.term])
        n = count(trial)
        if n <= budget:
            chosen.append(e.term)
            used = n
        else:
            excluded.append(e.term)
    plan.included, plan.excluded = chosen, excluded
    plan.hotwords = _compose(context, chosen)
    plan.tokens = used
    return plan
