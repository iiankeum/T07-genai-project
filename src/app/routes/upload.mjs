// 화면용 녹음 올리기 POST /api/calls/upload (F01) · 내려받을 예시 녹음 GET /api/samples.
import fs from 'node:fs';
import { config } from '../lib/config.mjs';
import { db } from '../lib/db.mjs';
import { HttpError, readForm, sendJson, cleanText, withUploadSlot } from '../lib/http.mjs';
import { limit, checkDaily, addDaily, ipHash } from '../lib/security.mjs';
import { callView, getCallRow } from '../lib/repo.mjs';
import { audioFromForm, audioPath } from '../lib/audio.mjs';
import { acceptRecording, findCallBySha, retryIfFailed, normalizePhone, parseRecordedAt } from '../lib/jobs.mjs';

const MAX_SAMPLES = 6;

export function register(router) {
  // 차례: (본문 읽기 전) 크기 413 · 동시 2건 503 · 시도 한도 → 본문 읽기 · 확인 · 형식 → 중복 → 받아들임 한도 → 변환 → 하루 상한에 셈
  router.post('/api/calls/upload', ({ req, res, ip }) => withUploadSlot(req, async () => {
    limit('uploadTry', ip); // 넉넉한 시도 한도(실패도 셈): 본문 읽기 · 형식 검사를 지킨다
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
    limit('upload', ip); // 받아들일 녹음만 센다(형식이 틀렸거나 중복이면 세지 않음)
    checkDaily('upload', config.dailyUploadLimit);
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
    addDaily('upload'); // 변환 · 저장까지 끝난 것만 하루 상한에 센다
    sendJson(res, 201, { callId: out.callId, status: call?.status || 'queued', call });
    return undefined;
  }));

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
