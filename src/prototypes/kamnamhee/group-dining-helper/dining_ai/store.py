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
    token TEXT NOT NULL UNIQUE,          -- 투표 공유 링크용 (팀원에게 공유)
    admin_token TEXT NOT NULL DEFAULT '', -- 담당자 화면용 (공유하지 않음)
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
    voter_key TEXT NOT NULL,             -- 브라우저마다 무작위로 만든 ID (쿠키). 이름이 같아도 사람을 구분
    voter TEXT NOT NULL,                 -- 화면에 보일 이름
    restaurant_id TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (meeting_id, voter_key)
);
"""


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class Store:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            self._migrate(c)
            c.executescript(SCHEMA)
            for r in c.execute("SELECT id FROM meetings WHERE admin_token=''").fetchall():
                c.execute("UPDATE meetings SET admin_token=? WHERE id=?", (secrets.token_urlsafe(16), r["id"]))

    @staticmethod
    def _migrate(c: sqlite3.Connection) -> None:
        """예전 버전 DB 고치기: 관리 토큰 열 추가, 투표를 '이름 기준'에서 '브라우저 기준'으로."""
        tables = {r["name"] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if "meetings" in tables:
            cols = {r["name"] for r in c.execute("PRAGMA table_info(meetings)")}
            if "admin_token" not in cols:
                c.execute("ALTER TABLE meetings ADD COLUMN admin_token TEXT NOT NULL DEFAULT ''")
        if "votes" in tables:
            cols = {r["name"] for r in c.execute("PRAGMA table_info(votes)")}
            if "voter_key" not in cols:
                c.execute("ALTER TABLE votes RENAME TO votes_old")
                c.executescript(SCHEMA)
                c.execute("INSERT INTO votes (id, meeting_id, voter_key, voter, restaurant_id, comment, created_at)"
                          " SELECT id, meeting_id, 'legacy-' || id, voter, restaurant_id, comment, created_at FROM votes_old")
                c.execute("DROP TABLE votes_old")

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # 모임
    def create_meeting(self, title: str, suggestions: list[str] | None = None) -> int:
        with self._conn() as c:
            cur = c.execute("INSERT INTO meetings (title, token, admin_token, suggestions, created_at) VALUES (?,?,?,?,?)",
                            (title, secrets.token_urlsafe(8), secrets.token_urlsafe(16),
                             json.dumps(suggestions or [], ensure_ascii=False), _now()))
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

    # 투표 (브라우저 하나에 한 표, 같은 브라우저에서 다시 투표하면 바뀜)
    def vote(self, mid: int, voter_key: str, voter: str, rid: str, comment: str = "") -> None:
        with self._conn() as c:
            c.execute("INSERT INTO votes (meeting_id, voter_key, voter, restaurant_id, comment, created_at)"
                      " VALUES (?,?,?,?,?,?) ON CONFLICT(meeting_id, voter_key) DO UPDATE SET voter=excluded.voter,"
                      " restaurant_id=excluded.restaurant_id, comment=excluded.comment, created_at=excluded.created_at",
                      (mid, voter_key, voter, rid, comment, _now()))

    def vote_of(self, mid: int, voter_key: str) -> dict[str, Any] | None:
        with self._conn() as c:
            r = c.execute("SELECT * FROM votes WHERE meeting_id=? AND voter_key=?", (mid, voter_key)).fetchone()
        return dict(r) if r else None

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
