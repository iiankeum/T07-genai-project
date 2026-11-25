import { html, fmtWhen, fmtSec, href } from '../ui.js';

function when(iso) {
  try { return fmtWhen(iso); } catch { return ''; }
}

export function citeView(citation) {
  if (citation?.kind === 'knowledge' && citation.knowledgeId) {
    return html`<a class="ask-cite" href="${href('/knowledge', { id: citation.knowledgeId })}">
      <span class="ask-cite-title">${citation.title || '공유 지식'}</span>
      ${citation.quote ? html`<span class="ask-cite-quote">「${citation.quote}」</span>` : ''}
      <span class="ask-cite-go">승인된 지식 열기 ›</span>
    </a>`;
  }
  if (!citation?.callId) return '';
  const at = citation.at == null || citation.at === '' ? NaN : Number(citation.at);
  const segment = citation.segIndex == null || citation.segIndex === '' ? NaN : Number(citation.segIndex);
  const hasAt = Number.isFinite(at);
  const hasSegment = Number.isSafeInteger(segment) && segment >= 0;
  const fromCard = !hasAt && !hasSegment && citation.kind !== 'segment';
  const query = {
    t: hasAt ? Math.max(0, Math.round(at * 10) / 10) : undefined,
    seg: hasSegment ? segment : undefined,
  };
  return html`<a class="ask-cite" href="${href('/calls/' + encodeURIComponent(citation.callId), query)}">
    <span class="ask-cite-title">${citation.title || '통화'}</span>
    <span class="ask-cite-when">${when(citation.recordedAt)}${hasAt ? html` · <span class="ask-cite-at">${fmtSec(at)} 대목</span>` : fromCard ? html` · <span class="ask-cite-at">주문 카드 내용</span>` : ''}</span>
    ${citation.quote ? html`<span class="ask-cite-quote">「${citation.quote}」</span>` : ''}
    <span class="ask-cite-go">${hasAt ? '그 대목 듣기 ›' : hasSegment ? '그 대목 보기 ›' : '통화 열기 ›'}</span>
  </a>`;
}
