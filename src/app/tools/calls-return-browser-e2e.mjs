// 가짜 65건. 실제 calls/call 모듈 + 격리된 mock API, 외부 호출·실계정 없음.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=process.env.CALLS_RETURN_PUBLIC||fileURLToPath(new URL('../public/',import.meta.url));
const output=process.env.CALLS_RETURN_OUTPUT||'/tmp/ahcha-calls-return';
const baseline=process.env.CALLS_RETURN_BASELINE==='1';
const harness=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/pages/calls.css"><link rel="stylesheet" href="/css/pages/call.css"><header class="topbar"></header><main id="view"></main><script type="module">
import calls from '/js/pages/calls.js';import call from '/js/pages/call.js';import {getMeta} from '/js/api.js';
window.access={demo:false,role:'admin',user:{id:'fake-a'},workspace:{id:'fake-space'}};let cleanup;
window.mount=async()=>{cleanup?.();window.scrollTo(0,0);const el=document.createElement('div');document.querySelector('#view').replaceChildren(el);const [p,q]=location.hash.slice(1).split('?');const ctx={query:Object.fromEntries(new URLSearchParams(q)),params:{id:p.split('/')[2]},meta:{access:window.access},refreshMeta:async()=>({access:window.access})};cleanup=await (ctx.params.id?call:calls).mount(el,ctx);window.ready=(window.ready||0)+1;};await getMeta();addEventListener('hashchange',window.mount);await window.mount();</script>`;
const fixtures=Array.from({length:65},(_,i)=>({id:`fake-${i+1}`,title:`가짜 통화 ${i+1}`,customer:`가짜 거래처 ${i+1}`,recordedAt:'2026-11-18T09:00:00Z',status:'ready',hasAudio:false,summary:'가짜 검색 부품',segments:[],card:null}));
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname;if(p==='/'){res.setHeader('content-type','text/html');return res.end(harness);}if(!/^\/(js|css|fonts|montage)\/[\w./-]+$/.test(p)||p.includes('..'))return res.writeHead(404).end();res.setHeader('content-type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'font/woff2');res.end(await readFile(path.join(root,p)));}catch{res.writeHead(404).end();}});
let browser,holdAppend=false,heldAppend=null;const errors=[],blocked=[],requests=[],results=[];
try{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({headless:true});const context=await browser.newContext({reducedMotion:'reduce'});await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==origin){blocked.push(u.origin);return route.abort();}if(!u.pathname.startsWith('/api/'))return route.continue();const reply=x=>route.fulfill({contentType:'application/json',body:JSON.stringify(x)});if(u.pathname==='/api/meta')return reply({access:{demo:false,role:'admin',user:{id:'fake-a'},workspace:{id:'fake-space'}}});if(u.pathname==='/api/customers')return reply({customers:[]});if(u.pathname==='/api/calls'){requests.push(Object.fromEntries(u.searchParams));const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||30);const data={calls:fixtures.slice(offset,offset+limit),total:fixtures.length};if(holdAppend&&offset===30){holdAppend=false;heldAppend=()=>reply(data);return;}return reply(data);}if(u.pathname.startsWith('/api/calls/'))return reply(fixtures.find(c=>c.id===u.pathname.split('/').at(-1)));errors.push(u.pathname);return reply({});});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);await mkdir(output,{recursive:true});
for(const width of [1440,390]){await page.goto('about:blank');await page.setViewportSize({width,height:900});await page.goto(origin+'/#/calls?q=부품&status=draft');await page.locator('.cl-item').nth(29).waitFor();await page.locator('[data-act=more]').click();await page.locator('.cl-item').nth(59).waitFor();await page.locator('.cl-title[href="#/calls/fake-45"]').click();await page.locator('.cd-back').click();await page.locator('.cl-item').nth(29).waitFor();if(!baseline)await page.locator('.cl-title[href="#/calls/fake-45"]').waitFor();const count=await page.locator('.cl-item').count();assert.equal(count,baseline?30:60,JSON.stringify(requests));assert.ok(decodeURIComponent(await page.evaluate(()=>location.hash)).includes('q=부품'));if(!baseline){assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#/calls/fake-45');assert.ok(await page.locator('.cl-title[href="#/calls/fake-45"]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));}results.push({width,count,baseline});await page.screenshot({path:path.join(output,`${baseline?'before':'after'}-${width}.png`)});}
if(!baseline){for(const boundary of ['user','workspace','expired']){await page.locator('.cl-title[href="#/calls/fake-45"]').click();await page.locator('.cd-back').waitFor();await page.evaluate(boundary=>{if(boundary==='user')window.access.user.id='fake-b';if(boundary==='workspace')window.access.workspace.id='fake-other';if(boundary==='expired')window.dispatchEvent(new CustomEvent('ahmatda:session-expired'));},boundary);await page.locator('.cd-back').click();await page.locator('.cl-item').nth(29).waitFor();assert.equal(await page.locator('.cl-item').count(),30);results.push({boundary,noRestore:true});await page.evaluate(()=>{window.access={demo:false,role:'admin',user:{id:'fake-a'},workspace:{id:'fake-space'}};});await page.locator('[data-act=more]').click();await page.locator('.cl-item').nth(59).waitFor();}}
if(!baseline){
 // Browser Back must preserve the full third page as well as the explicit return link.
 await page.locator('[data-act=more]').click();await page.locator('.cl-item').nth(64).waitFor();
 await page.locator('.cl-title[href="#/calls/fake-65"]').click();await page.locator('.cd-back').waitFor();await page.goBack();
 await page.locator('.cl-title[href="#/calls/fake-65"]').waitFor();assert.equal(await page.locator('.cl-item').count(),65);
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#/calls/fake-65');results.push({browserBack:true,thirdPage:65});
 // A different filter is a new list, not a reason to refill the previous list.
 await page.locator('.cl-title[href="#/calls/fake-45"]').click();await page.locator('.cd-back').waitFor();
 await page.evaluate(()=>{location.hash='/calls?status=confirmed';});await page.locator('.cl-item').nth(29).waitFor();
 assert.equal(await page.locator('.cl-item').count(),30);assert.equal(await page.locator('#cl-q').inputValue(),'');results.push({filterChanged:true,noRestore:true});
 // The return row can disappear after another operator removes it. Do not focus a different row.
 await page.locator('[data-act=more]').click();await page.locator('.cl-item').nth(59).waitFor();await page.locator('.cl-title[href="#/calls/fake-45"]').click();await page.locator('.cd-back').waitFor();
 fixtures.splice(fixtures.findIndex(c=>c.id==='fake-45'),1);await page.locator('.cd-back').click();await page.waitForFunction(()=>document.activeElement?.id==='cl-q');
 assert.equal(await page.locator('.cl-title[href="#/calls/fake-45"]').count(),0);assert.equal(await page.locator('.cl-item').count(),60);results.push({deletedTarget:true,searchFocusFallback:true});
}
if(!baseline){
 // Leave during a delayed second-page restoration. The detached list must not fetch page 3 or steal focus.
 await page.goto('about:blank');await page.goto(origin+'/#/calls?q=부품');await page.locator('.cl-item').nth(29).waitFor();
 await page.locator('[data-act=more]').click();await page.locator('.cl-item').nth(59).waitFor();await page.locator('[data-act=more]').click();await page.locator('.cl-item').nth(63).waitFor();
 await page.locator('.cl-title[href="#/calls/fake-60"]').click();await page.locator('.cd-back').waitFor();holdAppend=true;await page.locator('.cd-back').click();
 for(let i=0;i<100&&!heldAppend;i++)await page.waitForTimeout(10);assert.ok(heldAppend);
 const start=requests.length;await page.evaluate(()=>{location.hash='/calls/fake-2';});await page.locator('.cd-back').waitFor();await page.locator('.cd-back').focus();
 await heldAppend();await page.waitForTimeout(200);assert.equal(await page.locator('.cd-page').count(),1);assert.equal(await page.locator('.cd-back').evaluate(e=>document.activeElement===e),true);
 assert.equal(requests.slice(start).filter(r=>r.offset==='60').length,0);results.push({leaveDuringRestore:true,noThirdPageRequest:true,noFocusSteal:true});
}
if(!baseline){for(const intent of ['tab','wheel','pageDown']){
 await page.goto('about:blank');await page.goto(origin+'/#/calls?q=부품');await page.locator('.cl-item').nth(29).waitFor();
 await page.locator('[data-act=more]').click();await page.locator('.cl-item').nth(59).waitFor();
 await page.locator('.cl-title[href="#/calls/fake-60"]').click();await page.locator('.cd-back').waitFor();heldAppend=null;holdAppend=true;await page.locator('.cd-back').click();
 for(let i=0;i<100&&!heldAppend;i++)await page.waitForTimeout(10);assert.ok(heldAppend);
 if(intent==='tab'){await page.locator('#cl-q').focus();await page.keyboard.press('Tab');await page.evaluate(()=>{window.savedFocus=document.activeElement;});}
 else if(intent==='pageDown'){await page.locator('[data-act=clear-q]').focus();await page.evaluate(()=>{window.savedFocus=document.activeElement;});await page.keyboard.press('PageDown');await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>scrollY>0),'PageDown actually scrolls');}
 else{await page.mouse.wheel(0,400);await page.waitForTimeout(100);}
 const y=await page.evaluate(()=>scrollY);await heldAppend();await page.waitForTimeout(100);
 if(intent==='tab'||intent==='pageDown')assert.equal(await page.evaluate(()=>document.activeElement===window.savedFocus),true);
 assert.ok(Math.abs((await page.evaluate(()=>scrollY))-y)<3,'late restoration must not scroll after user navigation');
 results.push({intent,delayedResponseNoFocusOrScrollSteal:true});
}}
assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);await writeFile(path.join(output,'results.json'),JSON.stringify({results,requests,errors,blocked},null,2));console.log(JSON.stringify({results,errors,blocked}));}finally{await browser?.close();await new Promise(r=>server.close(r));}
