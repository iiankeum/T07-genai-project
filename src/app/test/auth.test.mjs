import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

process.env.DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'ahmatda-auth-'));
process.env.AUTH_MAIL_MODE = 'outbox';
process.env.DEMO_MODE = '0';
process.env.AI_PROVIDER = 'off';
process.env.WORKER_TOKEN = 'fake-worker-only-test';
process.env.LEGACY_WORKSPACE_OWNER_EMAIL = 'legacy@example.test';
const { buildRouter, createApp } = await import('../server.mjs');
const { db, globalDb, withWorkspace, dataDir, nowIso } = await import('../lib/db.mjs');
const { accountDb, machineWorkspace } = await import('../lib/auth.mjs');
const { makeWav } = await import('./fixtures/worker-helpers.mjs');

const PASSWORD = 'ahmatda123';
const consent = { agreeTerms: true, agreePrivacy: true };
const owner = 'owner@example.test';
const other = 'other@example.test';
let srv, base, ownerCookie, otherCookie, workspaceA, workspaceB;
let ips = 1;

before(async () => {
  const { router } = await buildRouter();
  srv = http.createServer(createApp(router));
  await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(async () => {
  await new Promise((resolve) => { srv.closeAllConnections(); srv.close(resolve); });
});

async function request(url, { method = 'GET', cookie, body, ...custom } = {}) {
  const headers = { 'x-forwarded-for': `198.51.100.${ips++}`, ...custom.headers };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const post = (url, body, cookie) => request(url, { method: 'POST', body, cookie });
const authPost = (url, body, cookie) => post('/api/auth/' + url, body, cookie);
const readCookie = (response) => response.headers.get('set-cookie')?.split(';')[0];
function mailToken(email, kind) {
  const dir = path.join(process.env.DATA_DIR, 'outbox');
  const mail = readdirSync(dir).sort((a, b) => a.localeCompare(b)).map((file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8')))
    .filter((m) => m.to === email && m.kind === kind).at(-1);
  assert.ok(mail, `가짜 메일 ${kind} ${email}`);
  const hash = new URL(mail.url).hash.slice(1);
  return kind === 'invite' ? hash.split('/').at(-1) : new URLSearchParams(hash.split('?')[1]).get('token');
}
async function addAccount(email, name) {
  const created = await authPost('signup', { email, name, password: PASSWORD, ...consent });
  assert.equal(created.status, 200);
  const token = mailToken(email, 'verify');
  assert.equal((await authPost('verify', { token, password: PASSWORD })).status, 200);
  const loggedIn = await authPost('login', { email, password: PASSWORD, remember: true });
  assert.equal(loggedIn.status, 200);
  return readCookie(loggedIn);
}
async function ownWorkspace(name, cookie) {
  const response = await authPost('workspaces', { name }, cookie);
  assert.equal(response.status, 200);
  return (await response.json()).access.workspace.id;
}

test('가입과 인증: 약관 동의, 인증한 주소 소유자의 암호 설정, 1회용 링크, HttpOnly 세션', async () => {
  assert.equal((await request('/api/calls')).status, 401);
  assert.equal((await authPost('signup', { email: owner, name: '가짜 관리자', password: PASSWORD })).status, 400);
  const created = await authPost('signup', { email: owner, name: '가짜 관리자', password: PASSWORD, ...consent });
  assert.equal(created.status, 200);
  assert.equal((await authPost('login', { email: owner, password: PASSWORD })).status, 403);
  const token = mailToken(owner, 'verify');
  assert.equal((await authPost('verify', { token, password: 'short' })).status, 400);
  const verifiedPassword = 'mailboxOwner123';
  assert.equal((await authPost('verify', { token, password: verifiedPassword })).status, 200);
  assert.equal((await authPost('verify', { token, password: PASSWORD })).status, 400);
  assert.equal((await authPost('login', { email: owner, password: PASSWORD })).status, 401);
  const loggedIn = await authPost('login', { email: owner, password: verifiedPassword, remember: true });
  assert.equal(loggedIn.status, 200);
  assert.match(loggedIn.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=2592000/);
  ownerCookie = readCookie(loggedIn);
  const dbUser = accountDb().prepare('SELECT password_hash, verified_at FROM users WHERE email = ?').get(owner);
  assert.match(dbUser.password_hash, /^scrypt:/);
  assert.ok(dbUser.verified_at);
  assert.doesNotMatch(dbUser.password_hash, /mailboxOwner123/);
  assert.equal((await request('/api/calls', { cookie: ownerCookie })).status, 403);
  workspaceA = await ownWorkspace('가짜 워크스페이스 A', ownerCookie);
  otherCookie = await addAccount(other, '가짜 구성원 B');
  workspaceB = await ownWorkspace('가짜 워크스페이스 B', otherCookie);
});

test('워크스페이스별 SQLite, 검색, AI 근거, 녹음 경로, 데이터 내보내기를 분리한다', async () => {
  const visibleId = 'same-call';
  const hiddenId = 'only-a';
  const aWav = makeWav(0.12, { freq: 400 });
  const bWav = makeWav(0.16, { freq: 800 });
  const seed = (ws, title, text, wav, addHidden) => withWorkspace(machineWorkspace(ws), () => {
    const now = nowIso();
    const insert = db().prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title, transcript, audio_file, is_fake)
      VALUES(?, ?, ?, 'upload', 'ready', ?, ?, ?, 1)`);
    mkdirSync(path.join(dataDir(), 'audio'), { recursive: true });
    writeFileSync(path.join(dataDir(), 'audio', 'same.wav'), wav);
    insert.run(visibleId, now, now, title, text, 'audio/same.wav');
    if (addHidden) insert.run(hiddenId, now, now, '가짜 A 전용', text, null);
  });
  seed(workspaceA, '가짜 A 이름', '가짜 A 단독표현', aWav, true);
  seed(workspaceB, '가짜 B 이름', '가짜 B 단독표현', bWav, false);
  const aCalls = await request('/api/calls?q=단독표현', { cookie: ownerCookie });
  const bCalls = await request('/api/calls?q=단독표현', { cookie: otherCookie });
  assert.equal((await aCalls.json()).total, 2);
  const scoped = await bCalls.json();
  assert.equal(scoped.total, 1);
  assert.equal(scoped.calls[0].title, '가짜 B 이름');
  assert.equal((await request('/api/calls/' + hiddenId, { cookie: otherCookie })).status, 404);
  assert.equal((await request('/api/assistant?callId=' + hiddenId, { cookie: otherCookie })).status, 404);
  const bAudio = await request('/api/calls/' + visibleId + '/audio', { cookie: otherCookie });
  assert.equal(bAudio.status, 200);
  assert.deepEqual(Buffer.from(await bAudio.arrayBuffer()), bWav);
  assert.equal((await request('/api/calls/' + hiddenId + '/audio', { cookie: otherCookie })).status, 404);
  const exportRes = await request('/api/settings/data/export', { cookie: otherCookie });
  assert.match(exportRes.headers.get('content-disposition'), /attachment/);
  assert.doesNotMatch(await exportRes.text(), /가짜 A/);
  assert.equal((await authPost('workspaces/switch', { workspaceId: workspaceA }, otherCookie)).status, 403);
});

test('초대 수락, 재발송, 취소, 역할, 비활성화와 마지막 관리자 보호', async () => {
  const invitee = 'viewer@example.test';
  const invited = await post('/api/settings/invites', { email: invitee, role: 'viewer' }, ownerCookie);
  assert.equal(invited.status, 200);
  const firstToken = mailToken(invitee, 'invite');
  const list = async () => (await request('/api/settings/members', { cookie: ownerCookie })).json();
  const inviteId = (await list()).invites[0].id;
  await new Promise((r) => setTimeout(r, 2));
  assert.equal((await post('/api/settings/invites/' + inviteId + '/resend', {}, ownerCookie)).status, 200);
  assert.equal((await authPost('invite/info', { token: firstToken })).status, 400);
  const newToken = mailToken(invitee, 'invite');
  assert.equal((await authPost('invite/accept', { token: newToken, name: '가짜 열람자', password: PASSWORD, ...consent })).status, 200);
  assert.equal((await authPost('invite/accept', { token: newToken })).status, 400);
  const viewerLogin = await authPost('login', { email: invitee, password: PASSWORD });
  assert.equal(viewerLogin.status, 200);
  assert.doesNotMatch(viewerLogin.headers.get('set-cookie'), /Max-Age/);
  const viewerCookie = readCookie(viewerLogin);
  assert.equal((await request('/api/calls/same-call', { cookie: viewerCookie })).status, 200);
  assert.equal((await request('/api/cards/same-call', { method: 'PATCH', body: { customer: '가짜 변경' }, cookie: viewerCookie })).status, 403);
  assert.equal((await post('/api/cards/same-call/ship', {}, viewerCookie)).status, 403);
  assert.equal((await request('/api/settings/data/export', { cookie: viewerCookie })).status, 403);
  assert.equal((await request('/api/settings/members', { cookie: viewerCookie })).status, 403);
  const { members } = await list();
  const adminId = members.find((m) => m.email === owner).id;
  const subId = members.find((m) => m.email === invitee).id;
  const memberPatch = (id, body) => request('/api/settings/members/' + id, { method: 'PATCH', body, cookie: ownerCookie });
  assert.equal((await memberPatch(adminId, { role: 'viewer' })).status, 409);
  assert.equal((await memberPatch(subId, { role: 'shipping' })).status, 200);
  // 출고 담당에게 배송 변경은 허용된다. 이 샘플 통화에는 주문 카드가 없다.
  assert.notEqual((await post('/api/cards/same-call/ship', {}, viewerCookie)).status, 403);
  assert.equal((await memberPatch(subId, { active: false })).status, 200);
  assert.equal((await request('/api/calls', { cookie: viewerCookie })).status, 403);
  const cancelEmail = 'cancel@example.test';
  assert.equal((await post('/api/settings/invites', { email: cancelEmail, role: 'reception' }, ownerCookie)).status, 200);
  const cancelId = (await list()).invites.find((i) => i.email === cancelEmail).id;
  const cancelToken = mailToken(cancelEmail, 'invite');
  assert.equal((await request('/api/settings/invites/' + cancelId, { method: 'DELETE', cookie: ownerCookie })).status, 200);
  assert.equal((await authPost('invite/info', { token: cancelToken })).status, 400);
});

test('로그인 잠금과 만료된 재설정 링크를 거르고 비밀번호 변경 시 기존 세션을 폐기한다', async () => {
  for (let i = 0; i < 4; i++) assert.equal((await authPost('login', { email: other, password: 'invalid-123' })).status, 401);
  assert.equal((await authPost('login', { email: other, password: 'invalid-123' })).status, 429);
  assert.equal((await authPost('login', { email: other, password: PASSWORD })).status, 429);
  assert.equal((await authPost('password/request', { email: other })).status, 200);
  const old = mailToken(other, 'reset');
  accountDb().prepare("UPDATE account_links SET expires_at = 0 WHERE kind = 'reset' AND email = ?").run(other);
  assert.equal((await authPost('password/reset', { token: old, password: 'newpass123' })).status, 400);
  await new Promise((r) => setTimeout(r, 2));
  assert.equal((await authPost('password/request', { email: other })).status, 200);
  const token = mailToken(other, 'reset');
  assert.equal((await authPost('password/reset', { token, password: 'newpass123' })).status, 200);
  assert.equal((await authPost('password/reset', { token, password: 'newpass123' })).status, 400);
  assert.equal((await request('/api/calls', { cookie: otherCookie })).status, 401);
  const loggedIn = await authPost('login', { email: other, password: 'newpass123' });
  assert.equal(loggedIn.status, 200);
  otherCookie = readCookie(loggedIn);
  assert.equal((await authPost('logout', {}, otherCookie)).status, 200);
  assert.equal((await request('/api/calls', { cookie: otherCookie })).status, 401);
});

test('명시적인 이전 자료 관리자와 워크스페이스에 묶인 일꾼만 접근한다', async () => {
  globalDb().prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title)
    VALUES('legacy-only', ?, ?, 'ingest', 'ready', '가짜 이전 통화')`).run(nowIso(), nowIso());
  assert.equal((await request('/api/calls/legacy-only', { cookie: ownerCookie })).status, 404);
  const legacyCookie = await addAccount(process.env.LEGACY_WORKSPACE_OWNER_EMAIL, '가짜 이전 관리자');
  assert.equal((await request('/api/calls/legacy-only', { cookie: legacyCookie })).status, 200);
  process.env.WORKER_WORKSPACE_ID = workspaceA;
  const heartbeat = await request('/api/worker/heartbeat', {
    method: 'POST', body: { worker: 'fake-worker' }, headers: { Authorization: `Bearer ${process.env.WORKER_TOKEN}`, 'X-Workspace-Id': workspaceB },
  });
  assert.equal(heartbeat.status, 200);
  const a = await request('/api/worker/status', { cookie: ownerCookie });
  assert.equal((await a.json()).worker, 'fake-worker');
  const legacy = await request('/api/worker/status', { cookie: legacyCookie });
  assert.equal((await legacy.json()).worker, null);
  const machineStatus = await request('/api/worker/status', { headers: { Authorization: `Bearer ${process.env.WORKER_TOKEN}` } });
  assert.equal(machineStatus.status, 200);
  assert.equal((await machineStatus.json()).worker, 'fake-worker');
  assert.equal((await request('/api/worker/status', {
    cookie: ownerCookie, headers: { Authorization: 'Bearer wrong' },
  })).status, 401);
});

test('다른 탭에서 워크스페이스를 바꿨으면 이전 탭의 읽기와 저장을 차단한다', async () => {
  const nextWorkspace = await ownWorkspace('가짜 전환 대상', ownerCookie);
  const requestInTab = (workspaceId, url, options = {}) => request(url, {
    ...options, cookie: ownerCookie, headers: { 'X-Ahmatda-Workspace': workspaceId },
  });
  const live = { method: 'POST', body: { text: '가짜 통화 실시간 기록 테스트입니다.' } };
  const settings = { method: 'PATCH', body: { retentionDays: 25 } };
  const upload = (workspaceId) => {
    const body = new FormData();
    body.append('file', new Blob([makeWav(0.12)], { type: 'audio/wav' }), 'fake.wav');
    body.append('fakeConfirm', 'yes');
    return fetch(base + '/api/calls/upload', {
      method: 'POST', body, headers: { Cookie: ownerCookie, 'X-Ahmatda-Workspace': workspaceId },
    });
  };
  const checkConflict = async (response) => {
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'workspace_changed');
  };
  await checkConflict(await requestInTab(workspaceA, '/api/calls'));
  await checkConflict(await requestInTab(workspaceA, '/api/live/save', live));
  await checkConflict(await upload(workspaceA));
  await checkConflict(await requestInTab(workspaceA, '/api/settings/data', settings));
  await checkConflict(await request('/api/settings/data/export?workspace=' + workspaceA, { cookie: ownerCookie }));

  const calls = await requestInTab(nextWorkspace, '/api/calls');
  assert.equal(calls.status, 200);
  assert.equal((await calls.json()).total, 0);
  assert.equal((await requestInTab(nextWorkspace, '/api/live/save', live)).status, 200);
  assert.equal((await upload(nextWorkspace)).status, 201);
  assert.equal((await requestInTab(nextWorkspace, '/api/settings/data', settings)).status, 200);
});
