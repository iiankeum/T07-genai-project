// 가짜 통화 응답만 사용한다. 실제 녹음 접근, 네트워크 요청은 하지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {canRetryListCall, createListRetries, listRetryMarkup, hashFor, stateFromQuery} from '../public/js/pages/calls.js';
const call = {id:'fixture-call',status:'failed',hasAudio:true,error:'가짜 실패'};
test('부적격 또는 읽기 전용 행에는 복구 버튼·요청이 없다',async()=>{
 for(const [row,role] of [[call,'viewer'],[call,'shipping'],[call,undefined],[{...call,hasAudio:false},'admin'],[{...call,status:'queued'},'admin'],[{...call,transcript:'가짜 기존 기록'},'reception']]){
   assert.equal(canRetryListCall(row,role),false);
   assert.doesNotMatch(String(listRetryMarkup(row,role)),/data-act="retry-audio"/);
   assert.equal(await createListRetries(role,()=>assert.fail('전송 금지')).submit(row),null);
 }
 assert.match(String(listRetryMarkup({...call,hasAudio:false},'admin')),/저장된 녹음이 없어/);
});
test('실패 사유는 이스케이프, 실패한 녹음은 허용된 두 역할에서만 보인다',()=>{
 for(const role of ['admin','reception']){
   assert.ok(canRetryListCall(call,role));const html=String(listRetryMarkup({...call,error:'<b>가짜</b>'},role));
   assert.match(html,/&lt;b&gt;/);assert.doesNotMatch(html,/<b>가짜/);assert.match(html,/aria-disabled="false"/);
 }
});
test('연속 클릭은 통화당 한 요청만, 다른 통화는 독립, 접수 후 결과 확인 전 재전송 안 함',async()=>{
 const sent=[],resolvers=[]; const model=createListRetries('reception',p=>{sent.push(p); return new Promise(resolve=>resolvers.push(resolve));});
 const a=model.submit(call), b=model.submit({...call,id:'fake/b'});assert.equal(await model.submit(call),null);
 assert.deepEqual(sent,['/api/calls/fixture-call/retry-transcription','/api/calls/fake%2Fb/retry-transcription']);
 assert.equal(model.get(call.id).phase,'pending');assert.match(String(listRetryMarkup(call,'reception',model.get(call.id))),/재요청 중/);
 resolvers[0]({callId:call.id,requeued:true});resolvers[1]({callId:'fake/b',alreadyPending:true});
 assert.equal((await a).phase,'accepted');assert.match((await b).message,/이미/);assert.equal(model.receipts().length,2);
 assert.equal(await model.submit(call),null);model.forget(call.id);assert.equal(model.get(call.id),undefined);
});
test('서버가 없는 음원 또는 비대상으로 거절한 행은 실패 사유와 함께 잠근다',async()=>{
 for(const code of ['not_retryable','no_audio','permission_denied','not_found']){
   let count=0;const model=createListRetries('admin',()=>{count++;throw Object.assign(Error('가짜 거절 이유'),{code});});
   const result=await model.submit(call);assert.equal(result.phase,'blocked');assert.match(String(listRetryMarkup(call,'admin',result)),/가짜 거절 이유/);
   assert.equal(await model.submit(call),null);assert.equal(count,1);
 }
});
test('통신 실패·잘못된 영수증은 성공이 아니며 다시 시도할 수 있다',async()=>{
 let n=0;const model=createListRetries('admin',()=>{if(++n===1)throw Error('연결 실패');if(n===2)return{callId:'other',requeued:true};return {callId:call.id,requeued:true};});
 assert.equal((await model.submit(call)).phase,'error');assert.equal((await model.submit(call)).phase,'error');assert.equal((await model.submit(call)).phase,'accepted');
});
test('상태 필터, 검색어, 날짜·재연락 필터 주소는 재시도 결과와 독립',async()=>{
 const state=stateFromQuery({status:'failed',q:'가짜',range:'week',callback:'true'});const url=hashFor(state);
 const model=createListRetries('admin',()=>({callId:call.id,alreadyPending:true}));await model.submit(call);
 assert.equal(hashFor(state),url);assert.match(url,/status=failed/);assert.match(url,/callback=true/);
});
