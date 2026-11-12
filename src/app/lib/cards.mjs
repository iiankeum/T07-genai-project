// 주문 카드: AI 결과 검증(품번 · 차번호 · 거래처) · 근거 문장 → 시각 · 저장 · 고치기 · 상태 바꾸기 · 통화 제목.
import { db, nowIso, parseJson } from './db.mjs';
import { HttpError, cleanText } from './http.mjs';
import { config } from './config.mjs';
import {
  cardView, getCallRow, getCardRow, makeTitle, customerByPhone, dictionaryForAi, CALL_TYPES,
} from './repo.mjs';

// ── 상수 ─────────────────────────────────────────────────────────
export const MAX_ITEMS = 30;
export const MAX_ASK_BACK = 10;
const MAX_UNSURE = 20;
const MAX_FIXES = 20;
const MAX_HIGHLIGHTS = 40;

export const PART_NO_RE = /^[0-9A-Z]{5}-?[0-9A-Z]{3,6}$/;
export const PLATE_RE = /^\d{2,3}[가-힣]\d{4}$/;

export const MSG = {
  partNoNotSaid: '통화에 품번을 불러 준 말이 없어 비웠습니다',
  partNoNotHeard: '통화에서 이 품번을 불러 준 말을 찾지 못해 비웠습니다 — 들어 보세요',
  partNoOdd: '자릿수가 보통과 다릅니다 — 들어 보세요',
  plateOdd: '차번호 형식이 맞지 않아 비웠습니다 — 들어 보세요',
};

const HIGHLIGHT_KINDS = new Set(['part', 'qty', 'car', 'plate', 'urgent', 'ask', 'customer']);
// AI 스키마의 칸 이름 → 화면(cardView) 칸 이름
const FIELD_MAP = {
  customer: 'customer', contact: 'contact', car_model: 'carModel', model_year: 'modelYear', plate: 'plate',
  items: 'items', part_no: 'partNo', qty: 'qty', due: 'due', delivery: 'delivery', other: null, // 어느 칸도 아님
};
const EVIDENCE_KEYS = [
  ['customer', 'customer'], ['contact', 'contact'], ['car_model', 'carModel'], ['model_year', 'modelYear'],
  ['plate', 'plate'], ['urgent', 'urgent'], ['due', 'due'], ['delivery', 'delivery'],
];

// ── 글 맞추기 도우미 ───────────────────────────────────────────────
/** 공백 · 문장부호 · 기호를 뺀 비교용 글 */
export function squash(s) {
  return String(s ?? '').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
}

// 한국어로 읽은 숫자 한 글자 → 숫자(품번 확인용)
const KO_DIGIT = { 공: '0', 영: '0', 일: '1', 이: '2', 삼: '3', 사: '4', 오: '5', 육: '6', 륙: '6', 칠: '7', 팔: '8', 구: '9' };

/**
 * 품번을 찾아볼 통화 글 두 벌.
 * A: 공백 · 문장부호를 빼고 대문자로. B: A 에서 「다시」(줄표를 읽은 말) · '-' 를 지우고 한국어 숫자 읽기를 숫자로.
 * 예: 「오팔일공일 다시 디사…」 → B 에 58101 이 들어 있다.
 */
export function partNoHaystacks(transcript) {
  const a = String(transcript ?? '').replace(/[\s\p{P}\p{S}]/gu, '').toUpperCase();
  const b = a.replace(/다시/g, '').replace(/-/g, '').replace(/[공영일이삼사오육륙칠팔구]/g, (ch) => KO_DIGIT[ch]);
  return [a, b];
}

/** 품번이 통화에서 불린 것 같은가: 숫자 덩어리 중 4자리 이상인 첫 덩어리가 A 나 B 에 있으면 true(그런 덩어리가 없으면 검사하지 않음) */
export function partNoHeard(partNo, haystacks) {
  const key = (String(partNo ?? '').match(/\d+/g) || []).find((d) => d.length >= 4);
  if (!key) return true;
  return haystacks.some((h) => h.includes(key));
}

function grams(s) {
  if (s.length < 2) return s ? [s] : [];
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** 문장 목록 정리: [{start, end, text, speaker?}] */
export function normalizeSegments(segments, { maxCount = 2000, maxText = 1000 } = {}) {
  const raw = typeof segments === 'string' ? parseJson(segments, []) : segments;
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const s of raw.slice(0, maxCount)) {
    if (!s || typeof s !== 'object') continue;
    const text = cleanText(s.text, maxText);
    if (!text) continue;
    let start = Number(s.start);
    let end = Number(s.end);
    if (!Number.isFinite(start) || start < 0) start = out.length ? out[out.length - 1].end : 0;
    if (!Number.isFinite(end) || end < start) end = start;
    const seg = { start: Math.round(start * 100) / 100, end: Math.round(end * 100) / 100, text };
    const speaker = cleanText(s.speaker, 10);
    if (speaker) seg.speaker = speaker;
    out.push(seg);
  }
  return out;
}

/**
 * 인용 대목이 몇 번째 문장에 있는지 찾는다(공백 · 문장부호 무시).
 * 없으면 가장 많이 겹치는 문장. 하나도 안 겹치면 null.
 * @returns {{at:number, seg:number}|null}
 */
export function locateQuote(quote, segs, prepared) {
  const q = squash(quote);
  if (!q || !Array.isArray(segs) || !segs.length) return null;
  const norm = prepared || segs.map((s) => squash(s.text));
  for (let i = 0; i < norm.length; i++) if (norm[i] && norm[i].includes(q)) return { at: segs[i].start, seg: i };
  // 두 문장에 걸친 대목
  for (let i = 0; i < norm.length - 1; i++) if ((norm[i] + norm[i + 1]).includes(q)) return { at: segs[i].start, seg: i };
  // 가장 많이 겹치는 문장(두 글자 묶음 기준)
  const qg = grams(q);
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < norm.length; i++) {
    if (!norm[i]) continue;
    let hit = 0;
    for (const g of qg) if (norm[i].includes(g)) hit++;
    const score = hit / qg.length;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best < 0 || bestScore < 0.25) return null;
  return { at: segs[best].start, seg: best };
}

/** 인용 → {quote, at, seg} (못 찾으면 at/seg 는 null) */
function evidenceOf(quote, segs, prepared, fallbackText) {
  const qt = cleanText(quote, 160);
  let loc = qt ? locateQuote(qt, segs, prepared) : null;
  if (!loc && fallbackText) loc = locateQuote(fallbackText, segs, prepared);
  if (!qt && !loc) return null;
  return { quote: qt ?? (loc ? segs[loc.seg].text.slice(0, 160) : null), at: loc ? loc.at : null, seg: loc ? loc.seg : null };
}

// ── 값 정리 도우미 ────────────────────────────────────────────────
function toQty(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 0 || r > 999) return null;
  return r;
}

function normPartNo(v) {
  const s = cleanText(v, 40);
  if (!s) return null;
  return s.toUpperCase().replace(/\s+/g, '');
}

function normPlate(v) {
  const s = cleanText(v, 30);
  if (!s) return null;
  return s.replace(/\s+/g, '');
}

function partBase(part) {
  return String(part || '').replace(/\(.*?\)/g, '').trim();
}

/** 사전의 거래처 표기로 맞추기(띄어쓰기 · 문장부호만 다른 경우) */
function matchCustomerName(name, customers) {
  if (!name) return name;
  const key = squash(name);
  const hit = (customers || []).find((c) => squash(c.name ?? c) === key);
  return hit ? (hit.name ?? hit) : name;
}

// ── AI 결과 → 카드 행 값 ───────────────────────────────────────────
/**
 * AI 카드 원본을 검증해 DB 에 넣을 값으로 바꾼다.
 * callRow 는 calls 행(또는 {transcript, segments, caller_number} 를 가진 가짜 행 — 실시간 미리 보기).
 * @returns {object} saveCard 에 넘길 값(칸 이름은 DB 이름, JSON 칸은 JS 값)
 */
export function buildCardFromAi(callRow, aiOut) {
  const ai = aiOut && typeof aiOut === 'object' ? aiOut : {};
  const segs = normalizeSegments(callRow?.segments);
  const transcript = String(callRow?.transcript || segs.map((s) => s.text).join(' '));
  const prepared = segs.map((s) => squash(s.text));
  const saidPartNo = squash(transcript).includes('품번');
  const partNoHay = partNoHaystacks(transcript);
  const unsure = [];
  const fixes = [];

  // 부품 줄
  const items = [];
  for (const it of (Array.isArray(ai.items) ? ai.items : []).slice(0, MAX_ITEMS)) {
    const part = cleanText(it?.part, 80);
    if (!part) continue;
    const ev = evidenceOf(it?.quote, segs, prepared, partBase(part));
    const row = {
      part,
      side: cleanText(it?.side, 20),
      qty: toQty(it?.qty),
      partNo: normPartNo(it?.part_no ?? it?.partNo),
      quote: ev?.quote ?? null,
      at: ev?.at ?? null,
      seg: ev?.seg ?? null,
    };
    const idx = items.length;
    if (row.partNo && !saidPartNo) {
      unsure.push({ field: 'partNo', item: idx, reason: MSG.partNoNotSaid, value: row.partNo, at: row.at, seg: row.seg });
      row.partNo = null;
    } else if (row.partNo && !partNoHeard(row.partNo, partNoHay)) {
      // 「품번」 낱말은 있어도 이 품번의 숫자를 불러 준 말이 없으면 AI 가 지어낸 것일 수 있다
      unsure.push({ field: 'partNo', item: idx, reason: MSG.partNoNotHeard, value: row.partNo, at: row.at, seg: row.seg });
      row.partNo = null;
    } else if (row.partNo && !PART_NO_RE.test(row.partNo)) {
      unsure.push({ field: 'partNo', item: idx, reason: MSG.partNoOdd, value: row.partNo, at: row.at, seg: row.seg });
    }
    items.push(row);
  }

  // 칸별 근거
  const dict = dictionaryForAi();
  let customer = matchCustomerName(cleanText(ai.customer, 60), dict.customers);
  const values0 = {
    customer,
    contact: cleanText(ai.contact, 40),
    carModel: cleanText(ai.car_model, 60),
    modelYear: cleanText(ai.model_year, 10),
    plate: normPlate(ai.plate),
    urgent: ai.urgent === true,
    due: cleanText(ai.due, 60),
    delivery: cleanText(ai.delivery, 60),
  };
  const aiEv = ai.evidence && typeof ai.evidence === 'object' ? ai.evidence : {};
  const evidence = {};
  for (const [aiKey, key] of EVIDENCE_KEYS) {
    const v = values0[key];
    if (v == null || v === false) continue;
    const fallback = key === 'urgent' ? null : String(v);
    const ev = evidenceOf(aiEv[aiKey], segs, prepared, fallback);
    if (ev) evidence[key] = ev;
  }

  // 차번호 형식
  let plate = values0.plate;
  if (plate && !PLATE_RE.test(plate)) {
    unsure.push({ field: 'plate', item: null, reason: MSG.plateOdd, value: plate, at: evidence.plate?.at ?? null, seg: evidence.plate?.seg ?? null });
    plate = null;
  }

  // 걸려 온 번호로 거래처(F11)
  let byPhone = false;
  const phoneName = callRow?.caller_number ? customerByPhone(callRow.caller_number) : null;
  if (phoneName) {
    if (customer && squash(customer) !== squash(phoneName)) fixes.push({ heard: customer, fixed: phoneName });
    customer = phoneName;
    byPhone = true;
  }

  // AI 가 적은 「들어 보기」
  for (const u of Array.isArray(ai.unsure) ? ai.unsure : []) {
    if (unsure.length >= MAX_UNSURE) break;
    const reason = cleanText(typeof u === 'string' ? u : u?.reason, 200);
    if (!reason) continue;
    const field = typeof u?.field === 'string' && Object.hasOwn(FIELD_MAP, u.field) ? FIELD_MAP[u.field] : null;
    if (field === 'customer' && byPhone) continue; // 번호로 확인된 거래처는 들어 볼 필요 없음
    const item = Number.isInteger(u?.item) && u.item >= 0 && u.item < items.length ? u.item : null;
    let loc = u?.quote ? locateQuote(u.quote, segs, prepared) : null;
    if (!loc && item != null && items[item].at != null) loc = { at: items[item].at, seg: items[item].seg };
    if (!loc && field && evidence[field]) loc = { at: evidence[field].at, seg: evidence[field].seg };
    // 같은 칸(같은 부품 줄)에 이미 「들어 보기」가 있으면 하나로 둔다(서버 검사가 먼저 붙인 것 우선)
    if (field && unsure.some((x) => x.field === field && (x.item ?? null) === item)) continue;
    unsure.push({ field, item, reason, at: loc?.at ?? null, seg: loc?.seg ?? null });
  }

  for (const f of Array.isArray(ai.fixes) ? ai.fixes : []) {
    if (fixes.length >= MAX_FIXES) break;
    const heard = cleanText(f?.heard, 60);
    const fixed = cleanText(f?.fixed, 60);
    if (heard && fixed && heard !== fixed) fixes.push({ heard, fixed });
  }

  const askBack = (Array.isArray(ai.ask_back) ? ai.ask_back : [])
    .map((a) => cleanText(a, 200)).filter(Boolean).slice(0, MAX_ASK_BACK);

  // 글에 실제로 있는 칠하기 대목만
  const highlights = [];
  const seen = new Set();
  const texts = segs.length ? segs.map((s) => s.text) : [transcript];
  for (const h of Array.isArray(ai.highlights) ? ai.highlights : []) {
    if (highlights.length >= MAX_HIGHLIGHTS) break;
    const text = typeof h?.text === 'string' ? h.text.trim() : '';
    const kind = HIGHLIGHT_KINDS.has(h?.kind) ? h.kind : null;
    if (!text || !kind || text.length > 40) continue;
    if (!texts.some((t) => t.includes(text))) continue;
    const key = kind + '\u0000' + text;
    if (seen.has(key)) continue;
    seen.add(key);
    highlights.push({ text, kind });
  }

  const note = cleanText(ai.note, 300);
  const summary = cleanText(ai.summary, 80);
  const values = {
    call_type: CALL_TYPES.includes(ai.call_type) ? ai.call_type : '주문',
    customer: customer ?? null,
    contact: values0.contact,
    car_model: values0.carModel,
    model_year: values0.modelYear,
    plate,
    items,
    urgent: values0.urgent,
    due: values0.due,
    delivery: values0.delivery,
    ask_back: askBack,
    unsure,
    fixes,
    evidence,
    highlights,
    note,
    customer_by_phone: byPhone,
    ai_model: cleanText(ai._model, 80) || config.model,
    ai_error: null,
    summary,
  };
  values.ai_draft = draftOf(values);
  return values;
}

/** AI 가 꺼졌거나 실패했을 때의 빈 카드 값(번호로 거래처는 채운다) */
export function emptyCardValues(callRow, aiError) {
  const phoneName = callRow?.caller_number ? customerByPhone(callRow.caller_number) : null;
  const values = {
    call_type: '주문', customer: phoneName, contact: null, car_model: null, model_year: null, plate: null,
    items: [], urgent: false, due: null, delivery: null,
    ask_back: [], unsure: [], fixes: [], evidence: {}, highlights: [], note: null,
    customer_by_phone: Boolean(phoneName),
    ai_model: null,
    ai_error: cleanText(aiError, 200) || 'AI 오류',
    summary: null,
  };
  values.ai_draft = draftOf(values);
  return values;
}

/** ai_draft 칸: cardView 와 같은 모양 */
function draftOf(v) {
  return {
    callType: v.call_type || '주문',
    customer: v.customer ?? null,
    contact: v.contact ?? null,
    carModel: v.car_model ?? null,
    modelYear: v.model_year ?? null,
    plate: v.plate ?? null,
    items: (v.items || []).map((i) => ({ part: i.part, side: i.side ?? null, qty: i.qty ?? null, partNo: i.partNo ?? null, quote: i.quote ?? null, at: i.at ?? null })),
    urgent: Boolean(v.urgent),
    due: v.due ?? null,
    delivery: v.delivery ?? null,
    askBack: v.ask_back || [],
    note: v.note ?? null,
    summary: v.summary ?? null,
  };
}

/** 저장하지 않고 cardView 모양으로(실시간 미리 보기) */
export function previewCard(values) {
  const now = nowIso();
  return cardView({ ...rowFromValues(values), status: 'draft', callback: 0, callback_reason: null, edits: 0, created_at: now, updated_at: now, confirmed_at: null, shipped_at: null });
}

function rowFromValues(v) {
  return {
    call_type: CALL_TYPES.includes(v.call_type) ? v.call_type : '주문',
    customer: v.customer ?? null,
    contact: v.contact ?? null,
    car_model: v.car_model ?? null,
    model_year: v.model_year ?? null,
    plate: v.plate ?? null,
    items: JSON.stringify(v.items || []),
    urgent: v.urgent ? 1 : 0,
    due: v.due ?? null,
    delivery: v.delivery ?? null,
    ask_back: JSON.stringify(v.ask_back || []),
    unsure: JSON.stringify(v.unsure || []),
    fixes: JSON.stringify(v.fixes || []),
    evidence: JSON.stringify(v.evidence || {}),
    highlights: JSON.stringify(v.highlights || []),
    note: v.note ?? null,
    customer_by_phone: v.customer_by_phone ? 1 : 0,
    ai_draft: v.ai_draft ? JSON.stringify(v.ai_draft) : null,
    ai_model: v.ai_model ?? null,
    ai_error: v.ai_error ?? null,
  };
}

// ── 저장 ─────────────────────────────────────────────────────────
/**
 * 카드를 넣거나 새 AI 초안으로 바꾼다. 고친 횟수(edits)는 0 으로.
 * keepStatus: true 면 상태 · 확정/출고 시각을 그대로 두고, 아니면 「확인 필요」(draft)로 되돌린다.
 * 「다시 전화」 표시는 늘 그대로 둔다.
 */
export function saveCard(callId, values, { keepStatus = false } = {}) {
  if (!getCallRow(callId)) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
  const now = nowIso();
  const r = rowFromValues(values);
  const prev = getCardRow(callId);
  const status = keepStatus && prev ? prev.status : 'draft';
  const confirmedAt = keepStatus && prev ? prev.confirmed_at : null;
  const shippedAt = keepStatus && prev ? prev.shipped_at : null;
  db().prepare(`
    INSERT INTO cards(call_id, status, call_type, customer, contact, car_model, model_year, plate, items, urgent, due, delivery,
      ask_back, unsure, fixes, evidence, highlights, note, customer_by_phone, ai_draft, ai_model, ai_error, edits,
      created_at, updated_at, confirmed_at, shipped_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)
    ON CONFLICT(call_id) DO UPDATE SET
      status = excluded.status, call_type = excluded.call_type, customer = excluded.customer, contact = excluded.contact,
      car_model = excluded.car_model, model_year = excluded.model_year, plate = excluded.plate,
      items = excluded.items, urgent = excluded.urgent, due = excluded.due, delivery = excluded.delivery,
      ask_back = excluded.ask_back, unsure = excluded.unsure, fixes = excluded.fixes, evidence = excluded.evidence,
      highlights = excluded.highlights, note = excluded.note, customer_by_phone = excluded.customer_by_phone,
      ai_draft = excluded.ai_draft, ai_model = excluded.ai_model, ai_error = excluded.ai_error, edits = 0,
      updated_at = excluded.updated_at, confirmed_at = excluded.confirmed_at, shipped_at = excluded.shipped_at
  `).run(
    callId, status, r.call_type, r.customer, r.contact, r.car_model, r.model_year, r.plate, r.items, r.urgent, r.due, r.delivery,
    r.ask_back, r.unsure, r.fixes, r.evidence, r.highlights, r.note, r.customer_by_phone, r.ai_draft, r.ai_model, r.ai_error,
    now, now, confirmedAt, shippedAt,
  );
  refreshCallTitle(callId);
  return cardView(getCardRow(callId));
}

function requireCard(callId) {
  const row = getCardRow(callId);
  if (!row) {
    if (!getCallRow(callId)) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
    throw new HttpError(404, 'no_card', '이 통화에는 아직 주문 카드가 없습니다.');
  }
  return row;
}

// ── 고치기 ───────────────────────────────────────────────────────
const TEXT_FIELDS = {
  customer: ['customer', 60], contact: ['contact', 40], carModel: ['car_model', 60], modelYear: ['model_year', 10],
  plate: ['plate', 30], due: ['due', 60], delivery: ['delivery', 60], note: ['note', 500],
};

function cleanItems(list) {
  if (!Array.isArray(list)) throw new HttpError(400, 'bad_items', '부품 목록 형식이 잘못됐습니다.');
  if (list.length > MAX_ITEMS) throw new HttpError(400, 'too_many_items', `부품은 ${MAX_ITEMS}줄까지 넣을 수 있습니다.`);
  const out = [];
  for (const it of list) {
    if (!it || typeof it !== 'object') throw new HttpError(400, 'bad_items', '부품 목록 형식이 잘못됐습니다.');
    const part = cleanText(it.part, 80);
    const partNo = normPartNo(it.partNo);
    const side = cleanText(it.side, 20);
    let qty = null;
    if (it.qty != null && it.qty !== '') {
      const n = Number(it.qty);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 999) {
        throw new HttpError(400, 'bad_qty', '수량은 0~999 사이 정수로 넣어 주세요.');
      }
      qty = n;
    }
    if (!part && !partNo) continue; // 빈 줄은 버린다
    const at = Number(it.at);
    const seg = Number(it.seg);
    out.push({
      part: part || '(부품 이름 없음)',
      side,
      qty,
      partNo,
      quote: cleanText(it.quote, 160),
      at: it.at != null && Number.isFinite(at) && at >= 0 ? at : null,
      seg: it.seg != null && Number.isInteger(seg) && seg >= 0 ? seg : null,
    });
  }
  return out;
}

/**
 * 사람이 칸을 고친다. patch: customer, contact, carModel, modelYear, plate, items, urgent, due, delivery, askBack, note 중 일부.
 * 확정 · 출고된 카드는 409 'locked'.
 */
export function updateCardFields(callId, patch) {
  const row = requireCard(callId);
  if (row.status === 'confirmed' || row.status === 'shipped') {
    throw new HttpError(409, 'locked', '확정(또는 출고)된 카드는 고칠 수 없습니다. 먼저 「다시 열기」를 눌러 주세요.');
  }
  const p = patch && typeof patch === 'object' ? patch : {};
  const sets = {};
  for (const [key, [col, max]] of Object.entries(TEXT_FIELDS)) {
    if (!(key in p)) continue;
    let v = cleanText(p[key], max);
    if (key === 'plate' && v) v = v.replace(/\s+/g, '');
    sets[col] = v;
  }
  if ('callType' in p) {
    if (!CALL_TYPES.includes(p.callType)) throw new HttpError(400, 'bad_call_type', `통화 종류는 ${CALL_TYPES.join(' · ')} 중 하나로 골라 주세요.`);
    sets.call_type = p.callType;
  }
  if ('items' in p) sets.items = JSON.stringify(cleanItems(p.items));
  if ('urgent' in p) sets.urgent = p.urgent === true || p.urgent === 1 || p.urgent === 'true' ? 1 : 0;
  if ('askBack' in p) {
    if (!Array.isArray(p.askBack)) throw new HttpError(400, 'bad_ask_back', '다시 물어볼 것 형식이 잘못됐습니다.');
    const list = p.askBack.map((a) => cleanText(a, 200)).filter(Boolean);
    if (list.length > MAX_ASK_BACK) throw new HttpError(400, 'too_many_ask_back', `다시 물어볼 것은 ${MAX_ASK_BACK}줄까지 넣을 수 있습니다.`);
    sets.ask_back = JSON.stringify(list);
  }
  const cols = Object.keys(sets);
  if (!cols.length) throw new HttpError(400, 'empty_patch', '고칠 칸이 없습니다.');
  // 거래처를 고치면 「번호로 확인」은 번호와 같을 때만 남긴다
  if ('customer' in sets) {
    const call = getCallRow(callId);
    const phoneName = call?.caller_number ? customerByPhone(call.caller_number) : null;
    sets.customer_by_phone = phoneName && sets.customer && squash(phoneName) === squash(sets.customer) ? 1 : 0;
  }
  const now = nowIso();
  const keys = Object.keys(sets);
  db().prepare(`UPDATE cards SET ${keys.map((k) => `${k} = ?`).join(', ')}, edits = edits + 1, updated_at = ? WHERE call_id = ?`)
    .run(...keys.map((k) => sets[k]), now, callId);
  refreshCallTitle(callId);
  return cardView(getCardRow(callId));
}

// ── 상태 바꾸기 ───────────────────────────────────────────────────
/**
 * draft → confirmed → shipped. reopen: confirmed/shipped/cancelled → draft. cancel: draft/confirmed → cancelled.
 * @param {'confirm'|'reopen'|'ship'|'cancel'} action
 * @returns {{card: object, warnings?: string[]}}
 */
export function setCardStatus(callId, action) {
  const row = requireCard(callId);
  const now = nowIso();
  const st = row.status;
  const done = (extra) => ({ card: cardView(getCardRow(callId)), ...(extra || {}) });
  const set = (sql, ...args) => {
    db().prepare(`UPDATE cards SET ${sql}, updated_at = ? WHERE call_id = ?`).run(...args, now, callId);
  };

  if (action === 'confirm') {
    const items = parseJson(row.items, []);
    const emptyNo = items.filter((i) => !i?.partNo).length;
    const warnings = emptyNo ? { warnings: [`품번이 빈 부품이 ${emptyNo}줄 있습니다`] } : undefined;
    if (st === 'confirmed') return done(warnings);
    if (st !== 'draft') throw new HttpError(409, 'bad_state', `「${labelOf(st)}」 카드는 바로 확정할 수 없습니다. 먼저 「다시 열기」를 눌러 주세요.`);
    const ask = parseJson(row.ask_back, []);
    if (ask.length) {
      throw new HttpError(409, 'ask_back_left', `다시 물어볼 것이 ${ask.length}개 남아 있습니다. 답을 받아 지운 뒤 확정해 주세요.`);
    }
    // 주문 전화는 부품이 있어야 확정(배송 문의 등은 부품 없이도 확정 = 처리 끝)
    if (!items.length && (row.call_type || '주문') === '주문') {
      throw new HttpError(409, 'no_items', '부품이 한 줄도 없습니다. 부품을 넣은 뒤 확정해 주세요.');
    }
    set("status = 'confirmed', confirmed_at = ?, shipped_at = NULL", now);
    refreshCallTitle(callId);
    return done(warnings);
  }
  if (action === 'ship') {
    if (st === 'shipped') return done();
    if (st !== 'confirmed') throw new HttpError(409, 'not_confirmed', '확정된 카드만 「출고 완료」로 바꿀 수 있습니다.');
    set("status = 'shipped', shipped_at = ?", now);
    return done();
  }
  if (action === 'reopen') {
    if (st === 'draft') return done();
    set("status = 'draft', confirmed_at = NULL, shipped_at = NULL");
    return done();
  }
  if (action === 'cancel') {
    if (st === 'cancelled') return done();
    if (st === 'shipped') throw new HttpError(409, 'already_shipped', '출고 완료된 카드는 취소할 수 없습니다. 먼저 「다시 열기」를 눌러 주세요.');
    set("status = 'cancelled', confirmed_at = NULL");
    return done();
  }
  throw new HttpError(400, 'bad_action', '알 수 없는 동작입니다.');
}

function labelOf(st) {
  return { draft: '확인 필요', confirmed: '확정', shipped: '출고 완료', cancelled: '취소' }[st] || st;
}

/** 「다시 전화할 곳」 표시 켜기 · 끄기 */
export function setCallback(callId, { on, reason } = {}) {
  requireCard(callId);
  const flag = on === true || on === 1 || on === 'true';
  db().prepare('UPDATE cards SET callback = ?, callback_reason = ?, updated_at = ? WHERE call_id = ?')
    .run(flag ? 1 : 0, flag ? cleanText(reason, 200) : null, nowIso(), callId);
  return cardView(getCardRow(callId));
}

// ── 통화 제목 · 거래처 · 요약 ──────────────────────────────────────
/** 카드 값으로 한 줄 요약을 만든다(예: "아반떼 AD 앞범퍼 1개, 오전 중 배송") */
export function composeSummary(card) {
  if (!card) return null;
  const items = (card.items || []).filter((i) => i && i.part);
  const itemText = items.slice(0, 3)
    .map((i) => `${i.side ? i.side + ' ' : ''}${partBase(i.part) || i.part}${i.qty != null ? ` ${i.qty}개` : ''}`)
    .join(', ') + (items.length > 3 ? ` 외 ${items.length - 3}` : '');
  const type = card.callType && card.callType !== '주문' ? card.callType : null;
  const head = [type, card.carModel, itemText].filter(Boolean).join(' ');
  const tail = [card.due, card.delivery].filter(Boolean).join(' ');
  const s = [head, tail].filter(Boolean).join(', ');
  return s ? s.slice(0, 120) : null;
}

/** calls.title · customer · summary 를 카드에 맞춘다 */
export function refreshCallTitle(callId) {
  const call = getCallRow(callId);
  if (!call) return null;
  const card = cardView(getCardRow(callId));
  // 주문이 아닌 전화에 부품이 없으면 제목에 통화 종류를 쓴다(「배송 문의」 등)
  const titleItems = card && !card.items.length && card.callType && card.callType !== '주문'
    ? [{ part: card.callType }] : (card?.items ?? []);
  const title = makeTitle({
    customer: card?.customer ?? null,
    items: titleItems,
    recordedAt: call.recorded_at,
    durationSec: call.duration_sec,
    source: call.source,
  });
  let summary = null;
  if (card) {
    const aiSummary = card.aiDraft?.summary;
    summary = card.edited.length === 0 && aiSummary ? aiSummary : composeSummary(card);
  }
  db().prepare('UPDATE calls SET title = ?, customer = ?, summary = ? WHERE id = ?')
    .run(title, card?.customer ?? call.customer ?? null, summary, callId);
  return { title, customer: card?.customer ?? null, summary };
}
