// 화면용 녹음 올리기 POST /api/calls/upload (F01) · 내려받을 예시 녹음 GET /api/samples.
import fs from 'node:fs';
import { config } from '../lib/config.mjs';
import { db } from '../lib/db.mjs';
import { HttpError, readForm, sendJson, cleanText } from '../lib/http.mjs';
import { limit, takeDaily, ipHash } from '../lib/security.mjs';
import { callView, getCallRow } from '../lib/repo.mjs';
import { audioFromForm, audioPath } from '../lib/audio.mjs';
import { acceptRecording, findCallBySha, retryIfFailed, normalizePhone, parseRecordedAt } from '../lib/jobs.mjs';

const MAX_SAMPLES = 6;

export function register(router) {
  router.post('/api/calls/upload', async ({ req, res, ip }) => {
    limit('upload', ip);
    const form = await readForm(req, config.maxUploadBytes);
    if (String(form.get('fakeConfirm') ?? '').trim().toLowerCase() !== 'yes') {
      throw new HttpError(400, 'fake_confirm_required', '가짜(연습) 녹음만 올린다는 확인에 체크해 주세요');
    }
    const file = await audioFromForm(form);

    const dup = findCallBySha(file.sha256);
    if (dup) {
      const r = retryIfFailed(dup);
      return { callId: r.callId, status: 'duplicate', call: callView(getCallRow(r.callId)) };
    }
    takeDaily('upload', config.dailyUploadLimit);
    const out = await acceptRecording({
      buf: file.buf,
      source: 'upload',
      recordedAt: parseRecordedAt(form.get('recordedAt')), // 틀렸거나 없으면 지금
      callerNumber: normalizePhone(cleanText(form.get('callerNumber'), 40)),
      deviceName: null,
      originalName: file.name,
      uploader: ipHash(ip),
      isFake: true,
    });
    const call = callView(getCallRow(out.callId));
    if (out.duplicate) return { callId: out.callId, status: 'duplicate', call };
    sendJson(res, 201, { callId: out.callId, status: call?.status || 'queued', call });
    return undefined;
  });

  // 예시 녹음: 가짜 통화 중 녹음이 있는 것(ingest · seed). 오디오는 /api/calls/:id/audio(routes/calls.mjs)가 준다.
  router.get('/api/samples', () => {
    const rows = db().prepare(`SELECT id, title, duration_sec, audio_file FROM calls
      WHERE audio_file IS NOT NULL AND is_fake = 1 AND source IN ('ingest', 'seed')
      ORDER BY recorded_at DESC LIMIT 30`).all();
    const samples = [];
    for (const r of rows) {
      try { if (!fs.statSync(audioPath(r.audio_file)).isFile()) continue; } catch { continue; }
      samples.push({
        callId: r.id,
        title: r.title,
        durationSec: r.duration_sec ?? null,
        url: `/api/calls/${encodeURIComponent(r.id)}/audio?download=1`,
      });
      if (samples.length >= MAX_SAMPLES) break;
    }
    return { samples };
  });
}
