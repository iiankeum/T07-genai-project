// [A] 일꾼 · ingest 시험: heartbeat · claim · 오디오 받기 · result · fail · 임대 만료 · ffmpeg 없을 때 · 폴더 보내기(F12).
// 이 파일은 일부러 없는 ffmpeg 를 가리켜 「변환기 없음」 길을 시험한다. 실행: node --test test/worker.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const WORKER = 'test-worker-token-123';
const INGEST = 'test-ingest-token-456';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
process.env.WORKER_TOKEN = WORKER;
process.env.INGEST_TOKEN = INGEST;
process.env.FFMPEG_PATH = 'callnote-ffmpeg-missing-for-test';
delete process.env.PUBLIC_BASE_URL;
delete process.env.ANTHROPIC_API_KEY;

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { makeWav, startServer, sleep } = await import('./fixtures/worker-helpers.mjs');
const { db, nowIso } = await import('../lib/db.mjs');
const audio = await import('../lib/audio.mjs');
const jobs = await import('../lib/jobs.mjs');
const worker = await import('../routes/worker.mjs');
const sender = await import('../tools/folder-sender.mjs');

let srv;
let freq = 1000;
const uniqueWav = (sec = 1) => makeWav(sec, { freq: freq++ });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const calls = [];

before(async () => {
  srv = await startServer([worker]);
  worker.setTranscriptHandler(async (callId, payload) => { calls.push({ callId, payload }); });
});
after(async () => { await srv?.close(); });

async function api(method, p, body, token = WORKER) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(srv.base + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : res.status === 204 ? null : Buffer.from(await res.arrayBuffer());
  return { status: res.status, body: data, headers: res.headers };
}

async function ingest(buf, fields = {}, token = INGEST) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'audio/wav' }), fields.fileName || 'fake-call.wav');
  const all = { recordedAt: '2026-11-11T05:00:00.000Z', deviceName: 'test-pc', fake: 'true', ...fields };
  for (const [k, v] of Object.entries(all)) if (k !== 'fileName' && v != null) fd.append(k, v);
  const res = await fetch(`${srv.base}/api/ingest`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** 줄을 비운다(앞 시험의 일감이 다음 시험의 claim 에 끼지 않게) */
function drain() {
  db().prepare("UPDATE jobs SET state = 'done', finished_at = ? WHERE state IN ('queued', 'leased')").run(nowIso());
}
const jobRow = (id) => db().prepare('SELECT * FROM jobs WHERE id = ?').get(id);
const callRow = (id) => db().prepare('SELECT * FROM calls WHERE id = ?').get(id);

test('토큰: 없거나 틀리면 401, 일꾼 이름이 이상하면 400', async () => {
  assert.equal((await api('POST', '/api/worker/heartbeat', { worker: 'w1' }, null)).status, 401);
  assert.equal((await api('POST', '/api/worker/heartbeat', { worker: 'w1' }, 'wrong')).status, 401);
  assert.equal((await api('POST', '/api/worker/claim', { worker: 'w1' }, INGEST)).status, 401);
  const bad = await api('POST', '/api/worker/heartbeat', { worker: '이름 공백' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'bad_worker');
});

test('heartbeat → 상태가 켜짐으로, 줄이 비면 claim 은 204', async () => {
  let st = await api('GET', '/api/worker/status', undefined, null);
  assert.equal(st.status, 200);
  assert.equal(st.body.online, false);
  const hb = await api('POST', '/api/worker/heartbeat', { worker: 'gpu-pc-1', engine: 'faster-whisper large-v3', gpu: 'RTX 5060 Ti 16GB', version: '0.1.0' });
  assert.equal(hb.status, 200);
  assert.equal(hb.body.ok, true);
  assert.deepEqual(hb.body.queue, { waiting: 0, working: 0 });
  st = await api('GET', '/api/worker/status', undefined, null);
  assert.equal(st.body.online, true);
  assert.equal(st.body.worker, 'gpu-pc-1');
  assert.equal(st.body.engine, 'faster-whisper large-v3');
  assert.equal(JSON.stringify(st.body).includes(WORKER), false);
  // claim 은 engine 을 지우지 않는다
  const c = await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' });
  assert.equal(c.status, 204);
  assert.equal(db().prepare("SELECT engine FROM workers WHERE name = 'gpu-pc-1'").get().engine, 'faster-whisper large-v3');
});

test('ingest: 토큰 · 가짜 표시 · 필수 칸 · 오디오 아님 · 변환기 없음', async () => {
  assert.equal((await ingest(uniqueWav(), {}, null)).status, 401);
  assert.equal((await ingest(uniqueWav(), {}, WORKER)).status, 401);
  let r = await ingest(uniqueWav(), { fake: null });
  assert.equal(r.status, 422);
  assert.equal(r.body.error, 'real_recording_not_accepted');
  r = await ingest(uniqueWav(), { fake: 'false' });
  assert.equal(r.status, 422);
  r = await ingest(uniqueWav(), { recordedAt: null });
  assert.equal(r.status, 400);
  r = await ingest(uniqueWav(), { deviceName: null });
  assert.equal(r.status, 400);
  r = await ingest(Buffer.from('plain text file, not audio......'));
  assert.equal(r.status, 415);
  // ffmpeg 가 없으면 16k mono WAV 가 아닌 것은 503
  r = await ingest(makeWav(1, { rate: 8000, freq: 333 }));
  assert.equal(r.status, 503);
  assert.equal(r.body.error, 'converter_missing');
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM calls').get().n, 0);
  const tmpDir = path.join(process.env.DATA_DIR, 'tmp');
  assert.deepEqual(fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [], []);
});

test('ingest: 16k WAV → 201, 같은 파일은 200 duplicate, 번호로 거래처 채움', async () => {
  const now = nowIso();
  db().prepare("INSERT INTO glossary(id, kind, term, phone, status, source, created_at, updated_at) VALUES('g1', '거래처', '우리공업사', '010-5555-0002', 'approved', '기본', ?, ?)").run(now, now);
  const wav = uniqueWav(2);
  const r = await ingest(wav, { callerNumber: '010-5555-0002', recordedAt: '2026-11-11T14:42:00+09:00', title: '가짜 통화 1' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.callId, /^call_/);
  assert.match(r.body.jobId, /^job_/);
  assert.equal(r.body.status, 'queued');
  const row = callRow(r.body.callId);
  assert.equal(row.source, 'ingest');
  assert.equal(row.status, 'queued');
  assert.equal(row.customer, '우리공업사');
  assert.equal(row.caller_number, '01055550002');
  assert.equal(row.device_name, 'test-pc');
  assert.equal(row.recorded_at, '2026-11-11T05:42:00.000Z');
  assert.equal(row.title, '가짜 통화 1');
  assert.equal(row.is_fake, 1);
  assert.equal(row.duration_sec, 2);
  // 변환기가 없어도 16k mono WAV 는 그대로 받는다
  assert.equal(sha(fs.readFileSync(audio.audioPath(row.audio_file))), sha(wav));

  const d = await ingest(wav);
  assert.equal(d.status, 200);
  assert.deepEqual(d.body, { callId: r.body.callId, status: 'duplicate' });
  drain();
});

let leased;
test('claim → 오디오 받기(그 일꾼만) → result', async () => {
  drain();
  const wav = uniqueWav(1.5);
  const ing = await ingest(wav);
  assert.equal(ing.status, 201);
  const c = await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const job = c.body;
  leased = job;
  assert.equal(job.jobId, ing.body.jobId);
  assert.equal(job.callId, ing.body.callId);
  assert.equal(job.audioFormat, 'wav-16k-mono-s16le');
  assert.equal(job.audioBytes, wav.length);
  assert.equal(job.audioSha256, sha(wav));
  assert.equal(job.durationSec, 1.5);
  assert.equal(job.language, 'ko');
  assert.equal(job.leaseSec, 600);
  assert.ok(job.initialPrompt.startsWith('자동차 부품 대리점'));
  assert.deepEqual(job.customers, ['우리공업사']);
  assert.ok(Array.isArray(job.glossary) && Array.isArray(job.carModels));
  assert.ok(job.audioUrl.startsWith(`${srv.base}/api/worker/jobs/${job.jobId}/audio`));
  assert.equal(callRow(job.callId).status, 'transcribing');
  assert.equal(jobRow(job.jobId).attempts, 1);

  // 다른 일꾼 · 일꾼 이름 없음 · 토큰 없음
  const other = await api('GET', `/api/worker/jobs/${job.jobId}/audio?worker=gpu-pc-2`);
  assert.equal(other.status, 409);
  for (const q of ['', '?worker=', '?worker=%20']) {
    const noName = await api('GET', `/api/worker/jobs/${job.jobId}/audio${q}`);
    assert.equal(noName.status, 400, `이름 없음 ${q}`);
    assert.equal(noName.body.error, 'bad_worker');
  }
  assert.equal(jobs.isLeasedBy(jobRow(job.jobId), ''), false, 'isLeasedBy 는 일꾼 이름이 꼭 있어야 한다');
  assert.equal(jobs.isLeasedBy(jobRow(job.jobId), 'gpu-pc-1'), true);
  // 이름은 X-Worker 머리로도 받는다
  const byHeader = await fetch(`${srv.base}/api/worker/jobs/${job.jobId}/audio`, { method: 'HEAD', headers: { Authorization: `Bearer ${WORKER}`, 'X-Worker': 'gpu-pc-1' } });
  assert.equal(byHeader.status, 200);
  assert.equal((await api('GET', new URL(job.audioUrl).pathname + new URL(job.audioUrl).search, undefined, null)).status, 401);
  const a = await api('GET', new URL(job.audioUrl).pathname + new URL(job.audioUrl).search);
  assert.equal(a.status, 200);
  assert.equal(a.headers.get('content-type'), 'audio/wav');
  assert.equal(Number(a.headers.get('content-length')), wav.length);
  assert.equal(sha(a.body), job.audioSha256);

  // 결과 검사: 너무 큼 · 모양 틀림 · 다른 일꾼
  const many = Array.from({ length: 2001 }, (_, i) => ({ start: i, end: i + 1, text: '네' }));
  assert.equal((await api('POST', `/api/worker/jobs/${job.jobId}/result`, { worker: 'gpu-pc-1', text: 'x', segments: many })).status, 413);
  assert.equal((await api('POST', `/api/worker/jobs/${job.jobId}/result`, { worker: 'gpu-pc-1', text: 'x'.repeat(20_001) })).status, 413);
  assert.equal((await api('POST', `/api/worker/jobs/${job.jobId}/result`, { worker: 'gpu-pc-1', text: 'x', segments: [{ start: 'a', end: 1, text: 'x' }] })).status, 400);
  assert.equal((await api('POST', `/api/worker/jobs/${job.jobId}/result`, { worker: 'gpu-pc-2', text: 'x', segments: [] })).status, 409);
  assert.equal(jobRow(job.jobId).state, 'leased');

  const result = {
    worker: 'gpu-pc-1',
    text: '네 부품입니다. 예 우리공업사인데요 아반떼 앞범퍼 하나요',
    segments: [
      { start: 0, end: 1.4, text: '네, 부품입니다.' },
      { start: 1.6, end: 5.2, text: '예, 우리공업사인데요. 아반떼 앞범퍼 하나요.', speaker: 'A' },
    ],
    engine: 'faster-whisper large-v3 (cuda, float16)',
    durationSec: 1.5,
    elapsedSec: 0.4,
    language: 'ko',
  };
  const r = await api('POST', `/api/worker/jobs/${job.jobId}/result`, result);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, callId: job.callId, next: 'extracting' });
  assert.equal(jobRow(job.jobId).state, 'done');
  assert.equal(callRow(job.callId).status, 'extracting');
  await sleep(20);
  const got = calls.find((x) => x.callId === job.callId);
  assert.ok(got, '카드 정리(onTranscript)를 불렀다');
  assert.equal(got.payload.text, result.text);
  assert.equal(got.payload.segments.length, 2);
  assert.equal(got.payload.segments[1].speaker, 'A');
  assert.equal(got.payload.engine, result.engine);
  assert.equal(got.payload.durationSec, 1.5);
  assert.equal(got.payload.elapsedSec, 0.4);

  // 끝난 일감: result · 오디오 모두 409
  assert.equal((await api('POST', `/api/worker/jobs/${job.jobId}/result`, result)).status, 409);
  assert.equal((await api('GET', `/api/worker/jobs/${job.jobId}/audio?worker=gpu-pc-1`)).status, 409);
  assert.equal((await api('GET', '/api/worker/jobs/job_nope/audio?worker=gpu-pc-1')).status, 404);
});

test('fail: retryable 은 줄 뒤로, 3번째에 실패로 끝남 · 경로 · 토큰은 가린다', async () => {
  drain();
  const ing = await ingest(uniqueWav());
  const id = ing.body.jobId;
  for (let i = 1; i <= 3; i += 1) {
    const c = await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' });
    assert.equal(c.status, 200);
    assert.equal(c.body.jobId, id);
    assert.equal((await api('POST', `/api/worker/jobs/${id}/fail`, { worker: 'gpu-pc-2', error: 'x' })).status, 409);
    const f = await api('POST', `/api/worker/jobs/${id}/fail`, { worker: 'gpu-pc-1', error: `decode error C:\\Users\\pc\\secret\\a.wav /home/me/x.wav Bearer ${WORKER}`, retryable: true });
    assert.equal(f.status, 200);
    assert.equal(f.body.attempts, i);
    assert.equal(f.body.state, i < 3 ? 'queued' : 'failed');
    assert.equal(callRow(ing.body.callId).status, i < 3 ? 'queued' : 'failed');
  }
  const j = jobRow(id);
  assert.equal(j.state, 'failed');
  assert.ok(!j.error.includes('Users') && !j.error.includes('/home/') && !j.error.includes(WORKER), j.error);
  assert.match(callRow(ing.body.callId).error, /^받아쓰기에 실패했습니다/);
  assert.equal((await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' })).status, 204);
});

test('fail: retryable=false 면 바로 실패, 실패한 통화를 다시 보내면 다시 줄에 선다', async () => {
  drain();
  const wav = uniqueWav();
  const ing = await ingest(wav);
  const c = await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' });
  const f = await api('POST', `/api/worker/jobs/${c.body.jobId}/fail`, { worker: 'gpu-pc-1', error: '빈 녹음', retryable: false });
  assert.equal(f.body.state, 'failed');
  assert.equal(callRow(ing.body.callId).status, 'failed');
  const again = await ingest(wav);
  assert.equal(again.status, 200);
  assert.equal(again.body.status, 'duplicate');
  assert.equal(again.body.requeued, true);
  assert.equal(callRow(ing.body.callId).status, 'queued');
  assert.equal(jobs.queueStats().waiting, 1);
  drain();
});

test('임대 만료: 줄로 되돌리고, 3번 넘게 만료되면 실패', async () => {
  drain();
  const ing = await ingest(uniqueWav());
  const id = ing.body.jobId;
  for (let i = 1; i <= 3; i += 1) {
    const c = await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' });
    assert.equal(c.body.jobId, id);
    db().prepare('UPDATE jobs SET lease_until = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), id);
    // 기한이 지난 임대로는 오디오를 받을 수 없다
    assert.equal((await api('GET', `/api/worker/jobs/${id}/audio?worker=gpu-pc-1`)).status, 409);
    const s = jobs.sweepExpired();
    assert.deepEqual(s, i < 3 ? { requeued: 1, failed: 0 } : { requeued: 0, failed: 1 });
    assert.equal(jobRow(id).state, i < 3 ? 'queued' : 'failed');
    assert.equal(callRow(ing.body.callId).status, i < 3 ? 'queued' : 'failed');
    // 만료된 일감의 늦은 결과는 받지 않는다
    assert.equal((await api('POST', `/api/worker/jobs/${id}/result`, { worker: 'gpu-pc-1', text: '늦음' })).status, 409);
  }
});

test('claim: 녹음 파일이 없어진 일감은 실패로 넘기고 다음 것을 준다', async () => {
  drain();
  const a = await ingest(uniqueWav());
  await sleep(5);
  const b = await ingest(uniqueWav());
  fs.rmSync(audio.audioPath(callRow(a.body.callId).audio_file));
  const c = await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' });
  assert.equal(c.status, 200);
  assert.equal(c.body.callId, b.body.callId);
  assert.equal(jobRow(a.body.jobId).state, 'failed');
  assert.equal(callRow(a.body.callId).status, 'failed');
  drain();
});

test('주인 없는 녹음 파일 정리: 행이 없는 오래된 wav 만 지우고 시드 음성 · 새 파일 · 쓰는 파일은 남긴다', async () => {
  const dir = path.join(process.env.DATA_DIR, 'audio');
  fs.mkdirSync(dir, { recursive: true });
  const old = new Date(Date.now() - 2 * 3600_000);
  const put = (name, { aged = true } = {}) => {
    const abs = path.join(dir, name);
    fs.writeFileSync(abs, 'RIFF');
    if (aged) fs.utimesSync(abs, old, old);
    return abs;
  };
  const orphan = put('call_orphan1.wav');
  const seedVoice = put('fx-c99.wav');
  const fresh = put('call_fresh1.wav', { aged: false });
  const notWav = put('readme.txt');
  const ing = await ingest(uniqueWav());
  const usedAbs = audio.audioPath(callRow(ing.body.callId).audio_file);
  fs.utimesSync(usedAbs, old, old);
  drain();

  const n = worker.sweepOrphanAudio();
  assert.ok(n >= 1, `지운 수 ${n}`);
  assert.equal(fs.existsSync(orphan), false, '행이 없는 오래된 파일은 지운다');
  assert.equal(fs.existsSync(seedVoice), true, '시드 음성은 남긴다');
  assert.equal(fs.existsSync(fresh), true, '막 만든 파일은 남긴다');
  assert.equal(fs.existsSync(notWav), true, 'wav 가 아니면 보지 않는다');
  assert.equal(fs.existsSync(usedAbs), true, '통화가 쓰는 파일은 남긴다');
  fs.rmSync(seedVoice);
  fs.rmSync(fresh);
  fs.rmSync(notWav);
});

test('ingest: 다른 녹음을 2건 받는 중이면 본문을 읽지 않고 503 busy', async () => {
  const httpLib = await import('../lib/http.mjs');
  let release;
  const hold = new Promise((r) => { release = r; });
  const fakeReq = { headers: {} };
  const slots = [httpLib.withUploadSlot(fakeReq, () => hold), httpLib.withUploadSlot(fakeReq, () => hold)];
  try {
    const r = await ingest(uniqueWav());
    assert.equal(r.status, 503);
    assert.equal(r.body.error, 'busy');
  } finally {
    release();
    await Promise.all(slots);
  }
  assert.equal(httpLib.uploadsInProgress(), 0);
  const ok = await ingest(uniqueWav());
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  drain();
});

test('카드 정리 모듈이 없거나 실패해도 서버는 멈추지 않는다', async () => {
  drain();
  worker.setTranscriptHandler(null); // 진짜 lib/pipeline.mjs (아직 없을 수도 있음)
  try {
    const ing = await ingest(uniqueWav());
    const c = await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' });
    const text = '가짜 통화입니다 앞범퍼 두 개요';
    const r = await api('POST', `/api/worker/jobs/${c.body.jobId}/result`, { worker: 'gpu-pc-1', text, segments: [{ start: 0, end: 2, text }] });
    assert.equal(r.status, 200);
    let row;
    for (let i = 0; i < 100; i += 1) {
      row = callRow(ing.body.callId);
      if (row.transcript) break;
      await sleep(50);
    }
    assert.equal(row.transcript, text, '받아쓴 글은 남는다');
    assert.ok(['extracting', 'ready'].includes(row.status), row.status);
    // 정리기가 throw 해도 통화는 실패 표시 · 서버는 계속
    worker.setTranscriptHandler(async () => { throw new Error('일부러 실패'); });
    const ing2 = await ingest(uniqueWav());
    const c2 = await api('POST', '/api/worker/claim', { worker: 'gpu-pc-1' });
    await api('POST', `/api/worker/jobs/${c2.body.jobId}/result`, { worker: 'gpu-pc-1', text: '둘째', segments: [] });
    await sleep(50);
    const row2 = callRow(ing2.body.callId);
    assert.equal(row2.status, 'failed');
    assert.equal(row2.transcript, '둘째');
    assert.equal((await api('GET', '/api/worker/status', undefined, null)).status, 200);
  } finally {
    worker.setTranscriptHandler(async (callId, payload) => { calls.push({ callId, payload }); });
  }
});

test('folder-sender: 파일 이름의 번호 찾기', () => {
  assert.equal(sender.callerNumberFromName('20261111_143022_01012345678.m4a'), '01012345678');
  assert.equal(sender.callerNumberFromName('통화 010-2345-6789 새한.wav'), '01023456789');
  assert.equal(sender.callerNumberFromName('rec_02-123-4567.wav'), '021234567');
  assert.equal(sender.callerNumberFromName('rec_20261111.wav'), null);
  assert.equal(sender.callerNumberFromName('fake-call-1.mp3'), null);
});

function runSender(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(APP, 'tools', 'folder-sender.mjs'), ...args], {
      env: { ...process.env, INGEST_TOKEN: INGEST },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => child.kill(), 30_000);
    child.on('close', (code) => { clearTimeout(t); resolve({ code, out }); });
  });
}

test('folder-sender: 폴더의 가짜 녹음을 ingest 로 보내고 다시 보내지 않는다', async () => {
  drain();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-send-'));
  try {
    const wav = uniqueWav();
    fs.writeFileSync(path.join(dir, 'fake_010-7777-1234_order.wav'), wav);
    fs.writeFileSync(path.join(dir, 'memo.txt'), '오디오 아님');
    const args = ['--dir', dir, '--url', srv.base, '--once', '--interval', '0.3', '--device', 'test-sender'];
    const r1 = await runSender(args);
    assert.equal(r1.code, 0, r1.out);
    assert.match(r1.out, /보냄: fake_010-7777-1234_order\.wav/);
    assert.equal(r1.out.includes(INGEST), false, '토큰을 출력하지 않는다');
    const sent = JSON.parse(fs.readFileSync(path.join(dir, sender.SENT_FILE), 'utf8'));
    const rec = sent.files['fake_010-7777-1234_order.wav'];
    assert.equal(rec.sha256, sha(wav));
    assert.equal(rec.status, 'queued');
    assert.equal(sent.files['memo.txt'], undefined);
    const row = callRow(rec.callId);
    assert.equal(row.source, 'ingest');
    assert.equal(row.caller_number, '01077771234');
    assert.equal(row.device_name, 'test-sender');
    assert.equal(row.original_name, 'fake_010-7777-1234_order.wav');
    assert.equal(row.recorded_at, new Date(fs.statSync(path.join(dir, 'fake_010-7777-1234_order.wav')).mtimeMs).toISOString());

    const r2 = await runSender(args);
    assert.equal(r2.code, 0, r2.out);
    assert.match(r2.out, /보낸 것 0개/);
    assert.equal(db().prepare('SELECT COUNT(*) AS n FROM calls WHERE audio_sha256 = ?').get(sha(wav)).n, 1);

    // 토큰이 틀리면 멈춘다(종료 코드 1)
    const bad = await new Promise((resolve) => {
      fs.writeFileSync(path.join(dir, 'fake2.wav'), uniqueWav());
      const child = spawn(process.execPath, [path.join(APP, 'tools', 'folder-sender.mjs'), ...args], {
        env: { ...process.env, INGEST_TOKEN: 'wrong-token' }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.on('close', (code) => resolve({ code, out }));
    });
    assert.equal(bad.code, 1, bad.out);
    assert.equal(bad.out.includes('wrong-token'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
