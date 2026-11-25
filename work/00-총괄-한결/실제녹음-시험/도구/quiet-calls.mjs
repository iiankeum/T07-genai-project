// 받아쓴 글이 거의 없는 통화가 「정말 조용한 녹음」인지 「소리는 있는데 글이 안 나온 것」인지 소리 크기만으로 가른다.
// 받아쓴 글 · 파일 이름은 출력하지 않는다. ffmpeg 가 PATH 에 있어야 한다.
// 쓰는 법: node quiet-calls.mjs
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { workspaceDir, dbFile } from './_paths.mjs';

const ws = workspaceDir();
const d = new DatabaseSync(dbFile(), { readOnly: true });
const rows = d.prepare('SELECT id, duration_sec dur, audio_file f, LENGTH(TRIM(COALESCE(transcript, \'\'))) chars FROM calls').all();

function sound(file, dur) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path.join(ws, file),
    '-af', 'silencedetect=noise=-35dB:d=0.3,volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const err = r.stderr || '';
  const mean = Number(/mean_volume: (-?[\d.]+) dB/.exec(err)?.[1]);
  let silent = 0;
  for (const m of err.matchAll(/silence_duration: ([\d.]+)/g)) silent += Number(m[1]);
  return { mean, voiced: Math.max(0, dur - silent) };
}

const groups = { '글 20자 미만': [], '분당 60자 미만(20자 이상)': [], '그 밖': [] };
for (const r of rows) {
  const s = sound(r.f, r.dur);
  const perMin = r.dur > 0 ? r.chars * 60 / r.dur : 0;
  const g = r.chars < 20 ? '글 20자 미만' : perMin < 60 ? '분당 60자 미만(20자 이상)' : '그 밖';
  groups[g].push({ dur: r.dur, chars: r.chars, ...s });
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
for (const [name, g] of Object.entries(groups)) {
  console.log(name, JSON.stringify({
    통화수: g.length,
    길이중앙값초: r1(med(g.map((x) => x.dur))),
    길이합분: r1(g.reduce((a, x) => a + x.dur, 0) / 60),
    소리나는구간중앙값초: r1(med(g.map((x) => x.voiced))),
    평균음량중앙값dB: r1(med(g.map((x) => x.mean))),
    '소리 10초 이상인 통화': g.filter((x) => x.voiced >= 10).length,
    '소리 30초 이상인 통화': g.filter((x) => x.voiced >= 30).length,
  }));
}
