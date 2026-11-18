import { api } from '../api.js';
import { html, render } from '../ui.js';

export const roleName = (role) => ({ admin: '관리자', reception: '접수 담당', shipping: '출고 담당', viewer: '열람 전용' })[role] || role;

const errors = {
  bad_email: 'email',
  bad_password: 'password',
  wrong_password: 'currentPassword',
  bad_name: 'name',
  bad_workspace_name: 'name',
  consent_required: 'agreeTerms',
};
const passwordHint = '8자 이상이며 영문, 숫자, 특수문자 중 두 종류 이상';
const consent = html`
  <label class="account-check"><input name="agreeTerms" type="checkbox" required> <a href="#/terms" target="_blank" rel="noopener">이용약관</a>에 동의합니다.</label>
  <label class="account-check"><input name="agreePrivacy" type="checkbox" required> <a href="#/privacy" target="_blank" rel="noopener">개인정보 처리방침</a>에 동의합니다.</label>`;
const status = html`<p class="account-status" role="status" aria-live="polite" hidden></p>`;
const submit = (text) => html`<button type="submit" class="btn btn-primary">${text}</button>`;
const email = html`<label>이메일<input name="email" type="email" autocomplete="email" maxlength="254" required></label>`;
const name = html`<label>이름<input name="name" autocomplete="name" maxlength="50" required></label>`;
const password = html`<label>비밀번호<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="256" required>
  <small>${passwordHint}</small></label>`;

export function formValues(form) {
  const body = Object.fromEntries(new FormData(form));
  for (const input of form.querySelectorAll('input[type="checkbox"][name]')) body[input.name] = input.checked;
  return body;
}

let feedbackSequence = 0;
export function bindForm(form, action) {
  const feedback = form.querySelector('[role="status"]');
  if (!feedback.id) {
    let id;
    do { id = `account-feedback-${++feedbackSequence}`; } while (document.getElementById(id));
    feedback.id = id;
  }
  const linkedFields = new Set();
  let pending = false;
  function clearErrorLinks() {
    for (const field of linkedFields) {
      const ids = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== feedback.id);
      if (ids.length) field.setAttribute('aria-describedby', ids.join(' '));
      else field.removeAttribute('aria-describedby');
    }
    linkedFields.clear();
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending) return;
    pending = true;
    const button = event.submitter ?? form.querySelector('button[type="submit"]');
    const values = formValues(form); // disabled 입력은 FormData에서 빠지므로 잠금 전에 값을 확보한다.
    const controls = [...new Set([...form.elements].filter(field =>
      field.matches('input, select, textarea') ? !['button', 'reset'].includes(field.type)
        : field.matches('button') && field.type === 'submit'))].map(field => [field, field.disabled]);
    const previousBusy = form.getAttribute('aria-busy');
    let restored = false;
    const restoreControls = () => {
      if (restored) return;
      restored = true;
      for (const [field, disabled] of controls) field.disabled = disabled;
    };
    for (const [field] of controls) field.disabled = true;
    form.setAttribute('aria-busy', 'true');
    clearErrorLinks();
    form.querySelectorAll('[aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
    feedback.hidden = true;
    try {
      const message = await action(values, button);
      if (message) {
        feedback.textContent = message;
        feedback.classList.remove('is-error');
        feedback.hidden = false;
      }
    } catch (err) {
      restoreControls(); // 오류 입력에 초점을 보내기 전에 잠금을 해제한다.
      feedback.textContent = err.message || '잠시 뒤에 다시 해 주세요.';
      feedback.classList.add('is-error');
      feedback.hidden = false;
      const field = form.elements.namedItem(errors[err.code]);
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        const ids = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        if (!ids.has(feedback.id)) linkedFields.add(field);
        ids.add(feedback.id);
        field.setAttribute('aria-describedby', [...ids].join(' '));
        field.focus();
      } else {
        feedback.tabIndex = -1;
        feedback.focus();
      }
    } finally {
      restoreControls();
      if (previousBusy === null) form.removeAttribute('aria-busy');
      else form.setAttribute('aria-busy', previousBusy);
      pending = false;
    }
  });
}

function show(el, title, copy, content) {
  render(el, html`<div class="page account-page">
    <div class="page-head"><h1>${title}</h1>${copy ? html`<p>${copy}</p>` : ''}</div>
    <section class="panel account-panel">${content}</section>
  </div>`);
}

function safeNext(value) {
  return typeof value === 'string' && /^\/(?!\/)[a-z0-9/%?=&._-]+$/i.test(value) ? value : null;
}

function continueTo(path) {
  // 화면과 그 화면이 가진 통화·카드 캐시를 함께 새로 연다.
  history.replaceState(null, '', `/#${path}`);
  location.reload();
}

function setupLogin(el, ctx) {
  show(el, '로그인', '', html`
    <form class="account-form">
      ${email}
      <label>비밀번호<input name="password" type="password" autocomplete="current-password" maxlength="256" required></label>
      <label class="account-check"><input name="remember" type="checkbox"> 로그인 유지</label>
      ${submit('로그인')}${status}
    </form>
    <div class="account-links"><a href="#/signup">회원가입</a><a href="#/password/reset">비밀번호 재설정</a><a href="#/verify">인증 메일 다시 받기</a></div>
    ${ctx.meta?.demoAvailable ? html`<a class="btn" href="#/calls">가짜 통화 데모 열기</a>` : ''}`);
  bindForm(el.querySelector('form'), async (body) => {
    const result = await api.post('/api/auth/login', body);
    continueTo(safeNext(ctx.query?.next) || (result.workspaceId ? '/calls' : '/workspaces'));
  });
}

function setupSignup(el, ctx) {
  show(el, '회원가입', '이메일을 인증한 뒤 워크스페이스를 만들거나 초대받은 팀에 참여할 수 있어요.', html`
    <form class="account-form">${name}${email}${password}${consent}${submit('가입하기')}${status}</form>
    <div class="account-links"><a href="#/login">로그인</a><a href="#/verify">인증 메일 다시 받기</a></div>`);
  bindForm(el.querySelector('form'), async (body) => {
    await api.post('/api/auth/signup', body);
    return '가입을 요청했어요. 받은 인증 링크에서 이메일 인증을 마쳐 주세요.';
  });
}

function setupVerify(el, ctx) {
  const token = ctx.query?.token;
  show(el, '이메일 인증', token ? '인증을 마치려면 로그인에 사용할 비밀번호를 정해 주세요.' : '가입한 주소로 새 인증 링크를 요청할 수 있어요.', html`
    <form class="account-form">${token ? html`<label>사용할 새 비밀번호<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="256" required>
      <small>${passwordHint}</small></label>` : email}${submit(token ? '이메일 인증하기' : '인증 메일 받기')}${status}</form>
    <a class="btn" href="#/login">로그인으로</a>`);
  bindForm(el.querySelector('form'), async (body) => {
    await api.post(token ? '/api/auth/verify' : '/api/auth/verify/request', token ? { ...body, token } : body);
    return token ? '이메일 인증을 마쳤어요. 이제 로그인할 수 있어요.' : '인증을 기다리는 계정이면 새 링크를 준비했어요.';
  });
}

function setupReset(el, ctx) {
  const token = ctx.query?.token;
  show(el, '비밀번호 재설정', token ? '새 비밀번호를 입력해 주세요.' : '가입한 이메일로 30분 동안 사용할 수 있는 링크를 요청해요.', html`
    <form class="account-form">${token ? password : email}${submit(token ? '새 비밀번호 저장' : '재설정 링크 받기')}${status}</form>
    <a class="btn" href="#/login">로그인으로</a>`);
  bindForm(el.querySelector('form'), async (body) => {
    const endpoint = token ? '/api/auth/password/reset' : '/api/auth/password/request';
    await api.post(endpoint, token ? { ...body, token } : body);
    return token ? '비밀번호를 변경했어요. 새 비밀번호로 로그인해 주세요.' : '등록된 이메일이면 재설정 링크를 준비했어요.';
  });
}

async function setupInvite(el, ctx) {
  const token = ctx.params.token;
  try {
    const [invite, account] = await Promise.all([api.post('/api/auth/invite/info', { token }), api.get('/api/auth/me')]);
    const next = encodeURIComponent(`/invite/${token}`);
    const signIn = invite.existingAccount && account.user?.email !== invite.email;
    const signOut = !invite.existingAccount && account.user;
    show(el, '워크스페이스 초대', `${invite.workspace} · ${roleName(invite.role)}`, html`
      <p>${invite.email} 주소로 보낸 초대예요.</p>
      ${signIn ? html`<a class="btn btn-primary" href="#/login?next=${next}">초대받은 계정으로 로그인</a>`
        : signOut ? html`<form id="invite-logout" class="account-form">${submit('현재 계정에서 로그아웃')}${status}</form>`
        : html`<form id="invite-accept" class="account-form">${invite.existingAccount ? '' : html`${name}${password}${consent}`}
          ${submit('초대 수락')}${status}</form>`}`);
    const form = el.querySelector('#invite-accept');
    if (form) bindForm(form, async (body) => {
      const result = await api.post('/api/auth/invite/accept', { ...body, token });
      continueTo(result.signedIn ? '/calls' : '/login');
    });
    const logout = el.querySelector('#invite-logout');
    if (logout) bindForm(logout, async () => {
      await api.post('/api/auth/logout');
      continueTo(`/invite/${token}`);
    });
  } catch (err) {
    show(el, '초대를 열지 못했어요', err.message, html`<a href="#/login">로그인으로</a>`);
  }
}

async function setupWorkspaces(el, ctx) {
  const account = await api.get('/api/auth/me');
  if (!account.user) {
    show(el, '워크스페이스', '로그인하면 소속된 워크스페이스를 보거나 새로 만들 수 있어요.', html`
      <div class="account-links"><a class="btn btn-primary" href="#/login">로그인</a><a class="btn" href="#/signup">회원가입</a></div>`);
    return;
  }
  show(el, '워크스페이스', '통화와 주문을 관리할 워크스페이스를 선택해 주세요.', html`
    ${account.workspaces.length ? html`<div class="account-stack">${account.workspaces.map((w) => html`
      <form class="account-form workspace-row">
        <div><strong>${w.name}</strong><p>${roleName(w.role)}${account.access?.workspace.id === w.id ? ' · 현재 선택' : ''}</p></div>
        <input type="hidden" name="workspaceId" value="${w.id}">${submit('열기')}${status}
      </form>`)}</div>` : html`<p>아직 소속된 워크스페이스가 없어요.</p>`}
    <h2>새 워크스페이스</h2>
    <form id="workspace-create" class="account-form">
      <label>이름<input name="name" maxlength="80" required></label>${submit('워크스페이스 만들기')}${status}
    </form>
    <form id="workspace-logout" class="account-form">${submit('로그아웃')}${status}</form>`);
  for (const form of el.querySelectorAll('.workspace-row')) bindForm(form, async (body) => {
    await api.post('/api/auth/workspaces/switch', body);
    continueTo('/calls');
  });
  bindForm(el.querySelector('#workspace-create'), async (body) => {
    await api.post('/api/auth/workspaces', body);
    continueTo('/calls');
  });
  bindForm(el.querySelector('#workspace-logout'), async () => {
    await api.post('/api/auth/logout');
    continueTo('/login');
  });
}

export default {
  title: '계정',
  mount(el, ctx) {
    const page = ctx.path?.split('/')[1] || ctx.params?.action;
    if (page === 'signup') return setupSignup(el, ctx);
    if (page === 'verify') return setupVerify(el, ctx);
    if (page === 'password' || page === 'reset') return setupReset(el, ctx);
    if (page === 'invite' || ctx.params?.token) return setupInvite(el, ctx);
    if (page === 'workspaces') return setupWorkspaces(el, ctx);
    return setupLogin(el, ctx);
  },
};
