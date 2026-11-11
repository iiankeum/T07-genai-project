"""식당 데이터 읽기 (restaurants.csv + menus.csv).

엑셀로 고쳐 쓸 수 있도록 CSV(UTF-8)로 둔다. 열 설명은 data/README.md.
"""
from __future__ import annotations

import csv
from pathlib import Path

from .models import Menu, Restaurant


def _list(s: str | None, cast=str) -> list:
    return [cast(x.strip()) for x in (s or "").replace(",", ";").split(";") if x.strip()]


def _yes(s: str | None) -> bool:
    return (s or "").strip().upper() in ("Y", "YES", "O", "1", "TRUE", "예")


def _int(s: str | None, default: int = 0) -> int:
    try:
        return int(str(s).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def load_restaurants(folder: Path) -> list[Restaurant]:
    folder = Path(folder)
    menus: dict[str, list[Menu]] = {}
    menu_file = folder / "menus.csv"
    if menu_file.exists():
        with open(menu_file, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                rid = (row.get("식당id") or "").strip()
                if not rid or not (row.get("메뉴") or "").strip():
                    continue
                menus.setdefault(rid, []).append(Menu(
                    name=row["메뉴"].strip(), price=_int(row.get("가격")), unit=(row.get("단위") or "").strip(),
                    kind=(row.get("구분") or "메인").strip(), tags=_list(row.get("재료")),
                ))
    out: list[Restaurant] = []
    with open(folder / "restaurants.csv", encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            rid = (row.get("id") or "").strip()
            if not rid:
                continue
            out.append(Restaurant(
                id=rid, name=row["이름"].strip(), category=(row.get("업종") or "").strip(),
                station=(row.get("역") or "").strip(), walk_min=_int(row.get("도보분"), 99),
                max_group=_int(row.get("단체최대")), max_table=_int(row.get("한테이블최대")),
                rooms=sorted(_list(row.get("룸"), int)), room_note=(row.get("룸조건") or "").strip(),
                closed_days=_list(row.get("휴무")), lunch=_yes(row.get("점심")), dinner=_yes(row.get("저녁")),
                parking=_yes(row.get("주차")), moods=_list(row.get("분위기")),
                basis=(row.get("기준메뉴") or "").strip(), food_pp=_int(row.get("인당식사")),
                drinks_pp=_int(row.get("인당주류")), catchtable=(row.get("캐치테이블") or "").strip(),
                price_as_of=(row.get("가격기준일") or "").strip(), note=(row.get("메모") or "").strip(),
                menus=menus.get(rid, []),
            ))
    return out
