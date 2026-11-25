// 이 PC 안에 띄운 비공개 시험 서버에 시험 계정 · 작업공간 · 녹음 연결 토큰을 만든다.
// 비밀값은 시험 폴더의 파일에만 쓰고 화면에 찍지 않는다. 공개 서버에는 돌리지 않는다(아래에서 막는다).
// 쓰는 법(시험 서버를 켠 뒤): node setup-account.mjs
//   ACHA_TEST_URL  시험 서버 주소. 기본값 http://127.0.0.1:5610
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { home } from './_paths.mjs';

const base = (process.env.ACHA_TEST_URL || 'http://127.0.0.1:5610').replace(/\/$/, '');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)) {
  console.error('이 도구는 이 PC 안의 시험 서버에만 쓴다. 공개 서버 주소로는 돌리지 않는다.');
  process.exit(1);
}
const acctFile = path.join(home, 'test-account.env');
const ingestFile = path.join(home, 'ingest.env');
const outbox = path.join(home, 'data', 'outbox');

let cookie = '';
async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', origin: base, ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
  let json = null;
  try { json = await res.json(); } catch { /* 본문 없음 */ }
  return { status: res.status, json };
}

const health = await fetch(base + '/healthz');
console.log('healthz', health.status);

let email, password;
if (fs.existsSync(acctFile)) {
  const env = Object.fromEntries(fs.readFileSync(acctFile, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
  email = env.TEST_EMAIL; password = env.TEST_PASSWORD;
  console.log('account file: reuse');
} else {
  // 서버가 AUTH_MAIL_MODE=outbox 라서 인증 메일이 실제로 나가지 않고 data/outbox 에 파일로 남는다. 그 링크로 인증한다.
  email = process.env.ACHA_TEST_EMAIL || 'local-test@acha.test';
  password = randomBytes(18).toString('base64url') + 'a1!';
  const before = new Set(fs.existsSync(outbox) ? fs.readdirSync(outbox) : []);
  const s = await call('POST', '/api/auth/signup', { email, name: '실제녹음 시험', password, agreeTerms: true, agreePrivacy: true });
  console.log('signup', s.status, s.json?.error ?? '');
  const files = fs.readdirSync(outbox).filter((f) => !before.has(f));
  if (!files.length) throw new Error('인증 링크 파일이 없다');
  const link = JSON.parse(fs.readFileSync(path.join(outbox, files[0]), 'utf8'));
  const token = /token=([^&#]+)/.exec(link.url)?.[1];
  const v = await call('POST', '/api/auth/verify', { token, password });
  console.log('verify', v.status, v.json?.error ?? '');
  fs.writeFileSync(acctFile, `TEST_EMAIL=${email}\nTEST_PASSWORD=${password}\n`);
}

const l = await call('POST', '/api/auth/login', { email, password });
console.log('login', l.status, l.json?.error ?? '', 'workspace:', l.json?.workspaceId ? 'yes' : 'none');

let me = await call('GET', '/api/auth/me');
let wsId = me.json?.workspaces?.[0]?.id ?? l.json?.workspaceId ?? null;
if (!wsId) {
  const w = await call('POST', '/api/auth/workspaces', { name: '실제 녹음 시험(비공개)' });
  console.log('create workspace', w.status, w.json?.error ?? '');
  me = await call('GET', '/api/auth/me');
  wsId = me.json?.workspaces?.[0]?.id ?? null;
}
console.log('workspaces:', me.json?.workspaces?.length, 'access ws matches:', me.json?.access?.workspace?.id === wsId);
console.log('workspace id shape ok:', /^ws_/.test(String(wsId)));

const integ = await call('GET', '/api/settings/integrations');
console.log('integrations', integ.status, 'aiMode:', integ.json?.aiMode, 'ingestConfigured:', integ.json?.ingestConfigured);
if (!fs.existsSync(ingestFile) || !integ.json?.ingestConfigured) {
  const t = await call('POST', '/api/settings/ingest-token');
  console.log('ingest token', t.status, t.json?.token ? 'issued' : (t.json?.error ?? 'none'));
  if (t.json?.token) fs.writeFileSync(ingestFile, `SERVER_URL=${base}\nINGEST_TOKEN=${t.json.token}\n`);
}

// 서버가 받아쓰기 일꾼을 이 작업공간에 묶도록 설정 파일에 작업공간 번호를 적는다(서버를 다시 켜야 적용된다).
const envFile = path.join(home, 'server.env');
const env = fs.readFileSync(envFile, 'utf8');
if (!/^WORKER_WORKSPACE_ID=/m.test(env)) {
  fs.writeFileSync(envFile, env.replace(/\s*$/, '\n') + `WORKER_WORKSPACE_ID=${wsId}\n`);
  console.log('server.env: WORKER_WORKSPACE_ID added');
} else console.log('server.env: WORKER_WORKSPACE_ID already set');
fs.writeFileSync(path.join(home, 'workspace-id.txt'), String(wsId) + '\n');
