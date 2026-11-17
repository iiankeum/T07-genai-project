// 계정과 워크스페이스 소속은 중앙 DB에 둔다. 업무 자료는 각 워크스페이스 DB에 둔다.
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { config, hasSecret } from './config.mjs';
import { db, newId, nowIso, workspaceContext, withWorkspace, DEMO_WORKSPACE_ID, LEGACY_WORKSPACE_ID, defaultWorkspaceId, parseJson } from './db.mjs';
import { HttpError } from './http.mjs';
import { readCookie, secureRequest, requireBearer, safeEqual } from './security.mjs';

const scrypt = promisify(scryptCallback);
export const ROLES = Object.freeze(['admin', 'reception', 'shipping', 'viewer']);
const COOKIE = 'ahmatda_session';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const POLICY_VERSION = 'v1.6';
const DUMMY_HASH = 'scrypt:' + '0'.repeat(32) + ':' + '0'.repeat(128);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEW_WS_RE = /^ws_[a-z0-9]{19}$/;
const ALLOWED_MAIL = new Set(['outbox']);
const defaultNotifications = Object.freeze({ urgent: true, review: true, upload: true });
const token = () => randomBytes(32).toString('base64url');
const digest = (value) => createHash('sha256').update(value).digest('hex');

let accountsDb;
export function accountDb() {
  if (accountsDb) return accountsDb;
  mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
  const d = new DatabaseSync(path.join(config.dataDir, 'accounts.sqlite'));
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      phone TEXT, password_hash TEXT NOT NULL, verified_at TEXT,
      terms_version TEXT NOT NULL, consent_at TEXT NOT NULL, created_at TEXT NOT NULL,
      failed_logins INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
      big_text INTEGER NOT NULL DEFAULT 0, notifications TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS workspaces(
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, hours TEXT, created_at TEXT NOT NULL,
      retention_days INTEGER NOT NULL DEFAULT 90,
      ai_mode TEXT NOT NULL DEFAULT 'off' CHECK(ai_mode IN ('off','masked','configured')),
      ingest_hash TEXT UNIQUE, ingest_rotated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS memberships(
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('admin','reception','shipping','viewer')),
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
      PRIMARY KEY(workspace_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS memberships_user ON memberships(user_id, active);
    CREATE TABLE IF NOT EXISTS sessions(
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS account_links(
      token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('verify','reset','invite')),
      email TEXT NOT NULL, workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      role TEXT, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL,
      used_at TEXT, id TEXT NOT NULL UNIQUE
    );
    CREATE INDEX IF NOT EXISTS account_links_lookup ON account_links(kind, email, workspace_id);
  `);
  accountsDb = d;
  return d;
}

function accountTransaction(fn) {
  const d = accountDb();
  d.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(d);
    d.exec('COMMIT');
    return result;
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

export function emailAddress(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new HttpError(400, 'bad_email', '이메일 주소를 확인해 주세요.');
  return email;
}

export function requiredText(value, max, code, message) {
  if (typeof value !== 'string') throw new HttpError(400, code, message);
  const clean = value.trim();
  if (!clean || clean.length > max || /[\u0000-\u001f\u007f]/u.test(clean)) throw new HttpError(400, code, message);
  return clean;
}

export function optionalText(value, max, code, message) {
  if (value == null || value === '') return null;
  return requiredText(value, max, code, message);
}

export function passwordValid(value) {
  const groups = typeof value === 'string' ? [/[A-Za-z]/, /[0-9]/, /[!-/:-@[-`{-~]/].filter((re) => re.test(value)).length : 0;
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value) > 256 || groups < 2) {
    throw new HttpError(400, 'bad_password', '비밀번호는 8자 이상이며 영문, 숫자, 특수문자 중 두 종류 이상을 사용해 주세요.');
  }
  return value;
}

async function passwordHash(value) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await scrypt(value, salt, 64)).toString('hex')}`;
}

async function passwordMatches(value, hash = DUMMY_HASH) {
  const [, salt, key] = hash.split(':');
  const password = typeof value === 'string' && Buffer.byteLength(value) <= 256 ? value : '';
  const candidate = await scrypt(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(key, 'hex'));
}

const userView = (row) => ({
  id: row.id, email: row.email, name: row.name, phone: row.phone,
  bigText: Boolean(row.big_text), notifications: { ...defaultNotifications, ...parseJson(row.notifications, {}) },
});
function workspaceView(row) {
  return {
    id: row.id, name: row.name, phone: row.phone, hours: row.hours,
    retentionDays: row.retention_days,
  };
}
const DEMO_ACCESS = Object.freeze({
  user: Object.freeze({ id: 'demo', name: '데모 담당자', email: null, phone: null, bigText: false, notifications: defaultNotifications }),
  workspace: Object.freeze({ id: DEMO_WORKSPACE_ID, name: '대한오토 부품', phone: null, hours: null, retentionDays: null }),
  role: 'admin', demo: true,
});

export function demoAccess() { return DEMO_ACCESS; }
export function requestAccess() { return workspaceContext() ?? (config.demoMode ? DEMO_ACCESS : null); }

export function recordAudit({ entity, entityId, action, before = null, after = null }) {
  const access = requestAccess();
  db().prepare(`INSERT INTO audit_log
    (id, entity, entity_id, action, actor_id, actor_name, occurred_at, before_json, after_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    newId('audit'), entity, entityId, action, access?.user?.id ?? null, access?.user?.name ?? null, nowIso(),
    before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after),
  );
}

export function requireRole(...roles) {
  const access = requestAccess();
  if (!access) throw new HttpError(401, 'login_required', '로그인해 주세요.');
  if (!roles.includes(access.role)) {
    recordAudit({ entity: 'access', entityId: access.workspace.id, action: 'denied', after: { roles } });
    throw new HttpError(403, 'permission_denied', '이 작업은 권한이 있는 구성원만 할 수 있습니다.');
  }
  return access;
}

function listMemberships(userId) {
  return accountDb().prepare(`SELECT w.*, m.role FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ? AND m.active = 1 ORDER BY w.created_at, w.id`).all(userId);
}

function sessionInfo(req) {
  const raw = readCookie(req, COOKIE);
  if (!TOKEN_RE.test(raw)) return null;
  const hash = digest(raw);
  const row = accountDb().prepare(`SELECT u.*, s.workspace_id, s.expires_at FROM sessions s
    JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.verified_at IS NOT NULL`).get(hash, Date.now());
  return row ? { id: hash, row } : null;
}

export function accountSession(req) {
  const session = sessionInfo(req);
  if (!session) throw new HttpError(401, readCookie(req, COOKIE) ? 'session_expired' : 'login_required', '로그인해 주세요.');
  return session;
}

export function browserAccess(req) {
  const info = sessionInfo(req);
  if (!info) return !readCookie(req, COOKIE) && config.demoMode ? DEMO_ACCESS : null;
  const w = listMemberships(info.row.id).find((x) => x.id === info.row.workspace_id);
  return w ? { user: userView(info.row), workspace: workspaceView(w), role: w.role, demo: false } : null;
}

export function me(req) {
  const info = sessionInfo(req);
  return {
    access: browserAccess(req),
    user: info ? userView(info.row) : null,
    workspaces: info ? listMemberships(info.row.id).map((w) => ({ ...workspaceView(w), role: w.role })) : [],
    demoAvailable: config.demoMode,
    expired: !info && Boolean(readCookie(req, COOKIE)),
  };
}

export function productAccess(req) {
  const access = browserAccess(req);
  if (access) return access;
  accountSession(req);
  throw new HttpError(403, 'workspace_required', '워크스페이스를 선택하거나 만들어 주세요.');
}

function cookie(req, value, maxAge = null) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict${secureRequest(req) ? '; Secure' : ''}${maxAge == null ? '' : `; Max-Age=${maxAge}`}`;
}

export async function login(req, res, body) {
  const email = emailAddress(body.email);
  const d = accountDb();
  const user = d.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user?.locked_until > Date.now()) throw new HttpError(429, 'account_locked', '로그인 시도가 잠겼습니다. 10분 뒤에 다시 해 주세요.');
  const matches = await passwordMatches(body.password, user?.password_hash);
  const invalid = () => new HttpError(401, 'invalid_credentials', '이메일과 비밀번호를 확인해 주세요.');
  if (!user) throw invalid();
  const active = d.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  if (active.locked_until > Date.now()) throw new HttpError(429, 'account_locked', '로그인 시도가 잠겼습니다. 10분 뒤에 다시 해 주세요.');
  if (active.password_hash !== user.password_hash) throw invalid();
  if (!matches) {
    const failures = active.failed_logins + 1;
    const locked = failures >= 5;
    d.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?')
      .run(locked ? 0 : failures, locked ? Date.now() + 10 * 60_000 : 0, user.id);
    if (locked) throw new HttpError(429, 'account_locked', '로그인 시도가 잠겼습니다. 10분 뒤에 다시 해 주세요.');
    throw invalid();
  }
  d.prepare('UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?').run(user.id);
  if (!active.verified_at) throw new HttpError(403, 'verification_required', '이메일 인증 링크를 먼저 열어 주세요.');
  const previous = sessionInfo(req);
  const workspaces = listMemberships(user.id);
  const selected = (previous?.row.id === user.id && workspaces.find((x) => x.id === previous.row.workspace_id)) || workspaces[0];
  const value = token();
  const duration = body.remember === true ? 30 * DAY : 12 * HOUR;
  accountTransaction((d) => {
    d.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    if (previous) d.prepare('DELETE FROM sessions WHERE token_hash = ?').run(previous.id);
    d.prepare('INSERT INTO sessions(token_hash, user_id, workspace_id, expires_at) VALUES (?, ?, ?, ?)')
      .run(digest(value), user.id, selected?.id ?? null, Date.now() + duration);
  });
  res.setHeader('Set-Cookie', cookie(req, value, body.remember === true ? duration / 1000 : null));
  return { ok: true, workspaceId: selected?.id ?? null };
}

export function logout(req, res) {
  const raw = readCookie(req, COOKIE);
  if (TOKEN_RE.test(raw)) accountDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(raw));
  res.setHeader('Set-Cookie', cookie(req, '', 0));
  return { ok: true };
}

export const mailAvailable = () => ALLOWED_MAIL.has(process.env.AUTH_MAIL_MODE ?? '');
function requireMail() {
  if (!mailAvailable()) throw new HttpError(503, 'mail_unavailable', '계정 메일이 준비되지 않았습니다. 운영자에게 문의해 주세요.');
}

function writeOutbox({ kind, email, url, expiresAt, id }) {
  const outbox = path.join(config.dataDir, 'outbox');
  mkdirSync(outbox, { recursive: true, mode: 0o700 });
  const file = path.join(outbox, `${id}.json`);
  writeFileSync(file, JSON.stringify({ to: email, kind, url, expiresAt: new Date(expiresAt).toISOString() }) + '\n', { flag: 'wx', mode: 0o600 });
  return file;
}

function issueLink(d, { kind, email, workspaceId = null, role = null }) {
  requireMail();
  const id = newId('mail');
  const raw = token();
  const now = nowIso();
  const expiresAt = Date.now() + ({ reset: 30 * 60_000, verify: DAY, invite: 7 * DAY })[kind];
  d.prepare(`UPDATE account_links SET used_at = ?
    WHERE kind = ? AND email = ? AND workspace_id IS ? AND used_at IS NULL`).run(now, kind, email, workspaceId);
  d.prepare(`INSERT INTO account_links(token_hash, kind, email, workspace_id, role, expires_at, created_at, id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(digest(raw), kind, email, workspaceId, role, expiresAt, now, id);
  const route = { verify: `/verify?token=${raw}`, reset: `/password/reset?token=${raw}`, invite: `/invite/${raw}` }[kind];
  const base = config.publicBaseUrl || `http://localhost:${config.port}`;
  return writeOutbox({ kind, email, url: `${base}/#${route}`, expiresAt, id });
}

function readLink(d, kind, raw) {
  const invalid = () => new HttpError(400, 'invalid_link', '링크가 만료되었거나 이미 사용되었습니다. 새 링크를 요청해 주세요.');
  if (typeof raw !== 'string' || !TOKEN_RE.test(raw)) throw invalid();
  const link = d.prepare(`SELECT * FROM account_links WHERE token_hash = ? AND kind = ?
    AND expires_at > ? AND used_at IS NULL`).get(digest(raw), kind, Date.now());
  if (!link) throw invalid();
  return link;
}

function consumeLink(d, link) {
  d.prepare('UPDATE account_links SET used_at = ? WHERE id = ?').run(nowIso(), link.id);
}

function userSignupFields(body) {
  if (body.agreeTerms !== true || body.agreePrivacy !== true) {
    throw new HttpError(400, 'consent_required', '이용약관과 개인정보 처리방침에 동의해 주세요.');
  }
  return {
    name: requiredText(body.name, 50, 'bad_name', '이름을 50자 이내로 적어 주세요.'),
    password: passwordValid(body.password),
  };
}

function addUser(d, { email, name, hash, verifiedAt = null }) {
  const id = newId('user');
  const now = nowIso();
  d.prepare(`INSERT INTO users(id, email, name, password_hash, verified_at, terms_version, consent_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, email, name, hash, verifiedAt, POLICY_VERSION, now, now);
  return id;
}

export async function signup(body) {
  requireMail();
  const email = emailAddress(body.email);
  const { name, password } = userSignupFields(body);
  const hash = await passwordHash(password);
  let file;
  try {
    accountTransaction((d) => {
      const existing = d.prepare('SELECT id, verified_at FROM users WHERE email = ?').get(email);
      if (!existing) {
        addUser(d, { email, name, hash });
        file = issueLink(d, { kind: 'verify', email });
      }
    });
  } catch (err) {
    if (file) rmSync(file, { force: true });
    throw err;
  }
  return { ok: true };
}

export function resendVerification(body) {
  return sendUserLink(emailAddress(body.email), 'verify');
}
export function requestReset(body) {
  return sendUserLink(emailAddress(body.email), 'reset');
}
function sendUserLink(email, kind) {
  requireMail();
  let file;
  try {
    accountTransaction((d) => {
      const user = d.prepare('SELECT verified_at FROM users WHERE email = ?').get(email);
      if (user && Boolean(user.verified_at) === (kind === 'reset')) file = issueLink(d, { kind, email });
    });
  } catch (err) {
    if (file) rmSync(file, { force: true });
    throw err;
  }
  return { ok: true };
}

function activateLegacyOwner(d, email) {
  if (process.env.LEGACY_WORKSPACE_OWNER_EMAIL?.trim().toLowerCase() !== email) return;
  const user = d.prepare('SELECT id FROM users WHERE email = ? AND verified_at IS NOT NULL').get(email);
  if (!user) return;
  const now = nowIso();
  d.prepare('INSERT OR IGNORE INTO workspaces(id, name, created_at) VALUES (?, ?, ?)').run(LEGACY_WORKSPACE_ID, '이전 워크스페이스', now);
  d.prepare('INSERT OR IGNORE INTO memberships(workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
    .run(LEGACY_WORKSPACE_ID, user.id, 'admin', now);
}

export async function verify(body) {
  readLink(accountDb(), 'verify', body.token);
  const hash = await passwordHash(passwordValid(body.password));
  accountTransaction((d) => {
    const link = readLink(d, 'verify', body.token);
    // 메일을 받은 사람이 로그인 암호를 최종 확정한다.
    const user = d.prepare(`UPDATE users SET verified_at = ?, password_hash = ?, failed_logins = 0, locked_until = 0
      WHERE email = ? AND verified_at IS NULL RETURNING id`).get(nowIso(), hash, link.email);
    if (!user) throw new HttpError(400, 'invalid_link', '인증 링크를 다시 요청해 주세요.');
    d.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    activateLegacyOwner(d, link.email);
    consumeLink(d, link);
  });
  return { ok: true };
}

export async function resetPassword(body) {
  const hash = await passwordHash(passwordValid(body.password));
  accountTransaction((d) => {
    const link = readLink(d, 'reset', body.token);
    const user = d.prepare('SELECT id FROM users WHERE email = ? AND verified_at IS NOT NULL').get(link.email);
    if (!user) throw new HttpError(400, 'invalid_link', '링크를 사용할 수 없습니다.');
    d.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = 0 WHERE id = ?').run(hash, user.id);
    d.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    consumeLink(d, link);
  });
  return { ok: true };
}

export function createWorkspace(req, body) {
  const info = accountSession(req);
  const name = requiredText(body.name, 80, 'bad_workspace_name', '워크스페이스 이름을 80자 이내로 적어 주세요.');
  const id = newId('ws');
  const created = nowIso();
  accountTransaction((d) => {
    if (listMemberships(info.row.id).length >= 20) throw new HttpError(400, 'workspace_limit', '한 계정에 워크스페이스를 20개까지 연결할 수 있습니다.');
    d.prepare('INSERT INTO workspaces(id, name, created_at) VALUES (?, ?, ?)').run(id, name, created);
    d.prepare('INSERT INTO memberships(workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
      .run(id, info.row.id, 'admin', created);
    d.prepare('UPDATE sessions SET workspace_id = ? WHERE token_hash = ?').run(id, info.id);
  });
  return me(req);
}

export function switchWorkspace(req, body) {
  const info = accountSession(req);
  if (!listMemberships(info.row.id).some((w) => w.id === body.workspaceId)) {
    throw new HttpError(403, 'permission_denied', '이 워크스페이스를 사용할 권한이 없습니다.');
  }
  accountDb().prepare('UPDATE sessions SET workspace_id = ? WHERE token_hash = ?').run(body.workspaceId, info.id);
  return me(req);
}

export function updateProfile(req, body) {
  const { row } = accountSession(req);
  const name = requiredText(body.name, 50, 'bad_name', '이름을 50자 이내로 적어 주세요.');
  const phone = optionalText(body.phone, 30, 'bad_phone', '연락처를 30자 이내로 적어 주세요.');
  accountDb().prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, row.id);
  return me(req);
}

export async function changePassword(req, body) {
  const { row, id } = accountSession(req);
  const matches = await passwordMatches(body.currentPassword, row.password_hash);
  if (!matches) throw new HttpError(400, 'wrong_password', '현재 비밀번호를 확인해 주세요.');
  const hash = await passwordHash(passwordValid(body.password));
  accountTransaction((d) => {
    const changed = d.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?').run(hash, row.id, row.password_hash).changes;
    if (!changed) throw new HttpError(409, 'password_changed', '비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
    d.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(row.id, id);
  });
  return { ok: true };
}

export function updatePreferences(req, body) {
  const { row } = accountSession(req);
  if ('bigText' in body && typeof body.bigText !== 'boolean') throw new HttpError(400, 'bad_preferences', '글씨 설정을 확인해 주세요.');
  const prefs = { ...defaultNotifications, ...parseJson(row.notifications, {}) };
  if (body.notifications != null) {
    if (typeof body.notifications !== 'object' || Array.isArray(body.notifications)) {
      throw new HttpError(400, 'bad_preferences', '알림 설정을 확인해 주세요.');
    }
    for (const [key, value] of Object.entries(body.notifications)) {
      if (!Object.hasOwn(defaultNotifications, key) || typeof value !== 'boolean') throw new HttpError(400, 'bad_preferences', '알림 설정을 확인해 주세요.');
      prefs[key] = value;
    }
  }
  accountDb().prepare('UPDATE users SET big_text = ?, notifications = ? WHERE id = ?')
    .run(Number(body.bigText ?? row.big_text), JSON.stringify(prefs), row.id);
  return me(req);
}

function requireWorkspaceAdmin() {
  const access = requireRole('admin');
  if (access.demo || access.machine) throw new HttpError(403, 'account_required', '계정 워크스페이스에서 설정해 주세요.');
  return access;
}

export function updateWorkspace(body) {
  const { workspace } = requireWorkspaceAdmin();
  const name = requiredText(body.name, 80, 'bad_workspace_name', '워크스페이스 이름을 80자 이내로 적어 주세요.');
  const phone = optionalText(body.phone, 30, 'bad_phone', '대표 번호를 30자 이내로 적어 주세요.');
  const hours = optionalText(body.hours, 120, 'bad_hours', '영업시간을 120자 이내로 적어 주세요.');
  accountDb().prepare('UPDATE workspaces SET name = ?, phone = ?, hours = ? WHERE id = ?').run(name, phone, hours, workspace.id);
  return { workspace: { ...workspace, name, phone, hours } };
}

function normalizeRole(role) {
  if (!ROLES.includes(role)) throw new HttpError(400, 'bad_role', '구성원 역할을 선택해 주세요.');
  return role;
}

export function listMembers() {
  const { workspace } = requireWorkspaceAdmin();
  const d = accountDb();
  const members = d.prepare(`SELECT u.id, u.name, u.email, m.role, m.active, m.created_at FROM memberships m
    JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY u.name, u.id`).all(workspace.id);
  const invites = d.prepare(`SELECT id, email, role, expires_at, created_at FROM account_links WHERE kind = 'invite'
    AND workspace_id = ? AND used_at IS NULL ORDER BY created_at DESC`).all(workspace.id);
  return {
    members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, active: Boolean(m.active), createdAt: m.created_at })),
    invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, expired: i.expires_at <= Date.now(), expiresAt: new Date(i.expires_at).toISOString() })),
  };
}

export function changeMember(userId, body) {
  const { workspace } = requireWorkspaceAdmin();
  const next = accountTransaction((d) => {
    const member = d.prepare('SELECT role, active FROM memberships WHERE workspace_id = ? AND user_id = ?').get(workspace.id, userId);
    if (!member) throw new HttpError(404, 'not_found', '없는 구성원입니다.');
    const role = 'role' in body ? normalizeRole(body.role) : member.role;
    if ('active' in body && typeof body.active !== 'boolean') throw new HttpError(400, 'bad_active', '구성원 상태를 확인해 주세요.');
    const active = body.active ?? Boolean(member.active);
    if (member.active && member.role === 'admin' && (!active || role !== 'admin')) {
      const other = d.prepare(`SELECT 1 FROM memberships WHERE workspace_id = ? AND role = 'admin'
        AND active = 1 AND user_id <> ?`).get(workspace.id, userId);
      if (!other) throw new HttpError(409, 'last_admin', '워크스페이스에 관리자가 한 명 이상 필요합니다.');
    }
    d.prepare('UPDATE memberships SET role = ?, active = ? WHERE workspace_id = ? AND user_id = ?')
      .run(role, Number(active), workspace.id, userId);
    if (!active) {
      d.prepare('UPDATE sessions SET workspace_id = NULL WHERE user_id = ? AND workspace_id = ?').run(userId, workspace.id);
      d.prepare(`UPDATE account_links SET used_at = ? WHERE kind = 'invite' AND workspace_id = ?
        AND email = (SELECT email FROM users WHERE id = ?) AND used_at IS NULL`).run(nowIso(), workspace.id, userId);
    }
    return { member, role, active };
  });
  recordAudit({ entity: 'membership', entityId: userId, action: 'update', before: next.member, after: { role: next.role, active: next.active } });
  return { ok: true, role: next.role, active: next.active };
}

export function inviteMember(body, inviteId = null) {
  const { workspace } = requireWorkspaceAdmin();
  let file;
  try {
    accountTransaction((d) => {
      const existing = inviteId ? d.prepare(`SELECT email, role FROM account_links WHERE id = ? AND workspace_id = ?
        AND kind = 'invite' AND used_at IS NULL`).get(inviteId, workspace.id) : null;
      if (inviteId && !existing) throw new HttpError(404, 'not_found', '보낼 초대가 없습니다.');
      const email = existing?.email ?? emailAddress(body.email);
      const role = existing?.role ?? normalizeRole(body.role);
      if (d.prepare(`SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.workspace_id = ? AND u.email = ?`).get(workspace.id, email)) {
        throw new HttpError(409, 'already_member', '구성원 목록에서 이 계정의 역할이나 상태를 변경해 주세요.');
      }
      file = issueLink(d, { kind: 'invite', email, role, workspaceId: workspace.id });
    });
  } catch (err) {
    if (file) rmSync(file, { force: true });
    throw err;
  }
  return { ok: true };
}

export function cancelInvite(id) {
  const { workspace } = requireWorkspaceAdmin();
  const r = accountDb().prepare(`UPDATE account_links SET used_at = ? WHERE id = ? AND workspace_id = ?
    AND kind = 'invite' AND used_at IS NULL`).run(nowIso(), id, workspace.id);
  if (!r.changes) throw new HttpError(404, 'not_found', '취소할 초대가 없습니다.');
  return { ok: true };
}

export function inviteInfo(raw) {
  const d = accountDb();
  const invite = readLink(d, 'invite', raw);
  return {
    email: invite.email, role: invite.role,
    workspace: d.prepare('SELECT name FROM workspaces WHERE id = ?').get(invite.workspace_id).name,
    existingAccount: Boolean(d.prepare('SELECT 1 FROM users WHERE email = ?').get(invite.email)),
  };
}

export async function acceptInvite(req, body) {
  const d = accountDb();
  const initial = readLink(d, 'invite', body.token);
  const info = sessionInfo(req);
  const existing = d.prepare('SELECT id FROM users WHERE email = ?').get(initial.email);
  if (info && !existing) throw new HttpError(409, 'other_account_signed_in', '현재 계정에서 로그아웃한 뒤 초대를 수락해 주세요.');
  if (existing && (!info || info.row.id !== existing.id)) {
    throw new HttpError(401, 'invited_account_required', '초대받은 이메일로 로그인한 뒤 이 링크를 다시 열어 주세요.');
  }
  const fields = existing ? null : userSignupFields(body);
  const hash = fields ? await passwordHash(fields.password) : null;
  return accountTransaction((d) => {
    const link = readLink(d, 'invite', body.token);
    const user = d.prepare('SELECT id FROM users WHERE email = ?').get(link.email);
    if (user && (!info || user.id !== info.row.id || !sessionInfo(req))) {
      throw new HttpError(401, 'invited_account_required', '초대받은 이메일로 로그인한 뒤 이 링크를 다시 열어 주세요.');
    }
    const userId = user?.id ?? addUser(d, { email: link.email, name: fields.name, hash, verifiedAt: nowIso() });
    activateLegacyOwner(d, link.email);
    d.prepare(`INSERT OR IGNORE INTO memberships(workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`)
      .run(link.workspace_id, userId, link.role, nowIso());
    consumeLink(d, link);
    if (info) d.prepare('UPDATE sessions SET workspace_id = ? WHERE token_hash = ?').run(link.workspace_id, info.id);
    return { ok: true, signedIn: Boolean(info) };
  });
}

function currentWorkspaceRow() {
  const id = workspaceContext()?.workspace.id;
  return id && id !== DEMO_WORKSPACE_ID ? accountDb().prepare('SELECT * FROM workspaces WHERE id = ?').get(id) : null;
}

export function aiModeForWorkspace() {
  const access = workspaceContext();
  if (!access || access.demo) return 'configured';
  return currentWorkspaceRow()?.ai_mode ?? 'off';
}

export function integrationSettings() {
  requireWorkspaceAdmin();
  const w = currentWorkspaceRow();
  return { aiMode: w.ai_mode, ingestConfigured: Boolean(w.ingest_hash), ingestRotatedAt: w.ingest_rotated_at };
}

export function updateAiSettings(body) {
  const { workspace } = requireWorkspaceAdmin();
  if (!['off', 'masked', 'configured'].includes(body.aiMode)) throw new HttpError(400, 'bad_ai_mode', 'AI 처리 범위를 선택해 주세요.');
  accountDb().prepare('UPDATE workspaces SET ai_mode = ? WHERE id = ?').run(body.aiMode, workspace.id);
  return integrationSettings();
}

export function rotateIngestToken(revoke = false) {
  const { workspace } = requireWorkspaceAdmin();
  const raw = revoke ? null : `ah_ingest_${token()}`;
  accountDb().prepare('UPDATE workspaces SET ingest_hash = ?, ingest_rotated_at = ? WHERE id = ?')
    .run(raw ? digest(raw) : null, nowIso(), workspace.id);
  return { ...integrationSettings(), ...(raw ? { token: raw } : {}) };
}

export function updateRetention(body) {
  const { workspace } = requireWorkspaceAdmin();
  if (!Number.isInteger(body.retentionDays) || body.retentionDays < 1 || body.retentionDays > 3650) {
    throw new HttpError(400, 'bad_retention', '보관 기간을 1일에서 3650일 사이로 정해 주세요.');
  }
  accountDb().prepare('UPDATE workspaces SET retention_days = ? WHERE id = ?').run(body.retentionDays, workspace.id);
  return { retentionDays: body.retentionDays };
}

export function machineWorkspace(id) {
  if (id === DEMO_WORKSPACE_ID && config.demoMode) return { ...DEMO_ACCESS, machine: true };
  const row = accountDb().prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  if (row) return { workspace: workspaceView(row), user: null, role: 'admin', demo: false, machine: true };
  if (id === LEGACY_WORKSPACE_ID && !config.demoMode) {
    return { workspace: { id, name: '이전 워크스페이스' }, user: null, role: 'admin', demo: false, machine: true };
  }
  throw new HttpError(503, 'workspace_unavailable', '연결된 워크스페이스를 찾을 수 없습니다.');
}

export function workerAccess(req) {
  requireBearer(req, 'WORKER_TOKEN');
  const id = process.env.WORKER_WORKSPACE_ID?.trim() || defaultWorkspaceId();
  if (id !== DEMO_WORKSPACE_ID && id !== LEGACY_WORKSPACE_ID && !NEW_WS_RE.test(id)) {
    throw new HttpError(503, 'workspace_unavailable', '받아쓰기 연결을 확인해 주세요.');
  }
  return machineWorkspace(id);
}

export function ingestAccess(req) {
  const raw = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization ?? ''))?.[1]?.trim() ?? '';
  if (raw.startsWith('ah_ingest_') && TOKEN_RE.test(raw.slice(10))) {
    const row = accountDb().prepare('SELECT * FROM workspaces WHERE ingest_hash = ?').get(digest(raw));
    if (row) return machineWorkspace(row.id);
    throw new HttpError(401, 'unauthorized', '녹음 연결을 확인해 주세요.');
  }
  if (hasSecret('INGEST_TOKEN')) {
    requireBearer(req, 'INGEST_TOKEN');
    return machineWorkspace(defaultWorkspaceId());
  }
  if (!raw) throw new HttpError(503, 'disabled', '녹음 연결용 토큰이 필요합니다.');
  throw new HttpError(401, 'unauthorized', '녹음 연결을 확인해 주세요.');
}

export function forEachWorkspace(callback, onError) {
  const ids = new Set([defaultWorkspaceId(), ...accountDb().prepare('SELECT id FROM workspaces').all().map((r) => r.id)]);
  for (const id of ids) {
    try { withWorkspace(machineWorkspace(id), callback); }
    catch (err) { onError(err); }
  }
}
