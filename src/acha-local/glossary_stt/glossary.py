"""단어장: 받아쓰기가 알아야 할 낱말과, 그 낱말이 잘못 적히는 모양.

한 줄 = 낱말 하나.
- 낱말(term): 글에 이렇게 적히길 바라는 모양. 예) 라디에이터
- 다르게 들리는 말(aliases): 엔진이 잘못 적거나 현장에서 달리 부르는 말. 보이면 낱말로 바꾼다. 예) 라지에다, 라지에타
- 메모(note): 사람이 보는 설명. 받아쓰기에는 안 쓴다.
- 항상 넣기(pinned): 힌트 자리가 모자라도 늘 먼저 넣는다.
- 쓰인 횟수(hits): 받아쓴 글에 나온 횟수. 자리가 모자랄 때 많이 쓰인 낱말을 먼저 넣는다.

저장은 CSV(엑셀에서 열 수 있게 UTF-8 BOM)로 한다.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path

HEADERS = ["낱말", "다르게 들리는 말", "메모", "항상 넣기", "쓰인 횟수"]
_HEADER_ALIASES = {
    "term": 0, "낱말": 0, "단어": 0, "용어": 0, "표준": 0,
    "aliases": 1, "alias": 1, "다르게 들리는 말": 1, "오인식": 1, "별칭": 1, "다른 말": 1,
    "note": 2, "메모": 2, "설명": 2,
    "pinned": 3, "항상 넣기": 3, "고정": 3,
    "hits": 4, "쓰인 횟수": 4, "횟수": 4,
}
_ALIAS_SPLIT = re.compile(r"\s*[,;|/、]\s*")
_TRUE = {"1", "y", "yes", "true", "o", "예", "네", "✓", "v"}
MAX_ENTRIES = 5000


@dataclass
class Entry:
    term: str
    aliases: list[str] = field(default_factory=list)
    note: str = ""
    pinned: bool = False
    hits: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "Entry":
        aliases = d.get("aliases") or []
        if isinstance(aliases, str):
            aliases = split_aliases(aliases)
        return Entry(
            term=str(d.get("term", "")).strip(),
            aliases=[a for a in (str(x).strip() for x in aliases) if a],
            note=str(d.get("note", "") or "").strip(),
            pinned=bool(d.get("pinned", False)),
            hits=max(0, int(d.get("hits", 0) or 0)),
        )


def split_aliases(text: str) -> list[str]:
    return [a for a in (s.strip() for s in _ALIAS_SPLIT.split(text or "")) if a]


@dataclass
class Glossary:
    name: str
    entries: list[Entry] = field(default_factory=list)

    def clean(self) -> "Glossary":
        """빈 줄 · 겹친 낱말을 정리한다. 같은 낱말이 두 번 있으면 하나로 합친다."""
        merged: dict[str, Entry] = {}
        order: list[str] = []
        for e in self.entries:
            term = e.term.strip()
            if not term:
                continue
            key = term.lower()
            if key not in merged:
                merged[key] = Entry(term=term, aliases=[], note=e.note, pinned=e.pinned, hits=e.hits)
                order.append(key)
            else:
                m = merged[key]
                m.pinned = m.pinned or e.pinned
                m.hits = max(m.hits, e.hits)
                m.note = m.note or e.note
            m = merged[key]
            for a in e.aliases:
                a = a.strip()
                if a and a.lower() != key and a.lower() not in (x.lower() for x in m.aliases):
                    m.aliases.append(a)
        self.entries = [merged[k] for k in order][:MAX_ENTRIES]
        return self

    def find(self, term: str) -> Entry | None:
        key = term.strip().lower()
        return next((e for e in self.entries if e.term.lower() == key), None)

    def learn(self, term: str, alias: str | None = None) -> Entry:
        """사람이 고친 것을 배운다: 낱말이 없으면 만들고, alias 는 다르게 들리는 말로 넣는다."""
        e = self.find(term)
        if e is None:
            e = Entry(term=term.strip())
            self.entries.append(e)
        if alias and alias.strip() and alias.strip().lower() != e.term.lower():
            if alias.strip().lower() not in (a.lower() for a in e.aliases):
                e.aliases.append(alias.strip())
        return e

    # ---- CSV ----
    def to_csv(self) -> str:
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\r\n")
        w.writerow(HEADERS)
        for e in self.entries:
            w.writerow([e.term, ", ".join(e.aliases), e.note, "예" if e.pinned else "", e.hits or ""])
        return buf.getvalue()

    @staticmethod
    def from_csv(name: str, text: str) -> "Glossary":
        text = text.lstrip("﻿")
        rows = list(csv.reader(io.StringIO(text)))
        while rows and (not rows[0] or rows[0][0].lstrip().startswith("#")):
            rows = rows[1:]  # 머리의 빈 줄 · 「#」 설명 줄은 건너뛴다
        if not rows:
            return Glossary(name=name)
        col = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4}
        first = [c.strip().lower() for c in rows[0]]
        if any(c in _HEADER_ALIASES for c in first):
            col = {}
            for i, c in enumerate(first):
                if c in _HEADER_ALIASES and _HEADER_ALIASES[c] not in col:
                    col[_HEADER_ALIASES[c]] = i
            rows = rows[1:]

        def cell(row: list[str], k: int) -> str:
            i = col.get(k)
            return row[i].strip() if i is not None and i < len(row) else ""

        entries = []
        for row in rows:
            term = cell(row, 0)
            if not term or term.startswith("#"):
                continue
            hits = cell(row, 4)
            entries.append(Entry(
                term=term,
                aliases=split_aliases(cell(row, 1)),
                note=cell(row, 2),
                pinned=cell(row, 3).lower() in _TRUE,
                hits=int(hits) if hits.isdigit() else 0,
            ))
        return Glossary(name=name, entries=entries).clean()

    @staticmethod
    def from_text_lines(name: str, text: str) -> "Glossary":
        """CSV 가 아닌 그냥 낱말 목록(한 줄에 하나 또는 쉼표로 이은 것)도 받는다."""
        terms = [t for line in text.splitlines() for t in split_aliases(line)]
        return Glossary(name=name, entries=[Entry(term=t) for t in terms]).clean()

    @staticmethod
    def load(path: Path) -> "Glossary":
        return Glossary.from_csv(path.stem, path.read_text(encoding="utf-8-sig"))

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(self.to_csv(), encoding="utf-8-sig")
        tmp.replace(path)
