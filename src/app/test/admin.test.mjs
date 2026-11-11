// routes/admin.mjs · routes/trial.mjs 시험: 시작 시 시드 · 로그인 · 체험 신청(동의 · 빈도 제한) · 관리자 보기 · 초기화 · 통화 지우기
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
const PASS = 'test-only-passcode-9';
process.env.ADMIN_PASSCODE = PASS;
const { db, nowIso } = await import('../lib/db.mjs');
const { Router } = await import('../lib/http.mjs');
const { createApp } = await import('../server.mjs');
const { config } = await import('../lib/config.mjs');
const { kstDay } = await import('../lib/security.mjs');
const { loadSeedFiles } = await import('../lib/seed.mjs');
const admin = await import('../routes/admin.mjs');
const trial = await import('../routes/trial.mjs');

const SEED_COUNT = loadSeedFiles().calls.length;
let server;
let base;
const logs = [];
const origLog = console.log;

before(async () => {
  console.log = (...a) => { logs.push(a.join(' ')); };
  await admin.start(); // 빈 DB → 가짜 데모 데이터
  const router = new Router();
  admin.register(router);
  trial.register(router);
  server = http.createServer(createApp(router));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  console.log = origLog;
  server.closeAllConnections?.();
  server.close();
});

async function req(method, p, { body, ip = '10.2.0.1', cookie } = {}) {
  const headers = { 'x-forwarded-for': ip };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await fetch(base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
}
const n = (sql, ...a) => db().prepare(sql).get(...a).n;
async function login(ip) {
  const r = await req('POST', '/api/admin/login', { body: { passcode: PASS }, ip });
  assert.equal(r.status, 200);
  return r.setCookie.split(';')[0];
}

test('start(): 빈 DB 에 가짜 통화와 사전을 넣고 로그를 남긴다', () => {
  assert.equal(n("SELECT COUNT(*) AS n FROM calls WHERE source = 'seed'"), SEED_COUNT);
  assert.ok(n("SELECT COUNT(*) AS n FROM glossary WHERE kind = '거래처'") === loadSeedFiles().customers.length);
  assert.ok(logs.some((l) => l.includes(`가짜 통화 ${SEED_COUNT}건`)));
});

test('로그인: 틀린 암호 401 · 맞으면 HttpOnly 쿠키 · me · 로그아웃', async () => {
  const me0 = await req('GET', '/api/admin/me');
  assert.deepEqual(me0.json, { admin: false });

  const wrong = await req('POST', '/api/admin/login', { body: { passcode: 'nope' }, ip: '10.2.1.1' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.error, 'wrong_passcode');
  assert.equal(wrong.setCookie, null);
  const missing = await req('POST', '/api/admin/login', { body: {}, ip: '10.2.1.1' });
  assert.equal(missing.status, 401);

  const ok = await req('POST', '/api/admin/login', { body: { passcode: PASS }, ip: '10.2.1.1' });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json, { ok: true });
  assert.match(ok.setCookie, /^cn_admin=[A-Za-z0-9_-]+;/);
  assert.match(ok.setCookie, /HttpOnly/);
  assert.match(ok.setCookie, /SameSite=Strict/);
  assert.ok(!JSON.stringify(ok.json).includes(PASS));
  const cookie = ok.setCookie.split(';')[0];
  assert.deepEqual((await req('GET', '/api/admin/me', { cookie })).json, { admin: true });

  const out = await req('POST', '/api/admin/logout', { body: {}, cookie });
  assert.equal(out.status, 200);
  assert.match(out.setCookie, /Max-Age=0/);
  assert.deepEqual((await req('GET', '/api/admin/me', { cookie })).json, { admin: false });
  // 로그에 암호를 남기지 않는다
  assert.ok(logs.some((l) => l === '[admin] login'));
  assert.ok(logs.some((l) => l === '[admin] login-failed'));
  assert.ok(!logs.some((l) => l.includes(PASS)));
});

test('로그인 빈도 제한: 같은 IP 10분에 5번', async () => {
  const ip = '10.2.2.2';
  for (let i = 0; i < 5; i++) assert.equal((await req('POST', '/api/admin/login', { body: { passcode: 'x' }, ip })).status, 401);
  const blocked = await req('POST', '/api/admin/login', { body: { passcode: PASS }, ip });
  assert.equal(blocked.status, 429);
});

test('관리자 전용 주소는 쿠키 없이 401', async () => {
  for (const [m, p, body] of [
    ['GET', '/api/admin/trials'], ['GET', '/api/admin/stats'], ['POST', '/api/admin/reset', { confirm: '초기화' }],
    ['DELETE', '/api/calls/fx-c01'], ['DELETE', '/api/admin/trials/x'],
  ]) {
    const r = await req(m, p, { body });
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.equal(r.json.error, 'admin_required');
  }
  assert.equal(n("SELECT COUNT(*) AS n FROM calls WHERE id = 'fx-c01'"), 1);
});

test('체험 신청: 동의 문구', async () => {
  const r = await req('GET', '/api/trial/policy');
  assert.equal(r.status, 200);
  assert.equal(r.json.purpose, '무료 체험 안내 연락');
  for (const w of ['이름', '소속', '연락처', '역할', '남긴 말']) assert.ok(r.json.items.includes(w), w);
  assert.match(r.json.retention, /2026-12-31/);
  assert.match(r.json.retention, /파기/);
  assert.match(r.json.notice, /동의하지 않을 권리/);
  assert.match(r.json.notice, /체험 안내를 받을 수 없/);
});

test('체험 신청: 동의 · 입력 검사', async () => {
  const good = { name: '가짜 이름', org: '가짜 대리점', contact: '010-0000-0300', role: '접수 담당', message: '써 보고 싶어요', consent: true };
  const cases = [
    [{ ...good, consent: false }, 'consent_required'],
    [{ ...good, consent: 'yes' }, 'consent_required'],
    [{ ...good, consent: undefined }, 'consent_required'],
    [{ ...good, name: '' }, 'required'],
    [{ ...good, name: '가'.repeat(41) }, 'too_long'],
    [{ ...good, contact: '' }, 'required'],
    [{ ...good, contact: '1234' }, 'too_short'],
    [{ ...good, contact: '전화 주세요 꼭이요' }, 'bad_contact'],
    [{ ...good, contact: 'a'.repeat(75) + '@x.com' }, 'too_long'],
    [{ ...good, org: '가'.repeat(61) }, 'too_long'],
    [{ ...good, role: '가'.repeat(31) }, 'too_long'],
    [{ ...good, message: '가'.repeat(501) }, 'too_long'],
  ];
  for (const [body, code] of cases) {
    const r = await req('POST', '/api/trial', { body, ip: '10.2.3.3' });
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
    assert.equal(r.json.error, code, JSON.stringify(body).slice(0, 80));
  }
  const noConsent = await req('POST', '/api/trial', { body: { ...good, consent: false } });
  assert.equal(noConsent.json.message, '개인정보 수집 · 이용에 동의해 주세요.');
  assert.equal(n('SELECT COUNT(*) AS n FROM trials'), 0, '잘못된 신청은 저장하지 않는다');
});

test('체험 신청: 저장 · 개인정보는 응답 · 로그에 없음 · IP 는 해시로만 · 같은 IP 1시간 3건', async () => {
  const ip = '10.2.4.4';
  const body = { name: '가짜 홍길동', org: '가짜 부품', contact: 'fake.person@example.com', role: '대표', message: '연락 주세요', consent: true };
  const logCount = logs.length;
  for (let i = 0; i < 3; i++) {
    const r = await req('POST', '/api/trial', { body: { ...body, name: `가짜 홍길동${i}` }, ip });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
  }
  const blocked = await req('POST', '/api/trial', { body, ip });
  assert.equal(blocked.status, 429);
  assert.equal(n('SELECT COUNT(*) AS n FROM trials'), 3);
  const row = db().prepare('SELECT * FROM trials LIMIT 1').get();
  assert.match(row.ip_hash, /^[0-9a-f]{16}$/);
  assert.ok(!JSON.stringify(row).includes(ip));
  assert.ok(row.consent_at);
  const newLogs = logs.slice(logCount).join('\n');
  assert.ok(!newLogs.includes('홍길동') && !newLogs.includes('example.com'));
  // 다른 IP 는 따로 센다 · 전화번호 연락처도 받는다
  const other = await req('POST', '/api/trial', { body: { name: '가짜 김', contact: '010 0000 0301', consent: true }, ip: '10.2.4.5' });
  assert.equal(other.status, 200);
});

test('관리자: 체험 신청 보기(최신순) · 하나 지우기 · 사용량', async () => {
  const cookie = await login('10.2.5.5');
  const list = await req('GET', '/api/admin/trials', { cookie });
  assert.equal(list.status, 200);
  assert.equal(list.json.trials.length, 4);
  assert.equal(list.json.total, 4);
  assert.equal(list.json.trials[0].name, '가짜 김');
  for (const t of list.json.trials) {
    assert.ok(t.id && t.createdAt && t.consentAt && t.contact);
    assert.ok(!('ip_hash' in t) && !('ipHash' in t));
  }
  const id = list.json.trials.at(-1).id;
  assert.equal((await req('DELETE', `/api/admin/trials/${id}`, { cookie })).status, 200);
  assert.equal((await req('DELETE', `/api/admin/trials/${id}`, { cookie })).status, 404);
  assert.equal(n('SELECT COUNT(*) AS n FROM trials'), 3);

  db().prepare("INSERT INTO usage(day, kind, count) VALUES(?, 'ai', 7)").run(kstDay());
  const st = await req('GET', '/api/admin/stats', { cookie });
  assert.equal(st.status, 200);
  assert.equal(st.json.day, kstDay());
  assert.deepEqual(st.json.usage, { ai: 7, upload: 0 });
  assert.deepEqual(st.json.limits, { ai: config.dailyAiLimit, upload: config.dailyUploadLimit });
  assert.equal(typeof st.json.glossary, 'number');
  assert.equal(st.json.calls.total, SEED_COUNT);
  assert.equal(st.json.calls.bySource.seed, SEED_COUNT);
  assert.ok(st.json.calls.today > 0);
  assert.equal(st.json.cards.total, SEED_COUNT);
  assert.ok(st.json.cards.byStatus.draft > 0);
  assert.equal(st.json.trials, 3);
  assert.equal(typeof st.json.worker.online, 'boolean');
  assert.ok('queue' in st.json.worker);
  assert.equal(typeof st.json.aiEnabled, 'boolean');
});

test('관리자: 통화 지우기(카드 · 일감 · 녹음 파일 함께)', async () => {
  const cookie = await login('10.2.6.6');
  const audioDir = path.join(config.dataDir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const wav = path.join(audioDir, 'up_del1.wav');
  fs.writeFileSync(wav, 'RIFF');
  const now = nowIso();
  db().prepare("INSERT INTO calls(id, created_at, recorded_at, source, status, is_fake, audio_file) VALUES('up_del1', ?, ?, 'upload', 'queued', 1, 'audio/up_del1.wav')").run(now, now);
  db().prepare("INSERT INTO jobs(id, call_id, state, created_at) VALUES('job_del1', 'up_del1', 'queued', ?)").run(now);
  const r = await req('DELETE', '/api/calls/up_del1', { cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, id: 'up_del1' });
  assert.equal(n("SELECT COUNT(*) AS n FROM jobs WHERE id = 'job_del1'"), 0);
  assert.equal(fs.existsSync(wav), false);
  assert.equal((await req('DELETE', '/api/calls/up_del1', { cookie })).status, 404);

  const s = await req('DELETE', '/api/calls/fx-c02', { cookie });
  assert.equal(s.status, 200);
  assert.equal(n("SELECT COUNT(*) AS n FROM cards WHERE call_id = 'fx-c02'"), 0);
  // DATA_DIR/audio 밖을 가리키는 경로는 지우지 않는다
  const outside = path.join(config.dataDir, 'keep.txt');
  fs.writeFileSync(outside, 'x');
  db().prepare("INSERT INTO calls(id, created_at, recorded_at, source, status, is_fake, audio_file) VALUES('up_del2', ?, ?, 'upload', 'ready', 1, 'keep.txt')").run(now, now);
  assert.equal((await req('DELETE', '/api/calls/up_del2', { cookie })).status, 200);
  assert.equal(fs.existsSync(outside), true);
});

test('관리자: 데모 초기화(확인 글자 필요) → 시드 다시 · 체험 신청은 그대로', async () => {
  const cookie = await login('10.2.7.7');
  const now = nowIso();
  db().prepare("INSERT INTO calls(id, created_at, recorded_at, source, status, is_fake) VALUES('live_r1', ?, ?, 'live', 'ready', 1)").run(now, now);
  db().prepare("INSERT INTO glossary(id, kind, term, status, source, created_at, updated_at) VALUES('g_r1', '현장말', '사용자말', 'approved', '사용자', ?, ?)").run(now, now);

  const noConfirm = await req('POST', '/api/admin/reset', { body: {}, cookie });
  assert.equal(noConfirm.status, 400);
  assert.equal(noConfirm.json.error, 'confirm_required');
  assert.equal(n("SELECT COUNT(*) AS n FROM calls WHERE id = 'live_r1'"), 1);

  const r = await req('POST', '/api/admin/reset', { body: { confirm: '초기화' }, cookie });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, seeded: SEED_COUNT });
  assert.equal(n('SELECT COUNT(*) AS n FROM calls'), SEED_COUNT);
  assert.equal(n("SELECT COUNT(*) AS n FROM calls WHERE id = 'fx-c02'"), 1, '지웠던 시드도 돌아온다');
  assert.equal(n("SELECT COUNT(*) AS n FROM glossary WHERE source = '사용자'"), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM trials'), 3);
  assert.ok(logs.includes('[admin] reset'));
});
