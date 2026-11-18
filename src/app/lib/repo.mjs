// 통화 · 카드 행을 API 모양으로 바꾸는 곳(docs/설계.md 5.1 · 5.2). 여러 routes 가 같이 쓴다.
import { db, parseJson } from './db.mjs';

export const CALL_STATUS_LABEL = {
  queued: '받아쓰기 기다리는 중',
  transcribing: '받아쓰는 중',
  extracting: '카드 정리 중',
  ready: '정리됨',
  failed: '실패',
};
export const CARD_STATUS_LABEL = {
  draft: '확인 필요',
  confirmed: '확정',
  shipped: '출고 완료',
  cancelled: '취소',
};

/** 전화번호 가운데를 가린다: 010-1234-4829 → 010-****-4829 */
export function maskPhone(num) {
  if (!num) return null;
  const digits = String(num).replace(/[^0-9]/g, '');
  if (digits.length < 7) return '****';
  const head = digits.slice(0, digits.startsWith('02') ? 2 : 3);
  const tail = digits.slice(-4);
  return `${head}-****-${tail}`;
}

/** KST 시:분 */
export function kstTime(iso) {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return d.toISOString().slice(11, 16);
}
export function fmtDuration(sec) {
  if (sec == null || !Number.isFinite(Number(sec))) return '';
  const s = Math.max(0, Math.round(Number(sec)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 통화 이름(F08): 거래처 · 부품 · 시각 · 길이 */
export function makeTitle({ customer, items, recordedAt, durationSec, source }) {
  const who = customer || (source === 'live' ? '실시간 체험' : '거래처 확인 필요');
  const parts = Array.isArray(items) ? items.filter((i) => i && i.part) : [];
  const what = parts.length ? parts[0].part + (parts.length > 1 ? ` 외 ${parts.length - 1}` : '') : '주문 내용 정리 전';
  const bits = [who, what, kstTime(recordedAt)];
  const dur = fmtDuration(durationSec);
  if (dur) bits.push(dur);
  return bits.join(' · ');
}

export const CALL_TYPES = ['주문', '배송 문의', '반품·교환', '재고·단가 문의', '기타'];

/** 출고(기사가 들고 나가거나 회수할 물건)가 있는 통화 종류 */
export const SHIP_CALL_TYPES = ['주문', '반품·교환'];
/**
 * 출고 대상 카드인가: 통화 종류가 주문 · 반품·교환이고 부품 줄이 하나라도 있을 것.
 * 출고 목록 · CSV · 대시보드 「급한데 출고 전」 · 할 일 「출고」가 모두 이것을 쓴다.
 * 배송 문의 · 잘못 건 전화처럼 부품 없이 「처리 끝」으로 확정한 카드는 빠진다.
 * @param {{callType?:string, items?:any[]}|null} card cardView 모양
 */
export function isShipTarget(card) {
  if (!card) return false;
  const items = Array.isArray(card.items) ? card.items.filter((i) => i && typeof i === 'object') : [];
  return SHIP_CALL_TYPES.includes(card.callType || '주문') && items.length > 0;
}
const CARD_FIELDS = ['callType', 'customer', 'contact', 'carModel', 'modelYear', 'plate', 'items', 'urgent', 'due', 'delivery', 'askBack', 'note'];

/** 카드 행 → API 모양 */
export function cardView(row) {
  if (!row) return null;
  const card = {
    status: row.status,
    statusLabel: CARD_STATUS_LABEL[row.status] || row.status,
    callType: row.call_type || '주문',
    customer: row.customer ?? null,
    customerByPhone: Boolean(row.customer_by_phone),
    contact: row.contact ?? null,
    carModel: row.car_model ?? null,
    modelYear: row.model_year ?? null,
    plate: row.plate ?? null,
    items: parseJson(row.items, []),
    urgent: Boolean(row.urgent),
    due: row.due ?? null,
    delivery: row.delivery ?? null,
    askBack: parseJson(row.ask_back, []),
    unsure: parseJson(row.unsure, []),
    fixes: parseJson(row.fixes, []),
    evidence: parseJson(row.evidence, {}),
    highlights: parseJson(row.highlights, []),
    note: row.note ?? null,
    callback: Boolean(row.callback),
    callbackReason: row.callback_reason ?? null,
    aiDraft: parseJson(row.ai_draft, null),
    aiModel: row.ai_model ?? null,
    aiError: row.ai_error ?? null,
    edits: row.edits ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at ?? null,
    shippedAt: row.shipped_at ?? null,
  };
  card.edited = editedFields(card);
  return card;
}

/** AI 초안과 다른 칸 이름들 */
export function editedFields(card) {
  const draft = card.aiDraft;
  if (!draft) return [];
  const out = [];
  for (const f of CARD_FIELDS) {
    const a = normalizeForCompare(f, draft[f]);
    const b = normalizeForCompare(f, card[f]);
    if (a !== b) out.push(f);
  }
  return out;
}
function normalizeForCompare(field, v) {
  if (field === 'items') {
    return JSON.stringify((Array.isArray(v) ? v : []).map((i) => [i?.part ?? null, i?.side ?? null, i?.qty ?? null, i?.partNo ?? null]));
  }
  if (field === 'urgent') return v ? '1' : '0';
  if (field === 'callType') return v || '주문';
  if (field === 'askBack') return JSON.stringify(Array.isArray(v) ? v : []);
  return v == null || v === '' ? '' : String(v);
}

/** 통화 행 → API 모양. withDetail 이면 글 · 문장 포함 */
export function callView(row, { withDetail = false, card } = {}) {
  if (!row) return null;
  const view = {
    id: row.id,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    source: row.source,
    status: row.status,
    statusLabel: CALL_STATUS_LABEL[row.status] || row.status,
    title: row.title,
    customer: row.customer ?? null,
    callerNumber: maskPhone(row.caller_number),
    deviceName: row.device_name ?? null,
    durationSec: row.duration_sec ?? null,
    hasAudio: Boolean(row.audio_file),
    isFake: Boolean(row.is_fake),
    engine: row.engine ?? null,
    summary: row.summary ?? null,
    error: row.error ?? null,
    card: card === undefined ? cardView(getCardRow(row.id)) : card,
  };
  if (withDetail) {
    view.transcript = row.transcript ?? '';
    view.segments = parseJson(row.segments, []);
    view.originalName = row.original_name ?? null;
    view.sttElapsedSec = row.stt_elapsed_sec ?? null;
  }
  return view;
}

export function getCallRow(id) {
  return db().prepare('SELECT * FROM calls WHERE id = ?').get(id) ?? null;
}
export function getCardRow(callId) {
  return db().prepare('SELECT * FROM cards WHERE call_id = ?').get(callId) ?? null;
}

/**
 * 받아쓰기 · AI 에 넘길 사전(F07). 승인된 것만.
 * @returns {{glossary:{term:string,standard:string,kind:string}[], customers:{name:string,phone:string|null}[], carModels:string[], initialPrompt:string}}
 */
export function dictionaryForAi() {
  const rows = db().prepare("SELECT kind, term, standard, phone FROM glossary WHERE status = 'approved' ORDER BY kind, term").all();
  const glossary = rows.filter((r) => r.kind === '현장말' || r.kind === '오인식').map((r) => ({ term: r.term, standard: r.standard || '', kind: r.kind }));
  const customers = rows.filter((r) => r.kind === '거래처').map((r) => ({ name: r.term, phone: r.phone || null }));
  const carModels = rows.filter((r) => r.kind === '차종').map((r) => r.term);
  const words = glossary.filter((g) => g.kind === '현장말').map((g) => g.term);
  const initialPrompt = `자동차 부품 대리점 주문 전화입니다. ${words.join(', ')}.`.slice(0, 600);
  return { glossary, customers, carModels, initialPrompt };
}

/** 숫자만 남긴 전화번호로 거래처 찾기(F11) */
export function customerByPhone(num) {
  if (!num) return null;
  const digits = String(num).replace(/[^0-9]/g, '');
  if (digits.length < 7) return null;
  const rows = db().prepare("SELECT term, phone FROM glossary WHERE kind = '거래처' AND status = 'approved' AND phone IS NOT NULL").all();
  const hit = rows.find((r) => String(r.phone).replace(/[^0-9]/g, '') === digits);
  return hit ? hit.term : null;
}
