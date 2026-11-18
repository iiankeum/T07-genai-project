// 가짜 개인정보 안내·신청 응답만 사용. 실제 동의·신청·계정·외부 전송 없음.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'../public'),output=path.resolve(process.env.TRIAL_SUBMIT_OUTPUT_DIR||path.join(import.meta.dirname,'../artifacts/e2e/trial-submit'));
const harness=`<!doctype html><meta charset="utf-8"><div id="app"></div><script type="module">import trial from '/js/pages/trial.js';window.dispose=await trial.mount(document.querySelector('#app'));</script>`;
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;if(p==='/'){res.setHeader('content-type','text/html');return res.end(harness);}if(!/^\/js\/[a-zA-Z0-9_/-]+\.js$/.test(p)||p.includes('..'))return res.writeHead(404).end();res.setHeader('content-type','text/javascript');res.end(await readFile(p==='/js/pages/trial.js'&&process.env.TRIAL_SUBMIT_MODULE?process.env.TRIAL_SUBMIT_MODULE:path.join(root,p)));}catch{res.writeHead(404).end();}});
const results=[],errors=[],blocked=[],requests=[];let browser,page;
const fields={name:'가짜 신청자',org:'가짜 검증업체',contact:'fixture@example.invalid',role:'학생 · 연구',message:'가짜 신청 내용'};
try{
await mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
browser=await chromium.launch({headless:true,env:{HOME:process.env.HOME,PATH:process.env.PATH},...(process.env.E2E_CHROMIUM_PATH?{executablePath:process.env.E2E_CHROMIUM_PATH}:{})});
const context=await browser.newContext({serviceWorkers:'block'});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const pending=[];
await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.origin!==origin){blocked.push(u.origin);return route.abort();}if(u.pathname==='/api/trial/policy')return route.fulfill({json:{policy:{title:'가짜 검증 안내',purpose:'가짜 테스트 전용',version:'fake-1'}}});if(u.pathname==='/api/trial'){requests.push({method:req.method(),body:req.postDataJSON()});pending.push(route);return;}if(u.pathname.startsWith('/api/')){errors.push('unexpected API '+u.pathname);return route.abort();}return route.continue();});
const tick=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const take=async()=>{for(let i=0;i<200;i++){if(pending.length)return pending.shift();await new Promise(r=>setTimeout(r,10));}throw Error('missing trial POST');};
const fill=async()=>{for(const [k,v]of Object.entries(fields)){const f=page.locator(`[name="${k}"]`);if(k==='role')await f.selectOption(v);else await f.fill(v);}await page.locator('[name=consent]').check();};
const check=async(name,fn)=>{try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}};
await page.goto(origin);await fill();await page.locator('[type=submit]').click();let req=await take();
await check('pending fields and consent locked',async()=>{for(const k of [...Object.keys(fields),'consent'])assert.equal(await page.locator(`[name="${k}"]`).isDisabled(),true,k+' must be disabled');});
await page.locator('form').evaluate(f=>{f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});await tick();assert.equal(requests.length,1);assert.deepEqual(requests[0],{method:'POST',body:{...fields,consent:true}});results.push({name:'duplicate submit produces one exact payload',pass:true});
await req.fulfill({status:500,json:{error:'fake_failure',message:'가짜 전송 실패'}});await page.getByRole('alert').waitFor();
for(const[k,v]of Object.entries(fields)){assert.equal(await page.locator(`[name="${k}"]`).inputValue(),v);assert.equal(await page.locator(`[name="${k}"]`).isDisabled(),false);}assert.equal(await page.locator('[name=consent]').isChecked(),true);assert.equal(await page.locator('[name=consent]').isDisabled(),false);assert.equal(await page.locator('[type=submit]').isDisabled(),false);results.push({name:'failure preserves values and unlocks',pass:true});
await page.locator('[name=message]').fill('가짜 재시도 내용');await page.locator('[type=submit]').click();req=await take();assert.equal(requests.length,2);assert.deepEqual(requests[1].body,{...fields,message:'가짜 재시도 내용',consent:true});
await req.fulfill({json:{ok:true}});await page.locator('.trial-done').waitFor();assert.equal(await page.locator('.trial-done').count(),1);assert.equal(await page.locator('form').count(),0);assert.equal(requests.length,2);results.push({name:'retry succeeds once with updated payload',pass:true});
// On old code, demonstrate the actual loss rather than merely an absent disabled attribute.
await page.reload();await fill();await page.locator('[type=submit]').click();req=await take();const editable=!(await page.locator('[name=message]').isDisabled());if(editable){await page.locator('[name=message]').fill('가짜 대기 중 수정');await page.locator('[name=consent]').uncheck();}await req.fulfill({json:{ok:true}});await page.locator('.trial-done').waitFor();await check('pending edit cannot be silently discarded',async()=>assert.equal(editable,false,'pending edit and consent change were possible, then success replaced the form'));assert.equal(requests[2].body.message,fields.message);assert.equal(requests[2].body.consent,true);
assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.ok(results.every(r=>r.pass),'trial pending safety assertions failed');
}catch(e){process.exitCode=1;results.push({runError:e.message});await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await page?.evaluate(()=>window.dispose?.()).catch(()=>{});await browser?.close();await new Promise(r=>server.close(r));await mkdir(output,{recursive:true});await writeFile(path.join(output,'report.json'),JSON.stringify({scope:'actual trial UI with deferred fake API, not real submission/consent/backend validation',results,requestCount:requests.length,errors,blocked},null,2));console.log(JSON.stringify(results));}
