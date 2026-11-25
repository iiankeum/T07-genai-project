import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { releaseReadiness } from '../tools/release-readiness.mjs';
const byId = (r, id) => r.checks.find(c => c.id === id);
test('readiness defaults match demo/off and never claim release ready', () => {
  const r = releaseReadiness();
  assert.equal(byId(r, 'workspace-mode').status, 'blocked');
  assert.match(byId(r, 'order-ai').message, /꺼져/);
  assert.equal(r.releaseReady, false);
  assert.equal(r.automaticProcessingVerified, false);
});
test('outbox and fixture remain blockers, arbitrary mail mode cannot certify delivery', () => {
  for (const mail of ['outbox', ' outbox ', 'smtp', '']) {
    const r = releaseReadiness({ DEMO_MODE: '0', AI_PROVIDER: 'fixture', AUTH_MAIL_MODE: mail });
    assert.equal(byId(r, 'workspace-mode').status, 'configured');
    assert.equal(byId(r, 'account-mail').status, 'blocked');
    assert.equal(byId(r, 'order-ai').status, 'blocked');
  }
});
test('configured local/paid providers and tokens do not prove actual integration', () => {
  for (const provider of ['ollama', 'anthropic']) {
    const r = releaseReadiness({ AI_PROVIDER: provider, WORKER_TOKEN: 'fake-secret', ALLOW_PAID_AI: '1' });
    assert.equal(byId(r, 'order-ai').status, 'unverified');
    assert.equal(byId(r, 'transcription').status, 'unverified');
    assert.equal(byId(r, 'paid-guard').status, 'unverified');
    assert.equal(r.releaseReady, false);
  }
});
test('team address format is not a live HTTPS validation', () => {
  for (const url of ['', 'broken', 'http://example.invalid', 'https://u:secret@example.invalid', 'https://example.invalid/path', 'https://localhost', 'https://example.invalid/?token=secret']) {
    assert.equal(byId(releaseReadiness({ PUBLIC_BASE_URL: url }), 'team-address').status, 'blocked');
  }
  assert.equal(byId(releaseReadiness({ PUBLIC_BASE_URL: 'https://team.example.invalid' }), 'team-address').status, 'unverified');
});
test('all input values including unknown provider and URL credentials are redacted', () => {
  const sentinel = 'FAKE-SENSITIVE-DO-NOT-PRINT';
  const r = releaseReadiness(Object.fromEntries(['AI_PROVIDER', 'AUTH_MAIL_MODE', 'PUBLIC_BASE_URL', 'DATA_DIR', 'WORKER_TOKEN', 'ANTHROPIC_API_KEY', 'LEGACY_WORKSPACE_OWNER_EMAIL'].map(k => [k, sentinel])));
  assert.ok(!JSON.stringify(r).includes(sentinel));
  assert.equal(byId(r, 'order-ai').status, 'blocked');
});
test('CLI has a non-success exit for unresolved readiness; no environment dump', () => {
  const r = spawnSync(process.execPath, ['tools/release-readiness.mjs'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { PATH: process.env.PATH, AUTH_MAIL_MODE: 'outbox', WORKER_TOKEN: 'fake-cli-secret' } });
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(r.stdout).releaseReady, false);
  assert.ok(!r.stdout.includes('fake-cli-secret'));
  const bad = spawnSync(process.execPath, ['tools/release-readiness.mjs', '--fake-secret-argument'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(bad.status, 64);
  assert.ok(!bad.stderr.includes('--fake-secret-argument'));
});
