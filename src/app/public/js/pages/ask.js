// F09 지난 통화에 묻기 — 채팅. 저장된 통화 글 · 카드만 근거로 답하고, 근거 문장을 누르면 그 대목으로 간다.
import { api } from '../api.js';
import { html, render, confirmBox, aiOffNotice } from '../ui.js';
import { citeView } from './ask-citation.js';

const STORE_KEY = 'cn.ask.v1';
const HISTORY_SEND = 6;
const MAX_SAVED = 40;
const MAX_Q = 300; // 서버 상한 300자
const EXAMPLES = [
  '새한카센터가 앞범퍼 몇 개라고 했어?',
  '오늘 다시 전화할 곳 알려 줘',
  '이번 주에 쏘렌토 주문 있었어?',
  '우리공업사 헤드라이트 어떻게 됐어?',
];

function loadSaved(key) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string').slice(-MAX_SAVED) : [];
  } catch { return []; }
}
function save(key, msgs) {
  try { sessionStorage.setItem(key, JSON.stringify(msgs.slice(-MAX_SAVED))); } catch { /* 저장 못 해도 화면은 돈다 */ }
}

export default {
  title: '지난 통화에 묻기',
  async mount(el, ctx) {
    const meta = ctx.meta || {};
    const access = meta.access;
    const key = access?.demo === false ? STORE_KEY + ':' + access.workspace?.id + ':' + access.user?.id : STORE_KEY;
    let msgs = loadSaved(key); // [{role:'user'|'assistant', text, found?, citations?, error?}]
    let pending = false;
    let aiOff = meta.aiEnabled === false;
    let disposed = false;
    let ctrl = null;

    render(el, html`<div class="page page-narrow ask-page">
      <div class="page-head"><div>
        <p class="eyebrow">F09 · 묻기</p>
        <h1>지난 통화에 묻기</h1>
        <p class="sub">사람에게 묻듯 물어보세요.</p>
      </div><button type="button" class="btn btn-ghost" data-act="clear">대화 지우기</button></div>
      <div class="notice ask-rule" role="note">저장된 통화 글 · 카드만 보고 답합니다. 없으면 지어내지 않고 「찾지 못했어요」라고 합니다.</div>
      <div data-ref="aioff"></div>
      <div class="ask-examples">
        <p class="field-label">이렇게 물어보세요</p>
        <div class="ask-chips">${EXAMPLES.map((q) => html`<button type="button" class="ask-chip" data-act="example" data-q="${q}">${q}</button>`)}</div>
      </div>
      <div class="ask-thread" data-ref="thread" aria-live="off"></div>
      <p class="sr-only" role="status" data-ref="sr"></p>
      <div class="ask-compose">
        <label class="sr-only" for="askInput">질문</label>
        <textarea id="askInput" class="textarea ask-input" rows="1" maxlength="${MAX_Q}" placeholder="예: 한빛카가 이번 주에 백미러 몇 번 시켰어?" enterkeyhint="send"></textarea>
        <button type="button" class="btn btn-primary ask-send" data-act="send">보내기</button>
      </div>
      <p class="help ask-help">Enter 로 보내고, 줄을 바꾸려면 Shift + Enter.</p>
    </div>`);

    const root = el.querySelector('.ask-page');
    const thread = root.querySelector('[data-ref="thread"]');
    const input = root.querySelector('#askInput');
    const sendBtn = root.querySelector('[data-act="send"]');

    function renderAiOff() {
      render(root.querySelector('[data-ref="aioff"]'), aiOff ? aiOffNotice({ aiEnabled: false }) : html``);
    }
    function msgView(m) {
      if (m.role === 'user') return html`<div class="ask-msg is-user"><div class="ask-bubble">${m.text}</div></div>`;
      if (m.error) return html`<div class="ask-msg is-bot"><div class="ask-bubble is-error" role="alert">${m.text}</div></div>`;
      const cites = Array.isArray(m.citations) ? m.citations.filter((c) => c && c.callId) : [];
      return html`<div class="ask-msg is-bot">
        <div class="ask-bubble ${m.found === false ? 'is-notfound' : ''}">${m.mode === 'fixture' ? html`<span class="chip chip-ai">가짜 테스트 응답</span> ` : ''}${m.text}</div>
        ${cites.length ? html`<div class="ask-cites"><p class="ask-cites-head">근거 통화 ${cites.length}건</p>${cites.map(citeView)}</div>` : ''}
      </div>`;
    }
    function renderThread(scroll = true) {
      if (disposed) return;
      const parts = msgs.map(msgView);
      if (pending) parts.push(html`<div class="ask-msg is-bot"><div class="ask-bubble is-wait"><span class="spinner" aria-hidden="true"></span> 통화를 찾아보는 중…</div></div>`);
      render(thread, parts.length ? html`${parts}` : html`<p class="ask-empty">아직 물어본 것이 없습니다. 위 예시를 누르거나 아래에 질문을 써 보세요.</p>`);
      root.querySelector('[data-act="clear"]').disabled = !msgs.length || pending;
      if (scroll && parts.length) thread.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    function announce(text) {
      const sr = root.querySelector('[data-ref="sr"]');
      if (sr) sr.textContent = String(text).slice(0, 400);
    }
    function updateSend() {
      sendBtn.disabled = pending || !input.value.trim();
      root.querySelectorAll('[data-act="example"]').forEach((b) => { b.disabled = pending; });
    }
    function autoGrow() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight + 2, 180) + 'px';
    }

    async function ask(question) {
      const q = String(question || '').trim().slice(0, MAX_Q);
      if (!q || pending) return;
      // 앞 대화(오류 말풍선과 그 질문은 빼고 최근 6개)
      const history = msgs.filter((m, i) => !m.error && !(m.role === 'user' && msgs[i + 1]?.error)).slice(-HISTORY_SEND).map((m) => ({ role: m.role, text: String(m.text).slice(0, 1000) }));
      msgs.push({ role: 'user', text: q });
      pending = true;
      input.value = '';
      autoGrow();
      updateSend();
      renderThread();
      ctrl = new AbortController();
      try {
        const out = await api.post('/api/ask', { question: q, history }, { signal: ctrl.signal });
        if (disposed) return;
        const found = out?.found !== false;
        const answerText = String(out?.answer || (found ? '' : '찾지 못했어요.')).trim() || '찾지 못했어요.';
        announce('답: ' + answerText);
        msgs.push({
          role: 'assistant',
          text: answerText,
          found,
          mode: out?.mode,
          citations: Array.isArray(out?.citations) ? out.citations.slice(0, 8) : [],
        });
      } catch (err) {
        if (disposed || err?.name === 'AbortError') return;
        if (err?.code === 'ai_off' || err?.code === 'no_key') {
          aiOff = true;
          renderAiOff();
        }
        announce(err?.message || '답을 받지 못했습니다.');
        msgs.push({ role: 'assistant', error: true, text: err?.message || '답을 받지 못했습니다. 잠시 뒤 다시 해 주세요.' });
        if (!input.value) { input.value = q; autoGrow(); } // 다시 보내기 쉽게 질문을 돌려놓는다
      } finally {
        ctrl = null;
        if (!disposed) {
          pending = false;
          save(key, msgs);
          renderThread();
          updateSend();
        }
      }
    }

    async function clearAll() {
      if (!msgs.length || pending) return;
      if (!(await confirmBox('지금까지 묻고 답한 내용을 지울까요?'))) return;
      if (disposed) return;
      msgs = [];
      save(key, msgs);
      renderThread(false);
      input.focus();
    }

    const onClick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled || !root.contains(b)) return;
      const act = b.dataset.act;
      if (act === 'send') ask(input.value);
      else if (act === 'example') ask(b.dataset.q || '');
      else if (act === 'clear') clearAll();
    };
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (e.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter 는 글자 확정용
      e.preventDefault();
      ask(input.value);
    };
    const onInput = () => { autoGrow(); updateSend(); };

    root.addEventListener('click', onClick);
    input.addEventListener('keydown', onKey);
    input.addEventListener('input', onInput);

    renderAiOff();
    renderThread(false);
    updateSend();
    if (ctx.query?.q) { input.value = String(ctx.query.q).slice(0, MAX_Q); autoGrow(); updateSend(); }

    return () => {
      disposed = true;
      ctrl?.abort();
      root.removeEventListener('click', onClick);
      input.removeEventListener('keydown', onKey);
      input.removeEventListener('input', onInput);
    };
  },
};
