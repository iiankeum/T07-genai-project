// 주문 카드의 숫자만 낸다(칸이 찼는지 · 몇 개인지 · 경고 종류). 칸에 든 값 자체는 출력하지 않는다.
// 쓰는 법: node card-stats.mjs
import { DatabaseSync } from 'node:sqlite';
import { dbFile } from './_paths.mjs';

const d = new DatabaseSync(dbFile(), { readOnly: true });
const rows = d.prepare(`SELECT k.*, c.duration_sec dur, LENGTH(TRIM(COALESCE(c.transcript, ''))) chars
  FROM cards k JOIN calls c ON c.id = k.call_id`).all();
const J = (s, f) => { try { const v = JSON.parse(s); return v ?? f; } catch { return f; } };
const filled = (v) => v != null && String(v).trim() !== '';
const count = (arr) => arr.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});

const ai = rows.filter((r) => r.ai_model);
const noAi = rows.filter((r) => !r.ai_model);
console.log('전체 카드', rows.length, '· AI 가 만든 카드', ai.length, '· AI 없이 빈 카드', noAi.length);
console.log('빈 카드 이유:', JSON.stringify(count(noAi.map((r) => r.ai_error || '(없음)'))));
if (noAi.length) {
  const chars = noAi.map((r) => r.chars).sort((a, b) => a - b);
  const durs = noAi.map((r) => Math.round(r.dur)).sort((a, b) => a - b);
  console.log('빈 카드 통화의 글 길이(자):', JSON.stringify(chars), '· 녹음 길이(초):', JSON.stringify(durs));
}
console.log('AI 카드 중 오류 표시:', ai.filter((r) => filled(r.ai_error)).length);
console.log('통화 종류:', JSON.stringify(count(ai.map((r) => r.call_type || '(없음)'))));

const orders = ai.filter((r) => r.call_type === '주문');
const stat = (set, name) => {
  const n = set.length || 1;
  const pct = (k) => `${k}/${set.length} (${Math.round(k * 100 / n)}%)`;
  const items = set.map((r) => J(r.items, []));
  const withItems = items.filter((a) => Array.isArray(a) && a.length > 0);
  const itemCount = items.reduce((a, x) => a + (Array.isArray(x) ? x.length : 0), 0);
  const qty = items.flat().filter((it) => it && filled(it.qty)).length;
  const partNo = items.flat().filter((it) => it && filled(it.partNo)).length;
  const unsure = set.map((r) => J(r.unsure, []));
  const ev = set.map((r) => J(r.evidence, {}));
  console.log(`\n[${name}] ${set.length}건`);
  console.log(' 거래처 채움:', pct(set.filter((r) => filled(r.customer)).length));
  console.log(' 담당자 채움:', pct(set.filter((r) => filled(r.contact)).length));
  console.log(' 차종 채움:', pct(set.filter((r) => filled(r.car_model)).length));
  console.log(' 연식 채움:', pct(set.filter((r) => filled(r.model_year)).length));
  console.log(' 차번호 채움:', pct(set.filter((r) => filled(r.plate)).length));
  console.log(' 품목 1개 이상:', pct(withItems.length), '· 품목 합', itemCount, '· 수량 있는 품목', qty, '· 품번 있는 품목', partNo);
  console.log(' 품목 수 분포(5 는 5개 이상):', JSON.stringify(count(items.map((a) => (Array.isArray(a) ? Math.min(a.length, 5) : 0)))));
  console.log(' 급함 표시:', pct(set.filter((r) => r.urgent).length), '· 납기 채움:', pct(set.filter((r) => filled(r.due)).length),
    '· 배송 채움:', pct(set.filter((r) => filled(r.delivery)).length), '· 되물을 것 있음:', pct(set.filter((r) => filled(r.ask_back) && r.ask_back !== '[]').length));
  console.log(' 「확인 필요」 경고가 있는 카드:', pct(unsure.filter((u) => Array.isArray(u) && u.length).length),
    '· 경고 합', unsure.reduce((a, u) => a + (Array.isArray(u) ? u.length : 0), 0));
  console.log(' 경고가 걸린 칸:', JSON.stringify(count(unsure.flat().map((w) => (Number.isInteger(w?.item) ? 'items' : w?.field || 'other')))));
  console.log(' 근거 문장이 달린 칸:', JSON.stringify(count(ev.flatMap((e) => Object.keys(e || {}).map((k) => (k.startsWith('item') ? 'items' : k))))));
};
stat(ai, 'AI 카드 전체');
stat(orders, '그중 주문');
console.log('\n글 길이별 AI 카드 수:', JSON.stringify(count(ai.map((r) => (r.chars < 20 ? '20자 미만' : r.chars < 100 ? '20-100자' : r.chars < 500 ? '100-500자' : '500자 이상')))));
