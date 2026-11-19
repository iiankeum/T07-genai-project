// 가짜 통화만 사용. 실제 calls 모듈 + mock API. 실계정/외부 AI 없음.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const output=process.env.CALLS_REFRESH_OUTPUT||'/tmp/ahcha-calls-refresh';
const harness=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/pages/calls.css"><header class="topbar"></header><main id="view"></main><script type="module">import calls from '/js/pages/calls.js';import {getMeta} from '/js/api.js';const meta=await getMeta();window.cleanup=await calls.mount(document.querySelector('#view'),{query:{},meta});window.ready=true;</script>`;
const fake=(id,status='ready')=>({id:'fake-'+id,customer:'가짜 거래처 '+id,title:'가짜 통화',recordedAt:'2026-11-18T09:00:00Z',status,hasAudio:false,card:null});
let fixtures=[],hold=false,held=null,fail=false;
const requests=[],errors=[],external=[],results=[];
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname;if(p==='/'){res.setHeader('content-type','text/html');return res.end(harness);}if(!/^\/(js|css|fonts|montage)\/[\w./-]+$/.test(p)||p.includes('..'))return res.writeHead(404).end();res.setHeader('content-type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'font/woff2');res.end(await readFile(path.join(root,p)));}catch{res.writeHead(404).end();}});
let browser,page;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true});const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());if(u.origin!==origin){external.push(u.origin);return route.abort();}
  if(!u.pathname.startsWith('/api/'))return route.continue();
  const reply=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(u.pathname==='/api/meta')return reply({access:{demo:false,role:'admin',user:{id:'fake-a'},workspace:{id:'fake-space'}}});
  if(u.pathname==='/api/customers')return reply({customers:[]});
  if(u.pathname==='/api/calls'){
   assert.equal(r.method(),'GET');assert.equal(r.headers()['x-ahmatda-workspace'],'fake-space');assert.equal(r.headers()['x-ahmatda-actor'],'fake-a');
   const query=Object.fromEntries(u.searchParams);requests.push(query);
   const deliver=()=>{if(fail){fail=false;return route.abort('failed');}const offset=Number(query.offset||0),limit=Math.min(200,Number(query.limit||30));const selected=query.status==='working'?fixtures.filter(c=>['queued','transcribing','extracting'].includes(c.status)):fixtures;return reply({calls:selected.slice(offset,offset+limit),total:selected.length});};
   if(hold){hold=false;held=deliver;return;}return deliver();
  }
  errors.push(u.pathname);return reply({});
 });
 async function setup(width=1440,count=150,totalCount=240){
  await page?.close();fixtures=Array.from({length:totalCount},(_,i)=>fake(i+1,i===1?'extracting':'ready'));hold=false;held=null;fail=false;
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install();await page.setViewportSize({width,height:900});await page.goto(origin+'/#/calls');await page.waitForFunction(()=>window.ready);
  for(let n=30;n<count;n+=30){await page.locator('[data-act=more]').click();await page.waitForFunction(n=>document.querySelectorAll('.cl-item').length===n,Math.min(n+30,totalCount));}
 }
 const link=id=>page.locator(`.cl-title[href="#/calls/fake-${id}"]`);
 async function position(id){await link(id).focus();await link(id).evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));return link(id).evaluate(e=>e.getBoundingClientRect().top);}
 async function tick(){const n=requests.length;await page.clock.fastForward(10000);for(let i=0;i<100&&requests.length===n;i++)await new Promise(r=>setTimeout(r,10));assert.ok(requests.length>n);}
 async function refreshed(){await page.waitForFunction(()=>document.querySelector('.cl-item')?.textContent.includes('갱신됨'));}
 await mkdir(output,{recursive:true});
 for(const width of [1440,390]){
  await setup(width);const y=await position(140);fixtures[0].summary='갱신됨';await tick();await refreshed();
  assert.equal(await page.locator('.cl-item').count(),150);assert.equal(requests.at(-1).limit,'150');assert.equal(requests.at(-1).offset,'0');
  assert.equal(await link(140).evaluate(e=>document.activeElement===e),true);assert.ok(Math.abs(await link(140).evaluate(e=>e.getBoundingClientRect().top)-y)<3);
  await page.screenshot({path:path.join(output,`refresh-${width}.png`)});results.push({width,rows:150,focusAndPosition:true});
 }
 await setup(1440,200,200);await position(190);fixtures[0].summary='갱신됨';await tick();await refreshed();assert.equal(requests.at(-1).limit,'200');assert.equal(await page.locator('.cl-item').count(),200);assert.equal(await link(190).evaluate(e=>document.activeElement===e),true);results.push({rows:200,singleMaximumResponse:true});
 // A completed row exits the working filter, so preserve the stale list until explicit refresh.
 await setup();fixtures.forEach(c=>{c.status='extracting';});await page.locator('[data-status=working]').click();await page.waitForFunction(()=>document.querySelectorAll('.cl-item').length===30);
 for(let n=60;n<=150;n+=30){await page.locator('[data-act=more]').click();await page.waitForFunction(n=>document.querySelectorAll('.cl-item').length===n,n);}
 await position(140);fixtures.find(c=>c.id==='fake-140').status='ready';await tick();await page.locator('[data-act=refresh-list]').waitFor();assert.equal(requests.at(-1).status,'working');assert.equal(await link(140).evaluate(e=>document.activeElement===e),true);results.push({workingFilterExit:true,explicitRefreshRequired:true});
 // Status completion must update while preserving position and stop polling when no loaded work remains.
 await setup();await position(140);fixtures[1].status='ready';fixtures[0].summary='갱신됨';await tick();await refreshed();const count=requests.length;await page.clock.fastForward(20000);assert.equal(requests.length,count);results.push({completedStatus:true,pollingStopped:true});
 // New insertion is one authoritative prefix, not stitched offsets; stable row keeps its visual position.
 await setup();const top=await position(140);fixtures.unshift({...fake('new'),summary:'갱신됨'});await tick();await refreshed();assert.equal(await page.locator('.cl-item').count(),150);assert.equal(await link(140).evaluate(e=>document.activeElement===e),true);assert.ok(Math.abs(await link(140).evaluate(e=>e.getBoundingClientRect().top)-top)<3);assert.equal(new Set(await page.locator('.cl-item').evaluateAll(es=>es.map(e=>e.dataset.callId))).size,150);results.push({insertion:true,singlePrefixNoDuplicates:true,stableAnchor:true});
 // Capture the user's latest location, not the focus at request start.
 await setup();await position(140);hold=true;await tick();assert.ok(held);const moved=await position(130);fixtures[0].summary='갱신됨';await held();await refreshed();assert.equal(await link(130).evaluate(e=>document.activeElement===e),true);assert.ok(Math.abs(await link(130).evaluate(e=>e.getBoundingClientRect().top)-moved)<3);results.push({movedDuringRequest:true,latestFocus:true});
 await setup();await position(140);hold=true;await tick();await page.locator('#cl-q').focus();fixtures[0].summary='갱신됨';await held();await refreshed();assert.equal(await page.locator('#cl-q').evaluate(e=>document.activeElement===e),true);results.push({searchFocusDuringRequest:true});
 // Missing focused row: do not silently focus its replacement. Keep stale list and explicit reset choice.
 await setup();const lostTop=await position(140);fixtures=fixtures.filter(c=>c.id!=='fake-140');await tick();await page.locator('[data-act=refresh-list]').waitFor();assert.equal(await page.locator('.cl-item').count(),150);assert.equal(await link(140).evaluate(e=>document.activeElement===e),true);assert.match(await page.locator('[data-slot=refresh-note]').innerText(),/최신이 아닐/);assert.ok(Math.abs(await link(140).evaluate(e=>e.getBoundingClientRect().top)-lostTop)<3);assert.ok(await page.locator('[data-slot=refresh-note]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));await page.locator('[data-act=refresh-list]').click();await page.waitForFunction(()=>document.querySelectorAll('.cl-item').length===30);assert.equal(await page.locator('#cl-q').evaluate(e=>document.activeElement===e),true);results.push({missingRow:true,staleListKept:true,explicitReset30:true});
 // A retained row is not enough: its focused customer or evidence link may disappear.
 for(const action of ['customer','match']){
  await setup();
  if(action==='match'){
   fixtures[139].matches=[{text:'가짜 근거',segIndex:2,at:5}];fixtures[0].summary='갱신됨';await tick();await refreshed();
  }
  await position(140);const focused=page.locator(`[data-call-id="fake-140"] ${action==='customer'?'.cl-cust':'.cl-match'}`);await focused.focus();
  hold=true;await tick();assert.ok(held);if(action==='customer')fixtures[139].customer='가짜 변경 거래처';else fixtures[139].matches=[];
  await held();await page.locator('[data-act=refresh-list]').waitFor();assert.equal(await focused.evaluate(e=>document.activeElement===e),true);assert.equal(await page.locator('.cl-item').count(),150);
  results.push({focusedAction:action,linkDisappears:true,staleDomAndFocusKept:true});
 }
 // More than server maximum: no partial snapshot and no offset stitching for background updates.
 await setup(390,210);await page.locator('[data-act=refresh-list]').waitFor();const before=requests.length;await page.clock.fastForward(20000);assert.equal(requests.length,before);assert.equal(await page.locator('.cl-item').count(),210);assert.match(await page.locator('[data-slot=refresh-note]').innerText(),/200건/);assert.ok(await page.locator('[data-slot=refresh-note]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));assert.equal(await page.locator('.cl-working').innerText().then(s=>s.includes('10초')),false);await page.screenshot({path:path.join(output,'paused-390.png')});await page.locator('[data-act=more]').click();await page.waitForFunction(()=>document.querySelectorAll('.cl-item').length===240);assert.equal(await page.locator('.cl-working .spinner').count(),0);assert.match(await page.locator('.cl-working').innerText(),/자동 갱신 멈춤/);results.push({rows:210,automaticRefreshPaused:true,noBackgroundRequests:true,appendWhilePausedNoSpinner:true});
 // Failed silent request leaves existing DOM and focus untouched, and retries only on next timer.
 await setup();await position(140);fail=true;await tick();await page.waitForTimeout(100);assert.equal(await page.locator('.cl-item').count(),150);assert.equal(await link(140).evaluate(e=>document.activeElement===e),true);results.push({networkFailure:true,listAndFocusKept:true});
 for(const event of ['ahmatda:session-expired','ahmatda:workspace-changed']){
  await setup();await position(140);hold=true;await tick();assert.ok(held);await page.evaluate(event=>window.dispatchEvent(new CustomEvent(event)),event);fixtures[0].summary='갱신됨';await held();await page.waitForTimeout(100);assert.equal(await page.locator('.cl-item').first().textContent().then(s=>s.includes('갱신됨')),false);const n=requests.length;await page.clock.fastForward(20000);assert.equal(requests.length,n);results.push({event,lateResponseIgnored:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);const report={scope:'actual calls module, mock API only, internal test not user study',results,requests,errors,external};await writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({results,errors,external}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
