// 가짜 발화. 마이크·모델·통신·파일 재생을 하지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceQuote, activateQuote } from '../public/js/pages/call-quote.js';
import { resolveEvidence } from '../public/js/pages/call-util.js';
const segments=[{text:'가짜 첫 문장',start:0},{text:'가짜 패드 둘',start:4}];
function perform(r, audio, valid=true) {
 const events=[];
 const target=which=>({focus:opt=>events.push(['focus',which,opt.preventScroll])});
 activateQuote(r,{hasAudio:audio,lineFor:i=>valid?target(i):null,transcript:target('transcript'),
   mark:i=>events.push(['mark',i]),scroll:i=>events.push(['scroll',i]),seek:t=>events.push(['play',t])});
 return events;
}
test('인용 전체가 한 개의 버튼이고, 시각·문구·동작 이름이 들어간다',()=>{
 const html=String(evidenceQuote(resolveEvidence(segments,{seg:1}),true));
 assert.match(html,/<button[^>]+data-act="to-trans"[\s\S]*?<q[^>]*>가짜 패드 둘<\/q>[\s\S]*?0:04[\s\S]*?이 대목 듣기[\s\S]*?<\/button>/);
 assert.equal(html.match(/<button/g).length,1);
 assert.equal(evidenceQuote(null,true),'');
});
test('현재 항목이 가리키는 실제 근거를 강조·포커스하고 4초를 한 번만 전달한다',()=>{
 const r=resolveEvidence(segments,{seg:1});
 assert.deepEqual(perform(r,true),[['mark',1],['focus',1,true],['scroll',1],['play',4]]);
});
test('녹음이 없으면 같은 발화로 이동만 하고 듣기를 약속하지 않는다',()=>{
 const r=resolveEvidence(segments,{quote:'가짜 패드 둘'});
 assert.match(String(evidenceQuote(r,false)),/대화에서 보기/);assert.doesNotMatch(String(evidenceQuote(r,false)),/듣기/);
 assert.deepEqual(perform(r,false),[['mark',1],['focus',1,true],['scroll',1]]);
});
test('0초도 유효한 시각이며 누락된 시각을 0초로 바꾸지 않는다',()=>{
 assert.deepEqual(perform(resolveEvidence(segments,{seg:0}),true).at(-1),['play',0]);
 for(const t of [null,undefined,-1,'4',NaN,Infinity]){
    const r={segIndex:1,at:t,quote:'가짜 문장'};assert.doesNotMatch(String(evidenceQuote(r,true)),/듣기/);assert.equal(perform(r,true).some(([a])=>a==='play'),false);
 }
});
test('사라진 문장은 대화 영역으로 돌아가며 다른 발화를 가리키지 않는다',()=>{
 assert.deepEqual(perform({segIndex:20,at:null},true,false),[['mark',-1],['focus','transcript',true],['scroll',-1]]);
 const html=String(evidenceQuote({quote:'<b>가짜</b>',segIndex:-1,at:null},true));
 assert.match(html,/전체 대화 보기/);assert.match(html,/&lt;b&gt;가짜/);assert.doesNotMatch(html,/<b>가짜/);
});
