// routes/insights.mjs 시험: 대시보드 숫자 · 할 일 · 마감 요약 글 · 브리핑 캐시 · 묻기(가짜 AI, ref 바꾸기) · 출고 묶음 · CSV. 모든 데이터는 가짜.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
delete process.env.ANTHROPIC_API_KEY; // 시험에서 진짜 AI 를 부르지 않는다

const { db } = await import('../lib/db.mjs');
const { Router } = await import('../lib/http.mjs');
const { kstDay } = await import('../lib/security.mjs');
const { createApp } = await import('../server.mjs');
const { addDays } = await import('../routes/calls.mjs');
const { kstTime } = await import('../lib/repo.mjs');
const insights = await import('../routes/insights.mjs');

const today = kstDay();
const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+09:00`).toISOString();

function addCall({ id, recordedAt, status = 'ready', customer = null, transcript = '', segments = [], card = null }) {
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title, customer, duration_sec, transcript, segments, is_fake)
    VALUES(?, ?, ?, 'seed', ?, ?, ?, 20, ?, ?, 1)`).run(id, now, recordedAt, status, `${customer ?? '거래처 확인 필요'} · ${id}`, customer, transcript, JSON.stringify(segments));
  if (card) {
    db().prepare(`INSERT INTO cards(call_id, status, call_type, customer, car_model, model_year, plate, items, urgent, due, delivery, ask_back, unsure, callback, callback_reason,
        created_at, updated_at, confirmed_at, shipped_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, card.status ?? 'draft', card.callType ?? '주문', card.customer ?? customer, card.carModel ?? null, card.modelYear ?? null,
      card.plate ?? null, JSON.stringify(card.items ?? []), card.urgent ? 1 : 0, card.due ?? null, card.delivery ?? null, JSON.stringify(card.askBack ?? []),
      JSON.stringify(card.unsure ?? []), card.callback ? 1 : 0, card.callbackReason ?? null, now, now, card.confirmedAt ?? null, card.shippedAt ?? null);
  }
}
const seg = (start, text) => ({ start, end: start + 2, text });

let server;
let base;
const old3 = addDays(today, -3);
const old20 = addDays(today, -20);

before(async () => {
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO glossary(id, kind, term, phone, status, source, created_at, updated_at)
    VALUES('g1', '거래처', '새한카센터', '010-1234-4829', 'approved', '기본', ?, ?)`).run(now, now);

  addCall({ id: 'c1', recordedAt: at(today, '09:00'), customer: '새한카센터',
    transcript: '새한카센터인데요. 아반떼 앞범퍼 하나 급해요. 안개등은 LED 인지 일반인지 봐야 돼요.',
    segments: [seg(0, '새한카센터인데요.'), seg(2, '아반떼 앞범퍼 하나 급해요.'), seg(5, '안개등은 LED 인지 일반인지 봐야 돼요.')],
    card: { status: 'draft', carModel: '아반떼 AD', items: [{ part: '앞범퍼', qty: 1 }], urgent: true, due: '오전 중', askBack: ['LED 인지 일반인지'] } });
  addCall({ id: 'c2', recordedAt: at(today, '10:00'), customer: '한빛카', transcript: '백미러 왼쪽 두 개요.', segments: [seg(0, '백미러 왼쪽 두 개요.')],
    card: { status: 'confirmed', carModel: '쏘나타 DN8', modelYear: '2021', plate: '12가3456', items: [{ part: '백미러', side: '좌', qty: 2, partNo: '87610-AA000' }],
      urgent: true, delivery: '퀵', confirmedAt: at(today, '10:30') } });
  addCall({ id: 'c3', recordedAt: at(today, '11:00'), customer: '우리공업사', transcript: '휀다 하나요. 차번호는 34어5678.', segments: [seg(0, '휀다 하나요.'), seg(2, '차번호는 34어5678.')],
    card: { status: 'draft', items: [{ part: '휀다', qty: 1 }], unsure: [{ field: 'plate', reason: '차번호 가운데 한글이 빠졌을 수 있음', at: 2 }] } });
  addCall({ id: 'c4', recordedAt: at(today, '12:00'), status: 'failed' });
  addCall({ id: 'c5', recordedAt: at(today, '13:00'), status: 'transcribing' });
  addCall({ id: 'c6', recordedAt: at(today, '14:00'), customer: '=HYPERLINK("http://x")',
    card: { status: 'confirmed', items: [{ part: '+SUM(1)', qty: 1 }, { part: '와이퍼', qty: 2 }], confirmedAt: at(today, '14:10') } });
  addCall({ id: 'c7', recordedAt: at(today, '08:00'), customer: '새한카센터', transcript: '앞범퍼 하나 더요.', segments: [seg(0, '앞범퍼 하나 더요.')],
    card: { status: 'shipped', items: [{ part: '앞범퍼', qty: 1 }], confirmedAt: at(today, '08:10'), shippedAt: at(today, '08:40') } });
  addCall({ id: 'c8', recordedAt: at(today, '07:00'), card: { status: 'draft', items: [{ part: '쇼바', qty: 2 }] } });
  addCall({ id: 'c9', recordedAt: at(today, '09:30'), customer: '한빛카', card: { status: 'cancelled', urgent: true, items: [{ part: '라지에다', qty: 1 }] } });
  addCall({ id: 'o1', recordedAt: at(old3, '10:00'), customer: '한빛카', transcript: '백미러 하나요.', segments: [seg(0, '백미러 하나요.')],
    card: { status: 'confirmed', items: [{ part: '백미러', side: '우', qty: 1 }], confirmedAt: at(old3, '11:00') } });
  addCall({ id: 'o2', recordedAt: at(old20, '10:00'), customer: '새한카센터', transcript: '앞범퍼 두 개요.', segments: [seg(0, '앞범퍼 두 개요.')],
    card: { status: 'shipped', items: [{ part: '앞범퍼', qty: 2 }] } });

  const router = new Router();
  insights.register(router);
  server = http.createServer(createApp(router));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((r) => server.close(r)));

const get = async (p) => {
  const res = await fetch(base + p);
  const type = res.headers.get('content-type') || '';
  return { res, body: type.includes('json') ? await res.json() : await res.text() };
};
const post = async (p, body) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { res, body: await res.json() };
};

test('대시보드: 숫자', async () => {
  const { res, body } = await get('/api/dashboard');
  assert.equal(res.status, 200);
  assert.equal(body.day, today);
  assert.equal(body.isToday, true);
  assert.deepEqual(body.stats, { calls: 9, cards: 7, draft: 3, confirmed: 2, shipped: 1, urgentOpen: 2, callbacks: 1, unsure: 1, working: 1, failed: 1, byType: {} });
  assert.equal(body.briefing, null);
});

test('대시보드: 목록 · 할 일(같은 통화는 하나) · 최근 8개', async () => {
  const { body } = await get(`/api/dashboard?day=${today}`);
  assert.deepEqual(body.callbacks.map((c) => [c.callId, c.askBack]), [['c1', ['LED 인지 일반인지']]]);
  assert.deepEqual(body.urgentOpen.map((c) => c.callId), ['c1', 'c2']);
  assert.deepEqual(body.drafts.map((c) => c.callId), ['c1', 'c3', 'c8']);
  assert.equal(body.drafts[1].unsureCount, 1);
  assert.deepEqual(body.todos.map((t) => [t.kind, t.callId, t.priority]), [
    ['callback', 'c1', 1], ['ship', 'c2', 1], ['listen', 'c3', 2], ['retry', 'c4', 2], ['confirm', 'c8', 3],
  ]);
  assert.match(body.todos[0].why, /LED 인지 일반인지/);
  assert.match(body.todos[2].why, /차번호/);
  assert.equal(body.recent.length, 8);
  assert.deepEqual(body.recent.map((c) => c.id), ['c6', 'c5', 'c4', 'c3', 'c2', 'c9', 'c1', 'c7']);
  assert.equal(body.recent[0].card.status, 'confirmed');

  const r = await get('/api/dashboard?day=2026-02-31');
  assert.equal(r.res.status, 400);
  const empty = await get(`/api/dashboard?day=${addDays(today, -7)}`);
  assert.equal(empty.body.stats.calls, 0);
  assert.equal(empty.body.isToday, false);
});

test('마감 요약 글(AI 없이)', async () => {
  const { body } = await get(`/api/briefing/text?day=${today}`);
  const [, m, d] = today.split('-').map(Number);
  const dow = '일월화수목금토'[new Date(`${today}T00:00:00Z`).getUTCDay()];
  const lines = body.text.split('\n');
  assert.equal(lines[0], `[콜노트 마감 요약 · ${m}월 ${d}일(${dow})] 가짜 통화 데모`);
  assert.ok(body.text.includes('통화 9건 · 주문 카드 7건'));
  assert.ok(body.text.includes('확정 2건 · 확인 필요 3건 · 출고 완료 1건'));
  assert.ok(body.text.includes('■ 급한데 아직 출고 안 된 것 2건'));
  assert.ok(body.text.includes('- 새한카센터: 앞범퍼 1개 (확인 필요 · 오전 중)'));
  assert.ok(body.text.includes('- 한빛카: 백미러(좌) 2개 (확정)'));
  assert.ok(body.text.includes('■ 다시 전화할 곳 1곳'));
  assert.ok(body.text.includes('- 새한카센터: LED 인지 일반인지'));
  assert.ok(!body.text.includes('라지에다'), '취소된 카드는 빠진다');
  assert.ok(!body.text.includes('AI 요약'));

  const empty = await get(`/api/briefing/text?day=${addDays(today, -7)}`);
  assert.match(empty.body.text, /통화가 없습니다/);
});

test('브리핑: AI 꺼짐 503 · 10분 캐시 · 없는 callId 는 null', async () => {
  insights.setAiForTest({ aiEnabled: () => false, writeBriefing: async () => ({ paragraph: 'x', todos: [] }) });
  let r = await post('/api/briefing', { day: today });
  assert.equal(r.res.status, 503);
  assert.equal(r.body.error, 'ai_off');
  assert.equal(r.body.message, 'AI 키 없음');

  let calls = 0;
  let seen;
  insights.setAiForTest({
    aiEnabled: () => true,
    writeBriefing: async (arg) => {
      calls += 1;
      seen = arg;
      return { paragraph: '오늘은 가짜 통화 9건. 새한카센터 앞범퍼가 급합니다.', todos: [{ title: '새한카센터 전화', why: 'LED', callId: 'c1' }, { title: '이상한 것', why: 'x', callId: 'nope' }] };
    },
  });
  r = await post('/api/briefing', { day: today });
  assert.equal(r.res.status, 200);
  assert.equal(calls, 1);
  assert.equal(seen.day, today);
  assert.equal(seen.stats.calls, 9);
  assert.equal(seen.cards.length, 7);
  assert.ok(seen.cards.every((c) => c.callId && c.status));
  assert.equal(seen.cards.find((c) => c.callId === 'c2').items, '백미러(좌)x2 품번 87610-AA000');
  assert.deepEqual(r.body.todos.map((t) => t.callId), ['c1', null]);
  const first = r.body.createdAt;

  r = await post('/api/briefing', { day: today });
  assert.equal(calls, 1, '10분 안이면 다시 부르지 않는다');
  assert.equal(r.body.createdAt, first);

  const dash = await get('/api/dashboard');
  assert.equal(dash.body.briefing.paragraph, '오늘은 가짜 통화 9건. 새한카센터 앞범퍼가 급합니다.');
  const text = await get('/api/briefing/text');
  assert.ok(text.body.text.endsWith(`■ AI 요약(${kstTime(first)} 기준)\n오늘은 가짜 통화 9건. 새한카센터 앞범퍼가 급합니다.`));

  // 만든 뒤 숫자가 바뀌면(옛 요약) 복사 글에 AI 요약을 붙이지 않는다
  db().prepare("UPDATE cards SET callback = 1, callback_reason = '가짜 표시' WHERE call_id = 'c8'").run();
  const staleText = await get('/api/briefing/text');
  assert.ok(!staleText.body.text.includes('AI 요약'), '숫자가 바뀐 옛 요약은 빠진다');
  assert.ok(staleText.body.text.includes('■ 다시 전화할 곳 2곳'));
  db().prepare("UPDATE cards SET callback = 0, callback_reason = NULL WHERE call_id = 'c8'").run();
  assert.ok((await get('/api/briefing/text')).body.text.includes('■ AI 요약('));

  // 통화가 없는 날은 AI 를 부르지 않고 DB 에도 남기지 않는다
  const quietDay = addDays(today, -7);
  r = await post('/api/briefing', { day: quietDay });
  assert.equal(r.res.status, 200);
  assert.equal(calls, 1);
  assert.match(r.body.paragraph, /통화가 없습니다/);
  assert.equal(r.body.model, null);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM briefings WHERE day = ?').get(quietDay).n, 0);

  // 날짜는 오늘 앞뒤 60일 안만
  for (const day of ['1990-01-01', addDays(today, -61), addDays(today, 61)]) {
    r = await post('/api/briefing', { day });
    assert.equal(r.res.status, 400, day);
    assert.equal(r.body.error, 'bad_date');
  }
  r = await post('/api/briefing', { day: addDays(today, -60) });
  assert.equal(r.res.status, 200);
  assert.equal(calls, 1);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM briefings').get().n, 1, '통화 있는 오늘 것만 남는다');
  insights.setAiForTest(null);
});

test('묻기: 거래처 · 날짜로 좁히고 ref 를 통화 · 문장으로 바꾼다', async () => {
  let seen;
  insights.setAiForTest({
    aiEnabled: () => true,
    answerQuestion: async (arg) => {
      seen = arg;
      const hit = arg.contexts.find((c) => c.kind === 'segment' && c.text.includes('앞범퍼') && c.callId === 'c1');
      return { answer: '새한카센터는 이번 주에 앞범퍼를 두 번 시켰어요.', found: true,
        citations: [{ ref: hit.ref, quote: '앞범퍼 하나' }, { ref: 'c99#1', quote: '지어낸 것' }, { ref: hit.ref, quote: '중복' }, { ref: '[c1]' }] };
    },
  });
  const { res, body } = await post('/api/ask', { question: '새한카센터가 이번 주에 앞범퍼 몇 개 시켰어?', history: [{ role: 'user', text: '안녕' }, { role: 'system', text: '무시' }] });
  assert.equal(res.status, 200);
  assert.equal(body.found, true);
  assert.equal(body.citations.length, 2);
  const [c, card] = body.citations;
  assert.equal(c.callId, 'c1');
  assert.equal(c.segIndex, 1);
  assert.equal(c.at, 2);
  assert.equal(c.quote, '앞범퍼 하나');
  assert.equal(c.recordedAt, at(today, '09:00'));
  assert.ok(c.title);
  assert.equal(card.segIndex, null);

  assert.deepEqual(body.scope.customers, ['새한카센터']);
  assert.equal(body.scope.label, '이번 주');
  const segCalls = new Set(seen.contexts.filter((x) => x.kind === 'segment').map((x) => x.callId));
  assert.deepEqual([...segCalls].sort(), ['c1', 'c7']);
  const cardLines = seen.contexts.filter((x) => x.kind === 'card');
  assert.ok(cardLines.length >= 7);
  assert.equal(cardLines[0].customer, '새한카센터', '물은 거래처 카드가 먼저');
  assert.ok(!seen.contexts.some((x) => x.callId === 'o2'), '이번 주 밖은 빠진다');
  assert.match(cardLines[0].text, /앞범퍼x1/);
  assert.deepEqual(seen.history, [{ role: 'user', text: '안녕' }]);
  insights.setAiForTest(null);
});

test('묻기: found=false · 근거 없는 답은 찾지 못했어요', async () => {
  insights.setAiForTest({ aiEnabled: () => true, answerQuestion: async () => ({ answer: '찾지 못했어요. 그런 통화는 없어요.', found: false, citations: [{ ref: 'c1#0' }] }) });
  let r = await post('/api/ask', { question: '한빛카 백미러 언제 시켰어?' });
  assert.equal(r.body.found, false);
  assert.deepEqual(r.body.citations, []);
  assert.equal(r.body.answer, '찾지 못했어요. 그런 통화는 없어요.');

  insights.setAiForTest({ aiEnabled: () => true, answerQuestion: async () => ({ answer: '세 번이요.', found: true, citations: [{ ref: 'c77#3' }] }) });
  r = await post('/api/ask', { question: '한빛카 백미러 언제 시켰어?' });
  assert.equal(r.body.found, false);
  assert.match(r.body.answer, /^찾지 못했어요/);
  insights.setAiForTest(null);
});

test('묻기: 입력 검사 · AI 키 없음 503', async () => {
  insights.setAiForTest({ aiEnabled: () => true, answerQuestion: async () => ({ answer: 'x', found: false, citations: [] }) });
  let r = await post('/api/ask', { question: '가'.repeat(301) });
  assert.equal(r.res.status, 400);
  r = await post('/api/ask', { question: '   ' });
  assert.equal(r.res.status, 400);
  insights.setAiForTest(null);
  r = await post('/api/ask', { question: '새한카센터 앞범퍼' });
  assert.equal(r.res.status, 503);
  assert.equal(r.body.error, 'ai_off');
});

test('출고 목록: 기본은 확정 · 출고 전 전부, today 는 그날 확정분', async () => {
  let { body } = await get('/api/shipping');
  assert.equal(body.scope, 'all');
  assert.equal(body.total, 3);
  const han = body.groups.find((g) => g.customer === '한빛카');
  assert.deepEqual(han.cards.map((c) => c.callId), ['c2', 'o1']);
  assert.equal(han.cards[0].plate, '12가3456');
  assert.equal(han.cards[0].items[0].partNo, '87610-AA000');
  assert.ok(body.groups.some((g) => g.customer === '=HYPERLINK("http://x")'));

  ({ body } = await get(`/api/shipping?scope=today&day=${today}`));
  assert.equal(body.total, 3);
  assert.deepEqual(body.groups.flatMap((g) => g.cards.map((c) => c.callId)).sort(), ['c2', 'c6', 'c7']);

  const r = await get('/api/shipping?scope=week');
  assert.equal(r.res.status, 400);
});

test('출고 CSV: BOM · 칸 · 수식 주입 막기', async () => {
  const res = await fetch(base + '/api/shipping.csv');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="callnote-fake-shipping-\d{4}-\d{2}-\d{2}\.csv"$/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = buf.toString('utf8').slice(1);
  const lines = text.trimEnd().split('\r\n');
  assert.equal(lines[0], '"거래처","통화 시각(KST)","차종","연식","차번호","부품","위치","수량","품번","원하는 때","받는 방법","급함","상태"');
  assert.equal(lines.length, 5);
  assert.ok(text.includes(`"한빛카","${today} 10:00","쏘나타 DN8","2021","12가3456","백미러","좌","2","87610-AA000","","퀵","급함","확정"`));
  assert.ok(text.includes(`"'=HYPERLINK(""http://x"")"`));
  assert.ok(text.includes(`"'+SUM(1)"`));
  assert.ok(!/(^|,)"=/.test(text.replace(/\r\n/g, '\n').split('\n').join(',')));

  assert.equal(insights.csvCell('-1'), `"'-1"`);
  assert.equal(insights.csvCell('@x'), `"'@x"`);
  assert.equal(insights.csvCell('a"b'), '"a""b"');
});

test('출고 대상: 주문 · 반품·교환 + 부품 있음만 — 출고 목록 · CSV · 급한데 출고 전 · 할 일 「출고」', async () => {
  // 사흘 전 날짜에 넣는다(앞 시험의 오늘 숫자를 바꾸지 않게)
  addCall({ id: 'n1', recordedAt: at(old3, '13:00'), customer: '대한카센터',
    card: { status: 'confirmed', callType: '배송 문의', urgent: true, items: [], confirmedAt: at(old3, '13:05') } });
  addCall({ id: 'n2', recordedAt: at(old3, '13:10'), customer: '한일카',
    card: { status: 'confirmed', callType: '기타', items: [], confirmedAt: at(old3, '13:15') } });
  addCall({ id: 'n3', recordedAt: at(old3, '13:20'), customer: '한빛모터스',
    card: { status: 'confirmed', callType: '반품·교환', urgent: true, items: [{ part: '앞범퍼(반품)', qty: 1 }], confirmedAt: at(old3, '13:25') } });
  addCall({ id: 'n4', recordedAt: at(old3, '13:30'), customer: '제일카서비스',
    card: { status: 'draft', callType: '재고·단가 문의', urgent: true, items: [{ part: '헤드램프', qty: 1 }] } });
  addCall({ id: 'n5', recordedAt: at(old3, '13:40'), customer: '세한모터스',
    card: { status: 'confirmed', callType: '주문', urgent: true, items: [], confirmedAt: at(old3, '13:45') } });

  const { body } = await get('/api/shipping');
  const ids = body.groups.flatMap((g) => g.cards.map((c) => c.callId)).sort();
  assert.deepEqual(ids, ['c2', 'c6', 'n3', 'o1']);
  assert.equal(body.total, 4, '머리 숫자도 남은 카드 수');

  const csv = await (await fetch(base + '/api/shipping.csv')).text();
  assert.ok(csv.includes('"앞범퍼(반품)"'));
  assert.ok(!csv.includes('대한카센터') && !csv.includes('한일카') && !csv.includes('세한모터스'), '출고할 것이 없는 카드는 CSV 에도 없다');

  const dash = await get(`/api/dashboard?day=${old3}`);
  assert.equal(dash.body.stats.urgentOpen, 1);
  assert.deepEqual(dash.body.urgentOpen.map((c) => c.callId), ['n3']);
  assert.deepEqual(dash.body.todos.filter((t) => t.kind === 'ship').map((t) => t.callId), ['n3']);
  const text = await get(`/api/briefing/text?day=${old3}`);
  assert.ok(text.body.text.includes('■ 급한데 아직 출고 안 된 것 1건'));
  assert.ok(text.body.text.includes('- 한빛모터스: 앞범퍼(반품) 1개 (확정)'));
  assert.ok(!text.body.text.includes('부품 확인 필요'));
});

test('질문 낱말 · 날짜 말', () => {
  assert.deepEqual(insights.questionTerms('한빛카가 이번 주에 백미러 몇 번 시켰어?'), ['한빛카', '백미러']);
  assert.deepEqual(insights.questionTerms('새한카센터가 앞범퍼 두 개라고 한 적 있어?'), ['새한카센터', '앞범퍼']);
  assert.deepEqual(insights.questionRange('지난주 니로', '2026-11-11'), { from: '2026-11-02', to: '2026-11-08', label: '지난주' });
  assert.deepEqual(insights.questionRange('이번 달', '2026-11-11'), { from: '2026-11-01', to: '2026-11-11', label: '이번 달' });
  assert.deepEqual(insights.questionRange('어제', '2026-11-01'), { from: '2026-10-31', to: '2026-10-31', label: '어제' });
  assert.equal(insights.questionRange('앞범퍼', '2026-11-11'), null);
  assert.deepEqual(insights.questionCustomers('새한카센 앞범퍼', ['새한카센'], ['새한카센터', '우리공업사']), ['새한카센터']);
});

test('묻기: lib/ai.mjs 가 쓰는 200개 안으로 문맥을 맞춘다', async () => {
  const segs = Array.from({ length: 30 }, (_, i) => seg(i * 2, i === 25 ? '머플러 하나 더요.' : `가짜 문장 ${i}`));
  for (let i = 0; i < 12; i += 1) addCall({ id: `m${i}`, recordedAt: at(addDays(today, -2), '09:00'), customer: '머플러상회', transcript: '머플러', segments: segs, card: { items: [{ part: '머플러', qty: 1 }] } });
  for (let i = 0; i < 230; i += 1) addCall({ id: `x${i}`, recordedAt: at(addDays(today, -4), '09:00'), customer: `가짜가게${i}`, card: { items: [{ part: '와셔', qty: 1 }] } });
  let seen;
  insights.setAiForTest({ aiEnabled: () => true, answerQuestion: async (arg) => { seen = arg; return { answer: '없음', found: false, citations: [] }; } });
  await post('/api/ask', { question: '머플러 누가 시켰어?' });
  const segCtx = seen.contexts.filter((c) => c.kind === 'segment');
  assert.ok(seen.contexts.length <= 200);
  assert.ok(segCtx.length <= 100);
  assert.ok(segCtx.some((c) => c.text === '머플러 하나 더요.' && c.segIndex === 25), '긴 통화에서도 맞은 문장은 들어간다');
  insights.setAiForTest(null);
});

test('이어진 질문은 앞 질문의 거래처 · 낱말을 쓴다 · AI 가 못 만든 빈 카드는 retry', () => {
  const { scope } = insights.buildAskContexts('그럼 지난주는?', [{ role: 'user', text: '새한카센터 앞범퍼 몇 개 시켰어?' }]);
  assert.deepEqual(scope.customers, ['새한카센터']);
  assert.equal(scope.label, '지난주');
  assert.ok(scope.terms.includes('앞범퍼'));

  const todos = insights.buildTodos([{
    row: { id: 'z1', status: 'ready', recorded_at: at(today, '09:00') }, customer: null, title: 't',
    card: { status: 'draft', aiError: 'no_key', items: [], askBack: [], unsure: [], urgent: false, callback: false },
  }]);
  assert.deepEqual(todos.map((t) => [t.kind, t.priority]), [['retry', 2]]);
});
