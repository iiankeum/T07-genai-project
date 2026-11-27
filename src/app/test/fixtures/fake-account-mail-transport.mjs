// 가짜 전용. 메모리에서만 중복을 막으며 재시작/다중 프로세스/실공급자 보장은 없다.
export function fakeAccountMailTransport({outcomes=[],gate=Promise.resolve()}={}) {
  const accepted=new Map(), pending=new Map();let calls=0, deliveries=0;
  const transport={async send(message,{idempotencyKey,signal}) {
    calls++;
    const fingerprint=JSON.stringify(message);
    const known=accepted.get(idempotencyKey)||pending.get(idempotencyKey);
    if(known&&known.fingerprint!==fingerprint)return {status:'rejected',reason:'permanent'};
    if(accepted.has(idempotencyKey))return {status:'accepted'};
    if(pending.has(idempotencyKey))return pending.get(idempotencyKey).promise;
    const outcome=outcomes.shift()||'accepted';
    const promise=(async()=>{
      await gate;
      if(signal.aborted)throw Error('fake cancelled');
      if(outcome==='temporary'||outcome==='permanent')return {status:'rejected',reason:outcome};
      if(outcome==='throw')throw Error('FAKE-SECRET-EXCEPTION');
      if(outcome==='malformed')return {status:'bad',raw:'FAKE-SECRET-RESPONSE'};
      accepted.set(idempotencyKey,{fingerprint});deliveries++;
      if(outcome==='lost-after-accept')throw Error('FAKE-SECRET-ACCEPTED-RESPONSE-LOST');
      return {status:'accepted',raw:'FAKE-SECRET-RESPONSE'};
    })();
    pending.set(idempotencyKey,{fingerprint,promise});
    try{return await promise;}finally{pending.delete(idempotencyKey);}
  }};
  return {transport,stats:()=>({calls,deliveries,acceptedKeys:accepted.size})};
}
