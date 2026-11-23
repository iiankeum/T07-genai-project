// Ollama 접속 기록에서 카드 만들기 호출(/api/chat)의 걸린 시간만 센다. 기록에는 통화 내용이 없다.
// 쓰는 법: node model-times.mjs [ollama 기록 파일]   (기본: 시험 폴더의 ollama.log)
import fs from 'node:fs';
import path from 'node:path';
import { home } from './_paths.mjs';

const file = process.argv[2] || path.join(home, 'ollama.log');
// Go 의 시간 표기(「6.2s」「1m20.5s」「850ms」)를 초로 바꾼다.
function seconds(text) {
  let s = 0;
  for (const m of text.matchAll(/([\d.]+)(h|ms|µs|us|ns|m|s)/g)) {
    const v = Number(m[1]);
    s += { h: v * 3600, m: v * 60, s: v, ms: v / 1000, 'µs': v / 1e6, us: v / 1e6, ns: v / 1e9 }[m[2]];
  }
  return s;
}

const calls = [];
for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  if (!line.startsWith('[GIN]') || !line.includes('"/api/chat"')) continue;
  const cols = line.split('|').map((c) => c.trim());
  calls.push({ status: cols[1], sec: seconds(cols[2]) });
}
const secs = calls.map((c) => c.sec).sort((a, b) => a - b);
const sum = secs.reduce((a, x) => a + x, 0);
const r1 = (x) => Math.round(x * 10) / 10;
console.log(JSON.stringify({
  호출: calls.length,
  응답코드: calls.reduce((m, c) => (m[c.status] = (m[c.status] || 0) + 1, m), {}),
  합분: r1(sum / 60),
  평균초: r1(sum / (secs.length || 1)),
  중앙값초: r1(secs[Math.floor(secs.length / 2)] ?? 0),
  최장초: r1(secs.at(-1) ?? 0),
  '10초 미만': secs.filter((x) => x < 10).length,
  '10-60초': secs.filter((x) => x >= 10 && x < 60).length,
  '60초 이상': secs.filter((x) => x >= 60).length,
}));
