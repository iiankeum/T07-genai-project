// 합성 무음 WAV만 쓰는 업로드 UI 회귀. 실제 음성·계정·외부 서버·유료 AI를 사용하지 않습니다.
// UI→mock API integration only. Synthetic WAV, no transcription, account, paid API or external request.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const artifacts=path.resolve(process.env.UPLOAD_BATCH_OUTPUT_DIR||fileURLToPath(new URL('../artifacts/e2e/upload-batch/',import.meta.url)));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const harness=`<!doctype html><meta charset="utf-8"><div id="app"></div><script type="module">
import upload from '/js/pages/upload.js'; import {getMeta} from '/js/api.js';
const meta=await getMeta(); window.disposeUpload=await upload.mount(document.querySelector('#app'),{meta,refreshMeta:()=>getMeta(true)}); window.uploadMounted=true;
</script>`;
const server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(harness);return;}
 if(!/^\/js\/[a-zA-Z0-9_/-]+\.js$/.test(url.pathname)||url.pathname.includes('..')){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile(url.pathname==='/js/pages/upload.js'&&process.env.UPLOAD_BATCH_MODULE?process.env.UPLOAD_BATCH_MODULE:path.join(root,url.pathname)));
 }catch{res.writeHead(404).end();}
});
let browser,activePage;const errors=[],blocked=[],results=[];
// RIFF PCM silence generated in memory, not a customer's recording.
const wav=Buffer.alloc(76);wav.write('RIFF');wav.writeUInt32LE(68,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32,40);try{
 await mkdir(artifacts,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,env:{HOME:process.env.HOME,PATH:process.env.PATH},...(process.env.E2E_CHROMIUM_PATH?{executablePath:process.env.E2E_CHROMIUM_PATH}:{})});
 for(const demo of [true,false])for(const addKind of ['input','drop']){
 const context=await browser.newContext({serviceWorkers:'block'}),requests=[],pending=[];const workspace='fake-batch-space';
 await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin!==origin){blocked.push(u.origin);return route.abort();}if(!u.pathname.startsWith('/api/'))return route.continue();const reply=json=>route.fulfill({json});
 if(u.pathname==='/api/meta')return reply({demo,access:{workspace:{id:workspace}},worker:{online:false}});
 if(u.pathname==='/api/worker/status')return reply({online:false,queue:{waiting:0}});if(u.pathname==='/api/samples')return reply({samples:[]});
 if(u.pathname==='/api/calls/upload'){assert.equal(req.method(),'POST');assert.match(req.headers()['content-type'],/^multipart\/form-data;/);const fd=await new Response(req.postDataBuffer(),{headers:{'content-type':req.headers()['content-type']}}).formData();const f=fd.get('file');requests.push({name:f.name,bytes:Buffer.from(await f.arrayBuffer()),caller:fd.get('callerNumber'),when:fd.get('recordedAt'),fake:fd.get('fakeConfirm'),consent:fd.get('recordingConsent'),workspace:req.headers()['x-ahmatda-workspace']});pending.push(route);return;}
 if(u.pathname.startsWith('/api/calls/'))return reply({status:'ready',card:{status:'draft'}});errors.push('unexpected API '+u.pathname);return route.abort();});
 const page=await context.newPage();activePage=page;page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 const take=async()=>{for(let i=0;i<200;i++){if(pending.length)return pending.shift();await new Promise(r=>setTimeout(r,10));}throw Error('upload request absent');};
 try{
 await page.goto(origin);await page.waitForFunction(()=>window.uploadMounted);
 const file=name=>({name,mimeType:'audio/wav',buffer:wav});await page.locator('[data-ref=file]').setInputFiles([file('fake-a.wav'),file('fake-a2.wav')]);await page.locator('[data-ref=fake]').check();await page.locator('[data-ref=caller]').fill('010-0000-0000');await page.locator('[data-ref=when]').fill('2030-01-02T09:00');const oldWhen=await page.locator('[data-ref=when]').evaluate(e=>new Date(e.value).toISOString());const button=page.locator('[data-act=upload]');await button.click();const a=await take();
 if(addKind==='input')await page.locator('[data-ref=file]').setInputFiles(file('fake-b.wav'));else await page.locator('[data-ref=drop]').evaluate((el,bytes)=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(bytes)],'fake-b.wav',{type:'audio/wav'}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));},[...wav]);
 assert.equal(await page.locator('.upload-row').count(),3);await page.locator('[data-ref=caller]').fill('010-0000-0001');await page.locator('[data-ref=when]').fill('2030-01-03T10:00');const newWhen=await page.locator('[data-ref=when]').evaluate(e=>new Date(e.value).toISOString());
 await button.evaluate(el=>{el.dispatchEvent(new MouseEvent('click',{bubbles:true}));el.dispatchEvent(new MouseEvent('click',{bubbles:true}));});assert.equal(requests.length,1,'busy click cannot duplicate POST');
 await a.fulfill({json:{callId:'fake-a',call:{status:'ready',card:{status:'draft'}}}});const a2=await take();assert.equal(requests[1].name,'fake-a2.wav');assert.equal(requests[1].caller,'010-0000-0000');assert.equal(requests[1].when,oldWhen);await a2.fulfill({json:{callId:'fake-a2',call:{status:'ready',card:{status:'draft'}}}});
 // Both code paths render a terminal A2 row before either stopping or wrongly sending B.
 await page.waitForFunction(()=>document.querySelectorAll('.upload-row.is-done').length===2);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(requests.length,2,'new B must not enter the already-approved batch');assert.equal(await page.locator('.upload-row.is-ready').count(),1);assert.equal(await button.isDisabled(),false);
 await button.click();const b=await take();assert.equal(requests.length,3);assert.equal(requests[2].name,'fake-b.wav');assert.equal(requests[2].caller,'010-0000-0001');assert.equal(requests[2].when,newWhen);await b.fulfill({json:{callId:'fake-b',call:{status:'ready',card:{status:'draft'}}}});await page.waitForFunction(()=>document.querySelectorAll('.upload-row.is-done').length===3);
 for(const r of requests){assert.deepEqual(r.bytes,wav);assert.equal(r.workspace,workspace);assert.equal(r.fake,demo?'yes':null);assert.equal(r.consent,demo?null:'yes');}results.push({demo,addKind,pass:true,uploads:requests.length});
 }catch(e){results.push({demo,addKind,pass:false,error:e.message,requests:requests.map(r=>({name:r.name,caller:r.caller,when:r.when}))});await page.screenshot({path:path.join(artifacts,`${demo?'demo':'private'}-${addKind}-failure.png`)});}
 finally{await page.evaluate(()=>window.disposeUpload?.()).catch(()=>{});await context.close();}
 }
 assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);assert.ok(results.every(r=>r.pass),'upload batch boundary failed');
}catch(e){process.exitCode=1;results.push({runError:e.message});}
finally{await browser?.close();await new Promise(r=>server.close(r));await mkdir(artifacts,{recursive:true});await writeFile(path.join(artifacts,'report.json'),JSON.stringify({scope:'real upload UI + deferred mock API, fake silence only; no backend/auth/transcription/real consent',results,errors,blocked},null,2));console.log(JSON.stringify(results));}
