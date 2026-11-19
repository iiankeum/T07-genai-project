// 가짜 65건. 실제 calls/call 모듈 + 격리된 mock API, 외부 호출·실계정 없음.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=process.env.CALLS_PENDING_PUBLIC||fileURLToPath(new URL('../public/',import.meta.url));
const output=process.env.CALLS_PENDING_OUTPUT||path.resolve(import.meta.dirname,'../artifacts/e2e/calls-pending-search');

const harness=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/pages/calls.css"><link rel="stylesheet" href="/css/pages/call.css"><header class="topbar"></header><main id="view"></main><script type="module">
import calls from '/js/pages/calls.js';import call from '/js/pages/call.js';import {getMeta} from '/js/api.js';
window.access={demo:false,role:'admin',user:{id:'fake-a'},workspace:{id:'fake-space'}};let cleanup;
window.mount=async()=>{cleanup?.();window.scrollTo(0,0);const el=document.createElement('div');document.querySelector('#view').replaceChildren(el);const [p,q]=location.hash.slice(1).split('?');const ctx={query:Object.fromEntries(new URLSearchParams(q)),params:{id:p.split('/')[2]},meta:{access:window.access},refreshMeta:async()=>({access:window.access})};cleanup=await (ctx.params.id?call:calls).mount(el,ctx);window.ready=(window.ready||0)+1;};await getMeta();addEventListener('hashchange',window.mount);await window.mount();</script>`;
const fixtures=Array.from({length:65},(_,i)=>({id:`fake-${i+1}`,title:`가짜 통화 ${i+1}`,customer:`가짜 거래처 ${i+1}`,recordedAt:'2026-11-18T09:00:00Z',status:'ready',hasAudio:false,summary:'가짜 검색 부품',segments:[],card:null}));
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname;if(p==='/'){res.setHeader('content-type','text/html');return res.end(harness);}if(!/^\/(js|css|fonts|montage)\/[\w./-]+$/.test(p)||p.includes('..'))return res.writeHead(404).end();res.setHeader('content-type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'font/woff2');res.end(await readFile(p==='/js/pages/calls.js'&&process.env.CALLS_PENDING_MODULE?process.env.CALLS_PENDING_MODULE:path.join(root,p)));}catch{res.writeHead(404).end();}});
let browser,page;const errors=[],blocked=[],results=[];
try{await mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({headless:true,...(process.env.CALLS_BROWSER ? { executablePath: process.env.CALLS_BROWSER } : {}),env:{HOME:process.env.HOME,PATH:process.env.PATH}});
for(const width of [360,390,...(process.env.CALLS_REQUIRE_MONTAGE === '1' ? [1440] : [])])for(const big of [false,true])for(const edit of ['type','clear','type60','space60'])for(const back of ['history','link']){
if(edit.endsWith('60')&&(width!==390||!big))continue;
const context=await browser.newContext({viewport:{width,height:800},serviceWorkers:'block',reducedMotion:'reduce'}),queries=[];
await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin){blocked.push(u.origin);return route.abort();}if(!u.pathname.startsWith('/api/'))return route.continue();const reply=json=>route.fulfill({json});if(u.pathname==='/api/meta')return reply({access:{demo:false,role:'admin',user:{id:'fake-a'},workspace:{id:'fake-space'}}});if(u.pathname==='/api/customers')return reply({customers:[]});if(u.pathname==='/api/calls'){queries.push(Object.fromEntries(u.searchParams));const offset=Number(u.searchParams.get('offset')||0),limit=Number(u.searchParams.get('limit')||30);return reply({calls:fixtures.slice(offset,offset+limit),total:fixtures.length});}if(u.pathname.startsWith('/api/calls/'))return reply(fixtures.find(c=>c.id===u.pathname.split('/').at(-1)));errors.push('unexpected '+u.pathname);return reply({});});
page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));const id=`${width}-${big?'large':'normal'}-${edit}-${back}`;
try{await page.clock.install();await page.goto(origin+'/#/calls?status=cancelled'+(edit==='clear'||edit==='space60'?'&q=부품':''));await page.locator('.cl-title').first().waitFor();
if(process.env.CALLS_REQUIRE_MONTAGE === '1'){
  await page.locator('[data-component="search-field"] #cl-q').waitFor();
  assert.ok(await page.locator('.cl-montage-statuses [data-status="cancelled"]').count(), 'official status controls missing');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'page must not overflow');
  await page.screenshot({path:path.join(output,id+'-montage.png')});
}if(big)await page.evaluate(()=>document.documentElement.classList.add('big-text'));await page.evaluate(()=>document.fonts.ready);if(edit.endsWith('60')){await page.locator('[data-act=more]').click();await page.locator('.cl-item').nth(59).waitFor();}
// Input and ordinary unmodified detail-link click share one JS task, deterministically before the 350ms debounce.
const expected=edit==='clear'?'':edit==='space60'?'부품':'가짜 새 검색';await page.evaluate(value=>{const input=document.querySelector('#cl-q');input.focus();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.cl-title').click();},edit==='space60'?'  부품  ':expected);await page.locator('.cd-back').waitFor();
const detailUrl=page.url();if(back==='history')await page.goBack();else await page.locator('.cd-back').click();await page.locator('#cl-q').waitFor();await page.locator('.cl-title').first().waitFor();
if(process.env.CALLS_REQUIRE_MONTAGE === '1'){
  await page.locator('[data-component="search-field"] #cl-q').waitFor();
  assert.ok(await page.locator('.cl-montage-statuses [data-status="cancelled"]').count(), 'official status controls missing');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'page must not overflow');
  await page.screenshot({path:path.join(output,id+'-montage.png')});
}if(edit.endsWith('60')){await page.locator('.cl-item').nth(edit==='space60'?59:29).waitFor();assert.equal(await page.locator('.cl-item').count(),edit==='space60'?60:30,'changed search resets pagination, whitespace-only preserves it');}await page.clock.runFor(10);await page.screenshot({path:path.join(output,id+'.png')});
const shown=await page.locator('#cl-q').inputValue(),urlQuery=await page.evaluate(()=>new URLSearchParams(location.hash.split('?')[1]||'').get('q')||''),sent=queries.at(-1).q||'';assert.equal(shown,expected,'visible pending search survives return');assert.equal(urlQuery,expected,'returned URL agrees with input');assert.equal(sent,expected,'actual list query agrees with input/URL');assert.equal(queries.at(-1).status,'cancelled','cancelled filter preserved');assert.equal(await page.evaluate(()=>new URLSearchParams(location.hash.split('?')[1]).get('status')),'cancelled');
// Normal debounce must still issue a search and filter clear must not resurrect the pending value.
await page.locator('#cl-q').fill('가짜 정상 검색');await page.clock.runFor(400);for(let i=0;i<100&&(queries.at(-1).q||'')!=='가짜 정상 검색';i++)await new Promise(r=>setTimeout(r,10));assert.equal(queries.at(-1).q,'가짜 정상 검색');assert.equal(await page.locator('#cl-q').inputValue(),'가짜 정상 검색');
await page.locator('[data-act="clear-q"]').click();await page.clock.runFor(400);for(let i=0;i<100&&(queries.at(-1).q||'')!=='';i++)await new Promise(r=>setTimeout(r,10));assert.equal(queries.at(-1).q||'','');assert.equal(await page.locator('#cl-q').inputValue(),'');results.push({width,big,edit,back,pass:true,shown,urlQuery,sent,normalDebounceAndClear:true,cancelledFilterPreserved:true,detailUrl:new URL(detailUrl).hash});
}catch(e){results.push({width,big,edit,back,pass:false,error:e.message,queries});await page.screenshot({path:path.join(output,id+'-failure.png')});}finally{await context.close();}
}
assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.ok(results.every(r=>r.pass),'pending search return failed');
}catch(e){process.exitCode=1;results.push({runError:e.message});}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(path.join(output,'report.json'),JSON.stringify({scope:'actual calls/call modules and isolated router, fake API; no real account/search backend',results,errors,blocked},null,2));console.log(JSON.stringify(results));}
