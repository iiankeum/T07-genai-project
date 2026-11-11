"""모임·의견·결과(라운드)·투표 저장 (SQLite 파일 하나)."""
from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,          -- 투표 공유 링크용
    status TEXT NOT NULL DEFAULT 'planning',  -- planning | decided
    decided_id TEXT,
    overrides TEXT NOT NULL DEFAULT '{}', -- 담당자가 직접 바꾼 조건 {key: must|prefer|off}
    suggestions TEXT NOT NULL DEFAULT '[]', -- 예시 모임의 '다음 의견' 버튼
    created_at TEXT NOT NULL,
    decided_at TEXT
);
CREATE TABLE IF NOT EXISTS opinions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'chat',  -- chat | vote
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    n INTEGER NOT NULL,
    trigger TEXT NOT NULL,
    data TEXT NOT NULL,                  -- 조건·후보·변경 설명 JSON
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,
    voter TEXT NOT NULL,
    restaurant_id TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (meeting_id, voter)
);
"""


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class Store:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(SCHEMA)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # 모임
    def create_meeting(self, title: str, suggestions: list[str] | None = None) -> int:
        with self._conn() as c:
            cur = c.execute("INSERT INTO meetings (title, token, suggestions, created_at) VALUES (?,?,?,?)",
                            (title, secrets.token_urlsafe(8), json.dumps(suggestions or [], ensure_ascii=False), _now()))
            return int(cur.lastrowid)

    def meeting(self, mid: int) -> dict[str, Any] | None:
        with self._conn() as c:
            r = c.execute("SELECT * FROM meetings WHERE id=?", (mid,)).fetchone()
        return self._meeting(r) if r else None

    def meeting_by_token(self, token: str) -> dict[str, Any] | None:
        with self._conn() as c:
            r = c.execute("SELECT * FROM meetings WHERE token=?", (token,)).fetchone()
        return self._meeting(r) if r else None

    @staticmethod
    def _meeting(r: sqlite3.Row) -> dict[str, Any]:
        d = dict(r)
        d["overrides"] = json.loads(d["overrides"])
        d["suggestions"] = json.loads(d["suggestions"])
        return d

    def meetings(self) -> list[dict[str, Any]]:
        with self._conn() as c:
            return [self._meeting(r) for r in c.execute("SELECT * FROM meetings ORDER BY id DESC")]

    def set_overrides(self, mid: int, overrides: dict[str, str]) -> None:
        with self._conn() as c:
            c.execute("UPDATE meetings SET overrides=? WHERE id=?", (json.dumps(overrides, ensure_ascii=False), mid))

    def set_suggestions(self, mid: int, suggestions: list[str]) -> None:
        with self._conn() as c:
            c.execute("UPDATE meetings SET suggestions=? WHERE id=?", (json.dumps(suggestions, ensure_ascii=False), mid))

    def decide(self, mid: int, rid: str | None) -> None:
        with self._conn() as c:
            if rid:
                c.execute("UPDATE meetings SET status='decided', decided_id=?, decided_at=? WHERE id=?", (rid, _now(), mid))
            else:
                c.execute("UPDATE meetings SET status='planning', decided_id=NULL, decided_at=NULL WHERE id=?", (mid,))

    def delete_meeting(self, mid: int) -> None:
        with self._conn() as c:
            for t in ("opinions", "rounds", "votes"):
                c.execute(f"DELETE FROM {t} WHERE meeting_id=?", (mid,))
            c.execute("DELETE FROM meetings WHERE id=?", (mid,))

    # 의견
    def add_opinion(self, mid: int, author: str, text: str, source: str = "chat") -> int:
        with self._conn() as c:
            cur = c.execute("INSERT INTO opinions (meeting_id, author, text, source, created_at) VALUES (?,?,?,?,?)",
                            (mid, author, text, source, _now()))
            return int(cur.lastrowid)

    def opinions(self, mid: int) -> list[dict[str, Any]]:
        with self._conn() as c:
            return [dict(r) for r in c.execute("SELECT * FROM opinions WHERE meeting_id=? ORDER BY id", (mid,))]

    def delete_opinion(self, mid: int, oid: int) -> dict[str, Any] | None:
        with self._conn() as c:
            r = c.execute("SELECT * FROM opinions WHERE id=? AND meeting_id=?", (oid, mid)).fetchone()
            c.execute("DELETE FROM opinions WHERE id=? AND meeting_id=?", (oid, mid))
        return dict(r) if r else None

    # 결과 (의견이 바뀔 때마다 한 라운드)
    def add_round(self, mid: int, trigger: str, data: dict[str, Any]) -> int:
        with self._conn() as c:
            n = c.execute("SELECT COALESCE(MAX(n), 0) + 1 FROM rounds WHERE meeting_id=?", (mid,)).fetchone()[0]
            c.execute("INSERT INTO rounds (meeting_id, n, trigger, data, created_at) VALUES (?,?,?,?,?)",
                      (mid, n, trigger, json.dumps(data, ensure_ascii=False), _now()))
            return int(n)

    def rounds(self, mid: int) -> list[dict[str, Any]]:
        with self._conn() as c:
            rows = c.execute("SELECT * FROM rounds WHERE meeting_id=? ORDER BY n", (mid,)).fetchall()
        return [{**dict(r), "data": json.loads(r["data"])} for r in rows]

    def latest_round(self, mid: int) -> dict[str, Any] | None:
        with self._conn() as c:
            r = c.execute("SELECT * FROM rounds WHERE meeting_id=? ORDER BY n DESC LIMIT 1", (mid,)).fetchone()
        return {**dict(r), "data": json.loads(r["data"])} if r else None

    # 투표 (한 사람 한 표, 다시 투표하면 바뀜)
    def vote(self, mid: int, voter: str, rid: str, comment: str = "") -> None:
        with self._conn() as c:
            c.execute("INSERT INTO votes (meeting_id, voter, restaurant_id, comment, created_at) VALUES (?,?,?,?,?)"
                      " ON CONFLICT(meeting_id, voter) DO UPDATE SET restaurant_id=excluded.restaurant_id,"
                      " comment=excluded.comment, created_at=excluded.created_at",
                      (mid, voter, rid, comment, _now()))

    def votes(self, mid: int) -> list[dict[str, Any]]:
        with self._conn() as c:
            return [dict(r) for r in c.execute("SELECT * FROM votes WHERE meeting_id=? ORDER BY id", (mid,))]

    def vote_by_id(self, mid: int, vid: int) -> dict[str, Any] | None:
        with self._conn() as c:
            r = c.execute("SELECT * FROM votes WHERE id=? AND meeting_id=?", (vid, mid)).fetchone()
        return dict(r) if r else None

    def clear_vote_comment(self, mid: int, vid: int) -> None:
        with self._conn() as c:
            c.execute("UPDATE votes SET comment='' WHERE id=? AND meeting_id=?", (vid, mid))
