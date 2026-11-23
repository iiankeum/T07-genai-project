import test from 'node:test';
import assert from 'node:assert/strict';
import {attemptAccountMail} from '../lib/account-mail-transport.mjs';
import {fakeAccountMailTransport} from './fixtures/fake-account-mail-transport.mjs';
const timestamp=1_800_000_000_000;
const job=()=>({kind:'verify',to:'fake@example.invalid',token:'t'.repeat(43),idempotencyKey:'fake_delivery_0001',createdAt:timestamp,expiresAt:timestamp+60_000});
const options=transport=>({trustedOrigin:'https://team.example.invalid',transport,now:()=>timestamp});
test('고정 3종 텍스트·안정 키만 전달, 접수는 수신완료 아님',async()=>{
 for(const kind of ['verify','reset','invite']){
  let captured;const transport={send:async(message,context)=>{captured={message,context};return{status:'accepted',raw:'FAKE-SECRET'};}};
  const r=await attemptAccountMail({...job(),kind},options(transport));
  assert.deepEqual(r,{status:'accepted',code:'provider_accepted',inboxDeliveryVerified:false});
  assert.equal(captured.context.idempotencyKey,job().idempotencyKey);
  assert.ok(captured.message.text.includes('https://team.example.invalid/#/'));assert.ok(captured.message.text.includes(job().token));
  assert.deepEqual(Object.keys(captured.message).sort(),['expiresAt','kind','subject','text','to']);
 }
});
test('임의 템플릿·헤더·토큰·키·만료 형식은 호출 전 거절',async()=>{
 const fake=fakeAccountMailTransport();
 for(const patch of [{subject:'injected'},{html:'<img>'},{url:'https://evil.invalid'},{from:'fake@example.invalid'},{kind:'other'},{to:'fake@example.invalid\r\nBcc: another@example.invalid'},{token:'bad'},{idempotencyKey:'bad'},{idempotencyKey:job().token},{createdAt:timestamp+1},{expiresAt:timestamp},{expiresAt:timestamp+604_800_001}])assert.equal((await attemptAccountMail({...job(),...patch},options(fake.transport))).status,'blocked');
 assert.equal(fake.stats().calls,0);
});
test('HTTPS trusted origin 형식 거절은 비밀 노출과 호출 없이 처리',async()=>{
 const fake=fakeAccountMailTransport();
 for(const trustedOrigin of ['http://team.example.invalid','https://user:FAKE-SECRET@team.example.invalid','https://team.example.invalid/path','https://team.example.invalid/?token=FAKE-SECRET','https://team.example.invalid/#x','https://localhost','https://127.0.0.1','https://[::1]','https://team.example.invalid\\@evil.invalid']){
  const r=await attemptAccountMail(job(),{...options(fake.transport),trustedOrigin});assert.equal(r.status,'blocked');assert.ok(!JSON.stringify(r).includes('FAKE-SECRET'));
 }assert.equal(fake.stats().calls,0);
});
test('만료경계·사전/즉시취소는 adapter 호출0',async()=>{
 const fake=fakeAccountMailTransport();assert.equal((await attemptAccountMail({...job(),createdAt:timestamp-60_000,expiresAt:timestamp},options(fake.transport))).code,'expired');
 const c=new AbortController();c.abort();assert.equal((await attemptAccountMail(job(),{...options(fake.transport),signal:c.signal})).status,'skipped');
 const late=new AbortController(),pending=attemptAccountMail(job(),{...options(fake.transport),signal:late.signal});late.abort();assert.equal((await pending).status,'skipped');assert.equal(fake.stats().calls,0);
});
test('일시 실패 자동retry 없음, 명시retry만 같은payload/key 사용',async()=>{
 const fake=fakeAccountMailTransport({outcomes:['temporary','accepted']});assert.equal((await attemptAccountMail(job(),options(fake.transport))).code,'temporary');assert.equal(fake.stats().calls,1);
 assert.equal((await attemptAccountMail(job(),options(fake.transport))).status,'accepted');assert.deepEqual(fake.stats(),{calls:2,deliveries:1,acceptedKeys:1});
});
test('동시 동일key 호출은 메모리 fake에서만 중복 제거',async()=>{
 let release;const gate=new Promise(r=>release=r),fake=fakeAccountMailTransport({gate});const a=attemptAccountMail(job(),options(fake.transport)),b=attemptAccountMail(job(),options(fake.transport));release();assert.equal((await a).status,'accepted');assert.equal((await b).status,'accepted');assert.equal(fake.stats().deliveries,1);
});
test('같은key 다른payload는 거절, 호출후key변경은 최초snapshot 유지',async()=>{
 const fake=fakeAccountMailTransport(),input=job(),a=attemptAccountMail(input,options(fake.transport));input.idempotencyKey='mutated_delivery_key';await a;
 assert.equal((await attemptAccountMail({...job(),to:'other@example.invalid'},options(fake.transport))).code,'permanent');assert.equal(fake.stats().deliveries,1);
});
test('accept 후 응답유실 unknown; retry fake중복제거는 재시작보장 아님',async()=>{
 const fake=fakeAccountMailTransport({outcomes:['lost-after-accept']});assert.equal((await attemptAccountMail(job(),options(fake.transport))).status,'unknown');assert.equal(fake.stats().deliveries,1);
 assert.equal((await attemptAccountMail(job(),options(fake.transport))).status,'accepted');assert.equal(fake.stats().deliveries,1);
 const fresh=fakeAccountMailTransport();await attemptAccountMail(job(),options(fresh.transport));assert.equal(fresh.stats().deliveries,1);
});
test('timeout·진행중취소는 unknown; adapter 늦은accept를완료로오인하지않음',async()=>{
 let complete,seenSignal;const transport={send:(_m,{signal})=>{seenSignal=signal;return new Promise(r=>complete=r);}};
 const r=await attemptAccountMail(job(),{...options(transport),timeoutMs:5});assert.equal(r.status,'unknown');assert.equal(seenSignal.aborted,true);complete({status:'accepted'});assert.equal(r.status,'unknown');
 const c=new AbortController(),pending=attemptAccountMail(job(),{...options(transport),signal:c.signal});await Promise.resolve();c.abort();assert.equal((await pending).status,'unknown');complete({status:'accepted'});
});
test('예외·잘못된응답·getter오류도고정결과만반환',async()=>{
 for(const send of [()=>{throw Error('FAKE-SECRET');},async()=>({status:'bad',raw:'FAKE-SECRET'}),async()=>Object.defineProperty({},'status',{get(){throw Error('FAKE-SECRET');}})]){
  const r=await attemptAccountMail(job(),options({send}));assert.equal(r.status,'unknown');assert.ok(!JSON.stringify(r).includes('FAKE-SECRET'));
 }
});
test('호출 준비 후 실제 adapter 직전 만료와 잘못된 signal은 호출0',async()=>{
 const fake=fakeAccountMailTransport();let clock=timestamp;
 const pending=attemptAccountMail(job(),{...options(fake.transport),now:()=>clock});clock=job().expiresAt;
 assert.equal((await pending).code,'expired');
 assert.equal((await attemptAccountMail(job(),{...options(fake.transport),signal:{aborted:false}})).code,'invalid_contract');
 assert.equal(fake.stats().calls,0);
});
test('변하는 provider getter도한번만읽고허용된상수코드로변환',async()=>{
 let reads=0;const transport={send:async()=>({status:'rejected',get reason(){return ++reads===1?'temporary':'FAKE-SECRET';}})};
 const r=await attemptAccountMail(job(),options(transport));assert.equal(r.code,'temporary');assert.equal(reads,1);assert.ok(!JSON.stringify(r).includes('FAKE-SECRET'));
});
test('전송직전 clock이NaN문자열예외면실패닫힘',async()=>{
 for(const next of [NaN,'1800000000000',()=>{throw Error('FAKE-SECRET');}]){
  let calls=0;const fake=fakeAccountMailTransport();
  const r=await attemptAccountMail(job(),{...options(fake.transport),now:()=>++calls===1?timestamp:typeof next==='function'?next():next});
  assert.equal(r.status,'blocked');assert.equal(r.code,'invalid_contract');assert.equal(fake.stats().calls,0);
 }
});
