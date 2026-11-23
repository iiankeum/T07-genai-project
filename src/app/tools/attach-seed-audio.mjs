// 시드 통화(fx-cNN)에 합성 음성(cNN.mp3)을 붙인다. 음성은 저장소 밖에 있고, 이 도구가 서버로 보낸다.
// 쓰는 법(값은 출력하지 않는다):
//   node --env-file=C:\Users\pc\.t07-secrets\ingest.env src/app/tools/attach-seed-audio.mjs --dir C:\Users\pc\.t07-demo-audio\web [--url https://...] [--prefix fx-] [--only c02,c18]
// 환경변수: INGEST_TOKEN(필수), SERVER_URL(--url 이 없을 때)
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
const dir = opt('dir');
const base = (opt('url') || process.env.SERVER_URL || '').replace(/\/+$/, '');
const prefix = opt('prefix', 'fx-');
const only = (opt('only', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const token = process.env.INGEST_TOKEN || '';
if (!dir || !base || !token) {
  console.error('쓰는 법: node --env-file=<ingest.env> attach-seed-audio.mjs --dir <폴더> [--url <서버>]  (INGEST_TOKEN 필요)');
  process.exit(2);
}
const files = readdirSync(dir).filter((f) => /^c\d+\.(mp3|wav|m4a)$/i.test(f)).sort();
let ok = 0; let fail = 0;
for (const f of files) {
  const stem = f.replace(/\.[^.]+$/, '');
  if (only.length && !only.includes(stem)) continue;
  const callId = prefix + stem;
  const fd = new FormData();
  fd.append('callId', callId);
  fd.append('file', new Blob([readFileSync(path.join(dir, f))]), f);
  try {
    const res = await fetch(`${base}/api/admin/seed-audio`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const body = await res.json().catch(() => ({}));
    if (res.ok) { ok++; console.log(`붙임 ${callId} (${body.durationSec}초)`); }
    else { fail++; console.log(`실패 ${callId}: ${res.status} ${body.error || ''} ${body.message || ''}`); if (res.status === 401 || res.status === 503) break; }
  } catch (e) {
    fail++; console.log(`실패 ${callId}: ${e?.message || e}`);
  }
}
console.log(`끝: 붙임 ${ok} · 실패 ${fail}`);
process.exit(fail && !ok ? 1 : 0);
