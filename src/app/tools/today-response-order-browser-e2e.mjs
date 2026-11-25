// Actual today module; deferred synthetic API only. No accounts, real AI, or clipboard.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const output=process.env.TODAY_ORDER_OUTPUT||'/tmp/ahcha-today-order-results';
const harness=`<!doctype html><meta charset="utf-8"><main id="view"></main><script type="module">
import today from '/js/pages/today.js';import {api} from '/js/api.js';import {kstDay} from '/js/ui.js';
window.pending=[];window.posts=[];window.summaryReads=0;window.tick=()=>{};
window.setInterval=(fn)=>{window.tick=fn;return 1};window.clearInterval=()=>{};
api.get=(url,query)=>url==='/api/dashboard'?new Promise((resolve,reject)=>pending.push({query,resolve,reject})):(summaryReads++,Promise.resolve({text:'가짜 마감 요약'}));
api.post=(url,body)=>new Promise((resolve,reject)=>posts.push({url,body,resolve,reject}));
window.start=async(auto=false)=>{window.stop?.();pending=[];posts=[];summaryReads=0;document.querySelector('#view').innerHTML='';window.stop=await today.mount(document.querySelector('#view'),{query:auto?{}:{day:kstDay()},meta:{aiEnabled:true,aiProvider:'fixture'},refreshMeta:async()=>({aiEnabled:true,aiProvider:'fixture'})});};await start();window.ready=true;
</script>`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/')return res.setHeader('content-type','text/html; charset=utf-8').end(harness);if(!/^\/js\/[A-Za-z0-9_.\/-]+$/.test(u.pathname)||u.pathname.includes('..'))return res.writeHead(404).end();res.setHeader('content-type','text/javascript; charset=utf-8');res.end(await readFile(path.join(root,u.pathname)));}catch{res.writeHead(404).end();}});
let browser;const results=[],errors=[],external=[];
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
 await page.goto(origin,{waitUntil:'commit'});await page.waitForFunction(()=>window.ready);
 const flush=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const count=n=>page.waitForFunction(n=>pending.length===n,n);
 const settle=async(i,calls,fail=false)=>{await page.evaluate(({i,calls,fail})=>{const p=pending[i];if(fail)p.reject(new Error('가짜 최신 조회 실패'));else p.resolve({day:p.query.day,stats:{calls,draft:calls},todos:[],recent:[]});},{i,calls,fail});await flush();};
 const text=()=>page.locator('#view').innerText();const metric=()=>page.locator('[data-focus="stat-calls"]').innerText();
 const fresh=async(auto=false)=>{await page.evaluate(auto=>start(auto),auto);await count(1);};
 const aba=async()=>{await page.locator('[data-focus="day-어제"]').click();await page.locator('[data-focus="day-오늘"]').click();await count(3);};
 await aba();await settle(2,9);await settle(0,1);assert.match(await metric(),/9건/);assert.equal(await page.evaluate(()=>summaryReads),1);results.push('today-yesterday-today ABA retains newest dashboard; stale load does not start summary GET');
 await fresh();await aba();await settle(2,0,true);await settle(0,1);assert.match(await text(),/가짜 최신 조회 실패/);assert.equal(await page.locator('[data-focus="stat-calls"]').count(),0);results.push('latest failure cannot be replaced by earlier same-day success');
 for(const fail of [false,true]){await fresh();await aba();await settle(0,1,fail);assert.match(await text(),/현황을 불러오는 중/);await settle(2,7);assert.match(await metric(),/7건/);results.push('stale '+(fail?'failure':'success')+' keeps latest loading intact');}
 await fresh(true);await settle(0,0);await count(2);assert.notEqual(...await page.evaluate(()=>pending.map(p=>p.query.day)));await settle(1,4);assert.match(await metric(),/4건/);assert.match(await text(),/어제 기록/);results.push('initial zero-call fallback still loads yesterday');
 await page.evaluate(()=>tick());await count(3);await settle(2,5);await count(4);await settle(3,2);await count(5);await settle(4,2);assert.match(await metric(),/2건/);assert.doesNotMatch(await text(),/지금은 어제 기록/);results.push('quiet fallback probe returns to today when calls arrive');
 await fresh(true);await settle(0,0);await settle(1,4);await page.evaluate(()=>tick());await count(3);await settle(2,5);await count(4);await page.locator('[data-focus="day-오늘"]').click();await page.locator('[data-focus="day-어제"]').click();await count(6);await settle(5,8);await settle(3,2);assert.match(await metric(),/8건/);assert.equal(await page.evaluate(()=>pending.length),6);results.push('stale quiet fallback probe cannot change date after manual ABA');
 await fresh();await settle(0,3);await page.evaluate(()=>tick());await count(2);await settle(1,0,true);assert.match(await text(),/새로 고치지 못했습니다/);assert.match(await metric(),/3건/);await page.evaluate(()=>tick());await count(3);await settle(2,6);assert.match(await metric(),/6건/);assert.doesNotMatch(await text(),/새로 고치지 못했습니다/);results.push('quiet refresh failure retains data and later refresh recovers');
 await fresh();await settle(0,3);assert.equal(await page.evaluate(()=>posts.length),0);await page.locator('[data-act="brief"]').click();await page.evaluate(()=>tick());await count(2);await settle(1,4);await page.evaluate(()=>posts[0].resolve({paragraph:'가짜 명시 요청 브리핑',mode:'fixture'}));await flush();assert.match(await text(),/가짜 명시 요청 브리핑/);assert.doesNotMatch(await text(),/통화를 요약하는 중/);assert.equal(await page.evaluate(()=>posts.length),1);results.push('explicit fake AI briefing completes across same-day refresh without stuck loading');
 await fresh();await page.evaluate(()=>{stop();document.querySelector('#view').innerHTML='<button id="sentinel">가짜 다른 화면</button>';document.querySelector('#sentinel').focus();});await settle(0,1);assert.equal(await text(),'가짜 다른 화면');assert.equal(await page.evaluate(()=>document.activeElement.id),'sentinel');results.push('unmounted response cannot repaint or take focus');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await mkdir(output,{recursive:true});const report={status:'passed',scope:'actual module with synthetic deferred API, no product server/auth/AI/visual-layout verification',results,errors,external};await writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
