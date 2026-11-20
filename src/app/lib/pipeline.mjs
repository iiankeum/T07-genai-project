// 받아쓴 글 → 카드 추출 → 저장. 일꾼 결과(onTranscript) · 다시 정리(reextract) · 실시간 저장(processLive) 공통.
import { db, newId, nowIso, parseJson, tx, workspaceContext, defaultWorkspaceId } from './db.mjs';
import { HttpError, cleanText } from './http.mjs';
import { ipHash } from './security.mjs';
import { getCallRow, getCardRow, cardView, makeTitle, dictionaryForAi } from './repo.mjs';
import { aiEnabled, extractCard, AiError, aiHttpError, takeAiDaily } from './ai.mjs';
import { buildCardFromAi, emptyCardValues, saveCard, normalizeSegments } from './cards.mjs';

import { domainFor, extractionDomain } from '../public/js/domain.js';
import { recordAudit } from './auth.mjs';

const AI_DISABLED = '자동 정리가 꺼져 있습니다.';

function setStatus(callId, status, error = null) {
  db().prepare('UPDATE calls SET status = ?, error = ? WHERE id = ?').run(status, error, callId);
}

function aiInput(call) {
  const version = domainFor(getCardRow(call?.id)?.domain_version || process.env.AHMATDA_DOMAIN).id;
  const dict = dictionaryForAi(version);
  return {
    transcript: call.transcript || '',
    segments: normalizeSegments(call.segments),
    glossary: dict.glossary,
    customers: dict.customers.map((c) => c.name),
    carModels: dict.carModels,
    domain: extractionDomain(version),
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
      values = emptyCardValues(call, AI_DISABLED);
    } else {
      if (countDaily) takeAiDaily();
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
const runningReextract = new Set();

export async function reextract(callId, opts = {}) {
  const key = JSON.stringify([workspaceContext()?.workspace.id ?? defaultWorkspaceId(), callId]);
  if (runningReextract.has(key)) throw new HttpError(409, 'not_ready', '이미 AI가 초안을 정리하고 있습니다.');
  runningReextract.add(key);
  try { return await runReextract(callId, opts); }
  finally { runningReextract.delete(key); }
}

async function runReextract(callId, { beforeAi } = {}) {
  const call = getCallRow(callId);
  if (!call) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
  if (['queued', 'transcribing', 'extracting'].includes(call.status)) {
    throw new HttpError(409, 'not_ready', '아직 통화를 처리하고 있습니다. 완료된 뒤 다시 정리해 주세요.');
  }
  if (!String(call.transcript || '').trim()) throw new HttpError(409, 'no_transcript', '받아쓴 글이 없어 정리할 수 없습니다.');
  const card = getCardRow(callId);
  if (card && card.status !== 'draft') throw new HttpError(409, 'locked', '확인 필요 상태의 카드만 다시 정리할 수 있습니다.');
  if (!aiEnabled()) throw aiHttpError(new AiError('no_key'));
  if (beforeAi) beforeAi();
  let out;
  try {
    out = await extractCard(aiInput(call));
  } catch (e) {
    throw aiHttpError(e);
  }
  return tx(() => {
    const fresh = getCallRow(callId);
    if (!fresh) throw new HttpError(404, 'not_found', '통화를 찾지 못했습니다.');
    const prevRow = getCardRow(callId);
    if (prevRow && prevRow.status !== 'draft') {
      throw new HttpError(409, 'locked', '다시 정리하는 동안 카드 상태가 바뀌었습니다.');
    }
    const values = buildCardFromAi(fresh, out);
    const prev = cardView(prevRow);
    if (prev) {
      const cols = {
        callType: 'call_type', customer: 'customer', contact: 'contact', carModel: 'car_model',
        modelYear: 'model_year', plate: 'plate', items: 'items', urgent: 'urgent', due: 'due',
        delivery: 'delivery', askBack: 'ask_back', note: 'note',
      };
      const preserved = new Set([...prev.edited, ...Object.keys(prev.fieldReviews).map((key) => key.startsWith('item:') ? 'items' : key)]);
      for (const field of preserved) {
        if (cols[field]) values[cols[field]] = prev[field];
        if (prev.evidence[field]) values.evidence[field] = prev.evidence[field];
      }
      const preservedWarning = (warning) => preserved.has(Number.isInteger(warning.item) ? 'items' : warning.field || 'other');
      values.unsure = values.unsure.filter((warning) => !preservedWarning(warning))
        .concat(parseJson(prevRow.unsure, []).filter((warning) => warning && preservedWarning(warning)));
      if (preserved.has('customer')) values.customer_by_phone = prev.customerByPhone;
      values.field_reviews = prev.fieldReviews;
    }
    const after = saveCard(callId, values);
    setStatus(callId, 'ready');
    recordAudit({ entity: 'card', entityId: callId, action: 'reextract', before: prev, after });
    return after;
  });
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
