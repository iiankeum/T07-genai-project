// 무료 체험 신청 — 최소 항목 양식 + 서버가 주는 개인정보 수집 · 이용 안내 + 필수 동의 → POST /api/trial.
import { api } from '../api.js';
import { html, render, errorBox } from '../ui.js';

const ROLES = ['부품 대리점 · 주문 접수', '부품 대리점 · 사장 또는 관리자', '부품 대리점 · 출고 또는 배송', '정비소(카센터)', '학생 · 연구', '그 밖'];
// 서버(routes/trial.mjs TRIAL_POLICY) 칸 순서대로. 모르는 칸도 빠뜨리지 않고 뒤에 붙인다.
const POLICY_LABELS = {
  collector: '수집하는 곳',
  controller: '개인정보 처리자',
  purpose: '수집 · 이용 목적',
  items: '수집 항목',
  fields: '수집 항목',
  required: '꼭 적을 항목',
  retention: '보유 · 이용 기간',
  period: '보유 · 이용 기간',
  refusal: '동의를 거부할 권리',
  refuse: '동의를 거부할 권리',
  rights: '동의를 거부할 권리',
  right: '동의를 거부할 권리',
  notice: '동의를 거부할 권리',
  auto: '자동으로 저장하는 것',
  thirdParty: '제3자 제공',
  processor: '처리 위탁',
  contact: '문의',
  note: '참고',
  retentionDays: '보유 기간(일)',
};
const SKIP_KEYS = new Set(['title', 'version', 'updatedAt', 'updated_at', 'id', 'policy', 'sections', 'text', 'itemsList']);

const toText = (v) => {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(', ');
  if (typeof v === 'object') return Object.values(v).map(toText).filter(Boolean).join(' · ');
  return String(v).trim();
};
const paras = (text) => html`${String(text).split(/\n+/).map((s) => s.trim()).filter(Boolean).map((s) => html`<p>${s}</p>`)}`;

/** 서버 안내를 그대로 보여 준다(모양이 달라도 글은 빠뜨리지 않게). 보일 것이 없으면 null */
function policyView(data) {
  const pol = data?.policy ?? data;
  if (!pol) return null;
  if (typeof pol === 'string') return pol.trim() ? html`<h2 class="trial-policy-title">개인정보 수집 · 이용 안내</h2>${paras(pol)}` : null;
  if (typeof pol !== 'object') return null;
  const title = toText(pol.title) || '개인정보 수집 · 이용 안내';
  const rows = [];
  if (Array.isArray(pol.sections)) {
    for (const s of pol.sections) {
      if (!s) continue;
      if (typeof s === 'string') { rows.push({ label: '', body: s }); continue; }
      rows.push({ label: toText(s.title ?? s.label ?? s.heading), body: toText(s.body ?? s.text ?? s.content ?? s.items) });
    }
  }
  const ordered = Object.keys(POLICY_LABELS).filter((k) => k in pol);
  const others = Object.keys(pol).filter((k) => !SKIP_KEYS.has(k) && !(k in POLICY_LABELS) && typeof pol[k] !== 'boolean');
  for (const k of [...ordered, ...others]) {
    const body = toText(pol[k]);
    if (body) rows.push({ label: POLICY_LABELS[k] || k, body });
  }
  const text = typeof pol.text === 'string' ? pol.text : '';
  if (!rows.length && !text.trim()) return null;
  return html`<h2 class="trial-policy-title">${title}</h2>
    ${text ? paras(text) : ''}
    ${rows.length ? html`<dl class="trial-policy-list">${rows.map((r) => html`<div>${r.label ? html`<dt>${r.label}</dt>` : ''}<dd>${paras(r.body)}</dd></div>`)}</dl>` : ''}
    ${pol.version || pol.updatedAt ? html`<p class="small muted">${pol.version ? `안내 버전 ${toText(pol.version)}` : ''}${pol.version && pol.updatedAt ? ' · ' : ''}${pol.updatedAt ? `고친 날 ${toText(pol.updatedAt).slice(0, 10)}` : ''}</p>` : ''}`;
}

// 서버(routes/trial.mjs isContact)와 같은 규칙: 이메일이거나 숫자 8~15자리 전화번호
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const contactOk = (v) => EMAIL_RE.test(v) || (/^[0-9+()\-\s.]+$/.test(v) && v.replace(/[^0-9]/g, '').length >= 8 && v.replace(/[^0-9]/g, '').length <= 15);

export default {
  title: '무료 체험 신청',
  async mount(el) {
    let disposed = false;
    let policyOk = false;
    let busy = false;

    render(el, html`<div class="page page-narrow trial-page">
      <div class="page-head"><div>
        <p class="eyebrow">무료 체험</p>
        <h1>무료 체험 신청</h1>
      </div></div>
      <section class="card trial-intro">
        <p>콜노트(가칭)는 부품 대리점에 걸려 오는 주문 전화를 받아쓰고, 거래처 · 차종 · 부품 · 수량 · 급함을 주문 카드로 정리해 주는 서비스 아이디어입니다. 신청하시면 팀이 데모 쓰는 법을 안내드리고, 써 보신 의견을 여쭙겠습니다.</p>
        <p class="trial-class-note">수업 프로젝트의 데모라 실제 서비스 계약이 아닙니다.</p>
      </section>
      <div data-ref="body"></div>
    </div>`);

    const root = el.querySelector('.trial-page');
    const body = root.querySelector('[data-ref="body"]');

    function renderForm() {
      render(body, html`<form class="card trial-form" data-ref="form" novalidate>
        <h2 class="trial-form-title">신청서</h2>
        <label class="field"><span>이름 <em class="trial-req">필수</em></span><input class="input" name="name" maxlength="30" autocomplete="name" required></label>
        <label class="field"><span>소속 (대리점 이름 · 선택)</span><input class="input" name="org" maxlength="60" autocomplete="organization"></label>
        <label class="field"><span>연락처 (전화 또는 이메일) <em class="trial-req">필수</em></span><input class="input" name="contact" maxlength="80" required inputmode="text" placeholder="예: 010-0000-0000 또는 이메일"></label>
        <label class="field"><span>역할 (선택)</span>
          <select class="select" name="role"><option value="">고르지 않음</option>${ROLES.map((r) => html`<option value="${r}">${r}</option>`)}</select></label>
        <label class="field"><span>남길 말 (선택)</span><textarea class="textarea" name="message" maxlength="500" rows="3" placeholder="예: 하루 주문 전화가 많아 메모가 밀립니다."></textarea></label>

        <div class="trial-policy" data-ref="policy" aria-live="polite"><p class="loading">개인정보 안내를 불러오는 중…</p></div>

        <label class="check trial-consent"><input type="checkbox" name="consent" required><span><strong>위 개인정보 수집 · 이용 안내를 읽었고 동의합니다. (필수)</strong></span></label>
        <div data-ref="msg"></div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" data-ref="submit" disabled>체험 신청하기</button>
      </form>`);
      loadPolicy();
    }

    async function loadPolicy() {
      const box = body.querySelector('[data-ref="policy"]');
      if (!box) return;
      policyOk = false;
      updateSubmit();
      render(box, html`<p class="loading">개인정보 안내를 불러오는 중…</p>`);
      let view = null;
      let err = null;
      try { view = policyView(await api.get('/api/trial/policy')); } catch (e) { err = e; }
      if (disposed) return;
      if (view) {
        policyOk = true;
        render(box, view);
      } else {
        render(box, html`${errorBox(err || new Error('개인정보 안내를 불러오지 못했습니다.'))}<p class="small">안내를 읽어야 신청할 수 있습니다. 잠시 뒤 다시 불러와 주세요.</p><button type="button" class="btn" data-act="policy">안내 다시 불러오기</button>`);
      }
      updateSubmit();
    }

    function updateSubmit() {
      const form = body.querySelector('[data-ref="form"]');
      const btn = body.querySelector('[data-ref="submit"]');
      if (!form || !btn) return;
      btn.disabled = busy || !policyOk || !form.elements?.consent?.checked;
    }
    function showMsg(content) {
      const box = body.querySelector('[data-ref="msg"]');
      if (box) render(box, content || html``);
    }

    async function submit(form) {
      if (busy || !policyOk) return;
      const get = (k) => String(form.elements[k]?.value || '').trim();
      const data = { name: get('name'), org: get('org'), contact: get('contact'), role: get('role'), message: get('message'), consent: Boolean(form.elements.consent.checked) };
      if (!data.name) { showMsg(html`<div class="notice notice-error" role="alert">이름을 써 주세요.</div>`); form.elements.name.focus(); return; }
      if (!data.contact || !contactOk(data.contact)) { showMsg(html`<div class="notice notice-error" role="alert">연락처를 전화번호(숫자) 또는 이메일로 써 주세요.</div>`); form.elements.contact.focus(); return; }
      if (!data.consent) { showMsg(html`<div class="notice notice-error" role="alert">개인정보 수집 · 이용에 동의해야 신청할 수 있습니다.</div>`); form.elements.consent.focus(); return; }
      busy = true;
      updateSubmit();
      showMsg(html`<div class="notice"><span class="spinner" aria-hidden="true"></span> 보내는 중…</div>`);
      try {
        await api.post('/api/trial', data);
        if (disposed) return;
        form.reset();
        // 입력값은 다시 그리지 않는다
        render(body, html`<section class="card trial-done" role="status" tabindex="-1">
          <h2>신청을 받았습니다. 고맙습니다.</h2>
          <p>적어 주신 연락처로 팀이 데모 안내를 드리겠습니다.</p>
          <p class="trial-class-note">수업 프로젝트의 데모라 실제 서비스 계약이 아닙니다.</p>
          <div class="row"><a class="btn btn-primary" href="#/">첫 화면으로</a><a class="btn" href="#/live">실시간 받아쓰기 해 보기</a></div>
        </section>`);
        body.querySelector('.trial-done')?.focus();
      } catch (err) {
        if (disposed) return;
        showMsg(html`<div class="notice notice-error" role="alert">${err?.message || '신청을 보내지 못했습니다. 잠시 뒤 다시 해 주세요.'}</div>`);
      } finally {
        busy = false;
        if (!disposed) updateSubmit();
      }
    }

    const onSubmit = (e) => { if (e.target.matches('[data-ref="form"]')) { e.preventDefault(); submit(e.target); } };
    const onChange = (e) => { if (e.target.name === 'consent') updateSubmit(); };
    const onClick = (e) => { const b = e.target.closest('[data-act="policy"]'); if (b && root.contains(b)) loadPolicy(); };

    root.addEventListener('submit', onSubmit);
    root.addEventListener('change', onChange);
    root.addEventListener('click', onClick);
    renderForm();

    return () => {
      disposed = true;
      root.removeEventListener('submit', onSubmit);
      root.removeEventListener('change', onChange);
      root.removeEventListener('click', onClick);
    };
  },
};
