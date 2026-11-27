// 받아쓰기까지의 숫자만 낸다. 받아쓴 글 · 거래처 · 파일 이름은 읽어 오지 않는다(길이 · 개수만).
// 쓰는 법: node stats.mjs [--brief]
import { DatabaseSync } from 'node:sqlite';
import { dbFile } from './_paths.mjs';

const d = new DatabaseSync(dbFile(), { readOnly: true });
const all = (sql) => d.prepare(sql).all();
const one = (sql) => d.prepare(sql).get();
const brief = process.argv.includes('--brief');

const byStatus = all('SELECT status, COUNT(*) n FROM calls GROUP BY status ORDER BY n DESC');
const jobs = all('SELECT state, COUNT(*) n FROM jobs GROUP BY state ORDER BY n DESC');
const total = one('SELECT COUNT(*) n FROM calls').n;
const pending = one("SELECT COUNT(*) n FROM calls WHERE status IN ('queued','transcribing','extracting')").n;
console.log(JSON.stringify({ total, pending, byStatus, jobs }));
if (brief) process.exit(0);

const durs = all('SELECT duration_sec dur FROM calls WHERE duration_sec > 0').map((r) => r.dur).sort((a, b) => a - b);
const r1 = (x) => Math.round(x * 10) / 10;
const bucket = (s) => (s < 30 ? 'a.30초 미만' : s < 60 ? 'b.30초-1분' : s < 180 ? 'c.1-3분' : s < 300 ? 'd.3-5분' : 'e.5분 이상');
const count = (arr) => arr.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
console.log('녹음 길이(초):', JSON.stringify({ 최단: r1(durs[0]), 중앙값: r1(durs[Math.floor(durs.length / 2)]), 최장: r1(durs.at(-1)) }));
console.log('녹음 길이 분포(통화 수):', JSON.stringify(count(durs.map(bucket))));

const t = one(`SELECT COUNT(*) n, ROUND(SUM(duration_sec)/60.0,1) audioMin, ROUND(SUM(stt_elapsed_sec)/60.0,1) sttMin,
  ROUND(AVG(stt_elapsed_sec),1) avgStt, ROUND(MAX(stt_elapsed_sec),1) maxStt,
  ROUND(AVG(LENGTH(transcript)),0) avgChars, MIN(LENGTH(transcript)) minChars, MAX(LENGTH(transcript)) maxChars
  FROM calls WHERE transcript IS NOT NULL`);
console.log('받아쓴 통화:', JSON.stringify(t));
console.log('글이 비었거나 20자 미만:', one("SELECT COUNT(*) n FROM calls WHERE status='ready' AND (transcript IS NULL OR LENGTH(TRIM(transcript)) < 20)").n);
console.log('분당 글자 수 분포(통화 수):', JSON.stringify(all(`SELECT CASE
  WHEN LENGTH(transcript)*60.0/duration_sec < 60 THEN 'a.60자 미만'
  WHEN LENGTH(transcript)*60.0/duration_sec < 150 THEN 'b.60-150'
  WHEN LENGTH(transcript)*60.0/duration_sec < 300 THEN 'c.150-300'
  ELSE 'd.300 이상' END bucket, COUNT(*) n FROM calls WHERE transcript IS NOT NULL AND duration_sec > 0 GROUP BY bucket ORDER BY bucket`)));
console.log('실패 이유(통화):', JSON.stringify(all("SELECT error, COUNT(*) n FROM calls WHERE status='failed' GROUP BY error")));
console.log('일감 재시도:', JSON.stringify(all('SELECT attempts, COUNT(*) n FROM jobs GROUP BY attempts ORDER BY attempts')));
console.log('엔진:', JSON.stringify(all('SELECT engine, COUNT(*) n FROM calls WHERE engine IS NOT NULL GROUP BY engine')));
console.log('카드:', JSON.stringify(all(`SELECT status, call_type, ai_model, COUNT(*) n,
  SUM(CASE WHEN customer IS NOT NULL AND customer <> '' THEN 1 ELSE 0 END) customerFilled,
  SUM(CASE WHEN car_model IS NOT NULL AND car_model <> '' THEN 1 ELSE 0 END) carFilled,
  SUM(CASE WHEN items IS NOT NULL AND items NOT IN ('', '[]') THEN 1 ELSE 0 END) itemsFilled,
  SUM(CASE WHEN ai_error IS NOT NULL AND ai_error <> '' THEN 1 ELSE 0 END) aiError
  FROM cards GROUP BY status, call_type, ai_model`)));
