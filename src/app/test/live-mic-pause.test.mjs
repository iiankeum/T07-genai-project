// 가짜 DOM/SpeechRecognition으로 실제 live.js의 상태 흐름을 검증한다. 실제 마이크/API 없음.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/js/pages/live.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace('export default {','globalThis.live = {');
async function fixture() {
 const nodes=new Map(),instances=[],posts=[];let now=0;
 const node=(key)=>{if(nodes.has(key))return nodes.get(key);const classes=new Set();const n={textContent:'',className:'',disabled:false,dataset:{act:key.match(/data-act="(.*?)"/)?.[1]},classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)||n.className.split(' ').includes(k),remove:k=>classes.delete(k),add:k=>classes.add(k)},setAttribute(){},querySelector:node,querySelectorAll:()=>[],contains:()=>true,closest(){return this;},focus(){},scrollIntoView(){},addEventListener(_,f){this.click=f;},removeEventListener(){this.click=null;},scrollHeight:0,scrollTop:0,clientHeight:0};nodes.set(key,n);return n;};
 const root=node('.live-page');
 class SR {constructor(){instances.push(this);this.stops=0;this.aborts=0;}start(){this.onstart?.();}stop(){this.stops++;}abort(){this.aborts++;}result(text,final=true){const r=[{transcript:text}];r.isFinal=final;this.onresult?.({resultIndex:0,results:[r]});}end(){this.onend?.();}}
 const context={window:{SpeechRecognition:SR,isSecureContext:true,matchMedia:()=>({matches:true})},performance:{now:()=>now},setTimeout,clearTimeout,AbortController,console,api:{post:async(url,body)=>{posts.push({url,body});return {callId:'fake'};}},html:(ss,...v)=>ss.reduce((a,s,i)=>a+s+(v[i]??''),''),render:(n,s)=>{n.rendered=s;},fmtSec:String,toast(){},confirmBox:async()=>true,href:String,highlight:String,SAMPLE:[],EXAMPLES:[],buildMarks:()=>[],resolveEvidence:()=>null};
 vm.runInNewContext(source,context);const dispose=await context.live.mount({querySelector:()=>root},{meta:{aiEnabled:false}});
 const click=(act)=>root.click({target:node(`[data-act="${act}"]`)});
 return {nodes,node,instances,posts,click,dispose,time:n=>{now=n;}};
}
test('일시정지 후 재개는 글/분절 보존, 정지 시간 제외, 낡은 콜백 무시, 직접 저장',async()=>{
 const f=await fixture();f.click('mic');f.time(1000);f.instances[0].result('가짜 하나',false);f.click('pause');
 assert.equal(f.instances[0].stops,1);assert.equal(f.node('[data-act="pause"]').disabled,true);
 f.instances[0].result('가짜 하나');f.instances[0].end();assert.equal(f.node('[data-act="pause"]').disabled,false);
 f.time(61000);f.click('pause');assert.equal(f.instances.length,2);f.instances[0].result('오래된 글');f.instances[0].end();f.time(62000);f.instances[1].result('가짜 둘');f.click('pause');f.instances[1].end();
 f.click('save');await new Promise(r=>setTimeout(r,2100));
 assert.equal(f.posts.length,1);assert.equal(f.posts[0].body.text,'가짜 하나\n가짜 둘');
 assert.equal(f.posts[0].body.segments.length,2);assert.equal(f.posts[0].body.durationSec,2.5);f.dispose();
});
test('권한 거절은 재시작하지 않음; 경로 정리 뒤 결과 무시',async()=>{
 const f=await fixture();f.click('mic');f.instances[0].onerror({error:'not-allowed'});f.instances[0].end();
 assert.match(f.node('[data-ref="state"]').textContent,/마이크 사용이 막혀/);
 await new Promise(r=>setTimeout(r,350));assert.equal(f.instances.length,1);
 f.click('mic');f.click('pause');f.dispose();f.instances[1].result('폐기 후 글');f.instances[1].end();
 assert.equal(f.instances[1].aborts,1);assert.equal(f.node('[data-ref="lineCount"]').textContent,'0줄');assert.equal(f.posts.length,0);
});
