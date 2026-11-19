import { db, newId, nowIso, parseJson } from './db.mjs';
import { cleanText, HttpError } from './http.mjs';
import { maskPhone } from './repo.mjs';

export const GLOSSARY_KINDS = ['현장말', '오인식', '거래처', '차종'];
export const KNOWLEDGE_KINDS = [...GLOSSARY_KINDS, '부품', '업무 절차'];
export const MAX_KNOWLEDGE = 500;
export const CONTENT_FIELDS = ['kind', 'term', 'standard', 'phone', 'contactName', 'note', 'evidenceNote', 'aliases', 'relations', 'sourceCallId', 'sourceSegIndex'];

function displayPhone({ kind, phone }) {
  if (kind !== '거래처' || !phone) return null;
  return phone.replace(/[^0-9]/g, '').startsWith('0100000') ? phone : maskPhone(phone);
}

function displayContact({ kind, contactName }) {
  return kind === '거래처' && contactName ? '***' : null;
}

function contactField(value) {
  if (value != null && (typeof value !== 'string' || /[\u0000-\u001f\u007f*]/.test(value))) throw new HttpError(400, 'bad_contact_name', '담당자 이름은 줄바꿈 없는 글자로 입력해 주세요.');
  return textField(value, '담당자 이름', 40);
}

function contentFromRow(row) {
  return {
    kind: row.kind, term: row.term, standard: row.standard ?? null, phone: row.phone ?? null, contactName: row.contact_name ?? null,
    note: row.note ?? null, evidenceNote: row.evidence_note ?? null,
    aliases: parseJson(row.aliases, []), relations: parseJson(row.relations, []),
    sourceCallId: row.source_call_id ?? null, sourceSegIndex: row.source_seg_index ?? null,
  };
}

function contentView(content) {
  return { ...content, phone: displayPhone(content), contactName: displayContact(content) };
}

export function knowledgeView(row) {
  return {
    id: row.id, ...contentView(contentFromRow(row)), status: row.status, source: row.source,
    version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
    pendingCount: row.pending_count ?? 0,
  };
}

export function approvedKnowledge() {
  return db().prepare("SELECT * FROM glossary WHERE status = 'approved' ORDER BY kind, term").all().map(knowledgeView);
}

function textField(value, label, max, required = false) {
  if (value != null && typeof value !== 'string' && typeof value !== 'number') {
    throw new HttpError(400, 'bad_input', `${label}은(는) 글자로 적어 주세요.`);
  }
  const s = cleanText(value, 100_000);
  if (!s && required) throw new HttpError(400, 'required', `${label}을(를) 적어 주세요.`);
  if (s && [...s].length > max) throw new HttpError(400, 'too_long', `${label}은(는) ${max}자까지 쓸 수 있어요.`);
  return s;
}

export function knowledgeKind(kind, legacy = false) {
  if (!(legacy ? GLOSSARY_KINDS : KNOWLEDGE_KINDS).includes(kind)) {
    throw new HttpError(400, 'bad_kind', '목록에서 분류를 골라 주세요.');
  }
  return kind;
}

function phoneField(value) {
  const phone = textField(value, '전화번호', 20);
  if (!phone) return null;
  if (!/^[0-9-]+$/.test(phone) || !/^\d{7,13}$/.test(phone.replaceAll('-', ''))) {
    throw new HttpError(400, 'bad_phone', '전화번호는 숫자와 하이픈으로 입력해 주세요.');
  }
  return phone;
}

function aliasesField(value) {
  if (!Array.isArray(value) || value.length > 15) throw new HttpError(400, 'bad_aliases', '별칭을 15개까지 등록할 수 있어요.');
  const aliases = [...new Set(value.map((alias) => textField(alias, '별칭', 80)).filter(Boolean))];
  if (aliases.join(',').length > 300) throw new HttpError(400, 'too_long', '별칭은 모두 합해 300자까지 쓸 수 있어요.');
  return aliases;
}

function relationsField(value) {
  if (!Array.isArray(value) || value.length > 10) throw new HttpError(400, 'bad_relations', '연결된 개념을 10개까지 등록할 수 있어요.');
  return value.map((entry) => ({
    relation: textField(entry?.relation, '관계 이름', 60, true),
    target: textField(entry?.target, '연결할 용어', 80, true),
  }));
}

function sourceFields(d, id, segment) {
  const callId = textField(id, '출처 통화', 80);
  const segIndex = segment == null || segment === '' ? null : Number(segment);
  if (!callId && segIndex == null) return { sourceCallId: null, sourceSegIndex: null };
  const call = callId && d.prepare('SELECT segments FROM calls WHERE id = ?').get(callId);
  if (!call || (segIndex != null && (!Number.isSafeInteger(segIndex) || segIndex < 0 || !parseJson(call.segments, [])?.[segIndex]))) {
    throw new HttpError(400, 'bad_source_call', '연결할 통화나 문장을 찾지 못했어요.');
  }
  return { sourceCallId: callId, sourceSegIndex: segIndex };
}

export function knowledgeContent(d, body, previous = {}, { legacy = false, requireEvidence = false } = {}) {
  const next = { aliases: [], relations: [], ...previous, ...Object.fromEntries(CONTENT_FIELDS.filter((key) => key in body).map((key) => [key, body[key]])) };
  const kind = knowledgeKind(next.kind, legacy);
  const phone = kind !== '거래처' ? null : next.phone === displayPhone(previous) ? previous.phone ?? null : phoneField(next.phone);
  const contactName = kind !== '거래처' ? null : next.contactName === displayContact(previous) ? previous.contactName ?? null : contactField(next.contactName);
  const sourceSegIndex = 'sourceCallId' in body && body.sourceCallId !== previous.sourceCallId && !('sourceSegIndex' in body) ? null : next.sourceSegIndex;
  const source = ('sourceCallId' in body || 'sourceSegIndex' in body)
    ? sourceFields(d, next.sourceCallId, sourceSegIndex)
    : { sourceCallId: next.sourceCallId ?? null, sourceSegIndex: sourceSegIndex ?? null };
  return {
    kind,
    term: textField(next.term, '대표 용어', legacy ? 40 : 80, true),
    standard: textField(next.standard, '표준 표현', 60),
    phone, contactName,
    note: textField(next.note, '정의와 업무에서의 의미', legacy ? 200 : 2000, requireEvidence),
    evidenceNote: textField(next.evidenceNote, '출처와 근거', 300, requireEvidence && !source.sourceCallId),
    aliases: aliasesField(next.aliases),
    relations: relationsField(next.relations),
    ...source,
  };
}

export function knowledgeRow(d, id) {
  const row = d.prepare('SELECT * FROM glossary WHERE id = ?').get(id);
  if (!row) throw new HttpError(404, 'not_found', '공유 지식에서 항목을 찾지 못했어요.');
  return row;
}

export function duplicateKnowledge(d, content, exceptId = '') {
  return d.prepare("SELECT * FROM glossary WHERE status <> 'archived' AND kind = ? AND lower(term) = lower(?) AND id <> ?")
    .get(content.kind, content.term, exceptId);
}

function ensureUnique(d, content, exceptId) {
  if (duplicateKnowledge(d, content, exceptId)) throw new HttpError(409, 'duplicate', `「${content.term}」은(는) 같은 분류에 이미 있어요. 기존 지식에 수정을 제안해 주세요.`);
}

const contentValues = (content) => [
  content.kind, content.term, content.standard, content.phone, content.contactName ?? null, content.note, content.evidenceNote,
  JSON.stringify(content.aliases), JSON.stringify(content.relations), content.sourceCallId, content.sourceSegIndex,
];

function updateContent(d, id, content, status, version, now) {
  d.prepare(`UPDATE glossary SET kind = ?, term = ?, standard = ?, phone = ?, contact_name = ?, note = ?, evidence_note = ?,
    aliases = ?, relations = ?, source_call_id = ?, source_seg_index = ?, status = ?, version = ?, updated_at = ? WHERE id = ?`)
    .run(...contentValues(content), status, version, now, id);
}

function addRevision(d, id, version, content, actor, status = 'pending') {
  const revision = newId('kr');
  d.prepare(`INSERT INTO knowledge_revisions(id, knowledge_id, base_version, snapshot, status, submitted_by, created_at, approved_version)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(revision, id, version, JSON.stringify(content), status, actor, nowIso(), status === 'approved' ? version : null);
  return revision;
}

function ensureVersionSaved(d, row) {
  if (row.status !== 'approved') return;
  const historical = d.prepare('SELECT id FROM knowledge_revisions WHERE knowledge_id = ? AND approved_version = ?').get(row.id, row.version);
  if (!historical) addRevision(d, row.id, row.version, contentFromRow(row), row.submitted_by || row.source || '기본', 'approved');
}

function addProposal(d, next, actor, row) {
  ensureUnique(d, next, row?.id);
  const id = row?.id ?? newId('g');
  const now = nowIso();
  if (!row || row.status === 'archived') {
    if (d.prepare("SELECT COUNT(*) AS n FROM glossary WHERE status <> 'archived'").get().n >= MAX_KNOWLEDGE) {
      throw new HttpError(409, 'too_many', `공유 지식은 ${MAX_KNOWLEDGE}개까지 등록할 수 있어요.`);
    }
  }
  if (!row) {
    d.prepare(`INSERT INTO glossary(kind, term, standard, phone, contact_name, note, evidence_note, aliases, relations, source_call_id,
      source_seg_index, id, status, source, submitted_by, version, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '사용자', ?, 0, ?, ?)`).run(...contentValues(next), id, actor, now, now);
  } else {
    const n = d.prepare("SELECT COUNT(*) AS n FROM knowledge_revisions WHERE knowledge_id = ? AND status = 'pending'").get(id).n;
    if (n >= 10) throw new HttpError(409, 'too_many_revisions', '검토 대기 중인 제안을 먼저 검토해 주세요.');
    if (row.status !== 'approved') updateContent(d, id, next, 'pending', row.version, now);
  }
  const revisionId = addRevision(d, id, row?.version ?? 0, next, actor);
  return { id, revisionId };
}

export function proposeKnowledge(d, body, actor, { row, legacy = false, requireEvidence = false } = {}) {
  if (row?.status === 'archived') throw new HttpError(409, 'archived', '보관된 지식은 변경 이력에서 복원할 수 있어요.');
  const next = knowledgeContent(d, body, row ? contentFromRow(row) : undefined, { legacy, requireEvidence });
  return addProposal(d, next, actor, row);
}

function revisionView(row) {
  return {
    id: row.id, status: row.status, baseVersion: row.base_version, version: row.approved_version,
    content: contentView(parseJson(row.snapshot, {})), reason: row.reason,
    createdAt: row.created_at, reviewedAt: row.reviewed_at,
  };
}

export function knowledgeDetail(d, id) {
  const row = knowledgeRow(d, id);
  const revisions = d.prepare(`SELECT * FROM knowledge_revisions WHERE knowledge_id = ?
    ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC, rowid DESC LIMIT 100`).all(id).map(revisionView);
  const segment = row.source_call_id && d.prepare('SELECT title, recorded_at, segments FROM calls WHERE id = ?').get(row.source_call_id);
  const sourceCall = segment ? {
    id: row.source_call_id, title: segment.title, recordedAt: segment.recorded_at,
    segment: row.source_seg_index == null ? null : parseJson(segment.segments, [])?.[row.source_seg_index] ?? null,
  } : null;
  return { ...knowledgeView(row), pendingCount: revisions.filter((revision) => revision.status === 'pending').length, revisions, sourceCall };
}

function getRevision(d, id, revisionId) {
  const revision = d.prepare('SELECT * FROM knowledge_revisions WHERE knowledge_id = ? AND id = ?').get(id, revisionId);
  if (!revision) throw new HttpError(404, 'not_found', '검토할 버전을 찾지 못했어요.');
  return revision;
}

export function reviewKnowledge(d, id, revisionId, actor, body) {
  const row = knowledgeRow(d, id);
  const revision = getRevision(d, id, revisionId);
  if (row.status === 'archived' || revision.status !== 'pending' || revision.base_version !== row.version) {
    throw new HttpError(409, 'stale_revision', '이미 검토했거나 새 버전이 적용된 제안이에요. 화면을 새로고침해 주세요.');
  }
  const decision = body.decision;
  if (decision !== 'approve' && decision !== 'reject') throw new HttpError(400, 'bad_decision', '승인 또는 반려를 골라 주세요.');
  const now = nowIso();
  const status = decision === 'approve' ? 'approved' : 'rejected';
  const reason = decision === 'reject' ? textField(body.reason, '반려 사유', 500, true) : null;
  const version = decision === 'approve' ? row.version + 1 : null;
  if (decision === 'approve') {
    const content = parseJson(revision.snapshot, {});
    ensureUnique(d, content, id);
    ensureVersionSaved(d, row);
    updateContent(d, id, content, 'approved', version, now);
    d.prepare("UPDATE knowledge_revisions SET status = 'superseded', reviewed_by = ?, reviewed_at = ? WHERE knowledge_id = ? AND id <> ? AND status = 'pending'")
      .run(actor, now, id, revisionId);
  }
  d.prepare('UPDATE knowledge_revisions SET status = ?, reason = ?, reviewed_by = ?, reviewed_at = ?, approved_version = ? WHERE id = ?')
    .run(status, reason, actor, now, version, revisionId);
  if (decision === 'reject' && row.status === 'pending') {
    const newest = d.prepare("SELECT snapshot FROM knowledge_revisions WHERE knowledge_id = ? AND status = 'pending' ORDER BY created_at DESC, rowid DESC LIMIT 1").get(id);
    const content = parseJson(newest?.snapshot ?? revision.snapshot, contentFromRow(row));
    updateContent(d, id, content, newest ? 'pending' : 'rejected', row.version, now);
  }
  return knowledgeDetail(d, id);
}

export function archiveKnowledge(d, id, actor) {
  const row = knowledgeRow(d, id);
  if (row.status === 'archived') throw new HttpError(404, 'not_found', '이미 보관된 지식이에요.');
  const now = nowIso();
  ensureVersionSaved(d, row);
  addRevision(d, id, row.version, contentFromRow(row), actor, 'archived');
  d.prepare("UPDATE glossary SET status = 'archived', updated_at = ? WHERE id = ?").run(now, id);
  d.prepare("UPDATE knowledge_revisions SET status = 'superseded', reviewed_by = ?, reviewed_at = ? WHERE knowledge_id = ? AND status = 'pending'").run(actor, now, id);
  return { id, ok: true };
}

export function restoreKnowledge(d, id, revisionId, actor) {
  const row = knowledgeRow(d, id);
  const revision = getRevision(d, id, revisionId);
  if (!['approved', 'archived'].includes(revision.status)) throw new HttpError(409, 'not_restorable', '승인 또는 보관된 버전만 복원할 수 있어요.');
  const next = parseJson(revision.snapshot, {});
  return addProposal(d, next, actor, row);
}

export function detachKnowledgeCallSources(d, callIds) {
  const ids = JSON.stringify([...new Set(callIds)]);
  if (ids === '[]') return;
  d.prepare(`UPDATE glossary SET source_call_id = NULL, source_seg_index = NULL, evidence_note = NULL
    WHERE source_call_id IN (SELECT value FROM json_each(?))`).run(ids);
  d.prepare(`UPDATE knowledge_revisions SET snapshot = json_set(snapshot, '$.sourceCallId', NULL, '$.sourceSegIndex', NULL, '$.evidenceNote', NULL)
    WHERE json_extract(snapshot, '$.sourceCallId') IN (SELECT value FROM json_each(?))`).run(ids);
}
