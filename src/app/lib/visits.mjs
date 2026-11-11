// 방문 수(개인 식별 없이 숫자만): /intro/ 와 데모 첫 화면을 ?src= 별로 하루 단위로 센다.
// 같은 사람(IP 해시)이 같은 날 같은 곳을 여러 번 열어도 한 번만 센다(메모리, 서버를 다시 띄우면 새로 셈).
import { db } from './db.mjs';
import { ipHash, kstDay } from './security.mjs';

const seen = new Set();
let seenDay = '';

export function cleanSrc(v) {
  const s = String(v || '').trim().toLowerCase().slice(0, 32);
  return /^[a-z0-9_.-]+$/.test(s) ? s : '';
}

/** @param {'intro'|'demo'} page */
export function countVisit(page, src, ip) {
  try {
    const day = kstDay();
    if (day !== seenDay) { seen.clear(); seenDay = day; }
    const key = `${page}|${src}|${ipHash(ip)}`;
    if (seen.has(key)) return;
    if (seen.size > 50_000) return; // 비정상적으로 많으면 그만 센다
    seen.add(key);
    db().prepare('INSERT INTO usage(day, kind, count) VALUES(?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1')
      .run(day, `visit:${page}:${src || 'direct'}`);
  } catch { /* 방문 수는 실패해도 화면은 돈다 */ }
}

/** 최근 days 일 방문 수 [{day, page, src, count}] */
export function visitStats(days = 14) {
  const from = kstDay(new Date(Date.now() - (days - 1) * 86_400_000));
  return db().prepare("SELECT day, kind, count FROM usage WHERE kind LIKE 'visit:%' AND day >= ? ORDER BY day DESC, kind").all(from)
    .map((r) => { const [, page, src] = r.kind.split(':'); return { day: r.day, page, src, count: r.count }; });
}
