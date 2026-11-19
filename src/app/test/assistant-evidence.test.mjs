import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceResult } from '../public/js/pages/assistant-evidence.js';
const citation = { callId:'fake-call', at:15.9, segIndex:4, quote:'아, 아니다. 세 개로 해주세요.' };
const base = { question:'수량 바꾼 대목 찾아줘', response:{found:true,citations:[citation]}, embedded:true, active:true, requestCallId:'fake-call', selectedCallId:'fake-call', viewCallId:'fake-call', workspaceUnchanged:true, routeUnchanged:true };
test('명시적 같은 통화 탐색만 고정 qty 콜백으로 변환한다', () => {
 assert.deepEqual(evidenceResult(base), {...citation,field:'qty'});
 assert.deepEqual(evidenceResult({...base,response:{...base.response,selector:'#evil',route:'https://evil.test',field:'price'}}),{...citation,field:'qty'});
 assert.ok(evidenceResult({...base,question:'이 통화의 수량 변경 근거를 찾아 줘.'}));
});
test('일반 질문·부정·중단·탐색/작업공간 변경·다른 통화는 이동하지 않는다', () => {
 for(const question of ['수량이 몇 개야?','수량 변경 근거를 찾아달라는 게 무슨 말이야?','이 주문에서 확인할 건?','수량 변경 근거를 찾아주지 마세요']) assert.equal(evidenceResult({...base,question}),null);
 for(const key of ['embedded','active','workspaceUnchanged','routeUnchanged']) assert.equal(evidenceResult({...base,[key]:false}),null);
 for(const key of ['requestCallId','selectedCallId','viewCallId']) assert.equal(evidenceResult({...base,[key]:'other'}),null);
});
test('지식·다른 통화·시간 없는 카드·모호한 복수 근거·잘못된 형식은 거부한다', () => {
 for(const change of [{kind:'knowledge'},{callId:'other'},{at:NaN},{at:-1},{at:'15.9'},{segIndex:-1},{segIndex:1.5},{quote:''}]) assert.equal(evidenceResult({...base,response:{found:true,citations:[{...citation,...change}]}}),null);
 assert.equal(evidenceResult({...base,response:{found:false,citations:[citation]}}),null);
 assert.equal(evidenceResult({...base,response:{found:true,citations:[citation,{...citation,segIndex:3}]}}),null);
 assert.deepEqual(evidenceResult({...base,response:{found:true,citations:[citation,citation]}}),{...citation,field:'qty'});
});
