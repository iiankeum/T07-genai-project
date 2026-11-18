// 출고 목록(F14): 확정 카드를 거래처별로 묶어 보여 주고, 인쇄 · CSV 내려받기 · 출고 완료 처리.
import { api } from '../api.js';
import { html, render, kstDay, fmtDate, fmtClock, fmtWhen, toast, confirmBox, errorBox } from '../ui.js';
import { carText, qtyText, callHref, customerHref } from './board.js';

const SCOPES = [
  { key: 'all', label: '출고 기다리는 것 전체' },
  { key: 'today', label: '오늘 확정한 것' },
];
const NO_CUSTOMER = '거래처 확인 필요';
const dash = (v) => (v == null || v === '' ? '—' : v);

function partNoCell(no) {
  return no ? html`<span class="partno">${no}</span>` : html`<span class="chip chip-draft">품번 입력 전</span>`;
}
function itemsOf(card) {
  const list = (Array.isArray(card.items) ? card.items : []).filter((i) => i && i.part);
  return list.length ? list : [null];
}

function shipButton(card, busy, blocked = false) {
  if (card.status && card.status !== 'confirmed') {
    return html`<span class="chip ${card.status === 'shipped' ? 'chip-shipped' : 'chip-draft'}">${card.status === 'shipped' ? '출고 완료' : '확인 필요'}</span>`;
  }
  return html`<button type="button" class="btn btn-ok ship-btn" data-act="ship" data-id="${card.callId}" ${busy || blocked ? html`disabled` : ''}>${blocked ? '목록 확인 필요' : busy ? '바꾸는 중…' : '출고 완료로'}</button>`;
}

/** 넓은 화면 · 인쇄용 표: 주문(카드)마다 tbody 하나, 부품마다 줄 하나 */
function groupTable(group, busy, blocked) {
  return html`<div class="table-wrap ship-table-wrap">
    <table class="table ship-table">
      <caption class="sr-only">${group.customer} 출고 목록</caption>
      <thead><tr><th scope="col">부품</th><th scope="col">위치</th><th scope="col" class="num">수량</th><th scope="col">품번</th><th scope="col">차</th><th scope="col">원하는 때</th><th scope="col">받는 방법</th><th scope="col">급함</th><th scope="col" class="no-print">출고</th></tr></thead>
      ${group.cards.map((card) => {
        const items = itemsOf(card);
        const n = items.length;
        return html`<tbody class="ship-order ${card.urgent ? 'is-urgent' : ''}">
          ${items.map((it, i) => html`<tr>
            ${it ? html`<td class="ship-part">${it.part}</td><td>${dash(it.side)}</td><td class="num">${qtyText(it.qty)}</td><td>${partNoCell(it.partNo)}</td>`
              : html`<td colspan="4" class="muted">부품 정리 전 — <a href="${callHref(card.callId)}">통화 열어 확인</a></td>`}
            ${i === 0 ? html`<td rowspan="${n}"><a class="ship-car" href="${callHref(card.callId)}">${carText(card) || '차 정보 없음'}</a></td>
              <td rowspan="${n}">${dash(card.due)}</td>
              <td rowspan="${n}">${dash(card.delivery)}</td>
              <td rowspan="${n}">${card.urgent ? html`<span class="chip chip-urgent">급함</span>` : '—'}</td>
              <td rowspan="${n}" class="no-print">${shipButton(card, busy.has(card.callId), blocked)}</td>` : ''}
          </tr>`)}
        </tbody>`;
      })}
    </table>
  </div>`;
}

/** 좁은 화면용 카드 */
function groupCards(group, busy, blocked) {
  return html`<div class="ship-cards">${group.cards.map((card) => html`<article class="ship-card ${card.urgent ? 'is-urgent' : ''}">
    <div class="ship-card-head">
      <a class="ship-card-car" href="${callHref(card.callId)}">${carText(card) || '차 정보 없음'}</a>
      ${card.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}
    </div>
    <ul class="ship-items">${itemsOf(card).map((it) => (it
      ? html`<li><span class="si-part">${it.part}${it.side ? html` <span class="si-side">(${it.side})</span>` : ''}</span><span class="si-qty">${qtyText(it.qty)}</span><span class="si-no">${partNoCell(it.partNo)}</span></li>`
      : html`<li><span class="si-part muted">부품 정리 전</span></li>`))}</ul>
    <dl class="ship-meta">
      <div><dt>원하는 때</dt><dd>${dash(card.due)}</dd></div>
      <div><dt>받는 방법</dt><dd>${dash(card.delivery)}</dd></div>
      ${card.confirmedAt ? html`<div><dt>확정</dt><dd>${fmtWhen(card.confirmedAt)}</dd></div>` : ''}
    </dl>
    <div class="ship-card-act">${shipButton(card, busy.has(card.callId), blocked)}</div>
  </article>`)}</div>`;
}

export default {
  title: '출고 목록',
  async mount(el, ctx) {
    const ac = new AbortController();
    const st = {
      scope: SCOPES.some((s) => s.key === ctx.query.scope) ? ctx.query.scope : 'all',
      data: null,
      loading: true,
      error: null,
      reviewNotice: null,
      reviewBlocked: false,
      busy: new Set(),
    };
    render(el, html`<div class="page shipping-page"></div>`);
    const root = el.firstElementChild;
    const alive = () => !ac.signal.aborted && root.isConnected;

    function csvHref() {
      const qs = new URLSearchParams({ scope: st.scope });
      if (st.scope === 'today') qs.set('day', st.data?.day || kstDay());
      return api.url(`/api/shipping.csv?${qs}`);
    }

    function draw() {
      if (!alive()) return;
      const d = st.data;
      const groups = Array.isArray(d?.groups) ? d.groups : [];
      const orders = groups.reduce((n, g) => n + (Array.isArray(g.cards) ? g.cards.length : 0), 0);
      const lines = groups.reduce((n, g) => n + (g.cards || []).reduce((m, c) => m + itemsOf(c).filter(Boolean).length, 0), 0);
      const now = new Date().toISOString();
      const head = html`<div class="page-head">
        <div><p class="eyebrow no-print">확정 주문 · 출고 준비</p><h1>출고 목록</h1>
          <p class="sub no-print">확정된 주문을 거래처별로 묶었습니다. 들고 나갈 때 인쇄하거나 CSV 로 내려받으세요.</p>
          <p class="print-only">가짜 통화 데모 데이터 · ${fmtDate(now)} ${fmtClock(now)} 출력 · ${SCOPES.find((s) => s.key === st.scope).label}</p>
        </div>
      </div>
      <div class="tabs ship-scope no-print" role="group" aria-label="범위">
        ${SCOPES.map((s) => html`<button type="button" class="tab" data-act="scope" data-scope="${s.key}" aria-pressed="${String(st.scope === s.key)}">${s.label}</button>`)}
      </div>
      <div class="ship-tools no-print">
        <button type="button" class="btn" data-act="print" ${groups.length ? '' : html`disabled`}>인쇄</button>
        <a class="btn" href="${csvHref()}" download>CSV 내려받기</a>
        <button type="button" class="btn btn-ghost" data-act="reload">새로고침</button>
      </div>`;
      let body;
      if (!d && st.error) body = html`${errorBox(st.error)}<button type="button" class="btn btn-primary" data-act="reload">다시 불러오기</button>`;
      else if (!d) body = html`<p class="loading"><span class="spinner" aria-hidden="true"></span> 출고 목록을 모으는 중…</p>`;
      else if (!groups.length) {
        body = html`<div class="empty"><p>${st.scope === 'today' ? '오늘 확정한 주문이 없습니다.' : '출고를 기다리는 확정 주문이 없습니다.'}</p>
          <a class="btn btn-primary" href="#/board">주문 카드 보드에서 확정하기</a></div>`;
      } else {
        body = html`<p class="ship-total">거래처 <strong>${groups.length}</strong>곳 · 주문 <strong>${orders}</strong>건 · 부품 <strong>${lines}</strong>줄${st.loading ? ' · 새로 고치는 중…' : ''}</p>
          ${groups.map((g) => html`<section class="ship-group" aria-label="${g.customer || NO_CUSTOMER}">
            <h2 class="ship-cust">${g.customer && g.customer !== NO_CUSTOMER ? html`<a href="${customerHref(g.customer)}">${g.customer}</a>` : NO_CUSTOMER} <span class="ship-cust-n">주문 ${(g.cards || []).length}건</span></h2>
            ${groupTable({ ...g, cards: g.cards || [] }, st.busy, st.reviewBlocked)}
            ${groupCards({ ...g, cards: g.cards || [] }, st.busy, st.reviewBlocked)}
          </section>`)}
          ${st.error ? errorBox(st.error) : ''}
          <p class="ship-foot">품번이 노란 「품번 입력 전」이면 통화를 열어 사람이 넣습니다. AI 는 품번을 지어내지 않습니다.</p>`;
      }
      render(root, html`${head}${st.reviewNotice ? html`<p class="notice notice-warn" role="status" tabindex="-1" data-ref="shipping-review-notice">${st.reviewNotice}</p>` : ''}${body}`);
    }

    let loadGeneration = 0;
    async function load() {
      const generation = ++loadGeneration;
      const current = () => alive() && generation === loadGeneration;
      st.loading = true;
      draw();
      const scope = st.scope;
      let loaded = false;
      try {
        const query = { scope };
        if (scope === 'today') query.day = kstDay();
        const data = await api.get('/api/shipping', query, { signal: ac.signal });
        if (!current()) return { generation, status: 'superseded' };
        st.data = data || { groups: [] };
        st.error = null;
        loaded = true;
        if (st.reviewBlocked) st.reviewNotice = '목록을 새로 불러왔습니다. 주문 내용을 다시 확인한 뒤 출고해 주세요.';
        st.reviewBlocked = false;
      } catch (err) {
        if (!current()) return { generation, status: 'superseded' };
        if (err?.name === 'AbortError') return { generation, status: 'aborted' };
        st.error = err;
        if (st.reviewBlocked) st.reviewNotice = '출고 상태를 변경하지 않았습니다. 최신 목록을 불러오지 못해 출고 처리를 보류했습니다. 새로고침 후 주문 내용을 다시 확인해 주세요.';
      }
      st.loading = false;
      draw();
      return { generation, status: loaded ? 'loaded' : 'failed' };
    }

    async function refreshForReview(message) {
      st.reviewBlocked = true;
      st.reviewNotice = '출고 상태를 변경하지 않았습니다. 최신 목록을 확인하는 중입니다.';
      const result = await load();
      // A newer refresh owns both the data and review state, including after scope ABA.
      if (!alive() || result.generation !== loadGeneration || !['loaded', 'failed'].includes(result.status)) return;
      st.reviewNotice = result.status === 'loaded' ? message : '출고 상태를 변경하지 않았습니다. 최신 목록을 불러오지 못해 출고 처리를 보류했습니다. 새로고침 후 주문 내용을 다시 확인해 주세요.';
      draw();
      root.querySelector('[data-ref="shipping-review-notice"]')?.focus();
    }

    async function ship(id) {
      if (!id || st.busy.has(id) || st.reviewBlocked) return;
      const card = (st.data?.groups || []).flatMap((g) => g.cards || []).find((c) => c.callId === id);
      if (!card || !Number.isSafeInteger(card.revision) || card.revision < 0) {
        await refreshForReview('출고 상태를 변경하지 않았습니다. 목록의 변경 정보를 확인할 수 없어 다시 불러왔습니다. 최신 주문 내용을 확인한 뒤 다시 시도해 주세요.');
        return;
      }
      const ok = await confirmBox(`${card?.title || '이 주문'} — 「출고 완료」로 옮길까요?`);
      if (!ok || !alive()) return;
      st.busy.add(id);
      draw();
      try {
        await api.post(`/api/cards/${encodeURIComponent(id)}/ship`, { expectedRevision: card.revision }, { signal: ac.signal });
        if (!alive()) return;
        st.reviewNotice = null;
        toast('출고 완료로 옮겼습니다.', 'ok');
        st.busy.delete(id);
        await load();
        return;
      } catch (err) {
        if (err?.name === 'AbortError' || !alive()) return;
        if (err?.status === 409 && ['card_conflict', 'not_confirmed'].includes(err.code)) {
          st.busy.delete(id);
          await refreshForReview('출고 상태를 변경하지 않았습니다. 다른 곳에서 주문이 바뀌어 목록을 다시 불러왔습니다. 수량과 품목을 다시 확인한 뒤 출고해 주세요.');
          return;
        }
        toast(err?.message || '바꾸지 못했습니다.', 'error');
      }
      st.busy.delete(id);
      draw();
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !root.contains(b)) return;
      const act = b.dataset.act;
      if (act === 'scope') {
        if (b.dataset.scope === st.scope) return;
        st.scope = b.dataset.scope;
        st.data = null;
        st.error = null;
        load();
      } else if (act === 'print') window.print();
      else if (act === 'reload') load();
      else if (act === 'ship') ship(b.dataset.id);
    }, { signal: ac.signal });

    load();
    return () => ac.abort();
  },
};
