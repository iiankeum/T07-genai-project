// lib/ai.mjs 시험: 가짜 Claude 클라이언트로 호출 모양 · 오류 처리 · 동시 2개 · 브리핑 · 묻기 검증. 진짜 API 는 부르지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
process.env.ANTHROPIC_API_KEY = ''; // 진짜 키가 있어도 시험에서는 쓰지 않는다

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const ai = await import('../lib/ai.mjs');
const { HttpError } = await import('../lib/http.mjs');
const { config } = await import('../lib/config.mjs');

const textResp = (obj, extra = {}) => ({
  id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn',
  content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], ...extra,
});

/** 가짜 클라이언트: handler(params, {plain}) 가 응답을 돌려주거나 throw */
function fakeClient(handler) {
  const calls = [];
  const make = (plain) => async (params, opts) => {
    calls.push({ params, opts, plain });
    return handler(params, { plain, n: calls.length });
  };
  return { calls, beta: { messages: { create: make(false) } }, messages: { create: make(true) } };
}

const apiErr = (Cls, status, type) => new Cls(status, { type: 'error', error: { type, message: 'x' } }, 'x', new Headers());

const CARD = {
  customer: '새한카센터', contact: null, car_model: '아반떼 AD', model_year: '2017', plate: null,
  items: [{ part: '앞범퍼', side: null, qty: 1, part_no: null, quote: '앞범퍼 하나 있어요' }],
  urgent: true, due: '오전 중', delivery: '배송', ask_back: [], unsure: [], fixes: [], note: null,
  evidence: { customer: '새한카센터인데요', contact: '', car_model: '아반떼 에이디', model_year: '십칠 년식', plate: '', urgent: '좀 급해요', due: '오전 중으로', delivery: '' },
  highlights: [{ text: '앞범퍼', kind: 'part' }], summary: '아반떼 AD 앞범퍼 1개, 오전 배송',
};
const INPUT = {
  transcript: '네, 부품 대리점입니다. 예, 새한카센터인데요.',
  segments: [{ start: 0, end: 1, text: '네, 부품 대리점입니다.' }, { start: 1.6, end: 5, text: '예, 새한카센터인데요. 아반떼 에이디 앞범퍼 하나 있어요?' }],
  glossary: [{ term: '휀다', standard: '펜더', kind: '현장말' }, { term: '헨더', standard: '휀다', kind: '오인식' }],
  customers: ['새한카센터', { name: '우리공업사', phone: '010-0000-0000' }],
  carModels: ['아반떼 AD'],
};

function walkSchema(s, where, out) {
  if (!s || typeof s !== 'object') return;
  if (s.type === 'object' || (Array.isArray(s.type) && s.type.includes('object'))) {
    out.push({ where, ok: s.additionalProperties === false && JSON.stringify([...(s.required || [])].sort()) === JSON.stringify(Object.keys(s.properties || {}).sort()) });
    for (const [k, v] of Object.entries(s.properties || {})) walkSchema(v, `${where}.${k}`, out);
  }
  if (s.items) walkSchema(s.items, `${where}[]`, out);
}

test('키도 가짜 클라이언트도 없으면 AI 꺼짐 · no_key', async () => {
  ai.setClientForTest(null);
  assert.equal(ai.aiEnabled(), false);
  await assert.rejects(ai.extractCard(INPUT), (e) => e instanceof ai.AiError && e.code === 'no_key');
  const h = ai.aiHttpError(new ai.AiError('no_key'));
  assert.ok(h instanceof HttpError);
  assert.equal(h.status, 503);
  assert.equal(h.code, 'ai_disabled');
});

test('스키마: 모든 object 에 additionalProperties:false 와 required 전부', () => {
  for (const [name, schema] of Object.entries({ card: ai.CARD_SCHEMA, brief: ai.BRIEFING_SCHEMA, answer: ai.ANSWER_SCHEMA })) {
    const out = [];
    walkSchema(schema, name, out);
    assert.ok(out.length > 0);
    for (const o of out) assert.ok(o.ok, `${o.where} 스키마 규칙 위반`);
  }
  // API 한도: null 가능(type 배열 · anyOf) 칸은 스키마마다 16개까지
  const countUnions = (s) => {
    if (!s || typeof s !== 'object') return 0;
    let n = Array.isArray(s.type) || Array.isArray(s.anyOf) ? 1 : 0;
    for (const v of Object.values(s.properties || {})) n += countUnions(v);
    if (s.items) n += countUnions(s.items);
    return n;
  };
  for (const schema of [ai.CARD_SCHEMA, ai.BRIEFING_SCHEMA, ai.ANSWER_SCHEMA]) assert.ok(countUnions(schema) <= 16, `union ${countUnions(schema)}개`);
  // 카드 스키마에 새 칸이 있다
  for (const k of ['call_type', 'contact', 'delivery', 'evidence', 'highlights', 'summary']) assert.ok(k in ai.CARD_SCHEMA.properties, k);
  assert.ok('side' in ai.CARD_SCHEMA.properties.items.items.properties);
  assert.ok('quote' in ai.CARD_SCHEMA.properties.items.items.properties);
});

test('extractCard: 호출 모양(모델 · 베타 · 대체 모델 · effort low · 구조화 출력, thinking/temperature/prefill 없음)', async () => {
  const fake = fakeClient(() => textResp(CARD, { model: 'claude-opus-5-5' }));
  ai.setClientForTest(fake);
  assert.equal(ai.aiEnabled(), true);
  const out = await ai.extractCard(INPUT);
  assert.equal(out.customer, '새한카센터');
  assert.equal(out._model, 'claude-opus-5-5');
  assert.equal(fake.calls.length, 1);
  const { params, plain } = fake.calls[0];
  assert.equal(plain, false);
  assert.equal(params.model, config.model);
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(params.fallbacks, 'default');
  assert.equal(params.output_config.effort, 'low');
  assert.equal(params.output_config.format.type, 'json_schema');
  assert.equal(params.output_config.format.schema, ai.CARD_SCHEMA);
  assert.ok(!('thinking' in params));
  assert.ok(!('temperature' in params) && !('top_p' in params) && !('top_k' in params));
  assert.equal(params.messages.length, 1);
  assert.equal(params.messages[0].role, 'user');
  assert.ok(typeof params.system === 'string' && params.system.includes('품번을 스스로 지어내거나'));
  // 사전과 받아쓴 글은 사용자 글(자료)에 들어간다 · 거래처 전화번호는 보내지 않는다
  const user = params.messages[0].content;
  assert.ok(user.includes('휀다 = 펜더'));
  assert.ok(user.includes('헨더 → 휀다'));
  assert.ok(user.includes('우리공업사'));
  assert.ok(!user.includes('010-0000-0000'));
  assert.ok(user.includes('예, 새한카센터인데요. 아반떼 에이디 앞범퍼 하나 있어요?'));
});

test('extractCard: 거절 · 길이 초과 · JSON 아님 → AiError', async () => {
  ai.setClientForTest(fakeClient(() => textResp('', { stop_reason: 'refusal', content: [] })));
  await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'refused');
  ai.setClientForTest(fakeClient(() => textResp('{"customer":', { stop_reason: 'max_tokens' })));
  await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'bad_output');
  ai.setClientForTest(fakeClient(() => textResp('주문 카드입니다')));
  await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'bad_output');
  ai.setClientForTest(fakeClient(() => textResp({ customer: 'x' }))); // items 없음
  await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'bad_output');
  ai.setClientForTest(fakeClient(() => textResp(CARD)));
  await assert.rejects(ai.extractCard({ transcript: '   ', segments: [] }), (e) => e.code === 'bad_output');
});

test('베타 호출이 400 이면 한 번만 기본 호출(betas · fallbacks 없이)로 다시', async () => {
  const fake = fakeClient((params, { plain }) => {
    if (!plain) throw apiErr(Anthropic.BadRequestError, 400, 'invalid_request_error');
    return textResp(CARD, { model: 'claude-opus-5-5' });
  });
  ai.setClientForTest(fake);
  const out = await ai.extractCard(INPUT);
  assert.equal(out.customer, '새한카센터');
  assert.equal(fake.calls.length, 2);
  assert.equal(fake.calls[1].plain, true);
  assert.ok(!('betas' in fake.calls[1].params));
  assert.ok(!('fallbacks' in fake.calls[1].params));
  assert.equal(fake.calls[1].params.output_config.effort, 'low');

  // 기본 호출도 400 이면 api_error, 세 번째는 없다
  const fake2 = fakeClient(() => { throw apiErr(Anthropic.BadRequestError, 400, 'invalid_request_error'); });
  ai.setClientForTest(fake2);
  await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'api_error');
  assert.equal(fake2.calls.length, 2);
});

test('오류 바꾸기: 429 → rate_limited, 401 → api_error(로그엔 인증 실패만), 그 밖 → api_error', async () => {
  const logs = [];
  const orig = console.error;
  console.error = (...a) => logs.push(a.join(' '));
  try {
    ai.setClientForTest(fakeClient(() => { throw apiErr(Anthropic.RateLimitError, 429, 'rate_limit_error'); }));
    await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'rate_limited');
    ai.setClientForTest(fakeClient(() => { throw apiErr(Anthropic.AuthenticationError, 401, 'authentication_error'); }));
    await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'api_error');
    ai.setClientForTest(fakeClient(() => { throw apiErr(Anthropic.InternalServerError, 500, 'api_error'); }));
    await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'api_error');
    ai.setClientForTest(fakeClient(() => { throw new Anthropic.APIConnectionError({ message: 'conn' }); }));
    await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'api_error');
    ai.setClientForTest(fakeClient(() => { throw new TypeError('boom'); }));
    await assert.rejects(ai.extractCard(INPUT), (e) => e.code === 'api_error');
  } finally {
    console.error = orig;
  }
  const all = logs.join('\n');
  assert.ok(all.includes('인증 실패'));
  assert.ok(!all.includes('새한카센터'), '로그에 요청 글이 들어가면 안 된다');
  assert.equal(ai.aiHttpError(new ai.AiError('rate_limited')).status, 429);
  assert.equal(ai.aiHttpError(new ai.AiError('refused')).code, 'ai_refused');
  assert.equal(ai.aiHttpError(new ai.AiError('bad_output')).status, 502);
});

test('동시에 도는 AI 호출은 최대 2개', async () => {
  let now = 0;
  let max = 0;
  ai.setClientForTest(fakeClient(async () => {
    now++;
    max = Math.max(max, now);
    await new Promise((r) => setTimeout(r, 20));
    now--;
    return textResp(CARD);
  }));
  const results = await Promise.all(Array.from({ length: 6 }, () => ai.extractCard(INPUT)));
  assert.equal(results.length, 6);
  assert.equal(max, 2);
  assert.equal(ai.aiActiveCount(), 0);
  // 실패해도 자리를 돌려준다
  ai.setClientForTest(fakeClient(async () => { await new Promise((r) => setTimeout(r, 5)); throw new TypeError('x'); }));
  await Promise.allSettled(Array.from({ length: 4 }, () => ai.extractCard(INPUT)));
  assert.equal(ai.aiActiveCount(), 0);
});

test('writeBriefing: 할 일 최대 5개 · 모르는 callId 는 null · 숫자는 stats 를 넘긴다', async () => {
  const fake = fakeClient(() => textResp({
    paragraph: '오늘 통화는 12건입니다. 확인할 카드가 3건 있습니다.',
    todos: [
      { title: '새한카센터에 사양 묻기', why: '헤드라이트 LED 여부', callId: 'call_a' },
      { title: '지어낸 할 일', why: 'x', callId: 'call_zzz' },
      { title: '3', why: '', callId: null }, { title: '4', why: '', callId: null },
      { title: '5', why: '', callId: null }, { title: '6', why: '', callId: null },
    ],
  }));
  ai.setClientForTest(fake);
  const out = await ai.writeBriefing({
    day: '2026-11-11',
    stats: { calls: 12, cards: 10, draft: 3, confirmed: 5, shipped: 2, urgentOpen: 1, callbacks: 1, unsure: 2, working: 0, failed: 0 },
    cards: [{ callId: 'call_a', title: '새한카센터 · 헤드라이트', customer: '새한카센터', status: 'draft', askBack: ['LED 인지'] }],
  });
  assert.equal(out.paragraph, '오늘 통화는 12건입니다. 확인할 카드가 3건 있습니다.');
  assert.equal(out.todos.length, 5);
  assert.equal(out.todos[0].callId, 'call_a');
  assert.equal(out.todos[1].callId, null);
  const user = fake.calls[0].params.messages[0].content;
  assert.ok(user.includes('오늘 통화(calls): 12'));
  assert.ok(user.includes('call_a'));
  assert.equal(fake.calls[0].params.output_config.format.schema, ai.BRIEFING_SCHEMA);
});

test('answerQuestion: 근거 ref 만 남기고, 근거 없으면 「찾지 못했어요」', async () => {
  const contexts = [
    { ref: 'c1#2', callId: 'call_1', segIndex: 2, at: 4.5, text: '앞범퍼 두 개 주세요', title: '새한카센터 · 앞범퍼', recordedAt: '2026-11-10T05:00:00.000Z' },
    { ref: 'k1', callId: 'call_1', text: '카드: 새한카센터 · 앞범퍼 2개 · 확정' },
  ];
  // 정상: 지어낸 ref 는 버리고, 글에 없는 인용은 자료 글로 바꾼다
  let fake = fakeClient(() => textResp({
    answer: '네, 11월 10일에 새한카센터가 앞범퍼 두 개를 주문했어요.', found: true,
    citations: [{ ref: 'c1#2', quote: '앞범퍼 두 개' }, { ref: 'c9#9', quote: '없는 근거' }, { ref: 'k1', quote: '지어낸 인용' }],
  }));
  ai.setClientForTest(fake);
  let out = await ai.answerQuestion({ question: '새한카센터가 앞범퍼 두 개라고 한 적 있어?', history: [{ role: 'user', text: '안녕' }, { role: 'assistant', text: '네' }], contexts });
  assert.equal(out.found, true);
  assert.deepEqual(out.citations.map((c) => c.ref), ['c1#2', 'k1']);
  assert.equal(out.citations[0].quote, '앞범퍼 두 개');
  assert.equal(out.citations[1].quote, '카드: 새한카센터 · 앞범퍼 2개 · 확정');
  const user = fake.calls[0].params.messages[0].content;
  assert.ok(user.includes('[c1#2] 2026-11-10 14:00'));
  assert.ok(user.includes('[이전 대화]'));

  // found 인데 근거가 하나도 맞지 않으면 found:false
  ai.setClientForTest(fakeClient(() => textResp({ answer: '세 번 시켰어요.', found: true, citations: [{ ref: 'nope', quote: 'x' }] })));
  out = await ai.answerQuestion({ question: '몇 번 시켰어?', history: [], contexts });
  assert.equal(out.found, false);
  assert.ok(out.answer.startsWith('찾지 못했어요'));
  assert.deepEqual(out.citations, []);

  // found:false 인데 첫머리가 다르면 붙인다
  ai.setClientForTest(fakeClient(() => textResp({ answer: '그런 통화는 없습니다.', found: false, citations: [] })));
  out = await ai.answerQuestion({ question: '백미러?', history: [], contexts });
  assert.equal(out.found, false);
  assert.ok(out.answer.startsWith('찾지 못했어요'));

  // 자료가 없으면 AI 를 부르지 않는다
  fake = fakeClient(() => { throw new Error('부르면 안 됨'); });
  ai.setClientForTest(fake);
  out = await ai.answerQuestion({ question: '아무거나', history: [], contexts: [] });
  assert.equal(out.found, false);
  assert.ok(out.answer.startsWith('찾지 못했어요'));
  assert.equal(fake.calls.length, 0);
  ai.setClientForTest(null);
});
