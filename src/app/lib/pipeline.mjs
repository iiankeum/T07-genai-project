// 받아쓴 글 → 카드 추출 → 저장. 일꾼 결과(onTranscript) · 다시 정리(reextract) · 실시간 저장(processLive) 공통.
import { db, newId, nowIso } from './db.mjs';
import { config } from './config.mjs';
import { HttpError, cleanText } from './http.mjs';
import { takeDaily, ipHash } from './security.mjs';
import { getCallRow, getCardRow, cardView, makeTitle, dictionaryForAi } from './repo.mjs';
import { aiEnabled, extractCard, AiError, aiHttpError } from './ai.mjs';
import { buildCardFromAi, emptyCardValues, saveCard, normalizeSegments } from './cards.mjs';

const NO_KEY = 'AI 키 없음';

function setStatus(callId, status, error = null) {
  db().prepare('UPDATE calls SET status = ?, error = ? WHERE id = ?').run(status, error, callId);
}

function aiInput(call) {
  const dict = dictionaryForAi();
  return {
    transcript: call.transcript || '',
    segments: normalizeSegments(call.segments),
    glossary: dict.glossary,
    customers: dict.customers.map((c) => c.name),
    carModels: dict.carModels,
  };
}

/** 오류 → 카드에 남길 한국어 이유(비밀값 · 경로 없음) */
function errorText(e) {
  if (e instanceof AiError) return e.message;
  if (e instanceof HttpError) return e.publicMessage || e.code;
  return 'AI 카드 정리에 실패했습니다';
}

/**
 * 저장된 통화 글로 카드를 만들어 저장하고 status='ready' 로. 절대 throw 하지 않는다.
 * countDaily: 하루 AI 상한을 여기서 센다(라우트가 이미 셌으면 false).
 */
async function extractAndSave(callId, { countDaily = true, keepStatus = false } = {}) {
  const call = getCallRow(callId);
  if (!call) return null;
  let values;
  try {
    if (!String(call.transcript || '').trim()) {
      values = emptyCardValues(call, '받아쓴 글이 비어 있습니다');
    } else if (!aiEnabled()) {
      values = emptyCardValues(call, NO_KEY);
    } else {
      if (countDaily) takeDaily('ai', config.dailyAiLimit);
      const out = await extractCard(aiInput(call));
      values = buildCardFromAi(getCallRow(callId) || call, out);
    }
  } catch (e) {
    if (!(e instanceof AiError) && !(e instanceof HttpError)) console.error(`[pipeline] 카드 정리 실패 ${callId}:`, e?.message || e);
    values = emptyCardValues(call, errorText(e));
  }
  try {
    if (!getCallRow(callId)) return null; // 그사이 지워짐
    saveCard(callId, values, { keepStatus });
    setStatus(callId, 'ready');
  } catch (e) {
    console.error(`[pipeline] 카드 저장 실패 ${callId}:`, e?.message || e);
    try { setStatus(callId, 'failed', '주문 카드를 저장하지 못했습니다'); } catch { /* 무시 */ }
  }
  return cardView(getCardRow(callId));
}

/**
 * 일꾼이 받아쓴 결과를 저장하고 카드까지 만든다. 끝까지 throw 하지 않는다.
 * @param {string} callId
 * @param {{text:string, segments:any[], engine?:string, durationSec?:number, elapsedSec?:number}} result
 */
export async function onTranscript(callId, { text, segments, engine, durationSec, elapsedSec } = {}) {
  try {
    if (!getCallRow(callId)) return null;
    const segs = normalizeSegments(segments);
    const transcript = String(text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 20_000)
      || segs.map((s) => s.text).join(' ');
    const dur = Number(durationSec);
    const el = Number(elapsedSec);
    db().prepare(`UPDATE calls SET transcript = ?, segments = ?, engine = COALESCE(?, engine),
      duration_sec = COALESCE(?, duration_sec), stt_elapsed_sec = ?, status = 'extracting', error = NULL WHERE id = ?`)
      .run(transcript, JSON.stringify(segs), cleanText(engine, 100), Number.isFinite(dur) && dur >= 0 ? dur : null,
        Number.isFinite(el) && el >= 0 ? el : null, callId);
    return await extractAndSave(callId, { countDaily: true });
  } catch (e) {
    console.error(`[pipeline] onTranscript 실패 ${callId}:`, e?.message || e);
    try { setStatus(callId, 'failed', '받아쓴 글을 저장하지 못했습니다'); } catch { /* 무시 */ }
    return null;
  }
}

/**
 * 「다시 정리」: 지금 사전으로 카드를 새로 만든다. 실패하면 HttpError 를 던지고 원래 카드는 그대로 둔다.
 * @param {string} callId
 * @param {{beforeAi?: () => void}} [opts] AI 를 부르기 직전에 할 일(하루 상한 세기 등)
 * @returns {Promise<object>} cardView
 */
export async function reextract(callId, { beforeAi } = {}) {
  const call = getCallRow(callId);
  if (!call) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
  if (call.status === 'queued' || call.status === 'transcribing') {
    throw new HttpError(409, 'not_ready', '아직 받아쓰는 중입니다. 다 된 뒤에 다시 정리해 주세요.');
  }
  if (!String(call.transcript || '').trim()) throw new HttpError(409, 'no_transcript', '받아쓴 글이 없어 정리할 수 없습니다.');
  const card = getCardRow(callId);
  if (card && (card.status === 'confirmed' || card.status === 'shipped')) {
    throw new HttpError(409, 'locked', '확정(또는 출고)된 카드는 다시 정리할 수 없습니다. 먼저 「다시 열기」를 눌러 주세요.');
  }
  if (!aiEnabled()) throw aiHttpError(new AiError('no_key'));
  if (beforeAi) beforeAi();
  let out;
  try {
    out = await extractCard(aiInput(call));
  } catch (e) {
    throw aiHttpError(e);
  }
  const fresh = getCallRow(callId);
  if (!fresh) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
  const values = buildCardFromAi(fresh, out);
  // 사람이 고친 칸은 다시 정리해도 덮어쓰지 않는다(빈칸 · AI 초안 칸만 새 값). AI 초안(ai_draft)은 새 값으로.
  const prevRow = getCardRow(callId);
  if (prevRow) {
    const prev = cardView(prevRow);
    const COL = { callType: 'call_type', customer: 'customer', contact: 'contact', carModel: 'car_model', modelYear: 'model_year', plate: 'plate', items: 'items', urgent: 'urgent', due: 'due', delivery: 'delivery', askBack: 'ask_back', note: 'note' };
    for (const f of prev.edited || []) {
      if (COL[f]) values[COL[f]] = prev[f];
    }
    if ((prev.edited || []).includes('customer')) values.customer_by_phone = prev.customerByPhone;
  }
  saveCard(callId, values, { keepStatus: false });
  setStatus(callId, 'ready');
  return cardView(getCardRow(callId));
}

/**
 * 실시간 받아쓰기(브라우저)로 만든 통화를 저장하고 카드까지 만든 뒤 callId 를 돌려준다. 오디오는 없다.
 * @param {{text:string, segments?:any[], durationSec?:number, ip?:string}} input
 */
export async function processLive({ text, segments, durationSec, ip } = {}) {
  const segs = normalizeSegments(segments);
  const transcript = (cleanText(text, 20_000) || segs.map((s) => s.text).join(' ')).trim();
  if (!transcript) throw new HttpError(400, 'empty_text', '받아쓴 글이 없습니다.');
  const lastEnd = segs.length ? segs[segs.length - 1].end : null;
  const dur = durationSec != null && durationSec !== '' && Number.isFinite(Number(durationSec)) && Number(durationSec) >= 0
    ? Math.min(Number(durationSec), 3600) : lastEnd;
  const id = newId('call');
  const now = nowIso();
  db().prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title, transcript, segments, engine,
    duration_sec, is_fake, uploader) VALUES(?, ?, ?, 'live', 'extracting', ?, ?, ?, ?, ?, 1, ?)`)
    .run(id, now, now, makeTitle({ customer: null, items: [], recordedAt: now, durationSec: dur, source: 'live' }),
      transcript, JSON.stringify(segs), '브라우저 음성 인식(실시간 체험)', dur ?? null, ip ? ipHash(ip) : null);
  await extractAndSave(id, { countDaily: true });
  return id;
}

/** 서버가 다시 뜰 때 「카드 정리 중」에 멈춘 통화를 다시 정리한다(차례로). */
export async function resumeStuck() {
  const rows = db().prepare("SELECT id FROM calls WHERE status = 'extracting' ORDER BY created_at LIMIT 50").all();
  for (const r of rows) {
    await extractAndSave(r.id, { countDaily: true });
  }
  return rows.length;
}
