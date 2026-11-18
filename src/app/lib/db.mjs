// 데이터베이스: Node 내장 node:sqlite (네이티브 빌드 없음). 파일은 DATA_DIR/callnote.sqlite.
// 표 구조는 docs/설계.md 「데이터 모델」과 같다. 바꿀 때는 둘 다 고친다.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from './config.mjs';

// node:sqlite 는 아직 실험 기능이라 경고를 한 번 낸다. 기능 경고만 걸러 로그를 깨끗하게 한다.
const origEmit = process.emitWarning;
process.emitWarning = function (warning, ...args) {
  const msg = typeof warning === 'string' ? warning : warning?.message;
  if (msg && msg.includes('SQLite is an experimental feature')) return;
  return origEmit.call(process, warning, ...args);
};
// 경고 거르기를 건 뒤에 불러온다(정적 import 는 이 코드보다 먼저 돌아 경고가 새어 나옴)
const { DatabaseSync } = await import('node:sqlite');

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
  call_type TEXT NOT NULL DEFAULT '주문', -- 주문 | 배송 문의 | 반품·교환 | 재고·단가 문의 | 기타
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
  ip_hash TEXT,
  extra TEXT                            -- JSON: 소개 페이지 양식의 그 밖 칸(업종·하루 통화 수·지역·마케팅 동의 등)
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

CREATE TABLE IF NOT EXISTS audit_log(
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  occurred_at TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT
);
CREATE INDEX IF NOT EXISTS audit_entity ON audit_log(entity, entity_id, occurred_at);

CREATE TABLE IF NOT EXISTS knowledge_revisions(
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL REFERENCES glossary(id) ON DELETE CASCADE,
  base_version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT,
  submitted_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  approved_version INTEGER
);
CREATE INDEX IF NOT EXISTS knowledge_revision_item ON knowledge_revisions(knowledge_id, created_at);

CREATE TABLE IF NOT EXISTS assistant_threads(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  messages TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assistant_threads_user ON assistant_threads(user_id, updated_at);

CREATE TABLE IF NOT EXISTS notification_reads(
  user_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY(user_id, notification_id)
);
`;

let _db = null;
let testDb = null;
const workspaceStorage = new AsyncLocalStorage();
const connections = new Map();
const MAX_CONNECTIONS = 24;
export const DEMO_WORKSPACE_ID = 'demo';
export const LEGACY_WORKSPACE_ID = 'legacy';
export const workspaceContext = () => workspaceStorage.getStore();
export const defaultWorkspaceId = () => config.demoMode ? DEMO_WORKSPACE_ID : LEGACY_WORKSPACE_ID;

export function withWorkspace(access, fn) {
  const id = access?.workspace?.id;
  if (id !== DEMO_WORKSPACE_ID && id !== LEGACY_WORKSPACE_ID && !/^ws_[a-z0-9]{19}$/.test(id ?? '')) {
    throw new TypeError('유효한 워크스페이스가 필요합니다.');
  }
  return workspaceStorage.run(access, fn);
}

export function dataDir() {
  const id = workspaceContext()?.workspace.id ?? defaultWorkspaceId();
  if (id === LEGACY_WORKSPACE_ID || (testDb && id === DEMO_WORKSPACE_ID)) return config.dataDir;
  return path.join(config.dataDir, 'workspaces', id);
}

export function openDb(file) {
  const dbFile = file ?? path.join(dataDir(), 'callnote.sqlite');
  if (dbFile !== ':memory:') mkdirSync(path.dirname(dbFile), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbFile);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// 이미 만들어진 DB 에 나중에 생긴 칸을 더한다(CREATE TABLE IF NOT EXISTS 는 칸을 더하지 않으므로).
// 칸을 새로 만들면 SCHEMA 와 여기 둘 다에 적는다.
const COLUMNS = [
  ['cards', 'delivery', 'TEXT'],
  ['cards', 'evidence', "TEXT NOT NULL DEFAULT '{}'"],
  ['cards', 'customer_by_phone', 'INTEGER NOT NULL DEFAULT 0'],
  ['cards', 'call_type', "TEXT NOT NULL DEFAULT '주문'"],
  ['glossary', 'phone', 'TEXT'],
  ['trials', 'extra', 'TEXT'],
  ['cards', 'domain_version', "TEXT NOT NULL DEFAULT 'automotive@1'"],
  ['cards', 'field_reviews', "TEXT NOT NULL DEFAULT '{}'"],
  ['cards', 'revision', 'INTEGER NOT NULL DEFAULT 0'],
  ['glossary', 'version', 'INTEGER NOT NULL DEFAULT 1'],
  ['glossary', 'aliases', "TEXT NOT NULL DEFAULT '[]'"],
  ['glossary', 'relations', "TEXT NOT NULL DEFAULT '[]'"],
  ['glossary', 'source_call_id', 'TEXT'],
  ['glossary', 'source_seg_index', 'INTEGER'],
  ['glossary', 'submitted_by', 'TEXT'],
  ['glossary', 'evidence_note', 'TEXT'],
];
function migrate(db) {
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [table, col, ddl] of COLUMNS) {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
      if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** 서비스 전체 사용 상한과 도입 문의를 저장한다. */
export function globalDb() {
  if (testDb) return testDb;
  if (!_db) _db = openDb(path.join(config.dataDir, 'callnote.sqlite'));
  return _db;
}

/** 요청과 그 요청이 시작한 백그라운드 일이 같은 워크스페이스 DB를 쓴다. */
export function db() {
  const id = workspaceContext()?.workspace.id ?? defaultWorkspaceId();
  if (id === LEGACY_WORKSPACE_ID) return globalDb();
  if (testDb && id === DEMO_WORKSPACE_ID) return testDb;
  const existing = connections.get(id);
  if (existing) {
    connections.delete(id);
    connections.set(id, existing);
    return existing;
  }
  const d = openDb();
  connections.set(id, d);
  if (connections.size > MAX_CONNECTIONS) {
    const oldest = connections.keys().next().value;
    connections.get(oldest).close();
    connections.delete(oldest);
  }
  return d;
}
export function setDb(d) { testDb = d; }

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
