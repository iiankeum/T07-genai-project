// 오늘 대시보드 · 할 일(F10) · AI 브리핑 · 마감 요약 글 · 지난 통화에 묻기(F09) · 출고 목록과 CSV(F14). [C]
import { config } from '../lib/config.mjs';
import { db, parseJson, nowIso } from '../lib/db.mjs';
import { HttpError, readJson, cleanText } from '../lib/http.mjs';
import { limit, takeDaily, kstDay } from '../lib/security.mjs';
import { callView, cardView, makeTitle, kstTime, CARD_STATUS_LABEL } from '../lib/repo.mjs';
import {
  EFF_CUSTOMER, parseDay, kstDayRange, addDays, kstDateTime, itemsText, knownCustomerNames,
} from './calls.mjs';

// ── AI 모듈(B 의 lib/ai.mjs). 없거나 키가 없으면 503 'ai_off' ─────────────
let aiOverride = null;
let aiModPromise = null;
/** 시험용: 가짜 AI 를 끼운다({aiEnabled, writeBriefing, answerQuestion}). null 이면 원래대로. */
export function setAiForTest(obj) { aiOverride = obj; }
async function loadAi() {
  if (aiOverride) return aiOverride;
  aiModPromise ??= import('../lib/ai.mjs').catch((e) => {
    console.error('[insights] lib/ai.mjs 를 읽지 못함:', e?.code || e?.message || e);
    return null;
  });
  return aiModPromise;
}
async function requireAi(fnName) {
  const ai = await loadAi();
  if (!ai || typeof ai[fnName] !== 'function') throw new HttpError(503, 'ai_off', 'AI 키 없음');
  let on = true;
  try { on = typeof ai.aiEnabled === 'function' ? Boolean(ai.aiEnabled()) : true; } catch { on = false; }
  if (!on) throw new HttpError(503, 'ai_off', 'AI 키 없음');
  return ai;
}
/** AiError → HttpError (비밀값 · 원문 오류는 내보내지 않는다) */
function aiHttpError(e) {
  if (e instanceof HttpError) return e;
  switch (e?.code) {
    case 'no_key': return new HttpError(503, 'ai_off', 'AI 키 없음');
    case 'refused': return new HttpError(422, 'ai_refused', 'AI 가 답하지 않았습니다. 다르게 물어봐 주세요.');
    case 'rate_limited': return new HttpError(429, 'ai_busy', 'AI 가 바쁩니다. 잠시 뒤 다시 해 주세요.');
    case 'bad_output': return new HttpError(502, 'ai_bad_output', 'AI 답을 읽지 못했습니다. 다시 해 주세요.');
    default:
      console.error('[insights] AI 호출 실패:', e?.code || e?.name || 'error');
      return new HttpError(502, 'ai_error', 'AI 를 부르지 못했습니다. 잠시 뒤 다시 해 주세요.');
  }
}

// ── 하루 데이터 ───────────────────────────────────────────────────

const WEEKDAY = '일월화수목금토';
function dayLabel(day) {
  const [, m, d] = day.split('-').map(Number);
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return `${m}월 ${d}일(${WEEKDAY[dow]})`;
}
function shortDate(iso) {
  const day = kstDay(new Date(Date.parse(iso)));
  const [, m, d] = day.split('-').map(Number);
  return `${m}/${d}(${WEEKDAY[new Date(`${day}T00:00:00Z`).getUTCDay()]})`;
}

const arr = (v) => (Array.isArray(v) ? v : []);
/** cardView + 배열 칸이 깨졌어도 배열로, 되물을 것은 글로 */
function viewCard(row) {
  const card = cardView(row);
  if (!card) return null;
  card.items = arr(card.items).filter((i) => i && typeof i === 'object');
  card.unsure = arr(card.unsure);
  card.askBack = arr(card.askBack).map((a) => (typeof a === 'string' ? cleanText(a, 200) : cleanText(a?.text ?? a?.question, 200))).filter(Boolean);
  return card;
}

const WORKING = ['queued', 'transcribing', 'extracting'];
const isOpen = (card) => card && (card.status === 'draft' || card.status === 'confirmed');
const needsCallback = (card) => card && (card.callback || (card.status === 'draft' && card.askBack.length > 0));

/** 그날 통화 + 카드 [{row, card, customer, title}] (최신 먼저) */
function loadDay(day) {
  const [from, to] = kstDayRange(day);
  const d = db();
  const rows = d.prepare('SELECT * FROM calls WHERE recorded_at >= ? AND recorded_at < ? ORDER BY recorded_at DESC, id DESC').all(from, to);
  const cardRows = d.prepare('SELECT k.* FROM cards k JOIN calls c ON c.id = k.call_id WHERE c.recorded_at >= ? AND c.recorded_at < ?').all(from, to);
  const cards = new Map(cardRows.map((r) => [r.call_id, viewCard(r)]));
  return rows.map((row) => toEntry(row, cards.get(row.id) ?? null));
}
function toEntry(row, card) {
  const customer = card?.customer || row.customer || null;
  const title = row.title || makeTitle({ customer, items: card?.items, recordedAt: row.recorded_at, durationSec: row.duration_sec, source: row.source });
  return { row, card, customer, title };
}

export function computeStats(entries) {
  const s = { calls: entries.length, cards: 0, draft: 0, confirmed: 0, shipped: 0, urgentOpen: 0, callbacks: 0, unsure: 0, working: 0, failed: 0, byType: {} };
  for (const { row, card } of entries) {
    if (WORKING.includes(row.status)) s.working += 1;
    if (row.status === 'failed') s.failed += 1;
    if (!card) continue;
    // 「주문 카드」 수는 통화 종류 = 주문만 센다. 나머지는 종류별 개수(byType)로.
    const type = card.callType || '주문';
    if (type === '주문') s.cards += 1;
    else s.byType[type] = (s.byType[type] || 0) + 1;
    if (card.status === 'draft') s.draft += 1;
    if (card.status === 'confirmed') s.confirmed += 1;
    if (card.status === 'shipped') s.shipped += 1;
    if (card.urgent && isOpen(card)) s.urgentOpen += 1;
    if (needsCallback(card)) s.callbacks += 1;
    if (card.status === 'draft' && card.unsure.length > 0) s.unsure += 1;
  }
  return s;
}

const KIND_ORDER = ['callback', 'confirm', 'ship', 'listen', 'retry'];
const who = (e) => e.customer || '거래처 확인 필요';

/** 규칙으로 만드는 할 일. 같은 통화는 가장 급한 것 하나만. */
export function buildTodos(entries) {
  const out = [];
  for (const e of entries) {
    const { row, card } = e;
    const cands = [];
    if (row.status === 'failed') {
      cands.push({ kind: 'retry', title: `${e.title} — 다시 받아쓰기`, why: '받아쓰기나 카드 정리가 실패했어요. 다시 올리거나 「다시 정리」를 눌러 주세요.', priority: 2 });
    } else if (card?.aiError && card.status === 'draft' && !card.items.length) {
      // AI 가 카드를 못 만들어 빈 카드로 남은 통화
      cands.push({ kind: 'retry', title: `${who(e)} 카드 다시 정리`, why: 'AI 가 카드를 정리하지 못했어요. 「다시 정리」를 누르거나 직접 채워 주세요.', priority: 2 });
    }
    if (card && card.status !== 'cancelled') {
      const due = card.due ? ` · ${card.due}` : '';
      if (needsCallback(card)) {
        const why = card.askBack.length ? `물어볼 것: ${card.askBack.join(' · ')}` : (card.callbackReason || '다시 전화하기로 표시했어요.');
        cands.push({ kind: 'callback', title: `${who(e)}에 다시 전화`, why, priority: card.urgent ? 1 : 2 });
      }
      if (card.status === 'draft') {
        const extra = card.unsure.length ? ` · 들어 볼 곳 ${card.unsure.length}개` : '';
        cands.push({
          kind: 'confirm',
          title: `${who(e)} ${card.callType && card.callType !== '주문' ? card.callType : '주문'} 확인하고 확정`,
          why: (card.urgent ? '급하다고 한 주문이에요' : '확인 필요 상태예요') + due + extra,
          priority: card.urgent ? 1 : 3,
        });
        if (card.unsure.length) {
          const reasons = card.unsure.map((u) => u?.reason).filter(Boolean).slice(0, 2).join(' · ');
          cands.push({ kind: 'listen', title: `${who(e)} 녹음 들어 보기`, why: reasons || '받아쓰기가 틀렸을 수 있는 곳이 있어요.', priority: 2 });
        }
      }
      if (card.status === 'confirmed' && card.urgent) {
        cands.push({ kind: 'ship', title: `${who(e)} 출고`, why: `급한 주문 · 확정됨${due}${card.delivery ? ` · ${card.delivery}` : ''}`, priority: 1 });
      }
    }
    if (!cands.length) continue;
    cands.sort((a, b) => a.priority - b.priority || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    out.push({ ...cands[0], callId: row.id, _at: row.recorded_at });
  }
  // 급한 것 먼저, 같으면 오래 기다린 것 먼저
  out.sort((a, b) => a.priority - b.priority || (a._at < b._at ? -1 : a._at > b._at ? 1 : 0));
  return out.slice(0, 30).map(({ _at, ...t }) => t);
}

function getBriefing(day) {
  const r = db().prepare('SELECT content, model, created_at FROM briefings WHERE day = ?').get(day);
  if (!r) return null;
  const c = parseJson(r.content, null);
  if (!c || typeof c.paragraph !== 'string') return null;
  return { paragraph: c.paragraph, todos: Array.isArray(c.todos) ? c.todos : [], createdAt: r.created_at, model: r.model ?? null };
}

export function buildDashboard(day) {
  const entries = loadDay(day);
  const stats = computeStats(entries);
  const byNewest = (a, b) => (a.row.recorded_at < b.row.recorded_at ? 1 : -1);
  const callbacks = entries.filter((e) => needsCallback(e.card))
    .sort((a, b) => Number(b.card.urgent) - Number(a.card.urgent) || byNewest(a, b))
    .map((e) => ({
      callId: e.row.id, title: e.title, customer: e.customer,
      reason: e.card.callbackReason || (e.card.askBack.length ? '되물을 것이 남았어요' : '다시 전화하기로 표시했어요'),
      askBack: e.card.askBack, urgent: e.card.urgent, recordedAt: e.row.recorded_at,
    }));
  const urgentOpen = entries.filter((e) => e.card?.urgent && isOpen(e.card))
    .sort((a, b) => (a.row.recorded_at < b.row.recorded_at ? -1 : 1))
    .map((e) => ({ callId: e.row.id, title: e.title, customer: e.customer, status: e.card.status, statusLabel: e.card.statusLabel, due: e.card.due, delivery: e.card.delivery, recordedAt: e.row.recorded_at }));
  const drafts = entries.filter((e) => e.card?.status === 'draft')
    .sort((a, b) => Number(b.card.urgent) - Number(a.card.urgent) || byNewest(a, b))
    .map((e) => ({ callId: e.row.id, title: e.title, customer: e.customer, urgent: e.card.urgent, unsureCount: e.card.unsure.length, askBackCount: e.card.askBack.length, recordedAt: e.row.recorded_at }));
  return {
    day,
    isToday: day === kstDay(),
    stats,
    callbacks,
    urgentOpen,
    drafts,
    todos: buildTodos(entries),
    recent: entries.slice(0, 8).map((e) => callView(e.row, { card: e.card })),
    briefing: getBriefing(day),
  };
}

// ── 마감 요약 글(AI 없이) ──────────────────────────────────────────

export function buildBriefingText(day) {
  const entries = loadDay(day);
  const s = computeStats(entries);
  const lines = [`[콜노트 마감 요약 · ${dayLabel(day)}] 가짜 통화 데모`];
  if (!s.calls) {
    lines.push('이날은 통화가 없습니다.');
    return lines.join('\n');
  }
  lines.push(`통화 ${s.calls}건 · 주문 카드 ${s.cards}건`);
  const others = Object.entries(s.byType || {}).map(([k, n]) => `${k} ${n}`).join(' · ');
  if (others) lines.push(`주문 아닌 통화: ${others}`);
  lines.push(`확정 ${s.confirmed}건 · 확인 필요 ${s.draft}건 · 출고 완료 ${s.shipped}건`);
  if (s.working || s.failed) lines.push(`받아쓰는 중 ${s.working}건 · 실패 ${s.failed}건`);

  const urgent = entries.filter((e) => e.card?.urgent && isOpen(e.card)).reverse();
  lines.push('', `■ 급한데 아직 출고 안 된 것 ${urgent.length ? urgent.length + '건' : ': 없음'}`);
  for (const e of urgent) {
    const items = itemsText(e.card.items, { unit: '개' }) || '부품 확인 필요';
    lines.push(`- ${who(e)}: ${items} (${e.card.statusLabel}${e.card.due ? ` · ${e.card.due}` : ''})`);
  }
  const cbs = entries.filter((e) => needsCallback(e.card)).reverse();
  lines.push('', `■ 다시 전화할 곳 ${cbs.length ? cbs.length + '곳' : ': 없음'}`);
  for (const e of cbs) {
    const what = e.card.askBack.length ? e.card.askBack.join(' / ') : (e.card.callbackReason || '다시 전화 표시');
    lines.push(`- ${who(e)}: ${what}`);
  }
  const b = getBriefing(day);
  if (b?.paragraph) lines.push('', '■ AI 요약', b.paragraph);
  return lines.join('\n');
}

// ── AI 브리핑 ────────────────────────────────────────────────────

const BRIEFING_FRESH_MS = 10 * 60_000;

/** AI 에 넘길 카드 한 개(빈 칸은 뺀다 — lib/ai.mjs 가 JSON 한 줄로 넣는다) */
function cardSummaryForAi(e) {
  const c = e.card;
  const o = {
    callId: e.row.id,
    time: kstTime(e.row.recorded_at),
    customer: who(e),
    type: c.callType && c.callType !== '주문' ? c.callType : null,
    car: [c.carModel, c.modelYear ? `${c.modelYear}년` : null].filter(Boolean).join(' ') || null,
    plate: c.plate,
    items: itemsText(c.items, { partNo: true }) || null,
    status: c.statusLabel,
    urgent: c.urgent || null,
    due: c.due,
    delivery: c.delivery,
    askBack: c.askBack.length ? c.askBack : null,
    unsure: c.unsure.length || null,
    callback: c.callback || null,
    callbackReason: c.callbackReason,
  };
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''));
}

async function makeBriefing(day, ip) {
  const cached = getBriefing(day);
  if (cached && Date.now() - Date.parse(cached.createdAt) < BRIEFING_FRESH_MS) return cached;
  const ai = await requireAi('writeBriefing');
  const entries = loadDay(day);
  const ids = new Set(entries.map((e) => e.row.id));
  const stats = computeStats(entries);
  let paragraph;
  let todos = [];
  let model = null;
  if (!entries.length) {
    paragraph = `${dayLabel(day)}에는 통화가 없습니다.`;
  } else {
    limit('ai', ip);
    takeDaily('ai', config.dailyAiLimit);
    const cards = entries.filter((e) => e.card).slice(0, 60).map(cardSummaryForAi);
    let out;
    try { out = await ai.writeBriefing({ day, stats, cards }); } catch (e) { throw aiHttpError(e); }
    paragraph = cleanText(out?.paragraph, 1500);
    if (!paragraph) throw new HttpError(502, 'ai_bad_output', 'AI 답을 읽지 못했습니다. 다시 해 주세요.');
    todos = (Array.isArray(out?.todos) ? out.todos : []).map((t) => ({
      title: cleanText(t?.title, 80),
      why: cleanText(t?.why, 200),
      callId: ids.has(t?.callId) ? t.callId : null,
    })).filter((t) => t.title).slice(0, 8);
    model = cleanText(out?.model, 80) || config.model;
  }
  const createdAt = nowIso();
  db().prepare(`INSERT INTO briefings(day, content, model, created_at) VALUES(?, ?, ?, ?)
    ON CONFLICT(day) DO UPDATE SET content = excluded.content, model = excluded.model, created_at = excluded.created_at`)
    .run(day, JSON.stringify({ paragraph, todos }), model, createdAt);
  return { paragraph, todos, createdAt, model };
}

// ── 지난 통화에 묻기 ──────────────────────────────────────────────

const NOT_FOUND = '찾지 못했어요. 저장된 통화에서 근거가 되는 말을 찾지 못했습니다. 거래처 이름이나 부품 이름을 넣어 다시 물어봐 주세요.';
const PARTICLES = ['이라고', '이라는', '에서', '한테', '으로', '하고', '이랑', '까지', '부터', '께서', '라고', '라는',
  '은', '는', '이', '가', '을', '를', '에', '께', '도', '만', '로', '의', '랑'];
// 조사를 떼면 한 글자만 남는 말(「주에 · 개라고」)은 버린다
const SINGLE_STOP = new Set(['주', '달', '몇', '번', '개', '건', '뭐', '거', '것', '적', '좀', '그', '저', '이', '날', '어디', '누구']);
const STOP = new Set([
  '했어', '했나', '했니', '했지', '했냐', '있어', '있나', '있니', '있지', '없어', '몇', '몇번', '몇개', '몇건', '몇통', '뭐', '뭘', '무슨', '무엇', '어떤', '언제', '누가', '누구',
  '어디', '얼마', '얼마나', '알려', '알려줘', '줘', '좀', '그', '저', '그거', '거', '것', '적', '번', '개', '건', '전화', '통화', '주문', '혹시', '다시', '정도', '그리고',
  '오늘', '어제', '이번', '지난', '주', '달', '이번주', '지난주', '이번달', '지난달', '요즘', '최근',
  '시킨', '시켜', '시킬', '보낸', '말한', '한다고', '했다고', '라고', '했던', '있는지', '맞아', '맞나',
  '어디야', '뭐야', '누구야', '언제야', '불러준', '말해준', '알려준', '곳', '데', '있으면', '없으면',
  '그럼', '그러면', '그건', '그때', '그날', '거기', '여기',
]);
// 「시켰어 · 했던 · 있었나 · 주문했어요」 같은 서술어는 찾을 낱말이 아니다
const PREDICATE = /(했|있|없|켰|됐|었|였|았|왔|갔|줬|봤|렸|셨|겠|냈|났|샀|썼)(어|나|니|지|냐|까|요|죠|다|던|래|는지|던가|던지|어요|나요|었어|었나|었지|을까)?$/;

/** 질문 → 찾을 낱말 (2글자 이상, 조사 · 물음말 정리) */
export function questionTerms(question) {
  const out = new Set();
  for (let tok of String(question).split(/[\s,.?!~"'“”‘’()[\]{}:;·…/]+/)) {
    if (!tok) continue;
    if (/^몇/.test(tok) || /^얼마/.test(tok)) continue;
    for (const p of PARTICLES) {
      if (tok.length > p.length && tok.endsWith(p)) {
        const stem = tok.slice(0, -p.length);
        if (stem.length >= 2) tok = stem;
        else if (SINGLE_STOP.has(stem)) tok = '';
        break;
      }
    }
    if (tok.length < 2 || STOP.has(tok)) continue;
    if (tok.length <= 6 && !/[0-9A-Za-z]/.test(tok) && PREDICATE.test(tok)) continue;
    out.add(tok);
  }
  return [...out].slice(0, 10);
}

/** 질문 속 날짜 말 → {from, to, label} (KST 날짜, 둘 다 포함) */
export function questionRange(question, today = kstDay()) {
  const q = String(question);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, -((dow + 6) % 7));
  if (/오늘/.test(q)) return { from: today, to: today, label: '오늘' };
  if (/어제/.test(q)) { const y = addDays(today, -1); return { from: y, to: y, label: '어제' }; }
  if (/이번\s*주/.test(q)) return { from: monday, to: today, label: '이번 주' };
  if (/지난\s*주/.test(q)) return { from: addDays(monday, -7), to: addDays(monday, -1), label: '지난주' };
  if (/이번\s*달/.test(q)) return { from: today.slice(0, 8) + '01', to: today, label: '이번 달' };
  if (/지난\s*달/.test(q)) {
    const first = today.slice(0, 8) + '01';
    const lastPrev = addDays(first, -1);
    return { from: lastPrev.slice(0, 8) + '01', to: lastPrev, label: '지난달' };
  }
  return null;
}

/** 질문에 든 거래처 이름(긴 이름 우선, 없으면 3글자 이상 낱말로 시작하는 이름이 하나뿐일 때) */
export function questionCustomers(question, terms, names = knownCustomerNames()) {
  const q = String(question);
  const qn = q.replace(/\s+/g, '');
  let hit = names.filter((n) => n.length >= 2 && (q.includes(n) || qn.includes(n.replace(/\s+/g, ''))));
  hit = hit.filter((n) => !hit.some((m) => m !== n && m.includes(n)));
  if (hit.length) return hit;
  for (const t of terms) {
    if (t.length < 3) continue;
    const pre = names.filter((n) => n.startsWith(t));
    if (pre.length === 1) return pre;
  }
  return [];
}

// lib/ai.mjs 는 contexts 를 앞에서 200개만 쓴다. 문장은 100개 안, 나머지를 카드 줄로 채운다.
const MAX_CONTEXTS = 200;
const MAX_SEGMENTS = 100;
const SEG_PER_CALL = 15;
const MAX_CARD_LINES = 200;

/** 긴 통화는 낱말이 든 문장 ±2 를 먼저, 남는 자리는 앞 문장들로 */
function pickSegments(segments, terms, max) {
  if (segments.length <= max) return segments.map((_, i) => i);
  const lower = terms.map((t) => t.toLowerCase());
  const hits = new Set();
  segments.forEach((s, i) => {
    const lt = String(s?.text ?? '').toLowerCase();
    if (lower.some((t) => lt.includes(t))) for (let j = i - 2; j <= i + 2; j += 1) if (j >= 0 && j < segments.length) hits.add(j);
  });
  const keep = [...hits].sort((a, b) => a - b).slice(0, max);
  for (let i = 0; keep.length < max && i < segments.length; i += 1) if (!hits.has(i)) keep.push(i);
  return keep.sort((a, b) => a - b);
}

/** 찾기: 통화 문장 contexts + 카드 한 줄 요약 contexts */
export function buildAskContexts(question, history = []) {
  const today = kstDay();
  let terms0 = questionTerms(question);
  let range = questionRange(question, today);
  let customers = questionCustomers(question, terms0);
  // 「그럼 지난주는?」처럼 낱말 · 거래처가 없는 이어진 질문은 앞 질문의 것을 이어 쓴다
  const prev = [...history].reverse().find((h) => h.role === 'user')?.text;
  if (prev && !terms0.length && !customers.length) {
    terms0 = questionTerms(prev);
    customers = questionCustomers(prev, terms0);
    range = range ?? questionRange(prev, today);
  }
  // 거래처 이름에 든 낱말은 점수에서 뺀다(이미 거르기로 썼다)
  const terms = terms0.filter((t) => !customers.some((n) => n.includes(t)));

  const where = ["(c.transcript IS NOT NULL AND c.transcript != '' OR k.call_id IS NOT NULL)"];
  const args = [];
  if (range) {
    where.push('c.recorded_at >= ? AND c.recorded_at < ?');
    args.push(kstDayRange(range.from)[0], kstDayRange(range.to)[1]);
  }
  if (customers.length) {
    where.push(`${EFF_CUSTOMER} IN (${customers.map(() => '?').join(', ')})`);
    args.push(...customers);
  }
  const d = db();
  const rows = d.prepare(`SELECT c.id, c.recorded_at, c.title, c.transcript, c.segments, c.duration_sec, c.source, ${EFF_CUSTOMER} AS eff,
      k.car_model, k.plate, k.items, k.note, k.due, k.contact, k.model_year
    FROM calls c LEFT JOIN cards k ON k.call_id = c.id WHERE ${where.join(' AND ')}
    ORDER BY c.recorded_at DESC, c.id DESC LIMIT 2000`).all(...args);

  const lower = terms.map((t) => t.toLowerCase());
  const scored = rows.map((r) => {
    if (!lower.length) return { r, score: 0 };
    const tr = String(r.transcript || '').toLowerCase();
    const cardText = [r.eff, r.car_model, r.plate, r.note, r.due, r.contact, r.model_year, itemsText(parseJson(r.items, []))].filter(Boolean).join(' ').toLowerCase();
    const title = String(r.title || '').toLowerCase();
    let distinct = 0;
    let occ = 0;
    for (const t of lower) {
      const n = Math.min(5, tr.split(t).length - 1);
      const inCard = cardText.includes(t);
      const inTitle = title.includes(t);
      if (n || inCard || inTitle) distinct += 1;
      occ += n + (inCard ? 3 : 0) + (inTitle ? 2 : 0);
    }
    return { r, score: distinct * 10 + occ };
  });
  let top = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score || (a.r.recorded_at < b.r.recorded_at ? 1 : -1));
  // 낱말로 못 찾았어도 거래처 · 날짜로 좁혔으면 그 안의 최근 통화를 본다
  if (!top.length && (range || customers.length)) top = scored;
  top = top.slice(0, 8).map((x) => x.r);

  const num = new Map();
  const refOf = (id) => { if (!num.has(id)) num.set(id, num.size + 1); return `c${num.get(id)}`; };
  const contexts = [];
  for (const r of top) {
    const room = Math.min(SEG_PER_CALL, MAX_SEGMENTS - contexts.length);
    if (room <= 0) break;
    const ref = refOf(r.id);
    const title = r.title || makeTitle({ customer: r.eff, items: parseJson(r.items, []), recordedAt: r.recorded_at, durationSec: r.duration_sec, source: r.source });
    const segs = parseJson(r.segments, []);
    if (Array.isArray(segs) && segs.length) {
      for (const i of pickSegments(segs, terms0, room)) {
        const text = cleanText(segs[i]?.text, 400);
        if (!text) continue;
        const at = Number.isFinite(Number(segs[i]?.start)) ? Number(segs[i].start) : null;
        contexts.push({ kind: 'segment', ref: `${ref}#${i}`, callId: r.id, segIndex: i, at, text, title, recordedAt: r.recorded_at, customer: r.eff ?? null });
      }
    } else if (r.transcript) {
      String(r.transcript).split(/(?<=[.?!。])\s+|\n+/).map((x) => cleanText(x, 400)).filter(Boolean).slice(0, room).forEach((text, i) => {
        contexts.push({ kind: 'segment', ref: `${ref}#t${i}`, callId: r.id, segIndex: null, at: null, text, title, recordedAt: r.recorded_at, customer: r.eff ?? null });
      });
    }
  }

  // 카드 한 줄 요약: 날짜 범위(없으면 최근 14일) 안 모든 카드, 물은 거래처 것을 먼저
  const cFrom = range ? range.from : addDays(today, -13);
  const cTo = range ? range.to : today;
  const cardRows = d.prepare(`SELECT c.id AS cid, c.recorded_at AS rat, c.title AS ctitle, c.duration_sec AS dur, c.source AS src, ${EFF_CUSTOMER} AS eff, k.*
    FROM cards k JOIN calls c ON c.id = k.call_id
    WHERE c.recorded_at >= ? AND c.recorded_at < ? ORDER BY c.recorded_at DESC, c.id DESC LIMIT 2000`).all(kstDayRange(cFrom)[0], kstDayRange(cTo)[1]);
  const mine = (r) => (customers.length && customers.includes(r.eff) ? 0 : 1);
  const lineRoom = Math.min(MAX_CARD_LINES, MAX_CONTEXTS - contexts.length);
  const lineRows = cardRows.map((r, i) => ({ r, i })).sort((a, b) => mine(a.r) - mine(b.r) || a.i - b.i).slice(0, lineRoom).map((x) => x.r);
  for (const r of lineRows) {
    const card = viewCard(r);
    const ref = refOf(r.cid);
    const text = [
      `${shortDate(r.rat)} ${kstTime(r.rat)}`,
      r.eff || '거래처 확인 필요',
      card.callType && card.callType !== '주문' ? card.callType : null,
      [card.carModel, card.modelYear ? `${card.modelYear}년` : null].filter(Boolean).join(' ') || '차종 없음',
      itemsText(card.items) || '부품 없음',
      card.statusLabel,
      card.urgent ? '급함' : null,
    ].filter(Boolean).join(' · ');
    const title = r.ctitle || makeTitle({ customer: r.eff, items: card.items, recordedAt: r.rat, durationSec: r.dur, source: r.src });
    contexts.push({ kind: 'card', ref, callId: r.cid, segIndex: null, at: null, text, title, recordedAt: r.rat, customer: r.eff ?? null });
  }

  return {
    contexts,
    scope: {
      customers,
      from: range?.from ?? null,
      to: range?.to ?? null,
      label: range?.label ?? null,
      terms: terms0,
      calls: top.length,
      cardLines: lineRows.length,
    },
  };
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant'))
    .map((h) => ({ role: h.role, text: cleanText(h.text, 1000) }))
    .filter((h) => h.text)
    .slice(-6);
}

/** AI citations({ref, quote} 또는 {callId, segIndex}) → 화면용. 보낸 적 없는 ref 는 버린다. */
export function mapCitations(raw, contexts) {
  const byRef = new Map(contexts.map((c) => [c.ref, c]));
  const out = [];
  const seen = new Set();
  for (const cit of Array.isArray(raw) ? raw : []) {
    let ctx = null;
    const ref = String(cit?.ref ?? '').replace(/[[\]\s]/g, '');
    if (ref) ctx = byRef.get(ref) ?? null;
    if (!ctx && cit?.callId) {
      ctx = contexts.find((c) => c.callId === cit.callId && (cit.segIndex == null ? c.kind === 'card' : c.segIndex === Number(cit.segIndex))) ?? null;
    }
    if (!ctx || seen.has(ctx.ref)) continue;
    seen.add(ctx.ref);
    const q = typeof cit?.quote === 'string' ? cit.quote.trim() : '';
    out.push({
      callId: ctx.callId,
      title: ctx.title,
      customer: ctx.customer ?? null,
      recordedAt: ctx.recordedAt,
      segIndex: ctx.segIndex ?? null,
      at: ctx.at ?? null,
      quote: q && ctx.text.includes(q) ? q : ctx.text,
    });
    if (out.length >= 8) break;
  }
  return out;
}

async function ask(body, ip) {
  const raw = typeof body.question === 'string' ? body.question : '';
  if (raw.trim().length > 300) throw new HttpError(400, 'too_long', '질문은 300자 안으로 써 주세요.');
  const question = cleanText(raw, 300);
  if (!question) throw new HttpError(400, 'empty_question', '물어볼 말을 써 주세요.');
  const history = cleanHistory(body.history);
  const ai = await requireAi('answerQuestion');
  limit('ai', ip);

  const { contexts, scope } = buildAskContexts(question, history);
  if (!contexts.length) return { answer: NOT_FOUND, found: false, citations: [], scope };

  takeDaily('ai', config.dailyAiLimit);
  let out;
  try {
    out = await ai.answerQuestion({ question, history, contexts, today: kstDay(), scope });
  } catch (e) { throw aiHttpError(e); }
  const citations = mapCitations(out?.citations, contexts);
  const answer = cleanText(out?.answer, 2000);
  if (!out?.found || !citations.length) {
    return { answer: out && out.found === false && answer ? answer : NOT_FOUND, found: false, citations: [], scope };
  }
  return { answer: answer || NOT_FOUND, found: true, citations, scope };
}

// ── 출고 목록 ────────────────────────────────────────────────────

const NO_CUSTOMER = '거래처 확인 필요';

function loadShipping(day, scope) {
  const sel = `SELECT k.*, c.recorded_at AS rat, c.title AS ctitle, c.duration_sec AS dur, c.source AS src, ${EFF_CUSTOMER} AS eff
    FROM cards k JOIN calls c ON c.id = k.call_id`;
  if (scope === 'today') {
    const [from, to] = kstDayRange(day);
    return db().prepare(`${sel} WHERE k.status IN ('confirmed', 'shipped') AND k.confirmed_at >= ? AND k.confirmed_at < ?`).all(from, to);
  }
  return db().prepare(`${sel} WHERE k.status = 'confirmed'`).all();
}

export function buildShipping(day, scope) {
  const rows = loadShipping(day, scope);
  const groups = new Map();
  for (const r of rows) {
    const card = viewCard(r);
    const customer = r.eff || NO_CUSTOMER;
    const item = {
      callId: r.call_id,
      title: r.ctitle || makeTitle({ customer: r.eff, items: card.items, recordedAt: r.rat, durationSec: r.dur, source: r.src }),
      status: card.status, statusLabel: card.statusLabel,
      items: card.items,
      carModel: card.carModel, modelYear: card.modelYear, plate: card.plate,
      due: card.due, delivery: card.delivery, urgent: card.urgent,
      note: card.note,
      confirmedAt: card.confirmedAt, shippedAt: card.shippedAt, recordedAt: r.rat,
    };
    if (!groups.has(customer)) groups.set(customer, []);
    groups.get(customer).push(item);
  }
  const list = [...groups.entries()].map(([customer, cards]) => ({
    customer,
    urgentCount: cards.filter((c) => c.urgent).length,
    cards: cards.sort((a, b) => Number(b.urgent) - Number(a.urgent) || (a.recordedAt < b.recordedAt ? -1 : 1)),
  }));
  list.sort((a, b) => {
    if (a.customer === NO_CUSTOMER) return 1;
    if (b.customer === NO_CUSTOMER) return -1;
    return a.customer.localeCompare(b.customer, 'ko');
  });
  return { day, scope, total: rows.length, groups: list };
}

/** CSV 한 칸: 수식으로 읽히는 첫 글자(= + - @ 탭 CR)는 ' 를 붙이고, 늘 따옴표로 감싼다 */
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

const CSV_HEAD = ['거래처', '통화 시각(KST)', '차종', '연식', '차번호', '부품', '위치', '수량', '품번', '원하는 때', '받는 방법', '급함', '상태'];

export function buildShippingCsv(day, scope) {
  const { groups } = buildShipping(day, scope);
  const lines = [CSV_HEAD.map(csvCell).join(',')];
  for (const g of groups) {
    for (const c of g.cards) {
      const base = [g.customer, kstDateTime(c.recordedAt), c.carModel, c.modelYear, c.plate];
      const tail = [c.due, c.delivery, c.urgent ? '급함' : '', CARD_STATUS_LABEL[c.status] || c.status];
      const items = Array.isArray(c.items) && c.items.length ? c.items : [{}];
      for (const i of items) {
        lines.push([...base, i?.part, i?.side, i?.qty, i?.partNo ?? i?.part_no, ...tail].map(csvCell).join(','));
      }
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function parseScope(v) {
  const s = cleanText(v, 10) || 'all';
  if (s !== 'all' && s !== 'today') throw new HttpError(400, 'bad_scope', 'scope 는 today 나 all 입니다.');
  return s;
}

// ── 주소 달기 ─────────────────────────────────────────────────────

export function register(router) {
  router.get('/api/dashboard', ({ query }) => buildDashboard(parseDay(query.day)));

  router.get('/api/briefing', ({ query }) => ({ briefing: getBriefing(parseDay(query.day)) }));
  router.post('/api/briefing', async ({ req, ip }) => {
    const body = await readJson(req);
    return makeBriefing(parseDay(body.day), ip);
  });
  router.get('/api/briefing/text', ({ query }) => ({ text: buildBriefingText(parseDay(query.day)) }));

  router.post('/api/ask', async ({ req, ip }) => ask(await readJson(req), ip));

  router.get('/api/shipping', ({ query }) => buildShipping(parseDay(query.day), parseScope(query.scope)));
  router.get('/api/shipping.csv', ({ req, res, query }) => {
    const day = parseDay(query.day);
    const scope = parseScope(query.scope);
    const body = buildShippingCsv(day, scope);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="callnote-fake-shipping-${day}${scope === 'today' ? '-today' : ''}.csv"`,
      'Cache-Control': 'no-store',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return undefined;
  });
}
