// 가짜 모델 전송과 메모리 SQLite만 사용한다. 포트나 실제 모델을 실행하지 않는다.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { Readable } from 'node:stream';
import { test } from 'node:test';

process.env.AI_PROVIDER = 'ollama';
process.env.ALLOW_PAID_AI = '0';
process.env.OLLAMA_MODEL = 'qwen3:4b';
const { openDb, setDb, withWorkspace } = await import('../lib/db.mjs');
const { kstDay } = await import('../lib/security.mjs');
const { buildDashboard, buildBriefingText, register } = await import('../routes/insights.mjs');

test('로컬 브리핑은 외부 제공자·다른 모델 캐시를 사용하지 않고 실제 출처를 보존한다', async (t) => {
  const memory = openDb(':memory:');
  setDb(memory);
  t.after(() => { setDb(null); memory.close(); });
  const day = kstDay();
  const now = new Date().toISOString();
  memory.prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title, transcript, is_fake)
    VALUES('fake-local', ?, ?, 'seed', 'ready', '가짜 로컬 검증', '가짜 주문입니다.', 1)`).run(now, now);
  const stats = buildDashboard(day).stats;
  const content = (provider) => JSON.stringify({ paragraph: '다른 제공자의 가짜 응답', todos: [], statsKey: JSON.stringify(stats), provider });
  memory.prepare('INSERT INTO briefings(day, content, model, created_at) VALUES(?, ?, ?, ?)')
    .run(day, content('anthropic'), 'qwen3:4b', now);
  let chatCalls = 0;
  t.mock.method(globalThis, 'fetch', () => { throw new Error('외부 호출 금지'); });
  t.mock.method(http, 'request', (options, respond) => {
    assert.equal(options.hostname, '127.0.0.1');
    const request = new EventEmitter();
    request.end = () => {
      const data = options.path === '/api/show' ? { model_info: { architecture: 'qwen3' } }
        : { done: true, model: 'qwen3:4b', message: { content: JSON.stringify({ paragraph: `가짜 로컬 응답 ${++chatCalls}`, todos: [] }) } };
      respond(Object.assign(Readable.from([Buffer.from(JSON.stringify(data))]), { statusCode: 200 }));
    };
    return request;
  });
  const posts = new Map();
  register({ get() {}, post: (path, fn) => posts.set(path, fn) });
  const make = () => posts.get('/api/briefing')({
    req: Object.assign(Readable.from([Buffer.from(JSON.stringify({ day }))]), { headers: { 'content-type': 'application/json' } }),
    ip: 'fake-local-test',
  });
  const first = await make();
  assert.equal(chatCalls, 1);
  assert.equal(first.mode, 'local');
  assert.equal(first.provider, 'ollama');
  assert.equal(buildDashboard(day).briefing.mode, 'local');
  assert.equal((await make()).paragraph, first.paragraph);
  assert.equal(chatCalls, 1, '같은 로컬 제공자와 모델의 새 캐시만 재사용한다');
  memory.prepare('UPDATE briefings SET model = ? WHERE day = ?').run('other-model:4b', day);
  await make();
  assert.equal(chatCalls, 2, '모델이 달라지면 다시 생성한다');
});

test('마감 요약은 개인 작업공간을 가짜 데모로 표시하지 않는다', () => {
  const memory = openDb(':memory:');
  setDb(memory);
  try {
    const day = kstDay();
    assert.match(buildBriefingText(day), /아맞다 마감 요약.*가짜 통화 데모/);
    const text = withWorkspace({ demo: false, workspace: { id: 'legacy' } }, () => buildBriefingText(day));
    assert.match(text, /아맞다 마감 요약/);
    assert.doesNotMatch(text, /가짜 통화 데모/);
  } finally { setDb(null); memory.close(); }
});
