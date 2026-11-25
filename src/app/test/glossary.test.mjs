import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './fixtures/worker-helpers.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahmatda-knowledge-'));
process.env.DATA_DIR = dataDir;
process.env.DEMO_MODE = '1';
process.env.AUTH_MAIL_MODE = 'outbox';
process.env.AI_PROVIDER = 'off';
const { db, nowIso } = await import('../lib/db.mjs');
const { dictionaryForAi, customerByPhone } = await import('../lib/repo.mjs');
const { seedDemo, loadSeedFiles } = await import('../lib/seed.mjs');
const routes = await Promise.all([import('../routes/glossary.mjs'), import('../routes/auth.mjs')]);
let server;
before(async () => {
  await seedDemo({ reset: true });
  server = await startServer(routes);
});
after(async () => {
  await server?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function req(method, url, { body, ip = '10.1.0.1', cookie, raw } = {}) {
  const headers = { 'x-forwarded-for': ip };
  if (body !== undefined) headers['content-type'] = raw ? 'text/plain' : 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await fetch(server.base + url, { method, headers, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  const text = await res.text();
  const json = res.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(text) : null;
  return { status: res.status, json, text, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
const k = (id) => '/api/knowledge/' + id;
const review = (itemId, revisionId, decision = 'approve', opts = {}) => req('POST', k(itemId) + '/revisions/' + revisionId + '/review', { ...opts, body: { decision, ...opts.body } });
const dictionaryHas = (term) => dictionaryForAi().glossary.some((item) => item.term === term);

test('기본 사전과 공유 지식 분류를 함께 읽고 예시 거래처 번호를 표시한다', async () => {
  const all = await req('GET', '/api/glossary');
  assert.equal(all.status, 200);
  assert.deepEqual(all.json.kinds, ['현장말', '오인식', '거래처', '차종']);
  assert.equal(all.json.items.length, all.json.total);
  assert.equal(all.json.max, 500);
  assert.equal(all.json.items[0].kind, '현장말');
  const workspace = await req('GET', '/api/knowledge');
  assert.ok(workspace.json.kinds.includes('업무 절차'));
  assert.equal(workspace.json.canReview, true);
  const customers = await req('GET', '/api/glossary?kind=' + encodeURIComponent('거래처'));
  assert.equal(customers.json.items.length, loadSeedFiles().customers.length);
  for (const item of customers.json.items) {
    assert.equal(item.source, '기본');
    assert.match(item.phone, /^010-0000-01\d\d$/);
  }
  assert.equal((await req('GET', '/api/glossary?kind=nope')).json.error, 'bad_kind');
});

test('새 제안은 승인 뒤에만 AI 사전에 반영되고 중복은 거절한다', async () => {
  const body = { kind: '현장말', term: '  헨다 ', standard: '휀다', note: '받아쓰기가 자주 틀림' };
  const created = await req('POST', '/api/glossary', { body });
  assert.equal(created.status, 200);
  const { item, revisionId } = created.json;
  assert.equal(item.term, '헨다');
  assert.equal(item.source, '사용자');
  assert.equal(item.status, 'pending');
  assert.equal(item.phone, null);
  assert.equal(dictionaryHas('헨다'), false);
  assert.equal((await req('POST', '/api/glossary', { body })).json.error, 'duplicate');
  assert.equal((await req('POST', '/api/glossary', { body: { ...body, term: '휀다' } })).status, 409);
  assert.equal((await req('POST', '/api/glossary', { body: { ...body, kind: '오인식' } })).status, 200);
  const approved = await review(item.id, revisionId);
  assert.equal(approved.json.item.status, 'approved');
  assert.equal(approved.json.item.version, 1);
  assert.equal(dictionaryHas('헨다'), true);
  assert.equal((await review(item.id, revisionId)).status, 409);
});

test('승인본을 유지하면서 편집안을 반려·승인하고, 이전 버전을 검토 대기로 복원한다', async () => {
  const row = db().prepare("SELECT * FROM glossary WHERE kind = '현장말' AND term = '쇼바'").get();
  const edited = await req('PATCH', k(row.id), { body: { term: '쇼바통', note: '쇼크 업소버의 현장 표현', evidenceNote: '현장 회의' } });
  assert.equal(edited.status, 200, edited.text);
  assert.equal(edited.json.item.term, row.term);
  assert.equal(edited.json.item.pendingCount, 1);
  assert.equal(dictionaryHas(row.term), true);
  assert.equal(dictionaryHas('쇼바통'), false);
  assert.equal((await review(row.id, edited.json.revisionId, 'reject')).status, 400);
  const rejected = await review(row.id, edited.json.revisionId, 'reject', { body: { reason: '증빙 보완 필요' } });
  assert.equal(rejected.json.item.revisions[0].reason, '증빙 보완 필요');
  assert.equal(rejected.json.item.status, 'approved');

  const revised = await req('PATCH', k(row.id), { body: { term: '쇼바통', note: '쇼크 업소버의 현장 표현', evidenceNote: '공급사 용어집' } });
  const approved = await review(row.id, revised.json.revisionId);
  const baseline = approved.json.item.revisions.find((revision) => revision.version === row.version);
  assert.equal(baseline.content.term, row.term);
  assert.equal(approved.json.item.term, '쇼바통');
  assert.equal(dictionaryHas('쇼바통'), true);
  const result = await req('POST', k(row.id) + '/revisions/' + baseline.id + '/restore');
  assert.equal(result.status, 200, result.text);
  assert.equal(dictionaryHas('쇼바통'), true);
  const restored = await review(row.id, result.json.revisionId);
  assert.equal(restored.json.item.term, row.term);
  assert.equal(restored.json.item.version, row.version + 2);
  assert.equal(dictionaryHas('쇼바통'), false);
});

test('기존 길이 제한과 전화번호 입력 검사를 유지한다', async () => {
  const cases = [
    [{ kind: '현장말', term: '' }, 'required'],
    [{ kind: '현장말' }, 'required'],
    [{ kind: '현장말', term: '가'.repeat(41) }, 'too_long'],
    [{ kind: '현장말', term: '가', standard: '나'.repeat(61) }, 'too_long'],
    [{ kind: '현장말', term: '가', note: '다'.repeat(201) }, 'too_long'],
    [{ kind: '모름', term: '가' }, 'bad_kind'],
    [{ kind: '현장말', term: { x: 1 } }, 'bad_input'],
    [{ kind: '거래처', term: '가짜상회', phone: '010-abcd-0000' }, 'bad_phone'],
    [{ kind: '거래처', term: '가짜상회', phone: '12' }, 'bad_phone'],
  ];
  for (const [body, code] of cases) {
    const res = await req('POST', '/api/glossary', { body });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.json.error, code, JSON.stringify(body));
  }
  assert.equal((await req('POST', '/api/glossary', { body: 'kind=현장말', raw: true })).status, 415);
  const res = await req('POST', '/api/glossary', { body: { kind: '차종', term: '가짜차 X1', phone: '010-0000-0999' } });
  assert.equal(res.status, 200);
  assert.equal(res.json.item.phone, null);
  assert.equal((await req('POST', '/api/knowledge', { body: { kind: '부품', term: '설명 없는 항목' } })).json.error, 'required');
});

test('연결 지식과 출처 문장을 보존하고 가린 전화번호를 그대로 보낼 수 있다', async () => {
  const call = db().prepare("SELECT id FROM calls WHERE json_array_length(segments) > 0 LIMIT 1").get();
  const body = { kind: '거래처', term: '가짜모터', phone: '010-1234-5678', note: '오전 납품', sourceCallId: call.id, sourceSegIndex: 0,
    aliases: ['가짜 모터', '가짜 모터'], relations: [{ relation: '주문 부품', target: '프론트 범퍼' }] };
  assert.equal((await req('POST', '/api/knowledge', { body: { ...body, sourceSegIndex: 2000 } })).json.error, 'bad_source_call');
  const created = await req('POST', '/api/knowledge', { body });
  assert.equal(created.status, 200, created.text);
  assert.equal(created.json.item.phone, '010-****-5678');
  assert.equal(created.json.item.sourceCall.id, call.id);
  assert.equal(typeof created.json.item.sourceCall.segment.text, 'string');
  assert.deepEqual(created.json.item.aliases, ['가짜 모터']);
  assert.deepEqual(created.json.item.relations, body.relations);
  assert.equal(customerByPhone('01012345678'), null);
  await review(created.json.item.id, created.json.revisionId);
  assert.equal(customerByPhone('01012345678'), '가짜모터');

  const edited = await req('PATCH', k(created.json.item.id), { body: { phone: '010-****-5678', note: '오후 납품' } });
  const approved = await review(edited.json.item.id, edited.json.revisionId);
  assert.equal(approved.json.item.note, '오후 납품');
  assert.equal(customerByPhone('01012345678'), '가짜모터');

  assert.equal((await req('DELETE', k(edited.json.item.id))).status, 200);
  assert.equal(customerByPhone('01012345678'), null);
  assert.equal((await req('GET', k(edited.json.item.id))).json.item.status, 'archived');
  assert.equal((await req('PATCH', k(edited.json.item.id), { body: { note: 'x' } })).json.error, 'archived');
});

test('CSV는 검토 대기로 가져오고 오류 발생 시 배치 전체를 되돌린다', async () => {
  const bad = await req('POST', '/api/knowledge/import', { body: { csv: 'kind,term,note\n부품,되돌릴용어,설명\n오류,두번째용어,설명' } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.message, /3번째 줄/);
  assert.ok(!db().prepare("SELECT id FROM glossary WHERE term = '되돌릴용어'").get());
  const imported = await req('POST', '/api/knowledge/import', { body: { csv: 'kind,term,note\r\n부품,=CSV방어,"첫째 줄, ""인용""\r\n둘째 줄"\r\n' } });
  assert.equal(imported.status, 200, imported.text);
  assert.equal(imported.json.imported, 1);
  const { id, revisionId } = imported.json.results[0];
  assert.equal((await req('GET', k(id))).json.item.status, 'pending');
  assert.doesNotMatch((await req('GET', '/api/knowledge.csv')).text, /CSV방어/);
  await review(id, revisionId);
  const csv = await req('GET', '/api/knowledge.csv');
  assert.match(csv.text, /"'=CSV방어"/);
  assert.match(csv.text, /"첫째 줄, ""인용""\r\n둘째 줄"/);
});

async function tokenFromOutbox(email, kind) {
  const dir = path.join(dataDir, 'outbox');
  const mail = fs.readdirSync(dir).map((filename) => JSON.parse(fs.readFileSync(path.join(dir, filename), 'utf8')))
    .find((entry) => entry.to === email && entry.kind === kind);
  assert.ok(mail);
  const hash = new URL(mail.url).hash;
  return kind === 'invite' ? hash.split('/').at(-1) : new URLSearchParams(hash.split('?')[1]).get('token');
}

test('같은 공간의 접수 담당자는 함께 보고 제안하며 관리자만 검토·보관한다', async () => {
  const credentials = { password: 'fixture-only-246!', agreeTerms: true, agreePrivacy: true };
  const admin = { ...credentials, email: 'knowledge-admin@example.test', name: '공유 지식 관리자' };
  assert.equal((await req('POST', '/api/auth/signup', { body: admin })).status, 200);
  assert.equal((await req('POST', '/api/auth/verify', { body: { token: await tokenFromOutbox(admin.email, 'verify'), password: credentials.password } })).status, 200);
  const login = await req('POST', '/api/auth/login', { body: admin });
  assert.equal(login.status, 200, login.text);
  const adminCookie = login.cookie;
  const workspace = await req('POST', '/api/auth/workspaces', { cookie: adminCookie, body: { name: '지식 테스트 공간' } });
  assert.equal(workspace.status, 200, workspace.text);
  const email = 'knowledge-member@example.test';
  assert.equal((await req('POST', '/api/settings/invites', { cookie: adminCookie, body: { email, role: 'reception' } })).status, 200);
  const member = await req('POST', '/api/auth/invite/accept', { body: { ...credentials, name: '접수 담당자', token: await tokenFromOutbox(email, 'invite') } });
  assert.equal(member.status, 200, member.text);
  const memberLogin = await req('POST', '/api/auth/login', { body: { ...credentials, email } });
  assert.equal(memberLogin.status, 200, memberLogin.text);
  const memberCookie = memberLogin.cookie;
  assert.equal((await req('GET', '/api/knowledge', { cookie: memberCookie })).json.canReview, false);
  const proposal = await req('POST', '/api/knowledge', { cookie: memberCookie, body: { kind: '업무 절차', term: '전용 접수 규칙', note: '주문서에 기록', evidenceNote: '업무 문서' } });
  assert.equal(proposal.status, 200, proposal.text);
  const { id, revisionId } = proposal.json;
  assert.equal((await req('GET', k(id))).status, 404);
  assert.equal((await req('GET', k(id), { cookie: adminCookie })).json.item.status, 'pending');
  assert.equal((await review(id, revisionId, 'approve', { cookie: memberCookie })).status, 403);
  assert.equal((await req('DELETE', k(id), { cookie: memberCookie })).status, 403);
  assert.equal((await review(id, revisionId, 'approve', { cookie: adminCookie })).json.item.status, 'approved');
  assert.equal((await req('GET', k(id), { cookie: memberCookie })).json.item.status, 'approved');
  assert.equal((await req('DELETE', k(id), { cookie: adminCookie })).status, 200);
});

test('500개 상한과 쓰기 빈도 상한을 적용한다', async () => {
  const have = db().prepare("SELECT COUNT(*) AS n FROM glossary WHERE status <> 'archived'").get().n;
  const now = nowIso();
  const insert = db().prepare("INSERT INTO glossary(id, kind, term, status, source, created_at, updated_at) VALUES(?, '현장말', ?, 'approved', '사용자', ?, ?)");
  for (let i = have; i < 500; i++) insert.run(`g_fill${i}`, `채움${i}`, now, now);
  assert.equal((await req('POST', '/api/glossary', { body: { kind: '현장말', term: '하나더' } })).json.error, 'too_many');
  db().exec("DELETE FROM glossary WHERE id LIKE 'g_fill%'");
  let last;
  for (let i = 0; i < 121; i++) last = await req('DELETE', '/api/glossary/none', { ip: '10.1.9.9' });
  assert.equal(last.status, 429);
  assert.equal(last.json.error, 'rate_limited');
});
