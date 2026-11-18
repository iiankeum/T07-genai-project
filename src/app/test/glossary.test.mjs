// routes/glossary.mjs 시험: 보기 · 넣기 · 고치기 · 지우기 · 기본 항목은 관리자만 · 500개 상한
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
process.env.ADMIN_PASSCODE = 'test-only-passcode-7';
const { db, nowIso } = await import('../lib/db.mjs');
const { Router } = await import('../lib/http.mjs');
const { createApp } = await import('../server.mjs');
const { adminLogin } = await import('../lib/security.mjs');
const { dictionaryForAi, customerByPhone } = await import('../lib/repo.mjs');
const { seedDemo, loadSeedFiles } = await import('../lib/seed.mjs');
const glossary = await import('../routes/glossary.mjs');

let server;
let base;
let adminCookie;

before(async () => {
  await seedDemo({ reset: true });
  const router = new Router();
  glossary.register(router);
  server = http.createServer(createApp(router));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  adminCookie = `cn_admin=${adminLogin('test-only-passcode-7')}`;
});
after(() => { server.closeAllConnections?.(); server.close(); });

async function req(method, p, { body, ip = '10.1.0.1', cookie, raw } = {}) {
  const headers = { 'x-forwarded-for': ip };
  if (body !== undefined) headers['content-type'] = raw ? 'text/plain' : 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await fetch(base + p, { method, headers, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json };
}
const n = (sql, ...a) => db().prepare(sql).get(...a).n;

test('GET: 기본 사전 · 종류별 · 거래처는 가짜 번호 그대로', async () => {
  const all = await req('GET', '/api/glossary');
  assert.equal(all.status, 200);
  assert.deepEqual(all.json.kinds, ['현장말', '오인식', '거래처', '차종']);
  assert.equal(all.json.items.length, all.json.total);
  assert.equal(all.json.max, 500);
  assert.equal(all.json.items[0].kind, '현장말');
  const cu = await req('GET', '/api/glossary?kind=' + encodeURIComponent('거래처'));
  assert.equal(cu.json.items.length, loadSeedFiles().customers.length);
  for (const it of cu.json.items) {
    assert.equal(it.source, '기본');
    assert.match(it.phone, /^010-0000-01\d\d$/);
    for (const k of ['id', 'kind', 'term', 'standard', 'phone', 'note', 'status', 'source', 'createdAt']) assert.ok(k in it, k);
  }
  const bad = await req('GET', '/api/glossary?kind=nope');
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'bad_kind');
});

test('POST: 넣기 → 사용자 항목 · 같은 낱말은 409 · AI 사전에 바로 반영', async () => {
  const r = await req('POST', '/api/glossary', { body: { kind: '현장말', term: '  헨다 ', standard: '휀다', note: '받아쓰기가 자주 틀림' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.item.term, '헨다');
  assert.equal(r.json.item.source, '사용자');
  assert.equal(r.json.item.status, 'approved');
  assert.equal(r.json.id, r.json.item.id);
  assert.equal(r.json.item.phone, null);
  assert.ok(dictionaryForAi().glossary.some((g) => g.term === '헨다' && g.standard === '휀다'));

  const dup = await req('POST', '/api/glossary', { body: { kind: '현장말', term: '헨다' } });
  assert.equal(dup.status, 409);
  assert.equal(dup.json.error, 'duplicate');
  const dupBase = await req('POST', '/api/glossary', { body: { kind: '현장말', term: '휀다' } });
  assert.equal(dupBase.status, 409);
  const otherKind = await req('POST', '/api/glossary', { body: { kind: '오인식', term: '헨다', standard: '휀다' } });
  assert.equal(otherKind.status, 200);

  // 새로 넣은 사용자 항목이 그 종류 맨 위에 온다
  const list = await req('GET', '/api/glossary?kind=' + encodeURIComponent('현장말'));
  assert.equal(list.json.items[0].term, '헨다');
});

test('POST: 입력 검사', async () => {
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
    const r = await req('POST', '/api/glossary', { body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.json.error, code, JSON.stringify(body));
    assert.ok(r.json.message);
  }
  const notJson = await req('POST', '/api/glossary', { body: 'kind=현장말', raw: true });
  assert.equal(notJson.status, 415);
  // 거래처가 아닌 종류의 번호는 버린다
  const r = await req('POST', '/api/glossary', { body: { kind: '차종', term: '가짜차 X1', phone: '010-0000-0999' } });
  assert.equal(r.status, 200);
  assert.equal(n("SELECT COUNT(*) AS n FROM glossary WHERE term = '가짜차 X1' AND phone IS NULL"), 1);
});

test('거래처 번호: 가짜 꼴은 그대로, 그 밖은 가려서 보이고 고칠 때 가린 값은 그대로 둔다 · F11 에 쓰인다', async () => {
  const fake = await req('POST', '/api/glossary', { body: { kind: '거래처', term: '가짜상회', phone: '010-0000-0199' } });
  assert.equal(fake.json.item.phone, '010-0000-0199');
  assert.equal(customerByPhone('01000000199'), '가짜상회');

  const other = await req('POST', '/api/glossary', { body: { kind: '거래처', term: '가짜모터', phone: '010-1234-5678' } });
  assert.equal(other.status, 200);
  assert.equal(other.json.item.phone, '010-****-5678');
  const id = other.json.item.id;
  const keep = await req('PATCH', `/api/glossary/${id}`, { body: { phone: '010-****-5678', note: '메모' } });
  assert.equal(keep.status, 200);
  assert.equal(db().prepare('SELECT phone FROM glossary WHERE id = ?').get(id).phone, '010-1234-5678');
  assert.equal(keep.json.item.note, '메모');
  const change = await req('PATCH', `/api/glossary/${id}`, { body: { phone: '010-0000-0198' } });
  assert.equal(change.json.item.phone, '010-0000-0198');
});

test('PATCH · DELETE: 사용자 항목은 누구나, 같은 낱말로 바꾸면 409', async () => {
  const a = await req('POST', '/api/glossary', { body: { kind: '현장말', term: '쇼바대', standard: '쇼크업소버' } });
  const id = a.json.item.id;
  const up = await req('PATCH', `/api/glossary/${id}`, { body: { standard: '쇼크 업소버', term: '쇼바통' } });
  assert.equal(up.status, 200);
  assert.equal(up.json.item.term, '쇼바통');
  assert.equal(up.json.item.standard, '쇼크 업소버');
  const clash = await req('PATCH', `/api/glossary/${id}`, { body: { term: '쇼바' } });
  assert.equal(clash.status, 409);
  const empty = await req('PATCH', `/api/glossary/${id}`, { body: { term: '' } });
  assert.equal(empty.status, 400);
  const del = await req('DELETE', `/api/glossary/${id}`);
  assert.equal(del.status, 200);
  assert.deepEqual(del.json, { ok: true, id });
  assert.equal((await req('DELETE', `/api/glossary/${id}`)).status, 404);
  assert.equal((await req('PATCH', `/api/glossary/${id}`, { body: { note: 'x' } })).status, 404);
});

test('기본 항목: 고치기 · 지우기는 관리자만', async () => {
  const row = db().prepare("SELECT id FROM glossary WHERE source = '기본' AND term = '마후라'").get();
  const noPatch = await req('PATCH', `/api/glossary/${row.id}`, { body: { note: '바꿈' } });
  assert.equal(noPatch.status, 401);
  assert.equal(noPatch.json.error, 'admin_required');
  const noDel = await req('DELETE', `/api/glossary/${row.id}`);
  assert.equal(noDel.status, 401);
  assert.equal(n('SELECT COUNT(*) AS n FROM glossary WHERE id = ?', row.id), 1);
  const wrongCookie = await req('DELETE', `/api/glossary/${row.id}`, { cookie: 'cn_admin=not-a-session' });
  assert.equal(wrongCookie.status, 401);

  const okPatch = await req('PATCH', `/api/glossary/${row.id}`, { body: { note: '관리자가 고침' }, cookie: adminCookie });
  assert.equal(okPatch.status, 200);
  assert.equal(okPatch.json.item.note, '관리자가 고침');
  const okDel = await req('DELETE', `/api/glossary/${row.id}`, { cookie: adminCookie });
  assert.equal(okDel.status, 200);
  assert.equal(n('SELECT COUNT(*) AS n FROM glossary WHERE id = ?', row.id), 0);
});

test('전체 500개가 차면 더 넣지 못한다', async () => {
  const have = n('SELECT COUNT(*) AS n FROM glossary');
  const now = nowIso();
  const stmt = db().prepare("INSERT INTO glossary(id, kind, term, status, source, created_at, updated_at) VALUES(?, '현장말', ?, 'approved', '사용자', ?, ?)");
  for (let i = have; i < 500; i++) stmt.run(`g_fill${i}`, `채움${i}`, now, now);
  const r = await req('POST', '/api/glossary', { body: { kind: '현장말', term: '하나더' } });
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'too_many');
  db().exec("DELETE FROM glossary WHERE id LIKE 'g_fill%'");
});

test('쓰기 빈도 제한(같은 IP 10분 120번)', async () => {
  let last;
  for (let i = 0; i < 121; i++) last = await req('DELETE', '/api/glossary/none', { ip: '10.1.9.9' });
  assert.equal(last.status, 429);
  assert.equal(last.json.error, 'rate_limited');
});
