'use strict';
// 단어장 받아쓰기 화면. 서버(127.0.0.1)와만 말한다.

const TOKEN = (() => {
  const t = new URLSearchParams(location.search).get('t');
  try { if (t) sessionStorage.setItem('t', t); return t || sessionStorage.getItem('t') || ''; } catch { return t || ''; }
})();
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(method, path, body, raw) {
  const opt = { method, headers: { 'X-Token': TOKEN } };
  if (raw) { opt.body = body; } else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch('/api/' + path, opt);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `오류 ${r.status}`);
  return data;
}
const dl = (path) => { location.href = `/api/${path}${path.includes('?') ? '&' : '?'}t=${encodeURIComponent(TOKEN)}`; };

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function fail(e) { console.error(e); toast(e.message || String(e)); }
const fmtTime = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const fmtDur = (s) => s == null ? '' : (s >= 60 ? `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초` : `${Math.round(s)}초`);

// ---------------------------------------------------------------- 대화 상자
function dialog(title, html, onOpen) {
  return new Promise((resolve) => {
    const d = $('#dlg');
    $('#dlgTitle').textContent = title;
    $('#dlgBody').innerHTML = html;
    d.returnValue = '';
    d.showModal();
    onOpen?.(d);
    d.addEventListener('close', function h() { d.removeEventListener('close', h); resolve(d.returnValue === 'ok' ? d : null); });
  });
}
async function ask(title, label, value = '') {
  const d = await dialog(title, `<label>${esc(label)}<input id="dlgInput" value="${esc(value)}"></label>`, (d) => { const i = $('#dlgInput', d); i.focus(); i.select(); });
  return d ? $('#dlgInput', d).value.trim() : null;
}
async function confirmBox(title, text) { return !!(await dialog(title, `<p>${esc(text)}</p>`)); }

// ---------------------------------------------------------------- 상태
const S = { state: null, glossaries: [], page: 'new', note: null, gloss: null, glossDirty: false };

async function refreshState() {
  try {
    S.state = await api('GET', 'state');
    renderEngineChip();
    if (S.page === 'settings') renderSettings();
  } catch (e) { $('#engineChip').textContent = '연결이 끊겼어요. 프로그램을 다시 여세요.'; $('#engineChip').className = 'chip bad'; }
}
function renderEngineChip() {
  const st = S.state; const c = $('#engineChip');
  const e = st.engine;
  if (st.download.state === 'running') {
    const pct = st.download.total ? Math.round(st.download.done / st.download.total * 100) : 0;
    c.textContent = `모델 받는 중 ${pct}%`; c.className = 'chip busy'; return;
  }
  if (e.state === 'ready') { c.textContent = e.message; c.className = 'chip ok'; }
  else if (e.state === 'loading') { c.textContent = '모델 여는 중…'; c.className = 'chip busy'; }
  else if (e.state === 'error') { c.textContent = '모델을 못 열었어요'; c.className = 'chip bad'; c.title = e.message; }
  else {
    const any = st.models.some((m) => m.installed);
    c.textContent = any ? '모델 대기 중' : '모델이 없어요 · 설정에서 받기';
    c.className = any ? 'chip' : 'chip bad';
  }
}

// ---------------------------------------------------------------- 쪽 넘기기
function go(page) {
  if (S.page === 'gloss' && S.glossDirty) saveGloss();
  S.page = page;
  $$('.page').forEach((p) => { p.hidden = p.id !== 'page-' + page; });
  $$('.nav').forEach((b) => b.classList.toggle('active', b.dataset.page === page || (page === 'note' && b.dataset.page === 'notes')));
  if (page !== 'note') { const pl = $('#player'); pl.pause(); }
  if (page === 'notes') loadNotes();
  if (page === 'gloss') loadGlossPage();
  if (page === 'settings') renderSettings();
  if (page === 'new' || page === 'eval') loadGlossSelects();
  window.scrollTo(0, 0);
}
$$('.nav').forEach((b) => b.addEventListener('click', () => go(b.dataset.page)));
$$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));

async function loadGlossSelects() {
  try { S.glossaries = await api('GET', 'glossaries'); } catch (e) { return fail(e); }
  const cur = S.state?.settings?.glossary ?? '';
  for (const id of ['#newGloss', '#evalGloss']) {
    const sel = $(id); const keep = sel.value || cur;
    sel.innerHTML = '<option value="">단어장 없이</option>' + S.glossaries.map((g) => `<option value="${esc(g.name)}">${esc(g.name)} (${g.count})</option>`).join('');
    if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
    else if (S.glossaries.length && id === '#newGloss' && !S.state?.settings?.glossary) sel.value = '';
  }
  if (!$('#newContext').value && S.state?.settings?.context) $('#newContext').value = S.state.settings.context;
  updateNewPlan();
}

// ---------------------------------------------------------------- 받아쓰기
let picked = null; // {blob, name}
function setPicked(blob, name) {
  picked = { blob, name };
  const p = $('#picked'); p.hidden = false;
  const mb = (blob.size / 1048576).toFixed(1);
  p.innerHTML = `<span><b>${esc(name)}</b> <span class="muted">· ${mb}MB</span></span><button class="btn small ghost" id="unpick">빼기</button>`;
  $('#unpick').onclick = () => { picked = null; p.hidden = true; $('#startBtn').disabled = true; };
  $('#startBtn').disabled = false;
}
const drop = $('#drop');
drop.addEventListener('click', () => $('#file').click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file').click(); } });
$('#file').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) setPicked(f, f.name); e.target.value = ''; });
['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) setPicked(f, f.name); });

// 녹음
let rec = null, recChunks = [], recStart = 0, recTimer = null;
$('#recBtn').addEventListener('click', async () => {
  if (rec) { rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
    recChunks = [];
    rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : undefined);
    rec.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(recTimer);
      const stamp = new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\s/g, ' ');
      setPicked(new Blob(recChunks, { type: 'audio/webm' }), `녹음 ${stamp}.webm`);
      $('#recBtn').classList.remove('on'); $('#recLabel').textContent = '지금 녹음하기'; $('#recTime').textContent = '';
      rec = null;
    };
    rec.start(1000);
    recStart = Date.now();
    $('#recBtn').classList.add('on'); $('#recLabel').textContent = '녹음 멈추기';
    recTimer = setInterval(() => { $('#recTime').textContent = fmtTime((Date.now() - recStart) / 1000); }, 500);
  } catch (e) { fail(new Error('마이크를 쓸 수 없어요: ' + e.message)); }
});

let planTimer;
function updateNewPlan() {
  clearTimeout(planTimer);
  planTimer = setTimeout(async () => {
    const name = $('#newGloss').value; const box = $('#newPlan');
    if (!name) { box.innerHTML = '단어장 없이 받아씁니다. 고유명사 · 전문 용어가 많으면 단어장을 고르세요.'; return; }
    try {
      const g = await api('GET', `glossary?name=${encodeURIComponent(name)}&context=${encodeURIComponent($('#newContext').value)}`);
      box.innerHTML = planHtml(g.plan, g.entries.length, false);
    } catch (e) { box.textContent = e.message; }
  }, 250);
}
function planHtml(plan, total, showTerms = true) {
  const pct = Math.min(100, Math.round(plan.tokens / plan.budget * 100));
  const over = plan.excluded.length;
  let s = `<b>30초마다 엔진에 알려 줄 낱말 ${plan.included.length}개</b> / 단어장 ${total}개 <span class="muted">· 힌트 자리 ${plan.tokens}/${plan.budget} 토큰${plan.exactTokens ? '' : '(어림)'}</span>`;
  s += `<div class="meter"><div style="width:${pct}%"></div></div>`;
  if (over) s += `<div class="muted" style="margin-top:6px">자리가 모자라 ${over}개는 처음엔 빠져요. 그래서 <b>두 번 듣기</b>를 합니다: 한 번 받아쓴 글에 비슷한 소리로 나온 낱말을 골라 다시 받아써요(시간 2배). 빠지면 안 되는 낱말은 「항상」을 켜세요.</div>`;
  if (showTerms) s += `<details style="margin-top:6px"><summary>엔진에 알려 줄 낱말 보기</summary><div class="terms">${plan.included.map((t) => `<span class="t">${esc(t)}</span>`).join('')}${plan.excluded.slice(0, 60).map((t) => `<span class="t out" title="이번엔 자리가 없어요">${esc(t)}</span>`).join('')}</div></details>`;
  return s;
}
$('#newGloss').addEventListener('change', () => { api('POST', 'settings', { glossary: $('#newGloss').value }).then((s) => { S.state = s; }).catch(() => {}); updateNewPlan(); });
$('#newContext').addEventListener('input', updateNewPlan);
$('#newContext').addEventListener('change', () => api('POST', 'settings', { context: $('#newContext').value }).catch(() => {}));

$('#startBtn').addEventListener('click', async () => {
  if (!picked) return;
  $('#startBtn').disabled = true;
  try {
    showJob('#jobBox', '#jobStage', '#jobBar', '#jobPct', { stage: '파일을 넘기는 중', progress: 0 });
    const up = await api('POST', `upload?name=${encodeURIComponent(picked.name)}`, picked.blob, true);
    const { jobId } = await api('POST', 'transcribe', {
      uploadId: up.uploadId, glossary: $('#newGloss').value, context: $('#newContext').value,
      language: $('#newLang').value, title: picked.name.replace(/\.[^.]+$/, ''),
    });
    const job = await watchJob(jobId, '#jobBox', '#jobStage', '#jobBar', '#jobPct');
    if (job.state === 'done') { picked = null; $('#picked').hidden = true; openNote(job.result.noteId); }
    else $('#startBtn').disabled = false;
  } catch (e) { fail(e); $('#jobBox').hidden = true; $('#startBtn').disabled = false; }
});
let currentJob = null;
$('#cancelBtn').addEventListener('click', () => currentJob && api('POST', `jobs/${currentJob}/cancel`).catch(fail));

function showJob(box, stage, bar, pct, job) {
  $(box).hidden = false;
  $(stage).textContent = job.stage || '';
  $(bar).style.width = Math.round((job.progress || 0) * 100) + '%';
  $(pct).textContent = Math.round((job.progress || 0) * 100) + '%';
}
async function watchJob(id, box, stage, bar, pct) {
  currentJob = id;
  for (;;) {
    const job = await api('GET', `jobs/${id}`);
    showJob(box, stage, bar, pct, job);
    if (['done', 'error', 'cancelled'].includes(job.state)) {
      currentJob = null;
      $(box).hidden = true;
      if (job.state === 'error') toast(job.error);
      if (job.state === 'cancelled') toast('그만두었어요.');
      return job;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
}

// ---------------------------------------------------------------- 기록
async function loadNotes() {
  try {
    const list = await api('GET', 'notes');
    const box = $('#notesList');
    if (!list.length) { box.innerHTML = '<div class="empty">아직 받아쓴 기록이 없어요.</div>'; return; }
    box.innerHTML = list.map((n) => `<button class="note-card" data-id="${esc(n.id)}"><div class="row between"><span class="t">${esc(n.title)}</span><span class="muted">${esc(new Date(n.created).toLocaleString('ko-KR'))}</span></div><div class="muted" style="font-size:13px">${fmtDur(n.duration)}${n.glossary ? ' · 단어장 ' + esc(n.glossary) : ''}</div><div class="p">${esc(n.preview)}</div></button>`).join('');
    $$('.note-card', box).forEach((b) => b.addEventListener('click', () => openNote(b.dataset.id)));
  } catch (e) { fail(e); }
}

async function openNote(id) {
  try { S.note = await api('GET', `notes/${id}`); } catch (e) { return fail(e); }
  go('note');
  const n = S.note;
  $('#noteTitle').value = n.title;
  const fixes = n.segments.flatMap((s) => s.pieces.filter((p) => p.fix));
  const applied = fixes.filter((p) => p.fix.applied).length;
  $('#noteMeta').textContent = [
    new Date(n.created).toLocaleString('ko-KR'), fmtDur(n.meta.duration), n.glossary ? `단어장 ${n.glossary}` : '단어장 없이',
    `고친 곳 ${applied} · 제안 ${fixes.length - applied}`, `${n.meta.engine} · ${n.meta.elapsed}초 걸림`,
  ].join(' · ');
  $('#player').src = `/api/notes/${n.id}/audio?t=${encodeURIComponent(TOKEN)}`;
  renderSegs();
  const p = n.passes || [];
  $('#hintInfo').innerHTML = n.hints ? `엔진에 30초마다 알려 준 낱말 ${n.hints.included.length}개${p.length > 1 ? ' · 두 번 듣기 함' : ''}${n.context ? ' · 설명: ' + esc(n.context) : ''}` : '';
}

function pieceHtml(p, si, pi) {
  if (!p.fix) return esc(p.t);
  const f = p.fix;
  if (f.applied) return `${f.after.startsWith(' ') ? ' ' : ''}<mark class="fx applied" data-s="${si}" data-p="${pi}" title="원래 「${esc(p.t)}」 · 누르면 되돌려요">${esc(f.after.trim())}</mark>`;
  return `<mark class="fx sugg" data-s="${si}" data-p="${pi}" title="「${esc(f.after.trim())}」(으)로 고칠까요? 누르면 고쳐요">${esc(p.t)}</mark>`;
}
function renderSegs() {
  const n = S.note;
  $('#segs').innerHTML = n.segments.map((s, si) => {
    const body = s.edited != null ? esc(s.edited) + '<span class="edited-mark">(직접 고침)</span>' : s.pieces.map((p, pi) => pieceHtml(p, si, pi)).join('');
    return `<div class="seg" data-i="${si}"><button class="ts" data-t="${s.start}">${fmtTime(s.start)}</button><div class="txt">${body}</div><button class="edit" title="이 문단 직접 고치기">✎</button></div>`;
  }).join('') || '<div class="empty">들린 말이 없어요.</div>';
}
$('#segs').addEventListener('click', (e) => {
  const ts = e.target.closest('.ts');
  if (ts) { const pl = $('#player'); pl.currentTime = +ts.dataset.t; pl.play(); return; }
  const fx = e.target.closest('.fx');
  if (fx) return toggleFix(+fx.dataset.s, +fx.dataset.p);
  const ed = e.target.closest('.edit');
  if (ed) return editSeg(+ed.closest('.seg').dataset.i);
});
async function toggleFix(si, pi) {
  const p = S.note.segments[si].pieces[pi];
  p.fix.applied = !p.fix.applied;
  renderSegs();
  saveNoteSoon();
  if (p.fix.applied && p.fix.kind === 'sound' && S.note.glossary) {
    try {
      await api('POST', 'glossary/learn', { name: S.note.glossary, term: p.fix.after.trim(), alias: p.t });
      toast(`배웠어요: 「${p.t}」 → 「${p.fix.after.trim()}」 (다음부터 바로 고쳐요)`);
    } catch (e) { fail(e); }
  }
}
function segPlain(s) { return s.edited ?? s.pieces.map((p) => (p.fix?.applied ? p.fix.after : p.t)).join(''); }
function editSeg(si) {
  const row = $(`.seg[data-i="${si}"] .txt`);
  const s = S.note.segments[si];
  row.textContent = segPlain(s);
  row.contentEditable = 'true';
  row.focus();
  const done = () => {
    row.contentEditable = 'false';
    const v = row.textContent.trim();
    if (v !== segPlain(s).trim()) { s.edited = v; saveNoteSoon(); }
    renderSegs();
  };
  row.addEventListener('blur', done, { once: true });
  row.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); row.blur(); } if (e.key === 'Escape') { row.textContent = segPlain(s); row.blur(); } });
}
let noteSaveTimer;
function saveNoteSoon() {
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => {
    const n = S.note;
    api('PUT', `notes/${n.id}`, { title: $('#noteTitle').value, segments: n.segments.map((s) => ({ pieces: s.pieces, edited: s.edited ?? null })) }).catch(fail);
  }, 400);
}
$('#noteTitle').addEventListener('change', saveNoteSoon);
$$('[data-exp]').forEach((b) => b.addEventListener('click', () => dl(`notes/${S.note.id}/export?fmt=${b.dataset.exp}`)));
$('#copyBtn').addEventListener('click', async () => {
  const text = S.note.segments.map((s) => segPlain(s).trim()).join('\n');
  try { await navigator.clipboard.writeText(text); toast('글을 복사했어요.'); } catch (e) { fail(e); }
});
$('#recorrectBtn').addEventListener('click', async () => {
  if (!(await confirmBox('단어장으로 다시 고치기', '받아쓴 글은 그대로 두고, 지금 단어장으로 고치기만 새로 합니다. 직접 고친 문단은 원래대로 돌아가요.'))) return;
  try { S.note = await api('POST', `notes/${S.note.id}/recorrect`); renderSegs(); toast('다시 고쳤어요.'); } catch (e) { fail(e); }
});
$('#rerunBtn').addEventListener('click', async () => {
  if (!(await confirmBox('다시 받아쓰기', '지금 단어장으로 처음부터 다시 받아써서 이 기록을 바꿉니다.'))) return;
  try {
    go('new');
    const { jobId } = await api('POST', 'transcribe', { noteId: S.note.id, replace: true, glossary: S.note.glossary, context: S.note.context, language: S.note.language });
    const job = await watchJob(jobId, '#jobBox', '#jobStage', '#jobBar', '#jobPct');
    if (job.state === 'done') openNote(job.result.noteId);
  } catch (e) { fail(e); }
});
$('#delNoteBtn').addEventListener('click', async () => {
  if (!(await confirmBox('기록 지우기', `「${S.note.title}」의 글과 녹음을 이 PC 에서 지웁니다. 되돌릴 수 없어요.`))) return;
  try { await api('DELETE', `notes/${S.note.id}`); toast('지웠어요.'); go('notes'); } catch (e) { fail(e); }
});
const player = $('#player');
player.addEventListener('timeupdate', () => {
  if (!S.note) return;
  const t = player.currentTime;
  $$('.seg').forEach((el) => { const s = S.note.segments[+el.dataset.i]; el.classList.toggle('playing', !!s && t >= s.start && t < s.end); });
});

// 고른 글을 단어장에 넣기
let selText = '';
document.addEventListener('mouseup', () => {
  setTimeout(() => {
    const sel = window.getSelection();
    const pop = $('#selPop');
    const text = sel?.toString().trim() || '';
    if (S.page !== 'note' || !text || text.length > 30 || !sel.anchorNode || !$('#segs').contains(sel.anchorNode)) { pop.hidden = true; return; }
    selText = text;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    pop.style.left = `${Math.max(8, r.left)}px`; pop.style.top = `${r.bottom + 6}px`; pop.hidden = false;
  }, 0);
});
$('#selLearn').addEventListener('mousedown', (e) => e.preventDefault());
$('#selLearn').addEventListener('click', async () => {
  $('#selPop').hidden = true;
  const heard = selText;
  const gl = S.note.glossary || (S.glossaries[0]?.name ?? '');
  const opts = S.glossaries.map((g) => `<option ${g.name === gl ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  const d = await dialog('단어장에 넣기', `
    <label>바르게 적으면<input id="lTerm" value="${esc(heard)}"></label>
    <label class="check"><input type="checkbox" id="lAlias" checked> 「${esc(heard)}」은(는) 잘못 들은 말이에요 → 다르게 들리는 말로 넣고 바로 고치기</label>
    <label>어느 단어장에<select id="lGloss">${opts || '<option>새 단어장</option>'}</select></label>`, (d) => { const i = $('#lTerm', d); i.focus(); i.select(); });
  if (!d) return;
  const term = $('#lTerm', d).value.trim();
  if (!term) return;
  const useAlias = $('#lAlias', d).checked && term !== heard;
  const name = $('#lGloss', d).value;
  try {
    await api('POST', 'glossary/learn', { name, term, alias: useAlias ? heard : null });
    if (name === S.note.glossary) { S.note = await api('POST', `notes/${S.note.id}/recorrect`); renderSegs(); }
    toast(useAlias ? `배웠어요: 「${heard}」 → 「${term}」` : `「${term}」을(를) 단어장에 넣었어요.`);
  } catch (e) { fail(e); }
});

// ---------------------------------------------------------------- 단어장
async function loadGlossPage(select) {
  try { S.glossaries = await api('GET', 'glossaries'); } catch (e) { return fail(e); }
  const want = select || S.gloss?.name || S.state?.settings?.glossary || S.glossaries[0]?.name;
  $('#glossList').innerHTML = S.glossaries.map((g) => `<button class="gl-item ${g.name === want ? 'active' : ''}" data-n="${esc(g.name)}"><span>${esc(g.name)}</span><small>${g.count}</small></button>`).join('') || '<div class="muted">단어장이 없어요.</div>';
  $$('.gl-item').forEach((b) => b.addEventListener('click', () => { if (S.glossDirty) saveGloss(); loadGlossPage(b.dataset.n); }));
  if (want && S.glossaries.some((g) => g.name === want)) openGloss(want); else { S.gloss = null; $('#glossName').textContent = '—'; $('#glossBody').innerHTML = ''; $('#glossPlan').innerHTML = ''; }
}
async function openGloss(name) {
  try { S.gloss = await api('GET', `glossary?name=${encodeURIComponent(name)}`); } catch (e) { return fail(e); }
  S.glossDirty = false;
  $('#glossName').textContent = name;
  $('#glossSaved').textContent = '';
  renderGlossRows();
  renderGlossPlan(S.gloss.plan);
}
function renderGlossPlan(plan) { $('#glossPlan').innerHTML = planHtml(plan, S.gloss.entries.length); }
function renderGlossRows() {
  const q = $('#glossSearch').value.trim().toLowerCase();
  const inHint = new Set((S.gloss.plan?.included || []).map((t) => t.toLowerCase()));
  $('#glossBody').innerHTML = S.gloss.entries.map((e, i) => {
    if (q && !(`${e.term} ${e.aliases.join(' ')} ${e.note}`.toLowerCase().includes(q))) return '';
    return `<tr data-i="${i}" class="${inHint.has(e.term.toLowerCase()) ? 'in-hint' : ''}">
      <td><input type="text" data-k="term" value="${esc(e.term)}" aria-label="낱말"></td>
      <td><input type="text" data-k="aliases" value="${esc(e.aliases.join(', '))}" aria-label="다르게 들리는 말"></td>
      <td><input type="text" data-k="note" value="${esc(e.note)}" aria-label="메모"></td>
      <td class="c"><input type="checkbox" data-k="pinned" ${e.pinned ? 'checked' : ''} aria-label="항상 먼저 넣기"></td>
      <td class="n">${e.hits || ''}</td>
      <td class="c"><button class="btn small ghost danger" data-del="${i}" title="이 줄 지우기">✕</button></td></tr>`;
  }).join('');
}
$('#glossBody').addEventListener('input', (e) => {
  const tr = e.target.closest('tr'); if (!tr || !S.gloss) return;
  const ent = S.gloss.entries[+tr.dataset.i]; const k = e.target.dataset.k;
  if (k === 'pinned') ent.pinned = e.target.checked;
  else if (k === 'aliases') ent.aliases = e.target.value.split(/[,;|/]/).map((x) => x.trim()).filter(Boolean);
  else ent[k] = e.target.value;
  markGlossDirty();
});
$('#glossBody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  S.gloss.entries.splice(+b.dataset.del, 1); renderGlossRows(); markGlossDirty();
});
$('#glossSearch').addEventListener('input', () => S.gloss && renderGlossRows());
$('#glossAdd').addEventListener('click', () => {
  if (!S.gloss) return;
  $('#glossSearch').value = '';
  S.gloss.entries.unshift({ term: '', aliases: [], note: '', pinned: false, hits: 0 });
  renderGlossRows(); $('#glossBody input[data-k=term]').focus();
});
let glossTimer;
function markGlossDirty() { S.glossDirty = true; $('#glossSaved').textContent = '고치는 중…'; clearTimeout(glossTimer); glossTimer = setTimeout(saveGloss, 900); }
async function saveGloss() {
  clearTimeout(glossTimer);
  if (!S.gloss || !S.glossDirty) return;
  S.glossDirty = false;
  try {
    const r = await api('PUT', `glossary?name=${encodeURIComponent(S.gloss.name)}`, { entries: S.gloss.entries.filter((e) => e.term.trim()) });
    S.gloss.plan = r.plan;
    renderGlossPlan(r.plan);
    $$('#glossBody tr').forEach((tr) => { const e = S.gloss.entries[+tr.dataset.i]; tr.classList.toggle('in-hint', !!e && r.plan.included.some((t) => t.toLowerCase() === e.term.toLowerCase())); });
    $('#glossSaved').textContent = '저장했어요';
    const li = $(`.gl-item.active small`); if (li) li.textContent = r.count;
  } catch (e) { S.glossDirty = true; fail(e); }
}
$('#glossNew').addEventListener('click', async () => {
  const name = await ask('새 단어장', '이름', '');
  if (!name) return;
  try { const r = await api('POST', 'glossary/create', { name }); loadGlossPage(r.name); } catch (e) { fail(e); }
});
$('#glossRename').addEventListener('click', async () => {
  if (!S.gloss) return;
  const newName = await ask('이름 바꾸기', '새 이름', S.gloss.name);
  if (!newName || newName === S.gloss.name) return;
  try { await saveGloss(); const r = await api('POST', 'glossary/rename', { name: S.gloss.name, newName }); S.gloss = null; loadGlossPage(r.name); } catch (e) { fail(e); }
});
$('#glossDelete').addEventListener('click', async () => {
  if (!S.gloss) return;
  if (!(await confirmBox('단어장 지우기', `「${S.gloss.name}」 단어장(${S.gloss.entries.length}개)을 지웁니다. 먼저 CSV 로 내보내 두면 되살릴 수 있어요.`))) return;
  try { await api('DELETE', `glossary?name=${encodeURIComponent(S.gloss.name)}`); S.gloss = null; loadGlossPage(); } catch (e) { fail(e); }
});
$('#glossExport').addEventListener('click', async () => { if (!S.gloss) return; await saveGloss(); dl(`glossary/export?name=${encodeURIComponent(S.gloss.name)}`); });
$('#glossImport').addEventListener('click', () => $('#glossFile').click());
$('#glossFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let name = S.gloss?.name;
  const d = await dialog('단어장 가져오기', `
    <p class="muted">엑셀에서 저장한 CSV(낱말, 다르게 들리는 말, 메모 …) 또는 한 줄에 낱말 하나씩 적은 글 파일을 받습니다.</p>
    <label class="check"><input type="radio" name="imode" value="merge" ${name ? 'checked' : 'disabled'}> 지금 단어장「${esc(name || '')}」에 더하기</label>
    <label class="check"><input type="radio" name="imode" value="new" ${name ? '' : 'checked'}> 새 단어장으로 <input id="iName" value="${esc(f.name.replace(/\.[^.]+$/, ''))}" style="margin-left:6px"></label>`);
  if (!d) return;
  const mode = $('input[name=imode]:checked', d).value;
  if (mode === 'new') name = $('#iName', d).value.trim();
  try {
    await saveGloss();
    const r = await api('POST', `glossary/import?name=${encodeURIComponent(name)}&mode=${mode === 'merge' ? 'merge' : 'replace'}`, await f.text(), true);
    toast(`${r.added}개를 읽어서 단어장이 ${r.count}개가 됐어요.`);
    loadGlossPage(r.name);
  } catch (err) { fail(err); }
});

// ---------------------------------------------------------------- 효과 재기
function renderSampleSelect() {
  const sel = $('#evalSample');
  const list = S.state?.samples || [];
  sel.innerHTML = list.map((s) => `<option>${esc(s)}</option>`).join('');
  $('#evalSampleBtn').disabled = !list.length;
  sel.disabled = !list.length;
}
$('#evalSampleBtn').addEventListener('click', () => {
  const s = $('#evalSample').value;
  const guess = s.includes('부품') ? '자동차부품' : (s.includes('AI') ? 'AI수업' : '');
  const g = S.glossaries.find((x) => guess && x.name.includes(guess));
  runEval({ sample: s, glossary: g ? g.name : $('#evalGloss').value, context: s.includes('부품') ? '자동차 부품 대리점 주문 전화입니다.' : '인공지능 수업 강의입니다.' });
});
$('#evalStart').addEventListener('click', async () => {
  const f = $('#evalFile').files[0];
  if (!f) return toast('녹음 파일을 고르세요.');
  if (!$('#evalRef').value.trim()) return toast('정답 글을 적어 주세요.');
  try {
    showJob('#evalJob', '#evalStage', '#evalBar', '#evalPct', { stage: '파일을 넘기는 중', progress: 0 });
    const up = await api('POST', `upload?name=${encodeURIComponent(f.name)}`, f, true);
    runEval({ uploadId: up.uploadId, reference: $('#evalRef').value, glossary: $('#evalGloss').value, context: $('#evalContext').value });
  } catch (e) { fail(e); }
});
async function runEval(body) {
  $('#evalResult').innerHTML = '';
  try {
    const { jobId } = await api('POST', 'eval', { language: 'ko', ...body });
    const job = await watchJob(jobId, '#evalJob', '#evalStage', '#evalBar', '#evalPct');
    if (job.state === 'done') renderEval(job.result);
  } catch (e) { fail(e); }
}
function renderEval(r) {
  const rows = r.rows;
  const base = rows[0], best = rows.reduce((a, b) => (b.cer < a.cer ? b : a));
  const maxCer = Math.max(...rows.map((x) => x.cer), 0.0001);
  const verdict = best.cer < base.cer
    ? `단어장을 쓰니 글자 오류율이 <b>${(base.cer * 100).toFixed(1)}% → ${(best.cer * 100).toFixed(1)}%</b>, 단어장 낱말 맞힘이 <b>${base.termHit} → ${best.termHit}개</b>(${best.termTotal}개 중)가 됐어요.`
    : '이 녹음에서는 단어장이 글자 오류율을 낮추지 못했어요. 정답 글에 단어장 낱말이 들어 있는지 확인해 보세요.';
  $('#evalResult').innerHTML = `<div class="card">
    <p class="verdict">${verdict}</p>
    <p class="muted">녹음 ${fmtDur(r.duration)} · ${esc(r.engine)} · 단어장 ${esc(r.glossary || '없음')} · 30초마다 알려 준 낱말 ${r.hints?.included?.length ?? 0}개</p>
    <table class="eval-table"><thead><tr><th>방법</th><th>글자 오류율 <small>(낮을수록 좋음)</small></th><th>단어장 낱말 맞힘</th><th>걸린 시간</th></tr></thead><tbody>
    ${rows.map((x) => `<tr class="${x === best ? 'best' : ''}">
      <td><b>${esc(x.label)}</b><div class="eval-text">${esc(x.text.slice(0, 220))}${x.text.length > 220 ? '…' : ''}</div></td>
      <td><span class="num">${(x.cer * 100).toFixed(1)}%</span><div class="hbar err"><div style="width:${Math.round(x.cer / maxCer * 100)}%"></div></div></td>
      <td><span class="num">${x.termHit}/${x.termTotal}</span><div class="hbar"><div style="width:${x.termTotal ? Math.round(x.termHit / x.termTotal * 100) : 0}%"></div></div>${x.missed.length ? `<div class="missed">놓침: ${esc(x.missed.join(', '))}</div>` : ''}</td>
      <td>${x.elapsed}초</td></tr>`).join('')}
    </tbody></table>
    <details style="margin-top:12px"><summary>네 방법은 무엇이 다른가요</summary><ul class="muted">
      <li><b>단어장 없이</b> — 엔진 그대로.</li>
      <li><b>첫머리 힌트만</b> — 흔히 쓰는 initial_prompt. 첫 30초에만 힌트가 들어가요.</li>
      <li><b>30초마다 힌트</b> — hotwords 로 30초마다 다시 알려 줘요. 단어장이 크면 두 번 들어 낱말을 골라요.</li>
      <li><b>힌트 + 고치기</b> — 받아쓴 뒤 단어장으로 다르게 들리는 말 · 띄어쓰기 · 비슷한 소리를 고쳐요(자동 적용분만 셈).</li>
    </ul></details></div>`;
}

// ---------------------------------------------------------------- 설정
function renderSettings() {
  const st = S.state; if (!st) return;
  const cur = st.settings.model;
  $('#modelList').innerHTML = st.models.map((m) => {
    const isCur = m.id === cur;
    const dl = st.download.state === 'running' && st.download.model === m.id;
    const pct = dl && st.download.total ? Math.round(st.download.done / st.download.total * 100) : 0;
    let action;
    if (dl) action = `<div class="bar"><div style="width:${pct}%"></div></div><span class="muted">받는 중 ${pct}%</span>`;
    else if (!m.installed) action = `<button class="btn small" data-dl="${esc(m.id)}">받기 (${m.sizeMB >= 1000 ? (m.sizeMB / 1024).toFixed(1) + 'GB' : m.sizeMB + 'MB'})</button>`;
    else if (isCur) action = `<span class="muted">${st.engine.state === 'ready' ? '쓰는 중' : st.engine.state === 'loading' ? '여는 중…' : st.engine.state === 'error' ? '열지 못함: ' + esc(st.engine.message) : '고름'}</span>`;
    else action = `<button class="btn small" data-use="${esc(m.id)}">이 모델 쓰기</button>`;
    return `<div class="model ${isCur ? 'current' : ''}"><div class="name">${esc(m.id)}</div><div class="muted">${esc(m.label)}</div>${action}</div>`;
  }).join('');
  if (st.download.state === 'error') $('#modelList').insertAdjacentHTML('beforeend', `<div class="missed">${esc(st.download.message)}</div>`);
  $$('[data-dl]').forEach((b) => b.addEventListener('click', () => api('POST', 'model/download', { model: b.dataset.dl }).then((s) => { S.state = s; renderSettings(); }).catch(fail)));
  $$('[data-use]').forEach((b) => b.addEventListener('click', () => api('POST', 'settings', { model: b.dataset.use }).then((s) => { S.state = s; renderSettings(); renderEngineChip(); }).catch(fail)));
  if (document.activeElement !== $('#deviceSel')) $('#deviceSel').value = st.settings.device;
  const e = st.engine;
  $('#deviceInfo').textContent = e.state === 'ready' ? (e.message.includes('GPU') ? '그래픽카드로 돌고 있어요.' : 'CPU 로 돌고 있어요.') : '';
  const g = st.gpu || {};
  const onGpu = e.state === 'ready' && e.message.includes('GPU');
  let gh = '';
  if (g.state === 'running') {
    const pct = g.total ? Math.round(g.done / g.total * 100) : 0;
    gh = `<b>GPU 가속 파일 받는 중 ${pct}%</b> <span class="muted">(${(g.done / 1073741824).toFixed(2)} / ${(g.total / 1073741824).toFixed(2)} GB)</span><div class="bar"><div style="width:${pct}%"></div></div>`;
  } else if (onGpu || g.state === 'done') {
    gh = '';
  } else if (g.nvidia && !g.packInstalled) {
    gh = `<b>NVIDIA 그래픽카드가 있어요.</b> GPU 가속 파일(약 1.3GB · NVIDIA 공식 배포본)을 받으면 받아쓰기가 몇 배 빨라져요.<div style="margin-top:8px"><button class="btn small primary" id="gpuBtn">GPU 가속 받기</button></div>`;
  } else if (g.nvidia && g.packInstalled) {
    gh = 'GPU 가속 파일은 있는데 CPU 로 돌고 있어요. 위에서 「자동」을 고르거나 프로그램을 다시 여세요.';
  }
  if (g.state === 'error' || g.message) gh += `<div class="missed">${esc(g.message)}</div>`;
  $('#gpuBox').innerHTML = gh ? `<div class="gpu">${gh}</div>` : '';
  $('#gpuBtn')?.addEventListener('click', () => api('POST', 'gpu/install').then((s) => { S.state = s; renderSettings(); }).catch(fail));
  $('#dataDir').textContent = st.dataDir;
  $('#aboutVer').textContent = `버전 ${st.version}`;
  renderSampleSelect();
}
$('#deviceSel').addEventListener('change', () => api('POST', 'settings', { device: $('#deviceSel').value }).then((s) => { S.state = s; renderSettings(); }).catch(fail));
$('#openData').addEventListener('click', () => api('POST', 'open-data').catch(fail));
$('#customModelBtn').addEventListener('click', () => {
  const v = $('#customModel').value.trim(); if (!v) return;
  api('POST', 'settings', { model: v }).then((s) => { S.state = s; renderSettings(); toast('그 폴더의 모델을 열어 봅니다.'); }).catch(fail);
});

// ---------------------------------------------------------------- 시작
(async () => {
  if (!TOKEN) { document.body.innerHTML = '<p style="padding:40px">프로그램을 다시 열어 주세요.</p>'; return; }
  await refreshState();
  renderSampleSelect();
  loadGlossSelects();
  setInterval(refreshState, 3000);
  window.addEventListener('beforeunload', () => { if (S.glossDirty) saveGloss(); });
})();
