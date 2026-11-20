// 이 탭의 인증된 사용자·작업공간에서만 사용하는 공유 지식 제안 복구함.
// 서버 요청이나 자동 제출은 하지 않는다. 통화 원문, 녹음, 인증 정보는 저장하지 않는다.
const PREFIX = 'ahmatda:knowledge-recovery:v1:';
export const RECOVERY_TTL = 15 * 60 * 1000;
const validId = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
const keyFor = a => a?.demo === false && !a.machine && validId(a.user?.id) && validId(a.workspace?.id)
  ? PREFIX + a.workspace.id + ':' + a.user.id : null;
const kinds = ['현장말', '오인식', '거래처', '차종', '부품', '업무 절차'];
const limits = {term:80, aliases:300, standard:60, phone:20,contactName:40, note:2000, evidenceNote:300};
const clean = (s,max) => typeof s === 'string' && s.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s);
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);

function validate(p) {
  if (!record(p) || !kinds.includes(p.kind) || !(p.id === null || validId(p.id)) ||
      !(p.sourceCallId === null || validId(p.sourceCallId)) ||
      !(p.sourceSegIndex === null || (p.sourceCallId && Number.isSafeInteger(p.sourceSegIndex) && p.sourceSegIndex >= 0 && p.sourceSegIndex < 1000000)) ||
      !Array.isArray(p.relations) || p.relations.length > 10) return null;
  const result = { id:p.id, kind:p.kind, sourceCallId:p.sourceCallId, sourceSegIndex:p.sourceSegIndex };
  for (const [k,n] of Object.entries(limits)) {
    if (k === 'contactName' && p[k] === undefined) { continue; } // 기존 복구 초안 호환
    if (!clean(p[k],n)) return null;
    result[k] = p[k];
  }
  if (!p.relations.every(r => record(r) && clean(r.relation,60) && clean(r.target,80))) return null;
  result.relations = p.relations.map(({relation,target}) => ({relation,target}));
  return result;
}

export function createRecovery(getStore = () => window.sessionStorage, now = Date.now) {
  function scan(access, clearAll = false) {
    const key = keyFor(access), t = now();
    let draft = null;
    try {
      const store = getStore();
      for (let i = store.length-1; i >= 0; i--) {
        const name = store.key(i);
        if (!name?.startsWith(PREFIX)) continue;
        if (clearAll || (access != null && key !== name)) { store.removeItem(name); continue; }
        const raw = store.getItem(name);
        let envelope;
        try { if (raw && raw.length <= 24000) envelope = JSON.parse(raw); } catch { /* 손상 */ }
        const payload = envelope?.owner === name && Number.isSafeInteger(envelope.at) &&
          t >= envelope.at && t-envelope.at < RECOVERY_TTL && validate(envelope.payload);
        if (!payload) store.removeItem(name);
        else if (key === name) draft = payload; // 미인증 상태에서는 정리만 하고 내용을 반환하지 않는다.
      }
    } catch { /* 브라우저 저장소 차단 시 복구를 생략한다. */ }
    return draft;
  }
  return {
    read: access => scan(access),
    clear: () => scan(null, true),
    discard(access) {
      const key = keyFor(access);
      try { if (key) getStore().removeItem(key); } catch { /* 차단된 저장소 */ }
    },
    save(access,payload) {
      const key = keyFor(access), filtered = validate(payload);
      if (!key || !filtered) return false;
      try { scan(access); getStore().setItem(key,JSON.stringify({owner:key,at:now(),payload:filtered})); return true; }
      catch { return false; }
    },
  };
}
// 제출한 AI 초안을 가리키는 일회성 실행 인자만 제거한다. 새로고침 때 같은 제안을 다시 열지 않는다.
export function consumedProposalHash(hash) {
  const [path,query] = String(hash).split('?',2);
  if (!['#/knowledge','#/glossary'].includes(path)) return hash;
  const args = new URLSearchParams(query);
  if (!args.has('call')) return hash;
  for (const name of ['call','seg','draft']) args.delete(name);
  const rest = args.toString();
  return path + (rest ? '?' + rest : '');
}
export const knowledgeRecovery = createRecovery();
