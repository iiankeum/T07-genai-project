// 통화 상세(call.js · call-card.js)가 함께 쓰는 계산 도우미. DOM 을 건드리지 않는다(Node 에서도 불러 시험할 수 있게).
import { fmtSec, fmtWhen, SOURCE_LABEL } from '../ui.js';

/** 아직 처리 중인 통화 상태 */
export const WORKING = ['queued', 'transcribing', 'extracting'];

/** 통화 글에서 「급함」으로 칠할 낱말 */
export const URGENT_WORDS = ['급해', '급한', '빨리', '퀵', '오늘 꼭'];

/** 카드 칸 이름 → 화면 글 */
export const FIELD_LABEL = {
  customer: '거래처', contact: '담당자', carModel: '차종', modelYear: '연식', plate: '차번호',
  items: '부품', urgent: '급함', due: '원하는 때', delivery: '받는 방법', askBack: '다시 물어볼 것', note: '메모',
  part: '부품 이름', side: '위치', qty: '수량', partNo: '품번',
};
const LABEL_TO_FIELD = Object.fromEntries(Object.entries(FIELD_LABEL).map(([k, v]) => [v.replace(/\s/g, ''), k]));
const SNAKE = { car_model: 'carModel', model_year: 'modelYear', part_no: 'partNo', ask_back: 'askBack', part_number: 'partNo', partNumber: 'partNo', car: 'carModel', quantity: 'qty' };
const ITEM_SUBS = ['part', 'side', 'qty', 'partNo'];

/** 숫자로 읽을 수 있으면 숫자, 아니면 null */
export function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 비교용으로 띄어쓰기 · 문장부호를 지운 소문자 */
export function squash(s) {
  return String(s ?? '').toLowerCase().replace(/[\s.,!?~·…'"“”‘’()\-]/g, '');
}

/** t 초에 말하고 있던 문장 번호(시작 시각이 t 이하인 것 중 가장 늦은 것). 문장이 없으면 -1 */
export function segAtTime(segments, t) {
  if (!Array.isArray(segments) || !segments.length) return -1;
  const time = num(t);
  if (time === null) return -1;
  let best = -1; let bestStart = -Infinity;
  let first = -1; let firstStart = Infinity;
  segments.forEach((s, i) => {
    const st = num(s?.start);
    if (st === null) return;
    if (st < firstStart) { firstStart = st; first = i; }
    if (st <= time + 0.25 && st >= bestStart) { bestStart = st; best = i; }
  });
  return best >= 0 ? best : first;
}

/** 근거(ev: {seg?, at?, quote?})가 가리키는 문장 번호. 못 찾으면 -1 */
export function findSegIndex(segments, ev) {
  if (!ev || !Array.isArray(segments) || !segments.length) return -1;
  const seg = num(ev.seg ?? ev.segIndex);
  if (seg !== null && Number.isInteger(seg) && seg >= 0 && seg < segments.length) return seg;
  const at = num(ev.at);
  if (at !== null) return segAtTime(segments, at);
  const q = squash(ev.quote);
  if (q.length >= 2) {
    let i = segments.findIndex((s) => { const t = squash(s?.text); return t && (t.includes(q) || q.includes(t)); });
    if (i >= 0) return i;
    // 인용이 길어 여러 문장에 걸치면, 인용 앞 6글자로 다시 찾는다
    const head = q.slice(0, 6);
    i = segments.findIndex((s) => squash(s?.text).includes(head));
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * 근거를 화면에서 쓰기 좋게 푼다.
 * @returns {{segIndex:number, at:number|null, quote:string}|null}
 */
export function resolveEvidence(segments, ev) {
  if (!ev || typeof ev !== 'object') return null;
  const segIndex = findSegIndex(segments, ev);
  let at = num(ev.at);
  if (at === null && segIndex >= 0) at = num(segments[segIndex]?.start);
  const quote = String(ev.quote || (segIndex >= 0 ? segments[segIndex]?.text : '') || '').trim();
  if (segIndex < 0 && at === null && !quote) return null;
  return { segIndex, at, quote };
}

/**
 * unsure.field 를 칸으로 푼다. 'plate' · 'car_model' · '차번호' · 'items[0].partNo' · 'items.1' · 'partNo' 를 받는다.
 * @returns {{field:string, index:number|null, sub:string|null}}
 */
export function parseUnsureField(raw) {
  const s = String(raw ?? '').trim();
  const m = /^items?\s*(?:\[(\d+)\]|\.(\d+))?(?:\.([A-Za-z_]+))?$/.exec(s);
  if (m) {
    const idx = m[1] ?? m[2];
    return { field: 'items', index: idx != null ? Number(idx) : null, sub: m[3] ? camel(m[3]) : null };
  }
  const f = LABEL_TO_FIELD[s.replace(/\s/g, '')] || camel(s);
  if (ITEM_SUBS.includes(f)) return { field: 'items', index: null, sub: f };
  return { field: f, index: null, sub: null };
}
function camel(s) {
  if (SNAKE[s]) return SNAKE[s];
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 「들어 보기」 표시를 붙일 곳으로 나눈다.
 * 키: 칸 이름('plate' 등) · 'item:<번호>' · 'items'(부품 전체) · 'other'(맞는 칸이 없음)
 * @returns {Map<string, {u:object, idx:number}[]>}
 */
export function groupUnsure(card, items) {
  const out = new Map();
  const add = (k, v) => { if (!out.has(k)) out.set(k, []); out.get(k).push(v); };
  const list = Array.isArray(card?.unsure) ? card.unsure : [];
  const known = new Set(['customer', 'contact', 'carModel', 'modelYear', 'plate', 'urgent', 'due', 'delivery', 'note', 'askBack']);
  const rows = Array.isArray(items) ? items : [];
  list.forEach((u, idx) => {
    if (!u) return;
    const p = parseUnsureField(u.field);
    if (p.field === 'items') {
      if (p.index !== null && p.index < rows.length) { add(`item:${p.index}`, { u, idx }); return; }
      // 번호가 없으면 시각이 같은 부품 줄을 찾는다
      const at = num(u.at);
      if (at !== null) {
        const hit = rows.findIndex((it) => num(it?.at) !== null && Math.abs(num(it.at) - at) < 0.6);
        if (hit >= 0) { add(`item:${hit}`, { u, idx }); return; }
      }
      add('items', { u, idx });
      return;
    }
    add(known.has(p.field) ? p.field : 'other', { u, idx });
  });
  return out;
}

/** 통화 글에 칠할 낱말들(highlight() 의 marks 모양) */
export function buildMarks(card) {
  const marks = [];
  const push = (text, kind, min = 2) => {
    const t = String(text ?? '').trim();
    if (t.length >= min) marks.push({ text: t, kind });
  };
  if (card) {
    for (const h of Array.isArray(card.highlights) ? card.highlights : []) {
      if (h && h.text) push(h.text, h.kind || 'part', 1);
    }
    for (const it of Array.isArray(card.items) ? card.items : []) {
      if (!it) continue;
      push(it.part, 'part');
      push(it.partNo ?? it.part_no, 'part', 4);
    }
    if (card.carModel) {
      push(card.carModel, 'car');
      const first = String(card.carModel).trim().split(/\s+/)[0];
      if (first && first !== String(card.carModel).trim()) push(first, 'car');
    }
    if (card.plate) {
      push(card.plate, 'plate');
      const tail = /(\d{4})\s*$/.exec(String(card.plate));
      if (tail) push(tail[1], 'plate', 4);
    }
    if (card.customer) push(card.customer, 'customer');
    for (const f of Array.isArray(card.fixes) ? card.fixes : []) {
      if (f && f.heard) push(f.heard, 'fix', 1);
    }
  }
  for (const w of URGENT_WORDS) push(w, 'urgent', 1);
  return marks;
}

/** 「통화 글 복사」에 쓸 글 */
export function transcriptText(call) {
  if (!call) return '';
  const head = [
    call.title || '통화',
    [fmtWhen(call.recordedAt), call.durationSec ? `길이 ${fmtSec(call.durationSec)}` : '', SOURCE_LABEL[call.source] || ''].filter(Boolean).join(' · '),
    '(가짜 통화 데모 — 거래처 · 차번호 · 전화번호 · 품번은 지어낸 것입니다)',
  ];
  const segs = Array.isArray(call.segments) ? call.segments : [];
  const body = segs.length
    ? segs.map((s) => {
      const t = num(s?.start);
      const who = s?.speaker ? `${s.speaker}: ` : '';
      return `${t !== null ? `[${fmtSec(t)}] ` : ''}${who}${String(s?.text ?? '').trim()}`;
    })
    : [String(call.transcript || '').trim()];
  return head.join('\n') + '\n\n' + body.filter(Boolean).join('\n');
}

/** 부품 줄을 화면용으로 복사(품번은 partNo 하나로) */
export function cloneItems(items) {
  return (Array.isArray(items) ? items : []).map((it) => ({
    part: it?.part ?? '',
    side: it?.side ?? '',
    qty: num(it?.qty),
    partNo: it?.partNo ?? it?.part_no ?? '',
    quote: it?.quote ?? null,
    at: num(it?.at),
    seg: num(it?.seg),
  }));
}

/** 부품 줄 한 칸 값을 비교용으로(빈칸 · 띄어쓰기만 다른 것은 같게) */
function itemVal(k, v) {
  if (k === 'qty') return num(v);
  const s = String(v ?? '').trim();
  return s || null;
}
/** 두 부품 줄의 부품 이름 · 위치 · 수량 · 품번이 모두 같은가 */
export function sameItem(a, b) {
  if (!a || !b) return false;
  return ITEM_SUBS.every((k) => itemVal(k, a[k] ?? (k === 'partNo' ? a.part_no : undefined)) === itemVal(k, b[k] ?? (k === 'partNo' ? b.part_no : undefined)));
}
/**
 * 부품 줄 하나에 붙일 표시: 'ai'(AI 초안과 같음) · 'edited'(사람이 고치거나 넣음) · null(빈 줄 · 초안 없음).
 * 줄을 지우거나 순서가 바뀌어도 맞게, 같은 번호 줄 말고도 초안 어느 줄과든 같으면 'ai' 로 본다.
 */
export function itemMark(draftItems, item) {
  if (!Array.isArray(draftItems) || !item) return null;
  if (!itemVal('part', item.part) && !itemVal('partNo', item.partNo)) return null;
  return draftItems.some((d) => sameItem(d, item)) ? 'ai' : 'edited';
}

/** 서버에 보낼 부품 줄(빈 줄은 뺀다) */
export function itemsForSave(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => String(it.part || '').trim() || String(it.partNo || '').trim())
    .map((it) => {
      const out = {
        part: String(it.part || '').trim() || null,
        side: String(it.side || '').trim() || null,
        qty: num(it.qty) === null ? null : Math.min(999, Math.max(1, Math.round(num(it.qty)))),
        partNo: String(it.partNo || '').trim() || null,
      };
      if (it.quote) out.quote = it.quote;
      if (it.at !== null && it.at !== undefined) out.at = it.at;
      if (it.seg !== null && it.seg !== undefined) out.seg = it.seg;
      return out;
    });
}
