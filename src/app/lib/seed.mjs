// 가짜 데모 데이터 넣기(seed/*.json → calls · cards · glossary)와 시드 통화 날짜를 오늘로 굴리기.
// 시드 통화는 녹음이 없는 대본(source='seed', is_fake=1)이다. 형식은 seed/README.md.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { APP_DIR, config } from './config.mjs';
import { db, tx, newId, nowIso } from './db.mjs';
import { kstDay } from './security.mjs';
import { makeTitle } from './repo.mjs';

export const SEED_DIR = path.join(APP_DIR, 'seed');
export const SEED_ENGINE = '대본(가짜 통화 · 녹음 없음)';
export const SEED_ENGINE_AUDIO = '대본 + 합성 음성(가짜 통화)';
export const SEED_MODEL = 'seed(정답 카드)';

const SPEAKER = { dealer: '대리점', shop: '정비소' };
const CARD_STATUS = ['draft', 'confirmed', 'shipped', 'cancelled'];
const MIN = 60_000;
const r1 = (x) => Math.round(x * 10) / 10;

// ── 파일 읽기 ─────────────────────────────────────────────────────
function readJsonFile(file) {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
}
/** 배열이거나 {_설명, <key>:[...]} 꼴 모두 받는다 */
function listFrom(json, key) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json[key])) return json[key];
  return [];
}

/** seed 폴더의 파일을 읽는다. 통화는 calls*.json 을 모두 합친다(이름순). */
export function loadSeedFiles(dir = SEED_DIR) {
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^calls.*\.json$/i.test(f)).sort() : [];
  const calls = [];
  for (const f of files) {
    for (const c of listFrom(readJsonFile(path.join(dir, f)), 'calls')) calls.push({ ...c, _file: f });
  }
  const g = path.join(dir, 'glossary.json');
  const cu = path.join(dir, 'customers.json');
  return {
    files,
    calls,
    glossary: existsSync(g) ? listFrom(readJsonFile(g), 'items') : [],
    customers: existsSync(cu) ? listFrom(readJsonFile(cu), 'customers') : [],
  };
}

// ── 대본 → 문장 · 시각 ─────────────────────────────────────────────
/** 한 사람의 말을 문장으로 나눈다 */
function splitSentences(say) {
  return String(say || '').split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * turns → segments. 시각은 말 길이로 추정한다: (공백 뺀 글자 수 / 6.5)초 + 0.4초 쉼.
 * @returns {{start:number,end:number,text:string,speaker:string}[]}
 */
export function turnsToSegments(turns) {
  const segs = [];
  let t = 0.4;
  for (const turn of Array.isArray(turns) ? turns : []) {
    for (const text of splitSentences(turn?.say)) {
      const len = Math.max(0.8, text.replace(/\s/g, '').length / 6.5);
      segs.push({ start: r1(t), end: r1(t + len), text, speaker: SPEAKER[turn.who] || String(turn.who || '') });
      t += len + 0.4;
    }
  }
  return segs;
}

// ── 느슨한 찾기(공백 · 문장부호 무시) ─────────────────────────────────
const SKIP = /[\s,.!?~·…'"“”‘’()]/;
function looseFind(text, needle) {
  if (!needle) return null;
  const keep = [];
  let norm = '';
  for (let i = 0; i < text.length; i++) {
    if (!SKIP.test(text[i])) { keep.push(i); norm += text[i].toLowerCase(); }
  }
  const n = [...String(needle)].filter((ch) => !SKIP.test(ch)).join('').toLowerCase();
  if (!n) return null;
  const k = norm.indexOf(n);
  if (k < 0) return null;
  const start = keep[k];
  const end = keep[k + n.length - 1] + 1;
  return { start, end, match: text.slice(start, end) };
}
/** segments 에서 needle 이 든 첫 문장(from 부터) */
function findSeg(segs, needle, from = 0) {
  for (let i = Math.max(0, from); i < segs.length; i++) {
    const m = looseFind(segs[i].text, needle);
    if (m) return { index: i, seg: segs[i], match: m.match };
  }
  return null;
}

const stripParen = (s) => String(s || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

// 수량을 말로 읽은 꼴(정답 카드 수량 → 통화에서 찾을 낱말)
const QTY_WORDS = {
  1: ['하나', '한 개', '한 장', '한 세트', '한 쌍', '한 짝', '한 통'],
  2: ['두 개', '두 장', '두 짝', '두 통', '두 세트', '둘'],
  3: ['세 개', '세 장', '셋'],
  4: ['네 개', '네 장', '넷'],
  5: ['다섯 개', '다섯'],
  6: ['여섯 개', '여섯'],
  7: ['일곱 개', '일곱'],
  8: ['여덟 개', '여덟'],
  9: ['아홉 개', '아홉'],
  10: ['열 개', '열 장'],
  20: ['스무 개', '스무 장', '스물'],
  30: ['서른 개', '서른'],
};
const URGENT_WORDS = ['급해', '급하게', '빨리', '퀵으로', '꼭 필요'];

/**
 * 시드 통화 하나 → calls 행 · cards 행 값. DB 를 건드리지 않는다(검사 도구 · 시험도 쓴다).
 * @param {object} sc seed/calls.json 의 통화 하나
 * @param {{anchorMs:number, customers?:{name:string,phone:string}[]}} opt anchorMs = 오늘 09:00 KST(ms)
 * @returns {{call:object, card:object, warnings:string[]}}
 */
export function buildSeedCall(sc, { anchorMs, customers = [] }) {
  const warnings = [];
  const warn = (m) => warnings.push(`${sc?.id || '?'}: ${m}`);
  const src = sc.card || {};
  const say = sc.say || {};
  // 문장 시각이 있으면(해결사 방 합성 음성의 실제 시각) 그대로, 없으면 말 길이로 추정
  const segs = Array.isArray(sc.segments) && sc.segments.length
    ? sc.segments.filter((x) => x && x.text).map((x) => ({ start: r1(Number(x.start) || 0), end: r1(Number(x.end) || 0), text: String(x.text), speaker: x.speaker ? String(x.speaker) : undefined }))
    : turnsToSegments(sc.turns);
  const evq = (f) => (src.evidence && typeof src.evidence[f] === 'string' ? src.evidence[f] : null);
  if (!segs.length) warn('turns 가 비었습니다');
  const lastEnd = segs.length ? segs[segs.length - 1].end : 0;
  const durationSec = Number.isFinite(Number(sc.durationSec)) && sc.durationSec !== null ? Number(sc.durationSec) : r1(lastEnd + 0.8);
  const recordedMs = anchorMs + Number(sc.offsetMin || 0) * MIN;
  const recordedAt = new Date(recordedMs).toISOString();
  const transcript = segs.map((s) => s.text).join('\n');

  const highlights = [];
  const addHl = (text, kind) => {
    if (text && !highlights.some((h) => h.text === text && h.kind === kind)) highlights.push({ text, kind });
  };

  // 근거(evidence): 칸마다 그 말을 한 첫 문장
  const evidence = {};
  const ev = (field, needle, hlKind) => {
    if (!needle) return null;
    const hit = findSeg(segs, needle);
    if (!hit) { warn(`${field} 근거 문장을 못 찾음(「${needle}」)`); return null; }
    evidence[field] = { quote: hit.seg.text, at: hit.seg.start };
    if (hlKind) addHl(hit.match, hlKind);
    return hit;
  };
  ev('customer', evq('customer') || say.customer || src.customer, 'customer');
  ev('contact', evq('contact') || say.contact || src.contact, null);
  ev('carModel', evq('carModel') || say.carModel || (src.carModel ? String(src.carModel).split(/\s+/)[0] : null), 'car');
  ev('modelYear', evq('modelYear') || say.modelYear, 'car');
  ev('plate', evq('plate') || say.plate, 'plate');
  if (src.urgent) {
    if (evq('urgent') || say.urgent) ev('urgent', evq('urgent') || say.urgent, 'urgent');
    else {
      const w = URGENT_WORDS.find((x) => findSeg(segs, x));
      if (w) ev('urgent', w, 'urgent');
    }
  }
  if (evq('due') || say.due || src.due) {
    const hit = findSeg(segs, evq('due') || say.due || src.due);
    if (hit) evidence.due = { quote: hit.seg.text, at: hit.seg.start };
    else if (say.due) warn(`due 근거 문장을 못 찾음(「${say.due}」)`);
  }
  if (evq('delivery') || say.delivery || src.delivery) {
    const hit = findSeg(segs, evq('delivery') || say.delivery || src.delivery);
    if (hit) evidence.delivery = { quote: hit.seg.text, at: hit.seg.start };
    else if (say.delivery) warn(`delivery 근거 문장을 못 찾음(「${say.delivery}」)`);
  }

  // 부품 줄: quote/at 은 부품 이름이 든 첫 문장
  const items = (Array.isArray(src.items) ? src.items : []).map((it, i) => {
    const hint = (Array.isArray(say.items) && say.items[i]) || {};
    const qty = it.qty == null || it.qty === '' ? null : Number(it.qty);
    const out = { part: it.part ?? null, side: it.side ?? null, qty: Number.isFinite(qty) ? qty : null, partNo: it.partNo ?? null, quote: null, at: null };
    const partHit = findSeg(segs, it.quote || hint.part || stripParen(it.part)) || findSeg(segs, stripParen(it.part));
    if (partHit) {
      out.quote = partHit.seg.text;
      out.at = partHit.seg.start;
      addHl(partHit.match, 'part');
      const qtyNeedles = hint.qty ? [hint.qty] : (QTY_WORDS[out.qty] || []);
      for (const q of qtyNeedles) {
        const qh = findSeg(segs, q, partHit.index);
        if (qh) { addHl(qh.match, 'qty'); break; }
      }
    } else {
      warn(`부품 「${it.part}」 이 든 문장을 못 찾음`);
    }
    return out;
  });

  // 대본이 준 강조 낱말(글에 그대로 있는 것만)
  for (const h of Array.isArray(src.highlights) ? src.highlights : []) {
    if (h && h.text && h.kind) { const hit = findSeg(segs, h.text); if (hit) addHl(hit.match, h.kind); }
  }

  for (const a of Array.isArray(say.ask) ? say.ask : []) {
    const hit = findSeg(segs, a);
    if (hit) addHl(hit.match, 'ask');
    else warn(`되물은 말 「${a}」 을 못 찾음`);
  }

  // 들어 보기(unsure): at 은 say → 그 칸 근거 → 그 부품 줄 순서로
  const unsure = (Array.isArray(src.unsure) ? src.unsure : []).map((u) => {
    let at = null;
    if (u.say || u.quote) {
      const hit = findSeg(segs, u.say || u.quote);
      if (hit) { at = hit.seg.start; addHl(hit.match, u.field === 'plate' ? 'plate' : 'ask'); }
      else warn(`들어 보기 「${u.say}」 를 못 찾음`);
    }
    if (at == null && evidence[u.field]) at = evidence[u.field].at;
    if (at == null && Number.isInteger(u.item) && items[u.item]) at = items[u.item].at;
    const o = { field: u.field, reason: u.reason, at };
    if (Number.isInteger(u.item)) o.item = u.item;
    return o;
  });

  // F11: 걸려 온 번호가 거래처 목록 번호와 같으면 「번호로 확인」
  const digits = (s) => String(s || '').replace(/[^0-9]/g, '');
  const byPhone = typeof src.customerByPhone === 'boolean'
    ? src.customerByPhone
    : Boolean(sc.callerNumber && src.customer && customers.some((c) => c.name === src.customer && digits(c.phone) && digits(c.phone) === digits(sc.callerNumber)));
  if (src.customer && customers.length && !customers.some((c) => c.name === src.customer)) warn(`거래처 「${src.customer}」 가 customers.json 에 없음`);

  const status = CARD_STATUS.includes(sc.status) ? sc.status : 'draft';
  const askBack = Array.isArray(src.askBack) ? src.askBack.map(String) : [];
  if ((status === 'confirmed' || status === 'shipped') && askBack.length) warn('확정 · 출고 카드에 되물을 것이 남아 있음');

  const content = {
    customer: src.customer ?? null,
    customerByPhone: byPhone,
    contact: src.contact ?? null,
    carModel: src.carModel ?? null,
    modelYear: src.modelYear == null ? null : String(src.modelYear),
    plate: src.plate ?? null,
    items,
    urgent: Boolean(src.urgent),
    due: src.due ?? null,
    delivery: src.delivery ?? null,
    askBack,
    unsure,
    fixes: Array.isArray(src.fixes) ? src.fixes : [],
    evidence,
    highlights,
    note: src.note ?? null,
  };
  // AI 초안 = 같은 카드. aiDraftDiff 가 있으면 그 칸만 AI 가 다르게 썼던 것으로(화면의 「고침」 표시용)
  const diff = sc.aiDraftDiff && typeof sc.aiDraftDiff === 'object' ? sc.aiDraftDiff : {};
  const aiDraft = { ...content, ...diff };

  // 시각들
  const createdMs = recordedMs + Math.round(durationSec * 1000);
  const cardCreatedMs = createdMs + 30_000;
  let confirmedMs = null;
  let shippedMs = null;
  if (status === 'confirmed' || status === 'shipped') {
    confirmedMs = Number.isFinite(sc.confirmedOffsetMin) ? anchorMs + sc.confirmedOffsetMin * MIN : createdMs + 10 * MIN;
  }
  if (status === 'shipped') {
    shippedMs = Number.isFinite(sc.shippedOffsetMin) ? anchorMs + sc.shippedOffsetMin * MIN : confirmedMs + 40 * MIN;
  }
  const updatedMs = Math.max(cardCreatedMs, confirmedMs || 0, shippedMs || 0);
  const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());

  const audioRel = `audio/${String(sc.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.wav`;
  const hasAudio = existsSync(path.join(config.dataDir, audioRel));
  const call = {
    id: String(sc.id),
    created_at: iso(createdMs),
    recorded_at: recordedAt,
    source: 'seed',
    status: 'ready',
    title: makeTitle({ customer: content.customer, items, recordedAt, durationSec, source: 'seed' }),
    customer: content.customer,
    caller_number: sc.callerNumber || null,
    duration_sec: durationSec,
    transcript,
    segments: JSON.stringify(segs),
    engine: sc.audio ? SEED_ENGINE_AUDIO : SEED_ENGINE,
    is_fake: 1,
    // 대본 안 통화 번호(c14 등)는 화면에서 뜻이 없으니 「앞 통화」로
    summary: sc.summary ? String(sc.summary).replace(/(^|[^A-Za-z0-9])c\d{2}(?![0-9])/g, '$1앞 통화').slice(0, 160) : makeSummary(content),
    audio_file: hasAudio ? audioRel : null,
  };
  const card = {
    call_id: call.id,
    status,
    call_type: ['주문', '배송 문의', '반품·교환', '재고·단가 문의', '기타'].includes(sc.callType || src.callType) ? (sc.callType || src.callType) : '주문',
    customer: content.customer,
    contact: content.contact,
    car_model: content.carModel,
    model_year: content.modelYear,
    plate: content.plate,
    items: JSON.stringify(items),
    urgent: content.urgent ? 1 : 0,
    due: content.due,
    delivery: content.delivery,
    ask_back: JSON.stringify(askBack),
    unsure: JSON.stringify(unsure),
    fixes: JSON.stringify(content.fixes),
    evidence: JSON.stringify(evidence),
    highlights: JSON.stringify(highlights),
    note: content.note,
    customer_by_phone: byPhone ? 1 : 0,
    callback: sc.callback ? 1 : 0,
    callback_reason: sc.callback ? (sc.callbackReason || null) : null,
    ai_draft: JSON.stringify(aiDraft),
    ai_model: SEED_MODEL,
    edits: Object.keys(diff).length,
    created_at: iso(cardCreatedMs),
    updated_at: iso(updatedMs),
    confirmed_at: iso(confirmedMs),
    shipped_at: iso(shippedMs),
  };
  return { call, card, warnings };
}

/** 한 줄 요약: 「쏘나타 DN8 운전석 휀다 1개, 운전석 헤드라이트 1개 · 내일」 */
function makeSummary(c) {
  const parts = c.items.map((i) => [i.side, stripParen(i.part), i.qty != null ? `${i.qty}개` : null].filter(Boolean).join(' '));
  let s = [c.carModel, parts.join(', ')].filter(Boolean).join(' ');
  const tail = [c.due, c.delivery].filter(Boolean).join(' · ');
  if (tail) s += (s ? ' · ' : '') + tail;
  return (s || '주문 내용 없음').slice(0, 120);
}

/** 오늘(KST) 09:00 의 시각(ms). 09:00 KST = 같은 날 00:00 UTC */
export function seedAnchorMs(now = new Date()) {
  return Date.parse(`${kstDay(now)}T00:00:00.000Z`);
}

// ── DB 에 넣기 ─────────────────────────────────────────────────────
const CALL_COLS = ['id', 'created_at', 'recorded_at', 'source', 'status', 'title', 'customer', 'caller_number', 'duration_sec', 'transcript', 'segments', 'engine', 'is_fake', 'summary', 'audio_file'];
const CARD_COLS = ['call_id', 'status', 'call_type', 'customer', 'contact', 'car_model', 'model_year', 'plate', 'items', 'urgent', 'due', 'delivery', 'ask_back', 'unsure', 'fixes', 'evidence', 'highlights', 'note', 'customer_by_phone', 'callback', 'callback_reason', 'ai_draft', 'ai_model', 'edits', 'created_at', 'updated_at', 'confirmed_at', 'shipped_at'];
const insertSql = (table, cols) => `INSERT OR IGNORE INTO ${table}(${cols.join(', ')}) VALUES(${cols.map(() => '?').join(', ')})`;

function insertGlossary(d, glossary, customers) {
  const now = nowIso();
  const stmt = d.prepare('INSERT INTO glossary(id, kind, term, standard, phone, note, status, source, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const seen = new Set();
  let n = 0;
  const put = (kind, term, standard, phone, note) => {
    const t = String(term || '').trim();
    if (!t || seen.has(kind + '|' + t)) return;
    seen.add(kind + '|' + t);
    stmt.run(newId('g'), kind, t, standard || null, phone || null, note || null, 'approved', '기본', now, now);
    n++;
  };
  for (const g of glossary) {
    if (['현장말', '오인식', '차종', '거래처'].includes(g.kind)) put(g.kind, g.term, g.standard, g.kind === '거래처' ? g.phone : null, g.note);
  }
  for (const c of customers) put('거래처', c.name, null, c.phone, null);
  return n;
}

/**
 * 가짜 데모 데이터를 넣는다.
 * reset 이면 통화 · 카드 · 일감 · 브리핑 · 추천 · 사전을 모두 비우고 다시 넣는다(오디오 파일 · 체험 신청은 그대로).
 * reset 이 아니면 비어 있는 것만 넣는다(통화가 하나라도 있으면 통화는 건너뛰고, 사전이 비었으면 사전만).
 * @returns {Promise<number>} 넣은 통화 수
 */
export async function seedDemo({ reset = false, dir = SEED_DIR, now = new Date() } = {}) {
  const data = loadSeedFiles(dir);
  let anchorMs = seedAnchorMs(now);
  // 가장 늦은 시드 통화가 「미래」가 되지 않게(지금 - 5분보다 늦으면 전체를 앞으로 당긴다)
  const maxOff = Math.max(0, ...data.calls.map((c) => Number(c?.offsetMin) || 0));
  const limitMs = now.getTime() - 5 * MIN;
  if (anchorMs + maxOff * MIN > limitMs) anchorMs = limitMs - maxOff * MIN;
  return tx((d) => {
    if (reset) {
      for (const t of ['jobs', 'cards', 'calls', 'briefings', 'recommendations', 'glossary']) d.exec(`DELETE FROM ${t}`);
    }
    if (d.prepare('SELECT COUNT(*) AS n FROM glossary').get().n === 0) {
      insertGlossary(d, data.glossary, data.customers);
    }
    if (d.prepare('SELECT COUNT(*) AS n FROM calls').get().n > 0) return 0;
    const callStmt = d.prepare(insertSql('calls', CALL_COLS));
    const cardStmt = d.prepare(insertSql('cards', CARD_COLS));
    const seen = new Set();
    let n = 0;
    for (const sc of data.calls) {
      if (!sc || !sc.id || seen.has(String(sc.id)) || !Array.isArray(sc.turns)) continue;
      seen.add(String(sc.id));
      const { call, card } = buildSeedCall(sc, { anchorMs, customers: data.customers });
      const r = callStmt.run(...CALL_COLS.map((c) => call[c] ?? null));
      if (r.changes) {
        cardStmt.run(...CARD_COLS.map((c) => card[c] ?? null));
        n++;
      }
    }
    return n;
  });
}

// ── 날짜 굴리기 ────────────────────────────────────────────────────
/**
 * 오늘(KST) 통화가 하나도 없으면 시드 통화 날짜를 같은 날 수만큼 옮겨 가장 늦은 시드 통화가 오늘이 되게 한다.
 * 시각(시:분)은 그대로. 카드의 확정 · 출고 시각도 같이 옮긴다.
 * @returns {number} 옮긴 날 수(안 옮겼으면 0)
 */
export function rollSeedToToday(now = new Date()) {
  const d = db();
  const today = kstDay(now);
  const dayStartMs = Date.parse(`${today}T00:00:00.000Z`) - 9 * 3600_000;
  const startIso = new Date(dayStartMs).toISOString();
  const endIso = new Date(dayStartMs + 86_400_000).toISOString();
  const todayCount = d.prepare("SELECT COUNT(*) AS n FROM calls WHERE source = 'seed' AND recorded_at >= ? AND recorded_at < ?").get(startIso, endIso).n;
  if (todayCount > 0) return 0;
  const latest = d.prepare("SELECT MAX(recorded_at) AS m FROM calls WHERE source = 'seed'").get()?.m;
  if (!latest) return 0;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${kstDay(new Date(latest))}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return 0;
  let shift = days * 86_400_000;
  // 옮긴 뒤 가장 늦은 통화가 미래가 되면(새벽) 지금 - 5분에 맞춘다
  const limitMs = now.getTime() - 5 * MIN;
  if (Date.parse(latest) + shift > limitMs) shift = limitMs - Date.parse(latest);
  if (shift <= 0) return 0;
  const mv = (iso) => (iso ? new Date(Date.parse(iso) + shift).toISOString() : iso);
  tx((db2) => {
    const calls = db2.prepare("SELECT id, recorded_at, created_at FROM calls WHERE source = 'seed'").all();
    const upCall = db2.prepare('UPDATE calls SET recorded_at = ?, created_at = ? WHERE id = ?');
    const getCard = db2.prepare('SELECT created_at, updated_at, confirmed_at, shipped_at FROM cards WHERE call_id = ?');
    const upCard = db2.prepare('UPDATE cards SET created_at = ?, updated_at = ?, confirmed_at = ?, shipped_at = ? WHERE call_id = ?');
    for (const c of calls) {
      upCall.run(mv(c.recorded_at), mv(c.created_at), c.id);
      const k = getCard.get(c.id);
      if (k) upCard.run(mv(k.created_at), mv(k.updated_at), mv(k.confirmed_at), mv(k.shipped_at), c.id);
    }
  });
  return days;
}
