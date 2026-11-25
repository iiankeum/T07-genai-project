import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRecovery, RECOVERY_TTL, consumedProposalHash} from '../public/js/knowledge-recovery.js';

function harness() {
  const m=new Map();
  const storage={get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
  let time=1000000;
  return {m,s:createRecovery(()=>storage,()=>time),tick:n=>{time+=n;}};
}
const access=(u='u_1',w='w_1')=>({user:{id:u},workspace:{id:w},demo:false});
const draft={id:null,kind:'부품',term:'가짜 용어',aliases:'A, B, ',standard:'',phone:'',note:'가짜 설명',evidenceNote:'가짜 출처',sourceCallId:'cl_fake',sourceSegIndex:0,relations:[{relation:'함께 사용',target:''}]};

test('동일한 범위만 재로그인 뒤 접근하고 부분 입력과 위치를 보존한다',()=>{
  const {s}=harness();assert.equal(s.save(access(),draft),true);assert.equal(s.read(null),null);
  assert.deepEqual(s.read(access()),draft);assert.deepEqual(s.read(access()),draft);
});
test('다른 사용자·작업공간은 초안을 공개하지 않고 삭제한다',()=>{
  for(const other of [access('u_2'),access('u_1','w_2')]){
    const {s,m}=harness();s.save(access(),draft);assert.equal(s.read(other),null);assert.equal(m.size,0);assert.equal(s.read(access()),null);
  }
});
test('기한 경계·미래 시각·깨진 JSON과 잘못된 타입은 삭제한다',()=>{
  for(const process of [
    h=>h.tick(RECOVERY_TTL),h=>h.tick(-1),h=>h.m.set([...h.m.keys()][0],'{'),
    h=>{const [k,v]=[...h.m][0];const x=JSON.parse(v);x.payload.note={};h.m.set(k,JSON.stringify(x));},
    h=>{const [k,v]=[...h.m][0];const x=JSON.parse(v);x.owner='x';h.m.set(k,JSON.stringify(x));},
  ]){const h=harness();h.s.save(access(),draft);process(h);assert.equal(h.s.read(access()),null);assert.equal(h.m.size,0);}
});
test('기한 직전 복구, 읽기는 만료 기한을 연장하지 않는다',()=>{
  const h=harness();h.s.save(access(),draft);h.tick(RECOVERY_TTL-1);assert.deepEqual(h.s.read(access()),draft);h.tick(1);assert.equal(h.s.read(null),null);assert.equal(h.m.size,0);
});
test('데모·미확인·머신 접근은 저장하지 않으며 기타 키는 보존한다',()=>{
  for(const a of [null,{}, {...access(),demo:true},{...access(),machine:true},access(''),access('user:a')]){
    const {s,m}=harness();m.set('unrelated','untouched');assert.equal(s.save(a,draft),false);assert.deepEqual([...m],[['unrelated','untouched']]);
  }
  const {s,m}=harness();m.set('unrelated','keep');s.save(access(),draft);s.read({...access(),demo:true});assert.deepEqual([...m],[['unrelated','keep']]);
});
test('녹음·인증 등 다른 속성은 저장하지 않으며 비정상 크기·형태를 거절한다',()=>{
  const {s,m}=harness();s.save(access(),{...draft,audio:'DROP1',password:'DROP2',relations:[{...draft.relations[0],token:'DROP3'}]});
  assert.doesNotMatch([...m.values()][0],/DROP/);
  for(const part of [{relations:new Array(11).fill({})},{term:'k'.repeat(81)},{kind:'not-kind'},{sourceCallId:'bad/id'},{term:'a\0b'}]){
    assert.equal(s.save(access(),{...draft,...part}),false);
  }
});
test('명시적 폐기·로그아웃은 다른 기능을 건드리지 않는다',()=>{
  const {s,m}=harness();m.set('unrelated','keep');s.save(access(),draft);s.discard(access('u_2'));assert.deepEqual(s.read(access()),draft);s.discard(access());assert.equal(s.read(access()),null);
  s.save(access(),draft);s.clear();assert.deepEqual([...m],[['unrelated','keep']]);
});
test('차단된 저장소는 예외가 밖으로 나가지 않는다',()=>{
  const s=createRecovery(()=>{throw Error('blocked');});
  assert.equal(s.save(access(),draft),false);assert.equal(s.read(access()),null);s.discard(access());s.clear();
});

test('성공 후 목록 401에서 로그인해도 동일한 AI 초안이 자동으로 다시 열리지 않는 경로를 만든다',()=>{
  assert.equal(consumedProposalHash('#/knowledge?call=cl_fake&seg=0&draft=1&tab=field'),'#/knowledge?tab=field');
  assert.equal(consumedProposalHash('#/glossary?call=cl_fake&draft=1'),'#/glossary');
  assert.equal(consumedProposalHash('#/calls/abc?seg=0'),'#/calls/abc?seg=0');
  assert.equal(consumedProposalHash('#/knowledge?id=keep'),'#/knowledge?id=keep');
});

test('거래처 담당자 입력도 동일 범위 세션 만료 복구에서 유지한다',()=>{
 const {s}=harness();const contact={...draft,kind:'거래처',contactName:'가짜담당자'};assert.equal(s.save(access(),contact),true);assert.deepEqual(s.read(access()),contact);s.discard(access());assert.equal(s.read(access()),null);
});
