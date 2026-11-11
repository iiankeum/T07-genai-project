// lib/seed.mjs 시험: 가짜 데모 데이터 넣기 · 사전 · 날짜 굴리기 · 초기화
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
const { db, nowIso } = await import('../lib/db.mjs');
const seed = await import('../lib/seed.mjs');
const { kstDay } = await import('../lib/security.mjs');
const { callView, kstTime, dictionaryForAi, customerByPhone } = await import('../lib/repo.mjs');

// 처음 시드(대표님 프로토타입 10건 + 지어낸 10건) 모양을 시험용 폴더로 고정해 둔다. 실제 데모 시드는 seed/calls-fx.json.
const FIX = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'fixtures', 'seed-prototype');
const files = seed.loadSeedFiles(FIX);
const mainCalls = JSON.parse(fs.readFileSync(path.join(FIX, 'calls.json'), 'utf8'));
const n = (sql, ...a) => db().prepare(sql).get(...a).n;
const seedRows = () => db().prepare("SELECT * FROM calls WHERE source = 'seed' ORDER BY recorded_at").all();
// calls.json 에 든 통화만(해결사 방이 calls-*.json 을 더 넣어도 이 시험은 그대로)
const mainIds = new Set(mainCalls.calls.map((c) => c.id));
const mainRows = () => seedRows().filter((r) => mainIds.has(r.id));

test('seed 파일: 가짜 표시 · 18~20건 · 같은 id 없음 · 가짜 번호', () => {
  assert.match(mainCalls._설명, /가짜/);
  assert.ok(mainCalls.calls.length >= 18 && mainCalls.calls.length <= 20, `calls.json ${mainCalls.calls.length}건`);
  const ids = files.calls.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(files.customers.length, 28);
  for (const c of files.customers) assert.match(c.phone, /^010-0000-01\d\d$/);
  for (const c of files.calls) if (c.callerNumber) assert.match(c.callerNumber, /^010-0000-/);
  assert.ok(files.glossary.some((g) => g.kind === '차종' && g.term === '아반떼 AD'));
  assert.ok(files.glossary.some((g) => g.kind === '오인식' && g.term === '케이파이브' && g.standard === 'K5'));
});

test('turnsToSegments: 문장 나누기 · 말한 사람 · 시각 추정', () => {
  const segs = seed.turnsToSegments([
    { who: 'dealer', say: '네, 부품입니다.' },
    { who: 'shop', say: '새한카센터인데요. 앞범퍼 하나요.' },
  ]);
  assert.equal(segs.length, 3);
  assert.deepEqual(segs.map((s) => s.speaker), ['대리점', '정비소', '정비소']);
  assert.equal(segs[0].start, 0.4);
  assert.equal(segs[0].end, Math.round((0.4 + '네,부품입니다.'.length / 6.5) * 10) / 10);
  for (let i = 1; i < segs.length; i++) assert.ok(segs[i].start > segs[i - 1].end);
});

test('seedDemo: 빈 DB 에 통화 · 카드 · 사전 · 거래처를 넣는다', async () => {
  const inserted = await seed.seedDemo({ reset: false, dir: FIX });
  assert.equal(inserted, files.calls.length);
  assert.equal(n('SELECT COUNT(*) AS n FROM calls'), inserted);
  assert.equal(n('SELECT COUNT(*) AS n FROM cards'), inserted);

  // 사전: 현장말 · 오인식 · 차종 + 거래처(가짜 번호), 모두 기본
  assert.equal(n("SELECT COUNT(*) AS n FROM glossary WHERE kind <> '거래처'"), files.glossary.length);
  assert.equal(n("SELECT COUNT(*) AS n FROM glossary WHERE kind = '거래처' AND phone LIKE '010-0000-01%'"), 28);
  assert.equal(n("SELECT COUNT(*) AS n FROM glossary WHERE source <> '기본'"), 0);
  const dict = dictionaryForAi();
  assert.ok(dict.glossary.some((g) => g.term === '휀다' && g.standard === '펜더'));
  assert.ok(dict.carModels.includes('쏘나타 DN8'));
  assert.equal(customerByPhone('010-0000-0110'), '한성모터스');
});

test('시드 통화 모양: 오늘 09:00 KST 기준 시각 · 제목 · 문장 · 가짜 표시', () => {
  const today = kstDay();
  const rows = mainRows();
  for (const r of rows) {
    assert.equal(r.status, 'ready');
    assert.equal(r.is_fake, 1);
    assert.equal(r.engine, seed.SEED_ENGINE);
    assert.equal(r.audio_file, null);
    assert.ok(r.title && r.title.includes(kstTime(r.recorded_at)), r.title);
    assert.ok(r.summary);
    const segs = JSON.parse(r.segments);
    assert.ok(segs.length >= 3);
    for (const s of segs) assert.ok(['대리점', '정비소'].includes(s.speaker));
    assert.equal(r.transcript, segs.map((s) => s.text).join('\n'));
    assert.ok(r.duration_sec > segs[segs.length - 1].end - 0.01);
  }
  const c01 = rows.find((r) => r.id === 'seed-call01');
  assert.equal(c01.recorded_at, new Date(Date.parse(`${today}T00:00:00.000Z`) - 20 * 60_000).toISOString());
  assert.match(c01.title, /^새한카센터 · 앞범퍼 · 08:40 · /);
  assert.match(rows.find((r) => r.id === 'seed-call17').title, /^거래처 확인 필요 · /);
  const days = rows.map((r) => kstDay(new Date(r.recorded_at)));
  assert.ok(days.filter((d) => d === today).length >= 12, '오늘 통화');
  assert.ok(days.filter((d) => d < today).length >= 3 && days.filter((d) => d < today).length <= 4, '어제 통화 3~4건');
});

test('시드 카드: 상태 섞임 · 근거 문장 · AI 초안 · 품번은 불러 준 것만', () => {
  const cards = mainRows().map((r) => ({ row: r, view: callView(r, { withDetail: true }) }));
  const by = (f) => cards.filter(({ view }) => f(view.card)).length;
  assert.ok(by((c) => c.status === 'draft' && !c.callback) >= 5, '확인 필요');
  assert.ok(by((c) => c.status === 'confirmed') >= 5, '확정');
  assert.ok(by((c) => c.status === 'shipped') >= 3, '출고 완료');
  assert.ok(by((c) => c.callback) >= 3, '다시 전화');
  assert.ok(by((c) => c.urgent) >= 3, '급함');
  assert.ok(by((c) => c.unsure.length > 0) >= 2, '들어 보기');
  assert.ok(by((c) => c.urgent && c.status !== 'shipped') >= 2, '급한데 출고 안 됨');

  for (const { row, view } of cards) {
    const c = view.card;
    const segs = view.segments;
    assert.equal(c.aiModel, seed.SEED_MODEL);
    assert.ok(c.aiDraft && Array.isArray(c.aiDraft.items));
    assert.ok(c.items.length >= 1, row.id);
    for (const it of c.items) {
      assert.ok(it.quote && typeof it.at === 'number', `${row.id} ${it.part} 근거`);
      const seg = segs.find((s) => s.start === it.at);
      assert.ok(seg && seg.text === it.quote, `${row.id} ${it.part} 근거 문장 시각`);
      assert.ok(Number.isInteger(it.qty) && it.qty > 0);
    }
    for (const [field, e] of Object.entries(c.evidence)) {
      assert.ok(segs.some((s) => s.start === e.at && s.text === e.quote), `${row.id} evidence.${field}`);
    }
    assert.ok(c.highlights.some((h) => h.kind === 'part'), `${row.id} 강조`);
    for (const h of c.highlights) assert.ok(row.transcript.includes(h.text), `${row.id} 강조 「${h.text}」 는 글에 있어야`);
    for (const u of c.unsure) assert.ok(typeof u.at === 'number' && u.reason, `${row.id} 들어 보기 시각`);
    if (c.status === 'confirmed' || c.status === 'shipped') {
      assert.deepEqual(c.askBack, [], `${row.id} 확정 카드에 되물을 것`);
      assert.ok(c.confirmedAt);
    }
    if (c.status === 'shipped') assert.ok(c.shippedAt >= c.confirmedAt);
    if (c.callback) assert.ok(c.callbackReason);
  }
  // 품번: 통화에서 불러 준 세 건만
  const withPartNo = cards.filter(({ view }) => view.card.items.some((i) => i.partNo)).map(({ row }) => row.id).sort();
  assert.deepEqual(withPartNo, ['seed-call04', 'seed-call09', 'seed-call15']);
  // 고쳐 말한 수량은 마지막 값
  const c06 = cards.find(({ row }) => row.id === 'seed-call06').view.card;
  assert.equal(c06.items[0].qty, 20);
  assert.ok(c06.highlights.some((h) => h.kind === 'qty' && h.text === '스무 개'));
  // 되물을 것(call02 헤드라이트 LED)
  const c02 = cards.find(({ row }) => row.id === 'seed-call02').view.card;
  assert.match(c02.askBack[0], /LED/);
  assert.equal(c02.plate, '34나5678');
  // F11 번호로 거래처 확인
  const c16 = cards.find(({ row }) => row.id === 'seed-call16').view.card;
  assert.equal(c16.customer, '한성모터스');
  assert.equal(c16.customerByPhone, true);
  assert.deepEqual(c16.fixes, [{ heard: '아반대', fixed: '아반떼' }]);
  // AI 초안과 다른 칸만 「고침」
  const edited = Object.fromEntries(cards.map(({ row, view }) => [row.id, view.card.edited]));
  assert.deepEqual(edited['seed-call05'], ['note']);
  assert.deepEqual(edited['seed-call04'], ['delivery']);
  assert.deepEqual(edited['seed-call01'], []);
});

test('seedDemo(reset 아님): 이미 있으면 통화는 건너뛰고, 사전이 비었으면 사전만 넣는다', async () => {
  const before = n('SELECT COUNT(*) AS n FROM calls');
  assert.equal(await seed.seedDemo({ reset: false, dir: FIX }), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM calls'), before);
  db().exec('DELETE FROM glossary');
  assert.equal(await seed.seedDemo({ reset: false, dir: FIX }), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM glossary'), files.glossary.length + 28);
  assert.equal(n('SELECT COUNT(*) AS n FROM calls'), before);
});

test('rollSeedToToday: 오늘 통화가 없으면 날짜만 옮기고 시각은 그대로', () => {
  assert.equal(seed.rollSeedToToday(), 0, '오늘 통화가 있으면 안 옮김');
  // 시드 통화를 사흘 전으로 밀어 둔다
  const shift = 3 * 86_400_000;
  const back = (iso) => (iso ? new Date(Date.parse(iso) - shift).toISOString() : iso);
  const before = Object.fromEntries(seedRows().map((r) => [r.id, r.recorded_at]));
  const confirmedBefore = db().prepare("SELECT confirmed_at FROM cards WHERE call_id = 'seed-call01'").get().confirmed_at;
  for (const r of seedRows()) db().prepare('UPDATE calls SET recorded_at = ?, created_at = ? WHERE id = ?').run(back(r.recorded_at), back(r.created_at), r.id);
  db().prepare("UPDATE cards SET confirmed_at = ? WHERE call_id = 'seed-call01'").run(back(confirmedBefore));

  assert.equal(seed.rollSeedToToday(), 3);
  const after = seedRows();
  const latest = after[after.length - 1];
  assert.equal(kstDay(new Date(latest.recorded_at)), kstDay());
  for (const r of after) {
    assert.equal(r.recorded_at, before[r.id], `${r.id} 원래 날짜 · 시각으로`);
    assert.equal(kstTime(r.recorded_at), kstTime(before[r.id]));
  }
  assert.equal(db().prepare("SELECT confirmed_at FROM cards WHERE call_id = 'seed-call01'").get().confirmed_at, confirmedBefore);
  assert.equal(seed.rollSeedToToday(), 0, '두 번째는 할 일 없음');
});

test('rollSeedToToday: 시드가 아닌 통화가 오늘 있어도 시드는 오늘로 옮긴다', () => {
  const shift = 2 * 86_400_000;
  for (const r of seedRows()) db().prepare('UPDATE calls SET recorded_at = ? WHERE id = ?').run(new Date(Date.parse(r.recorded_at) - shift).toISOString(), r.id);
  db().prepare("INSERT INTO calls(id, created_at, recorded_at, source, status, is_fake) VALUES('live_t1', ?, ?, 'live', 'ready', 1)").run(nowIso(), nowIso());
  assert.equal(seed.rollSeedToToday(), 2);
  db().exec("DELETE FROM calls WHERE id = 'live_t1'");
  assert.equal(seed.rollSeedToToday(), 0);
});

test('seedDemo(reset): 통화 · 카드 · 일감 · 브리핑 · 사전을 비우고 다시 넣는다. 체험 신청은 그대로', async () => {
  const now = nowIso();
  db().prepare("INSERT INTO calls(id, created_at, recorded_at, source, status, is_fake, audio_file) VALUES('up_t1', ?, ?, 'upload', 'queued', 1, 'audio/up_t1.wav')").run(now, now);
  db().prepare("INSERT INTO jobs(id, call_id, state, created_at) VALUES('job_t1', 'up_t1', 'queued', ?)").run(now);
  db().prepare("INSERT INTO briefings(day, content, created_at) VALUES('2026-11-11', '{}', ?)").run(now);
  db().prepare("INSERT INTO recommendations(day, content, created_at) VALUES('2026-11-11', '[]', ?)").run(now);
  db().prepare("INSERT INTO glossary(id, kind, term, standard, status, source, created_at, updated_at) VALUES('g_user1', '현장말', '헨다', '휀다', 'approved', '사용자', ?, ?)").run(now, now);
  db().prepare("INSERT INTO trials(id, created_at, name, contact, consent_at) VALUES('trial_t1', ?, '가짜 이름', 'fake@example.com', ?)").run(now, now);

  const inserted = await seed.seedDemo({ reset: true, dir: FIX });
  assert.equal(inserted, files.calls.length);
  assert.equal(n('SELECT COUNT(*) AS n FROM calls'), files.calls.length);
  assert.equal(n("SELECT COUNT(*) AS n FROM calls WHERE id = 'up_t1'"), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM jobs'), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM briefings'), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM recommendations'), 0);
  assert.equal(n("SELECT COUNT(*) AS n FROM glossary WHERE source = '사용자'"), 0);
  assert.equal(n('SELECT COUNT(*) AS n FROM glossary'), files.glossary.length + 28);
  assert.equal(n('SELECT COUNT(*) AS n FROM trials'), 1);
  // 다시 넣은 시드는 오늘 기준
  const latest = seedRows().at(-1);
  assert.equal(kstDay(new Date(latest.recorded_at)), kstDay());
});
