// 껍데기: 해시 라우터 · 메뉴 · 일꾼 상태 · 글씨 크게(F15).
// 화면 모듈(pages/*.js) 계약:
//   export default { title: '오늘', async mount(el, ctx) { ...; return () => {/* 정리 */} } }
//   ctx = { params, query, meta, navigate(path), refreshMeta() }
// 화면마다 css/pages/<이름>.css 가 있으면 처음 열 때 자동으로 붙인다.
import { getMeta } from './api.js';
import { html, render, esc, routeOf } from './ui.js';
import { icon } from './icons.js';
import { mountConnectivity } from './connectivity.js';

mountConnectivity();

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
  { re: /^\/assistant$/, page: 'assistant' },
  { re: /^\/(?:knowledge|glossary)$/, page: 'glossary' },
  { re: /^\/(login|signup|password|reset|workspaces|verify)$/, page: 'account', keys: ['action'] },
  { re: /^\/(password)\/reset$/, page: 'account', keys: ['action'] },
  { re: /^\/(invite)\/([^/]+)$/, page: 'account', keys: ['action', 'token'] },
  { re: /^\/(terms|privacy)$/, page: 'legal', keys: ['document'] },
  { re: /^\/settings(?:\/(profile|workspace|members|notifications|display|data|integrations))?$/, page: 'settings', keys: ['section'] },
  { re: /^\/trial$/, page: 'trial' },
  { re: /^\/admin$/, page: 'admin' },
  { re: /^\/help$/, page: 'help' },
  { re: /^\/more$/, page: 'more' },
];

const NAV = [
  { href: '#/', label: '오늘 브리핑', icon: '☀', page: 'today', f: 'F10' },
  { href: '#/calls', label: '통화 기록', icon: '☎', page: ['calls', 'call', 'customer'] },
  { href: '#/board', label: '주문 보드', icon: '▦', page: 'board' },
  { href: '#/shipping', label: '출고 목록', icon: '⇪', page: 'shipping' },
  { href: '#/upload', label: '녹음 올리기', icon: '⤒', page: 'upload' },
  { href: '#/assistant', label: '업무 도우미', icon: '✧', page: 'assistant' },
  { href: '#/ask', label: '통화 내용 찾기', icon: '?', page: 'ask' },
  { href: '#/knowledge', label: '공유 지식', icon: '◇', page: 'glossary' },
];
const SETTINGS = { href: '#/settings', label: '설정', icon: '⚙', page: 'settings' };
const NOTIFICATIONS = { href: '#/settings/notifications', label: '알림 설정', icon: '♢' };
const HELP = { href: '#/help', label: '도움말', icon: 'ⓘ', page: 'help' };
const ADMIN = { href: '#/admin', label: '관리자', icon: '⊞', page: 'admin' };
const LIVE = { href: '#/live', label: '새 통화 기록', icon: '+', page: 'live' };
const WORKSPACES = { href: '#/workspaces', label: '워크스페이스 선택', icon: '▣', page: 'account' };
const TABS = [
  { href: '#/', label: '오늘', icon: '☀', page: 'today' },
  { href: '#/calls', label: '통화', icon: '☎', page: ['calls', 'call', 'customer'] },
  { href: '#/board', label: '주문', icon: '▦', page: 'board' },
  { href: '#/shipping', label: '출고', icon: '⇪', page: 'shipping' },
  { href: '#/more', label: '더보기', icon: '≡', page: ['more', 'live', 'assistant', 'ask', 'upload', 'glossary', 'trial', 'help', 'admin', 'settings', 'account'] },
];

const view = document.getElementById('view');
let cleanup = null;
let seq = 0;
let shellMeta = null;
const loadedCss = new Set();

// 경로는 풀기 전 주소로 맞추고 잡힌 값만 푼다(ui.js routeOf) — 「A/S 공업사」(%2F) 같은 이름도 열린다
const parseHash = () => routeOf(location.hash, ROUTES);

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

// The hash router and access checks remain the single source of truth.
let montageShell;
let currentNav;
function renderNav(page, meta) {
  currentNav = { page, meta };
  const workspace = meta?.access?.workspace;
  const customerTab = new URLSearchParams(location.hash.split('?')[1]).get('tab') === 'customer';
  const model = {
    workspace: { href: WORKSPACES.href, name: workspace?.name || '워크스페이스', demo: meta?.demo === true },
    groups: [
      { label: '업무', items: NAV.slice(0, 4) },
      { label: '찾기와 관리', items: [NAV[6], NAV[5], { href: '#/knowledge?tab=customer', label: '거래처', page: 'glossary' }, NAV[7], { href: '#/more', label: '모든 도구', page: 'more' }] },
      { label: '', items: [SETTINGS, HELP] },
    ].map((group) => ({ ...group, items: group.items.map((item) => ({
      ...item,
      active: isActive(item, page) && (item.page !== 'glossary' || customerTab === (item.href === '#/knowledge?tab=customer')),
    })) })),
    tabs: TABS.map((item) => ({ ...item, active: isActive(item, page) })),
  };
  if (montageShell) { montageShell.update(model); return; }
  const workspaceLink = html`<a class="workspace-switch" href="${model.workspace.href}" title="워크스페이스 선택"><span class="workspace-copy"><strong>${model.workspace.name}</strong><span>${model.workspace.demo ? '예시 데이터로 체험 중' : '내 작업공간'}</span></span><span class="workspace-chevron" aria-hidden="true">⌄</span></a>`;
  const link = (n) => html`<li><a class="nav-link ${n.active?'active':''}" href="${n.href}" ${n.active?html`aria-current="page"`:''}>${icon(n.page)}<span>${n.label}</span></a></li>`;
  render(document.getElementById('headerWorkspace'), workspaceLink);
  render(document.getElementById('sideNav'), html`<div class="lnb-workspace">${workspaceLink}</div>
    ${model.groups.map((g) => html`<div class="nav-group ${g.label ? '' : 'lnb-bottom'}">${g.label ? html`<p class="nav-group-label">${g.label}</p>` : ''}<ul>${g.items.map(link)}</ul></div>`)}`);
  render(document.getElementById('tabBar'), html`${model.tabs.map((t) => html`<a class="tab-link ${t.active ? 'active' : ''}" href="${t.href}" ${t.active ? html`aria-current="page"` : ''}><span class="tab-icon">${icon(t.page)}</span><span>${t.label}</span></a>`)}`);
}

async function enhanceShell() {
  // Never leave the routes without navigation on an absent/failed optional bundle.
  const slots = {
    workspace: document.getElementById('headerWorkspace'),
    sidebar: document.getElementById('sideNav'),
    mobile: document.getElementById('tabBar'),
    actions: document.getElementById('headerCommands'),
  };
  if (Object.values(slots).some((node) => !node)) return;
  const originalActions = [...slots.actions.childNodes].map((node) => node.cloneNode(true));
  try {
    const { mountMontageShell } = await import('/montage/shell.js');
    // The CSS/font promise might resolve after a new hash; use the latest nav model.
    const hadFocus = document.activeElement;
    const focusHref = Object.values(slots).some((node) => node?.contains(hadFocus)) ? hadFocus?.getAttribute('href') : null;
    montageShell = await mountMontageShell(slots);
    if (currentNav) renderNav(currentNav.page, currentNav.meta);
    if (focusHref && document.activeElement === document.body && !hadFocus.isConnected) {
      const match = Object.values(slots).flatMap((node) => [...node.querySelectorAll('a')])
        .find((link) => link.getAttribute('href') === focusHref && link.getClientRects().length);
      match?.focus({ preventScroll: true });
    }
  } catch {
    if (!montageShell) return; // Failed import or tokens.css: keep the original nodes.
    montageShell.destroy();
    montageShell = null;
    slots.actions.replaceChildren(...originalActions);
    if (currentNav) renderNav(currentNav.page, currentNav.meta);
  }
}

function renderMore(el, meta) {
  const groups = [
    {title:'통화 기록하기', description:'파일을 올리거나 지금 통화를 받아써요.', items:[LIVE,NAV[4]]},
    {title:'찾고 물어보기', description:'지난 통화와 팀의 지식을 활용해요.', items:[...NAV.slice(5),{href:'#/knowledge?tab=customer',label:'거래처',page:'glossary'}]},
    {title:'내 작업공간', description:'계정, 팀 연결과 화면을 관리해요.', items:[WORKSPACES,SETTINGS,NOTIFICATIONS]},
    {title:'도움과 관리', description:'사용 안내와 관리 메뉴를 확인해요.', items:[HELP,...(meta?.access?.role==='admin'?[ADMIN]:[]),...(meta?.demo===true?[{href:'#/trial',label:'무료 체험 신청',icon:'✉'}]:[])]},
  ];
  render(el, html`<div class="page tools-page"><div class="page-head"><div><h1>모든 도구</h1><p class="sub">필요한 작업을 골라 이어가세요.</p></div></div><div class="tools-directory">${groups.map(g=>html`<section class="card tools-section"><h2>${g.title}</h2><p>${g.description}</p><ul class="menu-list">${g.items.map(n=>html`<li><a class="menu-link" href="${n.href}"><span class="nav-icon">${icon(n.page)}</span><span>${n.label}</span><span class="menu-arrow" aria-hidden="true">›</span></a></li>`)}</ul></section>`)}</div></div>`);

}

function goToLogin(returnTo) {
  const target = typeof returnTo === 'string' ? returnTo.replace(/^#/, '') : '/';
  const next = target.startsWith('/') && !target.startsWith('//') ? target : '/';
  location.hash = `/login?${new URLSearchParams({ next })}`;
}

async function route() {
  const my = ++seq;
  const r = parseHash();
  document.body.dataset.page = r.page;
  const path = document.getElementById('topbarPath');
  renderNav(r.page, shellMeta);
  path.textContent = [...NAV, LIVE, SETTINGS, HELP, ADMIN].find((n) => isActive(n, r.page))?.label || '메뉴';
  if (cleanup) { try { cleanup(); } catch { /* 무시 */ } cleanup = null; }
  window.scrollTo(0, 0);
  const mount = document.createElement('div');
  view.replaceChildren(mount);
  if (r.page === 'notfound') {
    path.textContent = '없는 화면';
    document.title = '없는 화면 · 아차';
    render(mount, html`<div class="page"><div class="card empty"><h1>이 화면을 찾지 못했습니다</h1><a class="btn btn-primary" href="#/calls">통화 기록 보기</a></div></div>`);
    view.focus({ preventScroll: true });
    return;
  }
  if (!['more', 'assistant'].includes(r.page)) ensureCss(r.page);
  if (r.page === 'assistant') ensureCss('ask');
  if (r.page === 'assistant' || r.page === 'glossary') ensureCss('knowledge-assistant');
  render(mount, html`<div class="page"><p class="loading" role="status">불러오는 중…</p></div>`);
  // 키보드 탐색을 새 본문에서 시작한다. 비동기 렌더 뒤에는 포커스를 다시 빼앗지 않는다.
  view.focus({ preventScroll: true });
  try {
    const meta = await getMeta();
    if (my !== seq) return;
    if (meta !== shellMeta) {
      shellMeta = meta;
      renderNav(r.page, meta);
    }
    const guest = Object.hasOwn(meta, 'access') && !meta.access;
    document.body.classList.toggle('is-guest', guest);
    if (guest && !['account', 'help', 'trial', 'legal'].includes(r.page)) {
      goToLogin(location.hash);
      return;
    }
    if (r.page === 'more') { renderMore(mount, meta); document.title = '더보기 · 아차'; return; }
    const mod = await import(`./pages/${r.page}.js`);
    if (my !== seq) return;
    const page = mod.default;
    path.textContent = page.title || path.textContent;
    document.title = `${page.title || ''} · 아차`;
    const ctx = {
      path: r.path,
      params: r.params,
      query: r.query,
      meta,
      navigate: (p) => { location.hash = p.startsWith('#') ? p : '#' + p; },
      refreshMeta: () => getMeta(true),
    };
    const ret = await page.mount(mount, ctx);
    if (my !== seq) { if (typeof ret === 'function') ret(); return; }
    cleanup = typeof ret === 'function' ? ret : null;
  } catch (err) {
    console.error(err);
    if (my !== seq) return;
    render(mount, html`<div class="page"><div class="notice notice-error" role="alert">화면을 열지 못했습니다.</div><button type="button" class="btn" data-retry>다시 열기</button> <a class="btn btn-ghost" href="#/calls">통화 기록으로</a></div>`);
    mount.querySelector('[data-retry]').addEventListener('click', route);
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
    ? `받아쓰기 연결됨${waiting ? ` · 대기 ${waiting}건` : ''}`
    : `받아쓰기 대기${waiting ? ` ${waiting}건` : ' 중'}`;
  pill.title = w.online ? '받아쓰기 처리 상태 보기' : '새 녹음은 처리 연결이 되면 차례로 받아씁니다.';
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
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  view.focus();
});
window.addEventListener('hashchange', route);
window.addEventListener('ahmatda:workspace-changed', () => {
  if (document.getElementById('workspaceChangedNotice')) return;
  const notice = document.createElement('div');
  notice.id = 'workspaceChangedNotice';
  notice.className = 'notice notice-warn';
  notice.setAttribute('role', 'alert');
  const text = document.createElement('p');
  text.textContent = '다른 탭에서 계정 또는 작업공간이 바뀌었습니다. 이 화면의 전송과 저장은 중단했습니다. 입력 내용을 확인한 뒤 현재 계정과 작업공간을 새로 열어 주세요.';
  const button = document.createElement('button');
  button.className = 'btn';
  button.textContent = '현재 계정·작업공간 새로 열기';
  button.addEventListener('click', () => location.reload());
  notice.append(text, button);
  (document.getElementById('workspaceNoticeSlot') || document.body).prepend(notice);
});

window.addEventListener('ahmatda:session-expired', (event) => {
  if (parseHash().page !== 'account') goToLogin(event.detail?.returnTo || location.hash);
});
route();
void enhanceShell();
refreshWorker();
setInterval(refreshWorker, 20_000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* 홈 화면 추가가 안 돼도 사이트는 돈다 */ });
}

export { esc };
