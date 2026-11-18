// F03 실시간 받아쓰기 체험 — 브라우저 음성 인식(Web Speech) → 통화 글 → 말이 멈추면 AI 주문 카드 미리보기 → 저장.
import { api } from '../api.js';
import { html, render, fmtSec, toast, confirmBox, href, highlight } from '../ui.js';

import { LIVE_SAMPLE as SAMPLE, LIVE_EXAMPLES as EXAMPLES } from '../live-samples.js';
import { buildMarks, resolveEvidence } from './call-util.js';

const IDLE_MS = 2500;     // 말이 멈추고 이만큼 새 확정 글이 없으면 카드 정리
const MIN_GAP_MS = 4000;  // 카드 정리는 4초에 한 번까지
const LINE_GAP_MS = 900;  // 샘플 대화 줄 사이
const MAX_TEXT = 4000;    // 카드 정리에 보내는 글 길이(뒤쪽 기준 · 서버 상한 4,000자)
const MAX_SAVE = 19_000;  // 저장할 글 전체 길이(서버 상한 20,000자)
const MAX_LINES = 400;

const SR_ERRORS = {
  'not-allowed': '마이크 사용이 막혀 있습니다. 주소창 왼쪽 자물쇠(또는 사이트 설정) → 마이크 → 「허용」으로 바꾼 뒤 다시 눌러 주세요.',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없게 막혀 있습니다. 크롬이나 엣지에서 열어 보세요.',
  'audio-capture': '마이크를 찾지 못했습니다. 마이크가 연결돼 있는지, 다른 프로그램이 쓰고 있지 않은지 확인해 주세요.',
  network: '인터넷 연결 문제로 받아쓰기가 끊겼습니다. 연결을 확인하고 다시 눌러 주세요.',
  'language-not-supported': '이 브라우저는 한국어 받아쓰기를 지원하지 않습니다. 「샘플 대화 재생」으로 체험해 보세요.',
  'no-speech': '말소리가 들리지 않았습니다. 마이크 가까이에서 또박또박 말해 주세요.',
};
const AI_ERRORS = {
  no_key: '자동 정리를 사용할 수 없습니다',
  ai_off: '자동 정리를 사용할 수 없습니다',
  refused: 'AI 가 답하지 않았습니다',
  bad_output: 'AI 답을 읽지 못했습니다',
  api_error: 'AI 서버에 문제가 생겼습니다',
  rate_limited: '잠시 뒤에 다시 정리합니다',
};
const AI_OFF_TEXT = '지금은 자동 정리를 사용할 수 없습니다. 통화를 저장한 뒤 주문 카드를 직접 작성할 수 있습니다.';

const FIELDS = [
  { key: 'customer', label: '거래처' },
  { key: 'carModel', label: '차종' },
  { key: 'modelYear', label: '연식' },
  { key: 'plate', label: '차량 번호' },
  { key: 'items', label: '부품 × 수량' },
  { key: 'urgent', label: '급함' },
  { key: 'due', label: '요청 일정' },
  { key: 'askBack', label: '다시 물어볼 것' },
];
// 「확인 필요」 칸 이름(서버가 camelCase · snake_case 둘 다 쓴다)
const FIELD_LABEL = {
  ...Object.fromEntries(FIELDS.map((f) => [f.key, f.label])),
  contact: '담당자', car_model: '차종', model_year: '연식', items: '부품', partNo: '품번', part_no: '품번',
  qty: '수량', delivery: '받는 방법', other: '그 밖',
};

const MIC_SVG = html`<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>`;
const STOP_SVG = html`<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`;

const str = (v) => (v == null ? '' : String(v).trim());
const items = (card) => (Array.isArray(card?.items) ? card.items.filter((i) => i && (i.part || i.qty != null)) : []);
const asks = (card) => (Array.isArray(card?.askBack) ? card.askBack.map(str).filter(Boolean) : []);

/** 칸 값을 비교용 글로(새로 채워진 칸 반짝이기) */
function fieldKey(card, key) {
  if (!card) return '';
  if (key === 'items') return items(card).map((i) => [i.part, i.side, i.qty, i.partNo].map(str).join('/')).join('|');
  if (key === 'urgent') return card.urgent ? '1' : '';
  if (key === 'due') return [str(card.due), str(card.delivery)].filter(Boolean).join(' · ');
  if (key === 'askBack') return asks(card).join('|');
  return str(card[key]);
}

/** 칸 값 그리기. 비었으면 null */
function fieldView(card, key) {
  if (!card || !fieldKey(card, key)) return null;
  if (key === 'customer') {
    return html`${card.customer}${card.customerByPhone ? html` <span class="chip chip-phone">번호로 확인</span>` : ''}`;
  }
  if (key === 'items') {
    return html`<ul class="live-items">${items(card).map((i) => html`<li><strong>${i.part || '부품 이름 확인'}</strong>${i.side ? html` <span class="muted">(${i.side})</span>` : ''} <span class="live-qty">× ${i.qty ?? '?'}</span>${i.partNo ? html` <span class="muted small">품번 ${i.partNo}</span>` : ''}</li>`)}</ul>`;
  }
  if (key === 'urgent') return html`<span class="chip chip-urgent">급함</span>`;
  if (key === 'due') return html`${fieldKey(card, 'due')}`;
  if (key === 'askBack') return html`<ul class="live-asks">${asks(card).map((a) => html`<li>${a}</li>`)}</ul>`;
  return html`${card[key]}`;
}

/** 서버의 aiError 는 한국어 설명 글(예: 'AI 키 없음')이거나 {code, message} */
function aiErrorText(aiError) {
  const code = typeof aiError === 'string' ? aiError : aiError?.code;
  const msg = typeof aiError === 'string' ? aiError : aiError?.message;
  if (code === 'no_key' || code === 'ai_off' || /키\s*없음/.test(String(msg || ''))) return AI_OFF_TEXT;
  return `카드를 정리하지 못했습니다: ${AI_ERRORS[code] || msg || '알 수 없는 문제'}`;
}

export default {
  title: '실시간 받아쓰기',
  async mount(el, ctx) {
    const meta = ctx.meta || {};
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const secure = window.isSecureContext !== false;
    const supported = Boolean(SR) && secure;
    const aiOff = meta.aiEnabled === false;
    const isFixture = meta.aiProvider === 'fixture';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const readyText = supported ? '샘플 대화를 재생하거나 마이크로 주문을 받아쓰세요.' : '샘플 대화를 재생해 주문 접수를 체험하세요.';

    const st = {
      mode: 'idle',          // idle | listening | sample
      sampleStarted: false,
      paused: false,
      source: -1,
      lines: [],             // 확정된 문장 [{who?, text, start, end}]
      interim: '',           // 듣는 중인 글(흐리게)
      interimStart: null,
      typing: null,          // 타자 치는 중인 줄 {who, text, start}
      card: null,
      cardNote: aiOff ? AI_OFF_TEXT : null,
      prevKeys: {},
      flash: new Set(),
      saving: false,
      saved: null,           // {callId}
    };
    let disposed = false;
    let playToken = 0;
    let wakeSample = null;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const cancel = (t) => { if (t) { clearTimeout(t); timers.delete(t); } };
    const sleep = (ms) => new Promise((resolve) => later(resolve, ms));

    render(el, html`<div class="page live-page">
      <div class="page-head">
        <div>
          <h1>새 통화 기록</h1>
          <p class="sub">대화를 받아쓰고 주문에 필요한 정보를 확인하세요.</p>
        </div>
        <a class="btn" href="#/upload">녹음 올리기</a>
      </div>
      <section class="card live-session" aria-label="기록 설정">
        <div class="live-controls">
          <div class="live-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <div class="live-control-text">
            <p class="live-state" data-ref="state" role="status">${readyText}</p>
            <p class="help live-mode-note">${supported ? '음성 인식은 브라우저 제공자의 서버를 이용합니다. 고객 정보가 담긴 대화는 사용하지 마세요.' : '이 환경에서는 샘플 대화와 예시 문장을 사용할 수 있습니다.'}</p>
          </div>
          <div class="live-session-actions">
            <button type="button" class="btn btn-primary" data-act="sample">샘플 대화 재생</button>
            <button type="button" class="btn hidden" data-act="pause" aria-pressed="false">일시 정지</button>
            ${supported ? html`<button type="button" class="btn live-mic" data-act="mic" aria-pressed="false"><span class="live-mic-icon">${MIC_SVG}</span><span class="live-mic-label">마이크 켜기</span></button>` : ''}
          </div>
        </div>
      </section>
      <div class="live-grid">
        <section class="card live-talk" aria-labelledby="liveTalkTitle">
          <header class="live-panel-head">
            <h2 id="liveTalkTitle">대화 기록</h2>
            <span class="chip chip-working" data-ref="lineCount">0줄</span>
          </header>
          <div class="live-progress hidden" data-ref="progressBox">
            <progress data-ref="progress" max="${SAMPLE.length}" value="0" aria-label="샘플 대화 진행률"></progress>
            <span data-ref="progressText"></span>
          </div>
          <div class="live-lines" data-ref="lines" tabindex="0" aria-label="받아쓴 대화">
            <div data-ref="settled"></div>
            <div data-ref="draft" aria-hidden="true"></div>
          </div>
          <div class="live-actions">
            <button type="button" class="btn" data-act="reset">기록 지우기</button>
            <button type="button" class="btn btn-primary" data-act="save">끝내고 저장</button>
          </div>
          <div data-ref="saved" aria-live="polite"></div>
          <details class="live-examples">
            <summary>예시 문장으로 체험</summary>
            <div class="live-chips">${EXAMPLES.map((t) => html`<button type="button" class="live-chip" data-act="example" data-text="${t}">${t}</button>`)}</div>
          </details>
        </section>
        <section class="card live-card" aria-labelledby="liveCardTitle">
          <header class="live-panel-head"><h2 id="liveCardTitle">AI 주문 카드</h2><span class="chip chip-ai">${isFixture ? '예시 초안' : '미리보기'}</span></header>
          ${isFixture ? html`<p class="live-fixture-note">샘플 대화에 맞춰 준비된 예시 초안입니다.</p>` : ''}
          <div class="live-card-state" data-ref="cardState" role="status"></div>
          <div data-ref="card"></div>
          <p class="help">저장 후 주문 카드에서 품번을 입력하고 내용을 확인할 수 있습니다.</p>
        </section>
      </div>
    </div>`);

    const root = el.querySelector('.live-page');
    const ref = (name) => root.querySelector(`[data-ref="${name}"]`);
    const linesEl = ref('lines');
    const micBtn = root.querySelector('[data-act="mic"]');
    const sampleBtn = root.querySelector('[data-act="sample"]');
    const pauseBtn = root.querySelector('[data-act="pause"]');
    const saveBtn = root.querySelector('[data-act="save"]');
    const resetBtn = root.querySelector('[data-act="reset"]');

    // ── 그리기 ──
    function setState(msg, kind = '') {
      const s = ref('state');
      s.textContent = msg;
      s.className = `live-state${kind ? ' is-' + kind : ''}`;
    }
    function setCardState(content, kind = '') {
      const s = ref('cardState');
      render(s, content ? html`<div class="notice${kind ? ' notice-' + kind : ''}">${content}</div>` : html``);
    }
    let paintedTail = null;
    let paintedCard = null;
    let paintedLines = null;
    function renderLines() {
      const nearBottom = linesEl.scrollHeight - linesEl.scrollTop - linesEl.clientHeight < 60;
      const tail = st.lines.at(-1);
      const repaint = paintedTail !== tail || paintedCard !== st.card || paintedLines !== st.lines;
      const marks = repaint ? buildMarks(st.card) : [];
      const line = (l, index, extra = '') => html`<article class="live-line ${l.who === '대리점' ? 'is-shop' : ''} ${index >= 0 && index === st.source ? 'is-source' : ''} ${extra}" ${index >= 0 ? html`data-line="${index}" tabindex="-1"` : ''}>
        <header class="live-line-meta">${l.who ? html`<span class="live-who">${l.who}</span>` : ''}<span class="live-time">${l.start == null ? '…' : fmtSec(l.start)}</span></header>
        <p class="live-text">${index >= 0 ? highlight(l.text, marks) : l.text}${extra === 'is-typing' ? html`<span class="live-caret" aria-hidden="true"></span>` : ''}</p>
      </article>`;
      if (repaint) {
        render(ref('settled'), html`${st.lines.map((l, i) => line(l, i))}`);
        paintedTail = tail;
        paintedCard = st.card;
        paintedLines = st.lines;
      }
      const draft = st.typing ? line(st.typing, -1, 'is-typing') : st.interim ? line({ text: st.interim, start: st.interimStart }, -1, 'is-interim') : '';
      render(ref('draft'), draft);
      linesEl.classList.toggle('has-lines', Boolean(draft || st.lines.length));
      if (!draft && !st.lines.length) render(ref('settled'), html`<p class="live-empty">기록을 시작하면 여기에 대화가 나타납니다.</p>`);
      if (nearBottom) linesEl.scrollTop = linesEl.scrollHeight;
      ref('lineCount').textContent = `${st.lines.length}줄`;
      ref('progressBox').classList.toggle('hidden', !st.sampleStarted);
      ref('progress').value = st.lines.length;
      ref('progressText').textContent = `${st.lines.length} / ${SAMPLE.length}줄`;
    }
    function evidenceFor(card, key) {
      const evidence = key === 'items' ? items(card).findLast((item) => item.quote) : card?.evidence?.[key];
      if (!evidence?.quote) return null;
      const source = resolveEvidence(st.lines, { quote: evidence.quote });
      return source?.segIndex >= 0 ? source : null;
    }
    function renderCard() {
      const card = st.card;
      const rows = FIELDS.map((f) => {
        const v = fieldView(card, f.key);
        const source = v && evidenceFor(card, f.key);
        return html`<div class="live-field ${v ? 'is-filled' : ''} ${st.flash.has(f.key) ? 'is-flash' : ''}">
          <dt>${f.label}</dt><dd>${v || html`<span class="live-blank" aria-label="기록 없음">—</span>`}
            ${source ? html`<button type="button" class="btn btn-ghost btn-sm live-source" data-act="source" data-line-index="${source.segIndex}" aria-label="${f.label} 근거 ${fmtSec(source.at)} 보기">근거 ${fmtSec(source.at)} <span aria-hidden="true">↗</span></button>` : ''}
          </dd></div>`;
      });
      const unsure = Array.isArray(card?.unsure) ? card.unsure.filter((u) => u && (u.reason || u.field)) : [];
      render(ref('card'), html`
        ${st.cardNote ? html`<div class="notice notice-warn">${st.cardNote}</div>` : ''}
        <dl class="live-fields">${rows}</dl>
        ${unsure.length ? html`<ul class="live-unsure">${unsure.map((u) => html`<li><span class="listen-flag">확인 필요</span> ${FIELD_LABEL[u.field] || '확인할 곳'}${u.reason ? ` — ${u.reason}` : ''}</li>`)}</ul>` : ''}`);
      st.flash.clear();
      renderLines();
    }
    function renderSaved(content) {
      const box = ref('saved');
      if (content !== undefined) { render(box, content); return; }
      if (!st.saved) { render(box, html``); return; }
      const link = st.saved.callId ? href('/calls/' + encodeURIComponent(st.saved.callId)) : '#/calls';
      render(box, html`<div class="notice notice-ok live-saved"><p><strong>저장했습니다.</strong> 통화 기록에 「실시간 체험」으로 들어갔습니다.</p><a class="btn btn-primary btn-block" data-ref="goCall" href="${link}">통화 화면으로 바로 가기</a></div>`);
      box.querySelector('[data-ref="goCall"]')?.focus();
    }
    function updateButtons() {
      const listening = st.mode === 'listening';
      const sample = st.mode === 'sample';
      root.classList.toggle('is-listening', listening);
      root.classList.toggle('is-playing', sample && !st.paused);
      if (micBtn) {
        micBtn.setAttribute('aria-pressed', String(listening));
        micBtn.disabled = sample || st.saving;
        render(micBtn, html`<span class="live-mic-icon">${listening ? STOP_SVG : MIC_SVG}</span><span class="live-mic-label">${listening ? '마이크 끄기' : '마이크 켜기'}</span>`);
      }
      sampleBtn.disabled = listening || st.saving;
      sampleBtn.textContent = sample ? '기록 종료' : '샘플 대화 재생';
      pauseBtn.classList.toggle('hidden', !sample);
      pauseBtn.setAttribute('aria-pressed', String(st.paused));
      pauseBtn.textContent = st.paused ? '재개' : '일시 정지';
      saveBtn.disabled = st.saving || Boolean(st.typing) || sample || Boolean(st.saved) || !st.lines.length;
      resetBtn.disabled = st.saving;
      root.querySelectorAll('[data-act="example"]').forEach((b) => { b.disabled = sample || Boolean(st.typing) || st.saving; });
    }
    function setMode(mode) { st.mode = mode; updateButtons(); }

    // ── 카드 정리(말이 멈추면) ──
    let idleTimer = null;
    let gapTimer = null;
    let inflight = false;
    let again = false;
    let lastText = '';
    let lastAt = 0;
    let extractCtrl = null;
    const fullText = () => st.lines.map((l) => l.text).join('\n');

    function bumpIdle() {
      cancel(idleTimer);
      idleTimer = later(maybeExtract, IDLE_MS);
    }
    function maybeExtract() {
      if (disposed || aiOff || st.saving || st.saved) return;
      const text = fullText();
      if (!text.trim() || text === lastText) return;
      if (inflight) { again = true; return; }
      const wait = lastAt + MIN_GAP_MS - Date.now();
      if (wait > 0) { cancel(gapTimer); gapTimer = later(maybeExtract, wait); return; }
      runExtract(text);
    }
    async function runExtract(text) {
      inflight = true;
      lastText = text;
      lastAt = Date.now();
      extractCtrl = new AbortController();
      setCardState(html`<span class="spinner" aria-hidden="true"></span> 카드 정리 중…`);
      try {
        const out = await api.post('/api/live/extract', { text: text.slice(-MAX_TEXT) }, { signal: extractCtrl.signal });
        if (disposed) return;
        if (out?.card) {
          st.cardNote = out.aiError ? aiErrorText(out.aiError) : null;
          applyCard(out.card);
          setCardState('');
        } else {
          st.cardNote = aiErrorText(out?.aiError || 'api_error');
          renderCard();
          setCardState('');
        }
      } catch (err) {
        if (disposed || err?.name === 'AbortError') return;
        if (err?.code === 'ai_off' || err?.code === 'no_key' || err?.code === 'disabled') {
          st.cardNote = AI_OFF_TEXT;
          renderCard();
          setCardState('');
        } else {
          setCardState(err?.message || '카드를 정리하지 못했습니다.', err?.status === 429 ? 'warn' : 'error');
        }
      } finally {
        inflight = false;
        extractCtrl = null;
        if (!disposed && again) { again = false; maybeExtract(); }
      }
    }
    function applyCard(card) {
      const keys = {};
      for (const f of FIELDS) keys[f.key] = fieldKey(card, f.key);
      st.flash = new Set(FIELDS.filter((f) => keys[f.key] && keys[f.key] !== st.prevKeys[f.key]).map((f) => f.key));
      st.prevKeys = keys;
      st.card = card;
      renderCard();
    }

    // ── 음성 인식 ──
    let rec = null;
    let want = false;
    let restartTimer = null;
    let restarts = [];
    let activeMs = 0;
    let listenFrom = null;
    let endWaiters = [];
    const clock = () => (activeMs + (listenFrom != null ? performance.now() - listenFrom : 0)) / 1000;
    const lastEnd = () => (st.lines.length ? st.lines[st.lines.length - 1].end : 0);
    let fullWarned = false;
    const pushLine = (line) => {
      if (st.lines.length >= MAX_LINES || fullText().length + line.text.length + 1 > MAX_SAVE) {
        if (!fullWarned) { fullWarned = true; toast('글이 너무 길어 더는 받아쓰지 않습니다. 「끝내고 저장」을 누르거나 지우고 다시 해 주세요.', 'error'); }
        return;
      }
      const start = Math.max(lastEnd(), Number(line.start) || 0);
      st.lines.push({ ...line, start, end: Math.max(start, Number(line.end) || start) });
    };

    function openRec() {
      let r;
      try { r = new SR(); } catch {
        want = false;
        setMode('idle');
        setState('이 브라우저에서 음성 인식을 시작하지 못했습니다. 「샘플 대화 재생」으로 체험해 보세요.', 'error');
        return;
      }
      r.lang = 'ko-KR';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      const seenFinal = new Set();
      const utterStart = new Map();
      r.onstart = () => {
        if (disposed || rec !== r) return;
        if (listenFrom == null) listenFrom = performance.now();
        setState('듣는 중… 말을 멈추면 카드가 채워집니다.', 'live');
      };
      r.onresult = (e) => {
        if (disposed || rec !== r) return;
        let interim = '';
        let interimStart = null;
        let gotFinal = false;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (!utterStart.has(i)) utterStart.set(i, Math.max(0, clock() - 0.3));
          const t = res[0]?.transcript || '';
          if (res.isFinal) {
            if (seenFinal.has(i)) continue;
            seenFinal.add(i);
            const text = t.trim();
            if (text) { pushLine({ text, start: utterStart.get(i), end: clock() }); gotFinal = true; }
          } else if (t.trim()) {
            if (interimStart == null) interimStart = utterStart.get(i);
            interim += t;
          }
        }
        st.interim = interim.trim();
        st.interimStart = interimStart;
        renderLines();
        if (gotFinal) updateButtons();
        bumpIdle();
      };
      r.onerror = (e) => {
        if (disposed || rec !== r) return;
        const code = e.error;
        if (code === 'aborted') return;
        if (code === 'no-speech') { toast(SR_ERRORS['no-speech']); return; } // 계속 듣는다(끝나면 다시 시작)
        want = false;
        setState(SR_ERRORS[code] || `받아쓰기가 멈췄습니다(${code || '알 수 없음'}). 다시 눌러 주세요.`, 'error');
      };
      r.onend = () => {
        if (listenFrom != null) { activeMs += performance.now() - listenFrom; listenFrom = null; }
        if (rec !== r) return;
        rec = null;
        if (st.interim) { pushLine({ text: st.interim, start: st.interimStart ?? lastEnd(), end: clock() }); st.interim = ''; st.interimStart = null; }
        if (disposed) return;
        if (want) {
          const now = Date.now();
          restarts = restarts.filter((t) => now - t < 10_000);
          restarts.push(now);
          if (restarts.length <= 5) { restartTimer = later(() => { if (want && !disposed) openRec(); }, 300); return; }
          want = false;
          setState('받아쓰기가 자꾸 끊깁니다. 잠시 뒤 다시 눌러 주세요.', 'error');
        } else if (!ref('state').classList.contains('is-error')) {
          setState(st.lines.length ? '멈췄습니다. 카드를 확인하고 「끝내고 저장」을 눌러 보세요.' : '마이크 단추를 누르고 주문을 말해 보세요.');
        }
        setMode('idle');
        renderLines();
        endWaiters.splice(0).forEach((f) => f());
        maybeExtract();
      };
      rec = r;
      try { r.start(); } catch { /* 이미 시작됨 */ }
    }
    function startListening() {
      if (!supported || st.mode !== 'idle' || st.saving) return;
      if (st.saved) resetAll();
      st.sampleStarted = false;
      renderLines();
      want = true;
      restarts = [];
      setMode('listening');
      setState('마이크를 켜는 중… 허용을 묻는 창이 뜨면 「허용」을 눌러 주세요.');
      openRec();
    }
    function stopListening() {
      want = false;
      cancel(restartTimer);
      if (rec) {
        setState('멈추는 중…');
        try { rec.stop(); } catch { /* 이미 멈춤 */ }
      } else {
        setMode('idle');
        endWaiters.splice(0).forEach((f) => f());
      }
    }
    const waitEnd = (ms) => new Promise((resolve) => { endWaiters.push(resolve); later(resolve, ms); });

    // ── 샘플 대화 · 예시 문장(타자 치듯) ──
    function releaseSample() {
      const wake = wakeSample;
      wakeSample = null;
      wake?.();
    }
    function togglePause() {
      st.paused = !st.paused;
      setState(st.paused ? '기록을 잠시 멈췄습니다.' : '샘플 대화를 기록하는 중…', st.paused ? '' : 'live');
      updateButtons();
      if (!st.paused) releaseSample();
    }
    function typeLine(who, text, start, token) {
      if (reduceMotion) return Promise.resolve(!disposed && token === playToken);
      return new Promise((resolve) => {
        st.typing = { who, text: '', start };
        updateButtons();
        const chars = Array.from(text);
        const step = Math.max(18, Math.min(45, Math.round(700 / chars.length)));
        let i = 0;
        const tick = () => {
          if (disposed || token !== playToken) { resolve(false); return; }
          if (st.paused) { wakeSample = tick; return; }
          i += 1;
          st.typing.text = chars.slice(0, i).join('');
          renderLines();
          if (i < chars.length) later(tick, step);
          else { st.typing = null; updateButtons(); resolve(true); }
        };
        tick();
      });
    }
    async function playSample() {
      if (st.mode === 'sample') { // 재생 멈추기
        playToken += 1;
        st.typing = null;
        st.paused = false;
        releaseSample();
        setMode('idle');
        renderLines();
        setState('기록을 종료했습니다. 지금까지의 대화를 저장할 수 있습니다.');
        maybeExtract();
        return;
      }
      if (st.mode !== 'idle' || st.saving) return;
      if ((st.lines.length || st.interim) && !st.saved) {
        if (!(await confirmBox('지금 글과 카드를 지우고 샘플 대화를 재생할까요?'))) return;
        if (disposed) return;
      }
      resetAll();
      const token = playToken;
      st.sampleStarted = true;
      setMode('sample');
      renderLines();
      setState('샘플 대화를 기록하는 중…', 'live');
      let t = 0.4;
      for (const line of SAMPLE) {
        const done = await typeLine(line.who, line.text, t, token);
        if (!done || disposed || token !== playToken) return;
        const end = t + Math.max(1.2, Array.from(line.text).length / 6); // 말하는 빠르기 대략 초당 6자
        pushLine({ who: line.who, text: line.text, start: t, end });
        t = end + 0.6;
        renderLines();
        updateButtons();
        bumpIdle();
        if (line.check) maybeExtract();
        await sleep(LINE_GAP_MS);
        if (disposed || token !== playToken) return;
        if (st.paused) await new Promise((resolve) => { wakeSample = resolve; });
        if (disposed || token !== playToken) return;
      }
      setMode('idle');
      setState('샘플 대화가 끝났습니다. 카드를 확인하고 「끝내고 저장」을 눌러 보세요.');
      maybeExtract();
    }
    async function addExample(text) {
      if (st.mode === 'sample' || st.typing || st.saving) return;
      if (st.mode === 'listening') { toast('이 문장을 소리 내어 말해 보세요.'); return; }
      if (st.saved) resetAll();
      st.sampleStarted = false;
      const token = playToken;
      const start = st.lines.length ? lastEnd() + 0.6 : 0.4;
      setState('예시 문장을 입력하는 중입니다. 문장이 완성되면 저장할 수 있어요.');
      const done = await typeLine('정비소', text, start, token);
      if (!done || disposed || token !== playToken) return;
      pushLine({ who: '정비소', text, start, end: start + Math.max(1.2, Array.from(text).length / 6) });
      renderLines();
      updateButtons();
      setState('말을 멈추면 카드가 채워집니다.');
      bumpIdle();
    }

    // ── 저장 · 지우기 ──
    let saveCtrl = null;
    async function save() {
      if (st.saving || st.saved || st.typing || st.mode === 'sample') return;
      st.saving = true; // 저장하는 동안에는 미리보기 정리를 부르지 않는다(서버가 카드를 만든다)
      cancel(idleTimer);
      cancel(gapTimer);
      updateButtons();
      if (st.mode === 'listening') { stopListening(); await waitEnd(2000); if (disposed) return; }
      const text = fullText();
      if (!text.trim()) {
        st.saving = false;
        updateButtons();
        toast('저장할 글이 없습니다. 먼저 말하거나 샘플 대화를 재생해 주세요.', 'error');
        return;
      }
      const segments = st.lines.map((l) => ({
        start: Math.round(l.start * 10) / 10,
        end: Math.round(l.end * 10) / 10,
        text: l.text,
        ...(l.who ? { speaker: l.who } : {}),
      }));
      const durationSec = Math.round(Math.max(clock(), lastEnd() + 0.5) * 10) / 10;
      renderSaved(html`<div class="notice"><span class="spinner" aria-hidden="true"></span> 저장하고 주문 카드를 정리하는 중… 몇 초 걸립니다.</div>`);
      saveCtrl = new AbortController();
      try {
        const out = await api.post('/api/live/save', { text, segments, durationSec }, { signal: saveCtrl.signal });
        if (disposed) return;
        st.saved = { callId: out?.callId || out?.call?.id || null };
        renderSaved();
        setState('저장했습니다. 새로 하려면 「지우고 다시」를 누르세요.');
        ctx.refreshMeta?.();
      } catch (err) {
        if (disposed || err?.name === 'AbortError') return;
        renderSaved(html`<div class="notice notice-error" role="alert">${err?.message || '저장하지 못했습니다. 잠시 뒤 다시 해 주세요.'}</div>`);
      } finally {
        st.saving = false;
        saveCtrl = null;
        if (!disposed) updateButtons();
      }
    }
    function resetAll() {
      playToken += 1;
      releaseSample();
      want = false;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      if (rec) { const r = rec; rec = null; try { r.abort(); } catch { /* 무시 */ } }
      extractCtrl?.abort();
      inflight = false;
      again = false;
      lastText = '';
      lastAt = 0;
      activeMs = 0;
      listenFrom = null;
      fullWarned = false;
      endWaiters.splice(0).forEach((f) => f());
      Object.assign(st, { lines: [], interim: '', interimStart: null, typing: null, card: null, cardNote: aiOff ? AI_OFF_TEXT : null, prevKeys: {}, saved: null, sampleStarted: false, paused: false, source: -1 });
      st.flash.clear();
      setMode('idle');
      renderLines();
      renderCard();
      renderSaved();
      setCardState('');
      setState(readyText);
    }
    async function onReset() {
      if (st.saving) return;
      if ((st.lines.length || st.interim || st.typing) && !st.saved) {
        if (!(await confirmBox('받아쓴 글과 카드 미리보기를 모두 지울까요?'))) return;
        if (disposed) return;
      }
      resetAll();
    }

    // ── 단추 ──
    const onClick = (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn || btn.disabled || !root.contains(btn)) return;
      const act = btn.dataset.act;
      if (act === 'mic') { if (st.mode === 'listening') stopListening(); else startListening(); }
      else if (act === 'sample') playSample();
      else if (act === 'pause' && st.mode === 'sample') togglePause();
      else if (act === 'source') {
        st.source = Number(btn.dataset.lineIndex);
        linesEl.querySelector('.is-source')?.classList.remove('is-source');
        const line = linesEl.querySelector(`[data-line="${st.source}"]`);
        if (line) {
          line.classList.add('is-source');
          line.focus({ preventScroll: true });
          line.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      }
      else if (act === 'example') addExample(btn.dataset.text || '');
      else if (act === 'save') save();
      else if (act === 'reset') onReset();
    };
    root.addEventListener('click', onClick);

    renderLines();
    renderCard();
    updateButtons();

    return () => {
      disposed = true;
      playToken += 1;
      releaseSample();
      want = false;
      root.removeEventListener('click', onClick);
      for (const t of timers) clearTimeout(t);
      timers.clear();
      if (rec) { const r = rec; rec = null; try { r.abort(); } catch { /* 무시 */ } }
      extractCtrl?.abort();
      saveCtrl?.abort();
      endWaiters.splice(0).forEach((f) => f());
    };
  },
};
