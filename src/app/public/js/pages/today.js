// 오늘 브리핑(F10) · 첫 화면: 숫자 상자 · AI 한 단락 · 할 일 · 다시 전화할 곳 · 급한 것 · 최근 통화 · 마감 요약 복사.
import { api } from '../api.js';
import { html, render, kstDay, fmtDate, fmtWhen, fmtClock, callChip, cardChip, toast, copyText, errorBox, aiOffNotice, href } from '../ui.js';
import { partsText, callHref } from './board.js';

const REFRESH_MS = 30_000;
const LIST_MAX = 6;
// AI 요약을 저절로 부른 날(화면을 다시 열어도 같은 날은 한 번만 — AI 비용 아끼기)
const AUTO_TRIED = new Set();
const TODO_KIND = {
  callback: { icon: '☎', label: '다시 전화' },
  confirm: { icon: '✓', label: '확인 · 확정' },
  ship: { icon: '⇪', label: '출고' },
  listen: { icon: '▶', label: '들어 보기' },
  retry: { icon: '↻', label: '다시 해 보기' },
};
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
/** 'YYYY-MM-DD' → 그날 한국 낮 12시 ISO(fmtDate 에 넘기려고) */
const dayIso = (day) => `${day}T03:00:00.000Z`;
const yesterdayOf = () => kstDay(new Date(Date.now() - 86400_000));

function greeting() {
  const h = new Date(Date.now() + 9 * 3600_000).getUTCHours();
  if (h < 11) return '좋은 아침입니다.';
  if (h < 18) return '안녕하세요.';
  return '오늘도 수고 많으셨습니다.';
}
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default {
  title: '오늘 브리핑',
  async mount(el, ctx) {
    const ac = new AbortController();
    const st = {
      day: isDay(ctx.query.day) ? ctx.query.day : kstDay(),
      // 날짜를 고르지 않고 들어왔으면, 오늘 통화가 아직 없을 때 가장 최근 업무일(어제)을 대신 보여 준다
      autoDay: !isDay(ctx.query.day),
      fallback: false,
      meta: ctx.meta || {},
      data: null,
      error: null,
      loading: true,
      refreshFailed: false,
      loadedAt: null,
      brief: 'idle', // idle | loading | error
      briefErr: null,
      sumText: null,
      sumDay: null,
      showText: false,
      copying: false,
    };
    render(el, html`<div class="page today-page"></div>`);
    const root = el.firstElementChild;
    const alive = () => !ac.signal.aborted && root.isConnected;

    // ── 그리기 ──────────────────────────────────────────────────
    function headPart() {
      const today = kstDay();
      const isToday = st.day === today;
      const yest = yesterdayOf();
      return html`<div class="page-head today-head">
        <div>
          <p class="eyebrow">가짜 통화 데모</p>
          <h1>${isToday ? '오늘 브리핑' : `${fmtDate(dayIso(st.day))} 브리핑`}</h1>
          <p class="sub">${isToday ? `${greeting()} ` : ''}${fmtDate(dayIso(st.day))} 주문 흐름입니다.</p>
          ${st.fallback && !isToday ? html`<p class="notice today-fallback">오늘은 아직 통화가 없어요 — 가장 최근 업무일(어제) 흐름을 보여 드립니다. 오늘 통화가 들어오면 저절로 오늘로 바뀝니다.</p>` : ''}
        </div>
        <div class="day-switch" role="group" aria-label="날짜 고르기">
          <button type="button" class="btn" data-act="day" data-day="${yest}" aria-pressed="${String(st.day === yest)}">어제</button>
          <button type="button" class="btn" data-act="day" data-day="${today}" aria-pressed="${String(isToday)}">오늘</button>
        </div>
      </div>`;
    }

    function statusPart() {
      const w = st.meta?.worker || {};
      const waiting = num(w.queue?.waiting);
      const working = num(w.queue?.working);
      const text = w.online
        ? `받아쓰기 일꾼 켜짐 · 기다리는 녹음 ${waiting}건${working ? ` · 받아쓰는 중 ${working}건` : ''}`
        : `받아쓰기 일꾼 대기 중(꺼짐) · 기다리는 녹음 ${waiting}건`;
      return html`<div class="today-status">
        <p class="worker-line ${w.online ? 'on' : 'off'}" title="${w.online ? '' : '일꾼(GPU PC)이 꺼져 있으면 새 녹음은 줄을 서서 기다립니다. 미리 받아쓴 가짜 통화로 다른 기능을 써 보세요.'}"><span class="dot" aria-hidden="true"></span>${text}</p>
        <div class="quick-links"><a class="btn" href="#/upload">⤒ 녹음 올리기</a><a class="btn" href="#/live">● 실시간 받아쓰기</a></div>
      </div>`;
    }

    function metricsPart(d) {
      const s = d.stats || {};
      const range = { from: st.day, to: st.day };
      const box = (n, unit, label, cls, link) => html`<a class="metric ${cls} ${num(n) === 0 ? 'is-zero' : ''}" href="${link}"><span class="metric-num">${num(n)}<small>${unit}</small></span><span class="metric-label">${label}</span></a>`;
      const extra = [
        num(s.working) ? `받아쓰는 중 ${num(s.working)}건` : '',
        num(s.failed) ? `실패 ${num(s.failed)}건` : '',
        num(s.unsure) ? `들어 볼 곳 ${num(s.unsure)}곳` : '',
        `확정 ${num(s.confirmed)}장`,
        `출고 완료 ${num(s.shipped)}장`,
        ...Object.entries(s.byType || {}).map(([k, n]) => `${k} ${num(n)}건`),
      ].filter(Boolean).join(' · ');
      return html`<div class="metrics today-metrics">
        ${box(s.calls, '건', d.isToday === false ? '그날 통화' : '오늘 통화', 'metric-brand', href('/calls', { ...range, status: 'all' }))}
        ${box(s.cards, '장', '주문 카드', '', '#/board')}
        ${box(s.draft, '건', '확인 필요 통화', 'metric-warn', href('/calls', { ...range, status: 'draft' }))}
        <button type="button" class="metric metric-urgent ${num(s.urgentOpen) === 0 ? 'is-zero' : ''}" data-act="jump" data-to="today-urgent"><span class="metric-num">${num(s.urgentOpen)}<small>건</small></span><span class="metric-label">급한데 출고 전</span></button>
        ${box(s.callbacks, '곳', '다시 전화할 곳', 'metric-callback', href('/calls', { ...range, status: 'callback' }))}
      </div>
      <p class="today-substats">${extra}</p>`;
    }

    function briefPart(d) {
      const meta = st.meta || {};
      const b = d.briefing;
      const isToday = d.isToday !== false && st.day === kstDay();
      let body;
      if (st.brief === 'loading') {
        body = html`<p class="brief-wait"><span class="spinner" aria-hidden="true"></span>AI 가 ${isToday ? '오늘' : '그날'} 통화를 읽는 중입니다. 잠시만 기다려 주세요.</p>`;
      } else if (b && b.paragraph) {
        body = html`<p class="brief-text">${b.paragraph}</p>
          ${Array.isArray(b.todos) && b.todos.length ? html`<h3 class="brief-sub">AI 가 고른 먼저 할 일</h3>
            <ol class="brief-todos">${b.todos.map((t) => html`<li>${t.callId
              ? html`<a href="${callHref(t.callId)}"><strong>${t.title}</strong>${t.why ? html`<span class="brief-why">${t.why}</span>` : ''}</a>`
              : html`<strong>${t.title}</strong>${t.why ? html`<span class="brief-why">${t.why}</span>` : ''}`}</li>`)}</ol>` : ''}`;
      } else if (num(d.stats?.calls) === 0) {
        body = html`<p class="brief-none">${isToday ? '아직 오늘 통화가 없어' : '그날 통화가 없어'} 요약할 것이 없습니다.</p>`;
      } else if (meta.aiEnabled === false) {
        body = html``;
      } else {
        body = html`<p class="brief-none">아직 AI 요약이 없습니다.</p>`;
      }
      const canMake = meta.aiEnabled !== false && num(d.stats?.calls) > 0 && st.brief !== 'loading';
      return html`<section class="card today-brief" aria-labelledby="brief-h">
        <div class="card-title"><h2 id="brief-h">AI 한 단락 요약</h2><span class="chip chip-ai">AI 초안</span></div>
        ${aiOffNotice(meta)}
        ${st.brief === 'error' ? html`${errorBox(st.briefErr)}` : ''}
        ${body}
        <div class="brief-foot">
          <p class="brief-meta">${b && b.createdAt ? `만든 시각 ${fmtWhen(b.createdAt)} · 숫자는 위 상자를 기준으로 보세요.` : 'AI 요약은 초안입니다. 숫자는 위 상자를 기준으로 보세요.'}</p>
          ${canMake ? html`<button type="button" class="btn" data-act="brief">${b ? '다시 만들기' : st.brief === 'error' ? '다시 해 보기' : 'AI 요약 만들기'}</button>` : ''}
        </div>
      </section>`;
    }

    function closePart() {
      const ready = st.sumText && st.sumDay === st.day;
      return html`<section class="card today-close" aria-labelledby="close-h">
        <div class="card-title"><h2 id="close-h">마감 요약</h2></div>
        <p class="close-help">카톡 · 문자에 붙여 넣을 수 있는 짧은 글입니다. AI 없이도 만들어집니다.</p>
        <button type="button" class="btn btn-primary btn-lg btn-block" data-act="copy" ${st.copying ? html`disabled` : ''}>${st.copying ? '만드는 중…' : '마감 요약 복사'}</button>
        <button type="button" class="btn btn-ghost btn-block close-toggle" data-act="text" aria-expanded="${String(st.showText)}">${st.showText ? '글 접기' : '복사할 글 보기'}</button>
        ${st.showText ? (ready ? html`<pre class="sum-text">${st.sumText}</pre>` : html`<p class="muted">글을 불러오는 중…</p>`) : ''}
      </section>`;
    }

    function section(id, title, count, body, more, wide = false) {
      return html`<section class="today-sec ${wide ? 'today-sec-wide' : ''}" ${id ? html`id="${id}"` : ''} aria-labelledby="${id || title}-h" tabindex="-1">
        <h2 id="${id || title}-h">${title} ${count != null ? html`<span class="sec-count">${count}</span>` : ''}</h2>
        ${body}
        ${more || ''}
      </section>`;
    }
    const moreLink = (n, link, label) => (n > LIST_MAX ? html`<a class="sec-more" href="${link}">${label} (${n})</a>` : '');
    const emptyBox = (text) => html`<p class="sec-empty">${text}</p>`;

    function todoList(d) {
      const todos = (Array.isArray(d.todos) ? d.todos : []).slice().sort((a, b) => num(a.priority || 3) - num(b.priority || 3));
      if (!todos.length) return emptyBox('지금 할 일이 없습니다.');
      return html`<div class="list-wrap">${todos.slice(0, 10).map((t) => {
        const k = TODO_KIND[t.kind] || { icon: '•', label: '할 일' };
        const inner = html`<span class="todo-icon" aria-hidden="true">${k.icon}</span>
          <span class="todo-body"><span class="todo-kind">${k.label}${num(t.priority) === 1 ? html` <span class="chip chip-urgent">먼저</span>` : ''}</span>
          <strong class="todo-title">${t.title}</strong>${t.why ? html`<span class="todo-why">${t.why}</span>` : ''}</span>`;
        return t.callId
          ? html`<a class="list-item todo-item todo-${t.kind}" href="${callHref(t.callId)}">${inner}<span class="item-arrow" aria-hidden="true">›</span></a>`
          : html`<div class="list-item todo-item todo-${t.kind}">${inner}</div>`;
      })}</div>`;
    }

    function callbackList(d) {
      const list = Array.isArray(d.callbacks) ? d.callbacks : [];
      if (!list.length) return emptyBox('다시 전화할 곳이 없습니다.');
      return html`<div class="list-wrap">${list.slice(0, LIST_MAX).map((c) => html`<a class="list-item cb-item" href="${callHref(c.callId)}">
        <span class="li-top"><strong>${c.customer || c.title || '거래처 확인 필요'}</strong><span class="li-when">${fmtWhen(c.recordedAt)}</span></span>
        ${c.reason ? html`<span class="cb-reason">${c.reason}</span>` : ''}
        ${Array.isArray(c.askBack) && c.askBack.length ? html`<span class="cb-ask"><span class="cb-ask-label">되물을 말</span>${c.askBack.map((q) => html`<span class="cb-q">「${q}」</span>`)}</span>` : ''}
      </a>`)}</div>`;
    }

    function draftList(d) {
      const list = Array.isArray(d.drafts) ? d.drafts : [];
      if (!list.length) return emptyBox('확인할 카드가 없습니다.');
      return html`<div class="list-wrap">${list.slice(0, LIST_MAX).map((c) => html`<a class="list-item" href="${callHref(c.callId)}">
        <span class="li-top"><strong>${c.customer || '거래처 확인 필요'}</strong><span class="li-when">${fmtClock(c.recordedAt)}</span></span>
        <span class="li-title">${c.title}</span>
        ${c.urgent || num(c.askBackCount) || num(c.unsureCount) ? html`<span class="li-flags">
          ${c.urgent ? html`<span class="chip chip-urgent">급함</span>` : ''}
          ${num(c.askBackCount) ? html`<span class="chip chip-ask">되물을 것 ${num(c.askBackCount)}</span>` : ''}
          ${num(c.unsureCount) ? html`<span class="listen-flag">들어 보기 ${num(c.unsureCount)}</span>` : ''}
        </span>` : ''}
      </a>`)}</div>`;
    }

    function urgentList(d) {
      const list = Array.isArray(d.urgentOpen) ? d.urgentOpen : [];
      if (!list.length) return emptyBox('급한데 출고 안 된 주문이 없습니다.');
      return html`<div class="list-wrap">${list.slice(0, LIST_MAX).map((c) => html`<a class="list-item urgent-item" href="${callHref(c.callId)}">
        <span class="li-top"><strong>${c.customer || '거래처 확인 필요'}</strong>${cardChip(c.status)}</span>
        <span class="li-title">${c.title}</span>
        ${c.due || c.delivery ? html`<span class="li-meta">${[c.due ? `원하는 때 ${c.due}` : '', c.delivery ? `받는 방법 ${c.delivery}` : ''].filter(Boolean).join(' · ')}</span>` : ''}
      </a>`)}</div>`;
    }

    function recentList(d) {
      const list = Array.isArray(d.recent) ? d.recent : [];
      if (!list.length) return emptyBox('최근 통화가 없습니다.');
      return html`<div class="list-wrap">${list.map((c) => html`<a class="list-item" href="${callHref(c.id)}">
        <span class="li-top"><strong class="li-title-strong">${c.title || c.customer || '통화'}</strong>${callChip(c)}</span>
        <span class="li-meta">${fmtWhen(c.recordedAt)}${c.card ? ` · ${partsText(c.card.items, 2, c.card.callType)}` : c.summary ? ` · ${c.summary}` : ''}</span>
      </a>`)}</div>`;
    }

    function draw() {
      if (!alive()) return;
      const d = st.data;
      if (!d) {
        render(root, html`${headPart()}${statusPart()}${st.error
          ? html`${errorBox(st.error)}<button type="button" class="btn btn-primary" data-act="reload">다시 불러오기</button>`
          : html`<p class="loading"><span class="spinner" aria-hidden="true"></span> 오늘 숫자를 모으는 중…</p>`}`);
        return;
      }
      const range = { from: st.day, to: st.day };
      const s = d.stats || {};
      // 서버가 목록을 잘라 보낼 수 있어 숫자 상자 값과 목록 길이 중 큰 것을 센다
      const count = (list, n) => Math.max(Array.isArray(list) ? list.length : 0, num(n));
      const drafts = count(d.drafts, s.draft);
      const cbs = count(d.callbacks, s.callbacks);
      const urg = count(d.urgentOpen, s.urgentOpen);
      const todos = Array.isArray(d.todos) ? d.todos.length : 0;
      render(root, html`${headPart()}${statusPart()}
        ${st.loading ? html`<p class="today-refresh"><span class="spinner" aria-hidden="true"></span> 새로 고치는 중…</p>` : ''}
        ${metricsPart(d)}
        <div class="today-top">${briefPart(d)}${closePart()}</div>
        <div class="today-lists">
          ${section('today-todos', '할 일', todos, todoList(d), '', true)}
          ${section('today-callbacks', '다시 전화할 곳', cbs, callbackList(d), moreLink(cbs, href('/calls', { ...range, status: 'callback' }), '모두 보기'))}
          ${section('today-drafts', '확인 필요 카드', drafts, draftList(d), moreLink(drafts, href('/calls', { ...range, status: 'draft' }), '모두 보기'))}
          ${section('today-urgent', '급한데 출고 안 된 것', urg, urgentList(d), urg > LIST_MAX ? html`<a class="sec-more" href="#/board">보드에서 모두 보기 (${urg})</a>` : '')}
          ${section('today-recent', '최근 통화', null, recentList(d), html`<a class="sec-more" href="${href('/calls', { ...range, status: 'all' })}">통화 기록 모두 보기</a>`)}
        </div>
        <p class="today-foot">${st.refreshFailed ? '새로 고치지 못했습니다(인터넷 연결 확인). ' : ''}30초마다 저절로 새로 고칩니다${st.loadedAt ? ` · 마지막 ${fmtClock(st.loadedAt)}` : ''}.</p>`);
    }

    // ── 불러오기 ────────────────────────────────────────────────
    async function load({ quiet = false } = {}) {
      const day = st.day;
      st.loading = true;
      if (!quiet) draw();
      try {
        const [data, meta] = await Promise.all([
          api.get('/api/dashboard', { day }, { signal: ac.signal }),
          quiet ? ctx.refreshMeta().catch(() => st.meta) : Promise.resolve(st.meta),
        ]);
        if (!alive() || day !== st.day) return;
        // 오늘 통화가 0건이면(새벽 · 영업 전) 어제로 바꿔 다시 부른다
        if (st.autoDay && !st.fallback && day === kstDay() && num(data?.stats?.calls) === 0) {
          st.fallback = true;
          st.day = yesterdayOf();
          return load({ quiet });
        }
        // 어제를 대신 보여 주는 중이면, 오늘 통화가 생겼는지 가끔 본다
        if (st.fallback && quiet) {
          const t = await api.get('/api/dashboard', { day: kstDay() }, { signal: ac.signal }).catch(() => null);
          if (!alive() || day !== st.day) return;
          if (t && num(t.stats?.calls) > 0) { st.fallback = false; st.day = kstDay(); st.data = null; return load(); }
        }
        // 방금 만든 요약이 아직 목록에 안 실렸으면 들고 있는 것을 쓴다
        if (data && !data.briefing && st.data?.briefing && st.data.day === data.day) data.briefing = st.data.briefing;
        st.data = data || {};
        st.meta = meta || st.meta;
        st.error = null;
        st.refreshFailed = false;
        st.loadedAt = new Date().toISOString();
      } catch (err) {
        if (err?.name === 'AbortError' || !alive() || day !== st.day) return;
        if (st.data) st.refreshFailed = true; else st.error = err;
      }
      st.loading = false;
      draw();
      if (st.data && !st.error) {
        maybeAutoBrief();
        loadSumText(day);
      }
    }

    async function loadSumText(day) {
      try {
        const r = await api.get('/api/briefing/text', { day }, { signal: ac.signal });
        if (!alive() || day !== st.day) return;
        const changed = st.sumText !== r?.text;
        st.sumText = typeof r?.text === 'string' ? r.text : '';
        st.sumDay = day;
        if (st.showText && changed) draw();
      } catch { /* 누를 때 다시 부른다 */ }
    }

    function maybeAutoBrief() {
      const d = st.data;
      if (!d || (d.briefing && !d.briefing.stale) || st.meta?.aiEnabled !== true) return;
      if (num(d.stats?.calls) === 0) return;
      if (AUTO_TRIED.has(st.day) || st.brief === 'loading') return;
      AUTO_TRIED.add(st.day);
      makeBrief();
    }

    async function makeBrief() {
      const day = st.day;
      const prev = st.data?.briefing?.createdAt || null;
      st.brief = 'loading';
      st.briefErr = null;
      draw();
      try {
        const b = await api.post('/api/briefing', { day }, { signal: ac.signal });
        if (!alive() || day !== st.day) return;
        if (st.data) st.data.briefing = b;
        st.brief = 'idle';
        if (prev && b?.createdAt === prev) toast('10분 안에 만든 요약이 있어 그것을 보여 드립니다.');
      } catch (err) {
        if (err?.name === 'AbortError' || !alive() || day !== st.day) return;
        st.brief = 'error';
        st.briefErr = err;
      }
      draw();
    }

    async function copySummary() {
      const day = st.day;
      if (st.sumText && st.sumDay === day) {
        const ok = await copyText(st.sumText);
        if (!ok && alive()) { st.showText = true; draw(); }
        return;
      }
      st.copying = true;
      draw();
      try {
        const r = await api.get('/api/briefing/text', { day }, { signal: ac.signal });
        if (!alive() || day !== st.day) return;
        st.sumText = typeof r?.text === 'string' ? r.text : '';
        st.sumDay = day;
        const ok = await copyText(st.sumText);
        if (!ok) st.showText = true;
      } catch (err) {
        if (err?.name === 'AbortError' || !alive()) return;
        toast(err?.message || '마감 요약을 만들지 못했습니다.', 'error');
      }
      st.copying = false;
      draw();
    }

    // ── 누르기 ──────────────────────────────────────────────────
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !root.contains(b)) return;
      const act = b.dataset.act;
      if (act === 'day') {
        const day = b.dataset.day;
        if (!isDay(day) || day === st.day) return;
        st.day = day;
        st.autoDay = false;
        st.fallback = false;
        st.data = null;
        st.error = null;
        st.brief = 'idle';
        st.briefErr = null;
        st.showText = false;
        load();
      } else if (act === 'reload') {
        load();
      } else if (act === 'brief') {
        makeBrief();
      } else if (act === 'copy') {
        copySummary();
      } else if (act === 'text') {
        st.showText = !st.showText;
        draw();
        if (st.showText && !(st.sumText && st.sumDay === st.day)) loadSumText(st.day).then(() => { if (alive()) draw(); });
      } else if (act === 'jump') {
        const target = root.querySelector(`#${b.dataset.to}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.focus({ preventScroll: true });
        }
      }
    }, { signal: ac.signal });

    const timer = setInterval(() => {
      if (alive() && !document.hidden && !st.loading) load({ quiet: true });
    }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && alive() && !st.loading && st.loadedAt && Date.now() - Date.parse(st.loadedAt) > REFRESH_MS) load({ quiet: true });
    }, { signal: ac.signal });

    load();
    return () => { clearInterval(timer); ac.abort(); };
  },
};
