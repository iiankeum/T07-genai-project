// 오늘 브리핑(F10) · 처리 대기열, AI 브리핑, 마감 요약과 통화 기록.
import { api } from '../api.js';
import { html, render, kstDay, fmtDate, fmtWhen, fmtClock, callChip, cardChip, toast, copyText, errorBox, aiOffNotice, href } from '../ui.js';
import { partsText, callHref } from './board.js';

const REFRESH_MS = 30_000;
const LIST_MAX = 6;
const TODO_PREVIEW = 3;
const TODO_KIND = {
  callback: { icon: 'phone', label: '다시 전화' },
  confirm: { icon: 'check', label: '확인 · 확정' },
  ship: { icon: 'box', label: '출고' },
  listen: { icon: 'play', label: '녹음 듣기' },
  retry: { icon: 'retry', label: '다시 처리' },
};
const ICON_PATHS = {
  arrow: 'm9 18 6-6-6-6',
  box: 'M3 7h18v14H3zM3 7l3-4h12l3 4m-12 5h6',
  calendar: 'M4 5h16v16H4zM8 3v4m8-4v4M4 10h16',
  check: 'M5 12l4 4L19 6',
  chevron: 'm6 9 6 6 6-6',
  copy: 'M9 9h11v12H9zm6 0V3H4v12h5',
  file: 'M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6',
  phone: 'M3 4h5l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v5C10 21 3 14 3 4Z',
  play: 'M8 5l11 7-11 7z',
  retry: 'M4 6v5h5M4 11a8 8 0 1 1 1 6',
  upload: 'M12 16V3m-4 4 4-4 4 4M4 15v6h16v-6',
  waveform: 'M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4',
};
function icon(name) {
  return html`<svg class="today-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${ICON_PATHS[name]}"></path></svg>`;
}
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
/** 'YYYY-MM-DD' → 그날 한국 낮 12시 ISO(fmtDate 에 넘기려고) */
const dayIso = (day) => `${day}T03:00:00.000Z`;
const yesterdayOf = () => kstDay(new Date(Date.now() - 86400_000));

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
      allTodos: false,
      openGroups: new Set(),
    };
    render(el, html`<div class="page today-page"></div>`);
    const root = el.firstElementChild;
    const alive = () => !ac.signal.aborted && root.isConnected;

    function headPart() {
      const today = kstDay();
      const yesterday = yesterdayOf();
      const isToday = st.day === today;
      const worker = st.meta.worker || {};
      const waiting = num(worker.queue?.waiting);
      const working = num(worker.queue?.working);
      return html`<header class="today-header">
        <div class="today-heading">
          <div>
            <p class="today-date">${icon('calendar')}<time datetime="${st.day}">${fmtDate(dayIso(st.day))}</time>
              ${st.meta.demo === true ? html`<span class="today-demo">가짜 통화 데모</span>` : ''}
            </p>
            <h1>오늘 브리핑</h1>
          </div>
          <div class="today-actions">
            <a class="btn" href="#/live" data-focus="live">${icon('waveform')}실시간 받아쓰기</a>
            <a class="btn btn-primary" href="#/upload" data-focus="upload">${icon('upload')}녹음 올리기</a>
          </div>
        </div>
        <div class="today-toolbar">
          <div class="today-day-switch" role="group" aria-label="날짜 고르기">
            ${[[yesterday, '어제'], [today, '오늘']].map(([day, label]) => html`
              <button type="button" data-act="day" data-day="${day}" data-focus="day-${label}" aria-pressed="${String(st.day === day)}">${label}</button>`)}
          </div>
          <p class="today-worker" title="${worker.online ? '' : '받아쓰기 워커가 연결되면 대기 중인 녹음을 처리합니다.'}">
            <span class="today-worker-state ${worker.online ? 'is-online' : ''}">
              <span class="today-worker-dot" aria-hidden="true"></span>${worker.online ? '받아쓰기 연결됨' : '받아쓰기 연결 대기'}
            </span>
            <span>대기 ${waiting}건${working ? ` · 처리 중 ${working}건` : ''}</span>
          </p>
        </div>
        ${st.fallback && !isToday ? html`<p class="today-fallback">오늘 통화가 들어오면 자동으로 오늘 브리핑을 표시합니다. 지금은 어제 기록을 보고 있습니다.</p>` : ''}
      </header>`;
    }

    function metricsPart(d, range) {
      const s = d.stats || {};
      const metric = (n, unit, label, link, id) => {
        const body = html`<span class="today-stat-label">${label}</span><span class="today-stat-value">${num(n)}<small>${unit}</small></span>`;
        return link
          ? html`<li><a class="today-stat" href="${link}" data-focus="stat-${id}">${body}</a></li>`
          : html`<li><button type="button" class="today-stat" data-act="jump" data-to="today-urgent" data-focus="stat-${id}">${body}</button></li>`;
      };
      const extra = [
        [s.working, '받아쓰는 중', '건'],
        [s.failed, '실패', '건'],
        [s.unsure, '들어 볼 곳', '곳'],
        [s.confirmed, '확정', '장'],
        [s.shipped, '출고 완료', '장'],
        ...Object.entries(s.byType || {}).map(([k, n]) => [n, k, '건']),
      ];
      return html`<section class="today-overview" aria-labelledby="today-stats-h">
        <h2 id="today-stats-h">오늘 현황</h2>
        <ul class="today-stat-row">
          ${metric(s.calls, '건', '통화', href('/calls', { ...range, status: 'all' }), 'calls')}
          ${metric(s.cards, '장', '주문 카드', '#/board', 'cards')}
          ${metric(s.draft, '건', '확인 필요', href('/calls', { ...range, status: 'draft' }), 'draft')}
          ${metric(s.callbacks, '곳', '다시 전화', href('/calls', { ...range, status: 'callback' }), 'callback')}
          ${metric(s.urgentOpen, '건', '급한 미출고', null, 'urgent')}
        </ul>
        <ul class="today-extra-stats">
          ${extra.filter(([n, label]) => num(n) || label === '확정' || label === '출고 완료').map(([n, label, unit]) => html`
            <li>${label} <strong>${num(n)}${unit}</strong></li>`)}
        </ul>
      </section>`;
    }

    function briefPart(d) {
      const meta = st.meta;
      const b = d.briefing;
      const fixture = b ? b.mode === 'fixture' : meta.aiProvider === 'fixture';
      const draftLabel = b?.mode === 'local' ? '로컬 AI 초안' : 'AI 초안';
      const hasCalls = num(d.stats?.calls) > 0;
      const canMake = meta.aiEnabled !== false && hasCalls;
      let body;
      if (st.brief === 'loading') {
        body = html`<p class="today-brief-wait" role="status"><span class="spinner" aria-hidden="true"></span>통화를 요약하는 중…</p>`;
      } else if (b?.paragraph) {
        body = html`<p class="today-brief-text">${b.paragraph}</p>
          ${Array.isArray(b.todos) && b.todos.length ? html`<h3>먼저 확인할 일</h3>
            <ul class="today-brief-list">${b.todos.map((t, i) => {
              const detail = html`<strong>${t.title}</strong>${t.why ? html`<span>${t.why}</span>` : ''}`;
              return html`<li>${t.callId
                ? html`<a href="${callHref(t.callId)}" data-focus="brief-call-${t.callId}-${i}">${detail}${icon('arrow')}</a>`
                : detail}</li>`;
            })}</ul>` : ''}`;
      } else if (!hasCalls) {
        body = html`<p>선택한 날짜에 요약할 통화가 없습니다.</p>`;
      } else if (canMake) {
        body = html`<p>통화를 읽고 주문 흐름과 먼저 할 일을 한 단락으로 정리합니다.</p>`;
      }
      return html`<section class="today-panel today-brief" aria-labelledby="brief-h">
        <div class="today-panel-head">
          <h2 id="brief-h">${icon('file')}AI 브리핑</h2>
          ${fixture && (canMake || b) ? html`<span class="today-fixture">가짜 테스트 응답</span>` : ''}
        </div>
        ${aiOffNotice(meta)}
        ${st.brief === 'error' ? errorBox(st.briefErr) : ''}
        ${body}
        ${b?.createdAt ? html`<p class="today-brief-meta">${draftLabel} · <time datetime="${b.createdAt}">${fmtWhen(b.createdAt)}</time>${b.stale ? ' · 작성 뒤 통화 현황이 바뀌었습니다.' : ''}</p>` : ''}
        ${canMake ? html`<button type="button" class="btn today-brief-button" data-act="brief" data-focus="brief" ${st.brief === 'loading' ? html`aria-disabled="true"` : ''}>${st.brief === 'loading' ? '요약 중…' : st.brief === 'error' ? '다시 해 보기' : b ? '다시 만들기' : 'AI 요약 만들기'}</button>` : ''}
      </section>`;
    }

    function closePart() {
      const ready = st.sumDay === st.day;
      return html`<section class="today-panel today-close" aria-labelledby="close-h">
        <div class="today-panel-head"><h2 id="close-h">${icon('copy')}마감 요약</h2></div>
        <p>통화와 주문 처리 현황을 카톡이나 문자로 공유할 수 있습니다.</p>
        <div class="today-close-actions">
          <button type="button" class="btn" data-act="copy" data-focus="copy" ${st.copying ? html`aria-disabled="true"` : ''}>${st.copying ? '복사 중…' : '마감 요약 복사'}</button>
          <button type="button" class="btn btn-ghost" data-act="text" data-focus="text" aria-controls="today-close-text" aria-expanded="${String(st.showText)}">${st.showText ? '글 접기' : '미리 보기'}</button>
        </div>
        <div id="today-close-text" ${st.showText ? '' : html`hidden`}>
          ${st.showText ? (ready
            ? html`<pre class="today-sum-text" tabindex="0" data-focus="summary-text">${st.sumText}</pre>`
            : html`<p class="today-brief-meta" role="status">글을 불러오는 중…</p>`) : ''}
        </div>
      </section>`;
    }

    function item({ title, detail, badge, time, link, key, mark }) {
      const content = html`${mark ? html`<span class="today-row-icon">${icon(mark)}</span>` : ''}
        <span class="today-row-body">
          <span class="today-row-top"><strong>${title}</strong>${badge}</span>
          ${detail ? html`<span class="today-row-detail">${detail}</span>` : ''}
        </span>
        ${time ? html`<time class="today-row-time" datetime="${time}">${fmtClock(time)}</time>` : ''}`;
      return html`<li>${link
        ? html`<a class="today-row" href="${link}" data-focus="${key}">${content}${icon('arrow')}</a>`
        : html`<div class="today-row">${content}</div>`}</li>`;
    }

    function todoGroup(todos, id, label) {
      if (!todos.length) return '';
      return html`<div class="today-priority-group">
        <h3 id="${id}">${label}</h3>
        <ul class="today-rows" aria-labelledby="${id}">${todos.map((t) => {
          const kind = TODO_KIND[t.kind] || { icon: 'file', label: '할 일' };
          return item({
            title: t.title, detail: t.why, mark: kind.icon,
            badge: html`<span class="today-kind">${kind.label}</span>`,
            link: t.callId ? callHref(t.callId) : '', key: `todo-${t.callId}`,
          });
        })}</ul>
      </div>`;
    }

    function queueGroup({ id, label, count, rows, empty, more }) {
      return html`<details class="today-queue-group" data-group id="${id}" ${st.openGroups.has(id) ? html`open` : ''}>
        <summary data-focus="${id}">
          <span>${label}</span><span class="today-group-count">${count}</span>${icon('chevron')}
        </summary>
        <div class="today-group-body">${rows.length
          ? html`<ul class="today-rows">${rows}</ul>${more || ''}`
          : html`<p class="today-empty">${empty}</p>`}</div>
      </details>`;
    }

    function queuePart(d, range) {
      const list = (v) => Array.isArray(v) ? v : [];
      const todos = list(d.todos).slice().sort((a, b) => num(a.priority || 3) - num(b.priority || 3));
      const visible = todos.slice(0, st.allTodos ? todos.length : TODO_PREVIEW);
      const urgent = visible.filter((t) => num(t.priority) === 1);
      const later = visible.filter((t) => num(t.priority) !== 1);
      const count = (rows, n) => Math.max(rows.length, num(n));
      const s = d.stats || {};
      const more = (n, link, label, key) => n > LIST_MAX
        ? html`<a class="today-text-action" href="${link}" data-focus="${key}">${label} (${n}) ${icon('arrow')}</a>` : '';
      const urgentRows = list(d.urgentOpen);
      const callbackRows = list(d.callbacks);
      const draftRows = list(d.drafts);
      const urg = count(urgentRows, s.urgentOpen);
      const callbacks = count(callbackRows, s.callbacks);
      const drafts = count(draftRows, s.draft);
      return html`<section class="today-panel today-queue" aria-labelledby="today-queue-h">
        <div class="today-panel-head"><h2 id="today-queue-h">지금 처리할 일</h2><span class="today-queue-count">${todos.length}건</span></div>
        <div id="today-priority">
          ${todoGroup(urgent, 'today-first-h', '우선 처리')}
          ${todoGroup(later, 'today-next-h', urgent.length ? '다음 할 일' : '처리 대기')}
          ${!todos.length ? html`<p class="today-empty">지금 처리할 일이 없습니다.</p>` : ''}
        </div>
        ${todos.length > TODO_PREVIEW ? html`<button type="button" class="today-text-action today-more-todos" data-act="todos" data-focus="more-todos" aria-controls="today-priority" aria-expanded="${String(st.allTodos)}">${st.allTodos ? '할 일 접기' : `할 일 더 보기 (${todos.length - TODO_PREVIEW})`} ${icon('chevron')}</button>` : ''}
        <div class="today-queue-groups">
          ${queueGroup({
            id: 'today-callbacks', label: '다시 전화할 곳', count: callbacks, empty: '다시 전화할 곳이 없습니다.',
            rows: callbackRows.slice(0, LIST_MAX).map((c) => item({
              title: c.customer || c.title || '거래처 확인 필요', time: c.recordedAt,
              detail: html`${c.reason}${Array.isArray(c.askBack) && c.askBack.length ? html`
                <span class="today-questions"><b>되물을 말</b> ${c.askBack.join(' · ')}</span>` : ''}`,
              link: callHref(c.callId), key: `callback-${c.callId}`,
            })),
            more: more(callbacks, href('/calls', { ...range, status: 'callback' }), '재연락 모두 보기', 'callback-more'),
          })}
          ${queueGroup({
            id: 'today-drafts', label: '확인 필요 카드', count: drafts, empty: '확인할 카드가 없습니다.',
            rows: draftRows.slice(0, LIST_MAX).map((c) => item({
              title: c.customer || '거래처 확인 필요', time: c.recordedAt,
              badge: c.urgent ? html`<span class="today-urgent-label">급함</span>` : '',
              detail: [c.title, num(c.askBackCount) ? `되물을 것 ${num(c.askBackCount)}개` : '', num(c.unsureCount) ? `들어 볼 곳 ${num(c.unsureCount)}개` : ''].filter(Boolean).join(' · '),
              link: callHref(c.callId), key: `draft-${c.callId}`,
            })),
            more: more(drafts, href('/calls', { ...range, status: 'draft' }), '확인 필요 모두 보기', 'draft-more'),
          })}
          ${queueGroup({
            id: 'today-urgent', label: '급한 미출고 주문', count: urg, empty: '급한 미출고 주문이 없습니다.',
            rows: urgentRows.slice(0, LIST_MAX).map((c) => item({
              title: c.customer || '거래처 확인 필요', badge: cardChip(c.status),
              detail: [c.title, c.due ? `원하는 때 ${c.due}` : '', c.delivery ? `받는 방법 ${c.delivery}` : ''].filter(Boolean).join(' · '),
              link: callHref(c.callId), key: `urgent-${c.callId}`,
            })),
            more: more(urg, '#/board', '보드에서 모두 보기', 'urgent-more'),
          })}
        </div>
      </section>`;
    }

    function recentPart(d, range) {
      const recent = Array.isArray(d.recent) ? d.recent : [];
      return html`<section class="today-panel today-recent" id="today-recent" aria-labelledby="today-recent-h">
        <div class="today-panel-head">
          <h2 id="today-recent-h">최근 통화</h2>
          <a class="today-text-action" href="${href('/calls', { ...range, status: 'all' })}" data-focus="recent-more">통화 기록 모두 보기 ${icon('arrow')}</a>
        </div>
        ${recent.length ? html`<ul class="today-rows">${recent.map((c) => item({
          title: c.title || c.customer || '통화', badge: callChip(c), time: c.recordedAt,
          detail: c.card ? partsText(c.card.items, 2, c.card.callType) : c.summary,
          link: callHref(c.id), key: `recent-${c.id}`,
        }))}</ul>` : html`<p class="today-empty">선택한 날짜에 통화가 없습니다.</p>`}
      </section>`;
    }

    function draw() {
      if (!alive()) return;
      const active = document.activeElement;
      const focus = root.contains(active) ? active.dataset.focus : null;
      const d = st.data;
      const range = { from: st.day, to: st.day };
      render(root, html`${headPart()}
        ${d ? html`<div class="today-workspace">
            ${queuePart(d, range)}
            <aside class="today-rail" aria-label="브리핑과 마감">${briefPart(d)}${closePart()}</aside>
          </div>
          ${metricsPart(d, range)}
          ${recentPart(d, range)}
          <p class="today-foot">${st.refreshFailed ? '새로 고치지 못했습니다. ' : ''}30초마다 새로 고침${st.loadedAt ? ` · 마지막 ${fmtClock(st.loadedAt)}` : ''}</p>`
          : html`<div class="today-panel today-load">${st.error
            ? html`${errorBox(st.error)}<button type="button" class="btn btn-primary" data-act="reload" data-focus="reload">다시 불러오기</button>`
            : html`<p class="loading" role="status"><span class="spinner" aria-hidden="true"></span>통화와 주문 현황을 불러오는 중…</p>`}</div>`}
      `);
      if (focus) {
        [...root.querySelectorAll('[data-focus]')].find((node) => node.dataset.focus === focus)?.focus({ preventScroll: true });
      }
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
      if (st.data && !st.error) loadSumText(day);
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
      st.copying = true;
      try {
        if (st.sumDay !== day) {
          draw();
          const r = await api.get('/api/briefing/text', { day }, { signal: ac.signal });
          if (!alive() || day !== st.day) return;
          st.sumText = typeof r?.text === 'string' ? r.text : '';
          st.sumDay = day;
        }
        const ok = await copyText(st.sumText);
        if (!ok && alive() && day === st.day) st.showText = true;
      } catch (err) {
        if (err?.name === 'AbortError' || !alive() || day !== st.day) return;
        toast(err?.message || '마감 요약을 만들지 못했습니다.', 'error');
      } finally {
        if (alive() && day === st.day) {
          st.copying = false;
          draw();
        }
      }
    }

    // ── 누르기 ──────────────────────────────────────────────────
    root.addEventListener('toggle', (e) => {
      const group = e.target;
      if (!group.matches('details[data-group]') || !root.contains(group)) return;
      if (group.open) st.openGroups.add(group.id);
      else st.openGroups.delete(group.id);
    }, { capture: true, signal: ac.signal });

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
        st.copying = false;
        st.allTodos = false;
        st.openGroups.clear();
        load();
      } else if (act === 'reload') {
        load();
      } else if (act === 'brief') {
        if (st.brief !== 'loading') makeBrief();
      } else if (act === 'copy') {
        if (!st.copying) copySummary();
      } else if (act === 'todos') {
        st.allTodos = !st.allTodos;
        draw();
      } else if (act === 'text') {
        st.showText = !st.showText;
        draw();
        if (st.showText && st.sumDay !== st.day) loadSumText(st.day).then(() => { if (alive()) draw(); });
      } else if (act === 'jump') {
        const target = root.querySelector(`#${b.dataset.to}`);
        if (target) {
          target.open = true;
          st.openGroups.add(target.id);
          const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
          target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
          target.querySelector('summary')?.focus({ preventScroll: true });
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
