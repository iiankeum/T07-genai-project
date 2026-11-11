// AI 초안 · 돌린 사람: 배*결 · Claude Code(Opus 5.5) · 강현(마케팅) 작업방 · 2026-11-11 · 검토 전
// 소개 페이지(index.html)의 동작. 개발 사이트 보안 설정(CSP script-src 'self')이 페이지 안 스크립트를 막아 따로 뺐다.
// 제품명 · 데모 주소 · 신청 주소 · 문의처 같은 바꿀 값은 아래 CONFIG 한 곳에만 있다.

/* ===== 여기만 바꾸면 된다 ===== */
const CONFIG = {
  productName: '콜노트',                 // 제품명 — 투표로 정해지면 바꾼다
  productNameNote: '가칭',               // 이름이 정해지면 '' 로 비운다
  demoUrl: '/',                          // 데모 주소 — 같은 서버의 앱 첫 화면(/#/ 오늘 브리핑). 실시간 받아쓰기는 '/#/live'
  demoUrlForPreview: 'https://t07.3-39-67-126.sslip.io/',  // 이 파일을 내 컴퓨터에서 바로 열어 볼 때만 쓰는 주소
  signupEndpoint: '/api/trial-signup',   // 무료 체험 신청을 받는 곳(개발 방 답 2026-11-11: POST /api/trial-signup). 다르면 여기만 바꾼다
  contactEmail: '',                      // 개인정보 문의 · 삭제 요청 받을 팀 공용 메일 — 정해지면 적는다
  privacyOfficer: '',                    // 개인정보 담당(직함, 예: 'T07 팀 총괄') — 정해지면 적는다
  storage: '',                           // 저장 위치, 예: 'Amazon Web Services 서울 리전(대한민국) 서버' — 확인되면 적는다
  privacyUrl: 'privacy.html',            // 개인정보 처리방침 주소
  retentionUntil: '2026년 12월 31일',     // 신청 정보 보관 마감(가정)
  trialWhen: '2026년 12월 초',            // 체험판 목표 시기(목표)
  repoUrl: 'https://github.com/iiankeum/T07-genai-project',
  demoHasLiveMic: false,                 // 데모에 「실시간 받아쓰기 체험」(마이크)이 되면 true — 안내 한 줄이 켜진다
  pageVersion: 'intro-draft-2026-11-12'
};
/* ============================== */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // 어느 채널에서 왔는지: ?src=ig-1116 처럼 붙인다(utm_source 도 읽는다)
  const params = new URLSearchParams(location.search);
  const source = (params.get('src') || params.get('utm_source') || 'direct').slice(0, 40);

  // 제품명 · 표시 · 링크를 CONFIG 로 채운다
  const note = CONFIG.productNameNote ? '(' + CONFIG.productNameNote + ')' : '';
  $$('[data-product]').forEach(el => { el.textContent = CONFIG.productName; });
  $$('[data-product-note]').forEach(el => { el.textContent = CONFIG.productNameNote; });
  $$('[data-product-note-inline]').forEach(el => { el.textContent = note; });
  document.title = CONFIG.productName + note + ' — 주문 전화를 글로, 주문 카드로';
  $$('[data-retention]').forEach(el => { el.textContent = CONFIG.retentionUntil; });
  $$('[data-trial-when]').forEach(el => { el.textContent = CONFIG.trialWhen; });
  $$('[data-repo-link]').forEach(el => { el.href = CONFIG.repoUrl; });
  $$('[data-privacy-link]').forEach(el => { el.href = CONFIG.privacyUrl; });
  $$('[data-live-mic-line]').forEach(el => { el.hidden = !CONFIG.demoHasLiveMic; });
  if (CONFIG.privacyOfficer) $$('[data-privacy-officer]').forEach(el => { el.textContent = CONFIG.privacyOfficer; });
  if (CONFIG.storage) $$('[data-storage]').forEach(el => { el.textContent = CONFIG.storage; });
  const demoBase = location.protocol === 'file:' ? CONFIG.demoUrlForPreview : CONFIG.demoUrl;
  $$('[data-demo-link]').forEach(el => {
    try {
      const u = new URL(demoBase, location.href);
      u.searchParams.set('from', 'intro');
      if (source !== 'direct') u.searchParams.set('src', source);
      el.href = u.toString();
    } catch (e) { el.href = demoBase; }
  });
  if (CONFIG.contactEmail) {
    $$('[data-contact]').forEach(el => {
      el.textContent = '';
      const a = document.createElement('a');
      a.href = 'mailto:' + CONFIG.contactEmail;
      a.textContent = CONFIG.contactEmail;
      el.appendChild(a);
    });
  }

  // 휴대폰에서 아래 고정 「무료 체험 신청」 — 신청서가 보이면 숨긴다
  const sticky = $('#stickyCta');
  const signup = $('#signup');
  if ('IntersectionObserver' in window && sticky && signup) {
    new IntersectionObserver(es => es.forEach(e => sticky.classList.toggle('hide', e.isIntersecting)), { threshold: 0.05 }).observe(signup);
  }

  // 휴대폰 ↔ 이메일 바꾸기
  const phone = $('#f-phone');
  const email = $('#f-email');
  let contactMode = 'phone';
  function setMode(m) {
    contactMode = m;
    $('#phoneWrap').hidden = m !== 'phone';
    $('#emailWrap').hidden = m !== 'email';
    (m === 'phone' ? phone : email).focus();
    $('#e-contact').textContent = '';
  }
  $('#useEmail').addEventListener('click', () => setMode('email'));
  $('#usePhone').addEventListener('click', () => setMode('phone'));

  // 휴대폰 번호에 붙임표 자동으로(띄어쓰기 · 붙임표가 섞여도 받는다)
  phone.addEventListener('input', () => {
    const d = phone.value.replace(/\D/g, '').slice(0, 11);
    phone.value = d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + '-' + d.slice(3)
      : d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4);
  });

  // 신청 뒤 「다른 분께 보내기」 — 받은 사람은 ?src=referral 로 들어온다
  $('#shareBtn').addEventListener('click', async () => {
    const url = location.origin + location.pathname + '?src=referral';
    const text = '전화 주문을 글로 받아쓰고 주문 카드로 정리해 주는 도구 — 무료 체험 신청 받는 중';
    try {
      if (navigator.share) { await navigator.share({ title: document.title, text, url }); return; }
      await navigator.clipboard.writeText(text + '\n' + url);
      $('#shareBtn').textContent = '주소를 복사했어요. 카톡에 붙여 넣어 보내 주세요';
    } catch (e) {
      window.prompt('이 주소를 복사해 보내 주세요', url);
    }
  });

  const form = $('#trialForm');
  const status = $('#formStatus');
  const btn = $('#submitBtn');
  const setErr = (id, msg) => { $('#' + id).textContent = msg || ''; };
  const showStatus = (kind, msg) => { status.className = 'form-status ' + kind; status.textContent = msg; };
  const radio = name => { const r = $('input[name="' + name + '"]:checked'); return r ? r.value : ''; };

  function validate() {
    let first = null;
    const name = $('#f-name').value.trim();
    const phoneDigits = contactMode === 'phone' ? phone.value.replace(/\D/g, '') : '';
    const mail = contactMode === 'email' ? email.value.trim() : '';
    const consent = $('#f-consent').checked;

    setErr('e-name', name ? '' : '연락드릴 때 부를 이름을 적어 주세요. 호칭도 됩니다.');
    if (!name) first = first || $('#f-name');

    let contactMsg = '';
    if (contactMode === 'phone') {
      if (!phoneDigits) contactMsg = '휴대폰 번호를 적어 주세요. 이메일이 편하시면 「이메일이 더 편해요」를 누르세요.';
      else if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) contactMsg = '휴대폰 번호를 다시 확인해 주세요(예: 010-1234-5678).';
    } else {
      if (!mail) contactMsg = '이메일을 적어 주세요.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) contactMsg = '이메일 주소를 다시 확인해 주세요(예: name@example.com).';
    }
    setErr('e-contact', contactMsg);
    if (contactMsg) first = first || (contactMode === 'phone' ? phone : email);

    setErr('e-consent', consent ? '' : '신청하시려면 위 개인정보 수집 · 이용에 동의해 주셔야 합니다.');
    if (!consent) first = first || $('#f-consent');

    return { ok: !first, first, phoneDigits, mail, name };
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    showStatus('', '');
    const v = validate();
    if (!v.ok) { v.first.focus(); showStatus('bad', '빨간 글씨로 표시된 곳을 확인해 주세요. 적으신 내용은 그대로 남아 있습니다.'); return; }

    const industryLabel = { 'parts-dealer': '부품 대리점 · 도매', 'repair-shop': '정비소', 'other-wholesale': '다른 도매업', 'other': '그 밖' }[radio('industry')] || '';
    const payload = {
      // 개발 방 설계(설계.md 5절 POST /api/trial)의 기본 칸
      name: v.name,
      org: '',                                   // 상호는 받지 않는다(최소 수집)
      contact: v.phoneDigits || v.mail,
      role: industryLabel,
      consent: true,
      // 마케팅 방이 더 보내는 칸(모두 선택) — 서버가 모르면 버려도 신청은 된다
      phone: v.phoneDigits,
      email: v.mail,
      industry: radio('industry'),
      callsPerDay: radio('callsPerDay'),
      region: $('#f-region').value,
      recordingSetup: radio('recordingSetup'),
      heardFrom: $('#f-heard').value,
      interviewOk: $('#f-interview').checked,
      message: $('#f-msg').value.trim(),
      consentPrivacy: true,
      consentMarketing: $('#f-marketing').checked,
      source: source,
      pageVersion: CONFIG.pageVersion,
      website: $('#f-website').value   // 스팸 막기 칸 — 사람이면 비어 있다
    };

    if (location.protocol === 'file:') {
      showStatus('warn', '이 파일은 시안이라 실제로 보내지지 않았습니다. 사이트에 올리면 신청이 저장됩니다.');
      return;
    }

    btn.disabled = true; btn.textContent = '보내는 중…';
    try {
      const res = await fetch(CONFIG.signupEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let data = {};
      try { data = await res.json(); } catch (e) {}
      if (res.ok && data.ok !== false) {
        form.reset();
        setMode('phone');
        showStatus('ok', '신청이 접수됐습니다. 고맙습니다! 체험판이 준비되면(' + CONFIG.trialWhen + ' 목표) 적어 주신 연락처로 먼저 연락드리겠습니다.');
        $('#shareBox').hidden = false;
      } else if (res.status === 404) {
        showStatus('warn', '아직 신청 받는 곳이 연결되지 않았습니다(시안). 조금 뒤 다시 시도해 주세요.');
      } else {
        showStatus('bad', (data && data.message) || '보내지 못했습니다. 잠시 뒤 다시 시도해 주세요. 적으신 내용은 그대로 남아 있습니다.');
      }
    } catch (e) {
      showStatus('bad', '인터넷 연결을 확인하고 다시 시도해 주세요. 적으신 내용은 그대로 남아 있습니다.');
    } finally {
      btn.disabled = false; btn.textContent = '무료 체험 신청하기';
    }
  });
})();
