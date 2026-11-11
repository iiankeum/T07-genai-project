// 껍데기: 해시 라우터 · 메뉴 · 일꾼 상태 · 글씨 크게(F15).
// 화면 모듈(pages/*.js) 계약:
//   export default { title: '오늘', async mount(el, ctx) { ...; return () => {/* 정리 */} } }
//   ctx = { params, query, meta, navigate(path), refreshMeta() }
// 화면마다 css/pages/<이름>.css 가 있으면 처음 열 때 자동으로 붙인다.
import { getMeta } from './api.js';
import { html, render, esc } from './ui.js';

const ROUTES = [
  { re: /^\/?$/, page: 'today' },
  { re: /^\/calls$/, page: 'calls' },
  { re: /^\/calls\/([^/]+)$/, page: 'call', keys: ['id'] },
  { re: /^\/board$/, page: 'board' },
  { re: /^\/shipping$/, page: 'shipping' },
  { re: /^\/customers\/([^/]+)$/, page: 'customer', keys: ['name'] },
  { re: /^\/live$/, page: 'live' },
  { re: /^\/upload$/, page: 'upload' },
  { re: /^\/ask$/, page: 'ask' },
  { re: /^\/glossary$/, page: 'glossary' },
  { re: /^\/trial$/, page: 'trial' },
  { re: /^\/admin$/, page: 'admin' },
  { re: /^\/help$/, page: 'help' },
  { re: /^\/more$/, page: 'more' },
];

const NAV = [
  { href: '#/', label: '오늘 브리핑', icon: '☀', page: 'today', f: 'F10' },
  { href: '#/calls', label: '통화 기록 · 찾기', icon: '☎', page: ['calls', 'call', 'customer'], f: 'F08' },
  { href: '#/board', label: '주문 카드 보드', icon: '▦', page: 'board', f: 'F06' },
  { href: '#/shipping', label: '출고 목록', icon: '⇪', page: 'shipping', f: 'F14' },
  { href: '#/live', label: '실시간 받아쓰기', icon: '●', page: 'live', f: 'F03' },
  { href: '#/upload', label: '녹음 올리기', icon: '⤒', page: 'upload', f: 'F01' },
  { href: '#/ask', label: '지난 통화에 묻기', icon: '?', page: 'ask', f: 'F09' },
  { href: '#/glossary', label: '낱말 사전', icon: '가', page: 'glossary', f: 'F07' },
  { href: '#/trial', label: '무료 체험 신청', icon: '✉', page: 'trial' },
  { href: '#/help', label: '도움말', icon: 'ⓘ', page: 'help' },
];
const TABS = [
  { href: '#/', label: '오늘', icon: '☀', page: 'today' },
  { href: '#/calls', label: '통화', icon: '☎', page: ['calls', 'call', 'customer'] },
  { href: '#/live', label: '실시간', icon: '●', page: 'live' },
  { href: '#/ask', label: '묻기', icon: '?', page: 'ask' },
  { href: '#/more', label: '더보기', icon: '≡', page: ['more', 'board', 'shipping', 'upload', 'glossary', 'trial', 'help', 'admin'] },
];

const view = document.getElementById('view');
let cleanup = null;
let seq = 0;
const loadedCss = new Set();

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const qi = h.indexOf('?');
  const rawPath = qi >= 0 ? h.slice(0, qi) : h;
  const qs = qi >= 0 ? h.slice(qi + 1) : '';
  let path;
  try { path = rawPath.split('/').map((p) => decodeURIComponent(p)).join('/'); } catch { path = rawPath; }
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const r of ROUTES) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      (r.keys || []).forEach((k, i) => { params[k] = m[i + 1]; });
      return { page: r.page, params, query, path };
    }
  }
  return { page: 'notfound', params: {}, query, path };
}

function ensureCss(page) {
  if (loadedCss.has(page)) return;
  loadedCss.add(page);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/css/pages/${page}.css`;
  link.onerror = () => link.remove();
  document.head.appendChild(link);
}

const isActive = (item, page) => (Array.isArray(item.page) ? item.page.includes(page) : item.page === page);

function renderNav(page) {
  render(document.getElementById('sideNav'), html`
    <ul>${NAV.map((n) => html`<li><a class="nav-link ${isActive(n, page) ? 'active' : ''}" href="${n.href}" ${isActive(n, page) ? html`aria-current="page"` : ''}><span class="nav-icon" aria-hidden="true">${n.icon}</span><span>${n.label}</span></a></li>`)}</ul>
    <div class="sidenav-foot"><a href="#/admin" class="nav-small">관리자</a><a href="/intro/#signup" class="nav-small">소개 · 무료 체험 신청</a></div>`);
  render(document.getElementById('tabBar'), html`${TABS.map((t) => html`<a class="tab-link ${isActive(t, page) ? 'active' : ''}" href="${t.href}" ${isActive(t, page) ? html`aria-current="page"` : ''}><span class="tab-icon" aria-hidden="true">${t.icon}</span><span>${t.label}</span></a>`)}`);
}

function renderMore(el) {
  render(el, html`<div class="page">
    <div class="page-head"><h1>더보기</h1></div>
    <ul class="menu-list">${NAV.filter((n) => !['today', 'live', 'ask'].includes(n.page) && !Array.isArray(n.page)).concat([{ href: '#/admin', label: '관리자', icon: '⚙' }, { href: '/intro/#signup', label: '소개 페이지 · 무료 체험 신청', icon: '★' }]).map((n) => html`<li><a class="menu-link" href="${n.href}"><span class="nav-icon" aria-hidden="true">${n.icon}</span><span>${n.label}</span><span class="menu-arrow" aria-hidden="true">›</span></a></li>`)}</ul>
  </div>`);
}

async function route() {
  const my = ++seq;
  const r = parseHash();
  renderNav(r.page);
  if (cleanup) { try { cleanup(); } catch { /* 무시 */ } cleanup = null; }
  window.scrollTo(0, 0);
  if (r.page === 'more') { renderMore(view); document.title = '더보기 · 콜노트(가칭)'; return; }
  if (r.page === 'notfound') {
    render(view, html`<div class="page"><div class="empty"><p>없는 화면입니다.</p><a class="btn btn-primary" href="#/">첫 화면으로</a></div></div>`);
    return;
  }
  ensureCss(r.page);
  render(view, html`<div class="page"><p class="loading">불러오는 중…</p></div>`);
  try {
    const mod = await import(`./pages/${r.page}.js`);
    if (my !== seq) return;
    const page = mod.default;
    document.title = `${page.title || ''} · 콜노트(가칭)`;
    const meta = await getMeta();
    if (my !== seq) return;
    const ctx = {
      params: r.params,
      query: r.query,
      meta,
      navigate: (p) => { location.hash = p.startsWith('#') ? p : '#' + p; },
      refreshMeta: () => getMeta(true),
    };
    const ret = await page.mount(view, ctx);
    if (my !== seq) { if (typeof ret === 'function') ret(); return; }
    cleanup = typeof ret === 'function' ? ret : null;
  } catch (err) {
    console.error(err);
    if (my !== seq) return;
    render(view, html`<div class="page"><div class="notice notice-error" role="alert">화면을 여는 중에 문제가 생겼습니다: ${err?.message || err}</div><a class="btn" href="#/">첫 화면으로</a></div>`);
  }
}

// ── 일꾼 상태(위 막대) ──────────────────────────────────────────────
async function refreshWorker() {
  const meta = await getMeta(true);
  const pill = document.getElementById('workerPill');
  if (!pill) return;
  const w = meta.worker || {};
  const waiting = w.queue?.waiting || 0;
  pill.classList.toggle('online', Boolean(w.online));
  pill.classList.toggle('offline', !w.online);
  pill.querySelector('.worker-text').textContent = w.online
    ? `받아쓰기 일꾼 켜짐${waiting ? ` · 대기 ${waiting}` : ''}`
    : `받아쓰기 일꾼 대기 중${waiting ? ` · 줄 ${waiting}` : ''}`;
  pill.title = w.online ? `일꾼: ${w.engine || ''} ${w.gpu || ''}`.trim() : '일꾼(GPU PC)이 꺼져 있어 새 녹음은 줄을 서서 기다립니다. 미리 받아쓴 가짜 통화로 다른 기능을 써 보세요.';
}

// ── 글씨 크게(F15) ─────────────────────────────────────────────────
function setupBigText() {
  const btn = document.getElementById('bigTextBtn');
  let on = false;
  try { on = localStorage.getItem('cn.bigText') === '1'; } catch { on = false; }
  const apply = () => {
    document.documentElement.classList.toggle('big-text', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? '글씨 보통' : '글씨 크게';
  };
  apply();
  btn.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem('cn.bigText', on ? '1' : '0'); } catch { /* 저장 못 해도 지금은 적용 */ }
    apply();
  });
}

setupBigText();
window.addEventListener('hashchange', route);
route();
refreshWorker();
setInterval(refreshWorker, 20_000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* 홈 화면 추가가 안 돼도 사이트는 돈다 */ });
}

export { esc };
