// 가짜 WAV를 올리고 모의 일꾼 결과를 보내는 전체 API 경로. 외부 모델 키가 있어도 네트워크를 쓰지 않는다.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { makeWav, sleep, startServer } from './fixtures/worker-helpers.mjs';
import { FIXTURE_MODEL, OFFLINE_WORKER_LINES } from '../lib/ai-fixture.mjs';
import { LIVE_SAMPLE } from '../public/js/live-samples.js';

const dataDir = mkdtempSync(path.join(os.tmpdir(), 'ahmatda-offline-'));
const workerToken = 'offline-test-worker-token';
const workerName = 'offline-test-worker';
process.env.DATA_DIR = dataDir;
process.env.DEMO_MODE = '1';
process.env.AI_PROVIDER = 'fixture';
process.env.ALLOW_PAID_AI = '1';
process.env.ANTHROPIC_API_KEY = 'offline-test-key';
process.env.WORKER_TOKEN = workerToken;
process.env.FFMPEG_PATH = 'offline-test-ffmpeg-unavailable';
delete process.env.PUBLIC_BASE_URL;

const routes = await Promise.all([
  import('../routes/system.mjs'), import('../routes/upload.mjs'), import('../routes/worker.mjs'),
  import('../routes/calls.mjs'), import('../routes/live.mjs'), import('../routes/insights.mjs'),
]);
const { kstDay, usageCount } = await import('../lib/security.mjs');

let server;
const realFetch = globalThis.fetch;
const outwardRequests = [];
before(async () => {
  server = await startServer(routes);
  globalThis.fetch = (input, options) => {
    const url = new URL(input?.url ?? input);
    if (url.origin !== server.base) {
      outwardRequests.push(url.origin);
      throw new Error('테스트 범위 밖의 요청');
    }
    return realFetch(input, options);
  };
});
after(async () => {
  globalThis.fetch = realFetch;
  await server?.close();
  rmSync(dataDir, { recursive: true, force: true });
  assert.deepEqual(outwardRequests, []);
});

async function post(url, body, { worker = false, status = 200 } = {}) {
  const res = await fetch(server.base + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(worker ? { Authorization: `Bearer ${workerToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const result = await res.json();
  assert.equal(res.status, status, JSON.stringify(result));
  return result;
}

test('가짜 업로드 → 일꾼 결과 → 카드 · 브리핑 · 근거 있는 답변', async () => {
  const meta = await (await fetch(server.base + '/api/meta')).json();
  assert.equal(meta.aiEnabled, true);
  assert.equal(meta.aiProvider, 'fixture');
  assert.equal(meta.model, FIXTURE_MODEL);

  const form = new FormData();
  form.set('fakeConfirm', 'yes');
  form.set('file', new Blob([makeWav(2)], { type: 'audio/wav' }), '가짜-통화.wav');
  const upload = await fetch(server.base + '/api/calls/upload', { method: 'POST', body: form });
  const queued = await upload.json();
  assert.equal(upload.status, 201, JSON.stringify(queued));
  const lease = await post('/api/worker/claim', { worker: workerName }, { worker: true });
  assert.equal(lease.callId, queued.callId);
  const segments = OFFLINE_WORKER_LINES.map((text, i) => ({ text, start: i, end: i + 1 }));
  const complete = await post(`/api/worker/jobs/${lease.jobId}/result`, {
    worker: workerName, text: OFFLINE_WORKER_LINES.join('\n'), segments, durationSec: 2, engine: 'fixture-worker',
  }, { worker: true });
  assert.equal(complete.callId, queued.callId);

  let call;
  for (let i = 0; i < 100; i += 1) {
    call = await (await fetch(server.base + `/api/calls/${queued.callId}`)).json();
    if (call.status === 'ready') break;
    await sleep(20);
  }
  assert.equal(call.status, 'ready');
  assert.equal(call.engine, 'fixture-worker');
  assert.equal(call.card.aiModel, FIXTURE_MODEL);
  assert.equal(call.card.customer, '가짜별정비소');
  assert.equal(call.card.items[0].partNo, '86511-A0000');
  assert.equal(call.card.items[0].at, 0);

  const day = kstDay();
  const briefing = await post('/api/briefing', { day });
  assert.equal(briefing.model, FIXTURE_MODEL);
  assert.equal(briefing.mode, 'fixture');
  assert.equal(briefing.todos[0].callId, queued.callId);

  const response = await post('/api/ask', { question: '가짜별정비소 앞범퍼 주문 알려 줘' });
  assert.equal(response.found, true);
  assert.equal(response.mode, 'fixture');
  assert.equal(response.model, FIXTURE_MODEL);
  assert.equal(response.citations[0].callId, queued.callId);
  assert.match(response.citations[0].quote, /앞범퍼/);
  const missing = await post('/api/ask', { question: '존재하지않는우주선부품은?' });
  assert.equal(missing.found, false);
  assert.deepEqual(missing.citations, []);
  assert.equal(usageCount('ai', day), 0);
});

test('실시간 가짜 대화는 수량 정정을 반영하고 임의 글은 수동 카드로 남긴다', async () => {
  const lines = LIVE_SAMPLE.map((line) => line.text);
  const early = await post('/api/live/extract', { text: lines.slice(0, 3).join('\n') });
  assert.equal(early.model, FIXTURE_MODEL);
  assert.equal(early.card.items[0].qty, 2);
  const text = lines.join('\n');
  const late = await post('/api/live/extract', { text });
  assert.equal(late.card.items[0].qty, 3);
  assert.equal(late.card.plate, '12가3456');
  assert.equal(late.card.urgent, true);

  const segments = lines.map((line, i) => ({ text: line, start: i, end: i + 1 }));
  const stored = await post('/api/live/save', { text, segments });
  assert.equal(stored.call.card.aiModel, FIXTURE_MODEL);
  assert.equal(stored.call.card.items[0].qty, 3);

  const unknown = await post('/api/live/save', { text: '등록된 예시와 다른 직접 입력입니다.' });
  assert.equal(unknown.call.status, 'ready');
  assert.equal(unknown.call.card.aiModel, null);
  assert.deepEqual(unknown.call.card.items, []);
  assert.match(unknown.call.card.aiError, /가짜 테스트 응답이 준비된 대화가 아닙니다/);
});
