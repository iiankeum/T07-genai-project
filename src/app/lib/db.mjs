// 데이터베이스: Node 내장 node:sqlite (네이티브 빌드 없음). 파일은 DATA_DIR/callnote.sqlite.
// 표 구조는 docs/설계.md 「데이터 모델」과 같다. 바꿀 때는 둘 다 고친다.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from './config.mjs';

// node:sqlite 는 아직 실험 기능이라 경고를 한 번 낸다. 기능 경고만 걸러 로그를 깨끗하게 한다.
const origEmit = process.emitWarning;
process.emitWarning = function (warning, ...args) {
  const msg = typeof warning === 'string' ? warning : warning?.message;
  if (msg && msg.includes('SQLite is an experimental feature')) return;
  return origEmit.call(process, warning, ...args);
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS calls(
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  source TEXT NOT NULL,               -- seed | upload | ingest | live
  status TEXT NOT NULL,               -- queued | transcribing | extracting | ready | failed
  title TEXT,                         -- 자동 이름: 거래처 · 부품 · 시각 · 길이
  customer TEXT,
  caller_number TEXT,
  device_name TEXT,
  duration_sec REAL,
  audio_file TEXT,                    -- DATA_DIR/audio 아래 16kHz mono WAV 상대 경로
  audio_sha256 TEXT,                  -- 원본 파일 SHA-256 (중복 막기)
  original_name TEXT,
  transcript TEXT,
  segments TEXT NOT NULL DEFAULT '[]',-- JSON [{start,end,text,speaker?}]
  engine TEXT,
  stt_elapsed_sec REAL,
  error TEXT,
  is_fake INTEGER NOT NULL DEFAULT 1,
  uploader TEXT,                      -- IP 해시 (원래 IP 는 저장하지 않음)
  summary TEXT                        -- 한 줄 요약
);
CREATE INDEX IF NOT EXISTS calls_recorded ON calls(recorded_at);
CREATE INDEX IF NOT EXISTS calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS calls_sha ON calls(audio_sha256);

CREATE TABLE IF NOT EXISTS cards(
  call_id TEXT PRIMARY KEY REFERENCES calls(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | confirmed | shipped | cancelled
  customer TEXT,
  contact TEXT,
  car_model TEXT,
  model_year TEXT,
  plate TEXT,
  items TEXT NOT NULL DEFAULT '[]',     -- JSON [{part, qty, part_no, quote, at}]
  urgent INTEGER NOT NULL DEFAULT 0,
  due TEXT,
  delivery TEXT,                        -- 배송/퀵/직접 수령 등
  ask_back TEXT NOT NULL DEFAULT '[]',  -- JSON [string]
  unsure TEXT NOT NULL DEFAULT '[]',    -- JSON [{field, reason, at}]
  fixes TEXT NOT NULL DEFAULT '[]',     -- JSON [{heard, fixed}]
  evidence TEXT NOT NULL DEFAULT '{}',  -- JSON {customer:{quote,at}, carModel:{...}, plate, urgent, due, delivery}
  highlights TEXT NOT NULL DEFAULT '[]',-- JSON [{text, kind}]
  note TEXT,
  customer_by_phone INTEGER NOT NULL DEFAULT 0, -- F11 걸려 온 번호로 맞춤
  callback INTEGER NOT NULL DEFAULT 0,  -- 다시 전화할 곳
  callback_reason TEXT,
  ai_draft TEXT,                        -- JSON: AI 가 처음 만든 카드(고치기 전)
  ai_model TEXT,
  ai_error TEXT,
  edits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  shipped_at TEXT
);
CREATE INDEX IF NOT EXISTS cards_status ON cards(status);

CREATE TABLE IF NOT EXISTS jobs(
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  state TEXT NOT NULL,                  -- queued | leased | done | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  worker TEXT,
  leased_at TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS jobs_state ON jobs(state, created_at);

CREATE TABLE IF NOT EXISTS workers(
  name TEXT PRIMARY KEY,
  engine TEXT, gpu TEXT, version TEXT,
  last_seen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS glossary(
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                   -- 현장말 | 오인식 | 거래처 | 차종
  term TEXT NOT NULL,                   -- 현장 말 / 틀린 말 / 거래처 이름 / 차종
  standard TEXT,                        -- 표준 말 / 바른 말 / (거래처) 메모
  phone TEXT,                           -- 거래처의 (가짜) 전화번호, F11
  note TEXT,
  status TEXT NOT NULL DEFAULT 'approved', -- approved | pending
  source TEXT,                          -- 기본 | 사용자
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS glossary_kind ON glossary(kind, status);

CREATE TABLE IF NOT EXISTS briefings(
  day TEXT PRIMARY KEY,                 -- YYYY-MM-DD (KST)
  content TEXT NOT NULL,                -- JSON
  model TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendations(
  day TEXT PRIMARY KEY,
  content TEXT NOT NULL,                -- JSON [{title, why, callId, priority}]
  model TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trials(
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  org TEXT,
  contact TEXT NOT NULL,
  role TEXT,
  message TEXT,
  consent_at TEXT NOT NULL,
  ip_hash TEXT
);

CREATE TABLE IF NOT EXISTS usage(
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(day, kind)
);

CREATE TABLE IF NOT EXISTS meta(
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

let _db = null;

export function openDb(file) {
  const dbFile = file ?? path.join(config.dataDir, 'callnote.sqlite');
  if (dbFile !== ':memory:') mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new DatabaseSync(dbFile);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  return db;
}

/** 앱 전체가 쓰는 DB 하나. 테스트는 setDb() 로 바꿔 끼운다. */
export function db() {
  if (!_db) _db = openDb();
  return _db;
}
export function setDb(d) { _db = d; }

/** 짧고 시간순으로 정렬되는 ID: prefix_시간36진수+난수 */
export function newId(prefix) {
  const t = Date.now().toString(36).padStart(9, '0');
  return `${prefix}_${t}${randomBytes(5).toString('hex')}`;
}

export const nowIso = () => new Date().toISOString();

/** JSON 칸 읽기(깨졌으면 기본값) */
export function parseJson(text, fallback) {
  if (text == null || text === '') return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

/** 한 번에 여러 쿼리를 묶는다 */
export function tx(fn) {
  const d = db();
  d.exec('BEGIN');
  try { const r = fn(d); d.exec('COMMIT'); return r; }
  catch (e) { d.exec('ROLLBACK'); throw e; }
}

export function getMeta(key) {
  return db().prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
}
export function setMeta(key, value) {
  db().prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));
}
