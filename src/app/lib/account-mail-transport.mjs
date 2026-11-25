// 공급자 중립 단일 attempt 계약. auth/outbox/DB와 연결하지 않는다.
// 호출자가 제공한 adapter만 호출한다. 영속 큐·lease·재시도·실메일 adapter는 없다.
const TTL = Object.freeze({verify:86_400_000, reset:1_800_000, invite:604_800_000});
const SUBJECT = Object.freeze({verify:'아차 이메일 인증', reset:'아차 비밀번호 재설정', invite:'아차 작업공간 초대'});
const KEYS = ['createdAt','expiresAt','idempotencyKey','kind','to','token'].sort();
const result = (status, code) => Object.freeze({status, code, inboxDeliveryVerified:false});
function origin(raw) {
  if (typeof raw !== 'string' || raw.length > 2048 || /[\s\\]/.test(raw)) throw Error();
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || ['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw Error();
  return url.origin;
}
function message(job, base, now) {
  if (!job || Object.keys(job).sort().join('|') !== KEYS.join('|') || !Object.hasOwn(TTL,job.kind)
    || typeof job.to !== 'string' || job.to.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(job.to)
    || typeof job.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(job.token)
    || typeof job.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(job.idempotencyKey) || job.idempotencyKey === job.token
    || !Number.isSafeInteger(job.createdAt) || !Number.isSafeInteger(job.expiresAt) || !Number.isSafeInteger(now)
    || job.createdAt > now || job.expiresAt <= job.createdAt || job.expiresAt-job.createdAt > TTL[job.kind]) throw Error();
  if (job.expiresAt <= now) return null;
  const fragment = job.kind === 'invite' ? `/invite/${job.token}` : `${job.kind === 'reset' ? '/password/reset' : '/verify'}?token=${job.token}`;
  // 사용자 subject/from/HTML/첨부는 받지 않는다. 본문은 고정 텍스트만 사용한다.
  return Object.freeze({to:job.to, subject:SUBJECT[job.kind], text:`${SUBJECT[job.kind]} 링크입니다.\n${base}/#${fragment}\n만료 시각(UTC): ${new Date(job.expiresAt).toISOString()}\n요청하지 않았다면 이 메일을 무시하세요.`,kind:job.kind,expiresAt:job.expiresAt});
}
export async function attemptAccountMail(job, {trustedOrigin,transport,now=Date.now,timeoutMs=10_000,signal} = {}) {
  let payload, key, sendFunction;
  try {
    if (signal != null && !(signal instanceof AbortSignal)) throw Error();
    if (!transport || typeof transport.send !== 'function' || typeof now !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs<1 || timeoutMs>30_000) throw Error();
    payload=message(job,origin(trustedOrigin),now());
    key=job.idempotencyKey;sendFunction=transport.send.bind(transport);
  } catch { return result('blocked','invalid_contract'); }
  if (!payload) return result('skipped','expired');
  if (signal?.aborted) return result('skipped','cancelled_before_attempt');
  const controller=new AbortController();let timer,abort,started=false;
  const interrupted = new Promise(resolve=>{
    abort=()=>{controller.abort();resolve(started?result('unknown','acceptance_unknown'):result('skipped','cancelled_before_attempt'));};
    signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(abort,timeoutMs);
  });
  const expiredBeforeSend=Symbol(),invalidClock=Symbol();
  const send=Promise.resolve().then(()=>{
    if(controller.signal.aborted)return null;
    let current;try{current=now();}catch{return invalidClock;}
    if(!Number.isSafeInteger(current))return invalidClock;
    if(payload.expiresAt<=current)return expiredBeforeSend;
    started=true;return sendFunction(payload,{idempotencyKey:key,signal:controller.signal});
  }).then(reply=>{
    if(reply===invalidClock)return result('blocked','invalid_contract');
    if(reply===expiredBeforeSend)return result('skipped','expired');
    const status=reply?.status;
    if (status === 'accepted') return result('accepted','provider_accepted');
    if (status === 'rejected') {
      const reason=reply.reason;
      if(reason==='temporary')return result('rejected','temporary');
      if(reason==='permanent')return result('rejected','permanent');
    }
    return result('unknown','invalid_provider_result');
  }).catch(()=>result('unknown','acceptance_unknown')); // 예외/응답 전문은 전파·기록하지 않는다.
  try { return await Promise.race([send,interrupted]); }
  finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
}
