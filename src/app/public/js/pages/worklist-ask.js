// Worklist shortcut. Opening the Ask screen only prefills its existing composer.
import { html, href } from '../ui.js';

const prompts = {
  today: ['먼저 확인할 주문은 뭐야?', '다시 연락할 통화를 찾아줘'],
  calls: ['수량이 바뀐 통화 찾아줘', '다시 확인해야 할 통화가 있어?'],
};

export const worklistAsk = (page, draft = '') => html`<aside class="wl-ask" aria-label="Ask 아차">
  <header class="wl-ask-head"><b>Ask 아차</b><a href="#/ask" aria-label="통화 내용 찾기 열기">↗</a></header>
  <div class="wl-ask-body"><p>${page === 'today' ? '오늘의 주문과 통화에서' : '지난 통화 기록에서'}<br>필요한 내용을 찾아보세요.</p>
    ${prompts[page].map(q => html`<a class="wl-prompt" href="${href('/ask', { q })}">${q}<span aria-hidden="true">↗</span></a>`)}
  </div>
  <form class="wl-ask-form" data-worklist-ask><label><span class="sr-only">찾을 내용</span><input name="q" value="${draft}" maxlength="240" required placeholder="통화에서 찾아볼 내용"></label>
    <button type="submit" aria-label="Ask에서 질문 열기">↗</button></form>
  <small>질문을 입력한 뒤 통화 내용 찾기에서 확인할 수 있습니다.</small>
</aside>`;

export function bindWorklistAsk(root) {
  root.addEventListener('submit', event => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-worklist-ask]')) return;
    event.preventDefault();
    const q = String(new FormData(event.target).get('q') || '').trim();
    if (q) location.hash = href('/ask', { q }).slice(1);
  });
}
