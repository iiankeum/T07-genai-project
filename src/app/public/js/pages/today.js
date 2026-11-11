// 임시 첫 화면 — 기능 모듈이 들어오면 바뀐다.
import { html, render } from '../ui.js';
export default {
  title: '오늘',
  async mount(el, { meta }) {
    render(el, html`<div class="page page-narrow"><div class="page-head"><div><p class="eyebrow">가짜 통화 데모</p><h1>콜노트(가칭)</h1><p class="sub">전화 주문을 받아쓰고 주문 카드로 정리합니다. 지금 기능을 붙이는 중입니다.</p></div></div>
    <div class="card"><p>AI: ${meta.aiEnabled ? '켜짐' : '키 없음'} · 받아쓰기 일꾼: ${meta.worker?.online ? '켜짐' : '대기 중'}</p></div></div>`);
  },
};
