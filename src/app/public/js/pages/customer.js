// 거래처별 모아 보기(F13): 한 거래처의 통화 · 주문 카드를 날짜별로 묶어 보여 준다.
import { api } from '../api.js';
import { html, render, kstDay, fmtDate, fmtClock, fmtWhen, fmtSec, callChip, errorBox, href, SOURCE_LABEL } from '../ui.js';
import { partsText, carText, callHref, customerHref } from './board.js';

const ts = (iso) => Date.parse(iso || '') || 0;

function callItem(call) {
  const c = call.card;
  const ask = Array.isArray(c?.askBack) ? c.askBack : [];
  const meta = [fmtClock(call.recordedAt), SOURCE_LABEL[call.source] || '', call.durationSec ? `${fmtSec(call.durationSec)} 길이` : ''].filter(Boolean).join(' · ');
  return html`<a class="list-item cust-call" href="${callHref(call.id)}">
    <span class="cc-top"><strong class="cc-title">${call.title || '통화'}</strong>${callChip(call)}</span>
    ${c ? html`<span class="cc-parts">${partsText(c.items, 3, c.callType)}${carText(c) ? html`<span class="cc-car"> · ${carText(c)}</span>` : ''}</span>`
      : html`<span class="cc-parts muted">${call.summary || call.statusLabel || ''}</span>`}
    ${c?.urgent || c?.callback ? html`<span class="cc-flags">${c.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}${c.callback ? html`<span class="chip chip-callback">다시 전화</span>` : ''}</span>` : ''}
    ${ask.length ? html`<span class="cc-ask"><span class="cc-ask-label">되물을 것</span>${ask.map((q) => html`<span class="cc-q">「${q}」</span>`)}</span>` : ''}
    <span class="cc-meta">${meta}</span>
  </a>`;
}

export default {
  title: '거래처별 모아 보기',
  async mount(el, ctx) {
    const ac = new AbortController();
    const name = String(ctx.params.name || '').trim();
    const st = {
      data: null,
      error: null,
      customers: [],
      order: ctx.query.order === 'asc' ? 'asc' : 'desc',
    };
    render(el, html`<div class="page customer-page"></div>`);
    const root = el.firstElementChild;
    const alive = () => !ac.signal.aborted && root.isConnected;
    document.title = `${name || '거래처'} · 콜노트(가칭)`;

    function picker() {
      const list = st.customers.slice();
      if (name && !list.some((c) => c.name === name)) list.unshift({ name, calls: null });
      if (list.length < 2) return '';
      return html`<label class="field cust-pick"><span>다른 거래처 보기</span>
        <select class="select" data-change="pick" aria-label="거래처 고르기">
          ${list.map((c) => html`<option value="${c.name}" ${c.name === name ? html`selected` : ''}>${c.name}${c.calls != null ? ` (통화 ${c.calls}건${c.openCards ? ` · 열린 카드 ${c.openCards}` : ''})` : ''}</option>`)}
        </select></label>`;
    }

    function draw() {
      if (!alive()) return;
      const d = st.data;
      const cust = d?.customer || { name, phone: null };
      const calls = Array.isArray(d?.calls) ? d.calls : [];
      const head = html`<div class="page-head cust-head">
        <div>
          <p class="eyebrow">F13 · 거래처별 모아 보기 · 가짜 거래처</p>
          <h1>${cust.name || name || '거래처'}</h1>
          ${cust.phone ? html`<p class="sub"><span class="chip chip-phone">가짜 번호 ${cust.phone}</span></p>` : ''}
        </div>
        <a class="btn" href="${href('/calls', { customer: cust.name || name })}">이 거래처 통화 찾기</a>
      </div>`;
      if (!d && st.error) {
        const notFound = st.error.status === 404;
        render(root, html`${head}${notFound
          ? html`<div class="notice notice-warn">「${name}」 거래처를 찾지 못했습니다. 아래에서 다른 거래처를 고르세요.</div>`
          : html`${errorBox(st.error)}<button type="button" class="btn btn-primary" data-act="reload">다시 불러오기</button>`}
          ${picker()}`);
        return;
      }
      if (!d) {
        render(root, html`${head}<p class="loading"><span class="spinner" aria-hidden="true"></span> 통화를 모으는 중…</p>`);
        return;
      }
      const cards = calls.map((c) => c.card).filter(Boolean);
      const n = (s) => cards.filter((c) => c.status === s).length;
      const last = calls.reduce((m, c) => (ts(c.recordedAt) > ts(m) ? c.recordedAt : m), null);

      // 날짜(한국 시간)별로 묶기
      const sorted = calls.slice().sort((a, b) => (st.order === 'asc' ? ts(a.recordedAt) - ts(b.recordedAt) : ts(b.recordedAt) - ts(a.recordedAt)));
      const days = [];
      for (const call of sorted) {
        const key = call.recordedAt ? kstDay(new Date(call.recordedAt)) : '날짜 없음';
        let g = days[days.length - 1];
        if (!g || g.key !== key) { g = { key, iso: call.recordedAt, calls: [] }; days.push(g); }
        g.calls.push(call);
      }

      render(root, html`${head}
        <div class="metrics cust-metrics">
          <div class="metric metric-brand"><span class="metric-num">${calls.length}<small>건</small></span><span class="metric-label">통화</span></div>
          <div class="metric metric-warn"><span class="metric-num">${n('draft')}<small>장</small></span><span class="metric-label">확인 필요</span></div>
          <div class="metric metric-ok"><span class="metric-num">${n('confirmed')}<small>장</small></span><span class="metric-label">확정 · 출고 전</span></div>
          <div class="metric"><span class="metric-num">${n('shipped')}<small>장</small></span><span class="metric-label">출고 완료</span></div>
        </div>
        <p class="cust-last">${last ? `마지막 통화 ${fmtWhen(last)} · ` : ''}열린 카드(확인 필요 + 확정) ${n('draft') + n('confirmed')}장</p>
        <div class="cust-bar">
          ${picker()}
          <div class="cust-order" role="group" aria-label="순서">
            <button type="button" class="tab" data-act="order" data-order="desc" aria-pressed="${String(st.order === 'desc')}">최근 것부터</button>
            <button type="button" class="tab" data-act="order" data-order="asc" aria-pressed="${String(st.order === 'asc')}">오래된 것부터</button>
          </div>
        </div>
        ${calls.length ? days.map((g) => html`<section class="cust-day" aria-label="${g.key}">
            <h2 class="cust-day-h">${g.iso ? fmtDate(g.iso) : g.key} <span class="cust-day-n">${g.calls.length}건</span></h2>
            <div class="list-wrap">${g.calls.map(callItem)}</div>
          </section>`)
          : html`<div class="empty"><p>이 거래처와의 통화가 아직 없습니다.</p><a class="btn" href="#/calls">통화 기록 보기</a></div>`}
        ${st.error ? errorBox(st.error) : ''}`);
    }

    async function load() {
      st.error = null;
      draw();
      const [one, list] = await Promise.allSettled([
        api.get(`/api/customers/${encodeURIComponent(name)}`, undefined, { signal: ac.signal }),
        api.get('/api/customers', undefined, { signal: ac.signal }),
      ]);
      if (!alive()) return;
      if (list.status === 'fulfilled' && Array.isArray(list.value?.customers)) st.customers = list.value.customers;
      if (one.status === 'fulfilled') { st.data = one.value || { calls: [] }; st.error = null; }
      else if (one.reason?.name !== 'AbortError') st.error = one.reason;
      draw();
    }

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !root.contains(b)) return;
      if (b.dataset.act === 'order') { st.order = b.dataset.order === 'asc' ? 'asc' : 'desc'; draw(); }
      else if (b.dataset.act === 'reload') load();
    }, { signal: ac.signal });
    root.addEventListener('change', (e) => {
      const s = e.target.closest('[data-change="pick"]');
      if (!s || !s.value || s.value === name) return;
      ctx.navigate(customerHref(s.value));
    }, { signal: ac.signal });

    if (!name) {
      st.error = { status: 404, message: '거래처 이름이 없습니다.' };
      draw();
      api.get('/api/customers', undefined, { signal: ac.signal })
        .then((r) => { if (alive()) { st.customers = r?.customers || []; draw(); } })
        .catch(() => {});
    } else {
      load();
    }
    return () => ac.abort();
  },
};
