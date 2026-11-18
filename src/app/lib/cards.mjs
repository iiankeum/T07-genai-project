// 주문 카드: AI 결과 검증(품번 · 차번호 · 거래처) · 근거 문장 → 시각 · 저장 · 고치기 · 상태 바꾸기 · 통화 제목.
import { db, newId, nowIso, parseJson, tx } from './db.mjs';
import { HttpError, cleanText } from './http.mjs';
import { config } from './config.mjs';
import { recordAudit, requestAccess } from './auth.mjs';
import {
  DEFAULT_DOMAIN, domainFor, normalizePartNo, acceptsPartNo, textIssue, confirmationIssues, itemId, warningId, reviewKey,
  PART_NO_RE, PLATE_RE, PLATE_FORMAT_MESSAGE,
} from '../public/js/domain.js';
import {
  cardView, getCallRow, getCardRow, makeTitle, customerByPhone, dictionaryForAi, CALL_TYPES,
} from './repo.mjs';

// ── 상수 ─────────────────────────────────────────────────────────
export const MAX_ITEMS = 30;
export const MAX_ASK_BACK = 10;
const MAX_UNSURE = 20;
const MAX_FIXES = 20;
const MAX_HIGHLIGHTS = 40;

export { PART_NO_RE, PLATE_RE };

export const MSG = {
  partNoNotSaid: '통화에 품번을 불러 준 말이 없어 비웠습니다',
  partNoNotHeard: '통화에서 이 품번을 불러 준 말을 찾지 못해 비웠습니다 — 들어 보세요',
  partNoOdd: '자릿수가 보통과 다릅니다 — 들어 보세요',
  plateOdd: PLATE_FORMAT_MESSAGE,
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

// 받아쓰기에서 흔히 쓰는 한국어 알파벳 이름을 숫자 읽기보다 먼저 바꾼다.
const KO_LETTER = {
  에이: 'A', 비: 'B', 씨: 'C', 시: 'C', 디: 'D', 에프: 'F', 지: 'G', 에이치: 'H',
  아이: 'I', 제이: 'J', 케이: 'K', 엘: 'L', 엠: 'M', 엔: 'N', 오우: 'O', 피: 'P',
  큐: 'Q', 알: 'R', 에스: 'S', 티: 'T', 유: 'U', 브이: 'V', 더블유: 'W',
  엑스: 'X', 와이: 'Y', 제트: 'Z',
};
const LETTER_WORDS = new RegExp(Object.keys(KO_LETTER).sort((a, b) => b.length - a.length).join('|'), 'g');

/** 받아쓴 원문 표기와 한글로 읽은 표기를 각각 대조한다. */
export function partNoHaystacks(transcript) {
  const raw = String(transcript ?? '').toUpperCase();
  const spoken = raw.replace(/(?:다시|대시|하이픈)/g, '').replace(/\s/g, '')
    .replace(LETTER_WORDS, (word) => KO_LETTER[word])
    .replace(/[공영일이삼사오육륙칠팔구]/g, (digit) => KO_DIGIT[digit]);
  return [raw, spoken];
}

/** 품번 전체가 통화에 있어야 한다. 붙어 있는 다른 품번의 일부일 때는 일치하지 않는다. */
export function partNoHeard(partNo, haystacks) {
  const parts = String(partNo ?? '').toUpperCase().split(/[\s-]+/).filter(Boolean);
  if (!parts.length || parts.some((part) => !/^[0-9A-Z]+$/.test(part))) return false;
  const chars = parts.join('').split('').join('[\\s-]*');
  const exact = new RegExp('(?<![0-9A-Z])' + chars + '(?![0-9A-Z])');
  return haystacks.some((haystack) => exact.test(haystack));
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

/** 실제 원문에 있는 인용만 근거로 쓴다. 유사 문장 탐색은 근거 검증이 아니다. */
function exactLocation(quote, segs, prepared) {
  const q = squash(quote);
  if (!q) return null;
  for (let i = 0; i < prepared.length; i++) {
    if (prepared[i].includes(q)) return { at: segs[i].start, seg: i };
  }
  for (let i = 0; i + 1 < prepared.length; i++) {
    if ((prepared[i] + prepared[i + 1]).includes(q)) return { at: segs[i].start, seg: i };
  }
  return null;
}

function evidenceOf(quote, segs, prepared, fallbackText, transcript = segs.map((s) => s.text).join(' ')) {
  const text = squash(transcript);
  for (const candidate of [quote, fallbackText]) {
    const qt = cleanText(candidate, 160);
    const q = squash(qt);
    if (!q || !text.includes(q)) continue;
    const loc = exactLocation(qt, segs, prepared);
    return { quote: qt, at: loc?.at ?? null, seg: loc?.seg ?? null };
  }
  return null;
}

/** 음성 정정은 실제 들린 말과 유사한 표기인 경우에만 후보로 남긴다. */
function similarCorrection(heard, fixed) {
  const a = squash(heard), b = squash(fixed);
  if (!a || !b || Math.min(a.length, b.length) < 3) return false;
  const bg = grams(b);
  return bg.filter((g) => a.includes(g)).length / bg.length >= 0.45;
}

// ── 값 정리 도우미 ────────────────────────────────────────────────
function toQty(v, domain) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (!Number.isInteger(n) || n < domain.qtyMin || n > domain.qtyMax) return null;
  return n;
}

function normPartNo(v) {
  const s = cleanText(v, Infinity);
  if (!s) return null;
  return normalizePartNo(s);
}

function normPlate(v) {
  const s = cleanText(v, Infinity);
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
  const domain = domainFor(getCardRow(callRow?.id ?? '')?.domain_version || process.env.AHMATDA_DOMAIN);
  const ai = aiOut && typeof aiOut === 'object' ? aiOut : {};
  const segs = normalizeSegments(callRow?.segments);
  const transcript = String(callRow?.transcript || segs.map((s) => s.text).join(' '));
  const prepared = segs.map((s) => squash(s.text));
  const saidPartNo = squash(transcript).includes(squash(domain.partNoCue));
  const partNoHay = partNoHaystacks(transcript);
  const unsure = [];
  const fixes = [];

  // 부품 줄
  const items = [];
  for (const it of (Array.isArray(ai.items) ? ai.items : []).slice(0, MAX_ITEMS)) {
    const part = cleanText(it?.part, domain.textLimits.part);
    if (!part) continue;
    const ev = evidenceOf(it?.quote, segs, prepared, partBase(part));
    const row = {
      id: newId('item'),
      part,
      side: cleanText(it?.side, domain.textLimits.side),
      qty: toQty(it?.qty, domain),
      partNo: normPartNo(it?.part_no ?? it?.partNo),
      quote: ev?.quote ?? null,
      at: ev?.at ?? null,
      seg: ev?.seg ?? null,
    };
    const idx = items.length;
    if (textIssue('partNo', row.partNo, domain)) row.partNo = null;
    if (row.partNo && !saidPartNo) {
      unsure.push({ id: newId('warn'), field: 'partNo', item: idx, reason: MSG.partNoNotSaid, value: row.partNo, at: row.at, seg: row.seg });
      row.partNo = null;
    } else if (row.partNo && !partNoHeard(row.partNo, partNoHay)) {
      // 「품번」 낱말은 있어도 이 품번의 숫자를 불러 준 말이 없으면 AI 가 지어낸 것일 수 있다
      unsure.push({ id: newId('warn'), field: 'partNo', item: idx, reason: MSG.partNoNotHeard, value: row.partNo, at: row.at, seg: row.seg });
      row.partNo = null;
    } else if (row.partNo && !domain.partNoTypical.test(row.partNo)) {
      unsure.push({ id: newId('warn'), field: 'partNo', item: idx, reason: MSG.partNoOdd, value: row.partNo, at: row.at, seg: row.seg });
    }
    items.push(row);
  }

  // 칸별 근거
  const dict = dictionaryForAi(domain.id);
  let customer = matchCustomerName(cleanText(ai.customer, domain.textLimits.customer), dict.customers);
  const modelYear = cleanText(ai.model_year, Infinity)?.replace(/\s*년(?:식)?$/, '');
  const values0 = {
    customer,
    contact: cleanText(ai.contact, domain.textLimits.contact),
    carModel: cleanText(ai.car_model, domain.textLimits.carModel),
    modelYear: textIssue('modelYear', modelYear, domain) ? null : modelYear ?? null,
    plate: normPlate(cleanText(ai.plate, domain.textLimits.plate)),
    urgent: ai.urgent === true,
    due: cleanText(ai.due, domain.textLimits.due),
    delivery: cleanText(ai.delivery, domain.textLimits.delivery),
  };
  const aiEv = ai.evidence && typeof ai.evidence === 'object' ? ai.evidence : {};
  const evidence = {};
  for (const [aiKey, key] of EVIDENCE_KEYS) {
    const v = values0[key];
    if (v == null || v === false) continue;
    const fallback = key === 'urgent' ? null : String(v);
    const ev = evidenceOf(aiEv[aiKey], segs, prepared, fallback, transcript);
    if (ev) evidence[key] = ev;
  }

  // 차번호 형식
  let plate = values0.plate;
  if (plate && domain.platePattern && !domain.platePattern.test(plate)) {
    unsure.push({ id: newId('warn'), field: 'plate', item: null, blocking: false, reason: MSG.plateOdd, value: plate, at: evidence.plate?.at ?? null, seg: evidence.plate?.seg ?? null });
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

  // 사전 목록이나 AI 인용만으로는 값의 근거가 되지 않는다.
  // 번호 매칭은 별도 검증 경로로 유지하고, 나머지는 원문/승인 별칭/실제 정정 대목을 확인한다.
  const source = squash(transcript);
  let rejectedGrounding = false;
  for (const [, key] of EVIDENCE_KEYS) {
    const value = key === 'customer' ? customer : key === 'plate' ? plate : values0[key];
    if (value == null || value === false || (key === 'customer' && byPhone)) continue;
    const ev = evidence[key];
    const direct = key !== 'urgent' && source.includes(squash(value));
    const alias = key !== 'urgent' && dict.glossary.some((g) =>
      squash(g.standard) === squash(value) && squash(g.term) && source.includes(squash(g.term)));
    const correction = key !== 'urgent' && ev && (Array.isArray(ai.fixes) ? ai.fixes : []).some((f) =>
      squash(f.fixed) === squash(value) && squash(f.heard) && source.includes(squash(f.heard)) &&
      squash(ev.quote).includes(squash(f.heard)) && similarCorrection(f.heard, f.fixed));
    // 시간/배송/긴급 여부의 의역은 실제 원문 인용이 있을 때만 유지한다.
    const interpretive = ['urgent', 'due', 'delivery'].includes(key) && Boolean(ev);
    if (direct || alias || correction || interpretive) {
      if (correction) {
        if (!unsure.some((u) => u.field === key)) unsure.push({ id: newId('warn'), field: key, item: null,
          blocking: true, reason: '원문을 해석하거나 고쳐 읽은 값입니다 — 확인해 주세요', value,
          at: ev?.at ?? null, seg: ev?.seg ?? null });
      }
      continue;
    }
    rejectedGrounding = true;
    unsure.push({ id: newId('warn'), field: key, item: null, blocking: true,
      reason: '통화 원문에서 이 값의 근거를 찾지 못해 비웠습니다 — 확인해 주세요', value, at: null, seg: null });
    delete evidence[key];
    if (key === 'customer') customer = null;
    else if (key === 'plate') plate = null;
    else values0[key] = key === 'urgent' ? false : null;
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
    if (field && unsure.some((x) => x.field === field && (x.item ?? null) === item && x.blocking !== false)) continue;
    unsure.push({ id: newId('warn'), field, item, reason, at: loc?.at ?? null, seg: loc?.seg ?? null });
  }

  for (const f of Array.isArray(ai.fixes) ? ai.fixes : []) {
    if (fixes.length >= MAX_FIXES) break;
    const heard = cleanText(f?.heard, 60);
    const fixed = cleanText(f?.fixed, 60);
    const approvedAlias = dict.glossary.some((g) => squash(g.term) === squash(heard) && squash(g.standard) === squash(fixed));
    if (heard && fixed && heard !== fixed && source.includes(squash(heard)) &&
        (similarCorrection(heard, fixed) || approvedAlias)) fixes.push({ heard, fixed });
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

  // 거부된 정보가 자유 서술을 통해 다시 노출되지 않게 한다. 목록 요약은 검증된 카드로 재구성한다.
  const note = rejectedGrounding ? null : cleanText(ai.note, domain.textLimits.note);
  const summary = composeSummary({
    callType: CALL_TYPES.includes(ai.call_type) ? ai.call_type : '주문',
    carModel: values0.carModel, items, due: values0.due, delivery: values0.delivery,
  });
  const values = {
    domain_version: domain.id,
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
    domain_version: domainFor(process.env.AHMATDA_DOMAIN).id,
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
    domain_version: v.domain_version || DEFAULT_DOMAIN,
    field_reviews: JSON.stringify(v.field_reviews || {}),
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
  if (prev && prev.status !== 'draft') throw new HttpError(409, 'locked', '확인 필요 상태의 카드만 다시 정리할 수 있습니다.');
  const status = keepStatus && prev ? prev.status : 'draft';
  const confirmedAt = keepStatus && prev ? prev.confirmed_at : null;
  const shippedAt = keepStatus && prev ? prev.shipped_at : null;
  db().prepare(`
    INSERT INTO cards(call_id, status, call_type, customer, contact, car_model, model_year, plate, items, urgent, due, delivery,
      ask_back, unsure, fixes, evidence, highlights, note, customer_by_phone, ai_draft, ai_model, ai_error, edits,
      created_at, updated_at, confirmed_at, shipped_at, domain_version, field_reviews)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)
    ON CONFLICT(call_id) DO UPDATE SET
      status = excluded.status, call_type = excluded.call_type, customer = excluded.customer, contact = excluded.contact,
      car_model = excluded.car_model, model_year = excluded.model_year, plate = excluded.plate,
      items = excluded.items, urgent = excluded.urgent, due = excluded.due, delivery = excluded.delivery,
      ask_back = excluded.ask_back, unsure = excluded.unsure, fixes = excluded.fixes, evidence = excluded.evidence,
      highlights = excluded.highlights, note = excluded.note, customer_by_phone = excluded.customer_by_phone,
      ai_draft = excluded.ai_draft, ai_model = excluded.ai_model, ai_error = excluded.ai_error, edits = 0,
      updated_at = excluded.updated_at, confirmed_at = excluded.confirmed_at, shipped_at = excluded.shipped_at,
      field_reviews = excluded.field_reviews, revision = cards.revision + 1
  `).run(
    callId, status, r.call_type, r.customer, r.contact, r.car_model, r.model_year, r.plate, r.items, r.urgent, r.due, r.delivery,
    r.ask_back, r.unsure, r.fixes, r.evidence, r.highlights, r.note, r.customer_by_phone, r.ai_draft, r.ai_model, r.ai_error,
    now, now, confirmedAt, shippedAt, r.domain_version, r.field_reviews,
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
  customer: 'customer', contact: 'contact', carModel: 'car_model', modelYear: 'model_year',
  plate: 'plate', due: 'due', delivery: 'delivery', note: 'note',
};

function cleanInput(field, raw, previous, domain) {
  if (raw != null && typeof raw !== 'string' && !(field === 'modelYear' && typeof raw === 'number')) {
    throw new HttpError(400, 'bad_text', '이 칸에는 글자나 숫자 형식의 값을 입력해 주세요.');
  }
  const text = cleanText(raw, Infinity);
  const issue = textIssue(field, text, domain);
  // 이전 버전에서 저장된 값은 다른 칸을 편집할 때 유지한다.
  if (issue && text !== previous) throw new HttpError(400, issue.code, issue.message);
  return text;
}

function cleanItems(list, domain, previous) {
  if (!Array.isArray(list)) throw new HttpError(400, 'bad_items', '부품 목록 형식이 잘못됐습니다.');
  if (list.length > MAX_ITEMS) throw new HttpError(400, 'too_many_items', `부품은 ${MAX_ITEMS}줄까지 넣을 수 있습니다.`);
  const known = new Map(previous.map((item, index) => [itemId(item, index), item]));
  const assigned = new Set();
  const out = [];
  for (const [index, it] of list.entries()) {
    if (!it || typeof it !== 'object') throw new HttpError(400, 'bad_items', '부품 목록 형식이 잘못됐습니다.');
    const candidate = it.id || (previous[index] && itemId(previous[index], index));
    const prior = known.get(candidate);
    const part = cleanInput('part', it.part, prior?.part, domain);
    const priorPartNo = prior?.partNo ?? prior?.part_no;
    const partNo = normPartNo(cleanInput('partNo', it.partNo ?? it.part_no, priorPartNo, domain));
    if (partNo && !acceptsPartNo(partNo, domain)) throw new HttpError(400, 'bad_part_no', '품번은 영문·숫자·하이픈으로 입력해 주세요.');
    const side = cleanInput('side', it.side, prior?.side, domain);
    let qty = null;
    if (it.qty != null && it.qty !== '') {
      qty = typeof it.qty === 'number' || typeof it.qty === 'string' ? Number(it.qty) : NaN;
      if (!Number.isInteger(qty) || qty < domain.qtyMin || qty > domain.qtyMax) {
        throw new HttpError(400, 'bad_qty', `수량은 ${domain.qtyMin}~${domain.qtyMax} 사이 정수로 넣어 주세요.`);
      }
    }
    if (!part && !partNo && !side && qty == null && !it.id) continue;
    const clientId = typeof candidate === 'string' && /^item_[0-9a-f-]{16,36}$/.test(candidate);
    const id = (known.has(candidate) || clientId) && !assigned.has(candidate) ? candidate : newId('item');
    assigned.add(id);
    const at = Number(it.at);
    const seg = Number(it.seg);
    out.push({
      id, part, side, qty, partNo,
      quote: cleanText(it.quote, 160),
      at: it.at != null && Number.isFinite(at) && at >= 0 ? at : null,
      seg: it.seg != null && Number.isInteger(seg) && seg >= 0 ? seg : null,
    });
  }
  return out;
}

function assertEditable(row) {
  if (row.status !== 'draft') throw new HttpError(409, 'locked', '확인 필요 상태의 카드만 고칠 수 있습니다.');
}

function checkRevision(row, expectedRevision) {
  if (expectedRevision === undefined) return;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new HttpError(400, 'bad_revision', '카드의 저장 상태를 확인해 주세요.');
  }
  if (expectedRevision !== row.revision) {
    throw new HttpError(409, 'card_conflict', '다른 곳에서 이 카드를 먼저 변경했습니다.');
  }
}

function auditCard(callId, action, before, after) {
  recordAudit({ entity: 'card', entityId: callId, action, before, after });
}

/** 사람이 고친 값과 품목 순서를 저장한다. 이미 확인한 카드의 내용은 잠근다. */
export function updateCardFields(callId, patch) {
  return tx(() => {
    const row = requireCard(callId);
    assertEditable(row);
    const before = cardView(row);
    const domain = domainFor(before.domainVersion);
    const p = patch && typeof patch === 'object' ? patch : {};
    const sets = {};
    const reviews = { ...before.fieldReviews };
    for (const [key, col] of Object.entries(TEXT_FIELDS)) {
      if (!(key in p)) continue;
      const text = cleanInput(key, p[key], row[col], domain);
      const v = key === 'plate' ? normPlate(text) : text;
      sets[col] = v;
      if (v !== row[col]) delete reviews[key];
    }
    if ('callType' in p) {
      if (!CALL_TYPES.includes(p.callType)) throw new HttpError(400, 'bad_call_type', `통화 종류는 ${CALL_TYPES.join(' · ')} 중 하나로 골라 주세요.`);
      sets.call_type = p.callType;
    }
    if ('items' in p) {
      const next = cleanItems(p.items, domain, before.items);
      const positions = new Map(next.map((i, index) => [i.id, index]));
      sets.items = JSON.stringify(next);
      const warnings = parseJson(row.unsure, []).flatMap((w, index) => {
        if (!w) return [];
        if (!Number.isInteger(w.item)) return [{ ...w, id: warningId(w, index) }];
        const id = before.items[w.item]?.id;
        const position = positions.get(id);
        if (position == null) return [];
        return [{ ...w, id: warningId(w, index), item: position }];
      });
      sets.unsure = JSON.stringify(warnings);
      if (sets.items !== row.items) {
        for (const key of Object.keys(reviews)) {
          if (key.startsWith('item:') || key === 'items') delete reviews[key];
        }
      }
    }
    if ('urgent' in p) {
      sets.urgent = p.urgent === true || p.urgent === 1 || p.urgent === 'true' ? 1 : 0;
      if (sets.urgent !== row.urgent) delete reviews.urgent;
    }
    if ('askBack' in p) {
      if (!Array.isArray(p.askBack)) throw new HttpError(400, 'bad_ask_back', '다시 물어볼 것 형식이 잘못됐습니다.');
      const list = p.askBack.map((a) => cleanText(a, 200)).filter(Boolean);
      if (list.length > MAX_ASK_BACK) throw new HttpError(400, 'too_many_ask_back', `다시 물어볼 것은 ${MAX_ASK_BACK}줄까지 넣을 수 있습니다.`);
      sets.ask_back = JSON.stringify(list);
    }
    if (!Object.keys(sets).length) throw new HttpError(400, 'empty_patch', '고칠 칸이 없습니다.');
    if ('customer' in sets) {
      const call = getCallRow(callId);
      const phoneName = call?.caller_number ? customerByPhone(call.caller_number) : null;
      sets.customer_by_phone = phoneName && sets.customer && squash(phoneName) === squash(sets.customer) ? 1 : 0;
    }
    sets.field_reviews = JSON.stringify(reviews);
    const cols = Object.keys(sets).filter((key) => sets[key] !== row[key]);
    if (!cols.length) return before;
    checkRevision(row, p.expectedRevision);
    db().prepare(`UPDATE cards SET ${cols.map((key) => `${key} = ?`).join(', ')}, edits = edits + 1, revision = revision + 1, updated_at = ? WHERE call_id = ?`)
      .run(...cols.map((key) => sets[key]), nowIso(), callId);
    refreshCallTitle(callId);
    const after = cardView(getCardRow(callId));
    auditCard(callId, 'edit', before, after);
    return after;
  });
}

export function reviewCardWarning(callId, id, expectedRevision) {
  return tx(() => {
    const row = requireCard(callId);
    assertEditable(row);
    const warnings = parseJson(row.unsure, []);
    const index = warnings.findIndex((warning, i) => warning && warningId(warning, i) === id);
    if (index < 0) throw new HttpError(409, 'review_changed', '재확인 항목이 바뀌었습니다. 카드를 다시 열어 확인해 주세요.');
    const before = cardView(row);
    const warning = warnings[index];
    if (warning.reviewedAt) return before;
    checkRevision(row, expectedRevision);
    const at = nowIso();
    const reviewer = requestAccess()?.user?.id ?? null;
    warnings[index] = { ...warning, id, reviewedAt: at };
    const key = reviewKey(warning, before.items);
    const reviews = { ...before.fieldReviews, [key]: { at, reviewer } };
    db().prepare('UPDATE cards SET unsure = ?, field_reviews = ?, revision = revision + 1, updated_at = ? WHERE call_id = ?')
      .run(JSON.stringify(warnings), JSON.stringify(reviews), at, callId);
    const after = cardView(getCardRow(callId));
    auditCard(callId, 'review', before, after);
    return after;
  });
}

/** 확정·출고·수정·취소를 기록한다. 출고 되돌리기는 확정 상태로 돌아간다. */
export function setCardStatus(callId, action, { reason, expectedRevision } = {}) {
  return tx(() => {
    const row = requireCard(callId);
    const before = cardView(row);
    const state = row.status;
    const at = nowIso();
    const cleanReason = cleanText(reason, 300);
    let changes;
    if (action === 'confirm') {
      if (state === 'confirmed') return { card: before };
      assertEditable(row);
      const issues = confirmationIssues(before);
      if (issues.length) throw new HttpError(409, issues[0].code, issues[0].message);
      changes = { status: 'confirmed', confirmed_at: at, shipped_at: null };
    } else if (action === 'ship') {
      if (state === 'shipped') return { card: before };
      if (state !== 'confirmed') throw new HttpError(409, 'not_confirmed', '확정된 카드만 「출고 완료」로 바꿀 수 있습니다.');
      changes = { status: 'shipped', shipped_at: at };
    } else if (action === 'unship') {
      if (state === 'confirmed') return { card: before };
      if (state !== 'shipped') throw new HttpError(409, 'not_shipped', '출고 완료된 카드만 출고를 되돌릴 수 있습니다.');
      changes = { status: 'confirmed', shipped_at: null };
    } else if (action === 'reopen') {
      if (state === 'draft') return { card: before };
      if (state === 'shipped') throw new HttpError(409, 'already_shipped', '출고를 되돌린 뒤 카드를 다시 열어 주세요.');
      if (state === 'confirmed' && !cleanReason) throw new HttpError(400, 'reason_required', '확정을 취소하는 이유를 입력해 주세요.');
      changes = { status: 'draft', confirmed_at: null, shipped_at: null };
    } else if (action === 'cancel') {
      if (state === 'cancelled') return { card: before };
      if (state === 'shipped') throw new HttpError(409, 'already_shipped', '출고를 되돌린 뒤 주문을 취소해 주세요.');
      if (!cleanReason) throw new HttpError(400, 'reason_required', '취소 이유를 입력해 주세요.');
      changes = { status: 'cancelled', confirmed_at: null, shipped_at: null };
    } else {
      throw new HttpError(400, 'bad_action', '알 수 없는 동작입니다.');
    }
    checkRevision(row, expectedRevision);
    const cols = Object.keys(changes);
    db().prepare(`UPDATE cards SET ${cols.map((key) => `${key} = ?`).join(', ')}, revision = revision + 1, updated_at = ? WHERE call_id = ?`)
      .run(...cols.map((key) => changes[key]), at, callId);
    if (action === 'confirm') refreshCallTitle(callId);
    const card = cardView(getCardRow(callId));
    auditCard(callId, action, before, { ...card, ...(cleanReason ? { reason: cleanReason } : {}) });
    return { card };
  });
}

/** 「다시 전화할 곳」 표시를 주문 상태와 독립적으로 바꾼다. */
export function setCallback(callId, { on, reason } = {}) {
  return tx(() => {
    const before = cardView(requireCard(callId));
    const flag = on === true || on === 1 || on === 'true';
    const message = flag ? cleanText(reason, 200) : null;
    if (before.callback === flag && before.callbackReason === message) return before;
    db().prepare('UPDATE cards SET callback = ?, callback_reason = ?, revision = revision + 1, updated_at = ? WHERE call_id = ?')
      .run(flag ? 1 : 0, message, nowIso(), callId);
    const after = cardView(getCardRow(callId));
    auditCard(callId, 'callback', before, after);
    return after;
  });
}

// ── 통화 제목 · 거래처 · 요약 ──────────────────────────────────────
/** 카드 값으로 한 줄 요약을 만든다(예: "아반떼 AD 앞범퍼 1개, 오전 중 배송") */
export function composeSummary(card) {
  if (!card) return null;
  const items = (card.items || []).filter((i) => i && i.part);
  const itemText = items.slice(0, 3)
    .map((i) => {
      const part = partBase(i.part) || i.part;
      const side = String(i.side || '').trim();
      const firstWord = part.trim().split(/\s+/)[0];
      const prefix = side && squash(firstWord) !== squash(side) ? side + ' ' : '';
      return `${prefix}${part}${i.qty != null ? ` ${i.qty}개` : ''}`;
    })
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
