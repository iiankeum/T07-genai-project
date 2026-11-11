// routes/calls.mjs 시험: 목록 · 찾기(matches) · 거르기 · 상세 · 오디오 Range · 거래처 · 관리자 지우기. 모든 데이터는 가짜.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
process.env.ADMIN_PASSCODE = 'fake-test-passcode';

const { db } = await import('../lib/db.mjs');
const { Router } = await import('../lib/http.mjs');
const { kstDay, adminLogin } = await import('../lib/security.mjs');
const { createApp } = await import('../server.mjs');
const calls = await import('../routes/calls.mjs');

const today = kstDay();
const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+09:00`).toISOString();
const dayBefore = (n) => calls.addDays(today, -n);

function addCall({ id, recordedAt, status = 'ready', title, customer, caller = null, transcript = '', segments = [], audio = null, card = null }) {
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title, customer, caller_number, duration_sec, audio_file, transcript, segments, is_fake)
    VALUES(?, ?, ?, 'seed', ?, ?, ?, ?, 20, ?, ?, ?, 1)`).run(id, now, recordedAt, status, title ?? null, customer ?? null, caller, audio, transcript, JSON.stringify(segments));
  if (card) {
    db().prepare(`INSERT INTO cards(call_id, status, customer, car_model, plate, items, urgent, due, delivery, ask_back, unsure, note, callback, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, card.status ?? 'draft', card.customer ?? null, card.carModel ?? null, card.plate ?? null,
      JSON.stringify(card.items ?? []), card.urgent ? 1 : 0, card.due ?? null, card.delivery ?? null, JSON.stringify(card.askBack ?? []),
      JSON.stringify(card.unsure ?? []), card.note ?? null, card.callback ? 1 : 0, now, now);
  }
}
const seg = (start, text) => ({ start, end: start + 2, text });

let server;
let base;

before(async () => {
  const now = new Date().toISOString();
  db().prepare(`INSERT INTO glossary(id, kind, term, standard, phone, status, source, created_at, updated_at)
    VALUES('g1', '거래처', '새한카센터', NULL, '010-1234-4829', 'approved', '기본', ?, ?), ('g2', '거래처', '우리공업사', NULL, '010-5555-1212', 'approved', '기본', ?, ?)`).run(now, now, now, now);

  addCall({
    id: 'call_a', recordedAt: at(today, '09:10'), title: '새한카센터 · 앞범퍼 · 09:10', customer: '새한카센터', caller: '010-1234-4829',
    transcript: '새한카센터인데요. 쏘렌토 앞범퍼 하나요. 급해요.',
    segments: [seg(0, '새한카센터인데요.'), seg(2, '쏘렌토 앞범퍼 하나요.'), seg(4, '급해요.')],
    audio: 'audio/call_a.wav',
    card: { status: 'draft', customer: '새한카센터', carModel: '쏘렌토 MQ4', items: [{ part: '앞범퍼', qty: 1 }], urgent: true },
  });
  addCall({
    id: 'call_b', recordedAt: at(today, '10:20'), title: '한빛카 · 백미러 · 10:20', customer: '한빛카',
    transcript: '한빛카예요. 아반떼 백미러 좌측 두 개 주세요. 100% 정품으로요.',
    segments: [seg(0, '한빛카예요.'), seg(2, '아반떼 백미러 좌측 두 개 주세요.'), seg(5, '100% 정품으로요.')],
    card: { status: 'confirmed', customer: '한빛카', carModel: '아반떼 CN7', items: [{ part: '백미러', side: '좌', qty: 2, partNo: '87610-AA000' }], plate: '12가3456' },
  });
  addCall({
    id: 'call_c', recordedAt: at(dayBefore(3), '15:00'), title: '새한카센터 · 휀다 · 15:00', customer: '새한카센터',
    transcript: '휀다 하나 보내 주세요. 쏘렌토요.', segments: [seg(0, '휀다 하나 보내 주세요.'), seg(3, '쏘렌토요.')],
    card: { status: 'shipped', customer: '새한카센터', carModel: '쏘렌토 MQ4', items: [{ part: '휀다', qty: 1 }] },
  });
  addCall({
    id: 'call_d', recordedAt: at(today, '11:00'), status: 'transcribing', title: '거래처 확인 필요 · 주문 내용 정리 전 · 11:00',
  });
  addCall({
    id: 'call_e', recordedAt: at(dayBefore(1), '16:00'), title: '우리공업사 · 라지에다', customer: '우리공업사',
    transcript: '라지에다 있어요? 색상은 다시 알려 드릴게요.', segments: [seg(0, '라지에다 있어요?'), seg(2, '색상은 다시 알려 드릴게요.')],
    card: { status: 'draft', customer: '우리공업사', items: [{ part: '라디에이터', qty: 1 }], askBack: ['색상'] },
  });
  addCall({ id: 'call_bad', recordedAt: at(dayBefore(2), '08:00'), title: '이상한 경로', audio: 'callnote.sqlite' });
  addCall({ id: 'call_gone', recordedAt: at(dayBefore(2), '08:30'), title: '파일 없음', audio: 'audio/nope.wav' });

  // 가짜 WAV: 44바이트 머리 + 1000바이트
  const dir = path.join(process.env.DATA_DIR, 'audio');
  fs.mkdirSync(dir, { recursive: true });
  const buf = Buffer.alloc(1044);
  buf.write('RIFF', 0); buf.write('WAVE', 8);
  for (let i = 44; i < buf.length; i += 1) buf[i] = i % 256;
  fs.writeFileSync(path.join(dir, 'call_a.wav'), buf);

  const router = new Router();
  calls.register(router);
  server = http.createServer(createApp(router));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((r) => server.close(r)));

const get = async (p, headers = {}) => {
  const res = await fetch(base + p, { headers });
  const type = res.headers.get('content-type') || '';
  return { res, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
};

test('목록: 최신순 · total · 카드 포함 · 글은 빼고', async () => {
  const { res, body } = await get('/api/calls');
  assert.equal(res.status, 200);
  assert.equal(body.total, 7);
  assert.equal(body.limit, 50);
  const ids = body.calls.map((c) => c.id);
  assert.deepEqual(ids.slice(0, 3), ['call_d', 'call_b', 'call_a']);
  const a = body.calls.find((c) => c.id === 'call_a');
  assert.equal(a.card.status, 'draft');
  assert.equal(a.callerNumber, '010-****-4829');
  assert.equal(a.transcript, undefined);
  assert.equal(a.matches, undefined);
});

test('찾기: 낱말 모두(AND) · 맞은 문장(matches) · 카드 칸 · 부품 JSON 값', async () => {
  let { body } = await get('/api/calls?q=' + encodeURIComponent('쏘렌토'));
  assert.deepEqual(body.calls.map((c) => c.id).sort(), ['call_a', 'call_c']);
  const a = body.calls.find((c) => c.id === 'call_a');
  assert.deepEqual(a.matches, [{ segIndex: 1, at: 2, text: '쏘렌토 앞범퍼 하나요.' }]);
  assert.deepEqual(body.terms, ['쏘렌토']);

  ({ body } = await get('/api/calls?q=' + encodeURIComponent('쏘렌토 앞범퍼')));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_a']);

  // 카드에만 있는 값(품번 · 차번호 · 차종)
  ({ body } = await get('/api/calls?q=87610'));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_b']);
  assert.deepEqual(body.calls[0].matches, []);
  ({ body } = await get('/api/calls?q=' + encodeURIComponent('12가3456')));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_b']);
  ({ body } = await get('/api/calls?q=' + encodeURIComponent('라디에이터')));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_e']);

  // JSON 열쇠 이름에는 걸리지 않는다
  ({ body } = await get('/api/calls?q=qty'));
  assert.equal(body.total, 0);
});

test('찾기: % _ 는 글자 그대로', async () => {
  let { body } = await get('/api/calls?q=' + encodeURIComponent('%'));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_b']);
  ({ body } = await get('/api/calls?q=_'));
  assert.equal(body.total, 0);
});

test('거르기: 상태 · 날짜 · 거래처 · limit/offset', async () => {
  let { body } = await get('/api/calls?status=draft');
  assert.deepEqual(body.calls.map((c) => c.id).sort(), ['call_a', 'call_e']);
  ({ body } = await get('/api/calls?status=confirmed'));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_b']);
  ({ body } = await get('/api/calls?status=shipped'));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_c']);
  ({ body } = await get('/api/calls?status=working'));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_d']);
  ({ body } = await get('/api/calls?status=callback'));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_e']);
  ({ body } = await get('/api/calls?status=failed'));
  assert.equal(body.total, 0);

  ({ body } = await get(`/api/calls?from=${today}&to=${today}`));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_d', 'call_b', 'call_a']);
  ({ body } = await get(`/api/calls?to=${dayBefore(1)}`));
  assert.ok(body.calls.every((c) => c.recordedAt < at(today, '00:00')));

  ({ body } = await get('/api/calls?customer=' + encodeURIComponent('새한카센터')));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_a', 'call_c']);

  ({ body } = await get('/api/calls?limit=2&offset=1'));
  assert.equal(body.calls.length, 2);
  assert.equal(body.total, 7);
  assert.deepEqual(body.calls.map((c) => c.id), ['call_b', 'call_a']);

  let r = await get('/api/calls?status=nope');
  assert.equal(r.res.status, 400);
  r = await get('/api/calls?from=2026-13-40');
  assert.equal(r.res.status, 400);
  assert.equal(r.body.error, 'bad_date');
});

test('상세: 글 · 문장 포함, 없으면 404', async () => {
  const { res, body } = await get('/api/calls/call_a');
  assert.equal(res.status, 200);
  assert.equal(body.segments.length, 3);
  assert.match(body.transcript, /쏘렌토/);
  assert.equal(body.hasAudio, true);
  const r = await get('/api/calls/nope');
  assert.equal(r.res.status, 404);
});

test('오디오: 전체 · Range · 끝에서 · 범위 밖 · 내려받기 · 경로 막기', async () => {
  let r = await get('/api/calls/call_a/audio');
  assert.equal(r.res.status, 200);
  assert.equal(r.res.headers.get('content-type'), 'audio/wav');
  assert.equal(r.res.headers.get('accept-ranges'), 'bytes');
  assert.equal(r.body.length, 1044);

  r = await get('/api/calls/call_a/audio', { Range: 'bytes=44-99' });
  assert.equal(r.res.status, 206);
  assert.equal(r.res.headers.get('content-range'), 'bytes 44-99/1044');
  assert.equal(r.body.length, 56);
  assert.equal(r.body[0], 44);

  r = await get('/api/calls/call_a/audio', { Range: 'bytes=-10' });
  assert.equal(r.res.status, 206);
  assert.equal(r.res.headers.get('content-range'), 'bytes 1034-1043/1044');
  assert.equal(r.body.length, 10);

  r = await get('/api/calls/call_a/audio', { Range: 'bytes=1000-' });
  assert.equal(r.res.headers.get('content-range'), 'bytes 1000-1043/1044');

  r = await get('/api/calls/call_a/audio', { Range: 'bytes=5000-6000' });
  assert.equal(r.res.status, 416);
  assert.equal(r.res.headers.get('content-range'), 'bytes */1044');

  r = await get('/api/calls/call_a/audio?download=1');
  assert.equal(r.res.headers.get('content-disposition'), 'attachment; filename="callnote-fake-call_a.wav"');

  r = await get('/api/calls/call_b/audio');
  assert.equal(r.res.status, 404);
  assert.equal(r.body.error, 'no_audio');
  r = await get('/api/calls/call_gone/audio');
  assert.equal(r.res.status, 404);
  assert.equal(r.body.error, 'no_audio');
  r = await get('/api/calls/call_bad/audio');
  assert.equal(r.res.status, 400);
});

test('parseRange 경계', () => {
  assert.equal(calls.parseRange(undefined, 100), null);
  assert.equal(calls.parseRange('bytes=0-1,5-6', 100), null);
  assert.equal(calls.parseRange('items=0-1', 100), null);
  assert.deepEqual(calls.parseRange('bytes=0-500', 100), { start: 0, end: 99 });
  assert.equal(calls.parseRange('bytes=-0', 100), 'unsatisfiable');
  assert.equal(calls.parseRange('bytes=0-', 0), 'unsatisfiable');
});

test('거래처 목록: 사전 + 통화, 번호는 가림', async () => {
  const { body } = await get('/api/customers');
  const by = Object.fromEntries(body.customers.map((c) => [c.name, c]));
  assert.deepEqual(Object.keys(by).sort(), ['새한카센터', '우리공업사', '한빛카'].sort());
  assert.equal(by['새한카센터'].calls, 2);
  assert.equal(by['새한카센터'].openCards, 1);
  assert.equal(by['새한카센터'].phone, '010-****-4829');
  assert.equal(by['새한카센터'].lastAt, at(today, '09:10'));
  assert.equal(by['한빛카'].phone, null);
  assert.equal(by['우리공업사'].phone, '010-****-1212');
  assert.ok(!JSON.stringify(body).includes('1234-4829'));
  // 최근 통화가 먼저
  assert.equal(body.customers[0].name, '한빛카');
});

test('거래처별 통화(F13): 최신 먼저, 모르는 이름은 404', async () => {
  const { res, body } = await get('/api/customers/' + encodeURIComponent('새한카센터'));
  assert.equal(res.status, 200);
  assert.equal(body.customer.name, '새한카센터');
  assert.equal(body.customer.phone, '010-****-4829');
  assert.deepEqual(body.calls.map((c) => c.id), ['call_a', 'call_c']);
  const r = await get('/api/customers/' + encodeURIComponent('없는가게'));
  assert.equal(r.res.status, 404);
});

test('지우기: 관리자만, 카드 · 일감 · 오디오까지', async () => {
  let res = await fetch(base + '/api/calls/call_a', { method: 'DELETE' });
  assert.equal(res.status, 401);

  db().prepare("INSERT INTO jobs(id, call_id, state, created_at) VALUES('job_1', 'call_a', 'queued', ?)").run(new Date().toISOString());
  const token = adminLogin('fake-test-passcode');
  res = await fetch(base + '/api/calls/call_a', { method: 'DELETE', headers: { Cookie: `cn_admin=${token}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.audioDeleted, true);
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM calls WHERE id = 'call_a'").get().n, 0);
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM cards WHERE call_id = 'call_a'").get().n, 0);
  assert.equal(db().prepare("SELECT COUNT(*) AS n FROM jobs WHERE call_id = 'call_a'").get().n, 0);
  assert.equal(fs.existsSync(path.join(process.env.DATA_DIR, 'audio', 'call_a.wav')), false);

  res = await fetch(base + '/api/calls/call_a', { method: 'DELETE', headers: { Cookie: `cn_admin=${token}` } });
  assert.equal(res.status, 404);
  // 경로가 이상한 통화를 지워도 DATA_DIR 의 다른 파일은 그대로
  res = await fetch(base + '/api/calls/call_bad', { method: 'DELETE', headers: { Cookie: `cn_admin=${token}` } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).audioDeleted, false);
  assert.ok(fs.existsSync(path.join(process.env.DATA_DIR, 'callnote.sqlite')));
});

test('찾기: 통화 종류(call_type)로도 찾는다', async () => {
  db().prepare("UPDATE cards SET call_type = '반품·교환' WHERE call_id = 'call_e'").run();
  const { body } = await get('/api/calls?q=' + encodeURIComponent('반품'));
  assert.deepEqual(body.calls.map((c) => c.id), ['call_e']);
  assert.equal(body.calls[0].card.callType, '반품·교환');
});
