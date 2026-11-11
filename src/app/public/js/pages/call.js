// 통화 상세(F02 · F04 · F05 · F06 · F07 다시 정리 · F11): 머리 · 녹음 막대 · 받아쓴 글 · 주문 카드.
// 카드 칸을 누르면 그 말을 한 문장을 칠하고 그 시각부터 재생한다. 처리 중인 통화는 5초마다 다시 읽는다.
import { api } from '../api.js';
import { html, render, toast, copyText, fmtWhen, fmtSec, callChip, SOURCE_LABEL, highlight } from '../ui.js';
import { WORKING, num, segAtTime, resolveEvidence, buildMarks, transcriptText, groupUnsure, cloneItems } from './call-util.js';
import { mountCard } from './call-card.js';

const RATES = [1, 1.25, 1.5];
const POLL_MS = 5000;
const STEPS = [['queued', '받아쓰기 기다리는 중'], ['transcribing', '받아쓰는 중'], ['extracting', '카드 정리 중']];

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
    let cardCtl = null;
    let alive = true;
    let ctrl = null;
    let pollTimer = null;
    let quietTimer = null;
    let audio = null;
    let playingIdx = -1;
    let markIdx = -1;
    let follow = readPref('cn.follow', '1') === '1';
    let rate = Number(readPref('cn.rate', '1'));
    if (!RATES.includes(rate)) rate = 1;
    let playerVisible = true;
    const target = { seg: ctx.query.seg, at: ctx.query.t };
    let targetDone = ctx.query.seg === undefined && ctx.query.t === undefined;
    const wideMq = window.matchMedia('(min-width: 1100px)');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    render(el, html`<div class="page cd-page">
      <div class="cd-topnav no-print"><a class="btn btn-ghost cd-back" href="${backHref()}">‹ 통화 목록</a></div>
      <div data-slot="head"><p class="loading">불러오는 중…</p></div>
      <div class="cd-player-slot" data-slot="player"></div>
      <div data-slot="progress"></div>
      <nav class="cd-jump no-print hidden" data-slot="jump" aria-label="이 화면 안에서 이동">
        <button type="button" class="btn" data-jump="card">주문 카드 보기</button>
        <button type="button" class="btn" data-jump="trans">통화 글 보기</button>
      </nav>
      <div class="cd-body hidden" data-slot="body">
        <section class="card cd-card" id="cd-card" aria-labelledby="cd-card-h" data-slot="card"></section>
        <section class="card cd-trans" id="cd-trans" aria-labelledby="cd-trans-h" data-slot="trans"></section>
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

    // ── 머리 ──────────────────────────────────────────────────────
    function renderHead() {
      const card = curCard();
      const cust = card?.customer || call.customer;
      render(slot('head'), html`<header class="card cd-head">
        <p class="eyebrow">통화 상세</p>
        <h1 class="cd-title">${call.title || '제목 없는 통화'}</h1>
        <div class="cd-chips">
          ${callChip({ ...call, card })}
          ${card?.callType && card.callType !== '주문' ? html`<span class="chip cd-type-chip">${card.callType}</span>` : ''}
          ${card?.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}
          ${card?.callback ? html`<span class="chip chip-callback">다시 전화</span>` : ''}
          ${call.isFake ? html`<span class="chip chip-fake">가짜 통화</span>` : ''}
        </div>
        <dl class="cd-facts">
          <div><dt>거래처</dt><dd>${cust ? html`<a class="cd-cust" href="${custHref(cust)}">${cust}</a>` : html`<span class="muted">확인 필요</span>`}${card?.customerByPhone ? html` <span class="chip chip-phone" title="걸려 온 번호가 거래처 목록의 번호와 같아 그 이름으로 채웠습니다">번호로 확인</span>` : ''}</dd></div>
          <div><dt>걸려 온 번호</dt><dd>${call.callerNumber || '없음'}${call.callerNumber ? html` <span class="cd-dim">(가운데 가림)</span>` : ''}</dd></div>
          <div><dt>통화 시각</dt><dd>${fmtWhen(call.recordedAt)}${call.durationSec ? html` · 길이 ${fmtSec(call.durationSec)}` : ''}</dd></div>
          <div><dt>출처</dt><dd>${SOURCE_LABEL[call.source] || call.source || '알 수 없음'}${call.hasAudio ? '' : ' · 녹음 없음'}</dd></div>
        </dl>
        ${call.summary ? html`<p class="cd-summary">${call.summary}</p>` : ''}
      </header>`);
    }

    function renderFoot() {
      const cust = curCard()?.customer || call.customer;
      render(slot('foot'), html`${cust ? html`<a class="btn btn-lg" href="${custHref(cust)}">이 거래처 통화 모아 보기</a>` : ''}<a class="btn btn-ghost btn-lg" href="${backHref()}">통화 목록으로</a>`);
    }

    // ── 진행 상황(받아쓰기 · 정리 중) ──────────────────────────────
    function renderProgress() {
      const s = slot('progress');
      if (call.status === 'failed') {
        render(s, html`<div class="notice notice-error cd-failed" role="alert"><strong>이 통화는 처리하지 못했습니다.</strong> ${call.error || '이유를 알 수 없습니다.'}<br>같은 녹음을 다시 올리거나, 관리자에게 알려 주세요.</div>`);
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
          : `받아쓰기 일꾼 대기 중 — ${pos ? `줄 ${pos}번째` : `기다리는 통화 ${waiting}건`}. 일꾼(GPU PC)이 켜지면 차례로 받아씁니다. 그동안 미리 받아쓴 가짜 통화로 다른 기능을 써 보세요.`;
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
      if (call.source === 'seed') return '이 통화는 대본으로 만든 가짜 통화라 녹음이 없습니다. 받아쓴 글과 카드는 그대로 볼 수 있습니다.';
      if (call.source === 'live') return '실시간 받아쓰기 체험 통화는 녹음을 저장하지 않습니다. 받아쓴 글과 카드만 있습니다.';
      return '이 통화에는 녹음 파일이 없습니다.';
    }
    function renderPlayer() {
      const s = slot('player');
      if (audio) { audio.pause(); audio = null; }
      s.classList.toggle('has-audio', Boolean(call.hasAudio));
      if (!call.hasAudio) {
        render(s, html`<p class="notice cd-noaudio">${noAudioText()}</p>`);
        return;
      }
      render(s, html`<section class="card cd-player" aria-label="녹음 듣기">
        <audio class="cd-audio" controls preload="metadata" src="/api/calls/${encodeURIComponent(id)}/audio">이 브라우저는 녹음 재생을 지원하지 않습니다.</audio>
        <div class="cd-player-row">
          <button type="button" class="btn" data-act="back5" aria-label="5초 뒤로 감기">↺ 5초 뒤로</button>
          <div class="cd-rates" role="group" aria-label="재생 빠르기">
            ${RATES.map((r) => html`<button type="button" class="btn cd-rate" data-rate="${r}" aria-pressed="${r === rate}">${r}배</button>`)}
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
      return html`<li class="cd-seg ${flags ? 'is-unsure' : ''}" data-i="${i}" id="cd-seg-${i}">
        ${st !== null ? html`<button type="button" class="cd-time" data-seek="${i}" aria-label="${fmtSec(st)}${what}">${fmtSec(st)}</button>` : html`<span class="cd-time cd-time-none" aria-hidden="true">·</span>`}
        <div class="cd-seg-body">
          ${s?.speaker ? html`<span class="cd-spk">${s.speaker}</span>` : ''}<span class="cd-text">${highlight(s?.text ?? '', marks)}</span>
          ${flags ? html`<span class="cd-seg-flag"><button type="button" class="listen-flag" data-seek="${i}">⚠ 들어 보기</button> ${flags.join(' · ')}</span>` : ''}
        </div>
      </li>`;
    }
    function renderTranscript() {
      const segs = segments();
      const card = curCard();
      const marks = buildMarks(card);
      const fixes = Array.isArray(card?.fixes) ? card.fixes.filter((f) => f && f.heard) : [];
      const flags = unsureBySeg();
      const hasText = segs.length || call.transcript;
      render(slot('trans'), html`
        <div class="cd-trans-top">
          <h2 id="cd-trans-h">통화 글</h2>
          <div class="cd-trans-tools">
            ${call.hasAudio && segs.length ? html`<button type="button" class="btn cd-follow" data-act="follow" aria-pressed="${follow}">${follow ? '따라가기 켬' : '따라가기 끔'}</button>` : ''}
            <button type="button" class="btn" data-act="copy" ${hasText ? '' : html`disabled`}>통화 글 복사</button>
          </div>
        </div>
        ${hasText ? html`<div class="legend cd-legend" role="note" aria-label="색 설명">
          <span>색 설명:</span><mark class="hl hl-part">부품</mark><mark class="hl hl-car">차종 · 차번호</mark><mark class="hl hl-customer">거래처</mark><mark class="hl hl-urgent">급함</mark>${fixes.length ? html`<mark class="hl hl-fix">고쳐 읽은 말</mark>` : ''}
        </div>` : ''}
        ${fixes.length ? html`<p class="cd-fixes">받아쓰기를 고쳐 읽은 말: ${fixes.map((f) => html`<span class="cd-fix">${f.heard} → ${f.fixed || '?'}</span>`)}</p>` : ''}
        ${call.hasAudio && segs.length ? html`<p class="cd-trans-help">시각이나 문장을 누르면 그 대목부터 들립니다.</p>` : ''}
        ${segs.length
    ? html`<ol class="cd-segs">${segs.map((s, i) => segRow(s, i, marks, flags.get(i)))}</ol>`
    : call.transcript
      ? html`<p class="cd-plain">${highlight(call.transcript, marks)}</p>`
      : html`<p class="cd-empty">${WORKING.includes(call.status) ? '받아쓰는 중입니다. 다 되면 여기에 글이 나옵니다.' : '받아쓴 글이 없습니다.'}</p>`}
      `);
      if (playingIdx >= 0) lineEl(playingIdx)?.classList.add('is-playing');
      if (markIdx >= 0) lineEl(markIdx)?.classList.add('is-mark');
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
    }
    function panelScrolls() {
      const p = slot('trans');
      return wideMq.matches && p.scrollHeight > p.clientHeight + 4 && getComputedStyle(p).overflowY !== 'visible';
    }
    /** 문장을 보이게 한다. force 가 아니면 이미 보일 때는 움직이지 않는다 */
    function scrollToSeg(i, force = false) {
      const line = lineEl(i);
      if (!line) return;
      const behavior = reduceMotion ? 'auto' : 'smooth';
      if (panelScrolls()) {
        const p = slot('trans');
        const pr = p.getBoundingClientRect();
        const lr = line.getBoundingClientRect();
        const topCover = p.querySelector('.cd-trans-top')?.offsetHeight || 0;
        const visible = lr.top >= pr.top + topCover && lr.bottom <= pr.bottom;
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
    function onEvidence(r, { play, scroll }) {
      if (!r) { markSeg(-1); return; }
      if (r.segIndex >= 0) {
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
      if (r && r.segIndex >= 0) { markSeg(r.segIndex); scrollToSeg(r.segIndex, true); return; }
      slot('trans').scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    // ── 떠 있는 재생 단추(녹음 막대가 화면 밖일 때) ─────────────────
    function updateFloat() {
      const show = Boolean(audio) && !playerVisible && (!audio.paused || audio.currentTime > 0);
      floatBtn.classList.toggle('hidden', !show);
      if (show) floatBtn.textContent = audio.paused ? `▶ 계속 듣기 ${fmtSec(audio.currentTime)}` : `❚❚ 멈춤 ${fmtSec(audio.currentTime)}`;
    }
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => { playerVisible = entries.some((e) => e.isIntersecting); updateFloat(); })
      : null;
    io?.observe(slot('player'));

    // 넓은 화면에서 녹음 막대 · 글 상자를 붙여 둘 높이
    const topbar = document.querySelector('.topbar');
    const measure = () => {
      root.style.setProperty('--cd-top', `${topbar?.offsetHeight || 60}px`);
      root.style.setProperty('--cd-player-h', `${slot('player').classList.contains('has-audio') ? slot('player').offsetHeight : 0}px`);
    };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;
    if (ro) { if (topbar) ro.observe(topbar); ro.observe(slot('player')); }

    // ── 찾기에서 온 대목(?t=&seg=) ─────────────────────────────────
    function applyTarget() {
      if (targetDone || !segments().length) return;
      targetDone = true;
      const r = resolveEvidence(segments(), target);
      if (!r) return;
      if (r.segIndex >= 0) {
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
      document.title = `${c.title || '통화 상세'} · 콜노트(가칭)`;
      renderHead();
      if (!prev || Boolean(prev.hasAudio) !== Boolean(c.hasAudio)) renderPlayer();
      renderProgress();
      slot('body').classList.remove('hidden');
      const working = WORKING.includes(c.status);
      if (working) {
        cardCtl?.destroy();
        cardCtl = null;
        render(slot('card'), html`<div class="cd-card-head"><h2 id="cd-card-h">주문 카드</h2></div>
          <p class="cd-empty">받아쓰기와 정리가 끝나면 카드가 여기에 나옵니다.</p>`);
      } else if (!cardCtl) {
        mountCardCtl();
        if (prev && WORKING.includes(prev.status)) toast(c.status === 'failed' ? '이 통화는 처리하지 못했습니다.' : '받아쓰기와 카드 정리가 끝났습니다.', c.status === 'failed' ? 'error' : 'ok');
      }
      slot('jump').classList.toggle('hidden', working);
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
            <p class="notice ${gone ? '' : 'notice-error'}" role="alert">${gone ? '이 통화를 찾지 못했습니다. 지워졌거나 데모를 초기화했을 수 있습니다.' : e?.message || '통화를 불러오지 못했습니다.'}</p>
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
          document.title = `${c.title || '통화 상세'} · 콜노트(가칭)`;
          renderHead();
          renderFoot();
        } catch { /* 다음에 다시 읽으면 된다 */ }
      }, 900);
    }

    // ── 이벤트 ──────────────────────────────────────────────────────
    function onClick(e) {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const act = t.closest('[data-act]');
      if (act && !slot('card').contains(act)) {
        switch (act.dataset.act) {
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
          case 'retry': render(slot('head'), html`<p class="loading">불러오는 중…</p>`); load(); return;
          default: return;
        }
      }
      const rateBtn = t.closest('[data-rate]');
      if (rateBtn) { setRate(Number(rateBtn.dataset.rate)); return; }
      const jump = t.closest('[data-jump]');
      if (jump) {
        const sec = slot(jump.dataset.jump === 'card' ? 'card' : 'trans');
        sec.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
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

    await load();

    return () => {
      alive = false;
      ctrl?.abort();
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
      root.removeEventListener('click', onClick);
    };
  },
};
