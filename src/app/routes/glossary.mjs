// F07 낱말 사전 API: 현장말 · 오인식 · 거래처(가짜 번호) · 차종 보기 · 넣기 · 고치기 · 지우기
import { db, newId, nowIso } from '../lib/db.mjs';
import { HttpError, readJson, cleanText } from '../lib/http.mjs';
import { limit, requireAdmin } from '../lib/security.mjs';
import { maskPhone } from '../lib/repo.mjs';

export const KINDS = ['현장말', '오인식', '거래처', '차종'];
export const MAX_GLOSSARY = 500;

const KIND_ORDER = `CASE kind WHEN '현장말' THEN 0 WHEN '오인식' THEN 1 WHEN '거래처' THEN 2 WHEN '차종' THEN 3 ELSE 4 END`;

/**
 * 거래처 번호 보이기. 시드(기본)와 누가 봐도 가짜인 010-0000-xxxx 는 그대로,
 * 사용자가 넣은 그 밖의 번호는 진짜일 수 있어 가운데를 가린다(누구나 보는 데모라서).
 */
function displayPhone(row) {
  if (row.kind !== '거래처' || !row.phone) return null;
  const digits = String(row.phone).replace(/[^0-9]/g, '');
  if (row.source === '기본' || digits.startsWith('0100000')) return row.phone;
  return maskPhone(row.phone);
}

export function glossaryView(row) {
  return {
    id: row.id,
    kind: row.kind,
    term: row.term,
    standard: row.standard ?? null,
    phone: displayPhone(row),
    note: row.note ?? null,
    status: row.status,
    source: row.source ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── 입력 검사 ─────────────────────────────────────────────────────
function textField(v, { max, required = false, missing, tooLong }) {
  if (v != null && typeof v !== 'string' && typeof v !== 'number') throw new HttpError(400, 'bad_input', '글자로 적어 주세요.');
  const s = cleanText(v, 100_000);
  if (!s) {
    if (required) throw new HttpError(400, 'required', missing);
    return null;
  }
  if ([...s].length > max) throw new HttpError(400, 'too_long', tooLong);
  return s;
}
function kindField(v) {
  if (!KINDS.includes(v)) throw new HttpError(400, 'bad_kind', '종류는 현장말 · 오인식 · 거래처 · 차종 중 하나로 골라 주세요.');
  return v;
}
function phoneField(v) {
  if (v == null || String(v).trim() === '') return null;
  const s = String(v).trim();
  const digits = s.replace(/-/g, '');
  if (!/^[0-9-]+$/.test(s) || digits.length < 7 || digits.length > 13 || s.length > 20) {
    throw new HttpError(400, 'bad_phone', '전화번호는 숫자와 - 만 써 주세요(예: 010-0000-0199).');
  }
  return s;
}
const termOf = (v) => textField(v, { max: 40, required: true, missing: '낱말을 적어 주세요.', tooLong: '낱말은 40자까지 쓸 수 있어요.' });
const standardOf = (v) => textField(v, { max: 60, tooLong: '바른 말은 60자까지 쓸 수 있어요.' });
const noteOf = (v) => textField(v, { max: 200, tooLong: '메모는 200자까지 쓸 수 있어요.' });

function getRow(id) {
  return db().prepare('SELECT * FROM glossary WHERE id = ?').get(id) ?? null;
}
function findDuplicate(kind, term, exceptId = '') {
  return db().prepare('SELECT id FROM glossary WHERE kind = ? AND lower(term) = lower(?) AND id <> ?').get(kind, term, exceptId) ?? null;
}
/** 화면이 {item} 으로 읽든 항목 그대로 읽든 되게 둘 다 담는다 */
const itemResponse = (row) => {
  const item = glossaryView(row);
  return { ...item, item };
};

export function register(router) {
  router.get('/api/glossary', ({ query }) => {
    const kind = query.kind ? kindField(query.kind) : null;
    const rows = kind
      ? db().prepare(`SELECT * FROM glossary WHERE kind = ? ORDER BY CASE WHEN source = '사용자' THEN 0 ELSE 1 END, CASE WHEN source = '사용자' THEN created_at END DESC, term`).all(kind)
      : db().prepare(`SELECT * FROM glossary ORDER BY ${KIND_ORDER}, CASE WHEN source = '사용자' THEN 0 ELSE 1 END, CASE WHEN source = '사용자' THEN created_at END DESC, term`).all();
    const total = db().prepare('SELECT COUNT(*) AS n FROM glossary').get().n;
    return { items: rows.map(glossaryView), kinds: KINDS, total, max: MAX_GLOSSARY };
  });

  router.post('/api/glossary', async ({ req, ip }) => {
    limit('write', ip);
    const body = await readJson(req, 8 * 1024);
    const kind = kindField(body.kind);
    const term = termOf(body.term);
    const standard = standardOf(body.standard);
    const note = noteOf(body.note);
    const phone = kind === '거래처' ? phoneField(body.phone) : null;
    if (db().prepare('SELECT COUNT(*) AS n FROM glossary').get().n >= MAX_GLOSSARY) {
      throw new HttpError(409, 'too_many', `사전은 ${MAX_GLOSSARY}개까지 넣을 수 있어요. 안 쓰는 것을 지운 뒤 넣어 주세요.`);
    }
    if (findDuplicate(kind, term)) throw new HttpError(409, 'duplicate', `「${term}」 은(는) 이미 사전에 있어요.`);
    const id = newId('g');
    const now = nowIso();
    db().prepare('INSERT INTO glossary(id, kind, term, standard, phone, note, status, source, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, kind, term, standard, phone, note, 'approved', '사용자', now, now);
    return itemResponse(getRow(id));
  });

  router.patch('/api/glossary/:id', async ({ req, params, ip }) => {
    limit('write', ip);
    const row = getRow(params.id);
    if (!row) throw new HttpError(404, 'not_found', '사전에 없는 항목입니다.');
    if (row.source === '기본') requireAdmin(req);
    const body = await readJson(req, 8 * 1024);
    const next = { term: row.term, standard: row.standard, phone: row.phone, note: row.note };
    if ('term' in body) next.term = termOf(body.term);
    if ('standard' in body) next.standard = standardOf(body.standard);
    if ('note' in body) next.note = noteOf(body.note);
    if ('phone' in body && row.kind === '거래처') {
      // 화면이 가린 번호(010-****-1234)를 그대로 돌려보내면 바꾸지 않은 것으로 본다
      const shown = displayPhone(row);
      next.phone = shown && body.phone === shown ? row.phone : phoneField(body.phone);
    }
    if (next.term !== row.term && findDuplicate(row.kind, next.term, row.id)) {
      throw new HttpError(409, 'duplicate', `「${next.term}」 은(는) 이미 사전에 있어요.`);
    }
    db().prepare('UPDATE glossary SET term = ?, standard = ?, phone = ?, note = ?, updated_at = ? WHERE id = ?')
      .run(next.term, next.standard, next.phone, next.note, nowIso(), row.id);
    return itemResponse(getRow(row.id));
  });

  router.delete('/api/glossary/:id', ({ req, params, ip }) => {
    limit('write', ip);
    const row = getRow(params.id);
    if (!row) throw new HttpError(404, 'not_found', '사전에 없는 항목입니다.');
    if (row.source === '기본') requireAdmin(req);
    db().prepare('DELETE FROM glossary WHERE id = ?').run(row.id);
    return { ok: true, id: row.id };
  });
}
