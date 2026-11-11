"""자주 틀리는 낱말 사전.

음성 인식이 잘못 받아쓴 말(오인식)과 현장 말(휀다·쇼바 등)을
표준 이름으로 바꾼다. 사전 파일은 glossary.csv — 현장에서 계속 늘려 간다.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Term:
    wrong: str
    right: str
    kind: str = ""
    note: str = ""


@dataclass
class Change:
    wrong: str
    right: str
    count: int


class Glossary:
    def __init__(self, terms: list[Term]):
        # 긴 말부터 바꿔야 "후론트 범퍼"가 "범퍼"보다 먼저 처리된다
        self.terms = sorted(terms, key=lambda t: len(t.wrong), reverse=True)

    @classmethod
    def load(cls, path: Path) -> "Glossary":
        if not Path(path).exists():
            return cls([])
        terms: list[Term] = []
        with open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                wrong = (row.get("틀린말") or "").strip()
                right = (row.get("고칠말") or "").strip()
                if wrong and right and wrong != right:
                    terms.append(Term(wrong, right, (row.get("종류") or "").strip(), (row.get("설명") or "").strip()))
        return cls(terms)

    def correct(self, text: str) -> tuple[str, list[Change]]:
        """사전대로 고친 글과, 무엇을 몇 번 고쳤는지 돌려준다."""
        changes: list[Change] = []
        # 이미 바꾼 부분을 다시 건드리지 않도록 자리표시자를 거친다
        placeholders: dict[str, str] = {}
        for i, term in enumerate(self.terms):
            n = text.count(term.wrong)
            if n:
                key = f"\x00{i}\x00"
                text = text.replace(term.wrong, key)
                placeholders[key] = term.right
                changes.append(Change(term.wrong, term.right, n))
        for key, right in placeholders.items():
            text = text.replace(key, right)
        return text, changes

    def prompt_terms(self, limit: int = 60) -> list[str]:
        """음성 인식(Whisper) 힌트로 줄 낱말 목록: 표준 이름 + 현장 말."""
        seen: list[str] = []
        for t in self.terms:
            for w in (t.right, t.wrong if t.kind == "현장말" else None):
                if w and w not in seen:
                    seen.append(w)
        return seen[:limit]

    def as_prompt_table(self) -> str:
        return "\n".join(f"- {t.wrong} → {t.right}" for t in self.terms)
