// 관리자 — 암호로 들어오기 · 오늘 사용량 · 통화 수 · 체험 신청 보기 · 데모 초기화 · 나가기.
import { api } from '../api.js';
import { html, render, fmtWhen, toast, confirmBox, errorBox } from '../ui.js';

const LABELS = {
  usage: '오늘 사용량', today: '오늘', limits: '하루 상한', daily: '하루', calls: '통화', cards: '주문 카드',
  bySource: '들어온 길', byStatus: '상태별', jobs: '받아쓰기 일감', worker: '받아쓰기 일꾼', queue: '일감 줄',
  trials: '체험 신청', trial: '체험 신청', glossary: '낱말 사전',
  ai: 'AI 호출', upload: '녹음 올리기', uploads: '녹음 올리기', live: '실시간 저장', ingest: '폴더에서 온 녹음', seed: '대본 가짜 통화',
  total: '전체', draft: '확인 필요', confirmed: '확정', shipped: '출고 완료', cancelled: '취소',
  queued: '받아쓰기 대기', waiting: '대기', working: '받아쓰는 중', leased: '받아쓰는 중', transcribing: '받아쓰는 중',
  extracting: '카드 정리 중', ready: '정리됨', failed: '실패', done: '끝남',
  briefing: '브리핑', ask: '묻기', extract: '카드 정리', login: '로그인', audioMB: '녹음 용량(MB)', dbMB: 'DB 용량(MB)',
  dailyAiLimit: 'AI 하루 상한', dailyUploadLimit: '올리기 하루 상한', maxUploadMB: '파일 최대(MB)', maxAudioSec: '녹음 최대(초)',
  memMB: '서버 메모리(MB)', uptimeSec: '켜진 시간(초)', callbacks: '다시 전화할 곳', user: '사용자가 넣은 것',
  used: '쓴 양', limit: '상한',
};
const label = (k) => LABELS[k] || k;
/** 시각이 깨져 있어도 화면이 멈추지 않게 */
const when = (iso) => { try { return fmtWhen(iso); } catch { return ''; } };

/** 통계 객체에서 숫자만 모아 묶음별로 보여 준다(서버 모양이 바뀌어도 깨지지 않게) */
function statGroups(stats) {
  const groups = new Map();
  const add = (g, name, value) => { if (!groups.has(g)) groups.set(g, []); groups.get(g).push({ name, value }); };
  const walk = (obj, path) => {
    for (const [k, v] of Object.entries(obj || {})) {
      // {used, limit} 는 「3 / 400」 한 칸으로
      if (v && typeof v === 'object' && Number.isFinite(v.used) && Number.isFinite(v.limit)) {
        const text = `${v.used.toLocaleString('ko-KR')} / ${v.limit.toLocaleString('ko-KR')}`;
        if (!path.length) add('', label(k), text);
        else add(path[0], [...path.slice(1), k].map(label).join(' · '), text);
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        if (!path.length) add('', label(k), v);
        else add(path[0], [...path.slice(1), k].map(label).join(' · '), v);
      } else if (v && typeof v === 'object' && !Array.isArray(v) && path.length < 2) walk(v, [...path, k]);
    }
  };
  walk(stats, []);
  return [...groups.entries()];
}

function normTrials(data) {
  const list = Array.isArray(data) ? data : data?.trials || data?.items || [];
  return list.filter((t) => t && typeof t === 'object');
}

export default {
  title: '관리자',
  async mount(el, ctx) {
    let disposed = false;
    let busy = false;

    render(el, html`<div class="page page-narrow admin-page">
      <div class="page-head"><div>
        <p class="eyebrow">관리자</p>
        <h1>관리자</h1>
        <p class="sub">데모를 지키는 사람만 씁니다.</p>
      </div><div data-ref="headAct"></div></div>
      <div data-ref="body"><p class="loading">확인 중…</p></div>
    </div>`);
    const root = el.querySelector('.admin-page');
    const body = root.querySelector('[data-ref="body"]');
    const headAct = root.querySelector('[data-ref="headAct"]');

    // ── 들어오기 ──
    function renderLogin(message) {
      render(headAct, html``);
      render(body, html`<form class="card admin-login" data-ref="login" novalidate>
        <h2>암호로 들어오기</h2>
        ${message ? html`<div class="notice notice-warn">${message}</div>` : ''}
        <label class="field"><span>관리자 암호</span><input class="input" type="password" name="passcode" autocomplete="current-password" required maxlength="200"></label>
        <div data-ref="loginMsg"></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block">들어가기</button>
        <p class="help">10분에 다섯 번까지 해 볼 수 있습니다.</p>
      </form>`);
      body.querySelector('input[name="passcode"]')?.focus();
    }
    async function login(form) {
      if (busy) return;
      const input = form.elements.passcode;
      const passcode = String(input.value || '');
      const msgBox = form.querySelector('[data-ref="loginMsg"]');
      if (!passcode) { render(msgBox, html`<div class="notice notice-error" role="alert">암호를 써 주세요.</div>`); input.focus(); return; }
      busy = true;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await api.post('/api/admin/login', { passcode });
        input.value = '';
        if (disposed) return;
        toast('들어왔습니다.', 'ok');
        busy = false;
        await renderDashboard();
      } catch (err) {
        input.value = '';
        if (disposed) return;
        render(msgBox, html`<div class="notice notice-error" role="alert">${err?.message || '들어가지 못했습니다.'}</div>`);
        input.focus();
      } finally {
        busy = false;
        if (!disposed && btn.isConnected) btn.disabled = false;
      }
    }

    // ── 관리 화면 ──
    async function renderDashboard() {
      render(headAct, html`<button type="button" class="btn" data-act="logout">나가기</button>`);
      render(body, html`
        <section class="card" aria-labelledby="adStatTitle">
          <div class="card-title"><h2 id="adStatTitle">오늘 사용량 · 통화 수</h2><button type="button" class="btn btn-ghost" data-act="reload">새로고침</button></div>
          <div data-ref="stats"><p class="loading">불러오는 중…</p></div>
        </section>
        <section class="card" aria-labelledby="adTrialTitle">
          <h2 id="adTrialTitle">체험 신청</h2>
          <p class="small muted">개인정보입니다. 화면을 다른 사람에게 보여 주거나 찍어 두지 마세요.</p>
          <div data-ref="trials"><p class="loading">불러오는 중…</p></div>
        </section>
        <section class="card admin-danger" aria-labelledby="adResetTitle">
          <h2 id="adResetTitle">데모 초기화</h2>
          <p>올린 녹음 · 실시간 체험 통화 · 고친 카드 · 추가한 낱말을 지우고, 처음 가짜 데모 상태로 되돌립니다. <strong>되돌릴 수 없습니다.</strong></p>
          <label class="field"><span>계속하려면 「초기화」라고 써 주세요</span><input class="input" data-ref="resetWord" autocomplete="off" maxlength="10" placeholder="초기화"></label>
          <button type="button" class="btn btn-danger btn-lg btn-block" data-act="reset" disabled>데모 초기화</button>
        </section>`);
      await Promise.all([loadStats(), loadTrials()]);
    }
    function onUnauthorized(err) {
      if (err?.status === 401 || err?.code === 'admin_required') { renderLogin('들어온 지 오래돼 다시 암호가 필요합니다.'); return true; }
      return false;
    }
    async function loadStats() {
      const box = () => body.querySelector('[data-ref="stats"]');
      try {
        const stats = await api.get('/api/admin/stats');
        if (disposed || !box()) return;
        const groups = statGroups(stats);
        render(box(), groups.length
          ? html`<p class="small muted admin-stat-head">${stats?.day ? `기준 날짜 ${stats.day}` : ''}
              ${typeof stats?.aiEnabled === 'boolean' ? html`<span class="chip ${stats.aiEnabled ? 'chip-confirmed' : 'chip-draft'}">AI ${stats.aiEnabled ? '켜짐' : '키 없음'}</span>` : ''}
              ${stats?.worker && typeof stats.worker.online === 'boolean' ? html`<span class="chip ${stats.worker.online ? 'chip-confirmed' : 'chip-draft'}">받아쓰기 일꾼 ${stats.worker.online ? '켜짐' : '대기 중'}</span>` : ''}</p>
            ${groups.map(([g, rows]) => html`
              ${g ? html`<h3 class="admin-group">${label(g)}</h3>` : ''}
              <div class="metrics admin-metrics">${rows.map((r) => html`<div class="metric"><div class="metric-num">${typeof r.value === 'number' ? r.value.toLocaleString('ko-KR') : r.value}</div><div class="metric-label">${r.name}</div></div>`)}</div>`)}`
          : html`<p class="muted">보여 줄 숫자가 없습니다.</p>`);
        const visits = Array.isArray(stats?.visits) ? stats.visits : [];
        if (visits.length && box()) {
          box().insertAdjacentHTML('beforeend', String(html`<h3 class="admin-group">방문 수(최근 14일 · 같은 사람은 하루 한 번)</h3>
            <div class="table-wrap"><table class="table"><thead><tr><th>날짜</th><th>곳</th><th>src</th><th>방문</th></tr></thead>
            <tbody>${visits.map((v) => html`<tr><td>${v.day}</td><td>${v.page === 'intro' ? '소개 페이지' : '데모'}</td><td>${v.src}</td><td>${v.count}</td></tr>`)}</tbody></table></div>`));
        }
      } catch (err) {
        if (disposed || onUnauthorized(err) || !box()) return;
        render(box(), errorBox(err));
      }
    }
    async function loadTrials() {
      const box = () => body.querySelector('[data-ref="trials"]');
      try {
        const data = await api.get('/api/admin/trials');
        const list = normTrials(data);
        const counts = data?.counts || {};
        const tallyRow = (title, obj) => (obj && Object.keys(obj).length
          ? html`<div class="admin-tally"><strong>${title}</strong> ${Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, n]) => html`<span class="chip chip-ai">${k} ${n}</span> `)}</div>` : '');
        if (disposed || !box()) return;
        render(box(), list.length
          ? html`<div class="admin-tallies">${tallyRow('들어온 길(src)', counts.bySource)}${tallyRow('업종', counts.byIndustry)}${tallyRow('날짜', counts.byDay)}
              ${Number.isFinite(counts.consentMarketing) ? html`<div class="admin-tally"><strong>홍보 연락 동의</strong> ${counts.consentMarketing}건</div>` : ''}</div>
            <p class="small">모두 ${list.length}건 · 새것부터</p>
            <ul class="list list-wrap admin-trials">${list.map((t) => html`<li class="list-item admin-trial">
              <div class="row-between"><strong class="admin-trial-name">${t.name || '(이름 없음)'}</strong><span class="small muted">${when(t.createdAt || t.created_at)}</span></div>
              <dl class="admin-dl">
                <div><dt>소속</dt><dd>${t.org || '—'}</dd></div>
                <div><dt>연락처</dt><dd>${t.contact || '—'}</dd></div>
                <div><dt>역할</dt><dd>${t.role || '—'}</dd></div>
                <div><dt>남긴 말</dt><dd class="admin-msg">${t.message || '—'}</dd></div>
                ${t.consentAt || t.consent_at ? html`<div><dt>동의</dt><dd>${when(t.consentAt || t.consent_at)}</dd></div>` : ''}
                ${t.source ? html`<div><dt>들어온 길</dt><dd>${t.source}${t.form ? ` · ${t.form === 'intro' ? '소개 페이지' : '앱'}` : ''}</dd></div>` : ''}
                ${t.industry || t.callsPerDay || t.region ? html`<div><dt>업종 · 통화 · 지역</dt><dd>${[t.industry, t.callsPerDay, t.region].filter(Boolean).join(' · ')}</dd></div>` : ''}
                ${t.heardFrom || t.recordingSetup ? html`<div><dt>알게 된 곳 · 녹음</dt><dd>${[t.heardFrom, t.recordingSetup].filter(Boolean).join(' · ')}</dd></div>` : ''}
                <div><dt>홍보 연락 · 인터뷰</dt><dd>${t.consentMarketing ? `동의(${when(t.consentMarketingAt)})` : '동의 안 함'} · ${t.interviewOk ? '인터뷰 가능' : '—'}</dd></div>
              </dl>
              ${t.id ? html`<button type="button" class="btn btn-danger admin-trial-del" data-act="delTrial" data-id="${t.id}">이 신청 지우기(파기)</button>` : ''}</li>`)}</ul>`
          : html`<p class="muted">아직 체험 신청이 없습니다.</p>`);
      } catch (err) {
        if (disposed || onUnauthorized(err) || !box()) return;
        render(box(), errorBox(err));
      }
    }
    async function doReset() {
      const word = body.querySelector('[data-ref="resetWord"]');
      if (busy || !word || word.value.trim() !== '초기화') return;
      const ok = await confirmBox('정말 데모를 처음 상태로 되돌릴까요? 되돌릴 수 없습니다.');
      if (!ok || disposed) return;
      busy = true;
      const btn = body.querySelector('[data-act="reset"]');
      if (btn) { btn.disabled = true; btn.textContent = '초기화하는 중…'; }
      try {
        const out = await api.post('/api/admin/reset', { confirm: '초기화' });
        if (disposed) return;
        const n = Number(out?.seeded ?? out?.calls ?? out?.count);
        toast(Number.isFinite(n) ? `초기화했습니다. 가짜 통화 ${n}건을 다시 넣었습니다.` : '초기화했습니다.', 'ok');
        ctx.refreshMeta?.();
        busy = false;
        await renderDashboard();
      } catch (err) {
        if (disposed || onUnauthorized(err)) return;
        toast(err?.message || '초기화하지 못했습니다.', 'error');
        if (btn && btn.isConnected) { btn.textContent = '데모 초기화'; btn.disabled = word.value.trim() !== '초기화'; }
      } finally {
        busy = false;
      }
    }
    // 파기 요청 · 보유 기간 끝에 신청 하나를 지운다
    async function deleteTrial(id) {
      if (busy || !id) return;
      const ok = await confirmBox('이 체험 신청을 지울까요? 되돌릴 수 없습니다.');
      if (!ok || disposed) return;
      busy = true;
      try {
        await api.del('/api/admin/trials/' + encodeURIComponent(id));
        if (disposed) return;
        toast('지웠습니다.', 'ok');
        busy = false;
        await Promise.all([loadTrials(), loadStats()]);
      } catch (err) {
        if (disposed || onUnauthorized(err)) return;
        toast(err?.message || '지우지 못했습니다.', 'error');
      } finally {
        busy = false;
      }
    }
    async function logout() {
      if (busy) return;
      busy = true;
      try { await api.post('/api/admin/logout', {}); } catch { /* 나가기는 화면에서라도 */ }
      busy = false;
      if (disposed) return;
      toast('나갔습니다.');
      renderLogin();
    }

    // ── 이벤트 ──
    const onSubmit = (e) => { if (e.target.matches('[data-ref="login"]')) { e.preventDefault(); login(e.target); } };
    const onInput = (e) => {
      if (e.target.matches('[data-ref="resetWord"]')) {
        const btn = body.querySelector('[data-act="reset"]');
        if (btn && !busy) btn.disabled = e.target.value.trim() !== '초기화';
      }
    };
    const onClick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled || !root.contains(b)) return;
      const act = b.dataset.act;
      if (act === 'logout') logout();
      else if (act === 'reload') { loadStats(); loadTrials(); }
      else if (act === 'reset') doReset();
      else if (act === 'delTrial') deleteTrial(b.dataset.id);
    };
    root.addEventListener('submit', onSubmit);
    root.addEventListener('input', onInput);
    root.addEventListener('click', onClick);

    // 이미 들어와 있는지
    let admin = false;
    let meErr = null;
    try { admin = Boolean((await api.get('/api/admin/me'))?.admin); } catch (err) { meErr = err; }
    if (!disposed) {
      if (admin) await renderDashboard();
      else renderLogin(meErr && meErr.status !== 401 ? meErr.message : '');
    }

    return () => {
      disposed = true;
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('input', onInput);
      root.removeEventListener('click', onClick);
    };
  },
};
