// 통화 목록 · 찾기(F08) · 상세 · 오디오(Range) · 거래처별 모아 보기(F13) · 관리자 지우기. [C]
import { statSync, realpathSync, createReadStream, rmSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { dataDir, db, tx, parseJson } from '../lib/db.mjs';
import { HttpError, cleanText } from '../lib/http.mjs';
import { requireAdmin, kstDay } from '../lib/security.mjs';
import { CALL_TYPES, callView, getCallRow, maskPhone, isShipTarget } from '../lib/repo.mjs';
import { enqueue } from '../lib/jobs.mjs';
import { registerDueSort } from '../lib/due-sort.mjs';
import { purgeCallReferences } from '../lib/call-retention.mjs';
import { recordAudit, requestAccess, requireRole } from '../lib/auth.mjs';

// ── 함께 쓰는 도구(insights.mjs 도 쓴다) ─────────────────────────────

/** 카드 거래처가 있으면 그것, 없으면 통화 거래처. (c = calls, k = cards) */
export const EFF_CUSTOMER = "COALESCE(NULLIF(TRIM(k.customer), ''), NULLIF(TRIM(c.customer), ''))";

/** JSON 배열 칸 길이(깨졌으면 0) */
export const jsonLen = (col) => `json_array_length(CASE WHEN json_valid(${col}) THEN ${col} ELSE '[]' END)`;

/** LIKE 낱말 이스케이프. ESCAPE '!' 와 같이 쓴다. */
export function likePattern(term) {
  return '%' + String(term).replace(/[!%_]/g, (ch) => '!' + ch) + '%';
}

/** 'YYYY-MM-DD'(KST) 를 확인한다. 비었으면 fallback, 틀리면 400. */
export function parseDay(value, { fallback = kstDay(), name = '날짜' } = {}) {
  if (value == null || String(value).trim() === '') return fallback;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'bad_date', `${name}는 2026-11-11 처럼 써 주세요.`);
  const t = Date.parse(`${s}T00:00:00+09:00`);
  if (!Number.isFinite(t) || kstDay(new Date(t)) !== s) throw new HttpError(400, 'bad_date', `${name}가 올바르지 않습니다.`);
  return s;
}

/** KST 하루 → [시작 ISO, 다음날 시작 ISO) (UTC 로 저장된 recorded_at 과 문자열 비교) */
export function kstDayRange(day) {
  const start = Date.parse(`${day}T00:00:00+09:00`);
  return [new Date(start).toISOString(), new Date(start + 86_400_000).toISOString()];
}

/** KST 날짜 + n 일 */
export function addDays(day, n) {
  const t = Date.parse(`${day}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** ISO → 'YYYY-MM-DD HH:MM'(KST) */
export function kstDateTime(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
}

/** 부품 줄 → '앞범퍼(좌)x2, 백미러x1' (unit '개' 면 '앞범퍼(좌) 2개', partNo 면 품번도) */
export function itemsText(items, { unit = 'x', partNo = false } = {}) {
  const list = Array.isArray(items) ? items.filter((i) => i && (i.part || i.partNo || i.part_no)) : [];
  if (!list.length) return '';
  return list.map((i) => {
    const name = (i.part || '부품') + (i.side ? `(${i.side})` : '');
    const qty = i.qty == null || i.qty === '' ? '?' : i.qty;
    const pn = partNo && (i.partNo || i.part_no) ? ` 품번 ${i.partNo || i.part_no}` : '';
    return (unit === '개' ? `${name} ${qty}개` : `${name}x${qty}`) + pn;
  }).join(', ');
}

/** 사전 거래처 + 통화에 나온 거래처 이름(중복 없음) */
export function knownCustomerNames() {
  const d = db();
  const names = new Set();
  for (const r of d.prepare("SELECT term FROM glossary WHERE kind = '거래처' AND status = 'approved'").all()) {
    const n = cleanText(r.term, 100);
    if (n) names.add(n);
  }
  for (const r of d.prepare(`SELECT DISTINCT ${EFF_CUSTOMER} AS name FROM calls c LEFT JOIN cards k ON k.call_id = c.id`).all()) {
    const n = cleanText(r.name, 100);
    if (n) names.add(n);
  }
  return [...names];
}

/** 문장들에서 낱말이 든 것 최대 max 개 → [{segIndex, at, text}] (문장이 없으면 글을 나눠 segIndex·at 은 null) */
export function findMatches(segments, transcript, terms, max = 3) {
  const lower = terms.map((t) => String(t).toLowerCase()).filter(Boolean);
  if (!lower.length) return [];
  const hits = [];
  const segs = Array.isArray(segments) ? segments : [];
  if (segs.length) {
    segs.forEach((s, i) => {
      const text = String(s?.text ?? '');
      const lt = text.toLowerCase();
      const n = lower.filter((t) => lt.includes(t)).length;
      if (n) hits.push({ order: i, n, m: { segIndex: i, at: Number.isFinite(Number(s?.start)) ? Number(s.start) : null, text: text.slice(0, 300) } });
    });
  } else if (transcript) {
    String(transcript).split(/(?<=[.?!。])\s+|\n+/).map((x) => x.trim()).filter(Boolean).forEach((text, i) => {
      const lt = text.toLowerCase();
      const n = lower.filter((t) => lt.includes(t)).length;
      if (n) hits.push({ order: i, n, m: { segIndex: null, at: null, text: text.slice(0, 300) } });
    });
  }
  return hits.sort((a, b) => b.n - a.n || a.order - b.order).slice(0, max).sort((a, b) => a.order - b.order).map((h) => h.m);
}

// ── 목록 · 찾기 ────────────────────────────────────────────────────

const CARD_STATUSES = ['draft', 'confirmed', 'shipped', 'cancelled'];
const LIST_STATUSES = [...CARD_STATUSES, 'callback', 'working', 'failed', 'all'];

/** 다시 전화할 곳: 표시했거나, 확인 필요인데 되물을 것이 남은 카드 (대시보드 숫자와 같은 뜻) */
export const CALLBACK_SQL = `(k.callback = 1 OR (k.status = 'draft' AND ${jsonLen('k.ask_back')} > 0))`;

function searchClause(term) {
  const p = likePattern(term);
  const cols = ['c.transcript', 'c.title', 'c.customer', 'c.summary', 'k.customer', 'k.contact', 'k.car_model', 'k.model_year', 'k.plate', 'k.note', 'k.due', 'k.delivery', 'k.call_type'];
  const parts = cols.map((col) => `${col} LIKE ? ESCAPE '!'`);
  // 부품 줄은 JSON 이라 열쇠 이름(part, qty …)에 걸리지 않게 값만 본다
  parts.push(`EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(k.items) THEN k.items ELSE '[]' END) j
    WHERE (COALESCE(json_extract(k.items, j.fullkey || '.part'), '') || ' ' || COALESCE(json_extract(k.items, j.fullkey || '.side'), '') || ' ' ||
           COALESCE(json_extract(k.items, j.fullkey || '.partNo'), '') || ' ' || COALESCE(json_extract(k.items, j.fullkey || '.part_no'), '')) LIKE ? ESCAPE '!')`);
  return { sql: '(' + parts.join(' OR ') + ')', args: parts.map(() => p) };
}

function intParam(v, def, min, max) {
  const n = Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export function listCalls(query = {}) {
  const where = [];
  const args = [];

  const q = cleanText(query.q, 100);
  const terms = q ? [...new Set(q.split(/\s+/).filter(Boolean))].slice(0, 8) : [];
  for (const t of terms) {
    const c = searchClause(t);
    where.push(c.sql);
    args.push(...c.args);
  }

  const status = cleanText(query.status ?? query.cardStatus, 20) || 'all';
  if (!LIST_STATUSES.includes(status)) throw new HttpError(400, 'bad_status', '상태 값이 올바르지 않습니다.');
  if (CARD_STATUSES.includes(status)) { where.push('k.status = ?'); args.push(status); }
  else if (status === 'callback') where.push(CALLBACK_SQL);
  else if (status === 'working') where.push("c.status IN ('queued', 'transcribing', 'extracting')");
  else if (status === 'failed') where.push("c.status = 'failed'");

  if (query.from) { where.push('c.recorded_at >= ?'); args.push(kstDayRange(parseDay(query.from, { name: '시작 날짜' }))[0]); }
  if (query.to) { where.push('c.recorded_at < ?'); args.push(kstDayRange(parseDay(query.to, { name: '끝 날짜' }))[1]); }

  const customer = cleanText(query.customer, 100);
  if (customer) { where.push(`${EFF_CUSTOMER} = ?`); args.push(customer); }

  const callType = cleanText(query.callType, 30);
  if (callType) {
    if (!CALL_TYPES.includes(callType)) throw new HttpError(400, 'bad_call_type', '통화 종류가 올바르지 않습니다.');
    where.push('k.call_type = ?');
    args.push(callType);
  }
  if (query.callback !== undefined && query.callback !== '') {
    const flag = String(query.callback);
    if (!['true', 'false', '1', '0'].includes(flag)) throw new HttpError(400, 'bad_callback', '재연락 조건이 올바르지 않습니다.');
    where.push('COALESCE(k.callback, 0) = ?');
    args.push(flag === 'true' || flag === '1' ? 1 : 0);
  }

  const orders = {
    board: status === 'shipped' ? 'COALESCE(k.shipped_at, k.updated_at) DESC, ' : 'k.urgent DESC, ',
    due: "NULLIF(TRIM(k.due), '') IS NULL, k.due, ",
    dueDate: "ahcha_due_sort_v1(k.due, c.recorded_at) IS NULL, ahcha_due_sort_v1(k.due, c.recorded_at) COLLATE BINARY, ",
    customer: EFF_CUSTOMER + ' IS NULL, ' + EFF_CUSTOMER + ', ',
  };
  const sort = cleanText(query.sort, 20);
  if (sort && !Object.hasOwn(orders, sort)) throw new HttpError(400, 'bad_sort', '정렬 기준이 올바르지 않습니다.');
  const orderBy = (sort ? orders[sort] : '') + 'c.recorded_at DESC, c.id DESC';
  const limit = intParam(query.limit, 30, 1, 200);
  const offset = intParam(query.offset, 0, 0, 1_000_000);
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const from = 'FROM calls c LEFT JOIN cards k ON k.call_id = c.id';

  const d = db();
  if (sort === 'dueDate') registerDueSort(d);
  const total = d.prepare(`SELECT COUNT(*) AS n ${from} ${whereSql}`).get(...args).n;
  const rows = d.prepare(`SELECT c.* ${from} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const calls = rows.map((row) => {
    const view = callView(row);
    if (terms.length) view.matches = findMatches(parseJson(row.segments, []), row.transcript, terms);
    return view;
  });
  const out = { calls, total, limit, offset };
  if (terms.length) out.terms = terms;
  return out;
}

// ── 오디오 ────────────────────────────────────────────────────────

let audioModPromise = null;
/** A 의 lib/audio.mjs (없거나 깨졌으면 null) */
function audioModule() {
  audioModPromise ??= import('../lib/audio.mjs').catch(() => null);
  return audioModPromise;
}

const audioDir = () => path.resolve(dataDir(), 'audio');
function isInside(dir, file) {
  const rel = path.relative(dir, file);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** calls.audio_file(DATA_DIR 기준 상대 경로) → 절대 경로. DATA_DIR/audio 밖이면 400. */
export async function resolveAudioFile(rel) {
  const own = path.resolve(dataDir(), String(rel));
  if (!isInside(audioDir(), own)) throw new HttpError(400, 'bad_audio_path', '녹음 파일 위치가 올바르지 않습니다.');
  const mod = await audioModule();
  if (typeof mod?.audioPath === 'function') {
    try {
      const p = path.resolve(mod.audioPath(rel));
      if (isInside(audioDir(), p) && existsSync(p)) return p;
    } catch { /* 아래 기본 경로 */ }
  }
  return own;
}

/** Range: bytes=a-b 하나만 받는다. 이상한 값은 무시(전체), 범위 밖이면 'unsatisfiable' */
export function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    const n = Number(m[2]);
    if (n === 0) return 'unsatisfiable';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    if (m[2] !== '' && Number(m[2]) < start) return null;
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (size === 0 || start >= size) return 'unsatisfiable';
  return { start, end };
}

async function sendAudio({ req, res, params, query }) {
  const row = getCallRow(params.id);
  if (!row) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
  if (!row.audio_file) throw new HttpError(404, 'no_audio', '이 통화는 녹음 파일이 없습니다.');
  const file = await resolveAudioFile(row.audio_file);
  let st;
  try { st = statSync(file); } catch { st = null; }
  if (!st || !st.isFile()) throw new HttpError(404, 'no_audio', '녹음 파일을 찾지 못했습니다.');

  const size = st.size;
  const headers = { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
  if (query.download === '1') {
    const safeId = String(row.id).replace(/[^A-Za-z0-9_-]/g, '');
    headers['Content-Disposition'] = `attachment; filename="ahmatda-${row.is_fake ? 'fake-' : ''}${safeId}.wav"`;
  }
  const range = parseRange(req.headers.range, size);
  if (range === 'unsatisfiable') {
    res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
    res.end();
    return undefined;
  }
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range) {
    ({ start, end } = range);
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = size === 0 ? 0 : end - start + 1;
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || size === 0) { res.end(); return undefined; }
  // 듣다가 끊으면 오류가 나지만 할 일이 없다
  await pipeline(createReadStream(file, { start, end }), res).catch(() => {});
  return undefined;
}

// ── 거래처 ───────────────────────────────────────────────────────

function glossaryCustomers() {
  const map = new Map();
  for (const r of db().prepare("SELECT term, phone FROM glossary WHERE kind = '거래처' AND status = 'approved' ORDER BY updated_at DESC").all()) {
    const name = cleanText(r.term, 100);
    if (name && !map.has(name)) map.set(name, { phone: r.phone || null });
  }
  return map;
}

// isShipTarget와 같은 조건. JS item.part의 truthiness를 JSON 타입별로 보존한다.
// 집계는 SQL에서 유지해 카드마다 별도 조회하지 않는다.
const CUSTOMER_SHIP_TARGET = `COALESCE(NULLIF(k.call_type, ''), '주문') IN ('주문', '반품·교환')
  AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(k.items) THEN k.items ELSE '[]' END) j
    WHERE CASE WHEN j.type = 'object' THEN CASE json_type(j.value, '$.part')
      WHEN 'text' THEN length(json_extract(j.value, '$.part')) > 0
      WHEN 'integer' THEN json_extract(j.value, '$.part') != 0
      WHEN 'real' THEN json_extract(j.value, '$.part') != 0
      WHEN 'true' THEN 1 WHEN 'array' THEN 1 WHEN 'object' THEN 1 ELSE 0 END ELSE 0 END)`;

export function listCustomers() {
  const d = db();
  const gl = glossaryCustomers();
  const agg = d.prepare(`SELECT ${EFF_CUSTOMER} AS name, COUNT(*) AS calls, MAX(c.recorded_at) AS lastAt,
      SUM(CASE WHEN k.status = 'draft' OR (k.status = 'confirmed' AND ${CUSTOMER_SHIP_TARGET}) THEN 1 ELSE 0 END) AS openCards
    FROM calls c LEFT JOIN cards k ON k.call_id = c.id
    WHERE ${EFF_CUSTOMER} IS NOT NULL GROUP BY name`).all();
  // 사전에 번호가 없으면 마지막으로 걸려 온 번호(가려서)
  const lastNumber = new Map();
  for (const r of d.prepare(`SELECT ${EFF_CUSTOMER} AS name, c.caller_number AS num FROM calls c LEFT JOIN cards k ON k.call_id = c.id
      WHERE c.caller_number IS NOT NULL AND c.caller_number != '' ORDER BY c.recorded_at DESC`).all()) {
    if (r.name && !lastNumber.has(r.name)) lastNumber.set(r.name, r.num);
  }
  const byName = new Map();
  for (const [name, g] of gl) byName.set(name, { name, phone: maskPhone(g.phone), calls: 0, lastAt: null, openCards: 0, inGlossary: true });
  for (const r of agg) {
    const name = cleanText(r.name, 100);
    if (!name) continue;
    const cur = byName.get(name) || { name, phone: maskPhone(lastNumber.get(r.name)), calls: 0, lastAt: null, openCards: 0, inGlossary: false };
    cur.calls += Number(r.calls) || 0;
    cur.openCards += Number(r.openCards) || 0;
    if (!cur.lastAt || (r.lastAt && r.lastAt > cur.lastAt)) cur.lastAt = r.lastAt || cur.lastAt;
    if (!cur.phone && lastNumber.get(r.name)) cur.phone = maskPhone(lastNumber.get(r.name));
    byName.set(name, cur);
  }
  const customers = [...byName.values()].sort((a, b) => {
    if (a.lastAt && b.lastAt && a.lastAt !== b.lastAt) return a.lastAt < b.lastAt ? 1 : -1;
    if (a.lastAt && !b.lastAt) return -1;
    if (!a.lastAt && b.lastAt) return 1;
    return a.name.localeCompare(b.name, 'ko');
  });
  return { customers };
}

export function customerDetail(rawName) {
  const name = cleanText(rawName, 100);
  if (!name) throw new HttpError(400, 'bad_name', '거래처 이름이 비었습니다.');
  const g = glossaryCustomers().get(name);
  const rows = db().prepare(`SELECT c.* FROM calls c LEFT JOIN cards k ON k.call_id = c.id
    WHERE ${EFF_CUSTOMER} = ? ORDER BY c.recorded_at DESC, c.id DESC LIMIT 500`).all(name);
  if (!g && !rows.length) throw new HttpError(404, 'not_found', '그 거래처를 찾지 못했습니다.');
  const calls = rows.map((r) => callView(r));
  const lastNum = rows.find((r) => r.caller_number)?.caller_number;
  return {
    customer: {
      name,
      phone: maskPhone(g?.phone || lastNum || null),
      inGlossary: Boolean(g),
      calls: calls.length,
      openCards: calls.filter((c) => c.card && (c.card.status === 'draft' || (c.card.status === 'confirmed' && isShipTarget(c.card)))).length,
    },
    calls,
  };
}

// ── 지우기(관리자) ────────────────────────────────────────────────

export function deleteCall(id) {
  const row = getCallRow(id);
  if (!row) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
  tx((d) => {
    purgeCallReferences(d, [id]);
    d.prepare('DELETE FROM calls WHERE id = ?').run(id);
    recordAudit({ entity: 'call', entityId: id, action: 'delete' });
  });
  let audioDeleted = false;
  if (row.audio_file && !db().prepare('SELECT 1 FROM calls WHERE audio_file = ? LIMIT 1').get(row.audio_file)) {
    const f = path.resolve(dataDir(), String(row.audio_file));
    if (isInside(audioDir(), f)) {
      try { if (existsSync(f)) { rmSync(f, { force: true }); audioDeleted = true; } } catch { /* 파일은 남아도 DB 는 지워졌다 */ }
    }
  }
  return { ok: true, id, audioDeleted };
}

// ── 주소 달기 ─────────────────────────────────────────────────────

/** 저장된 녹음으로 실패한 받아쓰기만 재시도한다. 가짜/실제 녹음 모두 기존 일감 경로를 따른다. */
export function retryTranscription(id) {
  requireRole('admin', 'reception');
  return tx((d) => {
    const row = getCallRow(id);
    if (!row) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
    if (row.transcript || !['failed', 'queued', 'transcribing'].includes(row.status)) {
      throw new HttpError(409, 'not_retryable', '실패한 받아쓰기만 다시 시도할 수 있습니다.');
    }
    const failed = d.prepare("SELECT id FROM jobs WHERE call_id = ? AND state = 'failed' LIMIT 1").get(id);
    if (!failed) throw new HttpError(409, 'not_retryable', '자동 재시도가 끝난 받아쓰기만 다시 시도할 수 있습니다.');
    // 워크스페이스 밖 경로와 심볼릭 링크도 거절한다.
    let file;
    try {
      if (!row.audio_file) throw new Error();
      const root = realpathSync(audioDir());
      file = realpathSync(path.resolve(dataDir(), row.audio_file));
      if (!isInside(root, file) || !statSync(file).isFile() || statSync(file).size === 0) throw new Error();
    } catch {
      throw new HttpError(409, 'no_audio', '저장된 녹음이 없어 다시 시도할 수 없습니다.');
    }
    const active = d.prepare("SELECT id FROM jobs WHERE call_id = ? AND state IN ('queued', 'leased') LIMIT 1").get(id);
    if (active) return { callId: id, jobId: active.id, requeued: false, alreadyPending: true };
    if (row.status !== 'failed') throw new HttpError(409, 'not_retryable', '현재 상태에서는 다시 시도할 수 없습니다.');
    const jobId = enqueue(id);
    recordAudit({ entity: 'call', entityId: id, action: 'retry_transcription', before: { status: row.status }, after: { jobId, status: 'queued' } });
    return { callId: id, jobId, requeued: true, alreadyPending: false };
  });
}

export function register(router) {
  router.post('/api/calls/:id/retry-transcription', ({ params }) => retryTranscription(params.id));
  router.get('/api/calls', ({ query }) => listCalls(query));

  router.get('/api/calls/:id', ({ params }) => {
    const row = getCallRow(params.id);
    if (!row) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
    return callView(row, { withDetail: true });
  });

  router.get('/api/calls/:id/audio', sendAudio);

  // routes/admin.mjs 도 같은 주소를 단다. 먼저 달린 것이 있으면 겹치지 않게 건너뛴다(주인 정하기는 총괄에게 요청).
  if (!router.match('DELETE', '/api/calls/x')?.route) {
    router.delete('/api/calls/:id', ({ req, params }) => {
      if (requestAccess().demo) requireAdmin(req);
      else requireRole('admin');
      return deleteCall(params.id);
    });
  }

  router.get('/api/customers', () => listCustomers());
  router.get('/api/customers/:name', ({ params }) => customerDetail(params.name));
}
