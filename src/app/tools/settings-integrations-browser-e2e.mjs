// Actual settings module + mock API only. Does not configure a real Mac or call an AI provider.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const output=path.resolve(process.env.SETTINGS_OUTPUT||'/tmp/ahcha-settings-integrations');
const harness=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/pages/settings.css"><main id="view"></main><script type="module">import settings from '/js/pages/settings.js';import {getMeta} from '/js/api.js';const meta=await getMeta();await settings.mount(document.querySelector('#view'),{params:{section:'integrations'},meta});window.ready=true;</script></html>`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(harness);}if(!/^\/(js|css|fonts)\/[A-Za-z0-9_.\/-]+$/.test(u.pathname)||u.pathname.includes('..'))return res.writeHead(404).end();res.setHeader('content-type',u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'font/woff2');res.end(await readFile(path.join(root,u.pathname)));}catch{res.writeHead(404).end();}});
let failurePath='',delayMutation=false;
let browser,page,role='admin',demo=false,provider='ollama';
let state={localWorker:{available:true,connected:false,configuredElsewhere:false},ingestConfigured:false,aiMode:'off'};
const calls=[],errors=[],blocked=[],results=[];const mutations=()=>calls.filter(x=>x.method!=='GET');
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true});const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==origin){blocked.push(u.origin);return route.abort();}if(!u.pathname.startsWith('/api/'))return route.continue();const body=r.postData()?r.postDataJSON():null;calls.push({method:r.method(),path:u.pathname,body,workspace:r.headers()['x-ahmatda-workspace']});const reply=x=>route.fulfill({contentType:'application/json',body:JSON.stringify(x)});
 if(r.method()!=='GET'&&delayMutation)await new Promise(resolve=>setTimeout(resolve,450));
 if(r.method()!=='GET'&&u.pathname===failurePath)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'fake_failure',message:'가짜 연결 실패'})});
 const access={demo,role,user:{id:'fake-native-user'},workspace:{id:'fake-native-space',name:'가짜 테스트 업체'}};
 if(u.pathname==='/api/meta')return reply({access,aiProvider:provider,model:'fake-local-model',worker:{online:false}});
 if(u.pathname==='/api/auth/me')return reply({access,user:{id:'fake-native-user',name:'가짜 사용자'}});
 if(u.pathname==='/api/settings/integrations'){if(r.method()==='PATCH')state.aiMode=body.aiMode;return reply(state);}
 if(u.pathname==='/api/settings/local-worker'){assert.equal(body.confirm,true);state.localWorker.connected=r.method()==='POST';state.localWorker.configuredElsewhere=false;return reply({ok:true});}
 if(u.pathname==='/api/settings/ingest-token'){state.ingestConfigured=r.method()==='POST';return reply(r.method()==='POST'?{token:'FAKE-NOT-A-SECRET-TOKEN'}:{ok:true});}
 errors.push('Unexpected API '+r.method()+' '+u.pathname);return reply({});
 });
 page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 const completion=async(section)=>{await page.waitForFunction(()=>document.activeElement?.dataset.ref==='integration-completion');assert.equal(await page.locator('[data-ref="integration-completion"]').evaluate(e=>e.closest('section').id),section);assert.equal(await page.locator('[role="status"]').allTextContents().then(xs=>xs.join(' ').includes('FAKE-NOT-A-SECRET-TOKEN')),false,'token must never enter live region');};
 const load=async()=>{await page.goto(origin+'/');await page.waitForFunction(()=>window.ready);};
 const submit=async id=>page.locator(`#${id} button[type="submit"]`).click();
 const guard=async id=>{const before=mutations().length;await submit(id);assert.equal(mutations().length,before,'unchecked '+id+' must not submit');assert.equal(await page.locator(`#${id} [name="confirm"]`).evaluate(e=>e.validity.valueMissing),true);};
 await load();await guard('local-worker-connect');assert.match(await page.locator('#view').innerText(),/30일/);assert.match(await page.locator('#view').innerText(),/자동으로 바뀌지/);assert.match(await page.locator('#local-worker-connect').innerText(),/기존 연결.*교체/);
 await page.locator('#local-worker-connect [name="confirm"]').check();await submit('local-worker-connect');await page.locator('#local-worker-disconnect').waitFor();assert.equal(state.localWorker.connected,true);await completion('integration-transcribe');assert.match(await page.locator('#local-worker-connect').innerText(),/갱신/);await guard('local-worker-connect');await page.locator('#local-worker-connect [name="confirm"]').check();await submit('local-worker-connect');await page.waitForFunction(()=>!document.querySelector('#local-worker-connect [name="confirm"]').checked);await guard('local-worker-disconnect');await page.locator('#local-worker-disconnect [name="confirm"]').check();await submit('local-worker-disconnect');await page.locator('#local-worker-disconnect').waitFor({state:'detached'});assert.equal(state.localWorker.connected,false);await completion('integration-transcribe');results.push('local connection, renewal and disconnect require explicit checked consent; 30-day and workspace boundaries visible');
 state.localWorker.configuredElsewhere=true;await load();assert.match(await page.locator('#view').innerText(),/다른 작업공간/);assert.match(await page.locator('#view').innerText(),/기존 연결.*해제/);await guard('local-worker-connect');results.push('another workspace connection has replacement warning, no automatic mutation');
 state.localWorker.available=false;await load();assert.equal(await page.locator('#local-worker-connect').count(),0);state.localWorker.available=true;
 role='viewer';let before=calls.length;await load();assert.equal(calls.slice(before).some(x=>x.path==='/api/settings/integrations'),false);assert.equal(await page.locator('form').count(),0);assert.match(await page.locator('#view').innerText(),/관리자/);role='admin';demo=true;await load();assert.equal(await page.locator('form').count(),0);demo=false;results.push('unavailable Mac controls hidden; non-admin and demo cannot access integration actions');
 state.localWorker.configuredElsewhere=false;await load();await submit('integration-token');await page.locator('.token-output').waitFor();assert.equal(await page.locator('.token-output').inputValue(),'FAKE-NOT-A-SECRET-TOKEN');assert.equal(state.ingestConfigured,true);await completion('integration-ingest');await guard('integration-token');await page.locator('#integration-token [name="confirm"]').check();await submit('integration-token');await page.waitForFunction(()=>!document.querySelector('#integration-token [name="confirm"]').checked);await guard('integration-revoke');await page.locator('#integration-revoke [name="confirm"]').check();await submit('integration-revoke');await page.locator('#integration-revoke').waitFor({state:'detached'});assert.equal(state.ingestConfigured,false);await completion('integration-ingest');results.push('ingest token creation, guarded rotation and guarded revoke retain payload behavior');
 // Failed requests retain existing fields; a disabled submit cannot issue another mutation.
 for(const [id,url,connected,configured] of [['local-worker-connect','/api/settings/local-worker',false,false],['local-worker-disconnect','/api/settings/local-worker',true,false],['integration-token','/api/settings/ingest-token',false,true]]){
  state.localWorker.connected=connected;state.ingestConfigured=configured;await load();failurePath=url;delayMutation=true;
  await page.locator(`#${id} [name="confirm"]`).check();const n=mutations().length;await submit(id);
  assert.equal(await page.locator(`#${id} button[type="submit"]`).isDisabled(),true);await page.locator(`#${id} button[type="submit"]`).evaluate(e=>e.click());
  await page.waitForFunction(formId=>!document.querySelector('#'+formId+' button[type="submit"]').disabled,id);
  assert.equal(mutations().length,n+1);assert.equal(await page.locator(`#${id} [name="confirm"]`).isChecked(),true);
  assert.match(await page.locator(`#${id} [role="status"]`).innerText(),/가짜 연결 실패/);assert.equal(await page.locator(`#${id} [role="status"]`).evaluate(e=>e===document.activeElement),true);
  assert.equal(state.localWorker.connected,connected);assert.equal(state.ingestConfigured,configured);failurePath='';delayMutation=false;
 }
 results.push('token rotation/Mac connection/disconnection failures retain confirmation and focus error; pending submit prevents duplicate clicks');
 state.ingestConfigured=false;state.localWorker.connected=false;await load();
 await page.setViewportSize({width:390,height:844});state.ingestConfigured=false;state.localWorker.connected=false;await load();
 await page.locator('#integration-token button').focus();await page.keyboard.press('Enter');await page.locator('.token-output').waitFor();await completion('integration-ingest');
 assert.equal(await page.locator('[data-ref="integration-completion"]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);
 await page.locator('#local-worker-connect [name="confirm"]').check();await page.locator('#local-worker-connect button').focus();await page.keyboard.press('Enter');await page.locator('#local-worker-disconnect').waitFor();await completion('integration-transcribe');
 assert.equal(await page.locator('[data-ref="integration-completion"]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);
 results.push('390px keyboard submit returns to visible completion for new token and Mac connection; live message excludes token');
 for(const mode of ['masked','configured','off']){await page.locator('#integration-ai select').selectOption(mode);await submit('integration-ai');await page.waitForFunction(()=>document.querySelector('#integration-ai [role="status"]').hidden===false);assert.equal(state.aiMode,mode);assert.deepEqual(mutations().at(-1).body,{aiMode:mode});}
 assert.match(await page.locator('#view').innerText(),/실제 요청/);assert.match(await page.locator('.integration-overview').innerText(),/실제 처리 성공을 뜻하지/);results.push('external AI modes save only configuration; UI distinguishes installed settings from successful processing');
 for(const [p,copy] of [['fixture','실제 AI 추론을 하지'],['anthropic','외부 Claude 연결 설정'],['off','AI 처리가 꺼져']]){provider=p;await load();assert.ok((await page.locator('#integration-ai-step').innerText()).includes(copy));}provider='ollama';
 for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,844]]){await page.setViewportSize({width,height});await load();for(const id of ['integration-ingest','integration-transcribe','integration-ai-step']){await page.locator('#'+id).waitFor();await page.locator('[data-step="'+id+'"]').click();assert.equal(await page.evaluate(()=>document.activeElement.id),id);assert.equal(new URL(page.url()).hash,'');}await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await mkdir(output,{recursive:true});await page.screenshot({path:path.join(output,size+'.png'),fullPage:true});}
 assert.ok(mutations().every(x=>x.workspace==='fake-native-space'));assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);const report={scope:'actual settings.js/API client, mocked native account/config only; no actual tokens, native processing, server authorization, or AI calls',status:'passed',results,mutationCount:mutations().length,errors,blocked};await writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){await mkdir(output,{recursive:true});if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
