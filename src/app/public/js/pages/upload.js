// F01 녹음 올리기 — 끌어다 놓기 · 고르기 · 가짜 확인 체크 · 진행 막대 + 받아쓰기 일꾼 상태 · 예시 녹음 · F12 폴더 자동 보내기 안내.
import { api } from '../api.js';
import { html, render, fmtSec, fmtWhen, href } from '../ui.js';

const AUDIO_EXT = ['wav', 'mp3', 'm4a', 'aac', 'amr', 'ogg', 'opus', 'webm', '3gp', 'flac', 'mp4'];
const WORKER_POLL_MS = 10_000;

const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(String(name || ''))?.[1] || '').toLowerCase();
const isAudio = (f) => String(f.type || '').startsWith('audio/') || AUDIO_EXT.includes(extOf(f.name));
function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}
/** datetime-local 값(브라우저 시간대)으로 쓸 「지금」 */
function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
/** 서버가 준 주소는 같은 사이트 경로(/...)만 링크로 쓴다 */
const safePath = (u) => (typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') ? u : null);
/** 시각이 깨져 있어도 화면이 멈추지 않게 */
const when = (iso) => { try { return fmtWhen(iso); } catch { return ''; } };
const callLink = (id) => href('/calls/' + encodeURIComponent(id));

export default {
  title: '녹음 올리기',
  async mount(el, ctx) {
    const meta = ctx.meta || {};
    const maxMB = Number(meta.limits?.maxUploadMB) || 10;
    const maxSec = Number(meta.limits?.maxAudioSec) || 300;
    const rows = []; // {id, file, status: ready|blocked|uploading|done|duplicate|error, progress, message, callId}
    let seq = 0;
    let busy = false;
    let disposed = false;
    let pollTimer = null;

    render(el, html`<div class="page upload-page">
      <div class="page-head"><div>
        <p class="eyebrow">F01 · 녹음 올리기</p>
        <h1>녹음 올리기</h1>
        <p class="sub">통화 녹음 파일을 올리면 받아쓰고 주문 카드로 정리합니다.</p>
      </div></div>

      <div class="notice notice-warn" role="note"><strong>실제 고객 통화는 올리지 마세요.</strong> 누구나 보는 공개 데모라 가짜(연습) 녹음만 받습니다.</div>

      <section class="card upload-box" aria-labelledby="upTitle">
        <h2 id="upTitle" class="sr-only">파일 고르기</h2>
        <div class="upload-drop" data-ref="drop">
          <svg class="upload-drop-icon" viewBox="0 0 24 24" width="44" height="44" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
          <p class="upload-drop-title">여기에 녹음 파일을 끌어다 놓으세요</p>
          <p class="upload-drop-or">또는</p>
          <label class="btn btn-primary btn-lg upload-pick">파일 고르기<input type="file" class="sr-only" data-ref="file" accept="audio/*,.m4a,.amr,.3gp" multiple></label>
          <p class="help">m4a · mp3 · wav · amr · 3gp 등 · 한 파일 ${maxMB}MB · ${Math.round(maxSec / 60)}분 이하 · 여러 개를 고르면 하나씩 차례로 올립니다(한 시간에 5개까지).</p>
        </div>

        <ul class="upload-rows" data-ref="rows" aria-live="off"></ul>

        <div class="upload-options">
          <label class="field"><span>녹음 시각</span><input class="input" type="datetime-local" data-ref="when" value="${localNow()}"></label>
          <label class="field"><span>걸려 온 번호 (가짜 번호만 · 선택)</span><input class="input" type="tel" inputmode="tel" data-ref="caller" maxlength="20" placeholder="예: 010-0000-0000" autocomplete="off"></label>
        </div>
        <label class="check upload-confirm"><input type="checkbox" data-ref="fake"><span><strong>가짜(연습) 녹음만 올립니다. 실제 고객 통화는 올리지 않습니다.</strong></span></label>
        <button type="button" class="btn btn-primary btn-lg btn-block" data-act="upload" disabled>올리기</button>
        <p class="help" data-ref="hint"></p>
        <p class="sr-only" role="status" data-ref="announce"></p>
      </section>

      <section class="card" aria-labelledby="flowTitle">
        <h2 id="flowTitle">올린 녹음은 이렇게 정리됩니다</h2>
        <ol class="upload-flow">
          <li><strong>올리기</strong><span>휴대폰 · PC</span></li>
          <li><strong>16kHz 로 바꿈</strong><span>서버가 받아쓰기 좋은 소리로</span></li>
          <li><strong>받아쓰기 일꾼</strong><span>Whisper 가 글로</span></li>
          <li><strong>AI 카드</strong><span>주문 내용만 뽑아 정리</span></li>
          <li><strong>확인 · 확정</strong><span>사람이 보고 확정</span></li>
        </ol>
        <p class="help">올린 원본 파일은 바꾼 뒤 지웁니다. 받아쓰기 일꾼에게는 바꾼 소리 파일만 갑니다.</p>
      </section>

      <div class="grid-2 upload-side">
        <section class="card" aria-labelledby="workerTitle">
          <div class="card-title"><h2 id="workerTitle">받아쓰기 일꾼 상태</h2><button type="button" class="btn btn-sm btn-ghost" data-act="refresh">새로고침</button></div>
          <div data-ref="worker" aria-live="off"><p class="loading">확인 중…</p></div>
          <p class="help">10초마다 저절로 새로 봅니다.</p>
        </section>
        <section class="card" aria-labelledby="sampleTitle">
          <h2 id="sampleTitle">예시 녹음 내려받기</h2>
          <p class="muted small">가짜 주문 통화 녹음입니다. 내려받아 위에 올려 보세요.</p>
          <div data-ref="samples"><p class="loading">불러오는 중…</p></div>
        </section>
      </div>

      <section class="card card-soft upload-f12" aria-labelledby="f12Title">
        <p class="eyebrow">F12 · 녹음 폴더 자동 보내기</p>
        <h2 id="f12Title">녹음 폴더를 지켜보다 알아서 보내기</h2>
        <p>대리점 PC 에 작은 프로그램(<code>tools/folder-sender.mjs</code>)을 두면, 통화 녹음 폴더에 새 파일이 생길 때마다 이 서버로 보냅니다. 따로 올리지 않아도 1분 안에 통화 목록에 나타납니다.</p>
        <p class="small muted">실행 예시(윈도우 · Node.js 24 필요). 먼저 PC 의 저장소 밖 폴더에 <code>ingest.env</code> 파일을 만들고 <code>INGEST_TOKEN=관리자가 준 토큰</code> 한 줄만 적습니다. 토큰은 화면 · 메신저 · 저장소에 붙여 두지 마세요.</p>
        <pre class="upload-cmd" data-ref="cmd"></pre>
        <ul class="small upload-f12-notes">
          <li>5초마다 폴더를 보고, 다 써진 녹음 파일만 보냅니다. 녹음 시각은 파일을 고친 시각으로 들어갑니다.</li>
          <li>보낼 때 「가짜 녹음」 표시가 붙습니다. <strong>공개 데모에서는 가짜 녹음만 받습니다.</strong></li>
          <li>같은 파일을 다시 보내도 한 번만 들어갑니다.</li>
          <li>받아쓰기 일꾼이 꺼져 있으면 줄을 서서 기다렸다가 켜지면 차례로 받아씁니다.</li>
        </ul>
      </section>
    </div>`);

    const root = el.querySelector('.upload-page');
    const ref = (n) => root.querySelector(`[data-ref="${n}"]`);
    const fileInput = ref('file');
    const drop = ref('drop');
    const fakeBox = ref('fake');
    const upBtn = root.querySelector('[data-act="upload"]');

    // F12 실행 예시: 이 사이트 주소를 넣고, 토큰 값은 쓰지 않는다
    ref('cmd').textContent = `node --env-file=C:\\콜노트\\ingest.env folder-sender.mjs --dir "C:\\통화녹음" --url ${location.origin}`;

    // ── 파일 줄 ──
    function addFiles(list) {
      for (const file of Array.from(list || [])) {
        const row = { id: ++seq, file, status: 'ready', progress: 0, message: '', callId: null };
        if (!file.size) { row.status = 'blocked'; row.message = '빈 파일입니다.'; }
        else if (file.size > maxMB * 1024 * 1024) { row.status = 'blocked'; row.message = `파일이 너무 큽니다(${fmtSize(file.size)}). ${maxMB}MB 이하만 올릴 수 있습니다.`; }
        else if (!isAudio(file)) { row.status = 'blocked'; row.message = '녹음(오디오) 파일이 아닌 것 같습니다. m4a · mp3 · wav · amr · 3gp 등을 올려 주세요.'; }
        rows.push(row);
      }
      renderRows();
    }
    function rowView(r) {
      const label = {
        ready: html`<span class="chip chip-cancelled">올릴 준비</span>`,
        blocked: html`<span class="chip chip-failed">못 올림</span>`,
        uploading: html`<span class="chip chip-working">올리는 중 ${Math.round(r.progress * 100)}%</span>`,
        done: html`<span class="chip chip-working">받아쓰기 기다리는 중</span>`,
        duplicate: html`<span class="chip chip-cancelled">이미 올린 파일</span>`,
        error: html`<span class="chip chip-failed">실패</span>`,
      }[r.status];
      const pct = r.status === 'uploading' ? Math.round(r.progress * 100) : ['done', 'duplicate'].includes(r.status) ? 100 : 0;
      return html`<li class="upload-row is-${r.status}">
        <div class="upload-row-top">
          <span class="upload-name">${r.file.name}</span>
          <span class="upload-size muted small">${fmtSize(r.file.size)}</span>
          ${['ready', 'blocked', 'error'].includes(r.status) && !busy ? html`<button type="button" class="btn btn-sm btn-ghost upload-remove" data-act="remove" data-id="${r.id}" aria-label="${r.file.name} 빼기">빼기</button>` : ''}
        </div>
        ${['uploading', 'done', 'duplicate'].includes(r.status) ? html`<div class="upload-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="올리기 진행"><i style="width:${pct}%"></i></div>` : ''}
        <div class="upload-row-msg">${label}${r.message ? html` <span>${r.message}</span>` : ''}
          ${r.callId ? html` <a class="upload-link" href="${callLink(r.callId)}">통화 보기 ›</a>` : ''}</div>
      </li>`;
    }
    function renderRows() {
      if (disposed) return;
      render(ref('rows'), html`${rows.map(rowView)}`);
      updateButton();
    }
    function updateButton() {
      const ready = rows.filter((r) => r.status === 'ready').length;
      upBtn.disabled = busy || !ready || !fakeBox.checked;
      upBtn.textContent = busy ? '올리는 중…' : ready ? `올리기 (${ready}개)` : '올리기';
      const hint = ref('hint');
      hint.textContent = busy ? '' : !ready ? '먼저 파일을 고르거나 끌어다 놓으세요.' : !fakeBox.checked ? '위 확인 칸에 체크해야 올릴 수 있습니다.' : '';
    }

    // ── 올리기(하나씩 차례로) ──
    async function uploadAll() {
      if (busy || !fakeBox.checked) return;
      const whenVal = ref('when').value;
      const when = whenVal ? new Date(whenVal) : new Date();
      const recordedAt = Number.isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString();
      const caller = ref('caller').value.trim();
      busy = true;
      renderRows();
      let uploaded = 0;
      for (const r of rows) {
        if (disposed) return;
        if (r.status !== 'ready') continue;
        r.status = 'uploading';
        r.progress = 0;
        r.message = '';
        renderRows();
        const fd = new FormData();
        fd.append('file', r.file, r.file.name);
        fd.append('recordedAt', recordedAt);
        if (caller) fd.append('callerNumber', caller);
        fd.append('fakeConfirm', 'yes');
        let lastPaint = 0;
        try {
          const out = await api.upload('/api/calls/upload', fd, (p) => {
            r.progress = p;
            const now = Date.now();
            if (now - lastPaint > 150 || p >= 1) { lastPaint = now; renderRows(); }
          });
          if (disposed) return;
          r.callId = out?.callId || out?.call?.id || null;
          if (out?.status === 'duplicate') {
            r.status = 'duplicate';
            r.message = '같은 파일이 이미 들어와 있습니다.';
          } else {
            r.status = 'done';
            r.message = out?.call?.statusLabel && out.call.statusLabel !== '받아쓰기 기다리는 중' ? out.call.statusLabel : '';
            uploaded += 1;
          }
        } catch (err) {
          if (disposed) return;
          r.status = 'error';
          r.message = err?.message || '올리지 못했습니다.';
          if (err?.status === 429) {
            // 빈도 제한: 남은 파일은 「올릴 준비」로 두고 멈춘다
            r.status = 'ready';
            r.message = err.message;
            break;
          }
        }
        renderRows();
      }
      busy = false;
      renderRows();
      const failed = rows.filter((r) => r.status === 'error').length;
      ref('announce').textContent = `올리기 끝: ${uploaded}개 올림${failed ? `, ${failed}개 실패` : ''}.`;
      if (uploaded) { loadWorker(); ctx.refreshMeta?.(); }
    }

    // ── 받아쓰기 일꾼 상태 ──
    function workerView(w) {
      const q = w?.queue || {};
      const waiting = Number(q.waiting) || 0;
      const working = Number(q.working) || 0;
      return html`
        <p class="upload-worker-state">${w?.online
          ? html`<span class="chip chip-confirmed">켜짐</span> 받아쓰기 일꾼이 일하고 있습니다.`
          : html`<span class="chip chip-draft">대기 중</span> 받아쓰기 일꾼이 지금 꺼져 있습니다.`}</p>
        ${w?.online ? html`<dl class="upload-dl">
            ${w.engine ? html`<div><dt>엔진</dt><dd>${w.engine}</dd></div>` : ''}
            ${w.gpu ? html`<div><dt>GPU</dt><dd>${w.gpu}</dd></div>` : ''}
            ${w.lastSeen ? html`<div><dt>마지막 신호</dt><dd>${when(w.lastSeen)}</dd></div>` : ''}
          </dl>`
          : html`<p class="small">일꾼(GPU PC)이 꺼져 있으면 올린 녹음은 <strong>줄을 서서 기다렸다가</strong> 일꾼이 켜지면 차례로 받아씁니다. 그동안 미리 받아쓴 가짜 통화로 다른 기능을 써 보세요.</p>`}
        <div class="upload-queue">
          <div><span class="upload-queue-num">${waiting}</span><span class="muted small">기다리는 녹음</span></div>
          <div><span class="upload-queue-num">${working}</span><span class="muted small">받아쓰는 중</span></div>
        </div>`;
    }
    async function loadWorker() {
      let w = null;
      try { w = await api.get('/api/worker/status'); } catch { w = (await ctx.refreshMeta?.())?.worker || meta.worker || null; }
      if (disposed) return;
      render(ref('worker'), w ? workerView(w) : html`<p class="muted">상태를 읽지 못했습니다.</p>`);
    }
    const poll = () => {
      if (disposed) return;
      if (!document.hidden) loadWorker();
      pollTimer = setTimeout(poll, WORKER_POLL_MS);
    };

    // ── 예시 녹음 ──
    async function loadSamples() {
      let list = [];
      try {
        const out = await api.get('/api/samples');
        list = Array.isArray(out?.samples) ? out.samples : [];
      } catch { list = []; }
      if (disposed) return;
      const usable = list.filter((s) => safePath(s?.url));
      render(ref('samples'), usable.length
        ? html`<ul class="upload-samples">${usable.map((s) => html`<li>
            <div class="upload-sample-title">${s.title || '예시 녹음'}${s.durationSec ? html` <span class="muted small">${fmtSec(s.durationSec)}</span>` : ''}</div>
            <div class="row">
              <a class="btn btn-sm" href="${safePath(s.url)}" download>내려받기</a>
              ${s.callId ? html`<a class="btn btn-sm btn-ghost" href="${callLink(s.callId)}">받아쓴 결과 보기</a>` : ''}
            </div></li>`)}</ul>`
        : html`<p class="muted">예시 녹음 준비 중입니다.</p>`);
    }

    // ── 이벤트 ──
    const onClick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled || !root.contains(b)) return;
      if (b.dataset.act === 'upload') uploadAll();
      else if (b.dataset.act === 'refresh') loadWorker();
      else if (b.dataset.act === 'remove') {
        const i = rows.findIndex((r) => String(r.id) === b.dataset.id);
        if (i >= 0 && !busy) { rows.splice(i, 1); renderRows(); }
      }
    };
    const onChange = (e) => {
      if (e.target === fileInput) { addFiles(fileInput.files); fileInput.value = ''; }
      else if (e.target === fakeBox) updateButton();
    };
    const onDragOver = (e) => { e.preventDefault(); drop.classList.add('is-drag'); };
    const onDragLeave = (e) => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('is-drag'); };
    const onDrop = (e) => { e.preventDefault(); drop.classList.remove('is-drag'); addFiles(e.dataTransfer?.files); };
    // 상자 밖에 떨어뜨려도 브라우저가 파일을 열어 화면을 떠나지 않게
    const blockDoc = (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); };

    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    drop.addEventListener('dragover', onDragOver);
    drop.addEventListener('dragenter', onDragOver);
    drop.addEventListener('dragleave', onDragLeave);
    drop.addEventListener('drop', onDrop);
    document.addEventListener('dragover', blockDoc);
    document.addEventListener('drop', blockDoc);

    renderRows();
    loadSamples();
    poll();

    return () => {
      disposed = true;
      clearTimeout(pollTimer);
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      drop.removeEventListener('dragover', onDragOver);
      drop.removeEventListener('dragenter', onDragOver);
      drop.removeEventListener('dragleave', onDragLeave);
      drop.removeEventListener('drop', onDrop);
      document.removeEventListener('dragover', blockDoc);
      document.removeEventListener('drop', blockDoc);
    };
  },
};
