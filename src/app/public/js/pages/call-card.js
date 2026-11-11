// 통화 상세의 주문 카드(F04 · F05 · F06 · F07 다시 정리 · F11): 칸 고치기 · 근거 듣기 · 확정 · 출고 · 다시 전화 · 다시 정리.
// call.js 만 쓴다. 칸을 고치면 칸에서 벗어날 때(change) PATCH 로 저장하고, 입력칸은 다시 그리지 않아 커서를 잃지 않는다.
import { api } from '../api.js';
import { html, render, toast, confirmBox, fmtSec, fmtWhen, cardChip } from '../ui.js';
import { groupUnsure, cloneItems, itemsForSave, num, parseUnsureField, FIELD_LABEL } from './call-util.js';

const TOP_FIELDS = [
  { key: 'customer', label: '거래처', ph: '통화에서 말한 거래처' },
  { key: 'contact', label: '담당자', ph: '예: 김 실장' },
  { key: 'carModel', label: '차종', ph: '예: 아반떼 AD' },
  { key: 'modelYear', label: '연식', ph: '예: 2017', mode: 'numeric' },
  { key: 'plate', label: '차번호', ph: '예: 12가 3456' },
];
/** 통화 종류(카드에 callType 이 있을 때만 보인다) */
const CALL_TYPES = ['주문', '배송 문의', '반품·교환', '재고·단가 문의', '기타'];
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
};
const askText = (q) => (typeof q === 'string' ? q : q?.text ?? q?.question ?? JSON.stringify(q));

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
  let call = o.call;
  let card = call.card || null;
  let items = cloneItems(card?.items);
  let chain = Promise.resolve();
  let alive = true;
  let busy = false;
  let reexBusy = false;
  let cbOpen = false;
  let activeKey = null;
  let itemsTimer = null;
  const savedTimers = new Map();
  let evMap = new Map();

  const editable = () => Boolean(card) && card.status === 'draft';
  const slot = (name) => el.querySelector(`[data-slot="${name}"]`);

  // ── 그리기 ──────────────────────────────────────────────────────
  function chipFor(key) {
    if (!card || !card.aiDraft) return '';
    if ((card.edited || []).includes(key)) return html`<span class="chip chip-edited">고침</span>`;
    const v = key === 'items' ? items.length : key === 'askBack' ? (card.askBack || []).length : card[key];
    if (v === null || v === undefined || v === '' || v === 0 || v === false) return '';
    return html`<span class="chip chip-ai">AI 초안</span>`;
  }

  function evButton(r, label) {
    if (!r || (r.at === null && r.segIndex < 0)) return '';
    const t = r.at !== null ? fmtSec(r.at) : '';
    const what = o.hasAudio ? `${label} 근거 대목${t ? ` ${t}부터` : ''} 듣기` : `${label} 근거 문장 보기`;
    return html`<button type="button" class="btn cd-evbtn ev-play" aria-label="${what}" title="${what}">${o.hasAudio ? '▶' : '근거'}${t ? html` <span class="cd-evtime">${t}</span>` : ''}</button>`;
  }

  function quoteBox(r) {
    if (!r || !r.quote) return '';
    return html`<div class="cd-quote">
      <span class="cd-quote-label">근거</span>
      <q class="cd-quote-text">${r.quote}</q>${r.at !== null ? html` <span class="cd-quote-time">${fmtSec(r.at)}</span>` : ''}
      <button type="button" class="btn btn-ghost cd-to-trans" data-act="to-trans">통화 글에서 보기</button>
    </div>`;
  }

  function flagsView(list) {
    if (!list || !list.length) return '';
    return html`<div class="cd-flags">${list.map(({ u, idx }) => html`<div class="cd-flag-row">
      <button type="button" class="listen-flag cd-flag" data-flag="${idx}" aria-label="받아쓰기가 틀렸을 수 있는 곳 들어 보기">⚠ 들어 보기${num(u.at) !== null ? ` ${fmtSec(u.at)}` : ''}</button>
      <span class="cd-flag-why">${u.reason || '받아쓰기가 틀렸을 수 있습니다. 녹음으로 확인해 주세요.'}</span>
    </div>`)}</div>`;
  }

  function fieldBlock(f, groups) {
    const r = o.resolve(card.evidence?.[f.key]);
    evMap.set(f.key, r);
    const flags = groups.get(f.key) || [];
    const id = `cf-${f.key}`;
    const ro = !editable();
    const value = card[f.key] ?? '';
    return html`<div class="cd-field ${f.wide ? 'cd-field-wide' : ''} ${flags.length ? 'is-unsure' : ''}" data-ev="${f.key}">
      <div class="cd-field-top">
        <label class="cd-label" for="${id}">${f.label}</label>
        <span class="cd-chipslot" data-chip="${f.key}">${chipFor(f.key)}</span>
        ${f.key === 'customer' && card.customerByPhone ? html`<span class="chip chip-phone" title="걸려 온 번호가 거래처 목록의 번호와 같아 그 이름으로 채웠습니다">번호로 확인</span>` : ''}
        <span class="cd-saved" data-saved="${f.key}" aria-live="polite"></span>
      </div>
      <div class="cd-input-row">
        ${f.textarea
    ? html`<textarea id="${id}" class="textarea" data-field="${f.key}" rows="2" placeholder="${f.ph}" ${ro ? html`readonly` : ''}>${value}</textarea>`
    : html`<input id="${id}" class="input" data-field="${f.key}" value="${value}" placeholder="${f.ph}" autocomplete="off" spellcheck="false" ${f.mode ? html`inputmode="${f.mode}"` : ''} ${f.list ? html`list="${f.list}"` : ''} ${ro ? html`readonly` : ''}>`}
        ${evButton(r, f.label)}
      </div>
      ${flagsView(flags)}
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
        <span class="cd-item-title">${it.part || '새 부품'}</span>
        ${evButton(r, `${n}번째 부품`)}
        ${ro ? '' : html`<button type="button" class="btn btn-ghost cd-item-del" data-del="${i}" aria-label="${n}번째 부품 줄 지우기">지우기</button>`}
      </div>
      <div class="cd-item-grid">
        <label class="cd-sub cd-sub-part"><span>부품 이름</span>
          <input class="input" data-item="part" data-i="${i}" value="${it.part}" placeholder="예: 앞범퍼" autocomplete="off" ${ro ? html`readonly` : ''}></label>
        <label class="cd-sub cd-sub-side"><span>위치</span>
          <input class="input" data-item="side" data-i="${i}" value="${it.side}" placeholder="예: 운전석, 좌, 우" autocomplete="off" ${ro ? html`readonly` : ''}></label>
        <div class="cd-sub cd-sub-qty"><span id="cd-qty-l-${i}">수량</span>
          <div class="cd-qty" role="group" aria-labelledby="cd-qty-l-${i}">
            <button type="button" class="btn cd-qty-btn" data-qty="-1" data-i="${i}" aria-label="${n}번째 부품 수량 하나 줄이기" ${ro ? html`disabled` : ''}>−</button>
            <input class="input cd-qty-input" type="number" inputmode="numeric" min="1" max="999" data-item="qty" data-i="${i}" value="${it.qty ?? ''}" placeholder="?" aria-label="${n}번째 부품 수량" ${ro ? html`readonly` : ''}>
            <button type="button" class="btn cd-qty-btn" data-qty="1" data-i="${i}" aria-label="${n}번째 부품 수량 하나 늘리기" ${ro ? html`disabled` : ''}>+</button>
          </div>
        </div>
        <label class="cd-sub cd-sub-no"><span>품번</span>
          <input class="input" data-item="partNo" data-i="${i}" value="${it.partNo}" placeholder="담당자 입력" autocomplete="off" spellcheck="false" ${ro ? html`readonly` : ''}></label>
      </div>
      ${flagsView(flags)}
      ${quoteBox(r)}
    </li>`;
  }

  function itemsList(groups) {
    for (const k of [...evMap.keys()]) if (k.startsWith('item:')) evMap.delete(k);
    if (!items.length) return html`<li class="cd-item-empty">부품이 아직 없습니다.${editable() ? ' 「부품 줄 추가」로 넣어 주세요.' : ''}</li>`;
    return items.map((it, i) => itemRow(it, i, groups.get(`item:${i}`) || []));
  }

  function itemsSection(groups) {
    return html`<section class="cd-sec cd-items" aria-labelledby="cd-items-h">
      <div class="cd-sec-top"><h3 id="cd-items-h">부품</h3><span data-chip="items">${chipFor('items')}</span><span class="cd-saved" data-saved="items" aria-live="polite"></span></div>
      ${flagsView(groups.get('items'))}
      <ol class="cd-item-list" data-slot="items">${itemsList(groups)}</ol>
      ${editable() ? html`<button type="button" class="btn btn-block cd-add" data-act="item-add">+ 부품 줄 추가</button>` : ''}
      <p class="help">품번은 통화에서 불러 준 것만 AI 가 적습니다. 비어 있으면 담당자가 넣어 주세요.</p>
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
      <p class="help">통화에서 묻고 답이 정해지지 않은 것입니다. 거래처에 확인했으면 「해결함」을 누르세요.</p>
      ${list.length
    ? html`<ul class="cd-ask-list">${list.map((q, i) => html`<li><span class="cd-ask-text">${askText(q)}</span>${ed ? html`<button type="button" class="btn cd-ask-done" data-resolve="${i}">해결함</button>` : ''}</li>`)}</ul>`
    : html`<p class="cd-ask-none">남은 것이 없습니다.</p>`}
      ${ed ? html`<div class="cd-ask-add"><label class="sr-only" for="cd-ask-new">새로 물어볼 것</label><input id="cd-ask-new" class="input" placeholder="새로 물어볼 것 (예: LED 인지 일반인지)" autocomplete="off"><button type="button" class="btn" data-act="ask-add">추가</button></div>` : ''}`;
  }

  function actionsView() {
    const s = card.status;
    const n = (card.askBack || []).length;
    if (s === 'draft') {
      return html`${n
        ? html`<p class="notice notice-warn cd-why" id="cd-confirm-why">다시 물어볼 것이 ${n}개 남아 있어 아직 확정할 수 없습니다. 거래처에 확인한 뒤 「해결함」을 눌러 주세요.</p>`
        : html`<p class="cd-why-ok">칸을 모두 확인했으면 확정하세요. 확정한 주문만 출고 목록에 올라갑니다.</p>`}
        <button type="button" class="btn btn-ok btn-lg btn-block" data-act="confirm" ${n ? html`aria-describedby="cd-confirm-why"` : ''}>✓ 확인하고 확정</button>`;
    }
    if (s === 'confirmed') {
      return html`<p class="notice notice-ok">확정됨${card.confirmedAt ? ` · ${fmtWhen(card.confirmedAt)}` : ''} — 출고 목록에 올라 있습니다.</p>
        <div class="cd-act-row"><button type="button" class="btn btn-primary btn-lg" data-act="ship">출고 완료</button><button type="button" class="btn btn-lg" data-act="reopen">다시 고치기</button></div>`;
    }
    if (s === 'shipped') {
      return html`<p class="notice notice-ok">출고 완료${card.shippedAt ? ` · ${fmtWhen(card.shippedAt)}` : ''}</p>
        <button type="button" class="btn btn-lg btn-block" data-act="reopen">출고 되돌리기</button>`;
    }
    if (s === 'cancelled') {
      return html`<p class="notice">취소된 주문입니다.</p><button type="button" class="btn btn-lg btn-block" data-act="reopen">취소 되돌리기</button>`;
    }
    return '';
  }

  function callbackView() {
    if (card.callback) {
      return html`<p class="cd-cb-on"><span class="chip chip-callback">다시 전화할 곳</span> <span>${card.callbackReason || '이유를 적지 않았습니다'}</span></p>
        <button type="button" class="btn btn-block" data-act="cb-off">다시 전화할 곳에서 빼기</button>`;
    }
    if (cbOpen) {
      const first = (card.askBack || [])[0];
      return html`<label class="field"><span>왜 다시 전화하나요?</span><input id="cd-cb-reason" class="input" value="${first ? askText(first) : ''}" placeholder="예: 품번 확인" autocomplete="off"></label>
        <div class="cd-act-row"><button type="button" class="btn btn-primary" data-act="cb-on">넣기</button><button type="button" class="btn" data-act="cb-cancel">그만두기</button></div>`;
    }
    return html`<button type="button" class="btn btn-block" data-act="cb-open">☎ 다시 전화할 곳에 넣기</button>`;
  }

  function reexView() {
    const locked = card && card.status !== 'draft';
    const ai = o.meta?.aiEnabled !== false;
    const hasText = Boolean(call.transcript || (call.segments || []).length);
    return html`<h3>AI 로 다시 정리</h3>
      <p class="help">낱말 사전(현장 말 · 거래처 · 차종)을 고친 뒤 누르면, 고친 낱말을 반영해 카드를 새로 만듭니다. 손으로 고친 칸은 새 초안으로 바뀝니다. <a href="#/glossary">낱말 사전 열기</a></p>
      ${locked ? html`<p class="notice notice-warn">${card.statusLabel || '확정'} 상태의 카드는 먼저 위의 「${({ confirmed: '다시 고치기', shipped: '출고 되돌리기', cancelled: '취소 되돌리기' })[card.status] || '되돌리기'}」로 확인 필요 상태로 돌린 뒤 다시 정리할 수 있습니다.</p>` : ''}
      ${!ai ? html`<p class="notice notice-warn">AI 키 없음 — 지금은 다시 정리를 할 수 없습니다.</p>` : ''}
      ${!hasText ? html`<p class="notice">받아쓴 글이 없어 다시 정리할 수 없습니다.</p>` : ''}
      <button type="button" class="btn btn-block" data-act="reextract" ${locked || !ai || !hasText || reexBusy ? html`disabled` : ''}>${reexBusy ? html`<span class="spinner" aria-hidden="true"></span> 다시 정리하는 중… (10~30초)` : 'AI 로 다시 정리'}</button>`;
  }

  function otherReason(u) {
    const label = FIELD_LABEL[parseUnsureField(u.field).field];
    return `${label ? `[${label}] ` : ''}${u.reason || '받아쓰기가 틀렸을 수 있습니다. 녹음으로 확인해 주세요.'}`;
  }

  function lockNotice() {
    if (card.status === 'confirmed') return html`<p class="notice notice-ok cd-lock">확정된 카드입니다. 고치려면 아래 「다시 고치기」를 누르세요.</p>`;
    if (card.status === 'shipped') return html`<p class="notice notice-ok cd-lock">출고까지 끝난 카드입니다. 고치려면 아래 「출고 되돌리기」를 누르세요.</p>`;
    if (card.status === 'cancelled') return html`<p class="notice cd-lock">취소된 주문입니다. 고치려면 아래 「취소 되돌리기」를 누르세요.</p>`;
    return '';
  }

  function renderAll() {
    evMap = new Map();
    if (!card) {
      render(el, html`<div class="cd-card-head"><h2 id="cd-card-h">주문 카드</h2></div>
        <p class="notice notice-warn">이 통화에는 아직 주문 카드가 없습니다.${call.error ? ` (${call.error})` : ''}</p>
        <div class="cd-sec cd-reex" data-slot="reex">${reexView()}</div>`);
      return;
    }
    const groups = groupUnsure(card, items);
    const other = groups.get('other') || [];
    render(el, html`
      <div class="cd-card-head"><h2 id="cd-card-h">주문 카드</h2><span data-slot="status">${cardChip(card.status)}</span></div>
      <p class="cd-card-sub">AI 가 채운 칸은 <span class="chip chip-ai">AI 초안</span>, 사람이 고친 칸은 <span class="chip chip-edited">고침</span> 입니다. 칸을 누르면 그 말을 한 대목이 ${o.hasAudio ? '들리고 ' : ''}통화 글에 표시됩니다.</p>
      ${card.aiError ? html`<p class="notice notice-warn" role="note">카드를 AI 가 만들지 못했습니다(${card.aiError}) — 직접 채워 주세요.</p>` : ''}
      ${lockNotice()}
      ${other.length ? html`<div class="cd-sec cd-other-flags"><h3>들어 볼 곳</h3>${flagsView(other.map((x) => ({ ...x, u: { ...x.u, reason: otherReason(x.u) } })))}</div>` : ''}
      <div class="cd-grid">${typeBlock()}${TOP_FIELDS.map((f) => fieldBlock(f, groups))}</div>
      ${itemsSection(groups)}
      <div class="cd-grid">${urgentBlock(groups)}${WHEN_FIELDS.map((f) => fieldBlock(f, groups))}</div>
      <datalist id="cd-delivery-list">${DELIVERY_OPTIONS.map((d) => html`<option value="${d}"></option>`)}</datalist>
      <section class="cd-sec cd-ask" aria-labelledby="cd-ask-h" data-slot="ask">${askView()}</section>
      <div class="cd-grid">${fieldBlock(NOTE_FIELD, groups)}</div>
      ${card.aiModel ? html`<p class="cd-model">AI 초안: ${card.aiModel}${card.updatedAt ? ` · 마지막 저장 ${fmtWhen(card.updatedAt)}` : ''}</p>` : ''}
      <section class="cd-sec cd-actions" aria-label="카드 상태 바꾸기" data-slot="actions">${actionsView()}</section>
      <section class="cd-sec cd-callback" aria-label="다시 전화할 곳" data-slot="callback">${callbackView()}</section>
      <section class="cd-sec cd-reex" data-slot="reex">${reexView()}</section>
    `);
    if (activeKey) {
      const b = el.querySelector(`[data-ev="${CSS.escape(activeKey)}"]`);
      if (b) b.classList.add('ev-active'); else activeKey = null;
    }
  }

  /** 입력칸은 그대로 두고 표시(칩 · 상태 · 단추)만 새로 그린다 */
  function refreshDecor() {
    if (!card) return;
    el.querySelectorAll('[data-chip]').forEach((s) => render(s, html`${chipFor(s.dataset.chip)}`));
    const st = slot('status'); if (st) render(st, cardChip(card.status));
    const ac = slot('actions'); if (ac) render(ac, actionsView());
  }
  function renderItems() {
    const s = slot('items');
    if (s) render(s, html`${itemsList(groupUnsure(card, items))}`);
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
  function enqueue(fn) {
    const p = chain.then(fn, fn);
    chain = p.catch(() => {});
    return p;
  }
  function setSaved(keys, state) {
    for (const k of keys) {
      const s = el.querySelector(`[data-saved="${CSS.escape(k)}"]`);
      if (!s) continue;
      clearTimeout(savedTimers.get(k));
      s.classList.toggle('is-fail', state === 'fail');
      s.textContent = state === 'saving' ? '저장 중…' : state === 'ok' ? '✓ 저장됨' : state === 'fail' ? '저장 못 함' : '';
      if (state === 'ok') savedTimers.set(k, setTimeout(() => { if (s.isConnected) s.textContent = ''; }, 2500));
    }
  }
  function warn(r) {
    const w = r?.warnings;
    if (Array.isArray(w) && w.length) toast(w.map((x) => (typeof x === 'string' ? x : x?.message || '')).filter(Boolean).join(' / '), 'info');
  }
  /** revert: 실패하면 화면 값을 되돌리는 함수(미리 바꿔 보인 칸) */
  function save(patch, keys, revert) {
    if (!editable()) return Promise.resolve();
    setSaved(keys, 'saving');
    return enqueue(async () => {
      try {
        const r = await api.patch(`/api/cards/${encodeURIComponent(o.callId)}`, patch);
        if (!alive) return;
        if (r?.card) card = r.card;
        setSaved(keys, 'ok');
        warn(r);
        refreshDecor();
        o.onCardChange(card, { fields: keys });
      } catch (e) {
        if (!alive) return;
        setSaved(keys, 'fail');
        if (revert) revert();
        toast(e?.message || '저장하지 못했습니다. 잠시 뒤 다시 해 주세요.', 'error');
      }
    });
  }
  function saveItemsSoon(ms) {
    clearTimeout(itemsTimer);
    itemsTimer = setTimeout(() => { itemsTimer = null; save({ items: itemsForSave(items) }, ['items']); }, ms);
  }
  /** 기다리는 저장을 모두 끝낸다(상태 단추 · 다시 정리 전에) */
  async function flush() {
    if (itemsTimer) { clearTimeout(itemsTimer); itemsTimer = null; save({ items: itemsForSave(items) }, ['items']); }
    await chain;
  }

  function saveText(input) {
    if (!editable()) return;
    const key = input.dataset.field;
    const v = input.value.trim();
    if (v === String(card[key] ?? '')) return;
    save({ [key]: v || null }, [key]);
  }
  function clampQty(v) {
    const n = num(v);
    if (n === null) return null;
    return Math.min(999, Math.max(1, Math.round(n)));
  }
  function changeQty(i, d) {
    if (!editable() || !items[i]) return;
    const q = items[i].qty ?? 0;
    items[i].qty = Math.min(999, Math.max(1, q + d));
    const input = el.querySelector(`input[data-item="qty"][data-i="${i}"]`);
    if (input) input.value = String(items[i].qty);
    saveItemsSoon(700);
  }
  async function deleteItem(i) {
    if (!editable() || !items[i]) return;
    const it = items[i];
    const filled = String(it.part || '').trim() || String(it.partNo || '').trim();
    if (filled && !(await confirmBox(`${i + 1}번째 부품 줄(${it.part || it.partNo})을 지울까요?`))) return;
    if (!alive) return;
    items.splice(i, 1);
    if (activeKey && activeKey.startsWith('item:')) activeKey = null;
    renderItems();
    if (filled) saveItemsSoon(0);
  }
  function addItem() {
    if (!editable()) return;
    items.push({ part: '', side: '', qty: 1, partNo: '', quote: null, at: null, seg: null });
    renderItems();
    const input = el.querySelector(`input[data-item="part"][data-i="${items.length - 1}"]`);
    if (input) input.focus();
  }
  function setAsk(list) {
    const before = card.askBack || [];
    card = { ...card, askBack: list };
    renderAsk();
    refreshDecor();
    save({ askBack: list }, ['askBack'], () => { card = { ...card, askBack: before }; renderAsk(); refreshDecor(); });
  }

  // ── 상태 바꾸기 · 다시 전화 · 다시 정리 ──────────────────────────
  async function setStatus(action, btn) {
    if (busy) return;
    busy = true;
    if (btn) btn.disabled = true;
    try {
      await flush();
      const r = await api.post(`/api/cards/${encodeURIComponent(o.callId)}/${action}`);
      if (!alive) return;
      if (r?.card) { card = r.card; items = cloneItems(card.items); }
      warn(r);
      renderAll();
      o.onCardChange(card, { fields: ['status'] });
      toast(DONE_MSG[action] || '바꿨습니다.', 'ok');
    } catch (e) {
      if (!alive) return;
      toast(e?.message || '바꾸지 못했습니다.', 'error');
      if (btn && btn.isConnected) btn.disabled = false;
    } finally {
      busy = false;
    }
  }
  async function setCallback(on) {
    if (busy) return;
    busy = true;
    const reason = on ? (el.querySelector('#cd-cb-reason')?.value || '').trim() : null;
    try {
      await flush();
      const r = await api.post(`/api/cards/${encodeURIComponent(o.callId)}/callback`, { on, reason: reason || null });
      if (!alive) return;
      if (r?.card) card = r.card;
      cbOpen = false;
      warn(r);
      renderCallback();
      refreshDecor();
      o.onCardChange(card, { fields: ['callback'] });
      toast(on ? '다시 전화할 곳에 넣었습니다. 오늘 화면의 「다시 전화할 곳」에 보입니다.' : '다시 전화할 곳에서 뺐습니다.', 'ok');
    } catch (e) {
      if (alive) toast(e?.message || '바꾸지 못했습니다.', 'error');
    } finally {
      busy = false;
    }
  }
  async function reextract() {
    if (reexBusy) return;
    const ok = await confirmBox('AI 로 이 통화의 카드를 다시 정리할까요? 낱말 사전에 고친 낱말이 반영되고, 손으로 고친 칸은 새 초안으로 바뀝니다.');
    if (!ok || !alive) return;
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
        card = r.card; items = cloneItems(card.items); renderAll();
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
    const flag = t.closest('[data-flag]');
    if (flag) {
      const u = (card?.unsure || [])[Number(flag.dataset.flag)];
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
    if (!play && t.matches('input, textarea, select') && activeKey === block.dataset.ev) return;
    selectBlock(block, true);
  }

  function handleAct(act, btn) {
    switch (act) {
      case 'to-trans': o.onJumpToTranscript(activeKey ? evMap.get(activeKey) : null); break;
      case 'item-add': addItem(); break;
      case 'urgent':
        if (!editable()) return;
        card = { ...card, urgent: !card.urgent };
        renderUrgent();
        save({ urgent: card.urgent }, ['urgent'], () => { card = { ...card, urgent: !card.urgent }; renderUrgent(); });
        break;
      case 'ask-add': {
        const input = el.querySelector('#cd-ask-new');
        const v = (input?.value || '').trim();
        if (!v) { input?.focus(); toast('물어볼 것을 적은 뒤 「추가」를 누르세요.'); return; }
        setAsk([...(card.askBack || []), v]);
        el.querySelector('#cd-ask-new')?.focus();
        break;
      }
      case 'confirm': case 'ship': case 'reopen': setStatus(act, btn); break;
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

  function onChange(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.dataset.field) { saveText(t); return; }
    if (t.dataset.item) {
      if (!editable()) return;
      const i = Number(t.dataset.i);
      const sub = t.dataset.item;
      if (!items[i]) return;
      if (sub === 'qty') {
        items[i].qty = clampQty(t.value);
        t.value = items[i].qty ?? '';
      } else {
        items[i][sub] = t.value.trim();
        if (sub === 'part') {
          const title = t.closest('.cd-item')?.querySelector('.cd-item-title');
          if (title) title.textContent = items[i].part || '새 부품';
        }
      }
      saveItemsSoon(0);
    }
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
  el.addEventListener('change', onChange);
  el.addEventListener('keydown', onKeydown);
  renderAll();

  return {
    /** 지금 카드(저장된 값) */
    get card() { return card; },
    /** 다시 정리 · 새로 읽기로 통화가 바뀌었을 때 */
    update(newCall) {
      call = newCall;
      card = newCall.card || null;
      items = cloneItems(card?.items);
      cbOpen = false;
      renderAll();
    },
    flush,
    destroy() {
      // 떠나기 전에 기다리던 부품 줄 저장은 보낸다
      if (itemsTimer) { clearTimeout(itemsTimer); itemsTimer = null; save({ items: itemsForSave(items) }, ['items']); }
      alive = false;
      for (const tm of savedTimers.values()) clearTimeout(tm);
      el.removeEventListener('click', onClick);
      el.removeEventListener('change', onChange);
      el.removeEventListener('keydown', onKeydown);
    },
  };
}
