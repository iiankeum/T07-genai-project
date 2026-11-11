// seed/*.json 검사 · 미리 보기: 근거 문장을 못 찾은 칸, 같은 id, 상태 오류를 알려 준다(DB 는 건드리지 않음).
// 실행: node tools/build-seed.mjs        (src/app 에서)   자세히: node tools/build-seed.mjs --verbose
import { loadSeedFiles, buildSeedCall, seedAnchorMs } from '../lib/seed.mjs';
import { kstTime } from '../lib/repo.mjs';

const verbose = process.argv.includes('--verbose');
const data = loadSeedFiles();
const anchorMs = seedAnchorMs();
const ids = new Set();
const errors = [];
const warnings = [];
const count = { draft: 0, confirmed: 0, shipped: 0, cancelled: 0, callback: 0, urgent: 0, unsure: 0, yesterday: 0 };

console.log(`파일: ${data.files.join(', ') || '(없음)'} · 사전 ${data.glossary.length} · 거래처 ${data.customers.length}`);
for (const sc of data.calls) {
  if (!sc?.id) { errors.push(`${sc?._file}: id 가 없는 통화`); continue; }
  if (ids.has(sc.id)) errors.push(`${sc.id}: 같은 id 가 또 있음`);
  ids.add(sc.id);
  if (!Array.isArray(sc.turns) || !sc.turns.length) { errors.push(`${sc.id}: turns 가 없음`); continue; }
  if (!['draft', 'confirmed', 'shipped', 'cancelled'].includes(sc.status)) warnings.push(`${sc.id}: status 「${sc.status}」 → draft 로 넣음`);
  const { call, card, warnings: w } = buildSeedCall(sc, { anchorMs, customers: data.customers });
  warnings.push(...w);
  count[card.status] = (count[card.status] || 0) + 1;
  if (card.callback) count.callback++;
  if (card.urgent) count.urgent++;
  if (JSON.parse(card.unsure).length) count.unsure++;
  if (Number(sc.offsetMin || 0) < 0 && Date.parse(call.recorded_at) < anchorMs - 9 * 3600_000) count.yesterday++;
  if (verbose) {
    console.log(`- ${call.id} ${kstTime(call.recorded_at)} [${card.status}${card.callback ? '·다시 전화' : ''}] ${call.title}`);
    console.log(`    ${call.summary}`);
  }
}
console.log(`통화 ${ids.size}건 · 확인 필요 ${count.draft}(다시 전화 ${count.callback}) · 확정 ${count.confirmed} · 출고 ${count.shipped} · 급함 ${count.urgent} · 들어 보기 ${count.unsure} · 어제 이전 ${count.yesterday}`);
for (const w of warnings) console.log('주의:', w);
for (const e of errors) console.log('오류:', e);
process.exitCode = errors.length ? 1 : 0;
