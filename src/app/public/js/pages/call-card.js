// 통화 상세의 주문 카드(F04 · F05 · F06 · F07 다시 정리 · F11): 칸 고치기 · 근거 듣기 · 확정 · 출고 · 다시 전화 · 다시 정리.
// call.js에서 사용한다. 입력을 모아 저장하고 실패한 변경은 현재 탭에서 복구한다.
import { api } from '../api.js';
import { html, render as renderNative, toast, confirmBox, fmtSec, fmtWhen, cardChip } from '../ui.js';
import {
  CALL_TYPES, confirmationIssues, domainFor, isShipTarget, itemId, normalizePartNo,
} from '../domain.js';
import { groupUnsure, cloneItems, itemsForSave, num, parseUnsureField, itemMark, FIELD_LABEL } from './call-util.js';

// Keep the existing order flow available if optional presentation assets fail.
const montageControls = await import('/montage/order-controls.js').catch(() => null);
const enhanceControls = (target) => montageControls?.enhanceControls(target);
const disposeControls = (target) => montageControls?.disposeControls(target);

const TOP_FIELDS = [
  { key: 'customer', label: '거래처', ph: '통화에서 말한 거래처' },
  { key: 'contact', label: '담당자', ph: '예: 김 실장' },
  { key: 'carModel', label: '차종', ph: '예: 아반떼 AD' },
  { key: 'modelYear', label: '연식', ph: '예: 2017', mode: 'numeric' },
  { key: 'plate', label: '차번호', ph: '예: 12가 3456' },
];
const WHEN_FIELDS = [
  { key: 'due', label: '원하는 때', ph: '예: 오늘 오전 중' },
  { key: 'delivery', label: '받는 방법', ph: '예: 배송, 퀵, 직접 수령', list: 'cd-delivery-list' },
];
const NOTE_FIELD = { key: 'note', label: '메모', ph: '예: 오후 3시 전에 전화 주기', textarea: true, wide: true };
const DELIVERY_OPTIONS = ['배송', '퀵', '직접 수령', '화물', '택배'];
const DONE_MSG = {
  confirm: '확정했습니다. 출고 목록에 올라갔습니다.',
  ship: '출고 완료로 바꿨습니다.',
  reopen: '확인 필요로 되돌렸습니다. 이제 칸을 고칠 수 있습니다.',
  unship: '출고를 되돌렸습니다. 카드는 확정 상태입니다.',
  cancel: '주문 카드를 취소했습니다.',
};
const askText = (q) => (typeof q === 'string' ? q : q?.text ?? q?.question ?? JSON.stringify(q));
const ICONS = {
  evidence: html`<path d="M10 13a4 4 0 0 0 6 0l3-3a4 4 0 1 0-6-6l-1.5 1.5m2.5 5.5a4 4 0 0 0-6 0l-3 3a4 4 0 1 0 6 6l1.5-1.5"/>`,
  play: html`<path d="m9 5 11 7-11 7Z"/>`,
  warning: html`<path d="M12 4 3 20h18L12 4Zm0 6v4m0 3h.01"/>`,
  phone: html`<path d="M8 3H4a1 1 0 0 0-1 1 17 17 0 0 0 17 17 1 1 0 0 0 1-1v-4l-5-2-2 2a12 12 0 0 1-6-6l2-2-2-5Z"/>`,
};
const icon = (name) => html`<svg class="cd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

/**
 * 주문 카드를 그리고 사용자 동작을 처리한다.
 * @param {HTMLElement} el 카드를 그릴 상자
 * @param {object} o
 * @param {string} o.callId
 * @param {object} o.call                callView(withDetail)
 * @param {object} o.meta                /api/meta
 * @param {boolean} o.hasAudio
 * @param {(ev:any)=>({segIndex:number, at:number|null, quote:string}|null)} o.resolve 근거 → 문장 · 시각
 * @param {(r:object|null, opts:{play:boolean, scroll:boolean})=>void} o.onEvidence
 * @param {(card:object, info:{fields:string[]})=>void} o.onCardChange
 * @param {(call:object)=>void} o.onCallReplaced    다시 정리로 새 통화를 받았을 때
 * @param {(r:object|null)=>void} o.onJumpToTranscript
 */
export function mountCard(el, o) {
  if (montageControls) el.classList.add('montage-order-card', 'montage-scope');
  const render = (target, content) => {
    disposeControls(target);
    renderNative(target, content);
    // Dialogs outside the card retain their existing lifecycle and focus behavior.
    if (target === el || el.contains(target)) enhanceControls(target);
  };
  let call = o.call;
  let card = call.card || null;
  let savedCard = card;
  let items = cloneItems(card?.items);
  const role = o.meta?.access?.role || 'admin';
  const canEdit = role === 'admin' || role === 'reception';
  const canShip = role === 'admin' || role === 'shipping';
  const pending = new Map();
  // 계정 전환 후 다른 사람의 임시입력을 복구·자동저장하지 않는다.
  // 이전 사용자 구분 없는 키는 작성자를 알 수 없어 읽거나 삭제하지 않는다.
  const demo = o.meta?.demo === true || o.meta?.access?.demo === true;
  const userId = demo ? 'demo' : o.meta?.access?.user?.id;
  const workspaceId = o.meta?.access?.workspace?.id || (demo ? 'demo' : null);
  const storageKey = typeof userId === 'string' && userId && typeof workspaceId === 'string' && workspaceId
    ? 'cn.card.pending:v2:' + [userId, workspaceId, o.callId].map(encodeURIComponent).join(':') : null;
  let saveTimer = null;
  let failure = null;
  let latest = null;
  let baseRevision = savedCard?.revision;
  let retryMs = 2000;
  let chain = Promise.resolve();
  let alive = true;
  let busy = false;
  let pendingStatus = null;
  const statusControls = new Map();
  let reexBusy = false;
  let cbOpen = false;
  let activeKey = null;
  const savedTimers = new Map();
  let evMap = new Map();

  const editable = () => canEdit && card?.status === 'draft' && !pendingStatus;
  const slot = (name) => el.querySelector('[data-slot="' + name + '"]');
  const profile = () => domainFor(card?.domainVersion);
  function localCard() {
    const rows = itemsForSave(items);
    const warnings = (card?.unsure || []).flatMap((warning) => {
      if (!Number.isInteger(warning.item)) return [warning];
      const id = savedCard?.items?.[warning.item]?.id;
      const index = rows.findIndex((item) => item.id === id);
      return index < 0 ? [] : [{ ...warning, item: index }];
    });
    return { ...card, items: rows, unsure: warnings };
  }
  const nothingToShip = () => !isShipTarget(localCard());
  const shipWord = () => isShipTarget(localCard()) ? '출고 완료' : '처리 완료';

  // ── 그리기 ──────────────────────────────────────────────────────
  // 확정 · 출고된 카드는 사람이 확인을 마친 것이라 「AI 초안」 대신 「사람이 확인」으로 바꿔 보인다(기획서 공통 기준)
  const humanChecked = () => card && (card.status === 'confirmed' || card.status === 'shipped');
  const aiChip = (checked = false) => (checked || humanChecked()
    ? html`<span class="chip chip-confirmed cd-provenance" title="사람이 확인">사람이 확인</span>`
    : html`<span class="chip chip-ai cd-provenance" title="AI 초안">AI 초안</span>`);
  const editedChip = () => html`<span class="chip chip-edited">사람이 고침</span>`;
  function chipFor(key) {
    if (!card) return '';
    if (key.startsWith('item:')) {
      // 부품 줄마다: AI 초안 줄과 같으면 「AI 초안」, 사람이 고치거나 넣은 줄이면 「사람이 고침」
      const index = Number(key.slice(5));
      const item = items[index];
      if (!item?.part && !item?.partNo) return '';
      if (humanChecked() || (!pending.has('items') && card.fieldReviews?.['item:' + itemId(item, index)])) return aiChip(true);
      if (!card.aiDraft) return editedChip();
      const mark = itemMark(card.aiDraft.items, item);
      if (mark === 'edited') return editedChip();
      return mark === 'ai' ? aiChip() : '';
    }
    if (card.fieldReviews?.[key] && !pending.has(key)) return aiChip(true);
    if (!humanChecked() && (card.edited || []).includes(key)) return editedChip();
    const v = key === 'items' ? items.length : key === 'askBack' ? (card.askBack || []).length : card[key];
    if (v === null || v === undefined || v === '' || v === 0 || v === false) return '';
    return card.aiDraft || humanChecked() ? aiChip() : editedChip();
  }

  function evButton(r, label) {
    if (!r || (r.at === null && r.segIndex < 0)) return '';
    const t = r.at !== null ? fmtSec(r.at) : '';
    const what = o.hasAudio ? `${label} 근거 대목${t ? ` ${t}부터` : ''} 듣기` : `${label} 근거 문장 보기`;
    return html`<button type="button" class="btn cd-evbtn ev-play" aria-label="${what}" title="${what}">${icon(o.hasAudio ? 'play' : 'evidence')}<span>근거</span>${t ? html`<span class="cd-evtime">${t}</span>` : ''}</button>`;
  }

  function quoteBox(r) {
    if (!r || !r.quote) return '';
    return html`<div class="cd-quote">
      <span class="cd-quote-label">근거</span>
      <q class="cd-quote-text">${r.quote}</q>${r.at !== null ? html` <span class="cd-quote-time">${fmtSec(r.at)}</span>` : ''}
      <button type="button" class="btn btn-ghost cd-to-trans" data-act="to-trans">대화에서 보기</button>
    </div>`;
  }

  function flagsView(list) {
    if (!list || !list.length) return '';
    return html`<div class="cd-flags">${list.map(({ u }) => html`<div class="cd-flag-row">
      <button type="button" class="listen-flag cd-flag" data-flag="${u.id}" aria-label="받아쓰기가 틀렸을 수 있는 곳 ${o.hasAudio ? '들어 보기' : '근거 보기'}">${icon('warning')} ${o.hasAudio ? '들어 보기' : '근거 보기'}${num(u.at) !== null ? ` ${fmtSec(u.at)}` : ''}</button>
      <span class="cd-flag-why">${u.reason || '받아쓰기가 틀렸을 수 있습니다. 녹음으로 확인해 주세요.'}</span>
      ${editable() && u.id ? html`<button type="button" class="btn cd-reviewed" data-review="${u.id}">확인 완료</button>` : ''}
    </div>`)}</div>`;
  }

  function plateHint() {
    const plate = String(card.plate ?? '').replace(/\s/g, '');
    return plate && profile().platePattern && !profile().platePattern.test(plate)
      ? html`<p class="help">차번호 형식을 확인해 주세요. 예시 12가 3456</p>` : '';
  }

  function fieldBlock(f, groups) {
    const r = o.resolve(card.evidence?.[f.key]);
    evMap.set(f.key, r);
    const flags = groups.get(f.key) || [];
    const label = profile().orderFields[f.key] || f.label;
    const id = `cf-${f.key}`;
    const ro = !editable();
    const value = card[f.key] ?? '';
    const max = profile().textLimits[f.key];
    const pattern = f.key === 'modelYear' && profile().modelYearPattern ? profile().modelYearPattern.source : null;
    return html`<div class="cd-field ${f.wide ? 'cd-field-wide' : ''} ${flags.length ? 'is-unsure' : ''}" data-ev="${f.key}">
      <div class="cd-field-top"><label class="cd-label" for="${id}">${label}</label></div>
      <div class="cd-input-row">
        ${f.textarea
    ? html`<textarea id="${id}" class="textarea" data-field="${f.key}" maxlength="${max}" rows="2" placeholder="${f.ph}" ${ro ? html`readonly` : ''}>${value}</textarea>`
    : html`<input id="${id}" class="input" data-field="${f.key}" maxlength="${max}" ${pattern ? html`pattern="${pattern}"` : ''} value="${value}" placeholder="${f.ph}" autocomplete="off" spellcheck="false" ${f.mode ? html`inputmode="${f.mode}"` : ''} ${f.list ? html`list="${f.list}"` : ''} ${ro ? html`readonly` : ''}>`}
        ${evButton(r, f.label)}
      </div>
      <div class="cd-field-meta">
        <span class="cd-chipslot" data-chip="${f.key}">${chipFor(f.key)}</span>
        ${f.key === 'customer' && card.customerByPhone ? html`<span class="cd-phone-match" title="걸려 온 번호가 거래처 목록의 번호와 같아 그 이름으로 채웠습니다">번호 일치</span>` : ''}
        <span class="cd-saved" data-saved="${f.key}" aria-live="polite"></span>
      </div>
      ${flagsView(flags)}
      ${f.key === 'plate' ? html`<div data-slot="plate-hint">${plateHint()}</div>` : ''}
      ${quoteBox(r)}
    </div>`;
  }

  function typeBlock() {
    if (card.callType === undefined) return '';
    const cur = card.callType || '주문';
    const list = CALL_TYPES.includes(cur) ? CALL_TYPES : [cur, ...CALL_TYPES];
    return html`<div class="cd-field" data-ev="callType">
      <div class="cd-field-top">
        <label class="cd-label" for="cf-callType">통화 종류</label>
        <span class="cd-chipslot" data-chip="callType">${chipFor('callType')}</span>
        <span class="cd-saved" data-saved="callType" aria-live="polite"></span>
      </div>
      <div class="cd-input-row"><select id="cf-callType" class="select" data-field="callType" ${editable() ? '' : html`disabled`}>
        ${list.map((t) => html`<option value="${t}" ${t === cur ? html`selected` : ''}>${t}</option>`)}
      </select></div>
    </div>`;
  }

  function itemRow(it, i, flags) {
    const r = o.resolve({ seg: it.seg, at: it.at, quote: it.quote });
    evMap.set(`item:${i}`, r);
    const ro = !editable();
    const n = i + 1;
    return html`<li class="cd-item ${flags.length ? 'is-unsure' : ''}" data-ev="item:${i}">
      <div class="cd-item-head">
        <span class="cd-item-no" aria-hidden="true">${n}</span>
        <span class="cd-item-title">품목 ${n}</span>
        <span class="cd-chipslot" data-chip="item:${i}">${chipFor(`item:${i}`)}</span>
        ${evButton(r, `${n}번째 부품`)}
        ${ro ? '' : html`<button type="button" class="btn btn-ghost cd-item-del" data-del="${i}" aria-label="${n}번째 부품 줄 지우기">지우기</button>`}
      </div>
      <div class="cd-item-grid">
        <label class="cd-sub cd-sub-part"><span>${profile().itemFields.part}</span>
          <input class="input" data-item="part" data-i="${i}" maxlength="${profile().textLimits.part}" value="${it.part}" placeholder="예: 앞범퍼" autocomplete="off" ${ro ? html`readonly` : ''}></label>
        <label class="cd-sub cd-sub-side"><span>위치</span>
          <input class="input" data-item="side" data-i="${i}" maxlength="${profile().textLimits.side}" value="${it.side}" placeholder="예: 운전석, 좌, 우" autocomplete="off" ${ro ? html`readonly` : ''}></label>
        <div class="cd-sub cd-sub-qty"><span id="cd-qty-l-${i}">${profile().itemFields.qty}</span>
          <div class="cd-qty" role="group" aria-labelledby="cd-qty-l-${i}">
            <button type="button" class="btn cd-qty-btn" data-qty="-1" data-i="${i}" aria-label="${n}번째 부품 수량 하나 줄이기" ${ro ? html`disabled` : ''}>−</button>
            <input class="input cd-qty-input" type="number" inputmode="numeric" min="${profile().qtyMin}" max="${profile().qtyMax}" step="1" data-item="qty" data-i="${i}" value="${it.qty ?? ''}" placeholder="?" aria-label="${n}번째 부품 수량" ${ro ? html`readonly` : ''}>
            <button type="button" class="btn cd-qty-btn" data-qty="1" data-i="${i}" aria-label="${n}번째 부품 수량 하나 늘리기" ${ro ? html`disabled` : ''}>+</button>
          </div>
        </div>
        <label class="cd-sub cd-sub-no"><span>${profile().itemFields.partNo}</span>
          <input class="input" data-item="partNo" data-i="${i}" maxlength="${profile().textLimits.partNo}" value="${it.partNo}" placeholder="담당자 입력" autocomplete="off" spellcheck="false" ${ro ? html`readonly` : ''}></label>
      </div>
      ${flagsView(flags)}
      ${quoteBox(r)}
    </li>`;
  }

  function emptyItemsGuide() {
    if (!editable()) return '등록된 부품이 없습니다.';
    return (card.callType || '주문') === '주문'
      ? '주문을 확정하려면 「부품 추가」로 부품을 한 줄 이상 입력해 주세요.'
      : '부품 없이 처리할 수 있는 통화입니다. 필요한 경우에만 「부품 추가」로 기록하세요.';
  }

  function itemsList(groups) {
    for (const k of [...evMap.keys()]) if (k.startsWith('item:')) evMap.delete(k);
    if (!items.length) return html`<li class="cd-item-empty">${emptyItemsGuide()}</li>`;
    return items.map((it, i) => itemRow(it, i, groups.get(`item:${i}`) || []));
  }

  function itemsSection(groups) {
    return html`<section class="cd-sec cd-items" aria-labelledby="cd-items-h">
      <div class="cd-sec-top">
        <h3 id="cd-items-h">${card.status === 'draft' && items.length ? '품목·수량 확인' : '주문 품목'}</h3><span data-chip="items">${chipFor('items')}</span><span class="cd-saved" data-saved="items" aria-live="polite"></span>
        ${editable() ? html`<button type="button" class="btn btn-sm cd-add" data-act="item-add">부품 추가</button>` : ''}
      </div>
      ${flagsView(groups.get('items'))}
      <ol class="cd-item-list" data-slot="items">${itemsList(groups)}</ol>
    </section>`;
  }

  function urgentBlock(groups) {
    const r = o.resolve(card.evidence?.urgent);
    evMap.set('urgent', r);
    const flags = groups.get('urgent') || [];
    return html`<div class="cd-field ${flags.length ? 'is-unsure' : ''}" data-ev="urgent">
      <div class="cd-field-top">
        <span class="cd-label" id="cd-urgent-l">급함</span>
        <span class="cd-chipslot" data-chip="urgent">${chipFor('urgent')}</span>
        <span class="cd-saved" data-saved="urgent" aria-live="polite"></span>
      </div>
      <div class="cd-input-row" data-slot="urgent">${urgentButton()}${evButton(r, '급함')}</div>
      ${flagsView(flags)}
      ${quoteBox(r)}
    </div>`;
  }
  function urgentButton() {
    const on = Boolean(card.urgent);
    return html`<button type="button" class="btn cd-urgent ${on ? 'is-on' : ''}" data-act="urgent" aria-pressed="${on}" aria-describedby="cd-urgent-l" ${editable() ? '' : html`disabled`}>${on ? '급함 · 켜짐' : '급하지 않음'}</button>`;
  }

  function askView() {
    const list = card.askBack || [];
    const ed = editable();
    return html`<div class="cd-sec-top"><h3 id="cd-ask-h">다시 물어볼 것</h3><span data-chip="askBack">${chipFor('askBack')}</span><span class="cd-saved" data-saved="askBack" aria-live="polite"></span></div>
      ${list.length
    ? html`<ul class="cd-ask-list">${list.map((q, i) => html`<li><span class="cd-ask-text">${askText(q)}</span>${ed ? html`<button type="button" class="btn cd-ask-done" data-resolve="${i}">해결함</button>` : ''}</li>`)}</ul>`
    : html`<p class="cd-ask-none">남은 것이 없습니다.</p>`}
      ${ed ? html`<div class="cd-ask-add"><label class="sr-only" for="cd-ask-new">새로 물어볼 것</label><input id="cd-ask-new" class="input" placeholder="새로 물어볼 것 (예: LED 인지 일반인지)" autocomplete="off"><button type="button" class="btn" data-act="ask-add">추가</button></div>` : ''}`;
  }

  function actionsView(issuesOpen = false) {
    const s = card.status;
    if (s === 'draft' && canEdit) {
      const issues = confirmationIssues(localCard());
      const why = issues.length
        ? html`<details class="cd-confirm-issues" ${issuesOpen ? html`open` : ''}>
          <summary id="cd-confirm-why">확정 전 확인 ${issues.length}건</summary>
          <ul class="cd-why">${issues.map((issue, index) => html`<li><button type="button" class="cd-issue-link" data-act="issue-jump" data-issue="${index}">${issue.message} →</button></li>`)}</ul>
        </details>`
        : html`<p class="cd-action-state">${nothingToShip() ? '확정하면 처리가 완료됩니다.' : '확정하면 출고 대기로 이동합니다.'}</p>`;
      return html`${why}<div class="cd-action-buttons">
        <button type="button" class="btn btn-ghost btn-sm" data-act="cancel">카드 취소</button>
        <button type="button" class="btn btn-primary cd-primary" data-act="confirm" ${issues.length || busy ? html`disabled` : ''} ${issues.length ? html`aria-describedby="cd-confirm-why"` : ''}>${pendingStatus === 'confirm' ? '확정 처리 중…' : '확인하고 확정'}</button>
      </div>`;
    }
    if (s === 'confirmed') {
      return html`<p class="cd-action-state">${nothingToShip() ? '통화 처리 완료' : '출고 대기'}${card.confirmedAt ? ' · 확정 ' + fmtWhen(card.confirmedAt) : ''}</p>
        <div class="cd-action-buttons">
          ${canEdit ? html`<button type="button" class="btn btn-ghost btn-sm" data-act="cancel">카드 취소</button>` : ''}
          ${canEdit ? html`<button type="button" class="btn btn-sm" data-act="reopen">확정 취소 및 수정</button>` : ''}
          ${canShip && !nothingToShip() ? html`<button type="button" class="btn btn-primary cd-primary" data-act="ship">${shipWord()}</button>` : ''}
        </div>`;
    }
    if (s === 'shipped') {
      return html`<p class="cd-action-state">${shipWord()}${card.shippedAt ? ' · ' + fmtWhen(card.shippedAt) : ''}</p>
        ${canShip ? html`<div class="cd-action-buttons"><button type="button" class="btn btn-sm" data-act="unship">출고 되돌리기</button></div>` : ''}`;
    }
    if (s === 'cancelled') {
      return html`<p class="cd-action-state">취소된 카드</p>${canEdit ? html`<div class="cd-action-buttons"><button type="button" class="btn btn-sm" data-act="reopen">취소 되돌리기</button></div>` : ''}`;
    }
    return '';
  }

  function callbackView() {
    if (card.callback) {
      return html`<p class="cd-cb-on"><span class="chip chip-callback">다시 전화할 곳</span> <span>${card.callbackReason || '이유를 적지 않았습니다'}</span></p>
        ${canEdit ? html`<button type="button" class="btn btn-block" data-act="cb-off">다시 전화할 곳에서 빼기</button>` : ''}`;
    }
    if (!canEdit) return '';
    if (cbOpen) {
      const first = (card.askBack || [])[0];
      return html`<label class="field"><span>왜 다시 전화하나요?</span><input id="cd-cb-reason" class="input" value="${first ? askText(first) : ''}" placeholder="예: 품번 확인" autocomplete="off"></label>
        <div class="cd-act-row"><button type="button" class="btn btn-primary" data-act="cb-on">넣기</button><button type="button" class="btn" data-act="cb-cancel">그만두기</button></div>`;
    }
    return html`<button type="button" class="btn btn-sm" data-act="cb-open">${icon('phone')} 다시 전화할 곳에 넣기</button>`;
  }

  function reexView() {
    if (!canEdit) return '';
    const locked = card && card.status !== 'draft';
    const ai = o.meta?.aiEnabled !== false;
    const hasText = Boolean(call.transcript || (call.segments || []).length);
    return html`<button type="button" class="btn btn-sm" data-act="reextract" ${locked || !ai || !hasText || reexBusy ? html`disabled` : ''}>${reexBusy ? html`<span class="spinner" aria-hidden="true"></span> 다시 정리하는 중…` : 'AI로 다시 정리'}</button>
      ${locked ? html`<p class="help">확인 필요 상태로 되돌리면 다시 정리할 수 있습니다.</p>` : ''}
      ${!ai ? html`<p class="help">지금은 AI로 다시 정리할 수 없습니다.</p>` : ''}
      ${!hasText ? html`<p class="help">받아쓴 글이 없어 다시 정리할 수 없습니다.</p>` : ''}
      <details class="cd-card-guide">
        <summary>다시 정리 안내</summary>
        <p>낱말 사전을 반영해 빈칸과 AI 초안 칸을 새로 채웁니다. 사람이 고친 칸은 유지합니다. <a href="#/glossary">낱말 사전 열기</a></p>
      </details>`;
  }

  function otherReason(u) {
    const label = FIELD_LABEL[parseUnsureField(u.field).field];
    return `${label ? `[${label}] ` : ''}${u.reason || '받아쓰기가 틀렸을 수 있습니다. 녹음으로 확인해 주세요.'}`;
  }

  function saveIndicator() {
    if (pendingStatus) return html`<span role="status">${pendingStatus === 'cancel' ? '취소' : '확정'} 처리 중… 아직 완료되지 않았습니다.</span>`;
    if (failure) return html`<button type="button" class="cd-save-link" data-act="save-error">저장 오류 보기</button>`;
    if (!editable()) return html`<span>읽기 전용</span>`;
    return html`<span>${pending.size ? '저장 중…' : '자동 저장'}</span>`;
  }

  function contextView() {
    return html`<button class="cd-context-jump" type="button" data-act="basic-jump" aria-label="${card.customer || '거래처 미입력'}, ${card.carModel || '차종 미입력'}, ${card.plate || '차번호 미입력'} · 차량·거래처 정보 확인"><span class="cd-context-values"><strong>${card.customer || '거래처 미입력'}</strong><span>${card.carModel || '차종 미입력'} · ${card.plate || '차번호 미입력'}</span></span><span class="cd-context-action">정보 확인 <span aria-hidden="true">›</span></span></button>`;
  }

  function renderAll() {
    evMap = new Map();
    if (!card) {
      render(el, html`<header class="cd-card-head cd-pane-title"><h2 id="cd-card-h">주문 카드</h2></header>
        <div class="cd-card-scroll" tabindex="0" role="region" aria-label="주문 카드 내용">
          <p class="notice notice-warn">이 통화에는 아직 주문 카드가 없습니다.${call.error ? ` (${call.error})` : ''}</p>
          <div class="cd-sec cd-reex" data-slot="reex">${reexView()}</div>
        </div>`);
      return;
    }
    const groups = groupUnsure(localCard(), items);
    const other = groups.get('other') || [];
    const scrollTop = el.querySelector('.cd-card-scroll')?.scrollTop || 0;
    const guideOpen = Boolean(el.querySelector('.cd-origin-guide[open]'));
    const actions = actionsView();
    render(el, html`
      <header class="cd-card-head">
        <div class="cd-pane-title"><h2 id="cd-card-h">주문 카드</h2><span data-slot="status">${cardChip(card.status)}</span></div>
        <div class="cd-card-toolbar">
          <div class="cd-save-indicator" data-slot="save-indicator" aria-live="polite">${saveIndicator()}</div>
          ${actions ? html`<button type="button" class="cd-actions-jump" data-act="status-jump" aria-controls="cd-card-actions">처리 버튼 보기</button>` : ''}
        </div>
      </header>
      <div class="cd-card-scroll" tabindex="0" role="region" aria-label="주문 카드 내용">
        <div data-slot="save-status" tabindex="-1" aria-live="polite">${saveStatus()}</div>
        ${card.aiError ? html`<p class="notice notice-warn" role="note">AI 초안을 만들지 못했습니다. 주문 정보를 직접 채워 주세요. ${card.aiError}</p>` : ''}
        <div class="cd-order-context" data-slot="order-context">${contextView()}</div>
        ${itemsSection(groups)}
        <section class="cd-card-section" aria-labelledby="cd-fields-h">
          <div class="cd-sec-top cd-fields-head">
            <h3 id="cd-fields-h">기본 정보</h3>
            <details class="cd-card-guide cd-origin-guide" ${guideOpen ? html`open` : ''}>
              <summary>근거 · 표시 안내</summary>
              <p><span class="chip chip-ai cd-provenance"></span> AI 초안 <span class="chip chip-edited">사람이 고침</span> <span class="chip chip-confirmed">사람이 확인</span></p>
              <p>${icon('evidence')} 칸의 근거를 누르면 ${o.hasAudio ? '해당 녹음이 재생되고 ' : ''}대화의 관련 문장이 표시됩니다. 품번은 통화에서 언급된 경우에만 AI가 채웁니다.</p>
              ${card.aiModel ? html`<p>${card.aiModel}${card.updatedAt ? ` · 마지막 저장 ${fmtWhen(card.updatedAt)}` : ''}</p>` : ''}
            </details>
          </div>
          <div class="cd-grid">${TOP_FIELDS.map((f) => fieldBlock(f, groups))}${typeBlock()}</div>
        </section>
        <section class="cd-sec" aria-labelledby="cd-delivery-h">
          <h3 id="cd-delivery-h">배송 및 요청사항</h3>
          <div class="cd-grid">${WHEN_FIELDS.map((f) => fieldBlock(f, groups))}${urgentBlock(groups)}${fieldBlock(NOTE_FIELD, groups)}</div>
          <datalist id="cd-delivery-list">${DELIVERY_OPTIONS.map((d) => html`<option value="${d}"></option>`)}</datalist>
        </section>
        ${other.length ? html`<section class="cd-sec cd-other-flags" aria-labelledby="cd-other-h"><h3 id="cd-other-h">추가 확인</h3>${flagsView(other.map((x) => ({ ...x, u: { ...x.u, reason: otherReason(x.u) } })))}</section>` : ''}
        <section class="cd-sec cd-ask" aria-labelledby="cd-ask-h" data-slot="ask">${askView()}</section>
        <section class="cd-sec cd-callback" aria-label="다시 전화할 곳" data-slot="callback">${callbackView()}</section>
        <section class="cd-sec cd-reex" aria-label="AI로 다시 정리" data-slot="reex">${reexView()}</section>
      </div>
      ${actions ? html`<section class="cd-actions" id="cd-card-actions" aria-label="카드 상태 바꾸기" data-slot="actions" tabindex="-1">${actions}</section>` : ''}
    `);
    updateInlineIssues();
    el.querySelector('.cd-card-scroll').scrollTop = scrollTop;
    if (activeKey) {
      const b = el.querySelector(`[data-ev="${CSS.escape(activeKey)}"]`);
      if (b) b.classList.add('ev-active'); else activeKey = null;
    }
  }

  /** 입력칸은 그대로 두고 표시(칩 · 상태 · 단추)만 새로 그린다 */
  // 확정·취소할 스냅샷을 보낸 뒤 새 입력이 섞이지 않게 한다. 근거 읽기/듣기는 유지한다.
  const readActions = new Set(['to-trans', 'issue-jump', 'basic-jump', 'status-jump', 'save-error']);
  function lockStatusControls() {
    if (!pendingStatus) return;
    el.setAttribute('aria-busy', 'true');
    for (const control of el.querySelectorAll('input, select, textarea, button')) {
      if (control.matches('button') && !control.matches('[data-qty], [data-del], [data-resolve], [data-review]')
        && (!control.dataset.act || readActions.has(control.dataset.act))) continue;
      if (!statusControls.has(control)) statusControls.set(control, control.disabled);
      control.disabled = true;
    }
  }
  function unlockStatusControls() {
    pendingStatus = null;
    el.removeAttribute('aria-busy');
    for (const [control, disabled] of statusControls) control.disabled = disabled;
    statusControls.clear();
  }
  function refreshDecor() {
    if (!card) return;
    updateInlineIssues();
    const empty = el.querySelector('.cd-item-empty');
    if (empty) empty.textContent = emptyItemsGuide();
    const itemsHeading = el.querySelector('#cd-items-h');
    if (itemsHeading) itemsHeading.textContent = card.status === 'draft' && items.length ? '품목·수량 확인' : '주문 품목';
    if (slot('order-context')) render(slot('order-context'), contextView());
    el.querySelectorAll('[data-chip]').forEach((s) => render(s, html`${chipFor(s.dataset.chip)}`));
    const st = slot('status'); if (st) render(st, cardChip(card.status));
    const ac = slot('actions');
    if (ac) {
      const previous = ac.querySelector('.cd-confirm-issues');
      const focused = previous?.contains(document.activeElement);
      render(ac, actionsView(previous?.open));
      if (focused) ac.querySelector('.cd-confirm-issues summary')?.focus({ preventScroll: true });
    }
    const save = slot('save-status'); if (save) render(save, saveStatus());
    const indicator = slot('save-indicator'); if (indicator) render(indicator, saveIndicator());
    const plate = slot('plate-hint'); if (plate) render(plate, plateHint());
    lockStatusControls();
  }
  function renderItems() {
    const s = slot('items');
    if (s) render(s, html`${itemsList(groupUnsure(localCard(), items))}`);
  }
  function renderAsk() { const s = slot('ask'); if (s) render(s, askView()); }
  function renderCallback() { const s = slot('callback'); if (s) render(s, callbackView()); }
  function renderReex() { const s = slot('reex'); if (s) render(s, reexView()); }
  function renderUrgent() {
    const s = slot('urgent');
    if (!s) return;
    const btn = s.querySelector('[data-act="urgent"]');
    if (btn) btn.outerHTML = urgentButton().toString();
  }

  // ── 저장 ────────────────────────────────────────────────────────
  function saveStatus() {
    if (!failure) return '';
    const diff = latest ? [...pending].map(([key, value]) => {
      const label = FIELD_LABEL[key] || (key === 'callType' ? '통화 종류' : key);
      return html`<li><strong>${label}</strong><br>최신 ${shownValue(key, latest[key])}<br>내 입력 ${shownValue(key, value)}</li>`;
    }) : [];
    return html`<div class="notice notice-error cd-save-error" role="alert">
      <p>${failure.message || '입력을 저장하지 못했습니다.'}</p>
      ${diff.length ? html`<ul>${diff}</ul>` : ''}
      ${latest ? html`<div class="row">
        <button type="button" class="btn" data-act="latest">최신 내용 사용</button>
        ${latest.status === 'draft' ? html`<button type="button" class="btn btn-primary" data-act="apply-mine">내 변경 다시 적용</button>` : ''}
      </div>` : html`<button type="button" class="btn" data-act="retry-save">다시 저장</button>`}
    </div>`;
  }

  function shownValue(key, value) {
    if (key === 'items') return (value || []).map((item) => [item.part, item.qty, item.partNo].filter(Boolean).join(' ')).join(' · ') || '비어 있음';
    if (key === 'urgent') return value ? '급함' : '급하지 않음';
    if (Array.isArray(value)) return value.join(' · ') || '비어 있음';
    return value ?? '비어 있음';
  }

  function issueInput(issue) {
    if (issue.field.startsWith('item:')) {
      const index = items.findIndex((item, i) => 'item:' + itemId(item, i) === issue.field);
      return el.querySelector('[data-item="' + (issue.item || 'part') + '"][data-i="' + index + '"]');
    }
    return el.querySelector('[data-field="' + CSS.escape(issue.field) + '"]');
  }

  function updateInlineIssues() {
    el.querySelectorAll('.cd-input-error').forEach((element) => element.remove());
    el.querySelectorAll('[data-field][aria-invalid], [data-item][aria-invalid]').forEach((input) => {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    });
    if (!editable()) return;
    for (const [index, issue] of confirmationIssues(localCard()).entries()) {
      if (issue.code === 'unsure_left' || issue.code === 'ask_back_left') continue;
      const input = issueInput(issue);
      if (!input) continue;
      const message = document.createElement('p');
      message.id = 'cd-field-error-' + index;
      message.className = 'help cd-input-error';
      message.textContent = issue.message;
      const label = input.closest('.cd-sub') || input.closest('.cd-input-row');
      label?.after(message);
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', message.id);
    }
  }

  function setSaved(keys, state) {
    for (const key of keys) {
      const target = el.querySelector('[data-saved="' + CSS.escape(key) + '"]');
      if (!target) continue;
      clearTimeout(savedTimers.get(key));
      target.classList.toggle('is-fail', state === 'fail');
      target.textContent = state === 'saving' ? '저장 중…' : state === 'ok' ? '저장됨' : state === 'fail' ? '저장 실패' : '';
      if (state === 'ok') savedTimers.set(key, setTimeout(() => { if (target.isConnected) target.textContent = ''; }, 2500));
    }
  }

  function remember() {
    if (!storageKey) return; // 신원이 없으면 현재 화면 메모리에서만 유지한다.
    try {
      if (pending.size) sessionStorage.setItem(storageKey, JSON.stringify({ revision: baseRevision, patch: Object.fromEntries(pending) }));
      else sessionStorage.removeItem(storageKey);
    } catch { /* 저장소를 못 쓰면 열린 화면에서 변경을 유지한다. */ }
  }

  function updateLocalCard() {
    card = { ...savedCard, ...Object.fromEntries(pending) };
  }

  function scheduleSave(ms) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { flush().catch(() => {}); }, ms);
  }

  function stage(patch) {
    if (!editable()) return;
    for (const [key, value] of Object.entries(patch)) pending.set(key, value);
    remember();
    updateLocalCard();
    setSaved(Object.keys(patch), 'saving');
    refreshDecor();
    if (!latest) scheduleSave(1000);
  }

  async function persistPending() {
    if (!pending.size) return;
    const batch = Object.fromEntries(pending);
    const keys = Object.keys(batch);
    try {
      const result = await api.patch('/api/cards/' + encodeURIComponent(o.callId), { ...batch, expectedRevision: baseRevision });
      savedCard = result?.card || savedCard;
      baseRevision = savedCard.revision;
      for (const key of keys) if (pending.get(key) === batch[key]) pending.delete(key);
      remember();
      updateLocalCard();
      retryMs = 2000;
      failure = null;
      latest = null;
      if (alive) {
        setSaved(keys.filter((key) => !pending.has(key)), 'ok');
        refreshDecor();
        o.onCardChange(savedCard, { fields: keys });
      }
    } catch (e) {
      failure = e;
      if (alive && (e.code === 'card_conflict' || e.code === 'locked')) {
        try { latest = (await api.get('/api/calls/' + encodeURIComponent(o.callId)))?.card || null; }
        catch { latest = null; }
      }
      if (alive) {
        setSaved(keys, 'fail');
        refreshDecor();
        if (e.status === 0 || e.status === 429 || e.status >= 500) {
          scheduleSave(retryMs);
          retryMs = Math.min(retryMs * 2, 30000);
        }
      }
      throw e;
    }
  }

  async function flush() {
    clearTimeout(saveTimer);
    const next = chain.then(async () => {
      if (latest && pending.size) throw failure;
      while (pending.size) await persistPending();
    });
    chain = next.catch(() => {});
    return next;
  }

  function resolveConflict(applyMine) {
    if (!latest) return;
    savedCard = latest;
    baseRevision = latest.revision;
    if (!applyMine) pending.clear();
    latest = null;
    failure = null;
    remember();
    updateLocalCard();
    items = cloneItems(card.items);
    renderAll();
    o.onCardChange(savedCard, { fields: ['all'] });
    if (applyMine) flush().catch(() => {});
  }

  function saveItems() { stage({ items: itemsForSave(items) }); }

  function saveText(input) {
    if (!editable()) return;
    const key = input.dataset.field;
    const value = input.value.trim() || null;
    if (value !== card[key]) stage({ [key]: value });
  }

  function changeQty(i, delta) {
    if (!editable() || !items[i]) return;
    const { qtyMin, qtyMax } = profile();
    const qty = Number(items[i].qty);
    items[i].qty = Math.min(qtyMax, Math.max(qtyMin, (Number.isFinite(qty) ? Math.round(qty) : 0) + delta));
    const input = el.querySelector('input[data-item="qty"][data-i="' + i + '"]');
    if (input) input.value = String(items[i].qty);
    saveItems();
  }

  async function deleteItem(i) {
    if (!editable() || !items[i]) return;
    const item = items[i];
    const named = item.part || item.partNo;
    if (named && !(await confirmBox((i + 1) + '번째 부품 줄(' + named + ')을 지울까요?'))) return;
    if (!alive || !editable()) return;
    items.splice(i, 1);
    if (activeKey?.startsWith('item:')) activeKey = null;
    renderItems();
    saveItems();
    // 삭제된 버튼 대신 이어서 편집할 품목으로 키보드 동선을 잇는다.
    const target = items.length
      ? el.querySelector('input[data-item="part"][data-i="' + Math.min(i, items.length - 1) + '"]')
      : el.querySelector('[data-act="item-add"]');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }

  function addItem() {
    if (!editable()) return;
    const id = 'item_' + (globalThis.crypto?.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join(''));
    items.push({ id, part: '', side: '', qty: 1, partNo: '', quote: null, at: null, seg: null });
    renderItems();
    saveItems();
    el.querySelector('input[data-item="part"][data-i="' + (items.length - 1) + '"]')?.focus();
  }

  function setAsk(list) {
    if (!editable()) return;
    stage({ askBack: list });
    renderAsk();
  }

  function warn(response) {
    const warnings = response?.warnings;
    if (Array.isArray(warnings) && warnings.length) toast(warnings.join(' / '), 'info');
  }

  function handleOnline() {
    if (pending.size) flush().catch(() => {});
  }

  function handleUnload(event) {
    if (!pending.size) return;
    event.preventDefault();
    event.returnValue = '';
  }

  // ── 상태 바꾸기 · 다시 전화 · 다시 정리 ──────────────────────────
  function reasonBox(title) {
    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.setAttribute('aria-labelledby', 'cd-reason-title');
    render(dialog, html`<form method="dialog" class="dialog-body">
      <h2 id="cd-reason-title">${title}</h2>
      <label class="field"><span>사유</span><input class="input" name="reason" required pattern=".*[^ ].*" maxlength="300" autofocus></label>
      <div class="row"><button class="btn" value="back" formnovalidate>돌아가기</button><button class="btn btn-primary" value="ok">확인</button></div>
    </form>`);
    document.body.append(dialog);
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => {
        const value = dialog.returnValue === 'ok' ? dialog.querySelector('input').value.trim() : null;
        dialog.remove();
        resolve(value);
      }, { once: true });
      dialog.showModal();
    });
  }

  async function setStatus(action, btn) {
    if (busy || reexBusy) return;
    busy = true;
    if (btn) btn.disabled = true;
    if (action === 'confirm') { pendingStatus = 'confirm'; refreshDecor(); }
    let statusFailed = false;
    let reasonDismissed = false;
    try {
      let reason;
      if (action === 'cancel' || (action === 'reopen' && card.status === 'confirmed')) {
        reason = await reasonBox(action === 'cancel' ? '카드 취소' : '확정 취소 및 수정');
        if (!reason) { reasonDismissed = true; return; }
      }
      if (action === 'ship' && !(await confirmBox('이 카드를 ' + shipWord() + '로 바꿀까요?'))) return;
      if (action === 'unship' && !(await confirmBox('출고 완료를 되돌릴까요? 카드는 확정 상태로 돌아갑니다.'))) return;
      if (!alive) return;
      if (action === 'cancel') { pendingStatus = 'cancel'; refreshDecor(); }
      await flush();
      const result = await api.post('/api/cards/' + encodeURIComponent(o.callId) + '/' + action, { reason, expectedRevision: savedCard?.revision });
      if (!alive) return;
      if (result?.card) {
        savedCard = result.card;
        baseRevision = savedCard.revision;
        updateLocalCard();
        items = cloneItems(card.items);
      }
      unlockStatusControls();
      busy = false;
      renderAll();
      o.onCardChange(savedCard, { fields: ['status'] });
      const message = action === 'confirm' && nothingToShip() ? '확정했습니다. 처리한 통화로 표시됩니다.' : DONE_MSG[action];
      toast(message || '상태를 바꿨습니다.', 'ok');
    } catch (e) {
      statusFailed = action === 'confirm' || action === 'cancel';
      unlockStatusControls();
      if (alive) {
        toast(e?.message || '상태를 바꾸지 못했습니다.', 'error');
        focusIssue();
      }
    } finally {
      unlockStatusControls();
      busy = false;
      if (alive) {
        const active = document.activeElement;
        const returnToAction = (statusFailed || reasonDismissed) && (active === document.body || active?.dataset?.act === action);
        refreshDecor();
        if (returnToAction) el.querySelector(`[data-act="${action}"]`)?.focus({ preventScroll: true });
      }
    }
  }

  function focusIssue() {
    const first = confirmationIssues(localCard())[0];
    if (!first) return;
    issueInput(first)?.focus();
  }

  async function reviewWarning(id, button) {
    if (busy || !editable()) return;
    busy = true;
    button.disabled = true;
    try {
      await flush();
      const result = await api.post('/api/cards/' + encodeURIComponent(o.callId) + '/review', { id, expectedRevision: savedCard?.revision });
      if (!alive) return;
      savedCard = result.card;
      baseRevision = savedCard.revision;
      updateLocalCard();
      busy = false;
      renderAll();
      o.onCardChange(savedCard, { fields: ['unsure'] });
      toast('사람이 확인한 항목으로 표시했습니다.', 'ok');
    } catch (e) {
      if (alive) toast(e?.message || '확인 표시를 저장하지 못했습니다.', 'error');
    } finally {
      busy = false;
      if (button.isConnected) button.disabled = false;
      if (alive) refreshDecor();
    }
  }

  async function setCallback(on) {
    if (busy || !canEdit) return;
    busy = true;
    const reason = on ? (el.querySelector('#cd-cb-reason')?.value || '').trim() : null;
    const next = chain.then(async () => {
      const result = await api.post('/api/cards/' + encodeURIComponent(o.callId) + '/callback', { on, reason: reason || null });
      if (!pending.size || result.card.revision <= (savedCard?.revision ?? -1) + 1) baseRevision = result.card.revision;
      savedCard = result.card;
      updateLocalCard();
    });
    chain = next.catch(() => {});
    try {
      await next;
      if (!alive) return;
      cbOpen = false;
      renderCallback();
      o.onCardChange(savedCard, { fields: ['callback'] });
      toast(on ? '다시 전화할 곳에 넣었습니다.' : '다시 전화할 곳에서 뺐습니다.', 'ok');
    } catch (e) {
      if (alive) toast(e?.message || '재연락 표시를 바꾸지 못했습니다.', 'error');
    } finally {
      busy = false;
      if (alive) refreshDecor();
    }
  }
  async function reextract() {
    if (reexBusy || busy) return;
    const ok = await confirmBox('AI 로 이 통화의 카드를 다시 정리할까요? 낱말 사전에 고친 낱말이 반영됩니다. 손으로 고친(「사람이 고침」) 칸은 그대로 두고, 빈칸과 AI 초안 칸만 새로 채웁니다.');
    if (!ok || !alive || busy || reexBusy) return;
    reexBusy = true;
    renderReex();
    try {
      await flush();
      const r = await api.post(`/api/calls/${encodeURIComponent(o.callId)}/reextract`);
      if (!alive) return;
      warn(r);
      reexBusy = false;
      if (r?.call) {
        o.onCallReplaced(r.call);
      } else if (r?.card) {
        savedCard = r.card; baseRevision = savedCard.revision; updateLocalCard(); items = cloneItems(card.items); renderAll();
        o.onCardChange(card, { fields: ['all'] });
      }
      const err = r?.call?.card?.aiError || r?.card?.aiError;
      toast(err ? `다시 정리하지 못했습니다: ${err}` : '카드를 다시 정리했습니다. 새 초안을 확인해 주세요.', err ? 'error' : 'ok');
    } catch (e) {
      if (alive) toast(e?.message || '다시 정리하지 못했습니다.', 'error');
    } finally {
      reexBusy = false;
      if (alive) renderReex();
    }
  }

  // ── 근거 고르기(F05) ─────────────────────────────────────────────
  function setActive(block) {
    el.querySelectorAll('.ev-active').forEach((b) => { if (b !== block) b.classList.remove('ev-active'); });
    if (block) { block.classList.add('ev-active'); activeKey = block.dataset.ev; } else activeKey = null;
  }
  function selectBlock(block, play) {
    setActive(block);
    const r = evMap.get(block.dataset.ev) || null;
    o.onEvidence(r, { play, scroll: true });
  }

  // ── 이벤트 ──────────────────────────────────────────────────────
  function onClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const act = t.closest('[data-act]');
    if (act && el.contains(act)) { handleAct(act.dataset.act, act); return; }
    const review = t.closest('[data-review]');
    if (review) { reviewWarning(review.dataset.review, review); return; }
    const flag = t.closest('[data-flag]');
    if (flag) {
      const u = card?.unsure?.find((warning) => warning.id === flag.dataset.flag);
      setActive(flag.closest('[data-ev]'));
      const r = o.resolve(u);
      if (r) o.onEvidence(r, { play: true, scroll: true });
      else toast('이 표시의 근거 대목을 찾지 못했습니다. 통화 글에서 직접 확인해 주세요.');
      return;
    }
    const q = t.closest('[data-qty]');
    if (q) { changeQty(Number(q.dataset.i), Number(q.dataset.qty)); return; }
    const del = t.closest('[data-del]');
    if (del) { deleteItem(Number(del.dataset.del)); return; }
    const res = t.closest('[data-resolve]');
    if (res) {
      const list = [...(card.askBack || [])];
      list.splice(Number(res.dataset.resolve), 1);
      setAsk(list);
      return;
    }
    const block = t.closest('[data-ev]');
    if (!block || !el.contains(block)) return;
    const play = t.closest('.ev-play');
    if (!play && t.closest('button, a')) return;
    // 이미 고른 칸을 고치려고 다시 누른 것이면 녹음을 처음부터 다시 틀지 않는다
    // 편집과 근거 확인을 분리: 입력 클릭은 값 편집만, 명시적 근거 버튼만 재생/이동한다.
    if (!play) return;
    selectBlock(block, true);
  }

  function handleAct(act, btn) {
    if (pendingStatus && !readActions.has(act)) return;
    switch (act) {
      case 'to-trans': o.onJumpToTranscript(activeKey ? evMap.get(activeKey) : null); break;
      case 'issue-jump': {
        const issue = confirmationIssues(localCard())[Number(btn.dataset.issue)];
        if (!issue) break;
        const target = issue.code === 'ask_back_left' ? el.querySelector('[data-resolve]') || el.querySelector('#cd-ask-new') : issue.code === 'unsure_left' ? el.querySelector('[data-review]') : issue.field === 'items' ? el.querySelector('[data-act="item-add"]') : issueInput(issue);
        target?.scrollIntoView({block:'center'}); target?.focus({preventScroll:true}); break;
      }
      case 'basic-jump': { const input = el.querySelector('[data-field="customer"]'); input?.scrollIntoView({block:'center'}); input?.focus({preventScroll:true}); break; }
      case 'status-jump': slot('actions')?.focus(); break;
      case 'save-error': slot('save-status')?.focus(); break;
      case 'item-add': addItem(); break;
      case 'urgent':
        if (!editable()) return;
        stage({ urgent: !card.urgent });
        renderUrgent();
        break;
      case 'ask-add': {
        const input = el.querySelector('#cd-ask-new');
        const v = (input?.value || '').trim();
        if (!v) { input?.focus(); toast('물어볼 것을 적은 뒤 「추가」를 누르세요.'); return; }
        setAsk([...(card.askBack || []), v]);
        el.querySelector('#cd-ask-new')?.focus();
        break;
      }
      case 'confirm': case 'ship': case 'unship': case 'reopen': case 'cancel': setStatus(act, btn); break;
      case 'retry-save': flush().catch(() => focusIssue()); break;
      case 'latest': resolveConflict(false); break;
      case 'apply-mine': resolveConflict(true); break;
      case 'cb-open':
        cbOpen = true; renderCallback();
        el.querySelector('#cd-cb-reason')?.focus();
        break;
      case 'cb-cancel': cbOpen = false; renderCallback(); break;
      case 'cb-on': setCallback(true); break;
      case 'cb-off': setCallback(false); break;
      case 'reextract': reextract(); break;
      default: break;
    }
  }

  function onInput(e) {
    const t = e.target;
    if (!(t instanceof Element) || !editable() || e.isComposing) return;
    if (t.dataset.field) { saveText(t); return; }
    if (!t.dataset.item) return;
    const i = Number(t.dataset.i);
    const sub = t.dataset.item;
    if (!items[i]) return;
    const value = t.value.trim();
    const nextValue = sub === 'qty' ? (value === '' ? null : Number(value)) : sub === 'partNo' ? normalizePartNo(value) : value;
    // input 뒤 blur/change가 같은 값을 다시 보내면 확정 버튼을 교체하지 않는다.
    if (Object.is(items[i][sub], nextValue)) return;
    items[i][sub] = nextValue;
    if (sub === 'part') {
      const title = t.closest('.cd-item')?.querySelector('.cd-item-title');
      if (title) title.textContent = value || '새 부품';
    }
    saveItems();
  }

  function onKeydown(e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.id === 'cd-ask-new') { e.preventDefault(); handleAct('ask-add'); return; }
    if (t.id === 'cd-cb-reason') { e.preventDefault(); setCallback(true); return; }
    if (t.matches('input[data-field], input[data-item]')) { e.preventDefault(); t.blur(); }
  }

  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onInput);
  el.addEventListener('compositionend', onInput);
  window.addEventListener('online', handleOnline);
  window.addEventListener('beforeunload', handleUnload);
  if (editable() && storageKey) {
    try {
      const restored = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
      for (const [key, value] of Object.entries(restored.patch || {})) pending.set(key, value);
      if (pending.size && Number.isSafeInteger(restored.revision)) baseRevision = restored.revision;
      updateLocalCard();
      if (pending.has('items')) items = cloneItems(card.items);
      if (pending.size) scheduleSave(1000);
    } catch { /* 저장된 변경이 없으면 서버 값으로 시작한다. */ }
  }
  el.addEventListener('keydown', onKeydown);
  renderAll();

  return {
    /** 지금 카드(저장된 값) */
    get card() { return card; },
    /** 다시 정리 · 새로 읽기로 통화가 바뀌었을 때 */
    update(newCall) {
      call = newCall;
      savedCard = newCall.card || null;
      if (!pending.size) baseRevision = savedCard?.revision;
      if (savedCard) updateLocalCard();
      else card = null;
      items = cloneItems(card?.items);
      cbOpen = false;
      renderAll();
    },
    flush,
    destroy() {
      disposeControls(el);
      alive = false;
      if (pending.size) flush().catch(() => {});
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleUnload);
      for (const tm of savedTimers.values()) clearTimeout(tm);
      el.removeEventListener('click', onClick);
      el.removeEventListener('input', onInput);
      el.removeEventListener('change', onInput);
      el.removeEventListener('compositionend', onInput);
      el.removeEventListener('keydown', onKeydown);
    },
  };
}
