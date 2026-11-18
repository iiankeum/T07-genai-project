// 가짜 API promises + actual shipping module. No product server, accounts or AI.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const output=process.env.SHIPPING_ORDER_OUTPUT||'/tmp/ahcha-shipping-order-results';
const harness=`<!doctype html><meta charset="utf-8"><main id="view"></main><script type="module">
import shipping from '/js/pages/shipping.js';import {api} from '/js/api.js';
window.pending=[];window.posts=[];api.get=(url,query)=>new Promise((resolve,reject)=>pending.push({url,query,resolve,reject}));api.post=(url,body)=>{posts.push({url,body});return Promise.reject(Object.assign(new Error('fake conflict'),{status:409,code:'card_conflict'}));};
window.start=async()=>{window.stop?.();document.querySelector('#view').innerHTML='';window.stop=await shipping.mount(document.querySelector('#view'),{query:{}});};await start();window.ready=true;
</script>`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/')return res.setHeader('content-type','text/html').end(harness);if(!/^\/(js|css)\/[A-Za-z0-9_.\/-]+$/.test(u.pathname)||u.pathname.includes('..'))return res.writeHead(404).end();res.setHeader('content-type',u.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile(path.join(root,u.pathname)));}catch{res.writeHead(404).end();}});
let browser;const errors=[],external=[],results=[];
try{
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
await page.goto(origin,{waitUntil:'commit'});await page.waitForFunction(()=>window.ready);
const count=async n=>page.waitForFunction(n=>pending.length===n,n);
const settle=async(i,label,{fail=false,revision=1}={})=>{await page.evaluate(({i,label,fail,revision})=>{if(fail)pending[i].reject(new Error(label));else pending[i].resolve({groups:[{customer:label,cards:[{callId:'fake-order',status:'confirmed',revision,title:'가짜 주문',items:[{part:'가짜 부품',qty:1,partNo:'FAKE-MANUAL'}]}]}]});},{i,label,fail,revision});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const reload=()=>page.locator('[data-act="reload"]').click();const text=()=>page.locator('#view').innerText();
const fresh=async()=>{await page.evaluate(()=>{pending=[];posts=[];return start();});await count(1);await settle(0,'가짜 초기');};
await count(1);await settle(0,'가짜 초기');await reload();await reload();await count(3);await settle(2,'가짜 최신');await settle(1,'가짜 오래됨');
if(process.env.SHIPPING_ORDER_BEFORE){assert.match(await text(),/가짜 오래됨/);await mkdir(output,{recursive:true});await writeFile(path.join(output,'before.json'),JSON.stringify({reproduced:true,scope:'same-scope older response overwrites newer actual-module view'}));console.log('BEFORE reproduced');}else{
assert.match(await text(),/가짜 최신/);assert.doesNotMatch(await text(),/가짜 오래됨/);results.push('same-scope latest success wins');
await fresh();await reload();await reload();await count(3);await settle(2,'가짜 최신');await settle(1,'가짜 오래된 실패',{fail:true});assert.doesNotMatch(await text(),/가짜 오래된 실패/);assert.match(await text(),/가짜 최신/);results.push('older failure cannot replace latest success/error/loading');
for(const fail of [false,true]){await fresh();await reload();await reload();await count(3);await settle(1,'가짜 먼저 끝난 구조회',{fail});assert.match(await text(),/새로 고치는 중/);assert.doesNotMatch(await text(),/가짜 먼저 끝난 구조회/);await settle(2,'가짜 마지막 실패',{fail:true});assert.match(await text(),/가짜 마지막 실패/);assert.doesNotMatch(await text(),/새로 고치는 중/);results.push('superseded '+(fail?'failure':'success')+' does not clear current loading; latest failure remains visible');}
await fresh();await reload();await page.locator('[data-scope="today"]').click();await page.locator('[data-scope="all"]').click();await count(4);await settle(3,'가짜 ABA 최신');await settle(2,'가짜 다른 범위');await settle(1,'가짜 ABA 과거');assert.match(await text(),/가짜 ABA 최신/);assert.doesNotMatch(await text(),/가짜 ABA 과거|가짜 다른 범위/);results.push('all-today-all ABA responses cannot overwrite current generation');
for(const latestFails of [false,true]){
 await fresh();await reload();await count(2);await settle(1,'가짜 revision 없음',{revision:null});await page.locator('[data-act="ship"]').first().click();await count(3);await reload();await count(4);
 await settle(3,latestFails?'가짜 최신 실패':'가짜 최신 복구',{fail:latestFails});if(latestFails){assert.match(await page.locator('[data-ref="shipping-review-notice"]').innerText(),/보류/);assert.doesNotMatch(await page.locator('[data-ref="shipping-review-notice"]').innerText(),/확인하는 중/);}await page.locator('[data-act="reload"]').focus();const before=await text();await settle(2,'가짜 오래된 검토응답');assert.equal(await text(),before);assert.equal(await page.evaluate(()=>document.activeElement?.dataset.act),'reload');assert.equal(await page.locator('[data-act="ship"]').first().isDisabled(),latestFails);assert.equal(await page.evaluate(()=>posts.length),0);results.push('superseded review continuation cannot alter latest '+(latestFails?'failure/block':'success/unblock'));
}
await fresh();await reload();await count(2);await page.evaluate(()=>{stop();document.querySelector('#view').innerHTML='<button id="sentinel">가짜 다른 화면</button>';document.querySelector('#sentinel').focus();});await settle(1,'가짜 언마운트 응답');assert.equal(await text(),'가짜 다른 화면');assert.equal(await page.evaluate(()=>document.activeElement?.id),'sentinel');results.push('unmounted response does not redraw');
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await mkdir(output,{recursive:true});const report={status:'passed',scope:'actual shipping module with controlled fake API promises, not real server/authorization/user test',results,errors,external};await writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
}finally{await browser?.close();await new Promise(r=>server.close(r));}
