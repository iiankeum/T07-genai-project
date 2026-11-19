// 로컬 가짜 앱 전용. 먼저 공통 Montage 번들을 생성한다.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = new URL(process.env.AHCHA_SHELL_FIXTURE_URL || 'http://127.0.0.1:5627');
assert.equal(base.protocol, 'http:');
assert.equal(base.hostname, '127.0.0.1');
const metaResponse = await fetch(new URL('/api/meta', base));
assert.ok(metaResponse.ok);
const meta = await metaResponse.json();
assert.equal(meta.demo, true, '운영 계정에서는 실행하지 않는다');
const artifacts = process.env.E2E_OUTPUT_DIR || 'artifacts/montage-shell';
await mkdir(artifacts, { recursive: true });
const b = await chromium.launch({ headless: true, ...(process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {}) });
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: 'block' });
  await ctx.route('**/*', (r) => new URL(r.request().url()).origin === base.origin ? r.continue() : r.abort());
  const p = await ctx.newPage();
  const diagnostics = [];
  p.on('pageerror', (e) => diagnostics.push(e.message));
  p.on('console', (entry) => { if (entry.type() === 'error') diagnostics.push(entry.text()); });
  p.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/montage/') && !response.ok()) diagnostics.push(`HTTP ${response.status()} ${response.url()}`);
  });
  await p.goto(new URL('/#/calls?q=test', base).href);
  try {
    await p.locator('#tabBar.ahcha-montage-shell [data-component="bottom-navigation"]').waitFor({ timeout: 8000 });
  } catch (e) {
    const moduleError = await p.evaluate(() => import('/montage/shell.js').then(() => null, (error) => String(error)));
    throw new Error(`Montage shell did not appear: ${JSON.stringify({ moduleError, diagnostics, viewport: await p.viewportSize() })}`, { cause: e });
  }
  assert.equal(await p.locator('#tabBar a[aria-current=page]').getAttribute('href'), '#/calls');
  await p.locator('#tabBar a[href="#/more"]').click();
  await p.getByRole('heading', { name: '모든 도구', exact: true }).waitFor();
  await p.locator('#tabBar a[href="#/more"][aria-current="page"]').waitFor({ timeout: 8000 });
  assert.equal(await p.locator('#tabBar a[aria-current=page]').getAttribute('href'), '#/more');
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.screenshot({ path: artifacts + '/mobile-fake.png' });
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.locator('#sideNav a[href="#/knowledge?tab=customer"]').click();
  await p.waitForURL('**/#/knowledge?tab=customer');
  // Updating the hash precedes the route's asynchronous navigation render.
  await p.locator('#sideNav a[href="#/knowledge?tab=customer"][aria-current="page"]').waitFor({ timeout: 8000 });
  assert.equal(await p.locator('#sideNav a[aria-current=page]').getAttribute('href'), '#/knowledge?tab=customer');
  await p.locator('#headerCommands a[href="#/upload"]').waitFor();
  await p.locator('#workerPill').waitFor();
  await p.screenshot({ path: artifacts + '/desktop-fake.png' });
  const fallback = await ctx.newPage();
  await fallback.route('**/montage/shell.js', (r) => r.abort());
  await fallback.goto(new URL('/#/calls?q=test', base).href);
  await fallback.locator('#sideNav .nav-link[aria-current=page]').waitFor();
  assert.equal(await fallback.locator('#sideNav .nav-link[aria-current=page]').getAttribute('href'), '#/calls');
  assert.equal(await fallback.locator('#sideNav.ahcha-montage-shell').count(), 0);
  console.log('PASS Montage shell mobile/desktop, route state, worker, fallback');
} finally {
  await b.close();
}
