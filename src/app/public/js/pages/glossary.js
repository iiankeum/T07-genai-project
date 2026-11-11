// F07 낱말 사전 — 현장 말(틀리기 쉬운 말 포함) · 거래처(가짜 번호) · 차종. 넣기 · 지우기 · 찾기.
import { api } from '../api.js';
import { html, render, toast, confirmBox, errorBox } from '../ui.js';

const TABS = [
  { id: 'field', label: '현장 말', kinds: ['현장말', '오인식'] },
  { id: 'customer', label: '거래처', kinds: ['거래처'] },
  { id: 'car', label: '차종', kinds: ['차종'] },
];
// 서버가 영어 이름이나 띄어 쓴 이름으로 줘도 DB 값(현장말 · 오인식 · 거래처 · 차종)으로 맞춘다
const KIND_MAP = {
  현장말: '현장말', '현장 말': '현장말', slang: '현장말', term: '현장말', terms: '현장말', field: '현장말', jargon: '현장말',
  오인식: '오인식', misheard: '오인식', mishear: '오인식', asr: '오인식', mistake: '오인식',
  거래처: '거래처', customer: '거래처', customers: '거래처', shop: '거래처',
  차종: '차종', car: '차종', cars: '차종', carModel: '차종', carModels: '차종', car_model: '차종', vehicle: '차종',
};
const FIELD_LABELS = {
  현장말: { term: '현장 말', termPh: '예: 휀다', std: '표준 말', stdPh: '예: 펜더' },
  오인식: { term: '틀리게 들린 말', termPh: '예: 헨더', std: '바른 말', stdPh: '예: 휀다' },
};

function normalize(data) {
  let list = [];
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object') {
    const arr = data.items || data.entries || data.glossary || data.rows || data.list;
    if (Array.isArray(arr)) list = arr;
    else {
      // 종류별로 묶어 온 경우: {현장말:[...], 거래처:[...]} 또는 {terms, customers, carModels}
      for (const [k, v] of Object.entries(data)) {
        if (!Array.isArray(v)) continue;
        for (const x of v) list.push(typeof x === 'string' ? { kind: KIND_MAP[k] || k, term: x } : { ...x, kind: x?.kind || KIND_MAP[k] || k });
      }
    }
  }
  return list.filter((x) => x && typeof x === 'object').map((x) => ({
    id: x.id ?? null,
    kind: KIND_MAP[x.kind] || x.kind || '현장말',
    term: String(x.term ?? x.name ?? '').trim(),
    standard: String(x.standard ?? x.fixed ?? '').trim(),
    phone: x.phone ? String(x.phone) : '',
    note: String(x.note ?? '').trim(),
    status: x.status || 'approved',
    builtin: x.source === '기본' || ['default', 'seed', 'builtin', 'system'].includes(x.source) || x.builtin === true || x.isDefault === true,
  })).filter((x) => x.term);
}

export default {
  title: '낱말 사전',
  async mount(el, ctx) {
    let tab = TABS.some((t) => t.id === ctx.query?.tab) ? ctx.query.tab : 'field';
    let items = [];
    let q = '';
    let loading = true;
    let loadError = null;
    let busy = false;
    let disposed = false;

    render(el, html`<div class="page page-narrow gl-page">
      <div class="page-head"><div>
        <p class="eyebrow">F07 · 낱말 사전</p>
        <h1>낱말 사전</h1>
        <p class="sub">현장 말 · 거래처 · 차종을 넣어 두면 AI 가 더 잘 알아듣습니다.</p>
      </div></div>
      <div class="notice" role="note">여기 넣은 말은 받아쓰기 힌트와 AI 카드 정리에 같이 쓰입니다. 넣은 뒤 통화 화면의 「AI 로 다시 정리」를 누르면 반영됩니다.</div>
      <div class="tabs gl-tabs" role="tablist" aria-label="사전 종류" data-ref="tabs"></div>
      <section class="card gl-form-card" aria-labelledby="glFormTitle">
        <h2 id="glFormTitle" class="gl-form-title" data-ref="formTitle"></h2>
        <form class="gl-form" data-ref="form" novalidate></form>
      </section>
      <div class="gl-search">
        <label class="sr-only" for="glSearch">목록에서 찾기</label>
        <input id="glSearch" class="input input-search" type="search" placeholder="목록에서 찾기 (예: 쇼바)" autocomplete="off" data-ref="search">
      </div>
      <div role="tabpanel" data-ref="panel" aria-live="off"></div>
    </div>`);

    const root = el.querySelector('.gl-page');
    const ref = (n) => root.querySelector(`[data-ref="${n}"]`);

    const tabItems = (id) => { const t = TABS.find((x) => x.id === id); return items.filter((i) => t.kinds.includes(i.kind)); };

    function renderTabs() {
      render(ref('tabs'), html`${TABS.map((t) => html`<button type="button" class="tab" role="tab" id="glTab-${t.id}" aria-selected="${String(t.id === tab)}" data-act="tab" data-tab="${t.id}">${t.label}${loading ? '' : html` <span class="count">${tabItems(t.id).length}</span>`}</button>`)}`);
      ref('panel').setAttribute('aria-labelledby', `glTab-${tab}`);
    }

    function renderForm() {
      const form = ref('form');
      if (tab === 'field') {
        ref('formTitle').textContent = '현장 말 넣기';
        render(form, html`
          <label class="field"><span>종류</span>
            <select class="select" name="kind">
              <option value="현장말">현장 말 (예: 휀다 → 펜더)</option>
              <option value="오인식">틀리기 쉬운 말 — 받아쓰기가 자주 틀리는 말 (예: 헨더 → 휀다)</option>
            </select></label>
          <div class="gl-pair">
            <label class="field"><span data-ref="termLabel">현장 말</span><input class="input" name="term" maxlength="40" placeholder="예: 휀다" required autocomplete="off"></label>
            <span class="gl-pair-arrow" aria-hidden="true">→</span>
            <label class="field"><span data-ref="stdLabel">표준 말</span><input class="input" name="standard" maxlength="60" placeholder="예: 펜더" required autocomplete="off"></label>
          </div>
          <label class="field"><span>메모 (선택)</span><input class="input" name="note" maxlength="200" placeholder="예: 앞 휀다 · 뒤 휀다로도 말함" autocomplete="off"></label>
          <div data-ref="formMsg"></div>
          <button type="submit" class="btn btn-primary btn-block">사전에 넣기</button>`);
      } else if (tab === 'customer') {
        ref('formTitle').textContent = '거래처 넣기';
        render(form, html`
          <label class="field"><span>거래처 이름</span><input class="input" name="term" maxlength="40" placeholder="예: 새한카센터 (지어낸 이름)" required autocomplete="off"></label>
          <label class="field"><span>전화번호 (가짜 번호만 · 선택)</span><input class="input" name="phone" type="tel" inputmode="tel" maxlength="20" placeholder="예: 010-0000-0199" autocomplete="off">
            <span class="help">걸려 온 번호가 이 번호와 같으면 카드의 거래처를 이 이름으로 채웁니다.</span></label>
          <label class="field"><span>메모 (선택)</span><input class="input" name="note" maxlength="200" placeholder="예: 김 실장 · 오전 배송" autocomplete="off"></label>
          <div data-ref="formMsg"></div>
          <button type="submit" class="btn btn-primary btn-block">거래처 넣기</button>`);
      } else {
        ref('formTitle').textContent = '차종 넣기';
        render(form, html`
          <label class="field"><span>차종 (세대까지)</span><input class="input" name="term" maxlength="40" placeholder="예: 쏘렌토 MQ4" required autocomplete="off"></label>
          <label class="field"><span>메모 (선택)</span><input class="input" name="note" maxlength="200" placeholder="예: 엠큐포라고도 부름" autocomplete="off"></label>
          <div data-ref="formMsg"></div>
          <button type="submit" class="btn btn-primary btn-block">차종 넣기</button>`);
      }
    }

    function itemView(it) {
      const showStd = it.kind === '현장말' || it.kind === '오인식' || (it.kind === '차종' && it.standard);
      return html`<li class="list-item gl-item">
        <div class="gl-body">
          <div class="gl-main">
            <span class="gl-term">${it.term}</span>
            ${showStd && it.standard ? html`<span class="gl-arrow" aria-label="표준 말">→</span><span class="gl-std">${it.standard}</span>` : ''}
          </div>
          ${it.kind === '거래처' && it.phone ? html`<div class="gl-phone"><span class="chip chip-phone">가짜 번호</span> ${it.phone}</div>` : ''}
          ${it.note ? html`<p class="gl-note">${it.note}</p>` : ''}
          <div class="gl-chips">
            ${it.kind === '오인식' ? html`<span class="chip chip-draft">틀리기 쉬운 말</span>` : ''}
            ${it.builtin ? html`<span class="chip chip-cancelled">기본</span>` : html`<span class="chip chip-ai">사용자</span>`}
            ${it.status === 'pending' ? html`<span class="chip chip-working">검토 대기</span>` : ''}
          </div>
        </div>
        ${it.id != null ? html`<button type="button" class="btn btn-danger gl-del" data-act="del" data-id="${it.id}" aria-label="${it.term} 지우기">지우기</button>` : ''}
      </li>`;
    }

    function renderPanel() {
      if (disposed) return;
      const panel = ref('panel');
      if (loading) { render(panel, html`<p class="loading">불러오는 중…</p>`); return; }
      if (loadError) {
        render(panel, html`${errorBox(loadError)}<button type="button" class="btn" data-act="reload">다시 불러오기</button>`);
        return;
      }
      const all = tabItems(tab);
      const needle = q.trim().toLowerCase();
      const shown = needle ? all.filter((i) => [i.term, i.standard, i.note, i.phone].some((v) => String(v || '').toLowerCase().includes(needle))) : all;
      const label = TABS.find((t) => t.id === tab).label;
      render(panel, html`
        <p class="gl-count muted small">${needle ? `「${q.trim()}」 찾은 결과 ${shown.length}개 / ${label} ${all.length}개` : `${label} ${all.length}개`}</p>
        ${shown.length
          ? html`<ul class="list list-wrap gl-list">${shown.map(itemView)}</ul>`
          : html`<div class="empty"><p>${needle ? '찾는 말이 없습니다.' : '아직 넣은 말이 없습니다. 위에서 한 줄 넣어 보세요.'}</p></div>`}`);
    }

    async function load() {
      loading = true;
      loadError = null;
      renderTabs();
      renderPanel();
      try {
        const data = await api.get('/api/glossary');
        if (disposed) return;
        items = normalize(data);
      } catch (err) {
        if (disposed) return;
        loadError = err;
      }
      loading = false;
      renderTabs();
      renderPanel();
    }

    function formMsg(content) {
      const box = ref('form').querySelector('[data-ref="formMsg"]');
      if (box) render(box, content || html``);
    }

    async function submit(form) {
      if (busy) return;
      const fd = new FormData(form);
      const get = (k) => String(fd.get(k) || '').trim();
      const kind = tab === 'field' ? (get('kind') === '오인식' ? '오인식' : '현장말') : tab === 'customer' ? '거래처' : '차종';
      const body = { kind, term: get('term') };
      if (tab === 'field') body.standard = get('standard');
      if (tab === 'customer' && get('phone')) body.phone = get('phone');
      if (get('note')) body.note = get('note');
      if (!body.term) { formMsg(html`<div class="notice notice-error" role="alert">${tab === 'customer' ? '거래처 이름' : tab === 'car' ? '차종' : FIELD_LABELS[kind].term}을 써 주세요.</div>`); form.elements.term?.focus(); return; }
      if (tab === 'field' && !body.standard) { formMsg(html`<div class="notice notice-error" role="alert">${FIELD_LABELS[kind].std}을 써 주세요.</div>`); form.elements.standard?.focus(); return; }
      if (body.phone && (!/^[0-9-]+$/.test(body.phone) || body.phone.replace(/-/g, '').length < 7 || body.phone.replace(/-/g, '').length > 13)) { formMsg(html`<div class="notice notice-error" role="alert">전화번호는 숫자와 - 만 써 주세요(가짜 번호만, 예: 010-0000-0199).</div>`); form.elements.phone?.focus(); return; }
      busy = true;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      formMsg('');
      try {
        await api.post('/api/glossary', body);
        if (disposed) return;
        toast('넣었습니다. 통화 화면에서 「AI 로 다시 정리」를 누르면 반영됩니다.', 'ok');
        form.reset();
        if (tab === 'field') syncFieldLabels(form);
        await load();
      } catch (err) {
        if (disposed) return;
        formMsg(html`<div class="notice notice-error" role="alert">${err?.message || '넣지 못했습니다.'}</div>`);
      } finally {
        busy = false;
        if (btn && !disposed) btn.disabled = false;
      }
    }

    async function remove(id) {
      const it = items.find((i) => String(i.id) === String(id));
      if (!it || busy) return;
      const ok = await confirmBox(`「${it.term}」을(를) 사전에서 지울까요?`);
      if (!ok || disposed) return;
      busy = true;
      try {
        await api.del('/api/glossary/' + encodeURIComponent(it.id));
        if (disposed) return;
        toast('지웠습니다.', 'ok');
        await load();
      } catch (err) {
        if (disposed) return;
        toast(err?.message || '지우지 못했습니다.', 'error');
      } finally {
        busy = false;
      }
    }

    function syncFieldLabels(form) {
      const kind = form.elements.kind?.value === '오인식' ? '오인식' : '현장말';
      const L = FIELD_LABELS[kind];
      const tl = form.querySelector('[data-ref="termLabel"]');
      const sl = form.querySelector('[data-ref="stdLabel"]');
      if (tl) tl.textContent = L.term;
      if (sl) sl.textContent = L.std;
      if (form.elements.term) form.elements.term.placeholder = L.termPh;
      if (form.elements.standard) form.elements.standard.placeholder = L.stdPh;
    }

    const onClick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled || !root.contains(b)) return;
      const act = b.dataset.act;
      if (act === 'tab' && b.dataset.tab !== tab) {
        tab = b.dataset.tab;
        renderTabs();
        renderForm();
        renderPanel();
      } else if (act === 'del') remove(b.dataset.id);
      else if (act === 'reload') load();
    };
    const onSubmit = (e) => { if (e.target === ref('form')) { e.preventDefault(); submit(e.target); } };
    const onChange = (e) => { if (e.target.name === 'kind' && e.target.form === ref('form')) syncFieldLabels(e.target.form); };
    const onSearch = (e) => { if (e.target === ref('search')) { q = e.target.value; renderPanel(); } };
    // 탭 사이를 화살표 키로 옮기기
    const onKey = (e) => {
      if (!e.target.matches('[role="tab"]') || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const i = TABS.findIndex((t) => t.id === tab);
      const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      tab = next.id;
      renderTabs();
      renderForm();
      renderPanel();
      root.querySelector(`#glTab-${next.id}`)?.focus();
    };

    root.addEventListener('click', onClick);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onSearch);
    root.addEventListener('keydown', onKey);

    renderTabs();
    renderForm();
    await load();

    return () => {
      disposed = true;
      root.removeEventListener('click', onClick);
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('change', onChange);
      root.removeEventListener('input', onSearch);
      root.removeEventListener('keydown', onKey);
    };
  },
};
