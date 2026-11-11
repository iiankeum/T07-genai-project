// 주문 카드 시험: AI 결과 검증(품번 · 차번호 · 근거 시각 · 번호로 거래처) → 파이프라인 → 상태 흐름 → 고치기 → 실시간 라우트.
// 가짜 Claude 클라이언트만 쓴다(진짜 API 를 부르지 않는다). 모든 데이터는 가짜다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
process.env.ANTHROPIC_API_KEY = '';

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const { db, nowIso } = await import('../lib/db.mjs');
const { Router } = await import('../lib/http.mjs');
const { getCallRow, getCardRow, cardView } = await import('../lib/repo.mjs');
const ai = await import('../lib/ai.mjs');
const cards = await import('../lib/cards.mjs');
const pipeline = await import('../lib/pipeline.mjs');
const cardRoutes = await import('../routes/cards.mjs');
const liveRoutes = await import('../routes/live.mjs');
const { createApp } = await import('../server.mjs');

// ── 가짜 사전 · 통화 ─────────────────────────────────────────────
const now = nowIso();
const addGloss = (id, kind, term, standard, phone) => db().prepare(
  'INSERT INTO glossary(id, kind, term, standard, phone, status, source, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
).run(id, kind, term, standard, phone, 'approved', '기본', now, now);
addGloss('g1', '거래처', '우리공업사', null, '010-1111-2222');
addGloss('g2', '거래처', '새한카센터', null, '010-3333-4444');
addGloss('g3', '거래처', '한성정비', null, null);
addGloss('g4', '현장말', '휀다', '펜더', null);
addGloss('g5', '차종', '쏘나타 DN8', null, null);

// 대표님 프로토타입 call02 와 비슷한 가짜 통화(받아쓰기 결과 모양)
const SEGS2 = [
  { start: 0, end: 1.5, text: '네, 부품입니다.' },
  { start: 2.9, end: 9.2, text: '우리 공업사예요. 소나타 DNA신데, 차번호가 34나 5678이에요.' },
  { start: 10.3, end: 13.3, text: '네, 34나 5678. 뭐 필요하세요?' },
  { start: 14.7, end: 18.5, text: '운전석 휀다 하나하고, 운전석 헤드라이트 하나 주세요.' },
  { start: 19.7, end: 22, text: '헤드라이트는 LED예요. 일반이에요.' },
  { start: 22, end: 29.2, text: '아, 그건 차 보고 다시 전화드릴게요. 급한 건 아니고 내일 받아도 돼요.' },
  { start: 30, end: 32.7, text: '네, 그럼 펜다 먼저 잡아놓을게요.' },
];
const SEGS4 = [
  { start: 0, end: 1.4, text: '네, 부품입니다.' },
  { start: 2.9, end: 5.6, text: '한성정비인데요. 품번으로 주문할게요.' },
  { start: 9.3, end: 14.6, text: '58101-D4A25 앞 브레이크 패드예요. 두 개 주세요.' },
  { start: 19.7, end: 23.4, text: '네, 맞아요. 지금 차 올려놨으니까 빨리 좀 부탁해요.' },
];
const joinText = (segs) => segs.map((s) => s.text).join(' ');

function insertCall(id, { segs = [], caller = null, status = 'ready', transcript, source = 'upload' } = {}) {
  db().prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title, caller_number, duration_sec, transcript, segments, is_fake)
    VALUES(?,?,?,?,?,?,?,?,?,?,1)`).run(id, now, '2026-11-11T05:42:00.000Z', source, status, '제목 전', caller, 33,
    transcript ?? joinText(segs), JSON.stringify(segs));
}

const AI2 = {
  customer: '우리 공업사', contact: null, car_model: '쏘나타 DN8', model_year: null, plate: '34나5678',
  items: [
    { part: '휀다(펜더)', side: '운전석', qty: 1, part_no: '86311-L1000', quote: '운전석 휀다 하나하고' },
    { part: '헤드라이트', side: '운전석', qty: 1, part_no: null, quote: '운전석 헤드라이트 하나 주세요!!' },
  ],
  urgent: false, due: '내일 받아도 돼요', delivery: null,
  ask_back: ['헤드라이트가 LED 인지 일반인지'],
  unsure: [{ field: 'car_model', item: -1, reason: 'DNA 로 받아써짐', quote: '소나타 DNA신데' }, { field: 'qty', item: 1, reason: '수량이 흐림', quote: '' }],
  fixes: [{ heard: '소나타 DNA', fixed: '쏘나타 DN8' }],
  note: '휀다 먼저 잡아 둠',
  evidence: { customer: '우리 공업사예요', contact: '', car_model: '소나타 DNA신데', model_year: '', plate: '차번호가 34나 5678이에요', urgent: '', due: '내일 받아도 돼요', delivery: '' },
  highlights: [
    { text: '운전석 휀다', kind: 'part' }, { text: '34나 5678', kind: 'plate' },
    { text: '지어낸 대목', kind: 'part' }, { text: '헤드라이트', kind: 'nope' },
  ],
  summary: '쏘나타 DN8 운전석 휀다 1개 · 헤드라이트 1개',
};
const AI4 = {
  customer: '한성정비', contact: null, car_model: null, model_year: null, plate: null,
  items: [{ part: '앞 브레이크 패드', side: null, qty: 2, part_no: '58101-d4a25', quote: '앞 브레이크 패드예요. 두 개 주세요.' }],
  urgent: true, due: null, delivery: null, ask_back: [], unsure: [], fixes: [], note: null,
  evidence: { customer: '한성정비인데요', contact: '', car_model: '', model_year: '', plate: '', urgent: '빨리 좀 부탁해요', due: '', delivery: '' },
  highlights: [{ text: '앞 브레이크 패드', kind: 'part' }], summary: '앞 브레이크 패드 2개, 급함',
};

const textResp = (obj) => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }] });
function fakeClient(handler) {
  const calls = [];
  const make = (plain) => async (params) => { calls.push({ params, plain }); return handler(params); };
  return { calls, beta: { messages: { create: make(false) } }, messages: { create: make(true) } };
}
/** 받아쓴 글을 보고 맞는 가짜 카드를 돌려준다 */
const smartFake = () => fakeClient((params) => {
  const user = params.messages[0].content;
  const talk = user.slice(user.indexOf('[받아쓴 통화]')); // 사전(거래처 목록)은 빼고 통화 글만 본다
  if (talk.includes('한성정비')) return textResp(AI4);
  return textResp(AI2);
});

// ── 라우트 서버 ─────────────────────────────────────────────────
const router = new Router();
cardRoutes.register(router);
liveRoutes.register(router);
const server = http.createServer(createApp(router));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
after(() => { server.close(); ai.setClientForTest(null); });

let ipN = 0;
async function req(method, p, body, headers = {}) {
  ipN++;
  const res = await fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.${Math.floor(ipN / 250)}.${ipN % 250}`, ...headers },
    body: body === undefined ? (method === 'GET' ? undefined : '{}') : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// ── 1. buildCardFromAi ───────────────────────────────────────────
test('buildCardFromAi: 「품번」이라는 말이 없으면 품번을 비우고 들어 보기에 적는다', () => {
  insertCall('c2', { segs: SEGS2 });
  const v = cards.buildCardFromAi(getCallRow('c2'), AI2);
  assert.equal(v.items[0].partNo, null);
  const u = v.unsure.find((x) => x.field === 'partNo');
  assert.ok(u);
  assert.equal(u.reason, '통화에 품번을 불러 준 말이 없어 비웠습니다');
  assert.equal(u.item, 0);
  assert.equal(u.at, 14.7);
});

test('buildCardFromAi: 품번을 불러 줬으면 대문자로 남기고, 자릿수가 이상하면 들어 보기', () => {
  insertCall('c4', { segs: SEGS4 });
  let v = cards.buildCardFromAi(getCallRow('c4'), AI4);
  assert.equal(v.items[0].partNo, '58101-D4A25');
  assert.equal(v.unsure.length, 0);
  v = cards.buildCardFromAi(getCallRow('c4'), { ...AI4, items: [{ ...AI4.items[0], part_no: '58101-D4AE1599' }] });
  assert.equal(v.items[0].partNo, '58101-D4AE1599');
  assert.equal(v.unsure[0].reason, '자릿수가 보통과 다릅니다 — 들어 보세요');
  assert.equal(v.unsure[0].field, 'partNo');
});

test('buildCardFromAi: 차번호 형식 검사 · 근거 시각(공백 · 문장부호 무시) · 칠하기 대목 거르기', () => {
  const v = cards.buildCardFromAi(getCallRow('c2'), AI2);
  assert.equal(v.plate, '34나5678');
  // 근거: 문장부호가 달라도 같은 문장으로
  assert.equal(v.items[0].at, 14.7);
  assert.equal(v.items[0].seg, 3);
  assert.equal(v.items[1].at, 14.7); // 「!!」 무시
  assert.equal(v.evidence.customer.at, 2.9);
  assert.equal(v.evidence.plate.at, 2.9);
  assert.equal(v.evidence.due.at, 22);
  assert.equal(v.evidence.due.seg, 5);
  assert.equal(v.evidence.carModel.at, 2.9);
  assert.ok(!('urgent' in v.evidence));
  // AI 의 들어 보기에도 시각이 붙고, 칸 이름은 화면 이름으로
  const carU = v.unsure.find((x) => x.field === 'carModel');
  assert.equal(carU.at, 2.9);
  assert.equal(carU.item, null); // -1 → null
  const qtyU = v.unsure.find((x) => x.field === 'qty');
  assert.equal(qtyU.item, 1);
  assert.equal(qtyU.at, 14.7); // 인용이 비면 그 부품 줄의 시각
  assert.ok(!('urgent' in v.evidence));
  // 칠하기: 글에 있는 것만 · 모르는 kind 는 버림
  assert.deepEqual(v.highlights, [{ text: '운전석 휀다', kind: 'part' }, { text: '34나 5678', kind: 'plate' }]);
  // 거래처 표기를 사전에 맞춤(띄어쓰기만 다름)
  assert.equal(v.customer, '우리공업사');
  assert.equal(v.customer_by_phone, false);
  // 형식이 안 맞는 차번호(가운데 한글 빠짐) → 비우고 들어 보기
  const w = cards.buildCardFromAi(getCallRow('c2'), { ...AI2, plate: '34 5678' });
  assert.equal(w.plate, null);
  const pu = w.unsure.find((x) => x.field === 'plate');
  assert.ok(pu && pu.reason.includes('들어 보세요'));
  assert.equal(pu.at, 2.9);
});

test('buildCardFromAi: 걸려 온 번호가 거래처 번호와 같으면 그 이름 · customer_by_phone (F11)', () => {
  insertCall('c2p', { segs: SEGS2, caller: '01011112222' });
  const v = cards.buildCardFromAi(getCallRow('c2p'), { ...AI2, customer: '우리카센터' });
  assert.equal(v.customer, '우리공업사');
  assert.equal(v.customer_by_phone, true);
  assert.deepEqual(v.fixes[0], { heard: '우리카센터', fixed: '우리공업사' });
});

test('buildCardFromAi: ai_draft 는 cardView 모양 · 이상한 값은 정리', () => {
  const v = cards.buildCardFromAi(getCallRow('c2'), { ...AI2, items: [...AI2.items, { part: '', qty: 3 }, { part: '쇼바', qty: 5000, part_no: null, side: null, quote: null }] });
  const d = v.ai_draft;
  for (const k of ['callType', 'customer', 'contact', 'carModel', 'modelYear', 'plate', 'items', 'urgent', 'due', 'delivery', 'askBack', 'note']) assert.ok(k in d, k);
  assert.equal(d.callType, '주문'); // AI 가 종류를 안 주면 주문
  assert.equal(v.call_type, '주문');
  const w = cards.buildCardFromAi(getCallRow('c2'), { ...AI2, call_type: '배송 문의', unsure: [{ field: 'other', item: -1, reason: '말이 겹침', quote: '' }, { field: 'toString', item: -1, reason: 'x', quote: '' }] });
  assert.equal(w.call_type, '배송 문의');
  assert.equal(w.ai_draft.callType, '배송 문의');
  assert.equal(w.unsure.find((u) => u.reason === '말이 겹침').field, null); // 어느 칸도 아니면 null
  assert.equal(w.unsure.find((u) => u.reason === 'x').field, null);
  assert.equal(cards.buildCardFromAi(getCallRow('c2'), { ...AI2, call_type: '이상한 값' }).call_type, '주문');
  assert.equal(d.items.length, 3);
  assert.equal(d.items[2].qty, null); // 0~999 밖은 비움
  assert.deepEqual(Object.keys(d.items[0]).sort(), ['at', 'part', 'partNo', 'qty', 'quote', 'side']);
  assert.equal(v.ai_model, 'claude-opus-5-5');
  assert.equal(v.ai_error, null);
});

// ── 2. 파이프라인 ────────────────────────────────────────────────
test('onTranscript: 글 저장 → 카드 → ready, 제목 · 거래처 · 요약 갱신', async () => {
  ai.setClientForTest(smartFake());
  insertCall('p1', { segs: [], transcript: '', status: 'transcribing', caller: '010-1111-2222' });
  const card = await pipeline.onTranscript('p1', { text: joinText(SEGS2), segments: SEGS2, engine: 'faster-whisper large-v3', durationSec: 33.1, elapsedSec: 2 });
  assert.ok(card);
  const call = getCallRow('p1');
  assert.equal(call.status, 'ready');
  assert.equal(call.engine, 'faster-whisper large-v3');
  assert.equal(call.duration_sec, 33.1);
  assert.equal(JSON.parse(call.segments).length, 7);
  assert.equal(call.customer, '우리공업사');
  assert.ok(call.title.startsWith('우리공업사 · 휀다(펜더) 외 1'));
  assert.equal(call.summary, AI2.summary);
  const c = cardView(getCardRow('p1'));
  assert.equal(c.status, 'draft');
  assert.equal(c.customerByPhone, true);
  assert.deepEqual(c.askBack, AI2.ask_back);
  assert.deepEqual(c.edited, []);
  assert.equal(c.items[0].side, '운전석');
});

test('onTranscript: AI 꺼짐 · 실패 · 빈 글이어도 throw 없이 빈 카드로 ready', async () => {
  ai.setClientForTest(null);
  insertCall('p2', { status: 'transcribing', transcript: '' });
  await pipeline.onTranscript('p2', { text: joinText(SEGS4), segments: SEGS4 });
  assert.equal(getCallRow('p2').status, 'ready');
  assert.equal(getCardRow('p2').ai_error, 'AI 키 없음');
  assert.equal(JSON.parse(getCardRow('p2').items).length, 0);

  const orig = console.error;
  console.error = () => {};
  try {
    ai.setClientForTest(fakeClient(() => { throw new Anthropic.RateLimitError(429, { type: 'error' }, 'x', new Headers()); }));
    insertCall('p3', { status: 'transcribing', transcript: '' });
    const r = await pipeline.onTranscript('p3', { text: joinText(SEGS4), segments: SEGS4 });
    assert.ok(r);
    assert.equal(getCallRow('p3').status, 'ready');
    assert.ok(getCardRow('p3').ai_error.includes('잠시 뒤'));
  } finally {
    console.error = orig;
  }

  ai.setClientForTest(smartFake());
  insertCall('p4', { status: 'transcribing', transcript: '' });
  await pipeline.onTranscript('p4', { text: '   ', segments: [] });
  assert.equal(getCallRow('p4').status, 'ready');
  assert.equal(getCardRow('p4').ai_error, '받아쓴 글이 비어 있습니다');

  // 없는 통화도 throw 하지 않는다
  assert.equal(await pipeline.onTranscript('nope', { text: 'x', segments: [] }), null);
});

test('resumeStuck: 카드 정리 중에 멈춘 통화를 다시 정리', async () => {
  ai.setClientForTest(smartFake());
  insertCall('s1', { segs: SEGS4, status: 'extracting' });
  const n = await pipeline.resumeStuck();
  assert.equal(n, 1);
  assert.equal(getCallRow('s1').status, 'ready');
  assert.equal(cardView(getCardRow('s1')).items[0].partNo, '58101-D4A25');
});

// ── 3. 상태 흐름 · 고치기(라우트) ──────────────────────────────────
test('확정: 되물을 것이 남으면 409 ask_back_left → 지우면 확정(품번 빈 줄 경고) → 출고', async () => {
  let r = await req('POST', '/api/cards/p1/confirm');
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'ask_back_left');
  assert.ok(r.data.message.includes('다시 물어볼 것'));

  r = await req('PATCH', '/api/cards/p1', { askBack: [] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.card.askBack, []);
  assert.equal(r.data.card.edits, 1);
  assert.ok(r.data.card.edited.includes('askBack'));

  r = await req('POST', '/api/cards/p1/ship');
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'not_confirmed');

  r = await req('POST', '/api/cards/p1/confirm');
  assert.equal(r.status, 200);
  assert.equal(r.data.card.status, 'confirmed');
  assert.equal(r.data.card.statusLabel, '확정');
  assert.ok(r.data.card.confirmedAt);
  assert.deepEqual(r.data.warnings, ['품번이 빈 부품이 2줄 있습니다']);

  // 확정된 카드는 고칠 수 없다
  r = await req('PATCH', '/api/cards/p1', { note: '고침' });
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'locked');
  // 다시 정리도 막힌다
  r = await req('POST', '/api/calls/p1/reextract');
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'locked');

  r = await req('POST', '/api/cards/p1/ship');
  assert.equal(r.status, 200);
  assert.equal(r.data.card.status, 'shipped');
  assert.ok(r.data.card.shippedAt);

  r = await req('POST', '/api/cards/p1/cancel');
  assert.equal(r.status, 409);

  r = await req('POST', '/api/cards/p1/reopen');
  assert.equal(r.status, 200);
  assert.equal(r.data.card.status, 'draft');
  assert.equal(r.data.card.confirmedAt, null);
  assert.equal(r.data.card.shippedAt, null);

  r = await req('POST', '/api/cards/p1/cancel');
  assert.equal(r.status, 200);
  assert.equal(r.data.card.status, 'cancelled');
  r = await req('POST', '/api/cards/p1/confirm');
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'bad_state');
  r = await req('POST', '/api/cards/p1/reopen');
  assert.equal(r.data.card.status, 'draft');
});

test('확정: 주문 전화에 부품이 한 줄도 없으면 409 no_items · 배송 문의는 부품 없이 확정', async () => {
  let r = await req('POST', '/api/cards/p2/confirm');
  assert.equal(r.status, 409);
  assert.equal(r.data.error, 'no_items');
  r = await req('PATCH', '/api/cards/p2', { callType: '배송 문의' });
  assert.equal(r.status, 200);
  assert.equal(r.data.card.callType, '배송 문의');
  assert.ok(r.data.card.edited.includes('callType'));
  assert.ok(getCallRow('p2').title.includes('배송 문의'));
  r = await req('POST', '/api/cards/p2/confirm');
  assert.equal(r.status, 200);
  assert.equal(r.data.card.status, 'confirmed');
  assert.equal(r.data.warnings, undefined);
  await req('POST', '/api/cards/p2/reopen');
  r = await req('PATCH', '/api/cards/p2', { callType: '아무거나' });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'bad_call_type');
});

test('PATCH: 값 정리 · 수량 0~999 · 30줄 · 고친 칸 표시 · 번호 확인 표시 · 제목 갱신', async () => {
  let r = await req('PATCH', '/api/cards/p1', {
    customer: '  새한카센터  ', plate: '12가 3456', urgent: true,
    items: [{ part: '앞범퍼', side: null, qty: '2', partNo: ' 86511-f2000 ', quote: '앞범퍼', at: 3.5 }, { part: '', partNo: '' }],
    hacker: 'x',
  });
  assert.equal(r.status, 200);
  const c = r.data.card;
  assert.equal(c.customer, '새한카센터');
  assert.equal(c.plate, '12가3456');
  assert.equal(c.urgent, true);
  assert.equal(c.items.length, 1);
  assert.equal(c.items[0].qty, 2);
  assert.equal(c.items[0].partNo, '86511-F2000');
  assert.equal(c.items[0].at, 3.5);
  assert.equal(c.customerByPhone, false); // 번호(우리공업사)와 다르게 고침
  assert.ok(c.edited.includes('customer') && c.edited.includes('items') && c.edited.includes('urgent'));
  assert.ok(!('hacker' in c));
  const call = getCallRow('p1');
  assert.ok(call.title.startsWith('새한카센터 · 앞범퍼'));
  assert.equal(call.customer, '새한카센터');
  assert.ok(call.summary.includes('앞범퍼 2개'));

  r = await req('PATCH', '/api/cards/p1', { customer: '우리공업사' });
  assert.equal(r.data.card.customerByPhone, true);

  r = await req('PATCH', '/api/cards/p1', { items: [{ part: '쇼바', qty: 1000 }] });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'bad_qty');
  r = await req('PATCH', '/api/cards/p1', { items: [{ part: '쇼바', qty: 1.5 }] });
  assert.equal(r.status, 400);
  r = await req('PATCH', '/api/cards/p1', { items: Array.from({ length: 31 }, (_, i) => ({ part: `부품${i}`, qty: 1 })) });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'too_many_items');
  r = await req('PATCH', '/api/cards/p1', { askBack: Array.from({ length: 11 }, (_, i) => `질문${i}`) });
  assert.equal(r.status, 400);
  r = await req('PATCH', '/api/cards/p1', { hacker: 1 });
  assert.equal(r.status, 400);
  assert.equal(r.data.error, 'empty_patch');
  r = await req('PATCH', '/api/cards/p1', 'customer=x', { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(r.status, 415);
  r = await req('PATCH', '/api/cards/nope', { note: 'x' });
  assert.equal(r.status, 404);
  const before = getCardRow('p1').edits;
  r = await req('PATCH', '/api/cards/p1', { note: '<script>alert(1)</script>' });
  assert.equal(r.data.card.note, '<script>alert(1)</script>'); // 저장은 그대로, 그릴 때 화면이 이스케이프
  assert.equal(getCardRow('p1').edits, before + 1);
});

test('다시 전화 표시 켜기 · 끄기', async () => {
  let r = await req('POST', '/api/cards/p1/callback', { on: true, reason: '헤드라이트 사양 확인' });
  assert.equal(r.status, 200);
  assert.equal(r.data.card.callback, true);
  assert.equal(r.data.card.callbackReason, '헤드라이트 사양 확인');
  r = await req('POST', '/api/cards/p1/callback', { on: false, reason: '무시됨' });
  assert.equal(r.data.card.callback, false);
  assert.equal(r.data.card.callbackReason, null);
});

test('다시 정리: 새 AI 초안 · 고친 횟수 0 · AI 꺼짐이면 503', async () => {
  ai.setClientForTest(smartFake());
  const prev = cardView(getCardRow('p1'));
  let r = await req('POST', '/api/calls/p1/reextract');
  assert.equal(r.status, 200);
  assert.equal(r.data.call.id, 'p1');
  assert.ok(Array.isArray(r.data.call.segments));
  assert.equal(r.data.call.card.edits, 0);
  // 사람이 고친 칸은 다시 정리해도 그대로(남희 방 규칙)
  for (const f of prev.edited) assert.deepEqual(JSON.stringify(r.data.call.card[f]), JSON.stringify(prev[f]), f);
  assert.equal(r.data.call.card.customer, '우리공업사');
  assert.equal(r.data.call.card.status, 'draft');

  ai.setClientForTest(null);
  r = await req('POST', '/api/calls/p1/reextract');
  assert.equal(r.status, 503);
  assert.equal(r.data.error, 'ai_disabled');
  assert.equal(getCardRow('p1').customer, '우리공업사'); // 원래 카드 그대로

  r = await req('POST', '/api/calls/nope/reextract');
  assert.equal(r.status, 404);
});

// ── 4. 실시간 라우트 ────────────────────────────────────────────
test('POST /api/live/extract: AI 꺼짐이면 {card:null, aiError} · 켜지면 저장 안 한 cardView', async () => {
  ai.setClientForTest(null);
  let r = await req('POST', '/api/live/extract', { text: '한성정비인데요 앞 브레이크 패드 두 개 급해요' });
  assert.equal(r.status, 200);
  assert.equal(r.data.card, null);
  assert.equal(r.data.aiError, 'AI 키 없음');

  ai.setClientForTest(smartFake());
  const countBefore = db().prepare('SELECT COUNT(*) AS n FROM calls').get().n;
  r = await req('POST', '/api/live/extract', { text: '한성정비인데요. 품번으로 주문할게요. 58101-D4A25 앞 브레이크 패드예요. 두 개 주세요. 빨리 좀 부탁해요.' });
  assert.equal(r.status, 200);
  const c = r.data.card;
  for (const k of ['status', 'customer', 'carModel', 'items', 'urgent', 'askBack', 'unsure', 'evidence', 'highlights', 'edited', 'aiDraft']) assert.ok(k in c, k);
  assert.equal(c.customer, '한성정비');
  assert.equal(c.urgent, true);
  assert.equal(c.items[0].qty, 2);
  assert.equal(c.items[0].partNo, '58101-D4A25');
  assert.equal(c.status, 'draft');
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM calls').get().n, countBefore);

  // AI 쪽 실패는 200 + aiError
  ai.setClientForTest(fakeClient(() => ({ stop_reason: 'refusal', content: [] })));
  r = await req('POST', '/api/live/extract', { text: '아반떼 앞범퍼 두 개 급해요' });
  assert.equal(r.status, 200);
  assert.equal(r.data.card, null);
  assert.ok(r.data.aiError);

  // 4000자가 넘으면 앞 · 뒤만 AI 에 보낸다(거래처를 밝히는 첫머리는 남긴다)
  const fake = smartFake();
  ai.setClientForTest(fake);
  r = await req('POST', '/api/live/extract', { text: '한성정비인데요. ' + '음 '.repeat(3000) + '앞 브레이크 패드 두 개 주세요.' });
  assert.equal(r.status, 200);
  const sent = fake.calls[0].params.messages[0].content;
  const talk = sent.slice(sent.indexOf('<<<'));
  assert.ok(talk.length < 4200);
  assert.ok(talk.includes('한성정비인데요') && talk.includes('앞 브레이크 패드 두 개 주세요'));
  r = await req('POST', '/api/live/extract', { text: '가'.repeat(20_001) });
  assert.equal(r.status, 413);
  r = await req('POST', '/api/live/extract', { text: '   ' });
  assert.equal(r.status, 400);
  r = await req('POST', '/api/live/extract', { text: 123 });
  assert.equal(r.status, 400);
});

test('POST /api/live/save: 새 통화(source=live, 오디오 없음) + 카드 → {callId, call}', async () => {
  ai.setClientForTest(smartFake());
  let r = await req('POST', '/api/live/save', { text: joinText(SEGS4), segments: SEGS4, durationSec: 24 });
  assert.equal(r.status, 200);
  assert.ok(r.data.callId.startsWith('call_'));
  const call = r.data.call;
  assert.equal(call.id, r.data.callId);
  assert.equal(call.source, 'live');
  assert.equal(call.status, 'ready');
  assert.equal(call.hasAudio, false);
  assert.equal(call.durationSec, 24);
  assert.equal(call.segments.length, 4);
  assert.equal(call.card.customer, '한성정비');
  assert.equal(call.card.items[0].at, 9.3);
  assert.ok(call.title.startsWith('한성정비 · 앞 브레이크 패드'));
  assert.ok(getCallRow(r.data.callId).uploader); // IP 는 해시로만

  ai.setClientForTest(null);
  r = await req('POST', '/api/live/save', { text: '아반떼 앞범퍼 두 개 급해요' });
  assert.equal(r.status, 200);
  assert.equal(r.data.call.card.aiError, 'AI 키 없음');
  assert.equal(r.data.call.status, 'ready');
  assert.ok(r.data.call.title.startsWith('실시간 체험'));
  assert.equal(r.data.call.durationSec, null); // 길이를 안 보내면 비움

  r = await req('POST', '/api/live/save', { text: 'x', segments: 'nope' });
  assert.equal(r.status, 400);
  r = await req('POST', '/api/live/save', { text: 'x', durationSec: -1 });
  assert.equal(r.status, 400);
});
