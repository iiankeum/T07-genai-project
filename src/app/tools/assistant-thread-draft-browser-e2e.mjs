// Actual assistant module, controlled fake GET promises. No AI, accounts or product server.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const output=process.env.ASSISTANT_THREAD_OUTPUT||'/tmp/ahcha-assistant-thread';
const harness=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><main id="view"></main><script type="module">
import assistant from '/js/pages/assistant.js';import {api} from '/js/api.js';
window.pending=[];window.posts=[];window.contextGets=0;
api.get=(url,query,options)=>url==='/api/assistant'?(contextGets++,Promise.resolve({calls:[],selected:null,threads:[{id:'fake-a',title:'가짜 A'},{id:'fake-b',title:'가짜 B'}],approvedCount:0,actions:[]})):new Promise((resolve,reject)=>pending.push({url,resolve,reject,signal:options?.signal}));
api.del=(url,options)=>new Promise((resolve,reject)=>pending.push({url,resolve,reject,signal:options?.signal}));
api.post=(url,body)=>{posts.push({url,body});if(window.deferAsk)return new Promise(r=>window.finishAsk=()=>r({answer:'가짜 답변',thread:{id:'fake-a',title:'가짜 A',messages:[]}}));return Promise.resolve({answer:'가짜 답변',thread:{id:'fake-a',title:'가짜 A',messages:[]}});};
window.start=()=>{window.stop?.();document.querySelector('#view').innerHTML='';window.stop=assistant.mount(document.querySelector('#view'),{query:{},meta:{access:{demo:false}}});};start();window.ready=true;
</script></html>`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/')return res.setHeader('content-type','text/html').end(harness);if(!/^\/js\/[A-Za-z0-9_.\/-]+$/.test(u.pathname)||u.pathname.includes('..'))return res.writeHead(404).end();res.setHeader('content-type','text/javascript');res.end(await readFile(u.pathname==='/js/pages/assistant.js'&&process.env.ASSISTANT_MODULE_FILE?process.env.ASSISTANT_MODULE_FILE:path.join(root,u.pathname)));}catch{res.writeHead(404).end();}});
let browser;const errors=[],external=[],results=[];
try{
 await mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
 const input=()=>page.locator('#as-question'),select=()=>page.locator('[data-ref="threads"]');
 const fresh=async width=>{await page.goto('about:blank');await page.setViewportSize({width,height:900});await page.goto(origin,{waitUntil:'commit'});await page.waitForFunction(()=>window.ready&&document.querySelector('[data-ref="threads"] option[value="fake-a"]'));};
 const count=async n=>page.waitForFunction(n=>pending.length===n,n);
 const settle=async(i,fail=false)=>{await page.evaluate(({i,fail})=>{const p=pending[i];if(fail)p.reject(new Error('가짜 대화 조회 실패'));else p.resolve({thread:{id:p.url.split('/').pop(),title:'가짜 저장 대화',messages:[]}});},{i,fail});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
 if(process.env.ASSISTANT_THREAD_BEFORE){await fresh(1440);await select().selectOption('fake-a');await count(1);assert.equal(await input().isEditable(),true);await input().fill('전환 중 작성한 가짜 초안');const before=await input().inputValue();await settle(0);assert.equal(await input().inputValue(),'');const report={reproduced:true,scope:'actual assistant module + fake GET only',before,after:await input().inputValue(),posts:await page.evaluate(()=>posts.length),errors,external};await writeFile(path.join(output,'before.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
 else{
 for(const width of [1440,390]){
  for(const fail of [false,true]){
   await fresh(width);await input().fill('전환 전 가짜 초안');await select().selectOption('fake-a');await count(1);assert.equal(await input().isDisabled(),true);assert.match(await page.locator('[data-ref="thread-loading"]').innerText(),/대화를 불러오는 중/);assert.equal(await page.locator('[data-ref="form"]').getAttribute('aria-busy'),'true');assert.equal(await select().isDisabled(),true);
   await input().focus();await page.keyboard.type('손실될 새 입력');assert.equal(await input().inputValue(),'전환 전 가짜 초안');
   await select().evaluate(e=>{e.value='fake-b';e.dispatchEvent(new Event('change',{bubbles:true}));});await page.locator('[data-ref="form"]').evaluate(e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(await page.evaluate(()=>pending.length),1);assert.equal(await page.evaluate(()=>posts.length),0);
   await settle(0,fail);assert.equal(await input().isDisabled(),false);assert.equal(await input().inputValue(),fail?'전환 전 가짜 초안':'');assert.equal(await page.locator('[data-ref="thread-loading"]').isHidden(),true);assert.equal(await page.locator('[data-ref="form"]').getAttribute('aria-busy'),null);
   if(fail){assert.match(await page.locator('[data-ref="error"]').innerText(),/가짜 대화 조회 실패/);await select().selectOption('fake-a');await count(2);await settle(1);assert.equal(await input().isDisabled(),false);}
   await input().fill('복구 후 질문');await page.locator('[data-act="send"]').click();await page.waitForFunction(()=>posts.length===1);assert.equal(await page.evaluate(()=>posts[0].body.message),'복구 후 질문');results.push({width,flow:fail?'failure/restoration/retry':'success',typingLocked:true,duplicateAndSendBlocked:true,priorDraftPolicyPreserved:true,sendAfterRecovery:true});
  }
  for(const fail of [false,true]){
   await fresh(width);await select().selectOption('fake-a');await count(1);await settle(0);await input().fill('삭제 전 가짜 초안');page.once('dialog',d=>d.accept());await page.locator('[data-act="delete"]').click();await count(2);assert.equal(await input().isDisabled(),true);assert.match(await page.locator('[data-ref="thread-loading"]').innerText(),/삭제하는 중/);await input().focus();await page.keyboard.type('삭제 중 새 입력');assert.equal(await input().inputValue(),'삭제 전 가짜 초안');await settle(1,fail);assert.equal(await input().isDisabled(),false);assert.equal(await input().inputValue(),fail?'삭제 전 가짜 초안':'');assert.equal(await page.locator('[data-ref="thread-loading"]').isHidden(),true);results.push({width,flow:fail?'delete failure restores draft':'delete success locks then retains existing clear policy'});
  }
  await fresh(width);await select().selectOption('fake-a');await count(1);await settle(0);await input().fill('삭제하지 않을 초안');page.once('dialog',d=>d.dismiss());await page.locator('[data-act="delete"]').click();assert.equal(await page.evaluate(()=>pending.length),1);assert.equal(await input().isDisabled(),false);assert.equal(await input().inputValue(),'삭제하지 않을 초안');results.push({width,flow:'dismiss deletion preserves draft without locking or request'});
  await fresh(width);await page.evaluate(()=>window.deferAsk=true);await input().fill('가짜 첫 질문');await page.locator('[data-act="send"]').click();await page.waitForFunction(()=>window.finishAsk);assert.equal(await input().isEditable(),true);await input().fill('응답 중 작성한 다음 질문');await page.evaluate(()=>finishAsk());await page.waitForFunction(()=>document.querySelector('[data-act="stop"]').hidden);assert.equal(await input().inputValue(),'응답 중 작성한 다음 질문');results.push({width,flow:'AI response pending still permits and preserves next draft'});
  await fresh(width);await input().evaluate(e=>{e.disabled=true;e.setAttribute('aria-describedby','original-help');});await select().selectOption('fake-a');await count(1);await settle(0,true);assert.equal(await input().isDisabled(),true);assert.equal(await input().getAttribute('aria-describedby'),'original-help');results.push({width,flow:'original disabled/describedby preserved'});
  await fresh(width);await select().selectOption('fake-a');await count(1);await settle(0);await select().selectOption('fake-b');await count(2);await settle(1);await select().selectOption('fake-a');await count(3);await settle(2);assert.equal(await select().inputValue(),'fake-a');assert.equal(await input().isDisabled(),false);results.push({width,flow:'sequential A-B-A transitions remain usable'});
  await fresh(width);await select().selectOption('fake-a');await count(1);await page.evaluate(()=>{stop();document.querySelector('#view').innerHTML='<button id="sentinel">가짜 다른 화면</button>';document.querySelector('#sentinel').focus();});await settle(0);assert.equal(await page.locator('#view').innerText(),'가짜 다른 화면');assert.equal(await page.evaluate(()=>document.activeElement.id),'sentinel');results.push({width,flow:'unmount late success preserves new screen and focus'});
  await fresh(width);await select().selectOption('fake-a');await count(1);await page.evaluate(()=>start());await page.waitForFunction(()=>document.querySelector('[data-ref="threads"] option[value="fake-b"]'));await select().selectOption('fake-b');await count(2);await settle(0,true);assert.equal(await input().isDisabled(),true);assert.doesNotMatch(await page.locator('#view').innerText(),/가짜 대화 조회 실패/);await settle(1);assert.equal(await select().inputValue(),'fake-b');assert.equal(await input().isDisabled(),false);results.push({width,flow:'old mount failure cannot unlock or overwrite new mount transition'});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);const report={status:'passed',scope:'actual assistant module + fake GET/POST; no AI, real server persistence or account test',results,errors,external};await writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
