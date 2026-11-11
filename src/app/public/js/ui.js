// 화면 공용 조각. 사용자 입력 · 서버 글은 반드시 html`` 템플릿이나 esc() 로 넣는다(XSS 막기).

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** 이미 안전한 HTML 조각 */
export class SafeHtml {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
/** 믿을 수 있는 HTML 을 그대로 넣을 때만(서버 · 사용자 글에는 쓰지 않는다) */
export const raw = (s) => new SafeHtml(String(s));

function interp(v) {
  if (v instanceof SafeHtml) return v.s;
  if (Array.isArray(v)) return v.map(interp).join('');
  if (v === false || v === null || v === undefined) return '';
  return esc(v);
}
/** html`<p>${userText}</p>` — 값은 자동 이스케이프, 배열은 이어 붙임, false/null 은 빈칸 */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < values.length) out += interp(values[i]); });
  return new SafeHtml(out);
}
export function render(el, safe) {
  el.innerHTML = safe instanceof SafeHtml ? safe.s : esc(safe);
}

// ── 시간 · 숫자 ────────────────────────────────────────────────────
const KST = 9 * 3600_000;
const kst = (iso) => new Date(Date.parse(iso) + KST);
const badIso = (iso) => !iso || Number.isNaN(Date.parse(iso));
export function kstDay(date = new Date()) {
  return new Date(date.getTime() + KST).toISOString().slice(0, 10);
}
/** 「오후 2:42」 */
export function fmtClock(iso) {
  if (badIso(iso)) return '';
  const d = kst(iso);
  const h = d.getUTCHours(); const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
}
/** 「11월 11일(수)」 */
export function fmtDate(iso) {
  if (badIso(iso)) return '';
  const d = kst(iso);
  const w = '일월화수목금토'[d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${w})`;
}
/** 오늘이면 「오늘 오후 2:42」, 아니면 「11월 10일(화) 오후 2:42」 */
export function fmtWhen(iso) {
  if (badIso(iso)) return '';
  const day = kst(iso).toISOString().slice(0, 10);
  const today = kstDay();
  const yesterday = kstDay(new Date(Date.now() - 86400_000));
  const prefix = day === today ? '오늘' : day === yesterday ? '어제' : fmtDate(iso);
  return `${prefix} ${fmtClock(iso)}`;
}
/** 초 → 「0:42」 */
export function fmtSec(sec) {
  if (sec == null || !Number.isFinite(Number(sec))) return '';
  const s = Math.max(0, Math.floor(Number(sec)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── 상태 표시 ──────────────────────────────────────────────────────
const CARD_CHIP = { draft: 'chip-draft', confirmed: 'chip-confirmed', shipped: 'chip-shipped', cancelled: 'chip-cancelled' };
const CARD_LABEL = { draft: '확인 필요', confirmed: '확정', shipped: '출고 완료', cancelled: '취소' };
export function cardChip(status) {
  if (!status) return html``;
  return html`<span class="chip ${CARD_CHIP[status] || ''}">${CARD_LABEL[status] || status}</span>`;
}
const CALL_LABEL = { queued: '받아쓰기 기다리는 중', transcribing: '받아쓰는 중', extracting: '카드 정리 중', ready: '정리됨', failed: '실패' };
export function callChip(call) {
  if (!call) return html``;
  if (call.status === 'ready' && call.card) return cardChip(call.card.status);
  const cls = call.status === 'failed' ? 'chip-failed' : 'chip-working';
  return html`<span class="chip ${cls}">${call.statusLabel || CALL_LABEL[call.status] || call.status}</span>`;
}
export const SOURCE_LABEL = { seed: '가짜 통화(대본)', upload: '올린 녹음', ingest: '폴더에서 온 녹음', live: '실시간 체험' };

// ── 강조(마크) ─────────────────────────────────────────────────────
/**
 * text 안의 낱말들을 <mark class="hl-..."> 로 감싼다.
 * @param {string} text
 * @param {{text:string, kind:string}[]} marks kind: part|qty|car|plate|urgent|ask|customer|search
 */
export function highlight(text, marks = []) {
  const src = String(text ?? '');
  const list = marks
    .filter((m) => m && m.text && String(m.text).trim().length >= 1)
    .map((m) => ({ t: String(m.text).trim(), kind: m.kind || 'search' }))
    .sort((a, b) => b.t.length - a.t.length);
  if (!list.length) return html`${src}`;
  const ranges = [];
  for (const m of list) {
    let from = 0;
    const needle = m.t.toLowerCase();
    const hay = src.toLowerCase();
    while (from <= hay.length) {
      const i = hay.indexOf(needle, from);
      if (i < 0) break;
      const j = i + needle.length;
      if (!ranges.some((r) => i < r.end && j > r.start)) ranges.push({ start: i, end: j, kind: m.kind });
      from = j;
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  let out = ''; let pos = 0;
  for (const r of ranges) {
    out += esc(src.slice(pos, r.start));
    out += `<mark class="hl hl-${esc(r.kind)}">${esc(src.slice(r.start, r.end))}</mark>`;
    pos = r.end;
  }
  out += esc(src.slice(pos));
  return raw(out);
}

// ── 알림 · 확인 ────────────────────────────────────────────────────
let toastTimer = null;
export function toast(message, kind = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast show toast-${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'error' ? 5000 : 2800);
}
export function confirmBox(message) {
  const dlg = document.getElementById('confirmDialog');
  if (!dlg || typeof dlg.showModal !== 'function') return Promise.resolve(window.confirm(message));
  document.getElementById('confirmText').textContent = message;
  return new Promise((resolve) => {
    const onClose = () => { dlg.removeEventListener('close', onClose); resolve(dlg.returnValue === 'yes'); };
    dlg.addEventListener('close', onClose);
    dlg.returnValue = '';
    dlg.showModal();
  });
}
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('복사했습니다. 카톡·문자에 붙여 넣으세요.', 'ok');
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    toast(ok ? '복사했습니다.' : '복사하지 못했습니다. 글을 길게 눌러 복사해 주세요.', ok ? 'ok' : 'error');
    return ok;
  }
}

// ── 그 밖 ─────────────────────────────────────────────────────────
export function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
/** 빈 상태 */
export function empty(message, action) {
  return html`<div class="empty"><p>${message}</p>${action || ''}</div>`;
}
/** 오류 상자(ApiError 또는 Error) */
export function errorBox(err) {
  const msg = err?.message || '문제가 생겼습니다. 잠시 뒤 다시 해 주세요.';
  return html`<div class="notice notice-error" role="alert">${msg}</div>`;
}
export function aiOffNotice(meta) {
  if (meta && meta.aiEnabled === false) {
    return html`<div class="notice notice-warn">AI 키 없음 — 지금은 AI 기능(카드 정리 · 브리핑 · 묻기)이 꺼져 있습니다. 나머지 화면은 그대로 쓸 수 있습니다.</div>`;
  }
  return html``;
}
/** 해시 주소 만들기: href('/calls', {q:'쏘렌토'}) → '#/calls?q=쏘렌토' */
export function href(path, query) {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : '';
  return '#' + path + (qs ? '?' + qs : '');
}
