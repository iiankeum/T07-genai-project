// 통화 목록 · 찾기(F08): 글 · 카드 검색, 상태 · 날짜 · 거래처 거르기, 맞은 문장 굵게 → 누르면 그 대목으로.
import { api } from '../api.js';
import { html, render, fmtWhen, fmtSec, callChip, SOURCE_LABEL, highlight, errorBox, href, kstDay } from '../ui.js';

const STATUS_TABS = [
  ['all', '전체'], ['draft', '확인 필요'], ['callback', '다시 전화'], ['confirmed', '확정'],
  ['shipped', '출고 완료'], ['working', '받아쓰는 중'], ['failed', '실패'],
];
const RANGES = [['today', '오늘'], ['yesterday', '어제'], ['week', '이번 주'], ['all', '전체']];
const PAGE = 30;
const REFRESH_MS = 10_000;
const TYPE_MS = 350;
const WORKING = new Set(['queued', 'transcribing', 'extracting']);
const DAY_MS = 86_400_000;

/** 날짜 고르기 → from/to(한국 날짜 YYYY-MM-DD). 이번 주는 월요일부터 */
export function rangeDates(range, now = new Date()) {
  const t = now.getTime();
  const day = (ms) => kstDay(new Date(ms));
  if (range === 'today') { const d = day(t); return { from: d, to: d }; }
  if (range === 'yesterday') { const d = day(t - DAY_MS); return { from: d, to: d }; }
  if (range === 'week') {
    const dow = new Date(t + 9 * 3600_000).getUTCDay(); // 0=일
    return { from: day(t - ((dow + 6) % 7) * DAY_MS), to: day(t) };
  }
  return { from: undefined, to: undefined };
}

/** 주소의 물음표 뒤 → 화면 상태 */
export function stateFromQuery(q = {}, now = new Date()) {
  const status = STATUS_TABS.some(([k]) => k === q.status) ? q.status : 'all';
  let range = RANGES.some(([k]) => k === q.range) ? q.range : 'all';
  const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  let custom = !q.range && (isDay(q.from) || isDay(q.to));
  if (custom) {
    range = 'custom';
    // 오늘 화면 등에서 from=to=오늘(어제)로 오면 「오늘」(「어제」) 단추로 보인다
    for (const k of ['today', 'yesterday']) {
      const d = rangeDates(k, now);
      if (q.from === d.from && q.to === d.to) { range = k; custom = false; }
    }
  }
  return {
    q: String(q.q || '').trim().slice(0, 100),
    status,
    range,
    from: custom && isDay(q.from) ? q.from : undefined,
    to: custom && isDay(q.to) ? q.to : undefined,
    customer: String(q.customer || '').trim(),
  };
}

/** 화면 상태 → 해시 주소 */
export function hashFor(s) {
  return href('/calls', {
    q: s.q || undefined,
    status: s.status !== 'all' ? s.status : undefined,
    range: s.range !== 'all' && s.range !== 'custom' ? s.range : undefined,
    from: s.range === 'custom' ? s.from : undefined,
    to: s.range === 'custom' ? s.to : undefined,
    customer: s.customer || undefined,
  });
}

/** 검색어를 낱말로 나눠 굵게 칠할 표시로 */
export function searchMarks(q) {
  return String(q || '').split(/\s+/).filter(Boolean).map((t) => ({ text: t, kind: 'search' }));
}

const custHref = (name) => '#/customers/' + encodeURIComponent(name);
const shortDay = (d) => (d ? `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : '');
/** 직접 정한 날짜 단추 글: 「11월 10일」 · 「11월 1일 ~ 11월 5일」 · 「11월 1일부터」 */
function customLabel(from, to) {
  if (from && to) return from === to ? shortDay(from) : `${shortDay(from)} ~ ${shortDay(to)}`;
  return from ? `${shortDay(from)}부터` : `${shortDay(to)}까지`;
}

export default {
  title: '통화 기록 · 찾기',
  async mount(el, ctx) {
    const state = stateFromQuery(ctx.query);
    let calls = [];
    let total = 0;
    let customers = null;
    let ctrl = null;
    let alive = true;
    let typeTimer = null;
    let refreshTimer = null;
    let lastUrlAt = 0;

    const remember = () => { try { sessionStorage.setItem('cn.callsHash', hashFor(state)); } catch { /* 무시 */ } };
    remember();

    render(el, html`<div class="page cl-page">
      <div class="page-head">
        <div>
          <h1>통화 기록 · 찾기</h1>
          <p class="sub">받아쓴 글과 주문 카드에서 찾습니다. 문장을 누르면 그 대목으로 갑니다.</p>
        </div>
      </div>
      <form class="cl-search" role="search" data-slot="form">
        <label class="sr-only" for="cl-q">통화 찾기</label>
        <input id="cl-q" class="input input-search" type="search" enterkeyhint="search" autocomplete="off"
          placeholder="거래처, 차종, 부품, 차번호로 찾기 — 예: 쏘렌토" value="${state.q}" maxlength="100">
        <button type="button" class="btn cl-clear ${state.q ? '' : 'hidden'}" data-act="clear-q" aria-label="검색어 지우기">지우기</button>
      </form>
      <div class="cl-filters" data-slot="filters"></div>
      <div class="cl-results" data-slot="results" aria-live="polite"><p class="loading">불러오는 중…</p></div>
    </div>`);
    const root = el.querySelector('.cl-page');
    const slot = (n) => root.querySelector(`[data-slot="${n}"]`);
    const input = root.querySelector('#cl-q');

    // ── 거르기 ────────────────────────────────────────────────────
    function renderFilters() {
      const custList = customers || [];
      const hasCust = state.customer && !custList.some((c) => c.name === state.customer);
      render(slot('filters'), html`
        <div class="cl-group">
          <p class="cl-group-label" id="cl-status-l">상태</p>
          <div class="tabs cl-tabs" role="group" aria-labelledby="cl-status-l">
            ${STATUS_TABS.map(([k, label]) => html`<button type="button" class="tab" data-status="${k}" aria-pressed="${state.status === k}">${label}</button>`)}
          </div>
        </div>
        <div class="cl-row2">
          <div class="cl-group">
            <p class="cl-group-label" id="cl-range-l">날짜</p>
            <div class="cl-range" role="group" aria-labelledby="cl-range-l">
              ${RANGES.map(([k, label]) => html`<button type="button" class="tab" data-range="${k}" aria-pressed="${state.range === k}">${label}</button>`)}
              ${state.range === 'custom' ? html`<button type="button" class="tab" data-range="custom" aria-pressed="true">${customLabel(state.from, state.to)}</button>` : ''}
            </div>
          </div>
          <div class="cl-group cl-cust-group">
            <label class="cl-group-label" for="cl-cust">거래처</label>
            <select id="cl-cust" class="select cl-cust-select" ${customers === null ? html`disabled` : ''}>
              <option value="">${customers === null ? '거래처 불러오는 중…' : '모든 거래처'}</option>
              ${hasCust ? html`<option value="${state.customer}" selected>${state.customer}</option>` : ''}
              ${custList.map((c) => html`<option value="${c.name}" ${c.name === state.customer ? html`selected` : ''}>${c.name}${c.calls ? ` (${c.calls}건)` : ''}</option>`)}
            </select>
          </div>
        </div>`);
    }

    // ── 결과 ──────────────────────────────────────────────────────
    function matchView(c, m) {
      const at = Number(m?.at);
      const hasAt = m && m.at !== null && m.at !== undefined && Number.isFinite(at);
      const seg = Number(m?.segIndex);
      const to = href(`/calls/${encodeURIComponent(c.id)}`, {
        t: hasAt ? String(Math.round(at * 10) / 10) : undefined,
        seg: Number.isInteger(seg) && seg >= 0 ? String(seg) : undefined,
      });
      return html`<li><a class="cl-match" href="${to}">
        <span class="cl-match-time">${hasAt ? fmtSec(at) : '카드'}</span>
        <span class="cl-match-text">${highlight(m?.text ?? '', searchMarks(state.q))}</span>
      </a></li>`;
    }
    function rowView(c) {
      const card = c.card || null;
      const matches = Array.isArray(c.matches) ? c.matches : [];
      const shown = matches.slice(0, 3);
      const source = SOURCE_LABEL[c.source] || c.source || '';
      return html`<li class="cl-item">
        <div class="cl-top">
          <a class="cl-title" href="#/calls/${encodeURIComponent(c.id)}">${c.title || '제목 없는 통화'}</a>
          <span class="cl-chips">
            ${callChip(c)}
            ${card?.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}
            ${card?.callback ? html`<span class="chip chip-callback">다시 전화</span>` : ''}
          </span>
        </div>
        <p class="cl-meta">
          <span>${fmtWhen(c.recordedAt)}</span>
          <span>${source}${c.hasAudio ? '' : ' · 녹음 없음'}</span>
          ${c.customer ? html`<a class="cl-cust" href="${custHref(c.customer)}" aria-label="${c.customer} 통화 모아 보기">${c.customer} ›</a>` : ''}
        </p>
        ${c.summary ? html`<p class="cl-summary">${c.summary}</p>` : ''}
        ${c.status === 'failed' && c.error ? html`<p class="cl-error">실패 이유: ${c.error}</p>` : ''}
        ${shown.length ? html`<ul class="cl-matches" aria-label="찾은 문장">${shown.map((m) => matchView(c, m))}</ul>` : ''}
        ${matches.length > shown.length ? html`<p class="cl-more-matches">이 통화에서 ${matches.length - shown.length}문장 더 찾았습니다 — 통화를 열어 보세요.</p>` : ''}
      </li>`;
    }
    function filtersOn() {
      return Boolean(state.q || state.status !== 'all' || state.range !== 'all' || state.customer);
    }
    function emptyView() {
      if (filtersOn()) {
        return html`<div class="empty cl-empty">
          <p>${state.q ? html`「<strong>${state.q}</strong>」(이)가 들어간 통화가 없습니다.` : '조건에 맞는 통화가 없습니다.'}</p>
          <p class="cl-tip">낱말을 짧게 줄이거나(예: 「쏘렌토 앞범퍼」 → 「쏘렌토」), 날짜를 「전체」로 바꿔 보세요.</p>
          <button type="button" class="btn btn-primary" data-act="reset">거르기 모두 지우기</button>
        </div>`;
      }
      return html`<div class="empty cl-empty">
        <p>아직 통화가 없습니다.</p>
        <div class="row cl-empty-actions"><a class="btn btn-primary" href="#/upload">녹음 올리기</a><a class="btn" href="#/live">실시간 받아쓰기 체험</a></div>
      </div>`;
    }
    function renderResults() {
      const working = calls.filter((c) => WORKING.has(c.status)).length;
      render(slot('results'), html`
        <div class="cl-count">
          <span><strong>${total}</strong>건${state.q ? html` · 「${state.q}」 찾음` : ''}</span>
          ${working ? html`<span class="cl-working"><span class="spinner" aria-hidden="true"></span> 받아쓰는 중 ${working}건 — 10초마다 새로 봅니다</span>` : ''}
        </div>
        ${calls.length ? html`<ul class="list-wrap cl-list">${calls.map(rowView)}</ul>` : emptyView()}
        ${calls.length < total ? html`<button type="button" class="btn btn-block cl-more" data-act="more">더 보기 (${total - calls.length}건 남음)</button>` : ''}
      `);
    }

    // ── 불러오기 ──────────────────────────────────────────────────
    function apiQuery(offset, limit) {
      const { from, to } = state.range === 'custom' ? { from: state.from, to: state.to } : rangeDates(state.range);
      return {
        q: state.q || undefined,
        status: state.status !== 'all' ? state.status : undefined,
        from, to,
        customer: state.customer || undefined,
        limit, offset,
      };
    }
    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = null;
      if (alive && calls.some((c) => WORKING.has(c.status))) refreshTimer = setTimeout(() => load({ silent: true }), REFRESH_MS);
    }
    async function load({ append = false, silent = false } = {}) {
      ctrl?.abort();
      ctrl = new AbortController();
      const my = ctrl;
      clearTimeout(refreshTimer);
      if (!append && !silent) slot('results').classList.add('is-loading');
      const limit = append ? PAGE : silent ? Math.min(100, Math.max(PAGE, calls.length)) : PAGE;
      try {
        const r = await api.get('/api/calls', apiQuery(append ? calls.length : 0, limit), { signal: my.signal });
        if (!alive || my !== ctrl) return;
        const list = Array.isArray(r?.calls) ? r.calls : [];
        calls = append ? calls.concat(list) : list;
        total = Number.isFinite(Number(r?.total)) ? Number(r.total) : calls.length;
        renderResults();
      } catch (e) {
        if (e?.name === 'AbortError' || !alive || my !== ctrl) return;
        if (silent) { scheduleRefresh(); return; }
        render(slot('results'), html`${errorBox(e)}<button type="button" class="btn" data-act="retry">다시 불러오기</button>`);
        return;
      } finally {
        if (my === ctrl) slot('results')?.classList.remove('is-loading');
      }
      scheduleRefresh();
    }
    async function loadCustomers() {
      try {
        const r = await api.get('/api/customers');
        if (!alive) return;
        customers = Array.isArray(r?.customers) ? r.customers.filter((c) => c && c.name) : [];
      } catch {
        if (!alive) return;
        customers = [];
      }
      renderFilters();
    }

    // ── 주소 바꾸기(뒤로 가기 되게). pushState 는 hashchange 를 부르지 않아 화면이 다시 열리지 않는다 ──
    function syncUrl(push) {
      const target = hashFor(state);
      const same = decodeURIComponent(location.hash || '#/calls') === decodeURIComponent(target);
      if (!same) {
        try { history[push ? 'pushState' : 'replaceState'](null, '', target); } catch { /* 주소만 못 바꿈 */ }
      }
      lastUrlAt = Date.now();
      remember();
    }
    function changed({ push = true } = {}) {
      syncUrl(push);
      renderFilters();
      load();
    }

    // ── 이벤트 ──────────────────────────────────────────────────────
    function onInput() {
      root.querySelector('[data-act="clear-q"]')?.classList.toggle('hidden', !input.value);
      clearTimeout(typeTimer);
      typeTimer = setTimeout(() => {
        const q = input.value.trim();
        if (q === state.q) return;
        state.q = q;
        // 한 번 이어서 치는 동안은 기록 하나만 남긴다
        changed({ push: Date.now() - lastUrlAt > 1500 });
      }, TYPE_MS);
    }
    function onSubmit(e) {
      e.preventDefault();
      clearTimeout(typeTimer);
      state.q = input.value.trim();
      input.blur(); // 휴대폰 자판 닫기
      changed({ push: true });
    }
    function onClick(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const st = t.closest('[data-status]');
      if (st) { if (state.status !== st.dataset.status) { state.status = st.dataset.status; changed(); } return; }
      const rg = t.closest('[data-range]');
      if (rg) {
        const v = rg.dataset.range;
        if (v !== 'custom' && state.range !== v) { state.range = v; state.from = undefined; state.to = undefined; changed(); }
        return;
      }
      const act = t.closest('[data-act]');
      if (!act) return;
      switch (act.dataset.act) {
        case 'clear-q':
          input.value = '';
          act.classList.add('hidden');
          clearTimeout(typeTimer);
          if (state.q) { state.q = ''; changed(); }
          input.focus();
          break;
        case 'reset':
          Object.assign(state, { q: '', status: 'all', range: 'all', from: undefined, to: undefined, customer: '' });
          input.value = '';
          root.querySelector('[data-act="clear-q"]')?.classList.add('hidden');
          changed();
          break;
        case 'more': act.disabled = true; act.textContent = '불러오는 중…'; load({ append: true }); break;
        case 'retry': load(); break;
        default: break;
      }
    }
    function onChange(e) {
      if (e.target?.id === 'cl-cust') { state.customer = e.target.value; changed(); }
    }

    input.addEventListener('input', onInput);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);

    renderFilters();
    loadCustomers();
    await load();

    return () => {
      alive = false;
      ctrl?.abort();
      clearTimeout(typeTimer);
      clearTimeout(refreshTimer);
      input.removeEventListener('input', onInput);
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
    };
  },
};
