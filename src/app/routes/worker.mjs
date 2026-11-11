// 받아쓰기 일꾼 API v1 (docs/worker-api.md) · 녹음 넣기 POST /api/ingest · 공개 GET /api/worker/status.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from '../lib/config.mjs';
import { db, nowIso } from '../lib/db.mjs';
import { HttpError, readJson, readForm, sendJson, sendEmpty, cleanText, withUploadSlot } from '../lib/http.mjs';
import { requireBearer, rateLimit, checkDaily, addDaily, ipHash } from '../lib/security.mjs';
import { dictionaryForAi } from '../lib/repo.mjs';
import { audioPath, audioFromForm, cleanTmp, cleanOrphanAudio, ffmpegAvailable } from '../lib/audio.mjs';
import {
  claim, complete, fail, getJob, isLeasedBy, queueStats, sweepExpired,
  acceptRecording, findCallBySha, retryIfFailed, normalizePhone, parseRecordedAt,
} from '../lib/jobs.mjs';
import { workerStatus } from './system.mjs';

const WORKER_RE = /^[A-Za-z0-9_-]{1,40}$/;
const RESULT_BODY_LIMIT = 4 * 1024 * 1024;
const MAX_TEXT = 20_000;
const MAX_SEGMENTS = 2_000;
const MAX_SEG_TEXT = 1_000;
const INGEST_RATE = { max: 300, windowMs: 10 * 60_000 }; // 토큰이 있는 PC 프로그램이라 넉넉히
const INGEST_DAILY = 1000;

function workerName(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!WORKER_RE.test(s)) throw new HttpError(400, 'bad_worker', 'worker 이름은 영문 · 숫자 · - · _ 40자 이하로 보내 주세요.');
  return s;
}

/** 일꾼 신호 남기기(heartbeat · claim). 값이 없으면 전에 받은 값을 둔다. */
function touchWorker(name, info = {}) {
  db().prepare(`INSERT INTO workers(name, engine, gpu, version, last_seen) VALUES(?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET engine = COALESCE(excluded.engine, workers.engine), gpu = COALESCE(excluded.gpu, workers.gpu),
      version = COALESCE(excluded.version, workers.version), last_seen = excluded.last_seen`)
    .run(name, cleanText(info.engine, 100), cleanText(info.gpu, 100), cleanText(info.version, 40), nowIso());
}

/** 바깥에서 볼 주소 기준: PUBLIC_BASE_URL, 없으면 요청 Host */
function baseUrl(req) {
  if (config.publicBaseUrl) return config.publicBaseUrl;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || `127.0.0.1:${config.port}`).split(',')[0].trim();
  return `${proto === 'https' ? 'https' : 'http'}://${host}`;
}

// WAV 의 SHA-256 (claim 응답용, 파일이 그대로면 다시 계산하지 않는다)
const wavShaCache = new Map();
function wavSha(abs, st) {
  const key = `${abs}:${st.size}:${st.mtimeMs}`;
  let v = wavShaCache.get(key);
  if (!v) {
    v = createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    if (wavShaCache.size > 50) wavShaCache.clear();
    wavShaCache.set(key, v);
  }
  return v;
}

// ── 카드 정리 넘기기(lib/pipeline.mjs [B]). 시험에서는 setTranscriptHandler 로 바꿔 끼운다 ──
let transcriptHandler = null;
export function setTranscriptHandler(fn) { transcriptHandler = typeof fn === 'function' ? fn : null; }

/** 파이프라인이 없을 때 받아쓴 글만이라도 남긴다 */
function saveTranscriptOnly(callId, p) {
  db().prepare(`UPDATE calls SET transcript = COALESCE(transcript, ?), segments = CASE WHEN segments IS NULL OR segments = '[]' THEN ? ELSE segments END,
      engine = COALESCE(engine, ?), stt_elapsed_sec = COALESCE(stt_elapsed_sec, ?) WHERE id = ?`)
    .run(p.text, JSON.stringify(p.segments), p.engine, p.elapsedSec, callId);
}

/** 기다리지 않고 카드 정리를 시작한다. 무슨 일이 있어도 throw 하지 않는다. */
export function startExtraction(callId, payload) {
  (async () => {
    let onTranscript = transcriptHandler;
    if (!onTranscript) {
      try {
        const mod = await import('../lib/pipeline.mjs');
        if (typeof mod.onTranscript !== 'function') throw new Error('onTranscript 가 없음');
        onTranscript = mod.onTranscript;
      } catch (e) {
        try { saveTranscriptOnly(callId, payload); } catch { /* DB 문제는 넘어감 */ }
        console.warn(`[worker] 카드 정리 모듈(lib/pipeline.mjs)을 불러오지 못해 받아쓴 글만 저장했습니다(${callId}): ${e?.code || e?.message || e}`);
        return;
      }
    }
    try {
      await onTranscript(callId, payload);
    } catch (e) {
      console.error(`[worker] 카드 정리 중 오류(${callId}):`, e?.message || e);
      try {
        saveTranscriptOnly(callId, payload);
        db().prepare("UPDATE calls SET status = 'failed', error = ? WHERE id = ? AND status IN ('extracting', 'transcribing')")
          .run('받아쓴 글로 주문 카드를 만들지 못했습니다. 「다시 정리」를 눌러 주세요.', callId);
      } catch { /* 넘어감 */ }
    }
  })().catch(() => {});
}

// ── 결과 검사 ────────────────────────────────────────────────────
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 1000) / 1000 : null);

function parseResult(body) {
  const text = body.text == null ? '' : body.text;
  if (typeof text !== 'string') throw new HttpError(400, 'bad_text', 'text 는 글자로 보내 주세요.');
  if (text.length > MAX_TEXT) throw new HttpError(413, 'too_large', `text 는 ${MAX_TEXT}자까지입니다.`);
  const raw = body.segments == null ? [] : body.segments;
  if (!Array.isArray(raw)) throw new HttpError(400, 'bad_segments', 'segments 는 배열로 보내 주세요.');
  if (raw.length > MAX_SEGMENTS) throw new HttpError(413, 'too_large', `segments 는 ${MAX_SEGMENTS}개까지입니다.`);
  const segments = raw.map((s, i) => {
    if (!s || typeof s !== 'object') throw new HttpError(400, 'bad_segments', `segments[${i}] 모양이 잘못됐습니다.`);
    if (typeof s.text !== 'string') throw new HttpError(400, 'bad_segments', `segments[${i}].text 가 없습니다.`);
    if (s.text.length > MAX_SEG_TEXT) throw new HttpError(413, 'too_large', `한 문장은 ${MAX_SEG_TEXT}자까지입니다.`);
    const start = num(s.start);
    const end = num(s.end);
    if (start == null || end == null) throw new HttpError(400, 'bad_segments', `segments[${i}] 의 start · end 는 0 이상 숫자로 보내 주세요.`);
    const seg = { start, end: Math.max(start, end), text: s.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() };
    const speaker = cleanText(s.speaker, 20);
    if (speaker) seg.speaker = speaker;
    return seg;
  });
  return {
    text: text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim(),
    segments,
    engine: cleanText(body.engine, 100),
    durationSec: num(body.durationSec),
    elapsedSec: num(body.elapsedSec),
  };
}

function isTrue(v) {
  return ['true', '1', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase());
}

export function register(router) {
  router.get('/api/worker/status', () => workerStatus());

  router.post('/api/worker/heartbeat', async ({ req }) => {
    requireBearer(req, 'WORKER_TOKEN');
    const body = await readJson(req);
    const name = workerName(body.worker);
    touchWorker(name, body);
    return { ok: true, serverTime: nowIso(), queue: queueStats() };
  });

  router.post('/api/worker/claim', async ({ req, res }) => {
    requireBearer(req, 'WORKER_TOKEN');
    const body = await readJson(req);
    const name = workerName(body.worker);
    touchWorker(name);
    // 녹음 파일이 없어진 일감은 실패로 넘기고 다음 것을 본다
    for (let i = 0; i < 5; i += 1) {
      const job = claim(name);
      if (!job) break;
      const call = db().prepare('SELECT id, audio_file, duration_sec FROM calls WHERE id = ?').get(job.call_id);
      let abs = null;
      let st = null;
      try {
        abs = audioPath(call?.audio_file);
        st = fs.statSync(abs);
      } catch {
        fail(job.id, name, '녹음 파일이 서버에 없습니다', false);
        continue;
      }
      const dict = dictionaryForAi();
      return {
        jobId: job.id,
        callId: job.call_id,
        audioUrl: `${baseUrl(req)}/api/worker/jobs/${encodeURIComponent(job.id)}/audio?worker=${encodeURIComponent(name)}`,
        audioFormat: 'wav-16k-mono-s16le',
        audioBytes: st.size,
        audioSha256: wavSha(abs, st),
        durationSec: call.duration_sec ?? null,
        language: 'ko',
        initialPrompt: dict.initialPrompt,
        glossary: dict.glossary.map((g) => ({ term: g.term, standard: g.standard })),
        customers: dict.customers.map((c) => c.name),
        carModels: dict.carModels,
        leaseSec: config.jobLeaseSec,
        attempt: job.attempts,
      };
    }
    sendEmpty(res, 204);
    return undefined;
  });

  router.get('/api/worker/jobs/:jobId/audio', ({ req, res, params, query }) => {
    requireBearer(req, 'WORKER_TOKEN');
    // 일꾼 이름(?worker= 또는 X-Worker)은 꼭 있어야 한다 — 비우면 400(이름 검사를 건너뛰지 못하게)
    const who = workerName(query.worker || req.headers['x-worker']);
    const job = getJob(params.jobId);
    if (!job) throw new HttpError(404, 'not_found', '없는 일감입니다.');
    if (!isLeasedBy(job, who)) throw new HttpError(409, 'not_leased', '이 일꾼이 임대한 일감이 아닙니다.');
    const call = db().prepare('SELECT audio_file FROM calls WHERE id = ?').get(job.call_id);
    let abs;
    let st;
    try {
      abs = audioPath(call?.audio_file);
      st = fs.statSync(abs);
    } catch {
      throw new HttpError(404, 'no_audio', '녹음 파일이 없습니다.');
    }
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${job.call_id}.wav"`,
    });
    if (req.method === 'HEAD') { res.end(); return undefined; }
    const stream = fs.createReadStream(abs);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
    return undefined;
  });

  router.post('/api/worker/jobs/:jobId/result', async ({ req, params }) => {
    requireBearer(req, 'WORKER_TOKEN');
    const body = await readJson(req, RESULT_BODY_LIMIT);
    const name = workerName(body.worker);
    const payload = parseResult(body);
    const job = complete(params.jobId, name);
    if (!job) throw new HttpError(409, 'not_leased', '이미 끝났거나 다른 일꾼이 맡은 일감입니다.');
    touchWorker(name);
    startExtraction(job.call_id, payload);
    return { ok: true, callId: job.call_id, next: 'extracting' };
  });

  router.post('/api/worker/jobs/:jobId/fail', async ({ req, params }) => {
    requireBearer(req, 'WORKER_TOKEN');
    const body = await readJson(req);
    const name = workerName(body.worker);
    const retryable = body.retryable === undefined ? true : body.retryable === true;
    const r = fail(params.jobId, name, body.error, retryable);
    if (!r) throw new HttpError(409, 'not_leased', '이미 끝났거나 다른 일꾼이 맡은 일감입니다.');
    touchWorker(name);
    return { ok: true, callId: r.callId, state: r.state, attempts: r.attempts };
  });

  // 녹음 PC 프로그램 → 서버 (tools/folder-sender.mjs)
  router.post('/api/ingest', async ({ req, res, ip }) => {
    requireBearer(req, 'INGEST_TOKEN');
    // 화면 올리기와 같은 동시 처리 자리(최대 2건)를 쓴다 — 본문을 읽기 전에 크기 413 · 바쁨 503(보내기 프로그램은 다음 바퀴에 다시 보냄)
    return withUploadSlot(req, async () => {
      rateLimit('ingest', ip, INGEST_RATE.max, INGEST_RATE.windowMs);
      const form = await readForm(req, config.maxUploadBytes);
      if (config.demoMode && !isTrue(form.get('fake'))) {
        throw new HttpError(422, 'real_recording_not_accepted', '공개 데모는 가짜(연습) 녹음만 받습니다. fake=true 로 보내 주세요.');
      }
      const recordedAt = parseRecordedAt(form.get('recordedAt'));
      if (!recordedAt) throw new HttpError(400, 'bad_recorded_at', 'recordedAt 에 녹음 시각(ISO 8601)을 넣어 주세요.');
      const deviceName = cleanText(form.get('deviceName'), 40);
      if (!deviceName) throw new HttpError(400, 'bad_device_name', 'deviceName 에 보낸 PC 이름(40자 이하)을 넣어 주세요.');
      const file = await audioFromForm(form);

      const dup = findCallBySha(file.sha256);
      if (dup) {
        const r = retryIfFailed(dup);
        sendJson(res, 200, { callId: r.callId, status: 'duplicate', ...(r.requeued ? { jobId: r.jobId, requeued: true } : {}) });
        return undefined;
      }
      checkDaily('ingest', INGEST_DAILY);
      const out = await acceptRecording({
        buf: file.buf,
        source: 'ingest',
        recordedAt,
        callerNumber: normalizePhone(cleanText(form.get('callerNumber'), 40)),
        deviceName,
        title: cleanText(form.get('title'), 80),
        originalName: file.name,
        uploader: ipHash(ip),
        isFake: config.demoMode ? true : isTrue(form.get('fake')),
      });
      if (out.duplicate) {
        sendJson(res, 200, { callId: out.callId, status: 'duplicate' });
        return undefined;
      }
      addDaily('ingest'); // 변환 · 저장까지 끝난 것만 하루 상한에 센다
      sendJson(res, 201, { callId: out.callId, jobId: out.jobId, status: 'queued' });
      return undefined;
    });
  });
}

/**
 * DATA_DIR/audio 에서 어떤 통화 행도 가리키지 않는 *.wav 를 지운다(데모 초기화 · 행 삭제 뒤 남은 올린 녹음).
 * 시드 음성(fx-*.wav)은 행이 없어도 남긴다 — 시드를 다시 넣을 때 파일이 있으면 다시 붙는다.
 * @returns {number} 지운 파일 수
 */
export function sweepOrphanAudio(minAgeMs = 3600_000) {
  const used = new Set(db().prepare('SELECT DISTINCT audio_file FROM calls WHERE audio_file IS NOT NULL').all()
    .map((r) => path.resolve(config.dataDir, String(r.audio_file))));
  return cleanOrphanAudio((rel) => used.has(path.resolve(config.dataDir, rel)) || /^audio\/fx-[^/]*\.wav$/i.test(rel), minAgeMs);
}

export async function start() {
  const removed = cleanTmp();
  if (removed) console.log(`[audio] 남은 임시 파일 ${removed}개를 지웠습니다.`);
  // 하루 한 번(시작할 때 · 이후 24시간마다): 주인 없는 녹음 파일 지우기
  const sweepAudio = () => {
    try {
      const n = sweepOrphanAudio();
      if (n) console.log(`[audio] 어떤 통화도 가리키지 않는 녹음 파일 ${n}개를 지웠습니다.`);
    } catch (e) {
      console.error('[audio] 주인 없는 녹음 파일 정리 실패:', e?.message || e);
    }
  };
  sweepAudio();
  setInterval(sweepAudio, 24 * 3600_000).unref();
  ffmpegAvailable().then((ok) => {
    if (!ok) console.warn('[audio] ffmpeg 를 찾지 못했습니다. 16kHz mono WAV 만 받을 수 있습니다(FFMPEG_PATH 확인).');
  }).catch(() => {});
  const sweep = () => {
    try {
      const r = sweepExpired();
      if (r.requeued || r.failed) console.log(`[jobs] 임대 만료: 다시 줄 ${r.requeued} · 실패 ${r.failed}`);
    } catch (e) {
      console.error('[jobs] 임대 만료 처리 실패:', e?.message || e);
    }
  };
  sweep();
  setInterval(sweep, 30_000).unref();
}
