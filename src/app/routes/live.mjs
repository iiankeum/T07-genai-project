// 실시간 받아쓰기 체험(F03): 말하는 중 카드 미리 보기(저장 안 함) · 끝난 통화 저장.
import { config } from '../lib/config.mjs';
import { HttpError, readJson, cleanText } from '../lib/http.mjs';
import { limit, takeDaily } from '../lib/security.mjs';
import { dictionaryForAi, getCallRow, callView } from '../lib/repo.mjs';
import { aiEnabled, extractCard, AiError } from '../lib/ai.mjs';
import { buildCardFromAi, previewCard, normalizeSegments } from '../lib/cards.mjs';
import { processLive } from '../lib/pipeline.mjs';

const MAX_EXTRACT_CHARS = 4000;   // AI 에 보내는 길이
const MAX_EXTRACT_INPUT = 20_000; // 받는 길이(넘으면 413)
const MAX_SAVE_CHARS = 20_000;
const MAX_SEGMENTS = 2000;

/** 긴 글은 앞(거래처 · 차를 밝히는 첫머리)과 뒤(최근 말)만 남겨 4000자로 */
function clipForAi(text) {
  if (text.length <= MAX_EXTRACT_CHARS) return text;
  const head = 800;
  return `${text.slice(0, head)}\n…(가운데 줄임)…\n${text.slice(-(MAX_EXTRACT_CHARS - head - 20))}`;
}

function readText(v, max) {
  if (v != null && typeof v !== 'string') throw new HttpError(400, 'bad_text', '글 형식이 잘못됐습니다.');
  const s = String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!s) throw new HttpError(400, 'empty_text', '받아쓴 글이 없습니다. 마이크에 대고 말해 주세요.');
  if (s.length > max) throw new HttpError(413, 'too_long', `글이 너무 깁니다(최대 ${max.toLocaleString('ko-KR')}자).`);
  return s;
}

export function register(router) {
  // 말하는 중 카드 미리 보기 — 저장하지 않는다
  router.post('/api/live/extract', async ({ req, ip }) => {
    const body = await readJson(req, 128 * 1024);
    const text = clipForAi(readText(body.text, MAX_EXTRACT_INPUT));
    if (!aiEnabled()) return { card: null, aiError: 'AI 키 없음' };
    limit('ai', ip);
    takeDaily('ai', config.dailyAiLimit);
    const dict = dictionaryForAi();
    try {
      const out = await extractCard({
        transcript: text,
        segments: [],
        glossary: dict.glossary,
        customers: dict.customers.map((c) => c.name),
        carModels: dict.carModels,
      }, { timeoutMs: 45_000, maxRetries: 1 });
      const values = buildCardFromAi({ transcript: text, segments: '[]', caller_number: null }, out);
      return { card: previewCard(values) };
    } catch (e) {
      if (e instanceof AiError) return { card: null, aiError: e.message };
      throw e;
    }
  });

  // 끝난 실시간 통화 저장 → 카드까지 만든다
  router.post('/api/live/save', async ({ req, ip }) => {
    const body = await readJson(req, 512 * 1024);
    const text = readText(body.text, MAX_SAVE_CHARS);
    if (body.segments != null && !Array.isArray(body.segments)) throw new HttpError(400, 'bad_segments', '문장 목록 형식이 잘못됐습니다.');
    if (Array.isArray(body.segments) && body.segments.length > MAX_SEGMENTS) {
      throw new HttpError(413, 'too_many_segments', `문장이 너무 많습니다(최대 ${MAX_SEGMENTS}개).`);
    }
    const segments = normalizeSegments(body.segments || []);
    let durationSec = null;
    if (body.durationSec != null) {
      const d = Number(body.durationSec);
      if (!Number.isFinite(d) || d < 0 || d > 3600) throw new HttpError(400, 'bad_duration', '통화 길이가 잘못됐습니다.');
      durationSec = d;
    }
    limit('live', ip);
    const callId = await processLive({ text: cleanText(text, MAX_SAVE_CHARS), segments, durationSec, ip });
    return { callId, call: callView(getCallRow(callId), { withDetail: true }) };
  });
}
