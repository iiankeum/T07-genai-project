// 가짜 데이터만 사용하는 로컬 브라우저 E2E. 유료 AI 키를 전달하지 않는다.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const artifacts = path.resolve(process.env.E2E_OUTPUT_DIR || path.join(app, 'artifacts/e2e'));
const data = await mkdtemp(path.join(os.tmpdir(), 'ahmatda-fake-e2e-'));
await mkdir(artifacts, { recursive: true });
const results = [];
const errors = [];
const blocked = [];
const servers = [];
let browser;
let page;
let runError = null;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function server(mode, port) {
  const root = path.join(data, mode);
  const baseURL = `http://127.0.0.1:${port}`;
  const logs = [];
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: app,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, PORT: String(port), HOST: '127.0.0.1',
      DATA_DIR: root, PUBLIC_BASE_URL: baseURL, DEMO_MODE: mode === 'demo' ? '1' : '0',
      AI_PROVIDER: 'fixture', ALLOW_PAID_AI: '0', ANTHROPIC_API_KEY: '', AUTH_MAIL_MODE: 'outbox' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));
  child.on('error', (err) => errors.push(err.message));
  servers.push({ child, logs, mode });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null || logs.some((line) => /listen EPERM|listen EACCES/.test(line))) throw new Error(`Server exited: ${logs.join('')}`);
    try { if ((await fetch(baseURL + '/healthz', { signal: AbortSignal.timeout(500) })).ok) return { baseURL, root }; } catch { /* starting */ }
    await delay(100);
  }
  throw new Error(`Server failed to start: ${logs.join('')}`);
}
async function step(name, fn) {
  const start = performance.now();
  try { await fn(); results.push({ name, status: 'passed', elapsedMs: Math.round(performance.now() - start) }); console.log('PASS', name); }
  catch (error) { results.push({ name, status: 'failed', message: error.message }); throw error; }
}
async function screenshot(name) { await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: false }); }
async function settle() { await page.waitForTimeout(250); }
async function json(request, method, url, body, status = 200) {
  const response = await request[method](url, body === undefined ? {} : { data: body });
  assert.equal(response.status(), status, `${method} ${url}: ${await response.text()}`);
  return response.json();
}
try {
  const demo = await server('demo', Number(process.env.E2E_DEMO_PORT || 5627));
  const privateApp = await server('private', Number(process.env.E2E_PRIVATE_PORT || 5628));
  browser = await chromium.launch({ headless: true, ...(process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.protocol === 'data:') return route.continue();
    blocked.push(url.origin); return route.abort();
  });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  await step('dashboard prioritizes work and never creates AI briefing on entry', async () => {
    let briefPosts = 0;
    const record = (request) => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/briefing') briefPosts++; };
    page.on('request', record);
    await page.goto(demo.baseURL + '/#/');
    await page.getByRole('heading', { name: '지금 처리할 일', exact: true }).waitFor();
    await page.locator('#today-priority a').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('16px \"Pretendard JP Variable\"')), true, 'bundled font loads without external network');
    assert.equal(briefPosts, 0);
    assert.ok(await page.locator('#today-priority a').count() >= 3);
    await screenshot('09-today-work-queue-fake');
    await page.setViewportSize({ width: 360, height: 800 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'dashboard horizontal overflow');
    assert.ok(await page.locator('#today-priority a').first().evaluate(el => el.getBoundingClientRect().bottom < innerHeight - 62), 'first task must be visible above bottom navigation');
    await screenshot('10-today-mobile-fake');
    await page.locator('#bigTextBtn').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'large text dashboard horizontal overflow');
    await page.locator('#bigTextBtn').click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    page.off('request', record);
  });
  await step('call archive searches and preserves advanced filters', async () => {
    await page.goto(demo.baseURL + '/#/calls');
    await page.locator('.cl-item').first().waitFor();
    await page.locator('#cl-q').fill('신흥모터스');
    await page.waitForFunction(() => document.querySelector('.cl-count')?.textContent.includes('신흥모터스'));
    await page.locator('.cl-advanced summary').click();
    await page.locator('#cl-type').selectOption('주문');
    await page.waitForFunction(() => location.hash.includes('callType='));
    await screenshot('11-call-archive-fake');
    await page.reload();
    await page.locator('#cl-type').waitFor();
    assert.equal(await page.locator('#cl-type').inputValue(), '주문');
    assert.equal(await page.locator('#cl-q').inputValue(), '신흥모터스');
  });
  await step('desktop call loads with three columns and evidence', async () => {
    await page.goto(demo.baseURL + '/#/calls/fx-c51');
    await page.locator('[data-field="customer"]').waitFor();
    assert.equal(await page.locator('[data-field="customer"]').inputValue(), '신흥모터스');
    await page.locator('[data-ev="customer"] .cd-evbtn').click();
    await page.locator('.cd-connector.is-visible').waitFor();
    assert.ok(await page.locator('.cd-connector path').getAttribute('d'));
    assert.match(await page.locator('.cd-seg.is-mark').innerText(), /신흥모터스/);
    await settle();
    await screenshot('01-call-desktop-fake');
    assert.equal(await page.locator('[data-act="confirm"]').isDisabled(), true);
  });
  await step('autosave, human review, confirm, callback and shipping preserve states', async () => {
    await page.locator('[data-item="partNo"]').nth(0).fill('FAKE-001');
    await page.locator('[data-item="partNo"]').nth(1).fill('FAKE-002');
    await page.locator('[data-field="note"]').fill('가짜 E2E 검증 메모');
    await page.locator('[data-field="note"]').blur();
    await page.waitForFunction(() => !document.querySelector('.cd-save-error') && document.querySelector('[data-saved="note"]')?.textContent.includes('저장'), null, { timeout: 10000 });
    await page.locator('[data-review]').first().click();
    await page.locator('[data-act="confirm"]:enabled').waitFor();
    await page.locator('[data-act="confirm"]').click();
    await page.locator('[data-act="ship"]').waitFor();
    assert.equal(await page.locator('[data-field="customer"]').getAttribute('readonly'), '');
    await page.locator('[data-act="cb-open"]').click();
    await page.locator('.cd-callback textarea, .cd-callback input').fill('가짜 재연락 확인');
    await page.locator('[data-act="cb-on"]').click();
    await page.locator('[data-act="cb-off"]').waitFor();
    const card = await json(context.request, 'get', demo.baseURL + '/api/calls/fx-c51');
    assert.equal(card.card.status, 'confirmed'); assert.equal(card.card.callback, true);
    await page.locator('[data-act="ship"]').click();
    await page.getByRole('dialog').getByRole('button', { name: '예', exact: true }).click();
    await page.locator('[data-act="unship"]').waitFor();
    await screenshot('02-shipped-locked-fake');
    await page.reload();
    await page.locator('[data-act="unship"]').waitFor();
    assert.equal(await page.locator('[data-field="note"]').inputValue(), '가짜 E2E 검증 메모');
    const locked = await context.request.patch(demo.baseURL + '/api/cards/fx-c51', { data: { note: 'must not write' } });
    assert.equal(locked.status(), 409);
    await page.locator('[data-act="unship"]').click();
    await page.getByRole('dialog').getByRole('button', { name: '예', exact: true }).click();
    await page.locator('[data-act="ship"]').waitFor();
  });
  await step('mobile 360px navigation and card remain usable', async () => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(demo.baseURL + '/#/calls/fx-c51');
    await page.locator('[data-field="customer"]').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'horizontal overflow at 360px');
    await screenshot('03-call-mobile-fake');
    await page.setViewportSize({ width: 1440, height: 1000 });
  });
  await step('assistant uses saved fake calls and labels fixture responses', async () => {
    await page.goto(demo.baseURL + '/#/assistant?call=fx-c51');
    await page.locator('#as-question').fill('신흥모터스 주문에서 확인할 내용을 알려 주세요');
    await page.locator('[data-act="send"]:enabled').click();
    await page.locator('[data-act="stop"][hidden]').waitFor({ state: 'attached' });
    await page.getByText(/테스트 응답|고정 예시|가짜 응답|고정 응답/).first().waitFor();
    await screenshot('04-assistant-fixture');
  });
  await step('knowledge proposal requires separate approval', async () => {
    await page.goto(demo.baseURL + '/#/knowledge');
    await page.locator('[data-act="new"]').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('[name="term"]').fill('가짜 검증 부품');
    await dialog.locator('[name="aliases"]').fill('가짜 별칭');
    await dialog.locator('[name="note"]').fill('E2E에서 만든 가짜 지식입니다.');
    await dialog.locator('[name="evidenceNote"]').fill('가짜 E2E 시나리오');
    await dialog.locator('button[type="submit"]').click();
    await page.locator('[data-act="approve"]').first().waitFor();
    await screenshot('05-knowledge-pending-fake');
    await page.locator('[data-act="approve"]').first().click();
    const confirm = page.getByRole('dialog');
    if (await confirm.isVisible()) await confirm.locator('button[value="yes"]').click();
    await page.getByText('가짜 검증 부품', { exact: true }).first().waitFor();
  });
  await step('live fake sample can pause without claiming completion', async () => {
    await page.goto(demo.baseURL + '/#/live');
    await page.locator('[data-act="sample"]').click();
    await page.waitForFunction(() => document.querySelector('[data-ref="progress"]')?.value > 0);
    await page.locator('[data-act="pause"]').click();
    assert.equal(await page.locator('[data-act="pause"]').getAttribute('aria-pressed'), 'true');
    await screenshot('06-live-paused-fake');
    await page.locator('[data-act="sample"]').click();
    await page.locator('[data-act="save"]').click();
    await page.locator('[data-ref="goCall"]').waitFor();
  });
  await step('private signup, one-time verification, login and workspace isolation', async () => {
    await page.goto(privateApp.baseURL + '/#/signup');
    await page.locator('[name="name"]').fill('가짜 담당자');
    await page.locator('[name="email"]').fill('fake-e2e@example.invalid');
    await page.locator('[name="password"]').fill('Fake-E2E-1234');
    await page.locator('[name="agreeTerms"]').check();
    await page.locator('[name="agreePrivacy"]').check();
    await page.locator('.account-form button[type="submit"]').click();
    let mail;
    for (let attempt = 0; attempt < 50; attempt++) {
      const files = await readdir(path.join(privateApp.root, 'outbox')).catch(() => []);
      for (const file of files) { const m = JSON.parse(await readFile(path.join(privateApp.root, 'outbox', file), 'utf8')); if (m.kind === 'verify') mail = m; }
      if (mail) break; await delay(100);
    }
    assert.ok(mail, 'verification outbox created');
    const token = new URLSearchParams(new URL(mail.url).hash.split('?')[1]).get('token');
    await json(context.request, 'post', privateApp.baseURL + '/api/auth/verify', { token, password: 'Fake-E2E-1234' });
    const repeat = await context.request.post(privateApp.baseURL + '/api/auth/verify', { data: { token, password: 'Fake-E2E-1234' } });
    assert.equal(repeat.status(), 400);
    await page.goto(privateApp.baseURL + '/#/login');
    await page.locator('[name="email"]').fill('fake-e2e@example.invalid');
    await page.locator('[name="password"]').fill('Fake-E2E-1234');
    await page.locator('.account-form button[type="submit"]').click();
    await page.waitForURL('**/#/workspaces');
    await page.locator('#workspace-create [name="name"]').fill('가짜 검증 작업공간');
    await page.locator('#workspace-create button[type="submit"]').click();
    await page.waitForURL('**/#/calls');
    await page.getByRole('heading', { name: '통화 기록', exact: true }).waitFor();
    await page.goto(privateApp.baseURL + '/#/settings');
    await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
    await screenshot('07-private-settings-fake');
    const isolated = await context.request.get(privateApp.baseURL + '/api/calls/fx-c51');
    assert.equal(isolated.status(), 404);
    const calls = await json(context.request, 'get', privateApp.baseURL + '/api/calls');
    assert.equal(calls.total, 0);
    await page.goto(privateApp.baseURL + '/#/upload');
    await page.getByText('이 녹음의 수집·처리·공유 권한과 필요한 동의를 확인했습니다.').waitFor();
  });
  await step('stale tab cannot write or download after another tab switches workspace', async () => {
    const initial = await json(context.request, 'get', privateApp.baseURL + '/api/auth/me');
    const workspaceA = initial.access.workspace.id;
    await page.goto(privateApp.baseURL + '/#/settings/workspace');
    await page.locator('[name="name"]').waitFor();
    const second = await context.newPage();
    second.on('pageerror', (error) => errors.push(error.message));
    await second.goto(privateApp.baseURL + '/#/workspaces');
    await second.locator('#workspace-create [name="name"]').fill('가짜 다른 작업공간');
    await second.locator('#workspace-create button[type="submit"]').click();
    await second.waitForURL('**/#/calls');
    await page.locator('[name="name"]').fill('다른 공간에 저장되면 안 되는 가짜 변경');
    const response = page.waitForResponse((r) => r.url().endsWith('/api/settings/workspace') && r.request().method() === 'PATCH');
    await page.locator('.account-form button[type="submit"]').click();
    assert.equal((await response).status(), 409);
    await page.locator('#workspaceChangedNotice').waitFor();
    const current = await json(context.request, 'get', privateApp.baseURL + '/api/auth/me');
    assert.equal(current.access.workspace.name, '가짜 다른 작업공간');
    const exported = await context.request.get(privateApp.baseURL + '/api/settings/data/export?workspace=' + workspaceA);
    assert.equal(exported.status(), 409);
    await screenshot('08-workspace-conflict-fake');
    await second.close();
  });
  assert.deepEqual(errors, [], 'browser page errors');
  await rm(path.join(artifacts, 'failure.png'), { force: true });
  console.log(`PASS ${results.length} browser journeys; paid provider disabled`);
} catch (error) {
  process.exitCode = 1;
  runError = error.message;
  console.error(error);
  if (page) await screenshot('failure').catch(() => {});
} finally {
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ at: new Date().toISOString(), fixtureOnly: true, paidProviderEnabled: false, runError, results, pageErrors: errors, blockedExternalOrigins: [...new Set(blocked)] }, null, 2));
  await browser?.close();
  for (const { child, logs, mode } of servers) { child.kill('SIGTERM'); await writeFile(path.join(artifacts, mode + '-server.log'), logs.join('')); }
}
