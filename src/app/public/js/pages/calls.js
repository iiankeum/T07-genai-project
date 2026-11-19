// 통화 목록 · 찾기(F08): 글 · 카드 검색, 상태 · 날짜 · 거래처 거르기, 맞은 문장 굵게 → 누르면 그 대목으로.
import { api } from '../api.js';
import { CALL_TYPES } from '../domain.js';
import { icon } from '../icons.js';
import { html, render, fmtWhen, fmtClock, fmtSec, callChip, SOURCE_LABEL, highlight, errorBox, href, kstDay, toast } from '../ui.js';

const STATUS_TABS = [
  ['all', '전체'], ['draft', '확인 필요'], ['callback', '다시 전화'], ['confirmed', '확정'],
  ['shipped', '출고 완료'], ['cancelled', '취소'], ['working', '받아쓰는 중'], ['failed', '실패'],
];
const RANGES = [['today', '오늘'], ['yesterday', '어제'], ['week', '이번 주'], ['all', '전체']];
const PAGE = 30;
const REFRESH_MS = 10_000;
const TYPE_MS = 350;
// 상세로 이동한 직전 목록의 위치만 탭 메모리에 보관한다. 통화 내용은 저장하지 않는다.
let returnPosition = null;
let returnEpoch = 0;
const clearReturnPosition = () => { returnPosition = null; returnEpoch++; };
if (typeof window !== 'undefined') {
  for (const event of ['ahmatda:session-expired', 'ahmatda:workspace-changed'])
    window.addEventListener(event, clearReturnPosition);
  window.addEventListener('hashchange', () => {
    if (!/^#\/calls(?:[/?]|$)/.test(location.hash)) clearReturnPosition();
  });
}
function accessKey(meta) {
  const a = meta?.access;
  if (a?.user?.id && a?.workspace?.id) return JSON.stringify([a.user.id, a.workspace.id]);
  return a?.demo === true ? 'demo' : null;
}
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
    callType: CALL_TYPES.includes(q.callType) ? q.callType : '',
    callback: ['true', 'false'].includes(q.callback) ? q.callback : '',
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
    callType: s.callType || undefined,
    callback: s.callback || undefined,
  });
}

/** 검색어를 낱말로 나눠 굵게 칠할 표시로 */
export function searchMarks(q) {
  return String(q || '').split(/\s+/).filter(Boolean).map((t) => ({ text: t, kind: 'search' }));
}

// 목록에는 원문을 싣지 않는다. 실패한 녹음인지·권한이 있는지 먼저 거르고, 서버가 파일·작업 상태를 재검증한다.
export const canRetryListCall = (call, role) => Boolean(call?.id && call.status === 'failed' &&
  call.hasAudio === true && !call.transcript && (role === 'admin' || role === 'reception'));

export function createListRetries(role, post) {
  const states = new Map();
  return {
    get: id => states.get(id),
    receipts: () => [...states].filter(([,s]) => s.phase === 'accepted').map(([id,s]) => [id,s]),
    forget: id => states.delete(id),
    async submit(call) {
      if (!canRetryListCall(call, role)) return null;
      const id = call.id;
      if (['pending', 'accepted', 'blocked'].includes(states.get(id)?.phase)) return null;
      states.set(id, {phase:'pending'});
      let next;
      try {
        const receipt = await post('/api/calls/' + encodeURIComponent(id) + '/retry-transcription');
        if (receipt?.callId !== id || (!receipt.requeued && !receipt.alreadyPending)) throw Error('처리 접수를 확인하지 못했습니다. 통화 상세에서 상태를 확인해 주세요.');
        next = {phase:'accepted', message:receipt.alreadyPending ? '이미 받아쓰기 대기열에 있습니다.' : '저장된 녹음으로 받아쓰기를 다시 요청했습니다.'};
      } catch (e) {
        const blocked = ['not_retryable','no_audio','permission_denied','not_found'].includes(e?.code);
        next = {phase:blocked ? 'blocked' : 'error', message:e?.message || '요청하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'};
      }
      states.set(id,next);
      return next;
    },
  };
}
export function listRetryMarkup(call, role, state) {
  if (call.status !== 'failed') return '';
  const eligible = canRetryListCall(call, role);
  const locked = ['pending','accepted','blocked'].includes(state?.phase);
  return html`<div class="cl-retry-box">
    <span class="cl-retry-message">${state?.phase === 'pending' ? '받아쓰기 재요청 중…' : state?.message || ('실패 이유: ' + (call.error || '처리 중 오류가 발생했습니다.'))}</span>
    ${eligible ? html`<button class="btn btn-sm" type="button" data-act="retry-audio" aria-disabled="${String(locked)}">${state?.phase === 'accepted' ? '재요청 접수됨' : '녹음 다시 받아쓰기'}</button>` :
     !call.hasAudio ? html`<span class="help">저장된 녹음이 없어 다시 시도할 수 없습니다.</span>` : ''}
  </div>`;
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
    const scope = accessKey(ctx.meta);
    const role = ctx.meta?.access?.role;
    const retries = createListRetries(role, path => api.post(path));
    const resume = scope && returnPosition?.scope === scope && returnPosition.hash === hashFor(state)
      ? returnPosition : null;
    const resumeEpoch = returnEpoch;
    returnPosition = null; // 한 번 복귀에만 사용. 필터·계정·공간 변경 시 재사용하지 않는다.
    let restoreCancelled = false;
    let calls = [];
    let total = 0;
    let customers = null;
    let ctrl = null;
    let alive = true;
    let typeTimer = null;
    let refreshTimer = null;
    let lastUrlAt = 0;
    let refreshPaused = false;

    const remember = () => { try { sessionStorage.setItem('cn.callsHash', hashFor(state)); } catch { /* 무시 */ } };
    remember();

    let controls;
    try {
      const bundle = await import('/montage/calls.js');
      await bundle.prepareMontageCalls();
      controls = bundle;
    } catch { /* Native search remains available when enhanced assets fail. */ }
    if (!el.isConnected) return;

    render(el, html`<div class="page cl-page">
      <div class="page-head">
        <div>
          <h1>통화 기록</h1>
        </div>
        <div class="row"><a class="btn" href="#/live">${icon('live')} 실시간 받아쓰기</a><a class="btn btn-primary cl-upload" href="#/upload">${icon('upload')} 녹음 올리기</a></div>
      </div>
      <section class="cl-control" aria-label="통화 검색과 필터"><div class="cl-group cl-status" data-slot="statuses"></div><form class="cl-search" role="search" data-slot="form">
        <label class="sr-only" for="cl-q">통화 찾기</label>
        <input id="cl-q" class="input input-search" type="search" enterkeyhint="search" autocomplete="off"
          placeholder="거래처, 차종, 부품 또는 차번호 검색" value="${state.q}" maxlength="100">
        <button type="button" class="btn cl-clear ${state.q ? '' : 'hidden'}" data-act="clear-q" aria-label="검색어 지우기">지우기</button>
      </form>
      <div class="cl-filters" data-slot="filters"></div></section>
      <div class="cl-refresh-note" data-slot="refresh-note" role="status" hidden></div>
      <div class="cl-results" data-slot="results" aria-live="polite"><p class="loading">불러오는 중…</p></div>
    </div>`);
    const root = el.querySelector('.cl-page');
    const slot = (n) => root.querySelector(`[data-slot="${n}"]`);
    const form = slot('form');
    let montageSearch;
    let montageStatuses;
    if (controls) {
      const host = document.createElement('div');
      host.className = 'montage-scope cl-montage-search';
      host.hidden = true;
      form.append(host);
      try {
        montageSearch = controls.mountMontageCallsSearch(host, { query: state.q });
        if (montageSearch) {
          montageStatuses = controls.mountMontageCallsStatuses(slot('statuses'));
          [...form.children].filter(child => child !== host).forEach(child => child.remove());
          host.hidden = false;
        } else host.remove();
      } catch {
        montageSearch?.destroy();
        montageSearch = undefined;
        host.remove(); // Keep the native form if the enhanced assets cannot load.
      }
    }
    const input = montageSearch?.field || root.querySelector('#cl-q');
    let composing = false;

    // ── 거르기 ────────────────────────────────────────────────────
    function renderFilters() {
      const custList = customers || [];
      const hasCust = state.customer && !custList.some((c) => c.name === state.customer);
      if (montageStatuses) montageStatuses.update(STATUS_TABS, state.status);
      else render(slot('statuses'), html`
          <p class="cl-group-label" id="cl-status-l">상태</p>
          <div class="tabs cl-tabs" role="group" aria-labelledby="cl-status-l">
            ${STATUS_TABS.map(([k, label]) => html`<button type="button" class="tab" data-status="${k}" aria-pressed="${state.status === k}">${label}</button>`)}
          </div>`);
      render(slot('filters'), html`
        <div class="cl-quick-range">
          <div class="cl-group">
            <p class="cl-group-label" id="cl-range-l">날짜</p>
            <div class="cl-range" role="group" aria-labelledby="cl-range-l">
              ${RANGES.map(([k, label]) => html`<button type="button" class="tab" data-range="${k}" aria-pressed="${state.range === k}">${label}</button>`)}
              ${state.range === 'custom' ? html`<button type="button" class="tab" data-range="custom" aria-pressed="true">${customLabel(state.from, state.to)}</button>` : ''}
            </div>
          </div>
        </div>
        <details class="cl-advanced" ${state.customer || state.callType || state.callback || state.range === 'custom' ? html`open` : ''}>
          <summary>상세 필터${state.customer || state.callType || state.callback || state.range === 'custom' ? ' · 적용 중' : ''}</summary>
          <div class="cl-advanced-grid">
          <div class="cl-group cl-cust-group">
            <label class="cl-group-label" for="cl-cust">거래처</label>
            <select id="cl-cust" class="select cl-cust-select" ${customers === null ? html`disabled` : ''}>
              <option value="">${customers === null ? '거래처 불러오는 중…' : '모든 거래처'}</option>
              ${hasCust ? html`<option value="${state.customer}" selected>${state.customer}</option>` : ''}
              ${custList.map((c) => html`<option value="${c.name}" ${c.name === state.customer ? html`selected` : ''}>${c.name}${c.calls ? ` (${c.calls}건)` : ''}</option>`)}
            </select>
          </div>
          <div class="cl-group">
            <label class="cl-group-label" for="cl-type">통화 종류</label>
            <select id="cl-type" class="select">
              <option value="">모든 유형</option>
              ${CALL_TYPES.map((type) => html`<option value="${type}" ${state.callType === type ? html`selected` : ''}>${type}</option>`)}
            </select>
          </div>
          <div class="cl-group">
            <label class="cl-group-label" for="cl-callback">재연락 표시</label>
            <select id="cl-callback" class="select">
              <option value="">전체</option>
              <option value="true" ${state.callback === 'true' ? html`selected` : ''}>다시 전화</option>
              <option value="false" ${state.callback === 'false' ? html`selected` : ''}>표시 없음</option>
            </select>
          </div>
          <label class="cl-group"><span class="cl-group-label">시작일</span><input id="cl-from" class="input" type="date" value="${state.range === 'custom' ? state.from || '' : rangeDates(state.range).from || ''}"></label>
          <label class="cl-group"><span class="cl-group-label">종료일</span><input id="cl-to" class="input" type="date" value="${state.range === 'custom' ? state.to || '' : rangeDates(state.range).to || ''}"></label>
          </div>
        </details>`);
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
      const source = c.source === 'seed' ? '가짜 대본' : (SOURCE_LABEL[c.source] || c.source || '');
      return html`<li class="cl-item" data-call-id="${c.id}">
        <div class="cl-time"><time datetime="${c.recordedAt}" title="${fmtWhen(c.recordedAt)}">${fmtClock(c.recordedAt)}</time></div>
        <div class="cl-identity"><a class="cl-title" href="#/calls/${encodeURIComponent(c.id)}">${c.customer || card?.customer || c.title || '제목 없는 통화'}</a>
          ${c.customer ? html`<a class="cl-cust" href="${custHref(c.customer)}" aria-label="${c.customer} 통화 모아 보기" title="거래처의 다른 통화 보기">모아보기</a>` : ''}
        </div>
        <div class="cl-content"><p class="cl-context">${card?.carModel || '차종 미입력'}${card?.items?.length ? ` · ${card.items.map((item) => item.part).filter(Boolean).join(', ')}` : ''}</p>
        ${c.summary ? html`<p class="cl-summary">${c.summary}</p>` : ''}</div>
        <div class="cl-chips">${callChip(c)}${card?.callType ? html`<span class="chip">${card.callType}</span>` : ''}${card?.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}${card?.callback ? html`<span class="chip chip-callback">다시 전화</span>` : ''}<span class="cl-source">${source}${c.hasAudio ? '' : ' · 녹음 없음'}</span></div>
        ${listRetryMarkup(c, role, retries.get(c.id))}
        ${shown.length ? html`<ul class="cl-matches" aria-label="찾은 문장">${shown.map((m) => matchView(c, m))}</ul>` : ''}
        ${matches.length > shown.length ? html`<p class="cl-more-matches">이 통화에서 ${matches.length - shown.length}문장 더 찾았습니다 — 통화를 열어 보세요.</p>` : ''}
      </li>`;
    }
    function filtersOn() {
      return Boolean(state.q || state.status !== 'all' || state.range !== 'all' || state.customer || state.callType || state.callback);
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
    function rowsByDate() {
      const groups = new Map();
      for (const call of calls) {
        const day = kstDay(new Date(call.recordedAt));
        if (!groups.has(day)) groups.set(day, []);
        groups.get(day).push(call);
      }
      return [...groups].map(([day, rows]) => html`
        <section class="cl-day-group" aria-label="${day}">
          <h2 class="cl-group-label"><time datetime="${day}">${day}</time></h2>
          <div class="cl-columns" aria-hidden="true"><span>통화 시간</span><span>거래처</span><span>통화 · 주문 내용</span><span>상태</span></div><ul class="list-wrap cl-list">${rows.map(rowView)}</ul>
        </section>`);
    }

    function renderResults() {
      const working = calls.filter((c) => WORKING.has(c.status)).length;
      render(slot('results'), html`
        <div class="cl-count">
          <span><strong>${total}</strong>건${state.q ? html` · 「${state.q}」 찾음` : ''}</span>
          ${working ? html`<span class="cl-working">${refreshPaused ? '' : html`<span class="spinner" aria-hidden="true"></span>`} ${refreshPaused ? '자동 갱신 멈춤 · 상태가 최신이 아닐 수 있음' : `받아쓰는 중 ${working}건 — 10초마다 새로 봅니다`}</span>` : ''}
        </div>
        ${calls.length ? rowsByDate() : emptyView()}
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
        callType: state.callType || undefined,
        callback: state.callback || undefined,
        limit, offset,
      };
    }
    function pauseRefresh(message) {
      const position = listPosition();
      refreshPaused = true;
      clearTimeout(refreshTimer);
      const note = slot('refresh-note');
      note.hidden = false;
      render(note, html`<p class="notice">${message} 상태가 최신이 아닐 수 있습니다.
        <button type="button" class="btn btn-sm" data-act="refresh-list">처음 30건부터 새로고침</button></p>`);
      const working = slot('results').querySelector('.cl-working');
      if (working) working.textContent = '자동 갱신 멈춤 · 상태가 최신이 아닐 수 있음';
      restoreListPosition(position);
    }
    function listPosition() {
      const active = document.activeElement;
      const focused = slot('results').contains(active) ? active : null;
      const row = focused?.closest('[data-call-id]');
      const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0;
      const anchor = [...slot('results').querySelectorAll('[data-call-id]')].find(e => {
        const r = e.getBoundingClientRect(); return r.bottom > top && r.top < innerHeight;
      });
      return { focused, rowId: row?.dataset.callId, href: focused?.getAttribute('href'),
        act: focused?.dataset.act, nextId: row?.nextElementSibling?.dataset.callId, anchorId: anchor?.dataset.callId, top: anchor?.getBoundingClientRect().top };
    }
    function restoreListPosition(position, removedId) {
      const rows = [...slot('results').querySelectorAll('[data-call-id]')];
      const row = rows.find(e => e.dataset.callId === position.rowId);
      let target = position.href
        ? [...(row || slot('results')).querySelectorAll('a[href]')].find(e => e.getAttribute('href') === position.href)
        : position.act ? [...(row || slot('results')).querySelectorAll('[data-act]')].find(e => e.dataset.act === position.act) : null;
      if (position.act === 'retry-audio') {
        if (row) target ||= row.querySelector('.cl-title');
        else if (removedId === position.rowId) target = rows.find(e => e.dataset.callId === position.nextId)?.querySelector('.cl-title') || rows.at(-1)?.querySelector('.cl-title') || input;
        else target = null;
      }
      target?.focus({ preventScroll: true });
      const anchor = rows.find(e => e.dataset.callId === position.anchorId);
      if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - position.top);
    }
    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = null;
      if (!alive || resumeEpoch !== returnEpoch || refreshPaused) return;
      if (calls.length > 200 && calls.some(c => WORKING.has(c.status))) {
        pauseRefresh('200건을 넘게 펼쳐 자동 갱신을 잠시 멈췄습니다.'); return;
      }
      if (calls.some((c) => WORKING.has(c.status))) refreshTimer = setTimeout(() => load({ silent: true }), REFRESH_MS);
    }
    async function load({ append = false, silent = false, retriedId } = {}) {
      if (silent && (refreshPaused || resumeEpoch !== returnEpoch)) return false;
      if (!silent && !append) { refreshPaused = false; slot('refresh-note').hidden = true; }
      ctrl?.abort();
      ctrl = new AbortController();
      const my = ctrl;
      const receiptsBeforeRead = retries.receipts();
      clearTimeout(refreshTimer);
      if (!append && !silent) slot('results').classList.add('is-loading');
      const limit = append ? PAGE : silent ? Math.min(200, Math.max(PAGE, calls.length)) : PAGE;
      try {
        const r = await api.get('/api/calls', apiQuery(append ? calls.length : 0, limit), { signal: my.signal });
        if (!alive || my !== ctrl || resumeEpoch !== returnEpoch || !el.isConnected) return false;
        const list = Array.isArray(r?.calls) ? r.calls : [];
        const position = silent ? listPosition() : null; // 응답 직전 사용자가 현재 보고 있는 위치
        let focusedLinkMissing = false;
        if (position?.rowId && position.href) {
          const nextRow = list.find(c => c.id === position.rowId);
          if (nextRow) {
            const preview = document.createElement('ul');
            render(preview, rowView(nextRow));
            focusedLinkMissing = ![...preview.querySelectorAll('a[href]')].some(a => a.getAttribute('href') === position.href);
          }
        }
        if (position && (focusedLinkMissing || [position.rowId, position.anchorId].some(id => id && id !== retriedId && !list.some(c => c.id === id))
          || (position.act === 'more' && list.length >= Number(r.total)))) {
          pauseRefresh('보고 있던 위치의 목록이 바뀌어 자동 적용을 멈췄습니다.');
          return false;
        }
        const ids = new Set(calls.map((call) => call.id));
        calls = append ? calls.concat(list.filter((call) => !ids.has(call.id))) : list;
        total = Number.isFinite(Number(r?.total)) ? Number(r.total) : calls.length;
        // 이 조회보다 먼저 접수한 건만 반영한다. 작업이 곧바로 다시 실패해도 재시도할 수 있다.
        for (const [id, receipt] of receiptsBeforeRead) if (retries.get(id) === receipt &&
          (id === retriedId || list.some(c => c.id === id) || (!append && state.status === 'failed'))) retries.forget(id);
        for (const c of list) if (c.status !== 'failed' && retries.get(c.id)?.phase !== 'pending') retries.forget(c.id);
        renderResults();
        if (position) restoreListPosition(position, retriedId);
      } catch (e) {
        if (e?.name === 'AbortError' || !alive || my !== ctrl) return;
        if (silent) { scheduleRefresh(); return false; }
        render(slot('results'), html`${errorBox(e)}<button type="button" class="btn" data-act="retry">다시 불러오기</button>`);
        return false;
      } finally {
        if (my === ctrl) slot('results')?.classList.remove('is-loading');
      }
      scheduleRefresh();
      return true;
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
    function onInput(event) {
      restoreCancelled = true;
      root.querySelector('[data-act="clear-q"]')?.classList.toggle('hidden', !input.value);
      clearTimeout(typeTimer);
      if (composing || event?.isComposing) return;
      typeTimer = setTimeout(() => {
        const q = input.value.trim();
        if (q === state.q) return;
        state.q = q;
        // 한 번 이어서 치는 동안은 기록 하나만 남긴다
        changed({ push: Date.now() - lastUrlAt > 1500 });
      }, TYPE_MS);
    }
    function onCompositionStart() { composing = true; clearTimeout(typeTimer); }
    function onCompositionEnd() { composing = false; onInput(); }
    function onSubmit(e) {
      restoreCancelled = true;
      e.preventDefault();
      clearTimeout(typeTimer);
      if (composing) return;
      state.q = input.value.trim();
      input.blur(); // 휴대폰 자판 닫기
      changed({ push: true });
    }
    async function retryAudio(id) {
      const current = () => alive && el.isConnected && resumeEpoch === returnEpoch;
      const call = calls.find(c => c.id === id);
      if (!current() || !canRetryListCall(call,role)) return;
      // 재렌더·연속 클릭에도 같은 요청은 한 번만 보낸다.
      const result = retries.submit(call);
      function paint() {
        const row = [...slot('results').querySelectorAll('[data-call-id]')].find(r => r.dataset.callId === id);
        const box = row?.querySelector('.cl-retry-box');
        if (!box) return;
        const focused = box.contains(document.activeElement);
        const holder = document.createElement('div');
        render(holder,listRetryMarkup(call,role,retries.get(id)));
        box.replaceWith(holder.firstElementChild);
        if (focused) row.querySelector('[data-act="retry-audio"]')?.focus({preventScroll:true});
      }
      paint();
      const next = await result;
      if (!next || !current()) return;
      paint();
      if (next.phase !== 'accepted') return;
      toast(next.message,'ok');
      if (!calls.some(c => c.id === id)) return;
      // 200건 초과/자동 갱신 보류 목록을 강제로 축소하거나 현재 필터를 바꾸지 않는다.
      if (calls.length > 200 || refreshPaused) { pauseRefresh('받아쓰기 재요청을 접수했습니다.'); return; }
      const applied = await load({silent:true, retriedId:id});
      if (applied === false && current() && !refreshPaused) pauseRefresh('재요청은 접수했지만 목록을 갱신하지 못했습니다.');
    }
    function onClick(e) {
      restoreCancelled = true;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const link = t.closest('a[href]');
      if (link?.getAttribute('href')?.startsWith('#/calls/') && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
        // 입력 지연 처리 전에 상세를 열어도 뒤로 가기에서 마지막 검색어를 잃지 않는다.
        clearTimeout(typeTimer);
        const pendingQuery = input.value.trim() !== state.q;
        if (pendingQuery) {
          state.q = input.value.trim();
          syncUrl(false); // 상세가 쌓이기 전 현재 목록 주소만 교체한다.
        }
        if (scope) returnPosition = { scope, hash: hashFor(state), count: pendingQuery ? PAGE : calls.length, href: link.getAttribute('href') };
      }
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
          Object.assign(state, { q: '', status: 'all', range: 'all', from: undefined, to: undefined, customer: '', callType: '', callback: '' });
          input.value = '';
          root.querySelector('[data-act="clear-q"]')?.classList.add('hidden');
          changed();
          break;
        case 'refresh-list':
          load().then(ok => { if (ok && alive && el.isConnected) { input.focus({ preventScroll: true }); input.scrollIntoView({ block: 'center' }); } });
          break;
        case 'more': act.disabled = true; act.textContent = '불러오는 중…'; load({ append: true }); break;
        case 'retry-audio': if (act.getAttribute('aria-disabled') !== 'true') void retryAudio(act.closest('[data-call-id]')?.dataset.callId); break;
        case 'retry': load(); break;
        default: break;
      }
    }
    function onChange(e) {
      restoreCancelled = true;
      const id = e.target?.id;
      const filters = { 'cl-cust': 'customer', 'cl-type': 'callType', 'cl-callback': 'callback' };
      if (filters[id]) {
        state[filters[id]] = e.target.value;
        changed();
      } else if (id === 'cl-from' || id === 'cl-to') {
        state.from = root.querySelector('#cl-from').value || undefined;
        state.to = root.querySelector('#cl-to').value || undefined;
        state.range = state.from || state.to ? 'custom' : 'all';
        changed();
      }
    }

    function onNavigationIntent(event) {
      restoreCancelled = true; // 키보드 탐색·스크롤도 사용자가 새로 선택한 위치를 우선한다.
    }
    root.addEventListener('keydown', onNavigationIntent);
    window.addEventListener('wheel', onNavigationIntent, { passive: true });
    window.addEventListener('touchstart', onNavigationIntent, { passive: true });
    input.addEventListener('input', onInput);
    input.addEventListener('compositionstart', onCompositionStart);
    input.addEventListener('compositionend', onCompositionEnd);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);

    renderFilters();
    loadCustomers();
    const loaded = await load();
    if (loaded && resume) {
      // 서버의 페이지 크기·권한 검사를 그대로 사용하며 필요한 범위만 다시 조회한다.
      while (alive && !restoreCancelled && el.isConnected && resumeEpoch === returnEpoch && hashFor(state) === resume.hash && calls.length < resume.count && calls.length < total) {
        const before = calls.length;
        if (!await load({ append: true }) || calls.length <= before) break;
      }
      if (alive && !restoreCancelled && el.isConnected && resumeEpoch === returnEpoch && hashFor(state) === resume.hash) {
        const target = [...slot('results').querySelectorAll('a[href]')].find(a => a.getAttribute('href') === resume.href);
        if (target) {
          target.focus({ preventScroll: true });
          target.scrollIntoView({ block: 'center', behavior: 'instant' });
        } else input.focus({ preventScroll: true });
      }
    }

    return () => {
      alive = false;
      ctrl?.abort();
      clearTimeout(typeTimer);
      clearTimeout(refreshTimer);
      root.removeEventListener('keydown', onNavigationIntent);
      window.removeEventListener('wheel', onNavigationIntent);
      window.removeEventListener('touchstart', onNavigationIntent);
      input.removeEventListener('input', onInput);
      input.removeEventListener('compositionstart', onCompositionStart);
      input.removeEventListener('compositionend', onCompositionEnd);
      montageSearch?.destroy();
      montageStatuses?.destroy();
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
    };
  },
};
