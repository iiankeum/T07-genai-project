import { api } from '../api.js';
import { html, render, href, fmtWhen, errorBox, copyText, confirmBox, toast } from '../ui.js';
import { evidenceResult } from './assistant-evidence.js';
import { citeView } from './ask-citation.js';

const DEFAULT_QUESTION_LIMIT = 300;
const ACTION_LABEL = { open_call: '통화 기록', open_knowledge: '공유 지식', draft_callback: '재연락 문안' };
const EXAMPLE = [
  { role: 'user', text: '한빛모터스 주문을 처리하기 전에 확인할 내용을 정리해 줘.' },
  { role: 'assistant', text: '① 차량 번호를 다시 확인하세요.\n② 요청 부품이 도색 전 프론트 범퍼 1개인지 확인하세요.\n③ 오늘 17시까지 배송 가능한지 확인한 뒤 안내하세요.' },
];
const THREADS = '/api/assistant/threads/';

export default {
  title: '업무 도우미',
  mount(el, ctx) {
    const embedded = ctx.embedded === true;
    let context = null;
    let threads = [];
    let thread = null;
    let example = false;
    let request = null;
    let draftRequest = null;
    let threadRequest = null;
    let threadInputState = null;
    let threadActivity = 'load';
    let contextRequest = null;
    let draft = null;
    let failure = null;
    let disposed = false;
    let evidenceInvalidated = false;
    const invalidateEvidence = () => { evidenceInvalidated = true; };
    const evidenceEvents = ['ahmatda:workspace-changed', 'ahmatda:session-expired', 'ahmatda:explicit-logout'];
    for (const name of evidenceEvents) window.addEventListener(name, invalidateEvidence);

    render(el, html`<div class="page as-page ${embedded ? 'as-embedded' : ''}">
      <div class="page-head">
        <div><h1>업무 도우미</h1><p class="sub">선택한 통화에서 할 일을 정리하고 재연락 문안을 준비하세요.</p></div>
        <a class="btn" href="#/ask">여러 통화에서 내용 찾기 →</a>
      </div>
      <div class="card ka-split as-layout">
        <details class="as-sidebar" ${matchMedia('(min-width: 901px)').matches ? html`open` : ''}>
          <summary class="as-work-header"><span class="as-icon" aria-hidden="true">✧</span><h2 id="as-work-title">현재 업무 제안</h2><span class="as-expand" aria-hidden="true">⌄</span></summary>
          <label class="field"><span>현재 통화</span><select class="select" data-ref="calls" disabled><option>불러오는 중…</option></select></label>
          <button type="button" class="btn" data-act="refresh">제안 새로고침</button>
          <div class="as-suggestions" data-ref="suggestions"><p class="loading" role="status">일을 살펴보는 중…</p></div>
          <a class="as-knowledge-meta" href="#/knowledge"><span><strong>공유 지식</strong><small data-ref="count">팀에서 확인한 지식을 함께 써요.</small></span><span aria-hidden="true">→</span></a>
        </details>
        <section class="as-chat" aria-labelledby="as-chat-title">
          <header class="as-chat-head">
            <div><h2 id="as-chat-title">${embedded ? 'Ask 아차' : '아차 어시스턴트'}</h2><p class="help">통화와 승인된 지식을 근거로 답변해요.</p></div>
            <div class="ka-actions"><button type="button" class="btn" data-act="new" aria-label="새 대화"><span class="as-new-icon" aria-hidden="true">↗</span><span class="as-new-label">＋ 새 대화</span></button></div>
          </header>
          ${embedded ? html`<details class="as-history-menu"><summary>대화 기록</summary>` : ''}
          <div class="as-history">
            <label class="field"><span>저장된 대화</span><select class="select" data-ref="threads"><option value="">새 대화</option></select></label>
            <button type="button" class="btn btn-ghost" data-act="delete" disabled>대화 삭제</button>
          </div>
          ${embedded ? html`</details>` : ''}
          <div class="ask-thread as-thread" data-ref="thread" aria-label="대화 메시지"></div>
          <p class="sr-only" data-ref="announce" role="status"></p>
          <div data-ref="error"></div>
          <div class="as-scoped-prompts" ${embedded ? '' : html`hidden`} aria-label="현재 통화 질문 예시">${[
            '수량을 마지막에 몇 개로 바꿨어?',
            '이 부품 좌우가 확정됐어?',
            '차종·연식·품번 중 뭐가 비었어?',
            '출고 전에 다시 전화할 내용이 있어?'
          ].map(q => html`<button type="button" class="btn" data-question="${q}">${q}</button>`)}</div>
          <div class="ka-actions as-shortcuts">
            ${ctx.meta?.access?.demo === false ? '' : html`<button type="button" class="btn" data-act="example">예시 대화 보기</button>`}
            <button type="button" class="btn" data-act="current-draft" disabled>재연락 문안 열기</button>
          </div>
          <form class="as-compose" data-ref="form">
            <label class="sr-only" for="as-question">어시스턴트에게 질문</label>
            <textarea class="textarea" id="as-question" rows="${embedded ? 1 : 2}" maxlength="${DEFAULT_QUESTION_LIMIT}" enterkeyhint="send" placeholder="주문에서 다시 확인할 게 있을까요?"></textarea>
            <button type="submit" class="btn btn-primary" data-act="send" aria-label="보내기" disabled>${embedded ? html`<span aria-hidden="true" class="as-arrow">↑</span><span class="as-send-label">전송</span>` : '보내기'}</button>
            <button type="button" class="btn" data-act="stop" hidden>응답 중단</button>
          </form>
          <p class="help" id="as-thread-loading" data-ref="thread-loading" role="status" hidden></p>
          <p class="help as-foot">주문 확정과 외부 발송은 담당자가 진행합니다.</p>
        </section>
      </div>
      <dialog class="ka-dialog" aria-labelledby="as-draft-title" data-ref="dialog"></dialog>
    </div>`);

    const root = el.firstElementChild;
    const layoutMedia = matchMedia('(min-width: 901px)');
    const suggestionsPanel = root.querySelector('.as-sidebar');
    const syncLayout = () => { if (!suggestionsPanel.contains(document.activeElement)) suggestionsPanel.open = layoutMedia.matches; };
    layoutMedia.addEventListener('change', syncLayout);
    const ref = (name) => root.querySelector(`[data-ref="${name}"]`);
    const act = (name) => root.querySelector(`[data-act="${name}"]`);
    const input = root.querySelector('#as-question');
    const dialog = ref('dialog');
    const announce = (message) => { ref('announce').textContent = message; };

    function paintSuggestions() {
      const actions = context?.suggestions || [];
      const knowledge = context?.knowledgeDraft;
      render(ref('suggestions'), html`${actions.length ? html`<ul>${actions.map((item) => {
        const label = ACTION_LABEL[item.action];
        const contents = html`<div><span class="as-action-label">${label}</span><strong>${item.title}</strong><p>${item.description}</p></div><span aria-hidden="true">→</span>`;
        if (item.action === 'open_call' && item.callId) return html`<li><a class="as-suggestion" href="${href('/calls/' + encodeURIComponent(item.callId))}">${contents}</a></li>`;
        if (item.action === 'open_knowledge' && item.knowledgeId) return html`<li><a class="as-suggestion" href="${href('/knowledge', { id: item.knowledgeId })}">${contents}</a></li>`;
        if (item.action === 'draft_callback' && item.callId) return html`<li><button class="as-suggestion" type="button" data-act="draft" data-id="${item.callId}">${contents}</button></li>`;
        return '';
      })}</ul>` : html`<p class="muted">통화나 승인된 지식이 있으면 이곳에 제안이 표시됩니다.</p>`}
      ${knowledge && ['admin', 'reception'].includes(ctx.meta?.access?.role) ? html`<a class="as-suggestion as-draft-link" href="${href('/knowledge', { call: knowledge.sourceCallId, seg: knowledge.sourceSegIndex, draft: 1 })}">
        <span><strong>받아쓰기 표현 검토</strong><small>${knowledge.term} → ${knowledge.standard}</small></span><span aria-hidden="true">→</span></a>` : ''}`);
    }

    function rememberThread(value) {
      if (!value) return;
      threads = [{ id: value.id, title: value.title, updatedAt: value.updatedAt }, ...threads.filter((item) => item.id !== value.id)];
    }

    function paintHistory() {
      const select = ref('threads');
      const active = thread?.id || '';
      render(select, html`<option value="">새 대화</option>${threads.map((item) => html`<option value="${item.id}">${item.title} · ${fmtWhen(item.updatedAt)}</option>`)}`);
      select.value = active;
      select.disabled = Boolean(request || threadRequest);
      act('delete').disabled = !thread || Boolean(request || threadRequest);
    }

    function paintContext() {
      const select = ref('calls');
      render(select, context.calls.length ? html`${context.calls.map((call) => html`<option value="${call.id}">${call.title || call.customer || '통화'}</option>`)}`
        : html`<option value="">선택할 통화 없음</option>`);
      select.value = context.selected?.id || '';
      select.disabled = embedded || !context.calls.length;
      input.maxLength = context.questionLimit || DEFAULT_QUESTION_LIMIT;
      ref('count').textContent = '승인된 지식 ' + context.approvedCount + '개';
      act('current-draft').disabled = !context.selected;
      paintHistory();
      paintSuggestions();
      syncButtons();
    }

    async function refreshContext(callId = '', recoverMissing = false) {
      if(embedded) { callId=ctx.query.call; recoverMissing=false; }
      contextRequest?.abort();
      const controller = new AbortController();
      contextRequest = controller;
      act('refresh').disabled = true;
      try {
        const fresh = await api.get('/api/assistant', { callId }, { signal: controller.signal });
        if (disposed || contextRequest !== controller) return;
        context = fresh;
        threads = context.threads;
        rememberThread(thread);
        paintContext();
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        if (recoverMissing && error.status === 404) {
          toast('이전 통화를 찾지 못해 최근 통화를 열었어요.', 'info');
          refreshContext();
        } else render(ref('suggestions'), errorBox(error));
      } finally {
        if (contextRequest === controller) {
          contextRequest = null;
          act('refresh').disabled = false;
        }
      }
    }

    function messageView(message, isExample = false) {
      const user = message.role === 'user';
      const label = isExample ? '예시 대화' : message.mode === 'fixture' ? '테스트 응답' : user ? '' : '근거 기반 응답';
      const citations = Array.isArray(message.citations) ? message.citations : [];
      return html`<article class="ask-msg ${user ? 'is-user' : 'is-bot'}">
        <div class="as-message-label"><strong>${user ? '나' : '아차'}</strong>${label ? html`<span class="chip chip-ai">${label}</span>` : ''}</div>
        <div class="ask-bubble ${message.found === false ? 'is-notfound' : ''}">${message.text}</div>
        ${citations.length ? html`<div class="ask-cites"><p class="ask-cites-head">답변 근거 ${citations.length}건</p>${citations.map(citeView)}</div>` : ''}
      </article>`;
    }

    function paintChat() {
      const log = ref('thread');
      const parts = (thread?.messages || []).map((message) => messageView(message));
      if (example) parts.push(...EXAMPLE.map((message) => messageView(message, true)));
      if (request) {
        parts.push(messageView({ role: 'user', text: request.question }));
        parts.push(html`<div class="ask-msg is-bot"><div class="ask-bubble is-wait" role="status"><span class="spinner" aria-hidden="true"></span> 통화 기록 확인 중…</div></div>`);
      }
      render(log, parts.length ? html`${parts}` : embedded ? html`<p class="as-welcome-note">이 통화의 주문 내용과<br>다시 확인할 부분을 물어보세요.</p>` : html`<div class="as-welcome"><span class="as-icon" aria-hidden="true">✧</span><h3>어떤 일부터 함께할까요?</h3><p>주문 내용이나 팀에서 승인한 현장 표현을 물어보세요.</p></div>`);
      log.scrollTop = log.scrollHeight;
      render(ref('error'), failure ? html`<div class="notice notice-error as-error" role="alert"><span>${failure.message}</span>
        ${failure.question ? html`<button type="button" class="btn" data-act="retry">다시 시도</button>` : ''}</div>` : '');
      paintHistory();
      syncButtons();
    }

    function syncThreadInput() {
      const loading = ref('thread-loading');
      const form = ref('form');
      if (threadRequest) {
        if (!threadInputState) threadInputState = {
          disabled: input.disabled,
          describedBy: input.getAttribute('aria-describedby'),
          busy: form.getAttribute('aria-busy'),
        };
        input.disabled = true;
        input.setAttribute('aria-describedby', [threadInputState.describedBy, 'as-thread-loading'].filter(Boolean).join(' '));
        form.setAttribute('aria-busy', 'true');
        loading.textContent = threadActivity === 'delete'
          ? '대화를 삭제하는 중입니다. 완료 후 질문을 작성할 수 있어요.'
          : '대화를 불러오는 중입니다. 완료 후 질문을 작성할 수 있어요.';
        loading.hidden = false;
      } else if (threadInputState) {
        input.disabled = threadInputState.disabled;
        for (const [element, name, value] of [[input, 'aria-describedby', threadInputState.describedBy], [form, 'aria-busy', threadInputState.busy]]) {
          if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
        }
        loading.hidden = true;
        threadInputState = null;
      }
    }

    function syncButtons() {
      syncThreadInput();
      act('send').hidden = Boolean(request);
      act('send').disabled = !context || Boolean(request || threadRequest) || !input.value.trim();
      act('stop').hidden = !request;
      act('new').disabled = Boolean(request || threadRequest);
      if (act('example')) act('example').disabled = example || Boolean(request);
    }

    function friendlyError(error) {
      if (error.status === 429 || error.status === 409 || error.status === 400) return error.message;
      if (error.status === 503 || ['ai_off', 'no_key'].includes(error.code)) return '지금은 질문에 답하기 어려워요. 잠시 뒤 다시 시도하거나 업무 제안을 사용해 주세요.';
      if (error.status === 504) return '답변을 받는 데 시간이 걸려요. 잠시 뒤 다시 시도해 주세요.';
      return '답변을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.';
    }

    async function ask(text) {
      const question = (text || '').trim().slice(0, input.maxLength);
      if (!question || !context || request || threadRequest) return;
      const controller = new AbortController();
      const current = { controller, question, callId: context?.selected?.id,
        workspaceId: ctx.meta?.access?.workspace?.id ?? null, route: location.hash };
      request = current;
      failure = null;
      example = false;
      input.value = '';
      announce('답변을 기다리는 중입니다.');
      paintChat();
      try {
        const out = await api.post('/api/assistant', { message: question, threadId: thread?.id, callId: current.callId }, { signal: controller.signal });
        if (disposed || request !== current) return;
        thread = out.thread;
        rememberThread(thread);
        announce('답변이 도착했어요. ' + out.answer);
        const evidence = evidenceResult({ question, response: out, embedded,
          active: !disposed && !controller.signal.aborted && request === current && !evidenceInvalidated,
          requestCallId: current.callId, selectedCallId: context?.selected?.id, viewCallId: ctx.query?.call,
          workspaceUnchanged: current.workspaceId === (ctx.meta?.access?.workspace?.id ?? null),
          routeUnchanged: current.route === location.hash });
        if (evidence && typeof ctx.onEvidenceResult === 'function') {
          // Receiver rechecks quote/time against its mounted call; this is a read-only UI hint.
          try { ctx.onEvidenceResult(evidence); } catch { /* 답변은 유지하고 자동 이동만 생략한다. */ }
        }
      } catch (error) {
        if (disposed || controller.signal.aborted || request !== current) return;
        failure = { message: friendlyError(error), question };
        if (!input.value) input.value = question;
      } finally {
        if (!disposed && request === current) {
          request = null;
          paintChat();
        }
      }
    }

    function stop() {
      if (!request) return;
      const { controller, question } = request;
      request = null;
      controller.abort();
      if (!input.value) input.value = question;
      announce('응답을 중단했어요.');
      paintChat();
      input.focus();
    }

    function newChat() {
      if (request || threadRequest) return;
      thread = null;
      example = false;
      failure = null;
      input.value = '';
      paintChat();
      input.focus();
    }

    async function openThread(id) {
      if (request || threadRequest) return;
      if (!id) { newChat(); return; }
      const controller = new AbortController();
      threadActivity = 'load';
      threadRequest = controller;
      failure = null;
      paintHistory();
      syncButtons();
      try {
        const data = await api.get(THREADS + encodeURIComponent(id), null, { signal: controller.signal });
        if (disposed) return;
        thread = data.thread;
        example = false;
        input.value = '';
      } catch (error) {
        if (!disposed && !controller.signal.aborted) failure = { message: error.message };
      } finally {
        threadRequest = null;
        if (!disposed) paintChat();
      }
    }

    async function deleteChat() {
      if (!thread || request || threadRequest) return;
      const id = thread.id;
      if (!(await confirmBox('저장된 대화를 삭제할까요?')) || disposed || request || threadRequest || thread?.id !== id) return;
      threadActivity = 'delete';
      threadRequest = new AbortController();
      paintHistory();
      syncButtons();
      try {
        await api.del(THREADS + encodeURIComponent(id), { signal: threadRequest.signal });
        if (disposed) return;
        threadRequest = null;
        threads = threads.filter((item) => item.id !== id);
        newChat();
        toast('대화를 삭제했어요.', 'ok');
      } catch (error) {
        if (!disposed) toast(error.message, 'error');
      } finally {
        threadRequest = null;
        if (!disposed) paintChat();
      }
    }

    function paintDraft(contents) {
      const focused = dialog.open && dialog.contains(document.activeElement);
      const focusedAction = focused ? document.activeElement?.dataset.act : null;
      render(dialog, html`<div class="ka-dialog-head"><h2 id="as-draft-title" tabindex="-1">재연락 문안 초안</h2>
        <button class="btn btn-ghost ka-close" type="button" data-act="close-draft" aria-label="닫기">×</button></div>${contents}`);
      if (focused && dialog.open) {
        const replacement = focusedAction ? [...dialog.querySelectorAll('[data-act]')].find(button => button.dataset.act === focusedAction) : null;
        (replacement || dialog.querySelector('#as-draft-title'))?.focus({ preventScroll: true });
      }
    }

    async function openDraft(id) {
      if (!id) return;
      draftRequest?.abort();
      const controller = new AbortController();
      draftRequest = controller;
      draft = null;
      paintDraft(html`<p class="loading" role="status">문안을 준비하는 중…</p>`);
      if (!dialog.open) dialog.showModal();
      try {
        const out = await api.get('/api/assistant/callback', { callId: id }, { signal: controller.signal });
        if (disposed || controller.signal.aborted) return;
        draft = out;
        paintDraft(html`<p class="help">통화를 바탕으로 준비한 문안입니다. 내용을 확인하고 수정하세요.</p>
          <a href="${href('/calls/' + encodeURIComponent(draft.call.id))}">${draft.call.title || '출처 통화'} →</a>
          <label class="field"><span>받는 사람에게 보낼 문안</span><textarea class="textarea" rows="9" data-ref="draft-text">${draft.text}</textarea></label>
          <div class="as-draft-actions"><p class="help">복사한 뒤 직접 전달하세요.</p><button class="btn btn-primary" type="button" data-act="copy-draft">문안 복사</button></div>`);
      } catch (error) {
        if (!disposed && !controller.signal.aborted) paintDraft(errorBox(error));
      } finally {
        if (draftRequest === controller) draftRequest = null;
      }
    }

    dialog.addEventListener('close', () => draftRequest?.abort());
    input.addEventListener('input', syncButtons);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      ask(input.value);
    });
    ref('form').addEventListener('submit', (event) => {
      event.preventDefault();
      ask(input.value);
    });
    ref('calls').addEventListener('change', (event) => refreshContext(event.target.value));
    ref('threads').addEventListener('change', (event) => openThread(event.target.value));

    root.addEventListener('click', (event) => {
      const prompt=event.target.closest('[data-question]');
      if(prompt && !request && !threadRequest){input.value=prompt.dataset.question.slice(0,input.maxLength);syncButtons();input.focus();return;}
      const button = event.target.closest('button[data-act]');
      if (!button || button.disabled || disposed) return;
      const { act: action, id } = button.dataset;
      if (action === 'new') newChat();
      else if (action === 'delete') deleteChat();
      else if (action === 'refresh' && !contextRequest) refreshContext(context?.selected?.id);
      else if (action === 'draft') openDraft(id);
      else if (action === 'current-draft') openDraft(context?.selected?.id);
      else if (action === 'close-draft') dialog.close();
      else if (action === 'copy-draft' && draft) copyText(ref('draft-text').value);
      else if (action === 'stop') stop();
      else if (action === 'retry') ask(failure?.question);
      else if (action === 'example' && !example) {
        example = true;
        failure = null;
        paintChat();
      }
    });

    let embeddedStarted = false;
    function startEmbeddedContext() {
      if (!embedded || embeddedStarted || disposed || evidenceInvalidated) return;
      embeddedStarted = true;
      refreshContext(ctx.query?.call, false);
    }
    paintChat();
    if (embedded) {
      render(ref('suggestions'), html`<p class="muted">대화를 시작하면 현재 통화의 제안을 불러옵니다.</p>`);
      root.addEventListener('focusin', startEmbeddedContext);
      root.addEventListener('click', startEmbeddedContext, true);
    } else refreshContext(ctx.query?.call, true);
    if (ctx.query?.q) {
      input.value = String(ctx.query.q).slice(0, input.maxLength);
      syncButtons();
    }
    return () => {
      disposed = true;
      root.removeEventListener('focusin', startEmbeddedContext);
      root.removeEventListener('click', startEmbeddedContext, true);
      for (const name of evidenceEvents) window.removeEventListener(name, invalidateEvidence);
      layoutMedia.removeEventListener('change', syncLayout);
      request?.controller.abort();
      draftRequest?.abort();
      threadRequest?.abort();
      contextRequest?.abort();
      if (dialog.open) dialog.close();
    };
  },
};
