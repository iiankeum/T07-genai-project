// 주문 카드에 이미 연결된 근거만 사용한다. 인용을 읽거나 재생하는 동작은 카드를 수정하지 않는다.
import { html, fmtSec } from '../ui.js';

export function quoteTarget(evidence) {
  const i = evidence?.segIndex, t = evidence?.at;
  return { index:Number.isInteger(i) && i >= 0 ? i : -1,
    at:Number.isFinite(t) && t >= 0 ? t : null };
}

export function evidenceQuote(evidence, hasAudio) {
  if (!evidence?.quote) return '';
  const {index,at} = quoteTarget(evidence);
  const action = hasAudio && at !== null ? '이 대목 듣기' : index >= 0 ? '대화에서 보기' : '전체 대화 보기';
  return html`<div class="cd-quote">
    <span class="cd-quote-label">근거</span>
    <button type="button" class="cd-to-trans cd-quote-action" data-act="to-trans">
      <span class="cd-quote-copy"><q class="cd-quote-text">${evidence.quote}</q>
        ${at !== null ? html`<span class="cd-quote-time">${fmtSec(at)}</span>` : ''}
        <span class="cd-quote-verb">${action}</span></span>
    </button>
  </div>`;
}

// 호출자가 카드 복귀 위치를 보관하고 대화 탭을 표시한 뒤에만 실행한다.
export function activateQuote(evidence, {lineFor,transcript,mark,scroll,seek,hasAudio}) {
  const {index,at} = quoteTarget(evidence);
  const line = index >= 0 ? lineFor(index) : null;
  mark(line ? index : -1);
  (line || transcript).focus({preventScroll:true});
  scroll(line ? index : -1);
  if (hasAudio && at !== null) seek(at);
}
