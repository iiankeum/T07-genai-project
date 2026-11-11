// 주문 카드 보드(F06): 카드가 있는 통화를 「확인 필요 · 확정 · 출고 완료」 세 칸으로 보여 준다.
// 아래 partsText · carText · callHref · customerHref 는 today · shipping · customer 화면도 같이 쓴다.
import { api } from '../api.js';
import { html, render, fmtWhen, toast, confirmBox, errorBox, href } from '../ui.js';

// ── 함께 쓰는 작은 도우미 ─────────────────────────────────────────
/** 부품 줄 요약: 「앞범퍼 1개 · 휀다(운전석) 2개 외 1가지」 */
export function partsText(items, max = 3) {
  const list = (Array.isArray(items) ? items : []).filter((i) => i && i.part);
  if (!list.length) return '부품 정리 전';
  const bits = list.slice(0, max).map((i) => `${i.part}${i.side ? `(${i.side})` : ''} ${qtyText(i.qty)}`);
  if (list.length > max) bits.push(`외 ${list.length - max}가지`);
  return bits.join(' · ');
}
/** 수량 글: 2 → 「2개」, 없으면 「수량 확인」 */
export function qtyText(qty) {
  return qty == null || qty === '' ? '수량 확인' : `${qty}개`;
}
/** 차 요약: 「아반떼 AD · 2017년식 · 12가3456」 */
export function carText(card) {
  if (!card) return '';
  const year = card.modelYear ? `${String(card.modelYear).replace(/년식?$/, '')}년식` : null;
  return [card.carModel, year, card.plate].filter(Boolean).join(' · ');
}
export const callHref = (id) => `#/calls/${encodeURIComponent(id)}`;
export const customerHref = (name) => `#/customers/${encodeURIComponent(name)}`;

// ── 보드 ──────────────────────────────────────────────────────────
const COLS = [
  { key: 'draft', label: '확인 필요', hint: 'AI 가 만든 초안입니다. 열어서 칸을 확인하고 확정하세요.' },
  { key: 'confirmed', label: '확정', hint: '사람이 확인한 주문입니다. 챙겨 보낸 뒤 「출고 완료」를 누르세요.' },
  { key: 'shipped', label: '출고 완료', hint: '나간 주문입니다. 잘못 눌렀으면 「되돌리기」.' },
];
const SHOW_MAX = 30;
const ts = (iso) => Date.parse(iso || '') || 0;

function sortCol(key, list) {
  if (key === 'shipped') return list.sort((a, b) => ts(b.card.shippedAt || b.card.updatedAt) - ts(a.card.shippedAt || a.card.updatedAt));
  return list.sort((a, b) => (Number(b.card.urgent) - Number(a.card.urgent)) || (ts(b.recordedAt) - ts(a.recordedAt)));
}

function cardPiece(call, busy) {
  const c = call.card;
  const askN = Array.isArray(c.askBack) ? c.askBack.length : 0;
  const unsureN = Array.isArray(c.unsure) ? c.unsure.length : 0;
  const car = carText(c);
  const who = c.customer || call.customer || '거래처 확인 필요';
  let action;
  if (c.status === 'draft') {
    action = html`<a class="btn btn-primary btn-block" href="${callHref(call.id)}">열어서 확인</a>`;
  } else if (c.status === 'confirmed') {
    action = html`<button type="button" class="btn btn-ok btn-block" data-act="ship" data-id="${call.id}" ${busy ? html`disabled` : ''}>${busy ? '바꾸는 중…' : '출고 완료'}</button>`;
  } else {
    action = html`<button type="button" class="btn btn-block" data-act="reopen" data-id="${call.id}" ${busy ? html`disabled` : ''}>${busy ? '바꾸는 중…' : '되돌리기'}</button>`;
  }
  return html`<li class="bcard ${c.urgent ? 'bcard-urgent' : ''}">
    <a class="bcard-main" href="${callHref(call.id)}">
      <span class="bcard-top"><strong class="bcard-customer">${who}</strong>${c.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}</span>
      ${car ? html`<span class="bcard-car">${car}</span>` : html`<span class="bcard-car muted">차 정보 없음</span>`}
      <span class="bcard-parts">${partsText(c.items)}</span>
      ${askN || unsureN || c.callback || (c.edited && c.edited.length) || c.customerByPhone ? html`<span class="bcard-flags">
        ${askN ? html`<span class="chip chip-ask">되물을 것 ${askN}</span>` : ''}
        ${unsureN ? html`<span class="listen-flag">들어 보기 ${unsureN}</span>` : ''}
        ${c.callback ? html`<span class="chip chip-callback">다시 전화</span>` : ''}
        ${c.customerByPhone ? html`<span class="chip chip-phone">번호로 확인</span>` : ''}
        ${c.edited && c.edited.length ? html`<span class="chip chip-edited">사람이 고침</span>` : ''}
      </span>` : ''}
      <span class="bcard-when">통화 ${fmtWhen(call.recordedAt)}${c.due ? ` · 원하는 때 ${c.due}` : ''}</span>
    </a>
    <div class="bcard-actions">${action}</div>
  </li>`;
}

export default {
  title: '주문 카드 보드',
  async mount(el, ctx) {
    const ac = new AbortController();
    const st = {
      calls: [],
      loading: true,
      error: null,
      col: COLS.some((c) => c.key === ctx.query.col) ? ctx.query.col : 'draft',
      busy: new Set(),
      showAll: {},
    };
    render(el, html`<div class="page board-page"></div>`);
    const root = el.firstElementChild;
    const alive = () => !ac.signal.aborted && root.isConnected;

    function columns() {
      const by = { draft: [], confirmed: [], shipped: [] };
      for (const call of st.calls) {
        const s = call.card?.status;
        if (by[s]) by[s].push(call);
      }
      for (const k of Object.keys(by)) sortCol(k, by[k]);
      return by;
    }

    function draw() {
      if (!alive()) return;
      const by = columns();
      const working = st.calls.filter((c) => c.status !== 'ready' && c.status !== 'failed').length;
      const head = html`<div class="page-head">
        <div><p class="eyebrow">F06 · 가짜 통화 데모</p><h1>주문 카드 보드</h1>
        <p class="sub">AI 가 만든 카드는 먼저 「확인 필요」에 놓입니다. 사람이 확인해 확정한 것만 출고로 넘어갑니다.</p></div>
        <button type="button" class="btn" data-act="reload" ${st.loading ? html`disabled` : ''}>새로고침</button>
      </div>`;
      if (st.error && !st.calls.length) {
        render(root, html`${head}${errorBox(st.error)}<button type="button" class="btn btn-primary" data-act="reload">다시 불러오기</button>`);
        return;
      }
      if (st.loading && !st.calls.length) {
        render(root, html`${head}<p class="loading"><span class="spinner"></span> 카드를 불러오는 중…</p>`);
        return;
      }
      render(root, html`${head}
        <div class="tabs board-tabs" role="group" aria-label="칸 고르기">
          ${COLS.map((c) => html`<button type="button" class="tab" data-act="col" data-col="${c.key}" aria-pressed="${String(st.col === c.key)}">${c.label} <span class="count">${by[c.key].length}</span></button>`)}
        </div>
        <div class="board-grid">
          ${COLS.map((c) => {
            const list = by[c.key];
            const shown = st.showAll[c.key] ? list : list.slice(0, SHOW_MAX);
            return html`<section class="board-col board-col-${c.key} ${st.col === c.key ? 'is-active' : ''}" aria-label="${c.label}">
              <h2 class="board-col-head"><span>${c.label}</span><span class="board-count">${list.length}</span></h2>
              <p class="board-col-hint">${c.hint}</p>
              ${list.length
                ? html`<ul class="board-list">${shown.map((call) => cardPiece(call, st.busy.has(call.id)))}</ul>`
                : html`<p class="board-empty">${c.key === 'draft' ? '확인할 카드가 없습니다.' : c.key === 'confirmed' ? '확정된 주문이 없습니다.' : '아직 출고한 주문이 없습니다.'}</p>`}
              ${list.length > shown.length ? html`<button type="button" class="btn btn-block board-more" data-act="more" data-col="${c.key}">${list.length - shown.length}장 더 보기</button>` : ''}
            </section>`;
          })}
        </div>
        ${working ? html`<p class="board-note">받아쓰는 중이거나 정리 중인 통화 ${working}건은 다 되면 「확인 필요」에 나타납니다. <a href="${href('/calls', { status: 'working' })}">지금 보기</a></p>` : ''}
        ${st.error ? html`<div class="board-note">${errorBox(st.error)}</div>` : ''}`);
    }

    async function load() {
      st.loading = true;
      draw();
      try {
        const data = await api.get('/api/calls', { status: 'all', limit: 200 }, { signal: ac.signal });
        if (!alive()) return;
        st.calls = Array.isArray(data?.calls) ? data.calls : [];
        st.error = null;
      } catch (err) {
        if (err?.name === 'AbortError' || !alive()) return;
        st.error = err;
      }
      st.loading = false;
      draw();
    }

    async function changeStatus(id, action) {
      const call = st.calls.find((c) => c.id === id);
      if (!call || !call.card || st.busy.has(id)) return;
      const who = call.card.customer || call.customer || '이';
      const ok = await confirmBox(action === 'ship'
        ? `${who} 주문을 「출고 완료」로 옮길까요?`
        : `${who} 주문의 「출고 완료」를 되돌릴까요?`);
      if (!ok || !alive()) return;
      st.busy.add(id);
      draw();
      try {
        const res = await api.post(`/api/cards/${encodeURIComponent(id)}/${action}`, {}, { signal: ac.signal });
        if (!alive()) return;
        if (res?.card) call.card = res.card;
        toast(action === 'ship' ? '출고 완료로 옮겼습니다.' : `되돌렸습니다(${res?.card?.statusLabel || '이전 상태'}).`, 'ok');
        if (!res?.card) { st.busy.delete(id); await load(); return; }
      } catch (err) {
        if (err?.name === 'AbortError' || !alive()) return;
        toast(err?.message || '바꾸지 못했습니다.', 'error');
      }
      st.busy.delete(id);
      draw();
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !root.contains(b)) return;
      const act = b.dataset.act;
      if (act === 'col') { st.col = b.dataset.col; draw(); }
      else if (act === 'reload') load();
      else if (act === 'more') { st.showAll[b.dataset.col] = true; draw(); }
      else if (act === 'ship' || act === 'reopen') changeStatus(b.dataset.id, act);
    }, { signal: ac.signal });

    load();
    return () => ac.abort();
  },
};
