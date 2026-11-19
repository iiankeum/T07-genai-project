// 통화 상세(F02 · F04 · F05 · F06 · F07 다시 정리 · F11): 최근 통화 · 대화 기록 · 주문 카드.
// 카드 칸을 누르면 그 말을 한 문장을 칠하고 그 시각부터 재생한다. 처리 중인 통화는 5초마다 다시 읽는다.
import { activateQuote } from './call-quote.js';
import { api } from '../api.js';
import { html, render, toast, copyText, fmtWhen, fmtClock, fmtSec, callChip, SOURCE_LABEL, highlight, href } from '../ui.js';
import { isShipTarget } from '../domain.js';
import { WORKING, num, segAtTime, resolveEvidence, buildMarks, transcriptText, groupUnsure, cloneItems } from './call-util.js';
import { mountCard } from './call-card.js';
import assistantPage from './assistant.js';

const RATES = [1, 1.25, 1.5];
const POLL_MS = 5000;
const STEPS = [['queued', '받아쓰기 기다리는 중'], ['transcribing', '받아쓰는 중'], ['extracting', '카드 정리 중']];
const ICONS = {
  arrow: html`<path d="m10 5-7 7 7 7M3 12h18"/>`,
  upload: html`<path d="M12 15V3m-5 5 5-5 5 5M4 15v5h16v-5"/>`,
  phone: html`<path d="M8 3H4a1 1 0 0 0-1 1 17 17 0 0 0 17 17 1 1 0 0 0 1-1v-4l-5-2-2 2a12 12 0 0 1-6-6l2-2-2-5Z"/>`,
  search: html`<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>`,
  history: html`<path d="M3 10a9 9 0 1 1 2 8m-2-8V4m0 6h6m3-3v5l3 2"/>`,
  copy: html`<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>`,
  back: html`<path d="M3 4v5h5m-5 0a8 8 0 1 1 2 9"/>`,
  check: html`<path d="m5 12 5 5 9-10"/>`,
  chevron: html`<path d="m9 18 6-6-6-6"/>`,
  wave: html`<path d="M4 10v4m4-7v10m4-13v16m4-13v10m4-7v4"/>`,
  play: html`<path d="m9 5 11 7-11 7Z"/>`,
  pause: html`<path d="M9 5v14m6-14v14"/>`,
};
const icon = (name) => html`<svg class="cd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

function readPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* 저장 못 해도 지금은 적용 */ }
}
const custHref = (name) => '#/customers/' + encodeURIComponent(name);
function backHref() {
  let h = '';
  try { h = sessionStorage.getItem('cn.callsHash') || ''; } catch { h = ''; }
  return h.startsWith('#/calls') ? h : '#/calls';
}

export default {
  title: '통화 상세',
  async mount(el, ctx) {
    const id = ctx.params.id;
    let meta = ctx.meta || {};
    let call = null;
    let retryPending = false;
    let cardCtl = null;
    let assistantCleanup = null;
    let alive = true;
    let ctrl = null;
    let pollTimer = null;
    let quietTimer = null;
    let audio = null;
    let playingIdx = -1;
    let markIdx = -1;
    let linkedIdx = -1;
    let frame = 0;
    let historyRequest = null;
    let historyFilter = 'all';
    let showSummary = false;
    let transcriptQuery = '';
    let transcriptMatch = 0;
    let lastCardInput = null;
    let cardReturn = null;
    let follow = readPref('cn.follow', '1') === '1';
    let rate = Number(readPref('cn.rate', '1'));
    if (!RATES.includes(rate)) rate = 1;
    let playerVisible = true;
    const target = { seg: ctx.query.seg, at: ctx.query.t };
    let targetDone = ctx.query.seg === undefined && ctx.query.t === undefined;
    const wideMq = window.matchMedia('(min-width: 1024px)');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    render(el, html`<div class="page cd-page cd-desk-page cd-with-assistant montage-scope" data-mobile-pane="card">
      <div class="cd-overview">
        <nav class="cd-topnav no-print" aria-label="통화 탐색">
          <a class="cd-back" href="${backHref()}">${icon('arrow')} 통화 기록으로</a>
          <a class="btn btn-sm" href="#/upload">${icon('upload')} 녹음 올리기</a>
        </nav>
        <div data-slot="head"><p class="loading" role="status">불러오는 중…</p></div>
      </div>
      <div data-slot="progress"></div>
      <nav class="cd-jump no-print hidden" data-slot="jump" aria-label="이 화면 안에서 이동" role="tablist">
        <button type="button" role="tab" data-jump="trans" aria-controls="cd-trans" aria-pressed="false" aria-selected="false" tabindex="-1">통화</button>
        <button type="button" role="tab" data-jump="card" aria-controls="cd-card" aria-pressed="true" aria-selected="true">주문서</button>
        <button type="button" role="tab" data-jump="assistant" aria-controls="cd-assistant" aria-pressed="false" aria-selected="false" tabindex="-1">대화</button>
      </nav>
      <div class="cd-body hidden" data-slot="body">
        <details class="cd-panel cd-history no-print" data-slot="history" ${wideMq.matches ? html`open` : ''}>
          <summary>${icon('history')} 최근 통화</summary>
          <div class="cd-rail">
            <div class="cd-rail-head">
              <h2 id="cd-history-title">${icon('history')} 주문 작업</h2><button type="button" class="btn btn-sm cd-desktop-verify" data-act="open-transcript" aria-controls="cd-trans" aria-expanded="false">선택 통화 확인</button>
              <form class="cd-history-search" role="search" aria-label="최근 통화 검색">
                <label class="sr-only" for="cd-history-q">거래처, 차량, 부품 검색</label>
                <input class="input" id="cd-history-q" name="q" type="search" maxlength="100" placeholder="거래처 · 부품 검색">
                <button class="cd-search-submit" type="submit" aria-label="찾기">${icon('search')}</button>
              </form>
              <div class="cd-history-filters" role="group" aria-label="최근 통화 상태">
                <button type="button" class="btn btn-sm" data-history="all" aria-pressed="true">전체</button>
                <button type="button" class="btn btn-sm" data-history="draft" aria-pressed="false">확인 필요</button>
              </div>
            </div>
            <div class="cd-history-scroll" data-slot="history-results" aria-live="polite"></div>
          </div>
        </details>
        <section class="cd-panel cd-trans" id="cd-trans" aria-labelledby="cd-trans-h" data-slot="trans" tabindex="-1">
          <div class="cd-drawer-head"><span>선택 통화 · 원문 확인</span><button type="button" class="btn btn-sm" data-act="close-transcript">최근 주문 목록</button></div><div data-slot="trans-head"></div>
          <div class="cd-player-slot" data-slot="player"></div>
          <div class="cd-trans-scroll" data-slot="trans-scroll" tabindex="0" role="region" aria-label="대화 내용"></div>
        </section>
        <section class="cd-panel cd-card" id="cd-card" aria-labelledby="cd-card-h" data-slot="card" tabindex="-1"></section>
        <aside class="cd-assistant no-print" id="cd-assistant" data-slot="assistant" aria-label="현재 통화에 대한 대화" tabindex="-1"></aside>
        <svg class="cd-connector" data-slot="connector" width="1" height="1" aria-hidden="true" focusable="false"><path/><circle r="3"/><circle r="3"/></svg>
      </div>
      <div class="cd-foot no-print" data-slot="foot"></div>
      <button type="button" class="cd-float hidden" data-act="float"></button>
    </div>`);
    const root = el.querySelector('.cd-page');
    const slot = (name) => root.querySelector(`[data-slot="${name}"]`);
    const floatBtn = root.querySelector('.cd-float');

    const curCard = () => (cardCtl ? cardCtl.card : call?.card) || null;
    const segments = () => (Array.isArray(call?.segments) ? call.segments : []);
    const resolve = (ev) => resolveEvidence(segments(), ev);

    const history = slot('history');
    const historyForm = history.querySelector('form');
    const historyQuery = historyForm.elements.q;
    let historyLoaded = false;

    async function loadHistory() {
      historyRequest?.abort();
      const ac = new AbortController();
      historyRequest = ac;
      const q = historyQuery.value.trim();
      const results = slot('history-results');
      if (!historyLoaded) render(results, html`<p class="cd-list-state">불러오는 중…</p>`);
      try {
        const data = await api.get('/api/calls', { limit: 8, status: historyFilter, q }, { signal: ac.signal });
        if (!alive || ac.signal.aborted) return;
        const rows = (data.calls || []).map((c) => c.id === id ? call || c : c);
        const total = Number(data.total) || rows.length;
        if (!q && historyFilter === 'all' && call && !rows.some((c) => c.id === id)) rows.unshift(call);
        render(results, html`
          ${rows.length ? html`<ul class="cd-list">${rows.map((c) => {
            const name = c.card?.customer || c.customer || (c.source === 'live' ? '실시간 통화' : '거래처 미확인');
            const parts = [c.card?.carModel, c.card?.items?.[0]?.part].filter(Boolean).join(' · ');
            return html`<li><a class="cd-list-link" href="#/calls/${encodeURIComponent(c.id)}" ${c.id === id ? html`aria-current="page"` : ''}>
              <strong class="cd-list-name" title="${c.title || name}">${name}</strong>
              ${parts ? html`<span class="cd-list-desc" title="${parts}">${parts}</span>` : ''}
              <div class="cd-list-meta"><time datetime="${c.recordedAt}">${fmtClock(c.recordedAt)}</time>${callChip(c)}</div>
            </a></li>`;
          })}</ul>` : html`<p class="cd-list-state">${q || historyFilter !== 'all' ? '조건에 맞는 통화가 없습니다.' : '최근 통화가 없습니다.'}</p>`}
          <a href="${backHref()}" class="cd-list-more">통화 검색${total > rows.length ? ` · ${total}건` : ''}${icon('chevron')}</a>
        `);
        historyLoaded = true;
      } catch (e) {
        if (!alive || ac.signal.aborted) return;
        render(results, html`<p class="cd-list-state">최근 통화를 불러오지 못했습니다.</p><button type="button" class="btn btn-sm" data-history="retry">다시 불러오기</button>`);
      }
    }
    function onHistoryToggle() {
      if (history.open && !historyLoaded) void loadHistory();
    }
    function onHistorySearch(event) { event.preventDefault(); void loadHistory(); }
    history.addEventListener('toggle', onHistoryToggle);
    historyForm.addEventListener('submit', onHistorySearch);

    // ── 머리 ──────────────────────────────────────────────────────
    function workflow(card) {
      const status = card?.status;
      if (!status || status === 'cancelled' || call.status !== 'ready') return callChip({ ...call, card });
      const shipping = status === 'shipped' || isShipTarget(card);
      const steps = [
        { label: status === 'draft' ? '주문 검토' : '확정 완료', state: status === 'draft' ? 'current' : 'done' },
      ];
      if (shipping) {
        steps.push({ label: status === 'shipped' ? '출고 완료' : '출고 대기', state: status === 'shipped' ? 'done' : status === 'confirmed' ? 'current' : 'next' });
      }
      return html`<ol class="cd-workflow" aria-label="주문 처리 단계">
        ${steps.map(({ label, state }) => html`<li class="is-${state}" ${state === 'current' ? html`aria-current="step"` : ''}>
          <span class="cd-stage-marker">${state === 'done' ? icon('check') : ''}</span><span>${label}</span>
        </li>`)}
      </ol>`;
    }

    function renderHead() {
      const card = curCard();
      const name = card?.customer || call.customer || (call.source === 'live' ? '실시간 통화' : '거래처 미확인');
      const parts = (card?.items || []).filter((item) => item?.part);
      const subject = parts.length ? `${parts[0].part}${parts.length > 1 ? ` 외 ${parts.length - 1}개` : ''}` : card?.callType;
      const source = call.isFake && call.source === 'seed' ? '예시 통화' : SOURCE_LABEL[call.source] || call.source;
      render(slot('head'), html`<header class="cd-head">
        <div class="cd-identity">
          <span class="cd-avatar" aria-hidden="true">${icon('phone')}</span>
          <div class="cd-identity-text">
            <h1 class="cd-title">${name}</h1>
            <ul class="cd-title-meta" aria-label="통화 정보">
              ${subject ? html`<li class="cd-subject">${subject}</li>` : ''}
              ${call.recordedAt ? html`<li><time datetime="${call.recordedAt}">${fmtWhen(call.recordedAt)}</time></li>` : ''}
              ${call.durationSec ? html`<li>${fmtSec(call.durationSec)}</li>` : ''}
              ${call.callerNumber ? html`<li>${call.callerNumber}</li>` : ''}
              ${source ? html`<li>${source}</li>` : ''}
              ${call.isFake && call.source !== 'seed' ? html`<li>예시 통화</li>` : ''}
            </ul>
            ${call.originalName ? html`<p class="cd-filename" title="${call.originalName}">${call.originalName}</p>` : ''}
          </div>
        </div>
        <div class="cd-head-status">
          ${workflow(card)}
          ${card?.urgent || card?.callback ? html`<div class="cd-head-flags">
          ${card?.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}
          ${card?.callback ? html`<span class="chip chip-callback">다시 전화</span>` : ''}
          </div>` : ''}
        </div>
      </header>`);
    }

    function renderFoot() {
      const cust = curCard()?.customer || call.customer;
      render(slot('foot'), html`<nav class="cd-context-links" aria-label="통화 관련 작업">
        <a href="${href('/assistant', { call: id })}">이 통화로 묻기${icon('chevron')}</a>
        <a data-knowledge href="${knowledgeHref()}">공유 지식 제안${icon('chevron')}</a>
        ${cust ? html`<a href="${custHref(cust)}">거래처 통화 보기${icon('chevron')}</a>` : ''}
      </nav>`);
    }
    function knowledgeHref() { return href('/knowledge', { call: id, seg: markIdx >= 0 ? markIdx : undefined }); }

    // ── 진행 상황(받아쓰기 · 정리 중) ──────────────────────────────
    function renderProgress() {
      const s = slot('progress');
      if (call.status === 'failed') {
        render(s, html`<div class="notice notice-error cd-failed" role="alert"><strong>이 통화는 처리하지 못했습니다.</strong> ${call.error || '이유를 알 수 없습니다.'}<br>${call.hasAudio && !call.transcript && ['admin', 'reception'].includes(meta?.access?.role) ? html`<button type="button" class="btn btn-primary" data-act="retry-transcription" ${retryPending ? 'disabled' : ''}>${retryPending ? '다시 요청하는 중…' : '저장된 녹음으로 다시 받아쓰기'}</button>` : '저장된 녹음과 재시도 권한을 관리자에게 확인해 주세요.'}</div>`);
        return;
      }
      if (!WORKING.includes(call.status)) { render(s, html``); return; }
      const cur = STEPS.findIndex(([k]) => k === call.status);
      const w = meta.worker || {};
      const waiting = num(w.queue?.waiting) || 0;
      const pos = num(call.queuePosition);
      let line;
      if (call.status === 'queued') {
        line = w.online
          ? `받아쓰기 일꾼 켜짐 — ${pos ? `줄 ${pos}번째, ` : ''}곧 받아쓰기를 시작합니다.`
          : `받아쓰기 일꾼 대기 중 — ${pos ? `줄 ${pos}번째` : `기다리는 통화 ${waiting}건`}. 받아쓰기 PC가 연결되면 순서대로 처리합니다.`;
      } else if (call.status === 'transcribing') {
        line = `받아쓰기 일꾼이 받아쓰고 있습니다${w.engine ? ` (${w.engine})` : ''}.`;
      } else {
        line = 'AI 가 받아쓴 글에서 주문 카드를 만들고 있습니다.';
      }
      render(s, html`<section class="card cd-progress" aria-live="polite">
        <h2>통화를 정리하고 있습니다</h2>
        <ol class="cd-steps">${STEPS.map(([, label], i) => html`<li class="cd-step ${i < cur ? 'is-done' : i === cur ? 'is-now' : ''}">
          <span class="cd-step-mark" aria-hidden="true">${i < cur ? '✓' : i === cur ? html`<span class="spinner"></span>` : '○'}</span>
          <span>${label}</span>${i === cur ? html`<span class="sr-only">(지금 단계)</span>` : ''}</li>`)}</ol>
        <p class="cd-worker ${w.online ? 'is-on' : 'is-off'}">${line}</p>
        <p class="cd-dim">5초마다 저절로 새로 봅니다. 이 화면을 닫아도 정리는 계속됩니다.</p>
      </section>`);
    }

    // ── 녹음 막대 ─────────────────────────────────────────────────
    function noAudioText() {
      if (call.source === 'seed') return '대본 기반 · 녹음 없음';
      if (call.source === 'live') return '실시간 받아쓰기 · 녹음 없음';
      return '보관된 녹음 없음';
    }
    function renderPlayer() {
      const s = slot('player');
      if (audio) { audio.pause(); audio = null; }
      s.classList.toggle('has-audio', Boolean(call.hasAudio));
      if (!call.hasAudio) {
        render(s, html`<p class="cd-noaudio">${icon('wave')}${noAudioText()}</p>`);
        return;
      }
      render(s, html`<section class="cd-player" aria-label="녹음 듣기">
        <audio class="cd-audio" controls preload="metadata" src="${api.url('/api/calls/' + encodeURIComponent(id) + '/audio')}">이 브라우저는 녹음 재생을 지원하지 않습니다.</audio>
        <div class="cd-player-row">
          <button type="button" class="btn btn-sm" data-act="back5" aria-label="5초 뒤로 감기">${icon('back')} 5초 뒤로</button>
          <div class="cd-rates" role="group" aria-label="재생 빠르기">
            ${RATES.map((r) => html`<button type="button" class="btn btn-sm cd-rate" data-rate="${r}" aria-pressed="${r === rate}">${r}배</button>`)}
          </div>
        </div>
        <p class="cd-player-note" data-slot="pnote" aria-live="polite"></p>
      </section>`);
      audio = s.querySelector('audio');
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
      audio.addEventListener('timeupdate', onTime);
      audio.addEventListener('play', updateFloat);
      audio.addEventListener('pause', updateFloat);
      audio.addEventListener('loadedmetadata', () => { if (audio) audio.playbackRate = rate; });
      audio.addEventListener('error', () => {
        playerNote('녹음을 불러오지 못했습니다. 잠시 뒤 화면을 다시 열어 주세요.');
      });
    }
    function playerNote(text) {
      const n = root.querySelector('[data-slot="pnote"]');
      if (n) n.textContent = text || '';
    }
    /** at 초로 옮기고(play 면 재생). 브라우저가 저절로 재생을 막으면 blockedNote 를 보인다 */
    function seekTo(at, play, blockedNote = '▶ 단추를 눌러 들어 주세요.') {
      if (!audio) return;
      const a = audio;
      const t = Math.max(0, (num(at) ?? 0) - 0.2);
      const set = () => { try { a.currentTime = t; } catch { /* 아직 못 감음 */ } };
      if (a.readyState >= 1) set();
      else a.addEventListener('loadedmetadata', set, { once: true });
      if (play) a.play().catch(() => { if (alive) playerNote(blockedNote); });
    }
    function setRate(r) {
      rate = r;
      writePref('cn.rate', r);
      if (audio) { audio.defaultPlaybackRate = r; audio.playbackRate = r; }
      root.querySelectorAll('.cd-rate').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.rate) === r)));
    }

    // ── 통화 글 ───────────────────────────────────────────────────
    function unsureBySeg() {
      const map = new Map();
      const card = curCard();
      if (!card) return map;
      const groups = groupUnsure(card, cloneItems(card.items));
      for (const list of groups.values()) {
        for (const { u } of list) {
          const r = resolve(u);
          if (!r || r.segIndex < 0) continue;
          if (!map.has(r.segIndex)) map.set(r.segIndex, []);
          map.get(r.segIndex).push(u.reason || '받아쓰기가 틀렸을 수 있습니다');
        }
      }
      return map;
    }
    function segRow(s, i, marks, flags) {
      const st = num(s?.start);
      const what = call.hasAudio ? '부터 듣기' : ' 대목 표시';
      return html`<li class="cd-seg ${flags ? 'is-unsure' : ''}" data-i="${i}" id="cd-seg-${i}" tabindex="-1">
        <div class="cd-seg-timeline">
          ${st !== null ? html`<button type="button" class="cd-time" data-seek="${i}" aria-label="${fmtSec(st)}${what}">${fmtSec(st)}</button>` : ''}
        </div>
        <div class="cd-seg-body">
          ${s?.speaker ? html`<span class="cd-spk">${s.speaker}</span>` : ''}
          <span class="cd-text">${highlight(s?.text ?? '', marks)}</span>
          ${flags ? html`<span class="cd-seg-flag"><button type="button" class="listen-flag" data-seek="${i}">${call.hasAudio ? '들어 보기' : '근거 표시'}</button> ${flags.join(' · ')}</span>` : ''}
        </div>
      </li>`;
    }
    function summaryView(card) {
      const asks = Array.isArray(card?.askBack) ? card.askBack.filter(Boolean) : [];
      const checks = Array.isArray(card?.unsure) ? [...new Set(card.unsure.map((u) => u?.reason).filter(Boolean))] : [];
      return html`<div class="cd-summary-view">
        <h3>통화 한눈에 보기</h3>
        <p>${call.summary || '등록된 요약이 없습니다.'}</p>
        ${asks.length ? html`<h3>다시 물어볼 것</h3><ul>${asks.map((a) => html`<li>${a}</li>`)}</ul>` : ''}
        ${checks.length ? html`<h3>담당자 확인 항목</h3><ul>${checks.map((reason) => html`<li>${reason}</li>`)}</ul>` : ''}
      </div>`;
    }
    function renderTranscript() {
      const segs = segments();
      const card = curCard();
      const marks = buildMarks(card);
      const fixes = Array.isArray(card?.fixes) ? card.fixes.filter((f) => f && f.heard) : [];
      const flags = unsureBySeg();
      const hasText = segs.length || call.transcript;
      render(slot('trans-head'), html`<header class="cd-trans-top">
        <div class="cd-pane-title">
          <h2 id="cd-trans-h">대화 기록</h2>
          <button type="button" class="btn btn-ghost btn-sm cd-copy" data-act="copy" ${hasText ? '' : html`disabled`}>${icon('copy')} 복사</button>
        </div>
        <div class="cd-trans-tools">
          <div class="cd-trans-views" role="group" aria-label="대화 보기">
            <button type="button" class="cd-view-tab" data-trans-view="text" aria-pressed="${!showSummary}">전체 대화</button>
            <button type="button" class="cd-view-tab" data-trans-view="summary" aria-pressed="${showSummary}">통화 요약</button>
          </div>
          ${!showSummary && call.hasAudio && segs.length ? html`<button type="button" class="btn btn-sm cd-follow" data-act="follow" aria-pressed="${follow}">${follow ? '따라가기 켬' : '따라가기 끔'}</button>` : ''}
        </div>
        ${!showSummary && hasText ? html`<div class="cd-trans-search" role="search" aria-label="이 통화 대화에서 찾기">
          <label class="sr-only" for="cd-trans-query">대화에서 찾을 말</label>
          <input id="cd-trans-query" class="input" type="search" maxlength="100" placeholder="대화에서 찾기" value="${transcriptQuery}" aria-describedby="cd-trans-search-count">
          <span id="cd-trans-search-count" class="cd-search-count" role="status" aria-live="polite"></span>
          <button type="button" class="btn btn-sm" data-trans-find="prev" aria-label="이전 일치 문장">↑</button>
          <button type="button" class="btn btn-sm" data-trans-find="next" aria-label="다음 일치 문장">↓</button>
        </div>` : ''}
      </header>`);
      const scroll = slot('trans-scroll');
      const scrollTop = scroll.scrollTop;
      const legendOpen = Boolean(scroll.querySelector('.cd-legend-details[open]'));
      render(scroll, showSummary ? summaryView(card) : html`
        ${hasText ? html`<details class="cd-legend-details" ${legendOpen ? html`open` : ''}>
          <summary>강조 표시 안내${fixes.length ? ` · 교정 ${fixes.length}건` : ''}</summary>
          <div class="legend cd-legend" role="note" aria-label="대화 강조 표시">
            <mark class="hl hl-part">부품</mark><mark class="hl hl-car">차종 · 차번호</mark><mark class="hl hl-customer">거래처</mark><mark class="hl hl-urgent">급함</mark>${fixes.length ? html`<mark class="hl hl-fix">고쳐 읽은 말</mark>` : ''}
          </div>
          ${fixes.length ? html`<ul class="cd-fixes">${fixes.map((f) => html`<li>${f.heard} → ${f.fixed || '?'}</li>`)}</ul>` : ''}
        </details>` : ''}
        ${segs.length ? html`<ol class="cd-segs">${segs.map((s, i) => segRow(s, i, marks, flags.get(i)))}</ol>`
          : call.transcript ? html`<p class="cd-plain">${highlight(call.transcript, marks)}</p>`
            : html`<p class="cd-empty">${WORKING.includes(call.status) ? '받아쓰기가 끝나면 대화가 표시됩니다.' : '받아쓴 글이 없습니다.'}</p>`}
      `);
      scroll.scrollTop = scrollTop;
      if (playingIdx >= 0) lineEl(playingIdx)?.classList.add('is-playing');
      if (markIdx >= 0) lineEl(markIdx)?.classList.add('is-mark');
      updateTranscriptSearch();
      scheduleConnector();
    }
    function updateTranscriptSearch(step = 0, jump = false) {
      const all = [...slot('trans-scroll').querySelectorAll('.cd-seg, .cd-plain')];
      const needle = transcriptQuery.trim().toLocaleLowerCase();
      const matches = all.filter(line => needle && (line.querySelector('.cd-text') || line).textContent.toLocaleLowerCase().includes(needle));
      transcriptMatch = matches.length ? (transcriptMatch + step + matches.length) % matches.length : 0;
      all.forEach(line => {
        line.classList.toggle('is-search-match', matches.includes(line));
        line.classList.toggle('is-search-current', matches[transcriptMatch] === line);
      });
      const count = root.querySelector('#cd-trans-search-count');
      if (count) count.textContent = !needle ? '' : matches.length ? `${transcriptMatch + 1}/${matches.length} 문장` : '일치 없음';
      root.querySelectorAll('[data-trans-find]').forEach(button => { button.disabled = !matches.length; });
      if (jump && matches.length) {
        const line = matches[transcriptMatch];
        if (line.matches('.cd-seg')) scrollToSeg(Number(line.dataset.i), true);
        else line.scrollIntoView({block:'center', behavior:reduceMotion ? 'auto' : 'smooth'});
      }
    }
    function onTranscriptInput(e) {
      if (e.target.id !== 'cd-trans-query') return;
      transcriptQuery = e.target.value;
      transcriptMatch = 0;
      updateTranscriptSearch();
    }
    function onTranscriptKey(e) {
      if(e.target.matches('[data-jump]') && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
        e.preventDefault(); const tabs=[...slot('jump').querySelectorAll('[data-jump]')],i=tabs.indexOf(e.target);
        const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
        tabs[next].click(); tabs[next].focus(); return;
      }
      if (e.target.id !== 'cd-trans-query' || e.isComposing) return;
      if (e.key === 'Enter') { e.preventDefault(); updateTranscriptSearch(e.shiftKey ? -1 : 1, true); }
      if (e.key === 'Escape') { e.preventDefault(); transcriptQuery = ''; e.target.value = ''; transcriptMatch = 0; updateTranscriptSearch(); }
    }
    const lineEl = (i) => (i >= 0 ? root.querySelector(`#cd-seg-${i}`) : null);

    function setPlaying(i) {
      lineEl(playingIdx)?.classList.remove('is-playing');
      playingIdx = i;
      lineEl(i)?.classList.add('is-playing');
    }
    function markSeg(i) {
      lineEl(markIdx)?.classList.remove('is-mark');
      markIdx = i;
      lineEl(i)?.classList.add('is-mark');
      const proposal = slot('foot').querySelector('[data-knowledge]');
      if (proposal) proposal.href = knowledgeHref();
      scheduleConnector();
    }

    function drawConnector() {
      frame = 0;
      const svg = slot('connector');
      const [path, start, end] = svg.children;
      svg.classList.remove('is-visible');
      if (!wideMq.matches || linkedIdx < 0 || linkedIdx !== markIdx || showSummary) return;
      const source = lineEl(linkedIdx);
      const field = slot('card').querySelector('.ev-active');
      if (!source || !field) return;
      const panel = slot('trans-scroll');
      const panelRect = panel.getBoundingClientRect();
      const cardRect = slot('card').querySelector('.cd-card-scroll')?.getBoundingClientRect() || slot('card').getBoundingClientRect();
      const origin = slot('body').getBoundingClientRect();
      const from = source.getBoundingClientRect();
      const to = field.getBoundingClientRect();
      const top = document.querySelector('.topbar')?.offsetHeight || 0;
      // A wrapped evidence segment can be taller than its scroll pane. Anchor
      // within its visible portion, but never connect to fully clipped content.
      const fromTop = Math.max(from.top, panelRect.top, top);
      const fromBottom = Math.min(from.bottom, panelRect.bottom, window.innerHeight);
      const toTop = Math.max(to.top, cardRect.top, top);
      const toBottom = Math.min(to.bottom, cardRect.bottom, window.innerHeight);
      if (fromBottom <= fromTop || toBottom <= toTop) return;
      const fromY = (fromTop + fromBottom) / 2;
      const toY = Math.min(Math.max(to.top + Math.min(to.height / 2, 22), toTop), toBottom);
      const x1 = from.right - origin.left;
      const x2 = to.left - origin.left;
      const y1 = fromY - origin.top;
      const y2 = toY - origin.top;
      const mid = (x1 + x2) / 2;
      if (x2 <= x1) return;
      path.setAttribute('d', `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);
      start.setAttribute('cx', x1);
      start.setAttribute('cy', y1);
      end.setAttribute('cx', x2);
      end.setAttribute('cy', y2);
      svg.classList.add('is-visible');
    }
    function scheduleConnector() {
      if (!frame) frame = requestAnimationFrame(drawConnector);
    }
    // 원문 확인 전 편집하던 칸을 기억한다. 저장/데이터 상태와는 분리된 화면 내 이동 정보다.
    function rememberCardInput(event) {
      const target = event.target;
      if (target instanceof HTMLElement && slot('card').contains(target) && target.matches('input[data-field],textarea[data-field],select[data-field],input[data-item]')) lastCardInput = target;
    }
    function rememberCardReturn(block = null) {
      if (wideMq.matches) return;
      // An explicit item-evidence jump without an edited field returns to the item name,
      // not whichever input happens to appear first in the responsive order-sheet layout.
      const target = lastCardInput?.isConnected && (!block || block.contains(lastCardInput))
        ? lastCardInput : block?.querySelector('input[data-item="part"]')
          || block?.querySelector('input[data-field],textarea[data-field],select[data-field],input[data-item]')
          || block?.querySelector('.cd-evbtn');
      if (!target) { cardReturn = null; return; }
      const index = Number(target.dataset.i);
      cardReturn = { target, field: target.dataset.field, itemField: target.dataset.item,
        itemId: target.dataset.item ? curCard()?.items?.[index]?.id : null };
    }
    function restoreCardReturn() {
      if (wideMq.matches || !cardReturn) return false;
      let target = cardReturn.target?.isConnected ? cardReturn.target : null;
      if (!target && cardReturn.field) target = [...slot('card').querySelectorAll('[data-field]')].find(el => el.dataset.field === cardReturn.field);
      if (!target && cardReturn.itemId) {
        const index = curCard()?.items?.findIndex(item => item.id === cardReturn.itemId);
        target = [...slot('card').querySelectorAll('[data-item]')].find(el => Number(el.dataset.i) === index && el.dataset.item === cardReturn.itemField);
      }
      if (!target || target.disabled) return false;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
      return true;
    }
    function showMobilePane(name) {
      root.dataset.mobilePane = name;
      slot('jump').querySelectorAll('[data-jump]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.jump === name));
        btn.setAttribute('aria-selected', String(btn.dataset.jump === name));
        btn.tabIndex = btn.dataset.jump === name ? 0 : -1;
      });
    }
    /** 문장을 보이게 한다. force 가 아니면 이미 보일 때는 움직이지 않는다 */
    function scrollToSeg(i, force = false) {
      const line = lineEl(i);
      if (!line) return;
      const behavior = reduceMotion ? 'auto' : 'smooth';
      const p = slot('trans-scroll');
      if (wideMq.matches && p.scrollHeight > p.clientHeight + 4 && getComputedStyle(p).overflowY !== 'visible') {
        const pr = p.getBoundingClientRect();
        const lr = line.getBoundingClientRect();
        const visible = lr.top >= pr.top && lr.bottom <= pr.bottom;
        if (!force && visible) return;
        p.scrollTo({ top: p.scrollTop + (lr.top - pr.top) - p.clientHeight / 3, behavior });
        return;
      }
      const lr = line.getBoundingClientRect();
      const top = (document.querySelector('.topbar')?.offsetHeight || 60) + 8;
      const visible = lr.top >= top && lr.bottom <= window.innerHeight - 90;
      if (!force && visible) return;
      line.scrollIntoView({ block: 'center', behavior });
    }
    function transInView() {
      const r = slot('trans').getBoundingClientRect();
      return r.top < window.innerHeight * 0.5 && r.bottom > 120;
    }
    function onTime() {
      if (!audio) return;
      const i = segAtTime(segments(), audio.currentTime);
      if (i !== playingIdx) {
        setPlaying(i);
        if (follow && !audio.paused && i >= 0 && (wideMq.matches || transInView())) scrollToSeg(i);
      }
      updateFloat();
    }

    // ── 카드에서 근거 고르기(F05) ──────────────────────────────────
    function setDesktopTranscript(open) {
      if (!wideMq.matches) return;
      root.classList.toggle('cd-transcript-open', open);
      root.querySelector('[data-act="open-transcript"]')?.setAttribute('aria-expanded', String(open));
      requestAnimationFrame(() => { measure(); scheduleConnector(); });
    }
    function onAssistantEvidence(result) {
      if (!alive || !wideMq.matches || !result || result.callId !== id || result.field !== 'qty') return;
      const index = result.segIndex;
      const segment = Number.isInteger(index) && index >= 0 ? segments()[index] : null;
      const at = result.at;
      const quote = typeof result.quote === 'string' ? result.quote.trim() : '';
      const normalize = text => String(text || '').replace(/\s+/g, ' ').trim();
      if (!segment || !quote || !normalize(segment.text).includes(normalize(quote)) || !Number.isFinite(at)
        || at < Number(segment.start) || at > Number(segment.end)) return;
      setDesktopTranscript(true);
      if (showSummary) { showSummary = false; renderTranscript(); }
      markSeg(index);
      const card = slot('card');
      card.querySelectorAll('.cd-assistant-evidence-target').forEach(field => field.classList.remove('cd-assistant-evidence-target'));
      // A single item is unambiguous; never guess a field on a multi-item order.
      const quantities = card.querySelectorAll('input[data-item="qty"]');
      if (quantities.length === 1) quantities[0].closest('.cd-sub-qty')?.classList.add('cd-assistant-evidence-target');
      requestAnimationFrame(() => scrollToSeg(index, true));
    }
    function onEvidence(r, { play, scroll }) {
      if (r && (scroll || play)) setDesktopTranscript(true);
      linkedIdx = r?.segIndex ?? -1;
      if (!r) { markSeg(-1); return; }
      if (r.segIndex >= 0) {
        if (showSummary) { showSummary = false; renderTranscript(); }
        markSeg(r.segIndex);
        // 좁은 화면에서는 카드를 보고 있으므로 글로 끌고 가지 않는다(칸 아래에 근거 문장이 보인다)
        if (scroll && wideMq.matches) scrollToSeg(r.segIndex, true);
      } else {
        markSeg(-1);
      }
      const at = r.at ?? num(segments()[r.segIndex]?.start);
      if (play && audio && at !== null) {
        seekTo(at, true);
        playerNote(`${fmtSec(at)} 대목부터 들려 드립니다.`);
      }
    }
    function jumpToTranscript(r) {
      setDesktopTranscript(true);
      rememberCardReturn(slot('card').querySelector('.ev-active'));
      showMobilePane('trans');
      if (showSummary) { showSummary = false; renderTranscript(); }
      activateQuote(r, {
        lineFor:lineEl, transcript:slot('trans'), mark:markSeg, hasAudio:Boolean(audio),
        scroll:index => index >= 0 ? scrollToSeg(index,true) : slot('trans').scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'}),
        seek:at => seekTo(at,true),
      });
    }

    // ── 떠 있는 재생 단추(녹음 막대가 화면 밖일 때) ─────────────────
    function updateFloat() {
      const show = Boolean(audio) && !playerVisible && (!audio.paused || audio.currentTime > 0);
      floatBtn.classList.toggle('hidden', !show);
      if (show) render(floatBtn, html`${icon(audio.paused ? 'play' : 'pause')} ${audio.paused ? '계속 듣기' : '멈춤'} ${fmtSec(audio.currentTime)}`);
    }
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => { playerVisible = entries.some((e) => e.isIntersecting); updateFloat(); })
      : null;
    io?.observe(slot('player'));

    // 넓은 화면에서 각 작업 영역이 화면에 들어오도록 높이를 맞춘다.
    const topbar = document.querySelector('.topbar');
    const measure = () => {
      root.style.setProperty('--cd-top', `${topbar?.offsetHeight || 60}px`);
      const actionHeight = root.querySelector('.cd-actions')?.offsetHeight || 0;
      root.style.setProperty('--cd-actions-h', `${actionHeight}px`);
      if (wideMq.matches && !slot('body').classList.contains('hidden')) {
        const bodyTop = slot('body').getBoundingClientRect().top + window.scrollY;
        const available = Math.floor(window.innerHeight - bodyTop - slot('foot').offsetHeight - 22);
        root.style.setProperty('--cd-workspace-h', `${available}px`);
      }
      scheduleConnector();
    };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    if (ro) {
      if (topbar) ro.observe(topbar);
      ['head', 'progress', 'foot', 'trans-scroll', 'card'].forEach((name) => ro.observe(slot(name)));
    }
    window.addEventListener('scroll', scheduleConnector, { capture: true, passive: true });
    window.addEventListener('resize', measure);
    root.addEventListener('toggle', measure, true);
    root.addEventListener('input', scheduleConnector);

    // ── 찾기에서 온 대목(?t=&seg=) ─────────────────────────────────
    function applyTarget() {
      if (targetDone || !segments().length) return;
      targetDone = true;
      const r = resolveEvidence(segments(), target);
      if (!r) return;
      if (r.segIndex >= 0) {
        showMobilePane('trans');
        markSeg(r.segIndex);
        requestAnimationFrame(() => requestAnimationFrame(() => scrollToSeg(r.segIndex, true)));
      }
      if (audio && r.at !== null) {
        // 찾기 · 묻기에서 문장을 눌러 왔으니 그 대목부터 들려준다(막히면 위치만 맞춰 둔다)
        playerNote(`찾은 대목(${fmtSec(r.at)})부터 들려 드립니다.`);
        seekTo(r.at, true, `찾은 대목(${fmtSec(r.at)})에 맞춰 두었습니다. ▶ 를 누르면 그 대목부터 들립니다.`);
      }
    }

    // ── 불러오기 ──────────────────────────────────────────────────
    function mountCardCtl() {
      cardCtl?.destroy();
      cardCtl = mountCard(slot('card'), {
        callId: id,
        call,
        meta,
        hasAudio: Boolean(call.hasAudio),
        resolve,
        onEvidence,
        onCardChange: (card, { fields }) => {
          call = { ...call, card };
          renderHead();
          renderFoot();
          renderTranscript();
          if (fields.some((f) => ['customer', 'items', 'status', 'callback'].includes(f))) refreshQuiet();
        },
        onCallReplaced: (c) => {
          call = c;
          cardCtl.update(c);
          renderHead();
          renderFoot();
          renderTranscript();
        },
        onJumpToTranscript: jumpToTranscript,
      });
    }

    function apply(c) {
      const prev = call;
      call = c;
      document.title = `${c.title || '통화 상세'} · 아차`;
      renderHead();
      if (!prev || Boolean(prev.hasAudio) !== Boolean(c.hasAudio)) renderPlayer();
      renderProgress();
      slot('body').classList.remove('hidden');
      const working = WORKING.includes(c.status);
      if (working) {
        cardCtl?.destroy();
        cardCtl = null;
        render(slot('card'), html`<header class="cd-card-head cd-pane-title"><h2 id="cd-card-h">주문 카드</h2></header>
          <p class="cd-empty">받아쓰기와 정리가 끝나면 카드가 여기에 나옵니다.</p>`);
      } else if (!cardCtl) {
        mountCardCtl();
        if (prev && WORKING.includes(prev.status)) toast(c.status === 'failed' ? '이 통화는 처리하지 못했습니다.' : '받아쓰기와 카드 정리가 끝났습니다.', c.status === 'failed' ? 'error' : 'ok');
      }
      slot('jump').classList.remove('hidden');
      renderTranscript();
      renderFoot();
      applyTarget();
      measure();
      clearTimeout(pollTimer);
      if (working) pollTimer = setTimeout(poll, POLL_MS);
    }

    async function poll() {
      if (!alive) return;
      try { meta = (await ctx.refreshMeta()) || meta; } catch { /* 메타는 없어도 된다 */ }
      await load(true);
      if (alive && call && WORKING.includes(call.status) && !pollTimer) pollTimer = setTimeout(poll, POLL_MS);
    }

    async function load(quiet = false) {
      ctrl?.abort();
      ctrl = new AbortController();
      pollTimer = null;
      try {
        const c = await api.get(`/api/calls/${encodeURIComponent(id)}`, null, { signal: ctrl.signal });
        if (!alive) return;
        apply(c);
      } catch (e) {
        if (e?.name === 'AbortError' || !alive) return;
        if (!call) {
          const gone = e?.status === 404;
          render(slot('head'), html`<div class="card cd-missing">
            <p class="notice ${gone ? '' : 'notice-error'}" role="alert">${gone ? '이 통화를 찾을 수 없습니다. 통화 목록에서 다시 확인해 주세요.' : e?.message || '통화를 불러오지 못했습니다.'}</p>
            <div class="row">${gone ? '' : html`<button type="button" class="btn btn-primary" data-act="retry">다시 불러오기</button>`}<a class="btn" href="${backHref()}">통화 목록으로</a></div>
          </div>`);
        } else if (!quiet) {
          toast(e?.message || '새로 읽지 못했습니다.', 'error');
        } else if (WORKING.includes(call.status)) {
          pollTimer = setTimeout(poll, POLL_MS * 2);
        }
      }
    }

    /** 카드를 고친 뒤 제목 · 요약만 서버에서 새로 받는다(입력 중인 카드는 건드리지 않는다) */
    function refreshQuiet() {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(async () => {
        try {
          const c = await api.get(`/api/calls/${encodeURIComponent(id)}`);
          if (!alive || !call) return;
          call = { ...call, title: c.title, summary: c.summary, customer: c.customer };
          document.title = `${c.title || '통화 상세'} · 아차`;
          renderHead();
          renderFoot();
          if (history.open) void loadHistory();
        } catch { /* 다음에 다시 읽으면 된다 */ }
      }, 900);
    }

    // ── 이벤트 ──────────────────────────────────────────────────────
    function onClick(e) {
      const t = e.target;
      if (!(t instanceof Element) || t.closest('.cd-assistant')) return;
      const findButton = t.closest('[data-trans-find]');
      if (findButton) { updateTranscriptSearch(findButton.dataset.transFind === 'prev' ? -1 : 1, true); return; }
      const historyBtn = t.closest('[data-history]');
      if (historyBtn) {
        if (historyBtn.dataset.history !== 'retry') {
          historyFilter = historyBtn.dataset.history;
          history.querySelectorAll('[data-history][aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', String(b === historyBtn)));
        }
        void loadHistory();
        return;
      }
      const transTab = t.closest('[data-trans-view]');
      if (transTab) {
        const mode = transTab.dataset.transView;
        showSummary = mode === 'summary';
        renderTranscript();
        slot('trans').querySelector(`[data-trans-view="${mode}"]`)?.focus({ preventScroll: true });
        return;
      }
      const act = t.closest('[data-act]');
      if (act && !slot('card').contains(act)) {
        switch (act.dataset.act) {
          case 'open-transcript': setDesktopTranscript(true); return;
          case 'close-transcript': setDesktopTranscript(false); root.querySelector('[data-act="open-transcript"]')?.focus({preventScroll:true}); return;
          case 'back5': if (audio) { audio.currentTime = Math.max(0, audio.currentTime - 5); } return;
          case 'follow':
            follow = !follow;
            writePref('cn.follow', follow ? '1' : '0');
            act.setAttribute('aria-pressed', String(follow));
            act.textContent = follow ? '따라가기 켬' : '따라가기 끔';
            if (follow && audio && !audio.paused && playingIdx >= 0) scrollToSeg(playingIdx);
            return;
          case 'copy': copyText(transcriptText(call)); return;
          case 'float': if (audio) { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); } return;
          case 'retry-transcription':
            if (retryPending) return;
            retryPending = true;
            renderProgress();
            api.post(`/api/calls/${encodeURIComponent(id)}/retry-transcription`).then(() => {
              if (!alive) return;
              toast('저장된 녹음으로 받아쓰기를 다시 요청했습니다.', 'ok');
              return load();
            }).catch((e) => {
              if (alive) toast(e?.message || '다시 요청하지 못했습니다.', 'error');
            }).finally(() => {
              retryPending = false;
              if (alive && call) renderProgress();
            });
            return;
          case 'retry': render(slot('head'), html`<p class="loading">불러오는 중…</p>`); load(); return;
          default: return;
        }
      }
      const rateBtn = t.closest('[data-rate]');
      if (rateBtn) { setRate(Number(rateBtn.dataset.rate)); return; }
      const jump = t.closest('[data-jump]');
      if (jump) {
        const name = jump.dataset.jump;
        if (name === 'trans' && root.dataset.mobilePane === 'card') rememberCardReturn();
        showMobilePane(name);
        if (name === 'card' && restoreCardReturn()) return;
        const sec = slot(name);
        if (sec.getBoundingClientRect().top < (topbar?.offsetHeight || 60)) {
          sec.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
        sec.focus({ preventScroll: true });
        return;
      }
      // 통화 글: 시각 단추나 문장을 누르면 그 대목부터
      const seek = t.closest('[data-seek]');
      const line = t.closest('.cd-seg');
      if (seek || line) {
        if (!seek && String(window.getSelection?.() || '').trim()) return; // 글을 고르는 중이면 재생하지 않는다
        if (!seek && t.closest('a, button')) return;
        const i = Number((seek || line).dataset.seek ?? line.dataset.i);
        const s = segments()[i];
        if (!s) return;
        markSeg(i);
        const at = num(s.start);
        if (audio && at !== null) { seekTo(at, true); playerNote(`${fmtSec(at)} 대목부터 들려 드립니다.`); }
      }
    }
    root.addEventListener('click', onClick);
    root.addEventListener('focusin', rememberCardInput);
    root.addEventListener('input', onTranscriptInput);
    root.addEventListener('keydown', onTranscriptKey);

    await load();
    if(alive && call) assistantCleanup=assistantPage.mount(slot('assistant'),{...ctx,embedded:true,query:{call:id},onEvidenceResult:onAssistantEvidence});
    if (history.open && !historyLoaded && !historyRequest) void loadHistory();

    return () => {
      alive = false;
      assistantCleanup?.();
      ctrl?.abort();
      historyRequest?.abort();
      cancelAnimationFrame(frame);
      clearTimeout(pollTimer);
      clearTimeout(quietTimer);
      cardCtl?.destroy();
      cardCtl = null;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        try { audio.load(); } catch { /* 무시 */ }
        audio = null;
      }
      io?.disconnect();
      ro?.disconnect();
      window.removeEventListener('scroll', scheduleConnector, true);
      window.removeEventListener('resize', measure);
      root.removeEventListener('toggle', measure, true);
      root.removeEventListener('input', scheduleConnector);
      history.removeEventListener('toggle', onHistoryToggle);
      historyForm.removeEventListener('submit', onHistorySearch);
      root.removeEventListener('click', onClick);
      root.removeEventListener('focusin', rememberCardInput);
      root.removeEventListener('input', onTranscriptInput);
      root.removeEventListener('keydown', onTranscriptKey);
    };
  },
};
