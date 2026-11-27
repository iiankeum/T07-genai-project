// 같은 통화를 두 모델로 정리한 카드를 견준다. 개수만 낸다(칸에 든 값 · 경고에 적힌 글은 출력하지 않는다).
// 두 시험 폴더는 같은 받아쓰기 결과에서 갈라진 것이어야 한다(통화 번호가 같다).
// 쓰는 법: node compare-models.mjs <시험 폴더 A> <시험 폴더 B>
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const [homeA, homeB] = process.argv.slice(2);
if (!homeA || !homeB) { console.error('시험 폴더 두 개를 준다.'); process.exit(1); }

function load(home) {
  const ws = fs.readFileSync(path.join(home, 'workspace-id.txt'), 'utf8').split(/\r?\n/)[0].trim();
  const d = new DatabaseSync(path.join(home, 'data', 'workspaces', ws, 'callnote.sqlite'), { readOnly: true });
  const rows = d.prepare(`SELECT k.*, c.transcript tx FROM cards k JOIN calls c ON c.id = k.call_id`).all();
  return new Map(rows.map((r) => [r.call_id, r]));
}
const A = load(homeA);
const B = load(homeB);
const J = (s, f) => { try { return JSON.parse(s) ?? f; } catch { return f; } };
const norm = (s) => String(s ?? '').replace(/[\s.,!?~·"'“”‘’()\-]/g, '').toLowerCase();
const filled = (v) => v != null && String(v).trim() !== '';
const bump = (m, k) => { m[k] = (m[k] || 0) + 1; };
const nameOf = (m) => [...m.values()].find((r) => r.ai_model)?.ai_model ?? '(없음)';
console.log(`A = ${nameOf(A)} · B = ${nameOf(B)}`);

const both = [...A.keys()].filter((id) => A.get(id).ai_model && B.get(id)?.ai_model);
console.log(`통화 ${A.size} · A 카드 ${[...A.values()].filter((r) => r.ai_model).length} · B 카드 ${[...B.values()].filter((r) => r.ai_model).length} · 둘 다 카드가 있는 통화 ${both.length}`);

// 1. 통화 종류가 어떻게 갈렸나(A 종류 → B 종류)
const types = {};
for (const id of both) bump(types, `${A.get(id).call_type || '(없음)'} → ${B.get(id).call_type || '(없음)'}`);
console.log('\n[통화 종류] A → B:', JSON.stringify(types));
console.log(' 같은 종류로 본 통화:', both.filter((id) => A.get(id).call_type === B.get(id).call_type).length, '/', both.length);

// 2. 글 길이별 「주문」 수
const bucket = (r) => { const n = norm(r.tx).length; return n < 20 ? '20자 미만' : n < 100 ? '20-100자' : n < 500 ? '100-500자' : '500자 이상'; };
const byLen = {};
for (const id of both) {
  const k = bucket(A.get(id));
  byLen[k] ??= { 통화: 0, 'A 주문': 0, 'B 주문': 0 };
  byLen[k].통화++;
  if (A.get(id).call_type === '주문') byLen[k]['A 주문']++;
  if (B.get(id).call_type === '주문') byLen[k]['B 주문']++;
}
console.log('[글 길이별 「주문」으로 본 통화]', JSON.stringify(byLen));

// 3. 칸마다 두 모델의 값이 같은가
console.log('\n[칸의 값이 같은가] 둘 다 빔 / A 만 / B 만 / 둘 다 있고 같음 / 둘 다 있고 다름');
for (const [label, col] of [['거래처', 'customer'], ['담당자', 'contact'], ['차종', 'car_model'], ['연식', 'model_year'], ['차번호', 'plate'], ['납기', 'due'], ['배송', 'delivery']]) {
  const c = [0, 0, 0, 0, 0];
  for (const id of both) {
    const a = A.get(id)[col]; const b = B.get(id)[col];
    if (!filled(a) && !filled(b)) c[0]++;
    else if (filled(a) && !filled(b)) c[1]++;
    else if (!filled(a) && filled(b)) c[2]++;
    else if (norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a))) c[3]++;
    else c[4]++;
  }
  console.log(` ${label}: ${c.join(' / ')}`);
}

// 4. 품목
let sameCount = 0; let partsA = 0; let partsB = 0; let common = 0;
for (const id of both) {
  const a = J(A.get(id).items, []).map((it) => norm(it?.part)).filter(Boolean);
  const b = J(B.get(id).items, []).map((it) => norm(it?.part)).filter(Boolean);
  if (a.length === b.length) sameCount++;
  partsA += a.length; partsB += b.length;
  const rest = [...b];
  for (const p of a) {
    const i = rest.findIndex((q) => q === p || q.includes(p) || p.includes(q));
    if (i >= 0) { common++; rest.splice(i, 1); }
  }
}
console.log(`\n[품목] 품목 수가 같은 통화 ${sameCount}/${both.length} · A 품목 ${partsA} · B 품목 ${partsB} · 부품 이름이 겹치는 품목 ${common}`);

// 5. 수량 칸에 든 수의 분포와, 인용한 말에 수량 표현이 있는지
// grounding.mjs 보다 넓게 본다 — 단위 없이 「하나」「둘」이라고만 한 말도 수량 말로 친다. 그래도 거친 어림이다.
const QTY = /(\d+|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*(개|짝|대|장|세트|셋트|통|병|박스|쌍|벌|조|알|봉|묶음)|하나|둘|셋|넷|한쪽|양쪽|한 쪽|양 쪽/;
for (const [name, M] of [['A', A], ['B', B]]) {
  const dist = {}; let withWord = 0; let oneNoWord = 0; let total = 0;
  for (const r of M.values()) {
    if (!r.ai_model) continue;
    for (const it of J(r.items, [])) {
      total++;
      if (it?.qty == null || String(it.qty) === '') { bump(dist, '빔'); continue; }
      const n = Number(it.qty);
      bump(dist, Number.isFinite(n) ? (n === 1 ? '1' : n === 2 ? '2' : n <= 5 ? '3-5' : '6 이상') : '수가 아님');
      const word = QTY.test(String(it?.quote ?? ''));
      if (word) withWord++;
      if (n === 1 && !word) oneNoWord++;
    }
  }
  console.log(`[수량 · ${name}] 품목 ${total} · 분포 ${JSON.stringify(dist)} · 수량이 있고 인용에 수량 말도 있음 ${withWord} · 수량이 1 인데 인용에 수량 말이 없음 ${oneNoWord}`);
}

// 6. 「확인 필요」 경고 — 모델이 스스로 적은 것인지, 코드의 근거 검사가 붙인 것인지
// 코드(lib/cards.mjs)가 붙이는 문구. 여기에 없는 글은 모델이 적은 것으로 센다.
const CODE = [
  ['통화 원문에서 이 값의 근거를 찾지 못해 비웠습니다', '근거 없어 비움'],
  ['원문을 해석하거나 고쳐 읽은 값입니다', '고쳐 읽은 값'],
  ['부품명이 차종으로 들어가 차종을 비웠습니다', '부품명이 차종 칸에'],
  ['카드 수량', '수량이 인용과 다름'],
  ['통화에 품번을 불러 준 말이 없어 비웠습니다', '품번 말이 없어 비움'],
  ['이 품번을 불러 준 말을 찾지 못해 비웠습니다', '그 품번을 부른 말이 없어 비움'],
  ['자릿수가 보통과 다릅니다', '품번 자릿수'],
  ['차번호 형식이 맞지 않아 비웠습니다', '차번호 형식이 안 맞아 비움'],
];
const COLUMN = { customer: 'customer', contact: 'contact', carModel: 'car_model', modelYear: 'model_year', plate: 'plate', due: 'due', delivery: 'delivery' };
for (const [name, M] of [['A', A], ['B', B]]) {
  let cards = 0; let total = 0; let byModel = 0; let blocking = 0; let noValue = 0; let cardsWithModel = 0;
  const perCard = [];
  const kinds = {}; const fields = {}; const texts = new Map(); const plateShape = {}; const onEmpty = {};
  for (const r of M.values()) {
    if (!r.ai_model) continue;
    cards++;
    const list = J(r.unsure, []);
    perCard.push(list.length);
    let own = 0;
    for (const w of list) {
      total++;
      if (w?.blocking) blocking++;
      const reason = String(w?.reason ?? '');
      const kind = CODE.find(([t]) => reason.includes(t))?.[1];
      if (kind) {
        bump(kinds, kind);
        if (kind === '차번호 형식이 안 맞아 비움') {
          const v = String(w?.value ?? '').replace(/\s/g, '');
          bump(plateShape, /^\d{4}$/.test(v) ? '숫자 네 자리뿐' : /^\d+$/.test(v) ? '숫자뿐(네 자리 아님)' : /[가-힣]/.test(v) ? '한글이 섞임' : '그 밖');
        }
        continue;
      }
      byModel++; own++;
      bump(fields, w?.field || '(칸 없음)');
      // 그 칸이 비어 있고, 코드가 그 칸의 값을 지운 것도 아닌 카드에 붙은 경고 = 「말하지 않았다」를 경고로 적은 것일 가능성이 크다
      const col = COLUMN[w?.field];
      if (col && !filled(r[col]) && !list.some((x) => x !== w && x?.field === w.field && CODE.some(([t]) => String(x?.reason ?? '').includes(t)))) bump(onEmpty, w.field);
      texts.set(reason, (texts.get(reason) || 0) + 1);
      if (!filled(w?.value)) noValue++;
    }
    if (own) cardsWithModel++;
  }
  perCard.sort((x, y) => x - y);
  console.log(`[경고 · ${name}] 카드 ${cards} · 경고 ${total}(카드당 중앙값 ${perCard[Math.floor(perCard.length / 2)] ?? 0} · 최대 ${perCard.at(-1) ?? 0}) · 막는 경고 ${blocking}`);
  console.log(`  코드가 붙인 것: ${JSON.stringify(kinds)}`);
  console.log(`  모델이 적은 것 ${byModel}(카드 ${cardsWithModel}건) · 서로 다른 글 ${texts.size} · 칸: ${JSON.stringify(fields)}`);
  console.log(`  그중 처음부터 빈 칸에 붙은 것: ${JSON.stringify(onEmpty)}`);
  console.log(`  형식이 안 맞아 비워진 차번호의 꼴: ${JSON.stringify(plateShape)}`);
}
