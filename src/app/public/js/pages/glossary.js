import { api } from '../api.js';
import { html, render, toast, confirmBox, errorBox, fmtWhen, href } from '../ui.js';

const KIND_LABEL = { 현장말: '현장 말', 오인식: '오인식', 거래처: '거래처', 차종: '차종', 부품: '부품', '업무 절차': '업무 절차' };
const STATUS = { approved: '승인됨', pending: '검토 대기', rejected: '반려', archived: '보관', superseded: '다른 버전 적용' };
const FILTERS = [['all', '전체'], ['approved', '승인됨'], ['pending', '검토 대기'], ['rejected', '반려'], ['archived', '보관']];
const FIELDS = [
  ['kind', '분류'], ['term', '대표 용어'], ['standard', '표준 표현'], ['phone', '거래처 전화번호'], ['note', '정의와 사용 맥락'],
  ['evidenceNote', '출처와 근거'], ['aliases', '별칭'], ['relations', '연결된 지식'], ['sourceCallId', '출처 통화'], ['sourceSegIndex', '출처 문장'],
];
const idPath = (id) => '/api/knowledge/' + encodeURIComponent(id);
const revisionPath = (id, revision) => idPath(id) + '/revisions/' + encodeURIComponent(revision);

function statusChip(status) {
  const color = { approved: 'confirmed', pending: 'working', rejected: 'draft', archived: 'cancelled', superseded: 'cancelled' };
  return html`<span class="chip chip-${color[status] || 'cancelled'}">${STATUS[status] || status}</span>`;
}

function valueOf(content, key) {
  const value = content?.[key];
  if (key === 'kind') return KIND_LABEL[value] || value || '';
  if (key === 'relations') return (value || []).map(({ relation, target }) => relation + ' → ' + target).join('\n');
  if (key === 'aliases') return (value || []).join(', ');
  if (key === 'sourceSegIndex') return value == null ? '' : String(value + 1);
  return value ?? '';
}

function callSource(data) {
  const call = data.sourceCall;
  if (!data.sourceCallId) return '';
  if (!call) return html`<a href="${href('/calls/' + encodeURIComponent(data.sourceCallId), { seg: data.sourceSegIndex })}">출처 통화 열기 →</a>`;
  return html`<a class="kn-source" href="${href('/calls/' + encodeURIComponent(call.id), { seg: data.sourceSegIndex, t: call.segment?.start })}">
    <strong>${call.title || '출처 통화'}</strong>
    <span>${fmtWhen(call.recordedAt)}${call.segment?.text ? html` · ${call.segment.text}` : ''}</span>
  </a>`;
}

export default {
  title: '공유 지식',
  mount(el, ctx) {
    let items = [];
    let kinds = Object.keys(KIND_LABEL);
    let canPropose = false;
    let canReview = false;
    let selected = ctx.query?.id || '';
    let filter = 'all';
    let category = ({ field: '현장말', customer: '거래처', car: '차종' })[ctx.query?.tab] || '';
    let q = '';
    let busy = false;
    let disposed = false;
    let detailSeq = 0;
    let dialogState = null;

    render(el, html`<div class="page kn-page">
      <div class="page-head">
        <div><h1 data-ref="page-title">공유 지식</h1><p class="sub" data-ref="page-description">현장 용어와 업무 규칙을 모아 팀과 함께 사용하세요.</p></div>
        <div class="ka-actions" data-ref="actions"></div>
      </div>
      <div class="ka-metrics" aria-label="지식 현황" data-ref="metrics"></div>
      <section class="card ka-split kn-layout" aria-label="공유 지식 목록과 상세">
        <div class="kn-sidebar">
          <label class="sr-only" for="kn-search">지식 검색</label>
          <input class="input" id="kn-search" type="search" placeholder="용어, 별칭, 설명 검색">
          <label class="sr-only" for="kn-kind">지식 분류</label>
          <select class="select" id="kn-kind" data-ref="kinds"></select>
          <div class="ka-actions kn-filters" aria-label="상태 필터" data-ref="filters"></div>
          <div class="kn-list" data-ref="list"><p class="loading" role="status">지식을 불러오는 중…</p></div>
        </div>
        <div class="kn-detail" data-ref="detail"></div>
      </section>
      <dialog class="ka-dialog" aria-labelledby="kn-dialog-title" data-ref="dialog"></dialog>
      <input type="file" accept=".csv,text/csv" data-ref="file" hidden>
    </div>`);

    const root = el.firstElementChild;
    const ref = (name) => root.querySelector(`[data-ref="${name}"]`);
    const dialog = ref('dialog');

    function visibleItems() {
      const needle = q.trim().toLowerCase();
      return items.filter((item) => {
        const statusMatches = filter === 'all' ? item.status !== 'archived' : filter === 'pending' ? item.status === 'pending' || item.pendingCount > 0 : item.status === filter;
        return statusMatches && (!category || item.kind === category) &&
          [item.term, item.standard, item.note, ...item.aliases].some((part) => String(part || '').toLowerCase().includes(needle));
      });
    }

    function paintList() {
      if (disposed) return;
      ref('page-title').textContent = category === '거래처' ? '거래처' : '공유 지식';
      ref('page-description').textContent = category === '거래처' ? '거래처 이름과 전화번호를 확인하고 수정안을 제안하세요. 분류를 바꾸면 다른 공유 지식도 볼 수 있어요.' : '현장 용어와 업무 규칙을 모아 팀과 함께 사용하세요.';
      render(ref('filters'), html`${FILTERS.map(([key, label]) => html`<button type="button" class="btn kn-filter" aria-pressed="${filter === key}" data-act="filter" data-value="${key}">${label}</button>`)}`);
      const shown = visibleItems();
      render(ref('list'), shown.length ? html`<ul class="kn-items">${shown.map((item) => html`<li>
        <button type="button" class="kn-item" data-act="select" data-id="${item.id}" aria-pressed="${selected === item.id}">
          <span class="kn-item-meta"><span>${KIND_LABEL[item.kind]}</span>${statusChip(item.status)}</span>
          <strong>${item.term}</strong>
          ${item.aliases.length ? html`<span class="kn-alias-line">${item.aliases.join(' · ')}</span>` : ''}
          <span class="kn-item-meta">${item.status === 'approved' ? `버전 ${item.version}` : ''}${item.pendingCount ? ` · 검토 대기 ${item.pendingCount}건` : ''}</span>
        </button></li>`)}</ul>` : html`<p class="muted">조건에 맞는 지식이 없어요.</p>`);
    }

    function paintOverview() {
      const active = items.filter((item) => item.status !== 'archived');
      const stats = [
        ['승인된 지식', active.filter((item) => item.status === 'approved').length],
        ['검토 대기', active.reduce((n, item) => n + (item.pendingCount || Number(item.status === 'pending')), 0)],
        ['연결된 관계', active.reduce((n, item) => n + item.relations.length, 0)],
      ];
      render(ref('metrics'), html`${stats.map(([label, n]) => html`<div class="card ka-metric"><span>${label}</span><strong>${n}</strong></div>`)}`);
      render(ref('actions'), canPropose ? html`
        <a class="btn" href="${api.url('/api/knowledge.csv')}" download>CSV 내려받기</a>
        <button class="btn" type="button" data-act="import">CSV 가져오기</button>
        <button class="btn btn-primary" type="button" data-act="new">＋ 지식 제안</button>` : '');
      render(ref('kinds'), html`<option value="">모든 분류</option>${kinds.map((kind) => html`<option value="${kind}">${KIND_LABEL[kind]}</option>`)}`);
      ref('kinds').value = category;
    }

    function paintDetail(item) {
      const pending = item.revisions.filter((revision) => revision.status === 'pending');
      const history = item.revisions.filter((revision) => revision.status !== 'pending');
      render(ref('detail'), html`
        <button class="btn btn-ghost kn-back-list" type="button" data-act="back-list">← 목록으로</button>
        <div class="kn-detail-header">
          <div>
            <p class="kn-item-meta">${KIND_LABEL[item.kind]}${item.version ? ` · 버전 ${item.version}` : ''}</p>
            <h2 id="kn-detail-title" tabindex="-1">${item.term}</h2>
            <div class="ka-actions">${statusChip(item.status)}${item.status === 'approved' ? html`<span class="help">현재 사용하는 승인본</span>` : html`<span class="help">아직 AI가 참고하지 않는 내용</span>`}</div>
          </div>
          <div class="ka-actions">
            ${canPropose && item.status !== 'archived' ? html`<button type="button" class="btn" data-act="edit">수정 제안</button>` : ''}
            ${canReview && item.status !== 'archived' ? html`<button type="button" class="btn btn-ghost" data-act="archive">보관</button>` : ''}
          </div>
        </div>
        ${pending.length ? html`<section class="kn-section kn-review">
          <h3>검토할 제안 ${pending.length}건</h3>
          <p class="help">${item.status === 'approved' ? '아래 수정안은 아직 적용되지 않았습니다. 승인하면 현재 승인본을 대신합니다.' : '아래 제안은 아직 적용되지 않았습니다. 내용을 확인하고 승인해야 AI가 참고합니다.'}</p>
          ${pending.map((rev) => html`<div class="kn-history-row">
            <div><strong>${rev.content.term} ${item.version ? '수정안' : '제안'}</strong><span class="help">${fmtWhen(rev.createdAt)}</span></div>
            <div class="ka-actions">
              <button class="btn" type="button" data-act="compare" data-id="${rev.id}">내용 검토</button>
              ${canReview ? html`<button class="btn" type="button" data-act="reject" data-id="${rev.id}">반려</button><button class="btn btn-primary" type="button" data-act="approve" data-id="${rev.id}">승인</button>` : ''}
            </div>
          </div>`)}
        </section>` : ''}
        ${item.aliases.length ? html`<div class="ka-actions kn-aliases">${item.aliases.map((alias) => html`<span class="chip chip-ai">${alias}</span>`)}</div>` : ''}
        <section class="kn-section">
          <h3>어떤 뜻인가요?</h3>
          ${item.standard ? html`<p><strong>표준 표현</strong> ${item.standard}</p>` : ''}
          ${item.phone ? html`<p><strong>전화번호</strong> ${item.phone}</p>` : ''}
          <p class="ka-prewrap">${item.note || '등록된 설명이 없어요.'}</p>
        </section>
        ${item.relations.length ? html`<section class="kn-section"><h3>함께 알아둘 정보</h3>
          <ul class="kn-relations">${item.relations.map(({ relation, target }) => html`<li>
            <span>${relation}</span>
            <button class="btn btn-ghost" type="button" data-act="relation" data-value="${target}">${target} →</button>
          </li>`)}</ul></section>` : ''}
        <section class="kn-section">
          <h3>출처와 근거</h3>
          <p>${item.evidenceNote || item.source || '등록된 출처가 없어요.'}</p>
          ${callSource(item)}
          <p class="help">마지막 변경 ${fmtWhen(item.updatedAt)}</p>
        </section>

        <details class="kn-section kn-history">
          <summary>변경 이력 <span>${history.length}건</span></summary>
          ${history.length ? history.map((rev) => html`<div class="kn-history-row">
            <div><strong>${rev.version ? `버전 ${rev.version} · ` : ''}${STATUS[rev.status]}</strong>
              <span class="help">${fmtWhen(rev.reviewedAt || rev.createdAt)}</span>
              ${rev.reason ? html`<p>${rev.reason}</p>` : ''}
            </div>
            <div class="ka-actions">
              <button class="btn btn-ghost" type="button" data-act="compare" data-id="${rev.id}">비교</button>
              ${canReview && (rev.status === 'archived' || (rev.status === 'approved' && (item.status !== 'approved' || item.version !== rev.version)))
                ? html`<button class="btn" type="button" data-act="restore" data-id="${rev.id}">복원 제안</button>` : ''}
            </div>
          </div>`) : html`<p class="help">승인, 반려, 복원 이력이 여기에 표시됩니다.</p>`}
        </details>`);
    }

    let detail = null;
    async function select(id, focusDetail = false) {
      if (disposed) return;
      const seq = ++detailSeq;
      selected = id || '';
      detail = null;
      paintList();
      if (!selected) {
        render(ref('detail'), html`<div class="empty"><p>목록에서 지식을 선택해 주세요.</p></div>`);
        return;
      }
      render(ref('detail'), html`<p class="loading" role="status">지식 상세를 불러오는 중…</p>`);
      try {
        const { item } = await api.get(idPath(selected));
        if (disposed || seq !== detailSeq) return;
        detail = item;
        paintDetail(item);
        if (focusDetail) {
          ref('detail').querySelector('#kn-detail-title').focus({ preventScroll: true });
          ref('detail').scrollIntoView({ block: 'start', behavior: 'instant' });
        }
      } catch (error) {
        if (disposed || seq !== detailSeq) return;
        render(ref('detail'), html`${errorBox(error)}<button type="button" class="btn" data-act="reload">다시 불러오기</button>`);
      }
    }

    async function load(id = selected) {
      try {
        const data = await api.get('/api/knowledge');
        if (disposed) return;
        ({ items, kinds, canPropose, canReview } = data);
        paintOverview();
        await select(id || visibleItems()[0]?.id);
      } catch (error) {
        if (disposed) return;
        render(ref('list'), html`${errorBox(error)}<button type="button" class="btn" data-act="reload">다시 불러오기</button>`);
      }
    }

    function showDialog(title, contents) {
      render(dialog, html`<div class="ka-dialog-head"><h2 id="kn-dialog-title">${title}</h2>
        <button class="btn btn-ghost ka-close" type="button" aria-label="닫기" data-act="close">×</button></div>${contents}`);
      if (!dialog.open) dialog.showModal();
    }

    let relationRowId = 0;
    function relationRow(entry = {}) {
      const n = ++relationRowId;
      return html`<div class="kn-relation-row" data-relation-row>
        <label class="field"><span>어떤 관계인가요?</span><input class="input" name="relation-label" maxlength="60" value="${entry.relation || ''}" placeholder="예: 함께 쓰는 부품" aria-describedby="kn-relations-help"></label>
        <label class="field"><span>무엇과 연결되나요?</span><input class="input" name="relation-target" maxlength="80" value="${entry.target || ''}" list="kn-relation-targets" placeholder="이름을 고르거나 직접 입력" aria-describedby="kn-relations-help"></label>
        <button type="button" class="btn btn-ghost kn-relation-remove" data-act="relation-remove" aria-label="연결 정보 ${n} 삭제">삭제</button>
      </div>`;
    }
    function syncRelationAdd() {
      const button = dialog.querySelector('[data-act="relation-add"]');
      if (button) button.disabled = dialog.querySelectorAll('[data-relation-row]').length >= 10;
    }

    function suggest(initial = {}, id = null, title) {
      if (!canPropose) return;
      const data = { kind: '현장말', ...initial };
      dialogState = { type: 'suggest', id, data };
      showDialog(title || (id ? '지식 수정 제안' : '새 지식 제안'), html`
        <form class="ka-form" data-form="suggest">
          <div class="ka-two">
            <label class="field"><span>대표 용어</span><input class="input" name="term" maxlength="80" value="${data.term || ''}" required></label>
            <label class="field"><span>분류</span><select class="select" name="kind">${kinds.map((kind) => html`<option value="${kind}" ${kind === data.kind ? 'selected' : ''}>${KIND_LABEL[kind]}</option>`)}</select></label>
          </div>
          <label class="field"><span>별칭</span><input class="input" name="aliases" maxlength="300" value="${(data.aliases || []).join(', ')}" placeholder="예: 앞범퍼, 전범퍼"></label>
          <label class="field" data-ref="standard"><span>표준 표현</span><input class="input" name="standard" maxlength="60" value="${data.standard || ''}"></label>
          <label class="field" data-ref="phone"><span>거래처 전화번호</span><input class="input" name="phone" type="tel" maxlength="20" value="${data.phone || ''}" placeholder="010-0000-0199"></label>
          <label class="field"><span>정의와 업무에서의 의미</span><textarea class="textarea" name="note" rows="3" maxlength="2000" required>${data.note || ''}</textarea></label>
          <label class="field"><span>출처와 근거</span><input class="input" name="evidenceNote" maxlength="300" value="${data.evidenceNote || ''}" placeholder="예: 공급사 문서명과 확인 날짜" ${!data.sourceCallId ? 'required' : ''}></label>
          ${data.sourceCallId ? html`<p class="help">${callSource(data)}</p>` : ''}
          <fieldset class="kn-relation-editor"><legend>함께 알아둘 정보 <span>(선택)</span></legend>
            <p class="help" id="kn-relations-help">다른 용어나 부품과의 관계를 적어 두세요. 예: 앞 브레이크 패드 → 함께 쓰는 부품 → 앞 디스크. 최대 10개.</p>
            <div data-ref="relation-rows">${(data.relations || []).map(relationRow)}</div>
            <datalist id="kn-relation-targets">${items.filter(item => item.status !== 'archived').map(item => html`<option value="${item.term}"></option>`)}</datalist>
            <p class="help kn-relation-error" id="kn-relation-error" data-ref="relation-error" role="alert"></p>
            <button type="button" class="btn btn-sm" data-act="relation-add">+ 연결 정보 추가</button>
          </fieldset>
          <p class="help">담당자가 승인한 버전이 다음 AI 요청에 참조됩니다.</p>
          <div data-ref="form-error"></div>
          <button class="btn btn-primary" type="submit">검토 대기로 저장</button>
        </form>`);
      syncFields(dialog.querySelector('form'));
      syncRelationAdd();
    }

    function syncFields(form) {
      const kind = form.elements.kind.value;
      form.querySelector('[data-ref="standard"]').hidden = kind === '거래처';
      form.querySelector('[data-ref="phone"]').hidden = kind !== '거래처';
    }

    function compare(revisionId) {
      const rev = detail?.revisions.find((item) => item.id === revisionId);
      if (!rev) return;
      const others = detail.revisions.filter((item) => item.id !== rev.id && item.status === 'approved');
      const baseline = rev.version === detail.version ? others[0]?.id || '' : '';
      dialogState = { type: 'compare', rev, others };
      showDialog('지식 버전 비교', html`
        <label class="field"><span>비교 기준</span><select class="select" data-ref="compare-base">
          <option value="">현재 항목</option>${others.map((item) => html`<option value="${item.id}">버전 ${item.version}</option>`)}
        </select></label>
        <div data-ref="comparison"></div>`);
      ref('compare-base').value = baseline;
      paintComparison(baseline);
    }

    function paintComparison(baseId) {
      const { rev, others } = dialogState;
      const previous = others.find((item) => item.id === baseId)?.content || detail;
      const changes = FIELDS.map(([key, label]) => ({ label, before: valueOf(previous, key), after: valueOf(rev.content, key) }))
        .filter(({ before, after }) => before !== after);
      render(ref('comparison'), html`
        <p class="help">${rev.version ? `버전 ${rev.version} · ` : ''}${STATUS[rev.status]} · ${fmtWhen(rev.createdAt)}</p>
        ${changes.length ? html`<table class="kn-compare">
          <thead><tr><th scope="col">항목</th><th scope="col">비교 기준</th><th scope="col">선택한 버전</th></tr></thead>
          <tbody>${changes.map(({ label, before, after }) => html`<tr><th scope="row">${label}</th><td>${before || '—'}</td><td>${after || '—'}</td></tr>`)}</tbody>
        </table>` : html`<p>바뀐 내용이 없어요.</p>`}
        ${rev.content.sourceCallId ? html`<p>${callSource(rev.content)}</p>` : ''}`);
    }

    async function mutate(run, success, inlineError) {
      if (busy) return;
      busy = true;
      const submit = dialog.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        const result = await run();
        if (disposed) return;
        if (dialog.open) dialog.close();
        toast(success, 'ok');
        await load(result?.id || result?.item?.id || selected);
      } catch (error) {
        if (disposed) return;
        if (inlineError && ref('form-error')) render(ref('form-error'), errorBox(error));
        else toast(error.message || '요청을 처리하지 못했어요.', 'error');
      } finally {
        busy = false;
        if (submit) submit.disabled = false;
      }
    }

    function submit(event) {
      const form = event.target;
      if (!form.dataset.form) return;
      event.preventDefault();
      const fields = new FormData(form);
      const get = (key) => String(fields.get(key) || '').trim();
      if (form.dataset.form === 'reject') {
        const { id, revision } = dialogState;
        mutate(() => api.post(revisionPath(id, revision) + '/review', { decision: 'reject', reason: get('reason') }), '제안을 반려했어요.', true);
        return;
      }
      const { data, id } = dialogState;
      const relations = [];
      ref('relation-error').textContent = '';
      for (const [index, row] of [...form.querySelectorAll('[data-relation-row]')].entries()) {
        const relationInput = row.querySelector('[name="relation-label"]');
        const targetInput = row.querySelector('[name="relation-target"]');
        relationInput.removeAttribute('aria-invalid'); targetInput.removeAttribute('aria-invalid');
        const relation = relationInput.value.trim(), target = targetInput.value.trim();
        if (!relation && !target) continue;
        if (!relation || !target) {
          ref('relation-error').textContent = `${index + 1}번째 연결 정보의 ${!relation ? '관계 설명' : '연결할 이름'}을 입력하거나 이 줄을 삭제해 주세요.`;
          const invalid = !relation ? relationInput : targetInput;
          invalid.setAttribute('aria-invalid', 'true');
          invalid.setAttribute('aria-describedby', 'kn-relations-help kn-relation-error');
          invalid.focus();
          return;
        }
        relations.push({ relation, target });
      }
      const body = {
        kind: get('kind'), term: get('term'), standard: get('standard'), note: get('note'), phone: get('phone'),
        evidenceNote: get('evidenceNote'), aliases: get('aliases').split(',').map((alias) => alias.trim()).filter(Boolean),
        relations,
      };
      if (!id && data.sourceCallId) {
        body.sourceCallId = data.sourceCallId;
        body.sourceSegIndex = data.sourceSegIndex;
      }
      mutate(() => id ? api.patch(idPath(id), body) : api.post('/api/knowledge', body), '검토 대기로 저장했어요.', true);
    }

    root.addEventListener('submit', submit);
    root.querySelector('#kn-search').addEventListener('input', (event) => {
      q = event.target.value;
      paintList();
    });
    root.addEventListener('change', async (event) => {
      if (event.target === ref('kinds')) {
        category = event.target.value;
        paintList();
      } else if (event.target === ref('compare-base')) {
        paintComparison(event.target.value);
      } else if (event.target.name === 'kind' && event.target.form?.dataset.form === 'suggest') {
        syncFields(event.target.form);
      } else if (event.target === ref('file')) {
        const file = event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (file.size > 380_000) {
          toast('380KB 이하의 CSV 파일로 나누어 올려 주세요.', 'error');
          return;
        }
        try {
          const csv = await file.text();
          if (!disposed) mutate(() => api.post('/api/knowledge/import', { csv }), '파일의 항목을 검토 대기로 가져왔어요.');
        } catch {
          toast('CSV 파일을 읽지 못했어요.', 'error');
        }
      }
    });

    root.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-act]');
      if (!btn || busy || disposed) return;
      const { act, id, value } = btn.dataset;
      if (act === 'relation-add') {
        const rows = ref('relation-rows');
        if (!rows || rows.children.length >= 10) return;
        const holder = document.createElement('div');
        render(holder, relationRow());
        const row = holder.firstElementChild;
        rows.append(row);
        syncRelationAdd();
        row.querySelector('input').focus();
      } else if (act === 'relation-remove') {
        const row = btn.closest('[data-relation-row]');
        const next = row.nextElementSibling || row.previousElementSibling;
        row.remove(); syncRelationAdd();
        (next?.querySelector('input') || dialog.querySelector('[data-act="relation-add"]')).focus();
        ref('relation-error').textContent = '';
      } else if (act === 'filter') {
        filter = value;
        await select(visibleItems()[0]?.id);
        ref('filters').querySelector(`[data-value="${filter}"]`)?.focus();
      } else if (act === 'select') {
        await select(id, true);
      } else if (act === 'back-list') {
        const button = ref('list').querySelector('[aria-pressed="true"]');
        (button || root.querySelector('#kn-search')).focus({ preventScroll: true });
        (button || ref('list')).scrollIntoView({ block: 'center', behavior: 'instant' });
      } else if (act === 'reload') load();
      else if (act === 'new') suggest(category ? {kind: category} : {});
      else if (act === 'edit' && detail) suggest(detail, detail.id);
      else if (act === 'close') dialog.close();
      else if (act === 'import') ref('file').click();
      else if (act === 'compare') compare(id);
      else if (act === 'relation') {
        const exact = items.find((item) => item.term === value && item.status !== 'archived');
        if (exact) {
          filter = 'all'; category = ''; q = '';
          ref('kinds').value = '';
          root.querySelector('#kn-search').value = '';
          select(exact.id, true);
        } else suggest({ term: value, kind: '업무 절차' }, null, '연결할 지식 제안');
      } else if (detail && act === 'reject') {
        dialogState = { type: 'reject', id: detail.id, revision: id };
        showDialog('지식 제안 반려', html`
          <form class="ka-form" data-form="reject"><label class="field"><span>반려 사유</span><textarea class="textarea" name="reason" required maxlength="500" rows="3"></textarea></label>
          <div data-ref="form-error"></div><button class="btn btn-primary" type="submit">반려하기</button></form>`);
      } else if (detail && act === 'approve') {
        const path = revisionPath(detail.id, id) + '/review';
        if (await confirmBox('이 제안을 승인할까요? 다음 AI 요청부터 참조합니다.') && !disposed) {
          mutate(() => api.post(path, { decision: 'approve' }), '제안을 승인했어요.');
        }
      } else if (detail && act === 'restore') {
        const path = revisionPath(detail.id, id) + '/restore';
        if (await confirmBox('이 버전을 검토 대기로 복원할까요?') && !disposed) {
          if (filter === 'archived') filter = 'pending';
          mutate(() => api.post(path, {}), '이전 버전을 검토 대기로 복원했어요.');
        }
      } else if (detail && act === 'archive') {
        const itemId = detail.id;
        if (await confirmBox('이 지식을 보관할까요? 다음 AI 요청의 참조 목록에서 빠집니다.') && !disposed) {
          filter = 'archived';
          mutate(() => api.del(idPath(itemId)), '지식을 보관했어요.');
        }
      }
    });

    async function initial() {
      await load();
      if (disposed || !canPropose || !ctx.query?.call) return;
      const callId = ctx.query.call;
      const sourceSegIndex = ctx.query.seg == null ? null : Number(ctx.query.seg);
      let draft = null;
      if (ctx.query.draft) {
        try { draft = (await api.get('/api/assistant', { callId })).knowledgeDraft; }
        catch (error) { if (!disposed) toast(error.message, 'error'); }
      }
      if (!disposed) suggest({ sourceCallId: callId, sourceSegIndex, ...draft }, null, draft ? '지식 초안 검토' : '통화에서 지식 제안');
    }
    initial();

    return () => {
      disposed = true;
      if (dialog.open) dialog.close();
    };
  },
};
