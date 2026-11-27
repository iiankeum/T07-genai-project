"""한글을 자모로 풀어 「소리가 얼마나 비슷한가」를 잰다.

받아쓰기 엔진은 모르는 낱말을 비슷한 소리의 다른 글자로 적는다(예: 라디에이터 → 라지에다).
글자 단위로 비교하면 「라」와 「나」는 그냥 다른 글자지만, 자모로 풀면 첫소리 하나만 다르다.
그래서 자모 단위 편집 거리로 「단어장의 낱말을 잘못 적은 것 같은 곳」을 찾는다.
"""
from __future__ import annotations

import re
import unicodedata

_CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
_JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
_JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ",
         "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]

# 받아쓰기에서 자주 서로 바뀌는 소리 묶음. 같은 묶음끼리 바뀌면 절반만 다르다고 본다.
_SIMILAR_GROUPS = [
    "ㄱㄲㅋ", "ㄷㄸㅌ", "ㅂㅃㅍ", "ㅅㅆ", "ㅈㅉㅊ", "ㄴㄹ", "ㅇㅎ",
    "ㅐㅔ", "ㅒㅖ", "ㅙㅞㅚ", "ㅓㅗ", "ㅕㅛ", "ㅜㅡ", "ㅢㅣ", "ㅘㅏ", "ㅝㅓ",
]
_GROUP_OF: dict[str, int] = {}
for _i, _g in enumerate(_SIMILAR_GROUPS):
    for _ch in _g:
        _GROUP_OF[_ch] = _i

_PUNCT_RE = re.compile(r"[\s\.,!?;:·…\"'“”‘’()\[\]{}<>~\-_/\\]+")


def is_hangul_syllable(ch: str) -> bool:
    return "가" <= ch <= "힣"


def to_symbols(text: str) -> list[str]:
    """글자를 비교용 기호 목록으로 푼다. 받침은 첫소리와 구별되게 「_」를 붙인다."""
    out: list[str] = []
    for ch in text:
        if is_hangul_syllable(ch):
            idx = ord(ch) - 0xAC00
            out.append(_CHO[idx // 588])
            out.append(_JUNG[(idx % 588) // 28])
            jong = _JONG[idx % 28]
            if jong:
                out.append("_" + jong)
        elif ch.isspace():
            continue
        else:
            out.append(unicodedata.normalize("NFKC", ch).lower())
    return out


def _sub_cost(a: str, b: str) -> float:
    if a == b:
        return 0.0
    a0, b0 = a.lstrip("_"), b.lstrip("_")
    if (a.startswith("_")) == (b.startswith("_")):
        ga, gb = _GROUP_OF.get(a0), _GROUP_OF.get(b0)
        if ga is not None and ga == gb:
            return 0.5
    return 1.0


def _indel_cost(a: str) -> float:
    # 받침은 빠지거나 덧붙기 쉬워서(예: 밧데리/배터리) 조금 싸게 친다.
    return 0.7 if a.startswith("_") else 1.0


def distance(a: str | list[str], b: str | list[str]) -> float:
    """두 글의 자모 편집 거리(가중치 있음)."""
    sa = to_symbols(a) if isinstance(a, str) else a
    sb = to_symbols(b) if isinstance(b, str) else b
    if not sa:
        return float(sum(_indel_cost(x) for x in sb))
    if not sb:
        return float(sum(_indel_cost(x) for x in sa))
    prev = [0.0]
    for x in sb:
        prev.append(prev[-1] + _indel_cost(x))
    for x in sa:
        cur = [prev[0] + _indel_cost(x)]
        for j, y in enumerate(sb, 1):
            cur.append(min(prev[j] + _indel_cost(x), cur[j - 1] + _indel_cost(y), prev[j - 1] + _sub_cost(x, y)))
        prev = cur
    return prev[-1]


def similarity_distance(a: str | list[str], b: str | list[str]) -> float:
    """0(같음) ~ 1(전혀 다름). 긴 쪽 길이로 나눈다."""
    sa = to_symbols(a) if isinstance(a, str) else a
    sb = to_symbols(b) if isinstance(b, str) else b
    n = max(len(sa), len(sb))
    return 0.0 if n == 0 else distance(sa, sb) / n


def bigrams(symbols: list[str]) -> set[tuple[str, str]]:
    return {(symbols[i], symbols[i + 1]) for i in range(len(symbols) - 1)}


def squash(text: str) -> str:
    """띄어쓰기 · 문장부호를 빼고 소문자로. 「라지 에다」와 「라지에다」를 같게 본다."""
    return _PUNCT_RE.sub("", unicodedata.normalize("NFKC", text)).lower()


def syllable_len(text: str) -> int:
    return len(squash(text))
