// 방문 수(개인 식별 없이 숫자만): /intro/ 와 데모 첫 화면을 ?src= 별로 하루 단위로 센다.
// 같은 사람(IP 해시)이 같은 날 같은 곳을 여러 번 열어도 한 번만 센다(메모리, 서버를 다시 띄우면 새로 셈).
// 하루에 서로 다른 src 는 50개까지만 따로 세고, 넘으면 'other' 로 묶는다(아무 값이나 넣어 표를 불리지 못하게).
import { db } from './db.mjs';
import { ipHash, kstDay } from './security.mjs';

const MAX_SRC_PER_DAY = 50;
const seen = new Set();
const srcs = new Set(); // 오늘 따로 세는 src
let seenDay = '';

export function cleanSrc(v) {
  const s = String(v || '').trim().toLowerCase().slice(0, 32);
  return /^[a-z0-9_.-]+$/.test(s) ? s : '';
}

/** 날이 바뀌면(또는 서버를 다시 띄우면) 오늘 이미 센 src 를 DB 에서 다시 읽는다 */
function startDay(day) {
  seen.clear();
  srcs.clear();
  seenDay = day;
  try {
    for (const r of db().prepare("SELECT kind FROM usage WHERE day = ? AND kind LIKE 'visit:%'").all(day)) {
      const src = r.kind.split(':')[2];
      if (src && src !== 'direct' && src !== 'other') srcs.add(src);
    }
  } catch { /* 못 읽으면 빈 채로 */ }
}

/** 처음 보는 src 가 오늘 50개를 넘으면 'other' */
function bucketSrc(src) {
  if (!src || src === 'other' || srcs.has(src)) return src;
  if (srcs.size >= MAX_SRC_PER_DAY) return 'other';
  srcs.add(src);
  return src;
}

/** @param {'intro'|'demo'} page */
export function countVisit(page, src, ip) {
  try {
    const day = kstDay();
    if (day !== seenDay) startDay(day);
    if (seen.size > 50_000) return; // 비정상적으로 많으면 그만 센다
    const s = bucketSrc(src);
    const key = `${page}|${s}|${ipHash(ip)}`;
    if (seen.has(key)) return;
    seen.add(key);
    db().prepare('INSERT INTO usage(day, kind, count) VALUES(?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1')
      .run(day, `visit:${page}:${s || 'direct'}`);
  } catch { /* 방문 수는 실패해도 화면은 돈다 */ }
}

/** 최근 days 일 방문 수 [{day, page, src, count}] */
export function visitStats(days = 14) {
  const from = kstDay(new Date(Date.now() - (days - 1) * 86_400_000));
  return db().prepare("SELECT day, kind, count FROM usage WHERE kind LIKE 'visit:%' AND day >= ? ORDER BY day DESC, kind").all(from)
    .map((r) => { const [, page, src] = r.kind.split(':'); return { day: r.day, page, src, count: r.count }; });
}
