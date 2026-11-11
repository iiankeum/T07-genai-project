// 시드(가짜 대본) 통화에 합성 음성을 붙인다 — 해결사 방이 만든 web/cNN.mp3 를 fx-cNN 통화에.
// 저장소에는 음성을 넣지 않으므로, 이 PC 에서 tools/attach-seed-audio.mjs 가 INGEST_TOKEN 으로 보낸다.
import { db } from '../lib/db.mjs';
import { HttpError, readForm, cleanText } from '../lib/http.mjs';
import { requireBearer } from '../lib/security.mjs';
import { config } from '../lib/config.mjs';
import { audioFromForm, convertToWav } from '../lib/audio.mjs';

export function register(router) {
  router.post('/api/admin/seed-audio', async ({ req }) => {
    requireBearer(req, 'INGEST_TOKEN');
    const form = await readForm(req, config.maxUploadBytes);
    const callId = cleanText(form.get('callId'), 80);
    if (!callId || !/^[A-Za-z0-9_-]{1,80}$/.test(callId)) throw new HttpError(400, 'bad_call_id', 'callId 가 잘못됐습니다.');
    const row = db().prepare('SELECT id, source FROM calls WHERE id = ?').get(callId);
    if (!row) throw new HttpError(404, 'not_found', '없는 통화입니다.');
    if (row.source !== 'seed') throw new HttpError(409, 'not_seed', '시드(가짜 대본) 통화에만 음성을 붙입니다.');
    const { buf } = await audioFromForm(form, 'file');
    const out = await convertToWav(buf, callId);
    db().prepare("UPDATE calls SET audio_file = ?, engine = '대본 + 합성 음성(가짜 통화)' WHERE id = ?").run(out.audioFile, callId);
    return { ok: true, callId, durationSec: out.durationSec };
  });
}
