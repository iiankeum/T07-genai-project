// 공유 지식과 기존 낱말 사전은 같은 승인된 항목을 참조한다.
import { db, tx } from '../lib/db.mjs';
import { recordAudit, requestAccess, requireRole } from '../lib/auth.mjs';
import { HttpError, readJson } from '../lib/http.mjs';
import { limit } from '../lib/security.mjs';
import {
  GLOSSARY_KINDS, KNOWLEDGE_KINDS, MAX_KNOWLEDGE, CONTENT_FIELDS, approvedKnowledge,
  archiveKnowledge, duplicateKnowledge, knowledgeDetail, knowledgeKind, knowledgeRow, knowledgeView,
  proposeKnowledge, restoreKnowledge, reviewKnowledge,
} from '../lib/knowledge.mjs';

export const KINDS = GLOSSARY_KINDS;
export const MAX_GLOSSARY = MAX_KNOWLEDGE;
export const glossaryView = knowledgeView;
const KIND_ORDER = "CASE g.kind WHEN '현장말' THEN 0 WHEN '오인식' THEN 1 WHEN '거래처' THEN 2 WHEN '차종' THEN 3 ELSE 4 END";
const CSV_FIELDS = CONTENT_FIELDS.filter((field) => field !== 'sourceSegIndex' && field !== 'sourceCallId');

function collection(query, legacy) {
  const kinds = legacy ? GLOSSARY_KINDS : KNOWLEDGE_KINDS;
  const kind = query.kind ? knowledgeKind(query.kind, legacy) : null;
  const rows = db().prepare(`SELECT g.*,
    (SELECT count(*) FROM knowledge_revisions r WHERE r.knowledge_id = g.id AND r.status = 'pending') AS pending_count
    FROM glossary g WHERE g.kind IN (${kinds.map(() => '?').join(', ')})
    ORDER BY ${KIND_ORDER}, CASE WHEN g.source = '사용자' THEN 0 ELSE 1 END,
      CASE WHEN g.source = '사용자' THEN g.created_at END DESC, g.term`).all(...kinds);
  const total = rows.filter((row) => row.status !== 'archived').length;
  const items = rows.filter((row) => (!kind || row.kind === kind) && (!legacy || row.status !== 'archived')).map(knowledgeView);
  const { role } = requestAccess();
  return { items, kinds, total, max: MAX_KNOWLEDGE, canPropose: ['admin', 'reception'].includes(role), canReview: role === 'admin' };
}

function csvCell(value) {
  const data = Array.isArray(value) ? JSON.stringify(value) : String(value ?? '');
  const safe = /^['=+\-@\t\r]/.test(data) ? "'" + data : data;
  return '"' + safe.replaceAll('"', '""') + '"';
}

function exportCsv({ req, res }) {
  requireRole('admin', 'reception');
  const rows = approvedKnowledge().map((item) => CSV_FIELDS.map((field) => {
    if (field === 'phone' && item.phone?.includes('*')) return null;
    return item[field];
  }));
  const csv = '\uFEFF' + [CSV_FIELDS, ...rows].map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="knowledge.csv"',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(csv),
  });
  res.end(req.method === 'HEAD' ? undefined : csv);
}

function invalidCsv(message = '따옴표와 열 구분을 확인해 주세요.') {
  return new HttpError(400, 'bad_csv', message);
}

// 큰따옴표로 감싼 칸은 쉼표, 줄바꿈, 큰따옴표 두 개로 표현한 따옴표를 담을 수 있다.
function csvRows(value) {
  if (typeof value !== 'string') throw invalidCsv('CSV 파일을 선택해 주세요.');
  const input = value.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quote = false;
  let closed = false;
  function finishField() {
    row.push(field);
    field = '';
    closed = false;
  }
  function finishLine() {
    finishField();
    if (row.some(Boolean)) rows.push(row);
    row = [];
    if (rows.length > MAX_KNOWLEDGE + 1) throw invalidCsv(`한 번에 ${MAX_KNOWLEDGE}줄까지 가져올 수 있어요.`);
  }
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch !== '"') field += ch;
      else if (input[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quote = false;
        closed = true;
      }
    } else if (ch === ',') finishField();
    else if (ch === '\n' || ch === '\r') {
      finishLine();
      if (ch === '\r' && input[i + 1] === '\n') i++;
    } else if (closed) throw invalidCsv();
    else if (ch === '"' && !field) quote = true;
    else if (ch === '"') throw invalidCsv();
    else field += ch;
  }
  if (quote) throw invalidCsv();
  if (field || closed || row.length) finishLine();
  return rows;
}

function importCsv(d, value, actor) {
  const [head, ...rows] = csvRows(value);
  if (!head?.includes('kind') || !head.includes('term') || new Set(head).size !== head.length || head.some((field) => !CSV_FIELDS.includes(field))) {
    throw invalidCsv('CSV 첫 줄에 kind와 term을 넣어 주세요. 내려받은 파일의 열 이름을 사용할 수 있어요.');
  }
  const seen = new Set();
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      if (rows[i].length !== head.length) throw invalidCsv('첫 줄과 열 개수가 같아야 합니다.');
      const body = Object.fromEntries(head.map((field, col) => [field, rows[i][col].replace(/^'(?=['=+\-@\t\r])/, '')]));
      for (const key of ['aliases', 'relations']) {
        if (!(key in body)) continue;
        try { body[key] = body[key] ? JSON.parse(body[key]) : []; } catch { throw invalidCsv(`${key} 열을 JSON 배열로 입력해 주세요.`); }
      }
      const key = JSON.stringify([body.kind, body.term.trim().toLowerCase()]);
      if (seen.has(key)) throw invalidCsv('파일에 같은 분류의 용어가 반복돼요.');
      seen.add(key);
      const row = duplicateKnowledge(d, { ...body, term: body.term.trim() });
      // 내보낸 파일의 빈 번호가 가린 번호를 덮어쓰지 않게 한다.
      if (row?.phone && body.phone === '') delete body.phone;
      results.push(proposeKnowledge(d, body, actor, { row }));
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      throw new HttpError(err.status, err.code, `${i + 2}번째 줄 — ${err.publicMessage}`);
    }
  }
  return { imported: results.length, results };
}

function registerCollection(router, base, legacy) {
  router.get(base, ({ query }) => collection(query, legacy));
  router.get(base + '/:id', ({ params }) => ({ item: knowledgeDetail(db(), params.id) }));
  router.post(base, async ({ req, ip }) => {
    const { user } = requireRole('admin', 'reception');
    limit('write', ip);
    const body = await readJson(req, 16 * 1024);
    return tx((d) => {
      const { id, revisionId } = proposeKnowledge(d, body, user.id, { legacy, requireEvidence: !legacy });
      const item = knowledgeDetail(d, id);
      recordAudit({ entity: 'knowledge', entityId: id, action: 'proposed', after: { revisionId } });
      return { ...item, item, revisionId };
    });
  });
  router.patch(base + '/:id', async ({ req, params, ip }) => {
    const { user } = requireRole('admin', 'reception');
    limit('write', ip);
    const body = await readJson(req, 16 * 1024);
    return tx((d) => {
      const row = knowledgeRow(d, params.id);
      const { id, revisionId } = proposeKnowledge(d, body, user.id, { row, legacy, requireEvidence: !legacy });
      const item = knowledgeDetail(d, id);
      recordAudit({ entity: 'knowledge', entityId: id, action: 'proposed', after: { revisionId } });
      return { ...item, item, revisionId };
    });
  });
  router.delete(base + '/:id', ({ params, ip }) => {
    const { user } = requireRole('admin');
    limit('write', ip);
    return tx((d) => {
      const result = archiveKnowledge(d, params.id, user.id);
      recordAudit({ entity: 'knowledge', entityId: params.id, action: 'archived' });
      return result;
    });
  });
}

export function register(router) {
  registerCollection(router, '/api/glossary', true);
  registerCollection(router, '/api/knowledge', false);

  router.get('/api/knowledge.csv', exportCsv);
  router.post('/api/knowledge/import', async ({ req, ip }) => {
    const { user } = requireRole('admin', 'reception');
    limit('write', ip);
    const body = await readJson(req, 1024 * 1024);
    return tx((d) => {
      const result = importCsv(d, body.csv, user.id);
      for (const { id, revisionId } of result.results) recordAudit({ entity: 'knowledge', entityId: id, action: 'imported', after: { revisionId } });
      return result;
    });
  });
  router.post('/api/knowledge/:id/revisions/:revision/review', async ({ req, params, ip }) => {
    const { user } = requireRole('admin');
    limit('write', ip);
    const body = await readJson(req, 4096);
    return tx((d) => {
      const item = reviewKnowledge(d, params.id, params.revision, user.id, body);
      recordAudit({ entity: 'knowledge', entityId: params.id, action: body.decision === 'approve' ? 'approved' : 'rejected', after: { revisionId: params.revision, version: item.version } });
      return { item };
    });
  });
  router.post('/api/knowledge/:id/revisions/:revision/restore', ({ params, ip }) => {
    const { user } = requireRole('admin');
    limit('write', ip);
    return tx((d) => {
      const result = restoreKnowledge(d, params.id, params.revision, user.id);
      recordAudit({ entity: 'knowledge', entityId: params.id, action: 'restore_proposed', after: { revisionId: result.revisionId, restoredRevisionId: params.revision } });
      return result;
    });
  });
}
