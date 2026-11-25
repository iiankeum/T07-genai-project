"""받아쓴 뒤 단어장으로 글을 고친다(인터넷 · AI 없이, 규칙과 소리 비교만으로).

세 가지를 찾는다.
1. alias(다르게 들리는 말): 단어장에 적어 둔 잘못된 모양이 그대로 나오면 낱말로 바꾼다. 자동 적용.
2. spacing(띄어쓰기): 「타이밍 벨트」처럼 띄어쓰기만 다르면 단어장 모양으로 맞춘다. 자동 적용.
3. sound(소리 비슷): 자모로 풀어 비교해 낱말과 소리가 아주 비슷한 곳. 아주 비슷하고 길면 자동,
   아니면 「제안」으로만 보여 주고 사람이 누르면 고친다. 사람이 고친 것은 단어장에 다르게 들리는 말로 쌓인다.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass, asdict

from . import jamo
from .glossary import Glossary

# 짧은(1~2글자) 말은 다른 낱말의 앞부분일 수 있어서, 뒤에 조사만 올 때만 바꾼다.
PARTICLES = {
    "", "이", "가", "을", "를", "은", "는", "도", "만", "에", "에서", "으로", "로", "랑", "이랑", "하고",
    "와", "과", "의", "요", "이요", "좀", "두", "개", "까지", "부터", "보다", "처럼", "이나", "나", "이고", "고",
    "이에요", "예요", "입니다", "이다", "라고", "이라고", "하나", "요?", "만요", "도요", "에요", "이죠", "죠",
}


@dataclass
class Fix:
    start: int
    end: int
    before: str
    after: str
    kind: str      # alias | spacing | sound
    score: float   # 0 = 같음, 1 = 전혀 다름(소리 비교일 때만 의미 있음)
    auto: bool

    def to_dict(self) -> dict:
        return asdict(self)


def _is_sep(ch: str) -> bool:
    return not jamo.squash(ch)


class _Squashed:
    """띄어쓰기 · 문장부호를 뺀 글과, 각 글자가 원래 글의 몇 번째였는지."""

    def __init__(self, text: str):
        self.text = text
        chars: list[str] = []
        where: list[int] = []
        for i, ch in enumerate(text):
            n = jamo.squash(ch)
            for c in n:
                chars.append(c)
                where.append(i)
        self.s = "".join(chars)
        self.where = where
        self.starts = {k for k, oi in enumerate(where) if oi == 0 or _is_sep(text[oi - 1])}

    def span(self, k: int, w: int) -> tuple[int, int]:
        return self.where[k], self.where[k + w - 1] + 1

    def rest_of_word(self, end: int) -> str:
        """원래 글에서 end 부터 그 어절 끝까지."""
        j = end
        while j < len(self.text) and not _is_sep(self.text[j]):
            j += 1
        return self.text[end:j]


class _Item:
    def __init__(self, term: str, aliases: list[str]):
        self.term = term
        self.term_sq = jamo.squash(term)
        self.aliases = [(a, jamo.squash(a)) for a in aliases if jamo.squash(a)]
        self.syms = jamo.to_symbols(self.term_sq)
        self.bigrams = jamo.bigrams(self.syms)
        self.hangul = any(jamo.is_hangul_syllable(c) for c in self.term_sq)


class Corrector:
    def __init__(self, glossary: Glossary | None, sound: bool = True):
        self.items = [_Item(e.term, e.aliases) for e in (glossary.entries if glossary else []) if jamo.squash(e.term)]
        self.sound = sound
        # 긴 말부터 맞춰야 「엔진미미」가 「미미」보다 먼저 잡힌다.
        self.exact: list[tuple[str, str, str]] = []   # (squashed, kind, term)
        for it in self.items:
            self.exact.append((it.term_sq, "spacing", it.term))
            for _a, a_sq in it.aliases:
                self.exact.append((a_sq, "alias", it.term))
        self.exact.sort(key=lambda x: -len(x[0]))
        self.known = {sq for sq, _k, _t in self.exact}

    # ------------------------------------------------------------------
    def find(self, text: str) -> list[Fix]:
        if not self.items or not text.strip():
            return []
        sq = _Squashed(text)
        taken = [False] * len(sq.s)
        fixes: list[Fix] = []
        word_starts = set(sq.starts)
        # 단어장 말이 끝나는 자리도 낱말이 시작하는 자리로 본다(「쏘렌토라지에다」처럼 붙여 적은 것).
        for _ in range(3):
            added = False
            for pat, _kind, _term in self.exact:
                k = sq.s.find(pat)
                while k >= 0:
                    if k in sq.starts and k + len(pat) < len(sq.s) and (k + len(pat)) not in sq.starts:
                        sq.starts.add(k + len(pat))
                        added = True
                    k = sq.s.find(pat, k + 1)
            if not added:
                break

        # 1) 단어장에 적힌 모양 그대로(낱말 · 다르게 들리는 말)
        for pat, kind, term in self.exact:
            w = len(pat)
            long_hangul = w >= 3 and any(jamo.is_hangul_syllable(c) for c in pat)
            start = 0
            while True:
                k = sq.s.find(pat, start)
                if k < 0:
                    break
                start = k + 1
                # 낱말 첫머리에서만 맞춘다. 세 글자 넘는 한글 말은 다른 말에 붙어 있어도 맞춘다.
                if (k not in sq.starts and not long_hangul) or any(taken[k:k + w]):
                    continue
                a, b = sq.span(k, w)
                rest = sq.rest_of_word(b)
                if not self._boundary_ok(pat, rest):
                    continue
                before = text[a:b]
                for j in range(k, k + w):
                    taken[j] = True
                if before == term:
                    continue  # 이미 맞게 적혀 있다
                after = term
                if k not in word_starts and a > 0 and not _is_sep(text[a - 1]):
                    after = " " + term  # 붙어 있던 말과 띄운다
                fixes.append(Fix(a, b, before, after, kind, 0.0, True))

        # 2) 소리가 비슷한 곳
        if self.sound:
            fixes.extend(self._sound(sq, taken))
        fixes.sort(key=lambda f: f.start)
        return fixes

    @staticmethod
    def _boundary_ok(pat: str, rest: str) -> bool:
        if pat and pat[-1].isascii() and pat[-1].isalnum() and rest[:1].isascii() and rest[:1].isalnum():
            return False  # 영어 낱말 한가운데
        if len(pat) <= 2 and any(jamo.is_hangul_syllable(c) for c in pat):
            return rest in PARTICLES
        return True

    def _sound(self, sq: _Squashed, taken: list[bool]) -> list[Fix]:
        s = sq.s
        if len(s) < 2:
            return []
        char_syms = [jamo.to_symbols(c) for c in s]
        seg_bigrams = jamo.bigrams([x for cs in char_syms for x in cs])
        cands: list[tuple[float, int, int, _Item]] = []
        for it in self.items:
            L = len(it.term_sq)
            if not it.hangul or L < 2 or not it.bigrams:
                continue
            if len(it.bigrams & seg_bigrams) / len(it.bigrams) < 0.4:
                continue
            limit = 0.28 if L >= 4 else (0.22 if L == 3 else 0.18)
            for k in sorted(sq.starts):
                for w in (L - 1, L, L + 1):
                    if w < 2 or k + w > len(s) or any(taken[k:k + w]):
                        continue
                    win = s[k:k + w]
                    if win == it.term_sq or win in self.known:
                        continue
                    if not any(jamo.is_hangul_syllable(c) for c in win):
                        continue
                    syms = [x for cs in char_syms[k:k + w] for x in cs]
                    if len(it.bigrams & jamo.bigrams(syms)) / len(it.bigrams) < 0.4:
                        continue
                    d = jamo.similarity_distance(it.syms, syms)
                    if d <= limit:
                        cands.append((d, k, w, it))
        cands.sort(key=lambda c: (c[0], -c[2]))
        out: list[Fix] = []
        for d, k, w, it in cands:
            if any(taken[k:k + w]):
                continue
            a, b = sq.span(k, w)
            rest = sq.rest_of_word(b)
            L = len(it.term_sq)
            if L <= 2 and rest not in PARTICLES:
                continue
            for j in range(k, k + w):
                taken[j] = True
            auto = (L >= 4 and d <= 0.12) or (L == 3 and d <= 0.08)
            out.append(Fix(a, b, sq.text[a:b], it.term, "sound", round(d, 3), auto))
        return out


def apply(text: str, fixes: list[Fix], accept: set[int] | None = None) -> str:
    """fixes 중 자동인 것(또는 accept 에 든 번호)만 적용한 글."""
    out, pos = [], 0
    for i, f in enumerate(sorted(fixes, key=lambda x: x.start)):
        use = f.auto if accept is None else (i in accept)
        if not use or f.start < pos:
            continue
        out.append(text[pos:f.start])
        out.append(f.after)
        pos = f.end
    out.append(text[pos:])
    return "".join(out)


def to_pieces(text: str, fixes: list[Fix]) -> list[dict]:
    """화면에 그리기 좋은 조각: 그냥 글과, 고친 곳(적용 여부 포함)."""
    pieces, pos = [], 0
    for f in sorted(fixes, key=lambda x: x.start):
        if f.start < pos:
            continue
        if f.start > pos:
            pieces.append({"t": text[pos:f.start]})
        pieces.append({"t": f.before, "fix": {"after": f.after, "kind": f.kind, "score": f.score, "applied": f.auto}})
        pos = f.end
    if pos < len(text):
        pieces.append({"t": text[pos:]})
    return pieces


def pieces_text(pieces: list[dict]) -> str:
    return "".join((p["fix"]["after"] if p.get("fix", {}).get("applied") else p["t"]) for p in pieces)


def normalize_for_count(text: str) -> str:
    return jamo.squash(unicodedata.normalize("NFKC", text))
