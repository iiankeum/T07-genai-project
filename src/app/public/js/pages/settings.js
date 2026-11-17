import { api } from '../api.js';
import { html, render, fmtWhen } from '../ui.js';
import { bindForm, roleName } from './account.js';

const sections = [
  ['profile', '프로필'], ['workspace', '워크스페이스 정보'], ['members', '구성원·권한'],
  ['notifications', '알림 설정'], ['display', '화면 설정'], ['data', '데이터·개인정보'],
  ['integrations', '수집·AI 설정'],
];
const roles = ['admin', 'reception', 'shipping', 'viewer'];
const status = html`<p class="account-status" role="status" aria-live="polite" hidden></p>`;
const save = (text = '저장') => html`<button class="btn btn-primary" type="submit">${text}</button>`;
const roleOptions = (active = 'reception') => roles.map((role) => html`<option value="${role}" ${role === active ? html`selected` : ''}>${roleName(role)}</option>`);
const restricted = html`<p>이 설정은 워크스페이스 관리자에게 요청해 주세요.</p>`;
const demoOnly = html`<p>계정 워크스페이스에서 사용할 수 있어요.</p><a class="btn" href="#/workspaces">워크스페이스 선택</a>`;
const localBigText = () => {
  try { return localStorage.getItem('cn.bigText') === '1'; } catch { return false; }
};

function show(el, active, body) {
  const section = sections.find(([key]) => key === active);
  render(el, html`<div class="page account-page settings-page">
    <div class="page-head"><h1>${section?.[1] || '설정'}</h1></div>
    <nav class="account-links settings-nav" aria-label="설정 메뉴">${sections.map(([key, label]) => html`
      <a href="#/settings/${key}" ${key === active ? html`aria-current="page"` : ''}>${label}</a>`)}</nav>
    <section class="panel account-panel">${body}</section>
  </div>`);
}

function profile(el, key, account) {
  const user = account.user;
  if (!user) return show(el, key, demoOnly);
  show(el, key, html`
    <form id="settings-profile" class="account-form">
      <label>이메일<input type="email" value="${user.email}" readonly></label>
      <label>이름<input name="name" value="${user.name}" autocomplete="name" maxlength="50" required></label>
      <label>연락처<input name="phone" type="tel" value="${user.phone}" autocomplete="tel" maxlength="30"></label>
      ${save('프로필 저장')}${status}
    </form>
    <h2>비밀번호 변경</h2>
    <form id="settings-password" class="account-form">
      <label>현재 비밀번호<input name="currentPassword" type="password" autocomplete="current-password" maxlength="256" required></label>
      <label>새 비밀번호<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="256" required>
        <small>8자 이상이며 영문, 숫자, 특수문자 중 두 종류 이상</small></label>
      ${save('비밀번호 변경')}${status}
    </form>
    <form id="settings-logout" class="account-form"><button type="submit" class="btn">로그아웃</button>${status}</form>`);
  bindForm(el.querySelector('#settings-profile'), async (body) => {
    await api.patch('/api/auth/profile', body);
    return '프로필을 저장했어요.';
  });
  const passwordForm = el.querySelector('#settings-password');
  bindForm(passwordForm, async (body) => {
    await api.post('/api/auth/password/change', body);
    passwordForm.reset();
    return '비밀번호를 변경했어요.';
  });
  bindForm(el.querySelector('#settings-logout'), async () => {
    await api.post('/api/auth/logout');
    history.replaceState(null, '', '/#/login');
    location.reload();
  });
}

function workspace(el, key, account) {
  const access = account.access;
  if (!access || access.demo) return show(el, key, demoOnly);
  const { workspace, role } = access;
  const readOnly = role !== 'admin';
  show(el, key, html`
    <form class="account-form">
      <label>상호<input name="name" value="${workspace.name}" maxlength="80" required ${readOnly ? html`readonly` : ''}></label>
      <label>대표 번호<input name="phone" type="tel" value="${workspace.phone}" maxlength="30" ${readOnly ? html`readonly` : ''}></label>
      <label>영업시간<input name="hours" value="${workspace.hours}" maxlength="120" ${readOnly ? html`readonly` : ''}></label>
      ${readOnly ? restricted : save()}${status}
    </form><a class="btn" href="#/workspaces">워크스페이스 전환</a>`);
  if (!readOnly) bindForm(el.querySelector('form'), async (body) => {
    await api.patch('/api/settings/workspace', body);
    return '워크스페이스 정보를 저장했어요.';
  });
}

async function members(el, key, account) {
  const access = account.access;
  if (!access || access.demo) return show(el, key, demoOnly);
  if (access.role !== 'admin') return show(el, key, restricted);
  const draw = async () => {
    const { members, invites } = await api.get('/api/settings/members');
    show(el, key, html`
      <h2>구성원 초대</h2>
      <form id="member-invite" class="account-form">
        <label>이메일<input name="email" type="email" maxlength="254" required></label>
        <label>역할<select name="role">${roleOptions()}</select></label>
        ${save('초대 보내기')}${status}
      </form>
      <h2>구성원</h2>
      <div class="account-stack">${members.map((m) => html`
        <form class="account-form member-row" data-member="${m.id}">
          <div><strong>${m.name}${m.id === account.user.id ? ' · 나' : ''}</strong><p>${m.email}</p></div>
          <label>역할<select name="role" aria-label="${m.name} 역할">${roleOptions(m.role)}</select></label>
          <label class="account-check"><input name="active" type="checkbox" ${m.active ? html`checked` : ''}> 활성 계정</label>
          ${save('변경 저장')}${status}
        </form>`)}</div>
      <h2>수락 대기 중인 초대</h2>
      ${invites.length ? html`<div class="account-stack">${invites.map((i) => html`
        <form class="account-form invite-row" data-invite="${i.id}">
          <div><strong>${i.email}</strong><p>${roleName(i.role)} · ${i.expired ? '만료됨' : '수락 대기'}</p></div>
          <button type="submit" class="btn" name="action" value="resend">다시 보내기</button>
          <button type="submit" class="btn" name="action" value="cancel">초대 취소</button>
          ${status}
        </form>`)}</div>` : html`<p>수락을 기다리는 초대가 없어요.</p>`}
    `);
    bindForm(el.querySelector('#member-invite'), async (body) => {
      await api.post('/api/settings/invites', body);
      await draw();
      el.querySelector('#member-invite [role="status"]').textContent = '초대를 준비했어요.';
      el.querySelector('#member-invite [role="status"]').hidden = false;
    });
    for (const form of el.querySelectorAll('.member-row')) bindForm(form, async (body) => {
      await api.patch(`/api/settings/members/${encodeURIComponent(form.dataset.member)}`, body);
      return '구성원 역할과 상태를 저장했어요.';
    });
    for (const form of el.querySelectorAll('.invite-row')) bindForm(form, async (body, button) => {
      const route = `/api/settings/invites/${encodeURIComponent(form.dataset.invite)}`;
      if (button.value === 'cancel') await api.del(route);
      else await api.post(`${route}/resend`);
      await draw();
    });
  };
  await draw();
}

async function notificationSettings(el, key, account) {
  const prefs = account.user?.notifications || { urgent: true, review: true, upload: true };
  show(el, key, html`
    ${account.user ? html`<form id="notification-prefs" class="account-form">
      ${[['urgent', '긴급 주문'], ['review', '확인 필요 주문'], ['upload', '녹음 처리 완료·실패']].map(([name, label]) => html`
        <label class="account-check"><input name="${name}" type="checkbox" ${prefs[name] ? html`checked` : ''}> ${label}</label>`)}
      ${save()}${status}
    </form>` : html`<p>로그인하면 알림 종류를 설정할 수 있어요.</p>`}
    <h2>받은 알림</h2><div id="notice-items" aria-live="polite"></div>`);
  const prefsForm = el.querySelector('#notification-prefs');
  if (prefsForm) bindForm(prefsForm, async (body) => {
    await api.patch('/api/auth/preferences', { notifications: body });
    await refresh();
    return '알림 설정을 저장했어요.';
  });
  async function refresh() {
    const area = el.querySelector('#notice-items');
    if (!account.access) { render(area, html`<p>워크스페이스를 선택해 주세요.</p>`); return; }
    const { items, unread } = await api.get('/api/notifications');
    render(area, html`
      ${unread ? html`<form class="account-form"><button type="submit" class="btn">모두 읽음 표시</button>${status}</form>` : ''}
      ${items.length ? html`<ul class="account-stack">${items.map((item) => html`
        <li><a href="#/calls/${encodeURIComponent(item.callId)}">${item.title}</a> ${item.read ? '' : '· 새 알림'}
          <p>${item.message} · ${fmtWhen(item.createdAt)}</p></li>`)}</ul>` : html`<p>새 알림이 없어요.</p>`}`);
    const form = area.querySelector('form');
    if (form) bindForm(form, async () => {
      await api.post('/api/notifications/read', { ids: items.filter((i) => !i.read).map((i) => i.id) });
      await refresh();
    });
  }
  await refresh();
}

function display(el, key, account) {
  show(el, key, html`<form class="account-form">
    <label class="account-check"><input type="checkbox" name="bigText" ${(account.user?.bigText ?? localBigText()) ? html`checked` : ''}> 큰 글씨 모드</label>
    ${save()}${status}</form>`);
  bindForm(el.querySelector('form'), async ({ bigText }) => {
    if (account.user) await api.patch('/api/auth/preferences', { bigText });
    try { localStorage.setItem('cn.bigText', bigText ? '1' : '0'); } catch { /* 현재 화면에는 적용 */ }
    document.documentElement.classList.toggle('big-text', bigText);
    return '화면 설정을 저장했어요.';
  });
}

async function dataSettings(el, key, account) {
  const access = account.access;
  if (!access || access.demo) return show(el, key, demoOnly);
  if (access.role !== 'admin') return show(el, key, restricted);
  const { calls = [] } = await api.get('/api/calls', { limit: 30 });
  show(el, key, html`
    <h2>보관 기간</h2>
    <p>보관 기간이 지난 통화의 녹음과 받아쓴 글, 주문 카드, 변경 기록을 정리해요.</p>
    <form id="retention" class="account-form">
      <label>통화 보관 기간(일)<input name="retentionDays" type="number" min="1" max="3650" value="${access.workspace.retentionDays}" required></label>
      ${save('기간 저장')}${status}
    </form>
    <h2>내보내기</h2>
    <p>통화, 받아쓴 글, 주문 카드와 변경 이력을 JSON으로 내려받아요. 녹음은 각 통화에서 내려받을 수 있어요.</p>
    <a class="btn" href="${api.url('/api/settings/data/export')}" download>워크스페이스 데이터 내려받기</a>
    <h2>통화 삭제</h2>
    ${calls.length ? html`<form id="data-delete" class="account-form">
      <label>최근 통화<select name="id" required>${calls.map((c) => html`<option value="${c.id}">${fmtWhen(c.recordedAt)} · ${c.title}</option>`)}</select></label>
      <label>삭제 확인을 위해 ‘삭제’를 입력해 주세요<input name="confirm" pattern="삭제" required></label>
      <button class="btn btn-danger" type="submit">통화 삭제</button>${status}
    </form>` : html`<p>삭제할 통화가 없어요.</p>`}
  `);
  bindForm(el.querySelector('#retention'), async (body) => {
    await api.patch('/api/settings/data', { retentionDays: Number(body.retentionDays) });
    return '보관 기간을 저장했어요.';
  });
  const deleteForm = el.querySelector('#data-delete');
  if (deleteForm) bindForm(deleteForm, async (body) => {
    await api.del(`/api/calls/${encodeURIComponent(body.id)}`);
    deleteForm.elements.id.querySelector('option:checked')?.remove();
    deleteForm.elements.confirm.value = '';
    return '통화를 삭제했어요.';
  });
}

async function integrations(el, key, account, ctx) {
  const access = account.access;
  if (!access || access.demo) return show(el, key, demoOnly);
  if (access.role !== 'admin') return show(el, key, restricted);
  async function draw(token) {
    const rr = await api.get('/api/settings/integrations');
    show(el, key, html`
      <h2>녹음 폴더 연결</h2>
      <p>${rr.ingestConfigured ? '연결용 토큰이 발급됐어요.' : '연결용 토큰을 발급해 폴더 전송 프로그램에 설정해 주세요.'}</p>
      <p>받아쓰기 처리 · ${ctx.meta?.worker?.online ? '연결됨' : '대기 중'}</p>
      ${token ? html`<label>새 연결용 토큰<input class="token-output" type="text" readonly value="${token}"></label>
        <p>토큰은 이 화면에서 한 번 보여요. 폴더 전송 프로그램에 입력해 주세요.</p>` : ''}
      <form id="integration-token" class="account-form">
        ${rr.ingestConfigured ? html`<label class="account-check"><input name="confirm" type="checkbox" required> 기존 연결이 끊기는 것을 확인했어요.</label>` : ''}
        ${save(rr.ingestConfigured ? '토큰 다시 발급' : '토큰 발급')}${status}
      </form>
      ${rr.ingestConfigured ? html`<form id="integration-revoke" class="account-form">
        <label class="account-check"><input name="confirm" type="checkbox" required> 폴더 전송 연결을 해제합니다.</label>
        <button type="submit" class="btn btn-danger">토큰 폐기</button>${status}
      </form>` : ''}
      <h2>AI 처리 범위</h2>
      <p>서버에서 외부 AI를 켠 경우 ‘서버 AI 사용’으로 저장하면 받아쓴 글 원문과 관련 업무 정보가 외부 AI에 전송될 수 있어요.</p>
      <form id="integration-ai" class="account-form">
        <label>처리 방식<select name="aiMode">
          ${[['off', '외부 AI 사용 안 함'], ['masked', '가림 처리 미지원 · 외부 전송 차단'], ['configured', '서버 AI 사용 · 외부 전송 허용']].map(([value, label]) => html`
            <option value="${value}" ${rr.aiMode === value ? html`selected` : ''}>${label}</option>`)}
        </select></label>${save()}${status}
      </form>
    `);
    bindForm(el.querySelector('#integration-token'), async () => {
      const result = await api.post('/api/settings/ingest-token');
      await draw(result.token);
    });
    const revoke = el.querySelector('#integration-revoke');
    if (revoke) bindForm(revoke, async () => {
      await api.del('/api/settings/ingest-token');
      await draw();
    });
    bindForm(el.querySelector('#integration-ai'), async (body) => {
      await api.patch('/api/settings/integrations', body);
      return 'AI 처리 설정을 저장했어요.';
    });
  }
  await draw();
}

const handlers = { profile, workspace, members, notifications: notificationSettings, display, data: dataSettings, integrations };
export default {
  title: '설정',
  async mount(el, ctx) {
    const key = ctx.params?.section || ctx.path?.split('/')[2];
    const handler = handlers[key];
    if (!handler) {
      show(el, key, html`<p>계정, 워크스페이스, 화면과 알림 설정을 관리해요.</p>
        <a class="btn" href="#/settings/profile">프로필 열기</a>`);
      return;
    }
    const account = await api.get('/api/auth/me');
    await handler(el, key, account, ctx);
  },
};
