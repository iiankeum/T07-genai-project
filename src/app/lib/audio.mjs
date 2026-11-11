// 올린 녹음 검사(파일 머리 · 길이)와 16kHz mono 16bit WAV 변환. 원본은 변환 뒤 바로 지운다.
// 변환한 WAV 는 DATA_DIR/audio/<callId>.wav, DB 의 calls.audio_file 에는 'audio/<callId>.wav' 로 적는다.
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.mjs';
import { HttpError } from './http.mjs';

const AUDIO_DIR = () => path.join(config.dataDir, 'audio');
const TMP_DIR = () => path.join(config.dataDir, 'tmp');
const CONVERT_TIMEOUT_MS = 60_000;
const MAX_PENDING = 6; // 변환을 기다리는 것이 이보다 많으면 잠시 뒤 다시(메모리 보호)
const BYTES_PER_SEC = 16000 * 2; // 16kHz · mono · 16bit

// ── 형식 판별(파일 머리 바이트) ───────────────────────────────────────
const ascii = (buf, start, len) => buf.subarray(start, start + len).toString('latin1');

/**
 * 오디오 형식 판별. 모르면 null.
 * @returns {{format:string, ext:string, demuxer:string|null}|null} demuxer 는 ffmpeg -f 로 고정할 입력 형식(애매하면 null)
 */
export function sniffAudio(buf) {
  if (!buf || buf.length < 12) return null;
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WAVE') return { format: 'wav', ext: 'wav', demuxer: 'wav' };
  if (ascii(buf, 0, 4) === 'OggS') return { format: 'ogg', ext: 'ogg', demuxer: 'ogg' };
  if (ascii(buf, 0, 5) === '#!AMR') return { format: 'amr', ext: 'amr', demuxer: 'amr' };
  if (ascii(buf, 0, 4) === 'fLaC') return { format: 'flac', ext: 'flac', demuxer: 'flac' };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { format: 'webm', ext: 'webm', demuxer: 'matroska' };
  if (ascii(buf, 4, 4) === 'ftyp') {
    const brand = ascii(buf, 8, 4);
    const is3gp = brand.startsWith('3g');
    return { format: is3gp ? '3gp' : 'm4a', ext: is3gp ? '3gp' : 'm4a', demuxer: 'mov' };
  }
  if (ascii(buf, 0, 3) === 'ID3') return { format: 'mp3', ext: 'mp3', demuxer: null };
  if (buf[0] === 0xff) {
    // ADTS AAC: 동기 12비트 + layer 00
    if ((buf[1] & 0xf6) === 0xf0) return { format: 'aac', ext: 'aac', demuxer: null };
    // MPEG 오디오 프레임: 동기 11비트 · 버전 01(예약) 아님 · layer 00(예약) 아님 · 비트레이트 1111 아님 · 표본율 11 아님
    const sync = (buf[1] & 0xe0) === 0xe0;
    const version = (buf[1] >> 3) & 3;
    const layer = (buf[1] >> 1) & 3;
    const bitrate = buf[2] >> 4;
    const rate = (buf[2] >> 2) & 3;
    if (sync && version !== 1 && layer !== 0 && bitrate !== 15 && rate !== 3) return { format: 'mp3', ext: 'mp3', demuxer: null };
  }
  return null;
}

/**
 * WAV 머리 읽기. 읽지 못하면 null.
 * @returns {{audioFormat:number, channels:number, sampleRate:number, bitsPerSample:number, dataOffset:number, dataBytes:number, durationSec:number, is16kMono:boolean}|null}
 */
export function wavInfo(buf, totalSize = buf?.length) {
  if (!buf || buf.length < 12 || ascii(buf, 0, 4) !== 'RIFF' || ascii(buf, 8, 4) !== 'WAVE') return null;
  let pos = 12;
  let fmt = null;
  while (pos + 8 <= buf.length) {
    const id = ascii(buf, pos, 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ' && body + 16 <= buf.length) {
      let audioFormat = buf.readUInt16LE(body);
      // WAVE_FORMAT_EXTENSIBLE 이면 하위 형식의 앞 2바이트가 실제 형식
      if (audioFormat === 0xfffe && size >= 40 && body + 26 <= buf.length) audioFormat = buf.readUInt16LE(body + 24);
      fmt = {
        audioFormat,
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!fmt) return null;
      const available = Math.max(0, totalSize - body);
      // 흘려 쓴 WAV 는 크기 칸이 0 이나 0xFFFFFFFF 일 수 있다 → 실제 남은 바이트로
      const dataBytes = size === 0 || size === 0xffffffff || size > available ? available : size;
      const byteRate = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
      return {
        ...fmt,
        dataOffset: body,
        dataBytes,
        durationSec: byteRate > 0 ? Math.round((dataBytes / byteRate) * 100) / 100 : 0,
        is16kMono: fmt.audioFormat === 1 && fmt.channels === 1 && fmt.sampleRate === 16000 && fmt.bitsPerSample === 16,
      };
    }
    pos = body + size + (size % 2); // 덩어리는 짝수 바이트로 맞춘다
  }
  return null;
}

/** 파일의 앞부분만 읽어 WAV 머리를 본다 */
function wavInfoOfFile(abs) {
  const fd = fs.openSync(abs, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    const head = Buffer.alloc(Math.min(size, 64 * 1024));
    fs.readSync(fd, head, 0, head.length, 0);
    return wavInfo(head, size);
  } finally {
    fs.closeSync(fd);
  }
}

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** 'audio/<id>.wav' → 절대 경로. DATA_DIR/audio 밖이면 404 오류. */
export function audioPath(relFile) {
  const base = AUDIO_DIR();
  const abs = relFile ? path.resolve(config.dataDir, String(relFile)) : '';
  if (!abs || !abs.startsWith(base + path.sep)) throw new HttpError(404, 'no_audio', '녹음 파일이 없습니다.');
  return abs;
}

/** 녹음 파일 지우기(없으면 조용히 넘어감) */
export function removeAudio(relFile) {
  try { fs.rmSync(audioPath(relFile), { force: true }); } catch { /* 없음 */ }
}

// ── ffmpeg ──────────────────────────────────────────────────────────
let ffmpegCache = { at: 0, ok: null };
/** ffmpeg 가 있는지(5분 캐시) */
export async function ffmpegAvailable() {
  if (ffmpegCache.ok !== null && Date.now() - ffmpegCache.at < 300_000) return ffmpegCache.ok;
  const ok = await new Promise((resolve) => {
    let child;
    try {
      child = spawn(config.ffmpegPath, ['-hide_banner', '-version'], { stdio: 'ignore', windowsHide: true });
    } catch { resolve(false); return; }
    const t = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* 이미 끝남 */ } resolve(false); }, 5000);
    child.on('error', () => { clearTimeout(t); resolve(false); });
    child.on('exit', (code) => { clearTimeout(t); resolve(code === 0); });
  });
  ffmpegCache = { at: Date.now(), ok };
  return ok;
}

/** ffmpeg 한 번 돌리기. 없으면 {missing:true} */
function runFfmpeg(args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(config.ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    } catch (e) {
      resolve({ missing: e?.code === 'ENOENT', code: -1, stderr: String(e?.message || e) });
      return;
    }
    let stderr = '';
    let timedOut = false;
    child.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-2000); });
    const timer = setTimeout(() => { timedOut = true; try { child.kill('SIGKILL'); } catch { /* 이미 끝남 */ } }, CONVERT_TIMEOUT_MS);
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ missing: e?.code === 'ENOENT', code: -1, stderr: String(e?.message || e) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ missing: false, code, timedOut, stderr });
    });
  });
}

// 변환은 한 번에 하나씩(메모리 · CPU 보호)
let chain = Promise.resolve();
let pending = 0;
function serial(fn) {
  if (pending >= MAX_PENDING) {
    return Promise.reject(new HttpError(503, 'busy', '지금 녹음을 바꾸는 일이 많습니다. 잠시 뒤 다시 해 주세요.'));
  }
  pending += 1;
  const run = chain.then(fn, fn).finally(() => { pending -= 1; });
  chain = run.catch(() => {});
  return run;
}

function rmQuiet(file) {
  try { fs.rmSync(file, { force: true }); } catch { /* 없음 */ }
}

/**
 * 올린 원본 → DATA_DIR/audio/<callId>.wav (16kHz mono s16).
 * 오류: 415 not_audio · 422 too_long/unreadable_audio/empty_audio/convert_timeout · 503 converter_missing/busy
 * @returns {Promise<{audioFile:string, durationSec:number, sha256:string, bytes:number}>}
 */
export async function convertToWav(buf, callId) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(callId))) throw new Error('잘못된 callId');
  const kind = sniffAudio(buf);
  if (!kind) throw new HttpError(415, 'not_audio', '오디오 파일이 아닙니다. wav · mp3 · m4a 같은 녹음 파일을 올려 주세요.');
  const hash = sha256(buf);
  const audioFile = `audio/${callId}.wav`;
  const finalAbs = audioPath(audioFile);

  return serial(async () => {
    fs.mkdirSync(TMP_DIR(), { recursive: true });
    fs.mkdirSync(AUDIO_DIR(), { recursive: true });
    const tag = `${callId}-${randomBytes(4).toString('hex')}`;
    const inAbs = path.join(TMP_DIR(), `${tag}.${kind.ext}`);
    const outAbs = path.join(TMP_DIR(), `${tag}.out.wav`);
    try {
      fs.writeFileSync(inAbs, buf);
      const args = ['-hide_banner', '-nostdin', '-loglevel', 'error', '-y', '-threads', '1', '-protocol_whitelist', 'file'];
      if (kind.demuxer) args.push('-f', kind.demuxer);
      args.push('-i', inAbs, '-vn', '-map_metadata', '-1', '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', '-c:a', 'pcm_s16le',
        '-t', String(config.maxAudioSec + 1), '-fflags', '+bitexact', '-flags:a', '+bitexact', '-f', 'wav', outAbs);
      const r = await runFfmpeg(args);
      rmQuiet(inAbs); // 원본은 바로 지운다

      if (r.missing) {
        // ffmpeg 가 없으면 이미 16k mono 16bit WAV 인 것만 그대로 받는다
        const info = kind.format === 'wav' ? wavInfo(buf) : null;
        if (!info || !info.is16kMono) {
          throw new HttpError(503, 'converter_missing', '서버에 녹음 변환 프로그램이 없어 지금은 16kHz mono WAV 만 받을 수 있습니다.');
        }
        fs.writeFileSync(outAbs, buf);
      } else if (r.timedOut) {
        throw new HttpError(422, 'convert_timeout', '녹음을 바꾸는 데 너무 오래 걸렸습니다. 더 짧은 파일로 해 주세요.');
      } else if (r.code !== 0) {
        console.warn(`[audio] 변환 실패(${kind.format}, 종료 코드 ${r.code})`);
        throw new HttpError(422, 'unreadable_audio', '녹음을 읽지 못했습니다. 다른 파일로 해 주세요.');
      }

      const info = wavInfoOfFile(outAbs);
      if (!info || info.dataBytes < BYTES_PER_SEC / 10) {
        throw new HttpError(422, 'empty_audio', '소리가 없거나 너무 짧은 녹음입니다.');
      }
      if (info.durationSec > config.maxAudioSec) {
        throw new HttpError(422, 'too_long', `녹음이 너무 깁니다(최대 ${Math.round(config.maxAudioSec / 60 * 10) / 10}분).`);
      }
      fs.renameSync(outAbs, finalAbs);
      return { audioFile, durationSec: info.durationSec, sha256: hash, bytes: fs.statSync(finalAbs).size };
    } finally {
      rmQuiet(inAbs);
      rmQuiet(outAbs);
    }
  });
}

/**
 * multipart 양식의 file 칸 → {buf, name, sha256}. 없으면 400, 크면 413, 오디오가 아니면 415.
 * @param {FormData} form
 */
export async function audioFromForm(form, field = 'file') {
  const file = form.get(field);
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    throw new HttpError(400, 'file_required', '녹음 파일을 골라 주세요.');
  }
  if (file.size > config.maxUploadBytes) {
    throw new HttpError(413, 'too_large', `파일이 너무 큽니다(최대 ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB).`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffAudio(buf)) throw new HttpError(415, 'not_audio', '오디오 파일이 아닙니다. wav · mp3 · m4a 같은 녹음 파일을 올려 주세요.');
  const name = String(file.name || '').replace(/[\u0000-\u001F\u007F\\/]/g, '_').trim().slice(0, 120) || null;
  return { buf, name, sha256: sha256(buf) };
}

/** 지난번에 남은 임시 파일 지우기(1시간 넘은 것) */
export function cleanTmp(maxAgeMs = 3600_000) {
  let n = 0;
  try {
    for (const f of fs.readdirSync(TMP_DIR())) {
      const abs = path.join(TMP_DIR(), f);
      try {
        if (Date.now() - fs.statSync(abs).mtimeMs > maxAgeMs) { fs.rmSync(abs, { force: true }); n += 1; }
      } catch { /* 넘어감 */ }
    }
  } catch { /* 폴더 없음 */ }
  return n;
}
