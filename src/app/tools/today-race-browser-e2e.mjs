// 가짜 응답만 사용: 실제 today UI→mock API 경합 회귀, 실제 AI·계정·클립보드 접근 없음.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const publicRoot=path.resolve(import.meta.dirname,'../public');
const output=path.resolve(process.env.TODAY_RACE_OUTPUT_DIR||path.join(import.meta.dirname,'../artifacts/e2e/today-race'));
const harness=`<!doctype html><meta charset="utf-8"><div id="app"></div><script type="module">
import today from '/js/pages/today.js';import {kstDay} from '/js/ui.js';
window.copies=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{window.copies.push(t);}}});
window.dispose=await today.mount(document.querySelector('#app'),{query:{day:kstDay()},meta:{demo:true,aiEnabled:true,aiProvider:'fixture'},refreshMeta:async()=>({demo:true,aiEnabled:true,aiProvider:'fixture'})});
</script>`;
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;if(p==='/'){res.setHeader('content-type','text/html');return res.end(harness);}if(!/^\/js\/[a-zA-Z0-9_/-]+\.js$/.test(p)||p.includes('..'))return res.writeHead(404).end();res.setHeader('content-type','text/javascript');res.end(await readFile(p==='/js/pages/today.js'&&process.env.TODAY_RACE_MODULE?process.env.TODAY_RACE_MODULE:path.join(publicRoot,p)));}catch{res.writeHead(404).end();}});
const results=[],blocked=[],errors=[];let browser,page;
const data=(day,label)=>({day,stats:{calls:1},todos:[{title:label,callId:'fake-race',kind:'confirm'}]});
try{
await mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
browser=await chromium.launch({headless:true,env:{HOME:process.env.HOME,PATH:process.env.PATH},...(process.env.E2E_CHROMIUM_PATH?{executablePath:process.env.E2E_CHROMIUM_PATH}:{})});
for(const scenario of ['dashboard ABA','briefing ABA','summary preview ABA','summary copy ABA','same-day summary reverse','dashboard refresh versus new briefing']){
const context=await browser.newContext({serviceWorkers:'block'});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const pending=[];
await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==origin){blocked.push(u.origin);return route.abort();}if(u.pathname.startsWith('/api/')){pending.push({route,url:u,method:route.request().method()});return;}return route.continue();});
const take=async(p,method='GET')=>{for(let i=0;i<200;i++){const n=pending.findIndex(x=>x.url.pathname===p&&x.method===method);if(n>=0)return pending.splice(n,1)[0];await new Promise(r=>setTimeout(r,10));}throw Error('missing mock request '+p+' '+method);};
const flush=async()=>{if(scenario==='dashboard refresh versus new briefing')await page.clock.runFor(40);else await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const reply=async(q,body)=>{await q.route.fulfill({json:body});await flush();};
const dash=async(label)=>{const q=await take('/api/dashboard');await reply(q,data(q.url.searchParams.get('day'),label));};
const act=async(name)=>page.locator(`[data-act="${name}"]`).click();
const roundtrip=async()=>{await page.getByRole('button',{name:'어제',exact:true}).click();await dash('fake yesterday');await page.getByRole('button',{name:'오늘',exact:true}).click();await dash('fake latest dashboard');};
try{
if(scenario==='dashboard refresh versus new briefing') await page.clock.install();
await page.goto(origin);
if(scenario==='dashboard ABA'){
const old=await take('/api/dashboard');await roundtrip();await reply(old,data(old.url.searchParams.get('day'),'fake obsolete dashboard'));assert.match(await page.locator('#today-priority').innerText(),/fake latest dashboard/);
}else{
await dash('fake initial');const initialText=await take('/api/briefing/text');
if(scenario==='dashboard refresh versus new briefing'){
await page.clock.runFor(30010);const old=await take('/api/dashboard');await act('brief');const latest=await take('/api/briefing','POST');await reply(latest,{paragraph:'fake latest briefing'});await reply(old,{...data(old.url.searchParams.get('day'),'fake refreshed dashboard'),briefing:{paragraph:'fake obsolete briefing'}});assert.equal(await page.locator('.today-brief-text').innerText(),'fake latest briefing');
}else if(scenario==='briefing ABA'){
await act('brief');const old=await take('/api/briefing','POST');await roundtrip();await act('brief');const latest=await take('/api/briefing','POST');await reply(latest,{paragraph:'fake latest briefing'});await reply(old,{paragraph:'fake obsolete briefing'});assert.equal(await page.locator('.today-brief-text').innerText(),'fake latest briefing');assert.equal(await page.locator('[data-act=brief]').getAttribute('aria-disabled'),null);
}else if(scenario==='same-day summary reverse'){
await act('text');const latest=await take('/api/briefing/text');await reply(latest,{text:'fake latest summary'});await reply(initialText,{text:'fake obsolete summary'});assert.equal(await page.locator('.today-sum-text').innerText(),'fake latest summary');
}else{
let old=initialText;if(scenario==='summary copy ABA'){await act('copy');old=await take('/api/briefing/text');}
await roundtrip();const yesterday=await take('/api/briefing/text');const latest=await take('/api/briefing/text');await reply(latest,{text:'fake latest summary'});await act('text');await act('copy');assert.deepEqual(await page.evaluate(()=>window.copies),['fake latest summary']);await reply(old,{text:'fake obsolete summary'});assert.equal(await page.locator('.today-sum-text').innerText(),'fake latest summary');assert.deepEqual(await page.evaluate(()=>window.copies),['fake latest summary']);assert.equal(await page.locator('[data-act=copy]').innerText(),'마감 요약 복사');
}
}
results.push({scenario,pass:true});
}catch(e){results.push({scenario,pass:false,error:e.message});await page.screenshot({path:path.join(output,scenario.replaceAll(' ','-')+'.png')});}
finally{await page.evaluate(()=>window.dispose?.()).catch(()=>{});await context.close();}
}
assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);assert.ok(results.every(r=>r.pass),JSON.stringify(results));
}catch(e){process.exitCode=1;results.push({runError:e.message});}
finally{await browser?.close();await new Promise(r=>server.close(r));await mkdir(output,{recursive:true});await writeFile(path.join(output,'report.json'),JSON.stringify({scope:'actual today UI with deferred fake API; clipboard stub; no backend/AI/auth verification',results,blocked,errors},null,2));console.log(JSON.stringify(results));}
