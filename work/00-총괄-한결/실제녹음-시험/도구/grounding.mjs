// 카드에 든 값이 그 통화의 받아쓴 글에 실제로 있는지를 「있다/없다」 개수로만 센다. 값 자체는 출력하지 않는다.
// 예외: 모델이 지어낸 값이 공개 저장소의 프롬프트 · 업종 프로필에 글자 그대로 있는 예시일 때만 그 예시를 보여 준다(고객 자료가 아니다).
// 쓰는 법: ACHA_APP_DIR=<시험하는 아차 코드의 src/app> node grounding.mjs
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { appDir, dbFile } from './_paths.mjs';

const app = appDir();
const d = new DatabaseSync(dbFile(), { readOnly: true });
const rows = d.prepare(`SELECT k.*, c.transcript tx, c.duration_sec dur FROM cards k JOIN calls c ON c.id = k.call_id WHERE k.ai_model IS NOT NULL`).all();
const J = (s, f) => { try { return JSON.parse(s) ?? f; } catch { return f; } };
const norm = (s) => String(s ?? '').replace(/[\s.,!?~·"'“”‘’()\-]/g, '').toLowerCase();
const publicText = norm(['lib/ai.mjs', 'public/js/domain.js', 'lib/cards.mjs'].map((f) => fs.readFileSync(path.join(app, f), 'utf8')).join('\n'));
const inPublic = (v) => { const n = norm(v); return n.length >= 2 && publicText.includes(n); };

const TEMPLATES = [
  ['통화 원문에서 이 값의 근거를 찾지 못해 비웠습니다', '근거 없어 비움'],
  ['원문을 해석하거나 고쳐 읽은 값입니다', '고쳐 읽은 값(남김)'],
  ['부품명이 차종으로 들어가 차종을 비웠습니다', '부품명이 차종 칸에'],
  ['카드 수량', '수량이 인용과 다름'],
];
const reasonKind = (r) => (TEMPLATES.find(([t]) => String(r ?? '').includes(t))?.[1]) ?? '그 밖(품번 · 차번호 형식 · 모델이 쓴 이유)';
// 인용한 말에 수량 표현이 있는지 거칠게 본다(「두 개」「2개」「한 짝」 따위). 차 대수 같은 말도 걸릴 수 있다.
const QTY = /(\d+|한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|하나|둘|셋|넷)\s*(개|짝|대|장|세트|셋트|통|병|박스|쌍|벌|조|알|봉|묶음)/;

const SHORT = '글 20자 미만(공백 · 문장부호 빼고)';
const LONG = '글 20자 이상';
const mk = () => ({ cards: 0, orders: 0, cardsWithItems: 0, items: 0, partInText: 0, partOnlyInPrompt: 0, cardsWithPromptPart: 0,
  quoteGiven: 0, quoteInText: 0, qtyGiven: 0, quoteHasQty: 0, quoteHasQtyButEmpty: 0,
  removed: {}, kept: {}, fromPrompt: {}, promptValues: new Set(), promptParts: new Set() });
const out = { 전체: mk(), [SHORT]: mk(), [LONG]: mk() };

for (const r of rows) {
  const tx = norm(r.tx);
  for (const o of [out.전체, tx.length < 20 ? out[SHORT] : out[LONG]]) {
    o.cards++;
    if (r.call_type === '주문') o.orders++;
    const items = J(r.items, []);
    if (items.length) o.cardsWithItems++;
    let promptPart = false;
    for (const it of items) {
      o.items++;
      const hasQty = it?.qty != null && String(it.qty) !== '';
      if (hasQty) o.qtyGiven++;
      const part = norm(it?.part);
      if (part && tx.includes(part)) o.partInText++;
      else if (inPublic(it?.part)) { o.partOnlyInPrompt++; promptPart = true; o.promptParts.add(String(it.part).trim()); }
      const q = norm(it?.quote);
      if (q) { o.quoteGiven++; if (tx.includes(q)) o.quoteInText++; }
      if (QTY.test(String(it?.quote ?? ''))) { o.quoteHasQty++; if (!hasQty) o.quoteHasQtyButEmpty++; }
    }
    if (promptPart) o.cardsWithPromptPart++;
    for (const w of J(r.unsure, [])) {
      const kind = reasonKind(w?.reason);
      const key = `${w?.field || 'item'} · ${kind}`;
      const bag = kind === '근거 없어 비움' ? o.removed : o.kept;
      bag[key] = (bag[key] || 0) + 1;
      if (kind === '근거 없어 비움' && w?.value && inPublic(w.value)) {
        o.fromPrompt[w.field] = (o.fromPrompt[w.field] || 0) + 1;
        o.promptValues.add(`${w.field}:${String(w.value).trim()}`);
      }
    }
  }
}
for (const [name, o] of Object.entries(out)) {
  console.log(`\n[${name}] 카드 ${o.cards} · 그중 「주문」 ${o.orders} · 품목이 있는 카드 ${o.cardsWithItems}`);
  console.log(' 품목', o.items, '· 부품 이름이 받아쓴 글에 그대로 있음', o.partInText, '· 수량 있음', o.qtyGiven);
  console.log(' 글에는 없고 공개 프롬프트의 예시와 같은 부품 이름', o.partOnlyInPrompt, '· 그런 품목이 든 카드', o.cardsWithPromptPart);
  console.log(' 품목에 인용한 말 있음', o.quoteGiven, '· 그 인용이 받아쓴 글에 실제로 있음', o.quoteInText);
  console.log(' 인용에 수량 말이 있는 품목', o.quoteHasQty, '· 그중 수량 칸이 빈 것', o.quoteHasQtyButEmpty);
  console.log(' 근거 없어 비운 값:', JSON.stringify(o.removed));
  console.log(' 그중 공개 프롬프트 · 업종 프로필의 예시와 글자가 같은 값:', JSON.stringify(o.fromPrompt));
  console.log(' 남기고 경고만 붙인 것:', JSON.stringify(o.kept));
}
console.log('\n공개 프롬프트의 예시를 그대로 가져온 값(저장소에 있는 문자열):', [...out.전체.promptValues].slice(0, 40).join(' | '));
console.log('글에는 없는데 품목에 들어간 예시 부품 이름(저장소에 있는 문자열):', [...out.전체.promptParts].slice(0, 20).join(' | '));
