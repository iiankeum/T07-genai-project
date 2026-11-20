// 주문 카드 보드(F06): 카드가 있는 통화를 「확인 필요 · 확정 · 출고 완료」 세 칸으로 보여 준다.
// 아래 partsText · carText · callHref · customerHref 는 today · shipping · customer 화면도 같이 쓴다.
import { api, getMeta } from '../api.js';
import { isShipTarget, pendingWarnings } from '../domain.js';
import { html, render, fmtWhen, toast, confirmBox, errorBox, href } from '../ui.js';

// ── 함께 쓰는 작은 도우미 ─────────────────────────────────────────
/** 부품 줄 요약: 「앞범퍼 1개 · 휀다(운전석) 2개 외 1가지」 */
export function partsText(items, max = 3, callType) {
  const list = (Array.isArray(items) ? items : []).filter((i) => i && i.part);
  if (!list.length) return callType && callType !== '주문' ? `${callType} — 부품 없음` : '부품 정리 전';
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
  { key: 'draft', label: '확인 필요', empty: '확인할 카드가 없습니다.' },
  { key: 'confirmed', label: '확정', empty: '확정된 카드가 없습니다.' },
  { key: 'shipped', label: '출고 완료', empty: '아직 출고한 주문이 없습니다.' },
];
const SORTS = [
  ['board', '긴급 우선'],
  ['dueDate', '희망 일정 날짜순'],
  ['due', '희망 일정 문구순'],
  ['customer', '거래처순'],
];
const PAGE = 30;

function cardPiece(call, busy, canShip) {
  const c = call.card;
  const askN = c.askBack?.length || 0;
  const unsureN = pendingWarnings(c).length;
  const car = carText(c);
  const who = c.customer || call.customer || '거래처 확인 필요';
  const numbers = c.items.filter((item) => item?.partNo).slice(0, 3).map((item) => item.partNo).join(' · ');
  let action;
  if (c.status === 'draft') {
    action = html`<a class="btn btn-primary btn-block" href="${callHref(call.id)}">열어서 확인</a>`;
  } else if (c.status === 'confirmed' && isShipTarget(c) && canShip) {
    action = html`<button type="button" class="btn btn-ok btn-block" data-act="ship" data-id="${call.id}" ${busy ? html`disabled` : ''}>${busy ? '바꾸는 중…' : '출고 완료로 변경'}</button>`;
  } else if (c.status === 'shipped' && canShip) {
    action = html`<button type="button" class="btn btn-block" data-act="unship" data-id="${call.id}" ${busy ? html`disabled` : ''}>${busy ? '바꾸는 중…' : '출고 되돌리기'}</button>`;
  }
  return html`<li class="bcard ${c.urgent ? 'bcard-urgent' : ''}">
    <a class="bcard-main" href="${callHref(call.id)}">
      <span class="bcard-top"><strong class="bcard-customer">${who}</strong>${c.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}</span>
      ${car ? html`<span class="bcard-car">${car}</span>` : ''}
      <span class="bcard-parts">${partsText(c.items, 3, c.callType)}</span>
      ${numbers ? html`<span class="bcard-car">품번 ${numbers}</span>` : ''}
      ${askN || unsureN || c.callback || c.edited?.length || c.customerByPhone || (c.status === 'confirmed' && !isShipTarget(c)) ? html`<span class="bcard-flags">
        ${askN ? html`<span class="chip chip-ask">되물을 것 ${askN}</span>` : ''}
        ${unsureN ? html`<span class="listen-flag">재확인 ${unsureN}</span>` : ''}
        ${c.callback ? html`<span class="chip chip-callback">다시 전화</span>` : ''}
        ${c.customerByPhone ? html`<span class="chip chip-phone">번호로 확인</span>` : ''}
        ${c.edited?.length ? html`<span class="chip chip-edited">사람이 고침</span>` : ''}
        ${c.status === 'confirmed' && !isShipTarget(c) ? html`<span class="chip chip-confirmed">통화 처리 완료</span>` : ''}
      </span>` : ''}
      <span class="bcard-when">통화 ${fmtWhen(call.recordedAt)}${c.due ? ' · 원하는 때 ' + c.due : ''}</span>
    </a>
    ${action ? html`<div class="bcard-actions">${action}</div>` : ''}
  </li>`;
}

export default {
  title: '주문 카드 보드',
  async mount(el, ctx) {
    const ac = new AbortController();
    const columns = Object.fromEntries(COLS.map(({ key }) => [key, { calls: [], total: null, next: 0, request: 0, loading: false, error: null }]));
    const state = {
      col: COLS.some(({ key }) => key === ctx.query.col) ? ctx.query.col : 'draft',
      sort: SORTS.some(([key]) => key === ctx.query.sort) ? ctx.query.sort : 'board',
      customer: String(ctx.query.customer || ''),
      customers: [],
      working: 0,
      busy: new Set(),
      canShip: false,
    };
    render(el, html`<div class="page board-page"></div>`);
    const root = el.firstElementChild;
    const alive = () => !ac.signal.aborted && root.isConnected;

    function columnView({ key, label, empty }) {
      const col = columns[key];
      const remaining = Math.max(0, col.total - col.next);
      return html`<section class="board-col board-col-${key} ${state.col === key ? 'is-active' : ''}" aria-label="${label}">
        <h2 class="board-col-head"><span>${label}</span><span class="board-count">${col.total ?? '…'}</span></h2>
        ${col.calls.length ? html`<ul class="board-list">${col.calls.map((call) => cardPiece(call, state.busy.has(call.id), state.canShip))}</ul>` : ''}
        ${col.loading ? html`<p class="loading" role="status">카드를 불러오는 중…</p>` : ''}
        ${col.error ? html`${errorBox(col.error)}<button type="button" class="btn" data-act="retry" data-col="${key}">다시 불러오기</button>` : ''}
        ${!col.loading && !col.error && col.total === 0 ? html`<p class="board-empty">${empty}</p>` : ''}
        ${remaining > 0 && !col.loading && !col.error ? html`<button type="button" class="btn btn-block board-more" data-act="more" data-col="${key}">더 보기 (${remaining}건 남음)</button>` : ''}
      </section>`;
    }

    function draw() {
      if (!alive()) return;
      // 열 응답으로 DOM이 교체돼도 키보드 필터/탭 위치만 유지한다. 다른 영역의 포커스는 건드리지 않는다.
      const focused = document.activeElement;
      const filter = root.contains(focused) && ['customer', 'sort'].includes(focused?.dataset?.filter) ? focused.dataset.filter : null;
      const tab = root.contains(focused) && focused?.dataset?.act === 'col' && COLS.some(({ key }) => key === focused.dataset.col) ? focused.dataset.col : null;
      const customers = new Set(state.customers.map(({ name }) => name));
      if (state.customer) customers.add(state.customer);
      render(root, html`<div class="page-head">
        <div><p class="eyebrow">주문 진행 상황</p><h1>주문 보드</h1><p class="sub">확인이 필요한 주문부터 출고까지, 한눈에 관리하세요.</p></div>
        <div class="row">
          <a class="btn" href="#/shipping">출고 목록</a>
          <button type="button" class="btn" data-act="reload">새로고침</button>
        </div>
      </div>
      <div class="row board-filters">
        <label class="field"><span>거래처</span><select class="select" data-filter="customer">
          <option value="">모든 거래처</option>
          ${[...customers].map((name) => html`<option value="${name}" ${state.customer === name ? html`selected` : ''}>${name}</option>`)}
        </select></label>
        <label class="field"><span>정렬</span><select aria-describedby="board-due-sort-help" class="select" data-filter="sort">
          ${SORTS.map(([key, text]) => html`<option value="${key}" ${state.sort === key ? html`selected` : ''}>${text}</option>`)}
        </select></label>
        <p class="help" id="board-due-sort-help">날짜순: YYYY-MM-DD · 오늘/내일(통화일 기준, 한국시간), 날짜 뒤 HH:mm만 해석합니다. 같은 날 시각 미정은 먼저, 해석할 수 없는 문구는 마지막에 둡니다.</p>
      </div>
      <div class="tabs board-tabs" role="group" aria-label="칸 고르기">
        ${COLS.map(({ key, label }) => html`<button type="button" class="tab" data-act="col" data-col="${key}" aria-pressed="${state.col === key}">${label} <span class="count">${columns[key].total ?? '…'}</span></button>`)}
      </div>
      <div class="board-grid">${COLS.map(columnView)}</div>
      ${state.working ? html`<p class="board-note"><a href="${href('/calls', { status: 'working' })}">받아쓰기·정리 중인 통화 ${state.working}건 보기</a></p>` : ''}`);
      if (filter) root.querySelector(`[data-filter="${filter}"]`)?.focus({ preventScroll: true });
      else if (tab) root.querySelector(`[data-act="col"][data-col="${tab}"]`)?.focus({ preventScroll: true });
    }

    async function loadColumn(key, { append = false } = {}) {
      const col = columns[key];
      if (append && col.loading) return;
      const request = ++col.request;
      if (!append) Object.assign(col, { calls: [], total: null, next: 0 });
      col.loading = true;
      col.error = null;
      draw();
      try {
        const data = await api.get('/api/calls', {
          status: key, sort: state.sort, customer: state.customer || undefined, limit: PAGE, offset: col.next,
        }, { signal: ac.signal });
        if (!alive() || col.request !== request) return;
        const loaded = data.calls || [];
        const ids = new Set(col.calls.map((call) => call.id));
        col.calls.push(...loaded.filter((call) => !ids.has(call.id)));
        col.total = data.total;
        col.next += loaded.length;
        if (!loaded.length) col.next = col.total;
      } catch (e) {
        if (alive() && col.request === request) col.error = e;
      } finally {
        if (alive() && col.request === request) {
          col.loading = false;
          draw();
        }
      }
    }

    function load() { return Promise.all(COLS.map(({ key }) => loadColumn(key))); }

    async function changeStatus(id, action) {
      const call = Object.values(columns).flatMap((col) => col.calls).find((item) => item.id === id);
      if (!call || !state.canShip || state.busy.has(id)) return;
      const who = call.card.customer || call.customer || '이 거래처';
      state.busy.add(id);
      try {
        const ok = await confirmBox(action === 'ship'
          ? who + ' 주문을 출고 완료로 변경할까요?'
          : who + ' 주문의 출고를 되돌릴까요? 확정 상태로 돌아갑니다.');
        if (!ok || !alive()) return;
        draw();
        await api.post('/api/cards/' + encodeURIComponent(id) + '/' + action, { expectedRevision: call.card.revision }, { signal: ac.signal });
        if (!alive()) return;
        toast(action === 'ship' ? '출고 완료로 옮겼습니다.' : '확정 상태로 되돌렸습니다.', 'ok');
        await load();
      } catch (err) {
        if (alive() && err?.name !== 'AbortError') toast(err?.message || '상태를 바꾸지 못했습니다.', 'error');
      } finally {
        state.busy.delete(id);
        draw();
      }
    }

    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-act]');
      if (!button) return;
      const { act, col, id } = button.dataset;
      if (act === 'col') {
        state.col = col;
        draw();
      } else if (act === 'reload') load();
      else if (act === 'more') loadColumn(col, { append: true });
      else if (act === 'retry') loadColumn(col);
      else if (act === 'ship' || act === 'unship') changeStatus(id, act);
    }, { signal: ac.signal });
    root.addEventListener('change', (event) => {
      const filter = event.target.dataset.filter;
      if (filter === 'customer' || filter === 'sort') {
        state[filter] = event.target.value;
        load();
      }
    }, { signal: ac.signal });

    load();
    getMeta().then((meta) => {
      const role = meta?.access?.role || 'admin';
      state.canShip = role === 'admin' || role === 'shipping';
      draw();
    });
    api.get('/api/customers', undefined, { signal: ac.signal }).then((response) => {
      state.customers = response.customers || [];
      draw();
    }).catch(() => {});
    api.get('/api/calls', { status: 'working', limit: 1 }, { signal: ac.signal }).then((response) => {
      state.working = response.total || 0;
      draw();
    }).catch(() => {});
    return () => ac.abort();
  },
};
