"""주문 카드 저장소 (SQLite 파일 하나)."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from .models import OrderCard

SCHEMA = """
CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_date TEXT NOT NULL,          -- YYYY-MM-DD
    call_time TEXT NOT NULL,          -- HH:MM
    status TEXT NOT NULL DEFAULT 'draft',
    source_name TEXT NOT NULL,        -- 원래 파일 이름
    audio_path TEXT,                  -- 녹음 파일 (있으면)
    transcript_raw TEXT NOT NULL,     -- 음성 인식 결과 그대로
    transcript TEXT NOT NULL,         -- 원문 + 낱말 사전 교정 (코드가 고친 글)
    ai_transcript TEXT NOT NULL DEFAULT '', -- AI가 다듬은 글 (참고용)
    ai_card_json TEXT NOT NULL,       -- AI가 처음 만든 카드 (수정 전, 비교용)
    card_json TEXT NOT NULL,          -- 담당자가 고친 현재 카드
    extractor TEXT NOT NULL,
    warnings TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS processed_files (
    path TEXT PRIMARY KEY,
    mtime REAL NOT NULL,
    card_id INTEGER,
    status TEXT NOT NULL DEFAULT 'done',  -- done | failed
    error TEXT NOT NULL DEFAULT '',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_try TEXT
);
"""

# 예전 버전 DB에 없던 열 (있으면 건너뜀)
MIGRATIONS = [
    ("cards", "ai_transcript", "TEXT NOT NULL DEFAULT ''"),
    ("processed_files", "status", "TEXT NOT NULL DEFAULT 'done'"),
    ("processed_files", "error", "TEXT NOT NULL DEFAULT ''"),
    ("processed_files", "attempts", "INTEGER NOT NULL DEFAULT 0"),
    ("processed_files", "last_try", "TEXT"),
]


@dataclass
class CardRecord:
    id: int
    call_date: str
    call_time: str
    status: str
    source_name: str
    audio_path: str | None
    transcript_raw: str
    transcript: str
    ai_transcript: str
    ai_card: OrderCard
    card: OrderCard
    extractor: str
    warnings: list[str]
    created_at: str
    updated_at: str

    @property
    def edited(self) -> bool:
        return self.ai_card.to_dict() != self.card.to_dict()


class Store:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(SCHEMA)
            for table, col, decl in MIGRATIONS:
                cols = {r["name"] for r in c.execute(f"PRAGMA table_info({table})")}
                if col not in cols:
                    c.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _row(r: sqlite3.Row) -> CardRecord:
        return CardRecord(
            id=r["id"], call_date=r["call_date"], call_time=r["call_time"], status=r["status"],
            source_name=r["source_name"], audio_path=r["audio_path"], transcript_raw=r["transcript_raw"],
            transcript=r["transcript"], ai_transcript=r["ai_transcript"], ai_card=OrderCard.from_dict(json.loads(r["ai_card_json"])),
            card=OrderCard.from_dict(json.loads(r["card_json"])), extractor=r["extractor"],
            warnings=json.loads(r["warnings"]), created_at=r["created_at"], updated_at=r["updated_at"],
        )

    def add(self, *, call_at: datetime, source_name: str, audio_path: str | None, transcript_raw: str,
            transcript: str, card: OrderCard, extractor: str, warnings: list[str], ai_transcript: str = "") -> int:
        now = datetime.now().isoformat(timespec="seconds")
        js = json.dumps(card.to_dict(), ensure_ascii=False)
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO cards (call_date, call_time, source_name, audio_path, transcript_raw, transcript,"
                " ai_transcript, ai_card_json, card_json, extractor, warnings, created_at, updated_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (call_at.strftime("%Y-%m-%d"), call_at.strftime("%H:%M"), source_name, audio_path,
                 transcript_raw, transcript, ai_transcript, js, js, extractor,
                 json.dumps(warnings, ensure_ascii=False), now, now),
            )
            return int(cur.lastrowid)

    def get(self, card_id: int) -> CardRecord | None:
        with self._conn() as c:
            r = c.execute("SELECT * FROM cards WHERE id=?", (card_id,)).fetchone()
        return self._row(r) if r else None

    def list(self, date: str | None = None, status: str | None = None) -> list[CardRecord]:
        q, args = "SELECT * FROM cards WHERE 1=1", []
        if date:
            q += " AND call_date=?"
            args.append(date)
        if status:
            q += " AND status=?"
            args.append(status)
        q += " ORDER BY call_date DESC, call_time DESC, id DESC"
        with self._conn() as c:
            return [self._row(r) for r in c.execute(q, args).fetchall()]

    def dates(self) -> list[str]:
        with self._conn() as c:
            return [r[0] for r in c.execute("SELECT DISTINCT call_date FROM cards ORDER BY call_date DESC")]

    def update(self, card_id: int, card: OrderCard | None = None, status: str | None = None) -> None:
        sets, args = ["updated_at=?"], [datetime.now().isoformat(timespec="seconds")]
        if card is not None:
            sets.append("card_json=?")
            args.append(json.dumps(card.to_dict(), ensure_ascii=False))
        if status is not None:
            sets.append("status=?")
            args.append(status)
        with self._conn() as c:
            c.execute(f"UPDATE cards SET {', '.join(sets)} WHERE id=?", (*args, card_id))

    def delete(self, card_id: int) -> None:
        with self._conn() as c:
            c.execute("DELETE FROM cards WHERE id=?", (card_id,))

    # 폴더 감시용: 처리 기록 (성공한 것만 'done', 실패는 'failed'로 남겨 다시 시도)
    def file_state(self, path: str) -> dict | None:
        with self._conn() as c:
            r = c.execute("SELECT * FROM processed_files WHERE path=?", (path,)).fetchone()
        return dict(r) if r else None

    def mark_done(self, path: str, mtime: float, card_id: int) -> None:
        with self._conn() as c:
            c.execute("INSERT OR REPLACE INTO processed_files (path, mtime, card_id, status, error, attempts, last_try)"
                      " VALUES (?,?,?,'done','',0,?)", (path, mtime, card_id, datetime.now().isoformat(timespec="seconds")))

    def mark_failed(self, path: str, mtime: float, error: str, attempts: int) -> None:
        with self._conn() as c:
            c.execute("INSERT OR REPLACE INTO processed_files (path, mtime, card_id, status, error, attempts, last_try)"
                      " VALUES (?,?,NULL,'failed',?,?,?)",
                      (path, mtime, error[:500], attempts, datetime.now().isoformat(timespec="seconds")))

    def failed_files(self) -> list[dict]:
        with self._conn() as c:
            return [dict(r) for r in c.execute(
                "SELECT * FROM processed_files WHERE status='failed' ORDER BY last_try DESC")]
