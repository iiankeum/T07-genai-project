// [A] 녹음 올리기 시험: 형식 판별 · ffmpeg 변환(wav · mp3) · POST /api/calls/upload · GET /api/samples.
// ffmpeg 가 있는 PC 에서 돈다(없으면 변환 시험은 건너뛴다). 실행: node --test test/upload.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cn-'));
process.env.MAX_AUDIO_SEC = '5';
process.env.MAX_UPLOAD_BYTES = '1000000';
delete process.env.FFMPEG_PATH;

const { makeWav, startServer } = await import('./fixtures/worker-helpers.mjs');
const { db, nowIso } = await import('../lib/db.mjs');
const audio = await import('../lib/audio.mjs');
const upload = await import('../routes/upload.mjs');

const HAS_FFMPEG = await audio.ffmpegAvailable();
let srv;
let ipN = 0;
const nextIp = () => `10.1.0.${++ipN}`;

before(async () => { srv = await startServer([upload]); });
after(async () => { await srv?.close(); });

async function post(buf, fields = {}, { ip = nextIp(), name = 'fake-call.wav', type = 'audio/wav' } = {}) {
  const fd = new FormData();
  if (buf) fd.append('file', new Blob([buf], { type }), name);
  for (const [k, v] of Object.entries({ fakeConfirm: 'yes', ...fields })) if (v != null) fd.append(k, v);
  const res = await fetch(`${srv.base}/api/calls/upload`, { method: 'POST', headers: { 'X-Forwarded-For': ip }, body: fd });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('형식 판별: 파일 머리 바이트', () => {
  const pad = (b) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
  const cases = [
    [makeWav(0.1), 'wav'],
    [pad('OggS'), 'ogg'],
    [pad('#!AMR\n'), 'amr'],
    [pad('fLaC'), 'flac'],
    [pad([0x1a, 0x45, 0xdf, 0xa3]), 'webm'],
    [pad([0, 0, 0, 0x20, ...Buffer.from('ftypM4A ')]), 'm4a'],
    [pad([0, 0, 0, 0x18, ...Buffer.from('ftyp3gp4')]), '3gp'],
    [pad('ID3'), 'mp3'],
    [pad([0xff, 0xfb, 0x90, 0x00]), 'mp3'],
    [pad([0xff, 0xf1, 0x50, 0x80]), 'aac'],
  ];
  for (const [buf, fmt] of cases) assert.equal(audio.sniffAudio(buf)?.format, fmt, fmt);
  assert.equal(audio.sniffAudio(pad('hello world, not audio')), null);
  assert.equal(audio.sniffAudio(pad([0x89, 0x50, 0x4e, 0x47])), null); // PNG
  assert.equal(audio.sniffAudio(Buffer.from('ab')), null);
});

test('WAV 머리 읽기', () => {
  const info = audio.wavInfo(makeWav(1.5));
  assert.equal(info.is16kMono, true);
  assert.equal(info.durationSec, 1.5);
  const st = audio.wavInfo(makeWav(1, { rate: 8000, channels: 2 }));
  assert.equal(st.is16kMono, false);
  assert.equal(st.channels, 2);
  assert.equal(audio.wavInfo(Buffer.from('nope nope nope')), null);
});

test('audioPath 는 DATA_DIR/audio 밖을 막는다', () => {
  assert.ok(audio.audioPath('audio/call_x.wav').endsWith(path.join('audio', 'call_x.wav')));
  assert.throws(() => audio.audioPath('../secret.txt'), { status: 404 });
  assert.throws(() => audio.audioPath('callnote.sqlite'), { status: 404 });
  assert.throws(() => audio.audioPath(null), { status: 404 });
});

test('8kHz 스테레오 WAV → 16k mono 로 바꾸고 원본 임시 파일은 지운다', { skip: !HAS_FFMPEG && 'ffmpeg 없음' }, async () => {
  const src = makeWav(1, { rate: 8000, channels: 2, freq: 300 });
  const out = await audio.convertToWav(src, 'call_conv1');
  assert.equal(out.audioFile, 'audio/call_conv1.wav');
  assert.ok(Math.abs(out.durationSec - 1) < 0.05, `길이 ${out.durationSec}`);
  assert.equal(out.sha256, audio.sha256(src));
  const wav = fs.readFileSync(audio.audioPath(out.audioFile));
  assert.equal(audio.wavInfo(wav).is16kMono, true);
  assert.equal(wav.length, out.bytes);
  const tmpDir = path.join(process.env.DATA_DIR, 'tmp');
  assert.deepEqual(fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [], []);
});

test('올리기: 확인 체크 · 오디오 아님 · 너무 큼', async () => {
  let r = await post(makeWav(1, { freq: 500 }), { fakeConfirm: null });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'fake_confirm_required');
  r = await post(Buffer.from('이것은 녹음이 아닙니다 '.repeat(5)), {}, { name: 'memo.wav' });
  assert.equal(r.status, 415);
  assert.equal(r.body.error, 'not_audio');
  r = await post(null);
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'file_required');
  r = await post(Buffer.concat([makeWav(0.1), Buffer.alloc(1_100_000)]));
  assert.equal(r.status, 413);
});

let firstCallId;
test('올리기: WAV → 201 queued, 일감 생김, 같은 파일은 duplicate', async () => {
  const wav = makeWav(2, { freq: 600 });
  const r = await post(wav, { recordedAt: '2026-11-10T05:42:00.000Z' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.callId, /^call_/);
  assert.equal(r.body.status, 'queued');
  assert.equal(r.body.call.id, r.body.callId);
  assert.equal(r.body.call.status, 'queued');
  assert.equal(r.body.call.source, 'upload');
  assert.equal(r.body.call.hasAudio, true);
  assert.equal(r.body.call.isFake, true);
  assert.equal(r.body.call.recordedAt, '2026-11-10T05:42:00.000Z');
  assert.ok(Math.abs(r.body.call.durationSec - 2) < 0.05);
  assert.ok(r.body.call.title.includes('0:02'));
  firstCallId = r.body.callId;
  const row = db().prepare('SELECT * FROM calls WHERE id = ?').get(firstCallId);
  assert.equal(row.uploader.length, 16); // IP 해시만
  assert.ok(!row.uploader.includes('10.1.0'));
  assert.equal(row.audio_sha256, audio.sha256(wav));
  assert.ok(fs.existsSync(audio.audioPath(row.audio_file)));
  const job = db().prepare('SELECT * FROM jobs WHERE call_id = ?').get(firstCallId);
  assert.equal(job.state, 'queued');

  const again = await post(wav);
  assert.equal(again.status, 200);
  assert.equal(again.body.status, 'duplicate');
  assert.equal(again.body.callId, firstCallId);
  assert.equal(again.body.call.id, firstCallId);
  assert.equal(db().prepare('SELECT COUNT(*) AS n FROM jobs WHERE call_id = ?').get(firstCallId).n, 1);
});

test('올리기: 틀린 녹음 시각은 지금으로, 걸려 온 번호로 거래처를 채운다', async () => {
  const now = nowIso();
  db().prepare("INSERT INTO glossary(id, kind, term, phone, status, source, created_at, updated_at) VALUES('g1', '거래처', '새한카센터', '010-9999-0001', 'approved', '기본', ?, ?)").run(now, now);
  const r = await post(makeWav(1, { freq: 650 }), { recordedAt: 'not-a-date', callerNumber: '010 9999 0001' });
  assert.equal(r.status, 201);
  assert.ok(Date.now() - Date.parse(r.body.call.recordedAt) < 60_000);
  assert.equal(r.body.call.customer, '새한카센터');
  assert.equal(r.body.call.callerNumber, '010-****-0001');
  assert.ok(r.body.call.title.startsWith('새한카센터'));
});

test('올리기: 5분 제한 넘으면 422 too_long, 파일은 남기지 않는다', { skip: !HAS_FFMPEG && 'ffmpeg 없음' }, async () => {
  const before = fs.readdirSync(path.join(process.env.DATA_DIR, 'audio')).length;
  const r = await post(makeWav(6, { freq: 700 }));
  assert.equal(r.status, 422);
  assert.equal(r.body.error, 'too_long');
  assert.equal(fs.readdirSync(path.join(process.env.DATA_DIR, 'audio')).length, before);
});

test('올리기: mp3 (ffmpeg 로 만든 시험 파일)', { skip: !HAS_FFMPEG && 'ffmpeg 없음' }, async () => {
  const mp3 = path.join(process.env.DATA_DIR, 'make-test.mp3');
  const p = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2', '-ac', '1', '-ar', '22050', '-b:a', '64k', mp3]);
  assert.equal(p.status, 0, String(p.stderr));
  const buf = fs.readFileSync(mp3);
  fs.rmSync(mp3);
  assert.equal(audio.sniffAudio(buf)?.format, 'mp3');
  const r = await post(buf, {}, { name: 'fake.mp3', type: 'audio/mpeg' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.ok(Math.abs(r.body.call.durationSec - 2) < 0.15, `길이 ${r.body.call.durationSec}`);
  const row = db().prepare('SELECT audio_file, original_name FROM calls WHERE id = ?').get(r.body.callId);
  assert.equal(row.original_name, 'fake.mp3');
  assert.equal(audio.wavInfo(fs.readFileSync(audio.audioPath(row.audio_file))).is16kMono, true);
});

test('올리기: 같은 IP 는 1시간에 5건까지', async () => {
  const ip = '10.9.9.9';
  for (let i = 0; i < 5; i += 1) {
    const r = await post(Buffer.from('not audio at all......'), {}, { ip });
    assert.equal(r.status, 415);
  }
  const r = await post(makeWav(1, { freq: 750 }), {}, { ip });
  assert.equal(r.status, 429);
  assert.equal(r.body.error, 'rate_limited');
});

test('예시 녹음: 가짜 ingest · seed 통화 중 녹음이 있는 것만', async () => {
  const now = nowIso();
  fs.writeFileSync(path.join(process.env.DATA_DIR, 'audio', 'call_seed1.wav'), makeWav(1, { freq: 800 }));
  const ins = db().prepare(`INSERT INTO calls(id, created_at, recorded_at, source, status, title, duration_sec, audio_file, is_fake)
    VALUES(?, ?, ?, ?, 'ready', ?, 1, ?, ?)`);
  ins.run('call_seed1', now, now, 'seed', '예시 통화', 'audio/call_seed1.wav', 1);
  ins.run('call_seed2', now, now, 'seed', '파일 없음', 'audio/call_seed2.wav', 1);
  ins.run('call_real1', now, now, 'ingest', '진짜', 'audio/call_seed1.wav', 0);
  const res = await fetch(`${srv.base}/api/samples`);
  assert.equal(res.status, 200);
  const { samples } = await res.json();
  assert.deepEqual(samples.map((s) => s.callId), ['call_seed1']);
  assert.deepEqual(samples[0], { callId: 'call_seed1', title: '예시 통화', durationSec: 1, url: '/api/calls/call_seed1/audio?download=1' });
});
