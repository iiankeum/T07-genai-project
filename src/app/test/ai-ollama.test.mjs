import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { PassThrough, Readable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';

process.env.AI_PROVIDER = 'ollama';
process.env.ALLOW_PAID_AI = '1';
process.env.ANTHROPIC_API_KEY = '가짜-키';
delete process.env.OLLAMA_MODEL;

const ai = await import('../lib/ai.mjs');

const MODEL = 'qwen3:4b';
const INSTALLED = { model_info: { 'general.architecture': 'qwen3' } };
const TRANSCRIPT = '가짜 공업사입니다. 앞범퍼 두 개 주문할게요.';
const CARD = {
  call_type: '주문', customer: '가짜 공업사', contact: null, car_model: null, model_year: null, plate: null,
  items: [{ part: '앞범퍼', side: null, qty: 2, part_no: null, quote: '앞범퍼 두 개' }],
  urgent: false, due: null, delivery: null, ask_back: [], unsure: [], fixes: [], note: null,
  evidence: { customer: '가짜 공업사', contact: '', car_model: '', model_year: '', plate: '', urgent: '', due: '', delivery: '' },
  highlights: [], summary: '앞범퍼 두 개 주문',
};
const BRIEFING = { paragraph: '앞범퍼 두 개 주문을 확인해 주세요.', todos: [] };
const ANSWER = { answer: '두 개 주문하셨습니다.', found: true, citations: [{ ref: 'c1', quote: '앞범퍼 두 개' }] };

function reply(body, statusCode = 200, headers = {}) {
  const bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return Object.assign(Readable.from([bytes]), { statusCode, headers });
}

function chat(data, options = {}) {
  return reply({ model: MODEL, message: { content: JSON.stringify(data) }, done: true, done_reason: 'stop', ...options });
}

function mockOllama(t, handle) {
  const seen = [];
  const fetch = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('외부 API는 테스트에서 호출하지 않는다');
  });
  t.after(() => assert.equal(fetch.mock.callCount(), 0));
  t.mock.method(http, 'request', (options, onResponse) => {
    const request = new EventEmitter();
    request.end = (body) => {
      const input = { options, payload: JSON.parse(body) };
      seen.push(input);
      const response = handle(input, request);
      if (response) {
        options.signal.addEventListener('abort', () => response.destroy(options.signal.reason), { once: true });
        onResponse(response);
      }
    };
    return request;
  });
  return seen;
}

test('Ollama 선택은 카드 · 브리핑 · 묻기에 같은 스키마를 사용한다', async (t) => {
  const outputs = [CARD, BRIEFING, ANSWER];
  const seen = mockOllama(t, ({ options }) => options.path === '/api/show' ? reply(INSTALLED) : chat(outputs.shift()));

  assert.deepEqual(ai.aiStatus(), { aiEnabled: true, aiProvider: 'ollama', model: MODEL });
  ai.takeAiDaily();
  assert.deepEqual(await ai.extractCard({ transcript: TRANSCRIPT }), { ...CARD, _model: MODEL });
  assert.deepEqual(await ai.writeBriefing({ day: '2026-11-17', stats: {}, cards: [] }), { ...BRIEFING, model: MODEL });
  assert.deepEqual(await ai.answerQuestion({ question: '앞범퍼 몇 개 주문했어요?', contexts: [{ ref: 'c1', text: TRANSCRIPT }] }),
    { ...ANSWER, model: MODEL });

  assert.deepEqual(seen.map(({ options }) => options.path), ['/api/show', '/api/chat', '/api/show', '/api/chat', '/api/show', '/api/chat']);
  for (const { options, payload } of seen) {
    assert.equal(options.hostname, '127.0.0.1');
    assert.equal(options.port, 11434);
    assert.equal(options.agent, false);
    assert.equal(options.method, 'POST');
    assert.equal(payload.model, MODEL);
    if (options.path === '/api/show') assert.deepEqual(payload, { model: MODEL });
  }
  const requests = seen.filter(({ options }) => options.path === '/api/chat').map(({ payload }) => payload);
  assert.deepEqual(requests.map(({ format }) => format), [ai.CARD_SCHEMA, ai.BRIEFING_SCHEMA, ai.ANSWER_SCHEMA]);
  for (const payload of requests) {
    assert.deepEqual(payload.messages.map(({ role }) => role), ['system', 'user']);
    assert.equal(payload.stream, false);
    assert.equal(payload.think, false);
    assert.ok(payload.options.num_predict > 0);
  }
  assert.ok(requests[0].messages[1].content.includes(TRANSCRIPT));
});

test('원격 이름과 주소는 로컬 모델로 설정할 수 없다', async (t) => {
  t.after(() => delete process.env.OLLAMA_MODEL);
  process.env.OLLAMA_MODEL = 'team/qwen3.5:4b-q4_k_m';
  const { config } = await import('../lib/config.mjs?custom-model');
  assert.equal(config.ollamaModel, process.env.OLLAMA_MODEL);
  const remoteModels = ['qwen3:cloud', 'qwen3:4b-cloud', 'gpt-oss:120b-cloud', 'qwen3-cloud', 'https://ollama.com/qwen3', 'hf.co/team/qwen3'];
  for (const [index, model] of remoteModels.entries()) {
    process.env.OLLAMA_MODEL = model;
    await assert.rejects(import(`../lib/config.mjs?remote-model=${index}`), /OLLAMA_MODEL/, model);
  }
});

test('설치 확인이 실패하면 모델에 통화 글을 보내지 않는다', async (t) => {
  const replies = [
    [reply({ ...INSTALLED, remote_host: 'https://example.invalid', remote_model: 'cloud-model' }), 'local_model_unavailable'],
    [reply({ error: 'missing' }, 404), 'local_model_unavailable'],
    [reply({}, 307, { location: 'https://example.invalid/api/chat' }), 'local_unavailable'],
  ];
  for (const [response, code] of replies) {
    await t.test(code, async (subtest) => {
      const seen = mockOllama(subtest, () => response);
      await assert.rejects(ai.extractCard({ transcript: TRANSCRIPT }), { code });
      assert.equal(seen.length, 1);
      assert.equal(seen[0].options.path, '/api/show');
      assert.deepEqual(seen[0].payload, { model: MODEL });
      assert.equal(response.destroyed, true);
    });
  }
});

test('스키마 오류 · 토큰 상한 · 너무 큰 응답은 실패하고 다시 호출하지 않는다', async (t) => {
  const replies = [chat({ ...CARD, items: [{ ...CARD.items[0], qty: '2' }] }),
    chat(CARD, { done_reason: 'length' }), reply('x'.repeat(1024 * 1024 + 1))];
  const seen = mockOllama(t, ({ options }) => options.path === '/api/show' ? reply(INSTALLED) : replies.shift());
  for (let i = 0; i < 3; i++) {
    await assert.rejects(ai.extractCard({ transcript: TRANSCRIPT }), { code: 'bad_output' });
  }
  assert.equal(seen.length, 6);
});

test('연결에 실패하면 로컬 오류를 반환한다', async (t) => {
  const seen = mockOllama(t, (_, request) => {
    request.emit('error', new Error('ECONNREFUSED'));
    return null;
  });
  await assert.rejects(ai.extractCard({ transcript: TRANSCRIPT }), (err) =>
    err.code === 'local_unavailable' && ai.aiHttpError(err).status === 503);
  assert.equal(seen.length, 1);
});

test('응답을 읽는 동안에도 시간 제한이 적용된다', async (t) => {
  const body = Object.assign(new PassThrough(), { statusCode: 200 });
  const seen = mockOllama(t, ({ options }) => options.path === '/api/show' ? reply(INSTALLED) : body);
  await Promise.all([
    assert.rejects(ai.extractCard({ transcript: TRANSCRIPT }, { timeoutMs: 20 }), (err) =>
      err.code === 'local_timeout' && ai.aiHttpError(err).status === 504),
    wait(50),
  ]);
  assert.equal(seen.length, 2);
  assert.equal(body.destroyed, true);
});

test('호출자가 취소하면 요청을 중단하며 취소 이유를 전달한다', async (t) => {
  const controller = new AbortController();
  const reason = new Error('질문 취소');
  const started = Promise.withResolvers();
  const seen = mockOllama(t, ({ options }, request) => {
    if (options.path === '/api/show') return reply(INSTALLED);
    options.signal.addEventListener('abort', () => request.emit('error', options.signal.reason), { once: true });
    started.resolve();
    return null;
  });
  const out = ai.answerQuestion({ question: '앞범퍼 몇 개 주문했어요?', contexts: [TRANSCRIPT] }, { signal: controller.signal });
  await started.promise;
  controller.abort(reason);
  await assert.rejects(out, (err) => err === reason);
  assert.equal(seen.length, 2);
});


test('앱 전용 Ollama 포트는 두 loopback 포트만 허용한다', async (t) => {
  t.after(() => delete process.env.AHMATDA_OLLAMA_PORT);
  process.env.AHMATDA_OLLAMA_PORT = '11435';
  const { config } = await import('../lib/config.mjs?app-local-port');
  assert.equal(config.ollamaPort, 11435);
  for (const [i, value] of ['443', '0', 'http://example.com', '11435/path'].entries()) {
    process.env.AHMATDA_OLLAMA_PORT = value;
    await assert.rejects(import(`../lib/config.mjs?invalid-local-port=${i}`), /AHMATDA_OLLAMA_PORT/);
  }
});
