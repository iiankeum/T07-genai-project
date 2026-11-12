// ※ 개발용 간이판 — 현장 PC 에 까는 정본은 한결 방의 src/pc-agent/(callnote_agent.py watch). 이 파일은 시험 · 개발에만 쓴다.
// F12 녹음 폴더 자동 보내기: PC 의 녹음 폴더를 지켜보다가 새 (가짜) 녹음을 데모 서버 /api/ingest 로 보낸다.
//
// 사용법(Node 24, 설치할 것 없음):
//   node --env-file=<비밀 env 파일> src/app/tools/folder-sender.mjs --dir <녹음 폴더> --url https://t07.3-39-67-126.sslip.io [--once] [--device 이름] [--interval 초]
//   예) node --env-file=C:\Users\pc\.t07-secrets\ingest.env src/app/tools/folder-sender.mjs --dir D:\가짜녹음 --url https://t07.3-39-67-126.sslip.io
//
// - env 파일에는 INGEST_TOKEN=... 한 줄만 둔다. 토큰은 저장소 · 화면 · 로그에 쓰지 않는다(이 프로그램도 출력하지 않는다).
// - 5초마다 폴더의 오디오 파일(wav mp3 m4a aac amr ogg opus webm 3gp flac)을 본다. 크기가 두 번 연속 같으면(쓰기 끝) 보낸다.
// - 보낸 파일은 폴더 안 .callnote-sent.json 에 이름 · 크기 · 수정 시각 · SHA-256 으로 적어 다시 보내지 않는다.
// - 녹음 시각 = 파일 수정 시각. 파일 이름에 01012345678 같은 번호가 있으면 걸려 온 번호로 보낸다. 공개 데모라 fake=true 고정.
// - 실패하면 다음 바퀴에 다시 보낸다(파일마다 최대 5번). --once 는 한 바퀴만 돌고 끝낸다.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const AUDIO_EXT = new Set(['.wav', '.mp3', '.m4a', '.aac', '.amr', '.ogg', '.opus', '.webm', '.3gp', '.flac']);
const MIME = {
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.amr': 'audio/amr', '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg', '.webm': 'audio/webm', '.3gp': 'audio/3gpp', '.flac': 'audio/flac',
};
export const SENT_FILE = '.callnote-sent.json';
const MAX_TRIES = 5;
const MAX_BYTES = 10 * 1024 * 1024;

/** 파일 이름에서 전화번호(010-1234-5678, 01012345678, 0212345678 등) 찾기 */
export function callerNumberFromName(name) {
  const m = /(?<!\d)(0\d{1,2})[-_. ]?(\d{3,4})[-_. ]?(\d{4})(?!\d)/.exec(String(name));
  return m ? m[1] + m[2] + m[3] : null;
}

export function parseArgs(argv) {
  const out = { dir: null, url: null, once: false, device: 'folder-sender', interval: 5 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--once') out.once = true;
    else if (a === '--dir') out.dir = argv[++i];
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--device') out.device = argv[++i];
    else if (a === '--interval') out.interval = Number(argv[++i]);
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`모르는 옵션: ${a}`);
  }
  return out;
}

function loadSent(dir) {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, SENT_FILE), 'utf8'));
    if (v && typeof v === 'object' && v.files && typeof v.files === 'object') return v;
  } catch { /* 처음 */ }
  return { version: 1, files: {} };
}
function saveSent(dir, sent) {
  const file = path.join(dir, SENT_FILE);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(sent, null, 2));
  fs.renameSync(tmp, file);
}

const sameFile = (rec, st) => rec && rec.size === st.size && Math.floor(rec.mtimeMs) === Math.floor(st.mtimeMs);
const log = (...a) => console.log(new Date().toLocaleTimeString('ko-KR', { hour12: false }), ...a);

/** 폴더 지켜보기. 시험에서 쓸 수 있게 함수로 둔다. */
export function createSender({ dir, url, device, token, fetchImpl = fetch }) {
  const endpoint = url.replace(/\/+$/, '') + '/api/ingest';
  const seen = new Map(); // 이름 → {size, mtimeMs} 지난 바퀴 크기
  const tries = new Map(); // 이름:크기:시각 → 실패 횟수
  let sent = loadSent(dir);

  async function sendOne(name, abs, st) {
    const buf = fs.readFileSync(abs);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    // 이름만 바뀐 같은 파일이면 보내지 않는다
    const same = Object.entries(sent.files).find(([, r]) => r.sha256 === sha256 && !r.rejected);
    if (same) {
      sent.files[name] = { size: st.size, mtimeMs: st.mtimeMs, sha256, sentAt: new Date().toISOString(), callId: same[1].callId, status: 'duplicate' };
      saveSent(dir, sent);
      log(`건너뜀: ${name} (이미 보낸 ${same[0]} 와 같은 파일)`);
      return 'ok';
    }
    const form = new FormData();
    const ext = path.extname(name).toLowerCase();
    form.append('file', new Blob([buf], { type: MIME[ext] || 'application/octet-stream' }), name);
    form.append('recordedAt', new Date(st.mtimeMs).toISOString());
    form.append('deviceName', device);
    form.append('fake', 'true');
    const caller = callerNumberFromName(name);
    if (caller) form.append('callerNumber', caller);

    let res;
    try {
      res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      log(`실패(연결): ${name} — ${e?.cause?.code || e?.name || '연결 오류'}`);
      return 'retry';
    }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (res.status === 200 || res.status === 201) {
      sent.files[name] = { size: st.size, mtimeMs: st.mtimeMs, sha256, sentAt: new Date().toISOString(), callId: data?.callId ?? null, status: data?.status ?? 'queued' };
      saveSent(dir, sent);
      log(`보냄: ${name} → ${data?.callId ?? '?'} (${data?.status === 'duplicate' ? '이미 있음' : '받아쓰기 줄에 섬'})`);
      return 'ok';
    }
    const why = `${res.status} ${data?.error || ''} ${data?.message || ''}`.trim();
    if (res.status === 401 || (res.status === 503 && data?.error === 'disabled')) {
      log(`멈춤: 서버가 받지 않습니다(${why}). INGEST_TOKEN 과 --url 을 확인해 주세요.`);
      return 'fatal';
    }
    if ([400, 413, 415, 422].includes(res.status)) {
      // 다시 보내도 안 되는 파일: 적어 두고 파일이 바뀌기 전까지 건너뛴다
      sent.files[name] = { size: st.size, mtimeMs: st.mtimeMs, sha256, sentAt: new Date().toISOString(), rejected: true, error: why.slice(0, 200) };
      saveSent(dir, sent);
      log(`안 받음: ${name} — ${why}`);
      return 'ok';
    }
    log(`실패: ${name} — ${why}`);
    return 'retry';
  }

  /** 한 바퀴: 크기가 지난 바퀴와 같은 파일만 보낸다. 'fatal' 이면 멈춰야 한다. */
  async function tick() {
    sent = loadSent(dir);
    let names;
    try {
      names = fs.readdirSync(dir).filter((n) => !n.startsWith('.') && AUDIO_EXT.has(path.extname(n).toLowerCase()));
    } catch (e) {
      log(`폴더를 읽지 못했습니다: ${e?.code || e?.message}`);
      return { sent: 0, waiting: 0 };
    }
    let count = 0;
    let waiting = 0;
    for (const name of names.sort()) {
      const abs = path.join(dir, name);
      let st;
      try { st = fs.statSync(abs); } catch { continue; }
      if (!st.isFile()) continue;
      if (sameFile(sent.files[name], st)) { seen.delete(name); continue; }
      const prev = seen.get(name);
      seen.set(name, { size: st.size, mtimeMs: st.mtimeMs });
      if (!prev || prev.size !== st.size || prev.mtimeMs !== st.mtimeMs || st.size === 0) { waiting += 1; continue; } // 아직 쓰는 중일 수 있음
      if (st.size > MAX_BYTES) {
        sent.files[name] = { size: st.size, mtimeMs: st.mtimeMs, sha256: null, sentAt: new Date().toISOString(), rejected: true, error: '10MB 초과' };
        saveSent(dir, sent);
        log(`안 받음: ${name} — 10MB 가 넘습니다`);
        continue;
      }
      const key = `${name}:${st.size}:${Math.floor(st.mtimeMs)}`;
      const n = tries.get(key) || 0;
      if (n >= MAX_TRIES) continue;
      const r = await sendOne(name, abs, st);
      if (r === 'fatal') return { fatal: true, sent: count, waiting };
      if (r === 'retry') {
        tries.set(key, n + 1);
        if (n + 1 >= MAX_TRIES) log(`포기: ${name} — ${MAX_TRIES}번 실패했습니다. 파일을 다시 넣으면 다시 해 봅니다.`);
      } else {
        count += 1;
      }
    }
    return { sent: count, waiting };
  }

  return { tick, endpoint };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 끝낼 때 process.exit 를 부르지 않고 종료 코드만 돌려준다
// (윈도우에서 fetch 연결이 남은 채 exit 하면 Node 가 0xC0000409 로 죽는 일이 있다).
async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); return 2; }
  if (args.help || !args.dir || !args.url) {
    console.log('사용법: node --env-file=<비밀 env 파일> src/app/tools/folder-sender.mjs --dir <녹음 폴더> --url <서버 주소> [--once] [--device 이름] [--interval 초]');
    return args.help ? 0 : 2;
  }
  const token = (process.env.INGEST_TOKEN || '').trim();
  if (!token) {
    console.error('INGEST_TOKEN 환경변수가 없습니다. --env-file 로 비밀 env 파일을 넘겨 주세요.');
    return 2;
  }
  let u;
  try { u = new URL(args.url); } catch { console.error('--url 이 올바른 주소가 아닙니다.'); return 2; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    console.error('토큰을 지키려고 https 주소만 씁니다(localhost 는 http 가능).');
    return 2;
  }
  const dir = path.resolve(args.dir);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { console.error(`폴더가 없습니다: ${dir}`); return 2; }
  const device = String(args.device || 'folder-sender').replace(/[^\p{L}\p{N}_. -]/gu, '').slice(0, 40) || 'folder-sender';
  const intervalMs = Math.max(200, (Number.isFinite(args.interval) ? args.interval : 5) * 1000);

  const sender = createSender({ dir, url: u.origin + u.pathname, device, token });
  log(`지켜보기 시작: ${dir} → ${sender.endpoint} (기기 이름 ${device}${args.once ? ', 한 바퀴만' : ''})`);
  let stop = false;
  process.on('SIGINT', () => { stop = true; log('끝냅니다.'); });

  if (args.once) {
    // 크기를 두 번 봐야 하므로: 한 번 보고 → 기다렸다 → 보낸다
    await sender.tick();
    await sleep(intervalMs);
    const r = await sender.tick();
    if (r.fatal) return 1;
    log(`한 바퀴 끝: 보낸 것 ${r.sent}개${r.waiting ? ` · 아직 쓰는 중 ${r.waiting}개` : ''}`);
    return 0;
  }
  while (!stop) {
    const r = await sender.tick();
    if (r.fatal) return 1;
    for (let waited = 0; waited < intervalMs && !stop; waited += 200) await sleep(200);
  }
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('오류:', e?.message || e); process.exitCode = 1; });
}
