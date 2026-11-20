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
const artifacts=path.resolve(process.env.UPLOAD_E2E_OUTPUT_DIR||fileURLToPath(new URL('../artifacts/e2e/upload/',import.meta.url)));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const harness=`<!doctype html><meta charset="utf-8"><div id="app"></div><script type="module">
import upload from '/js/pages/upload.js'; import {getMeta} from '/js/api.js';
const meta=await getMeta(); window.disposeUpload=await upload.mount(document.querySelector('#app'),{meta,refreshMeta:()=>getMeta(true)}); window.uploadMounted=true;
</script>`;
const server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(harness);return;}
 if(!/^\/js\/[a-zA-Z0-9_/-]+\.js$/.test(url.pathname)||url.pathname.includes('..')){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile(path.join(root,url.pathname)));
 }catch{res.writeHead(404).end();}
});
let browser,activePage;const errors=[],blocked=[],results=[];
// RIFF PCM silence generated in memory, not a customer's recording.
const wav=Buffer.alloc(76);wav.write('RIFF');wav.writeUInt32LE(68,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(32,40);
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,env:{HOME:process.env.HOME,PATH:'/usr/bin:/bin:/usr/sbin:/sbin'},...(process.env.E2E_CHROMIUM_PATH?{executablePath:process.env.E2E_CHROMIUM_PATH}:{})});
 for(const demo of [true,false]){
  const context=await browser.newContext({serviceWorkers:'block'}),requests=[];
  const workspace=demo?'fixture-demo-space':'fixture-private-space';let attempt=0,polls=0;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==origin){blocked.push(url.origin);return route.abort();}
   if(!url.pathname.startsWith('/api/'))return route.continue();
   const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/api/meta')return reply({demo,access:{workspace:{id:workspace}},worker:{online:false}});
   if(url.pathname==='/api/worker/status')return reply({online:false,queue:{waiting:1}});
   if(url.pathname==='/api/samples')return reply({samples:[]});
   if(url.pathname==='/api/calls/upload'){
    assert.equal(req.method(),'POST');assert.match(req.headers()['content-type']||'',/^multipart\/form-data;.*boundary=/i);
    const form=await new Response(req.postDataBuffer(),{headers:{'content-type':req.headers()['content-type']}}).formData();
    const file=form.get('file');
    requests.push({workspace:req.headers()['x-ahmatda-workspace'],fake:form.get('fakeConfirm'),consent:form.get('recordingConsent'),when:form.get('recordedAt'),caller:form.get('callerNumber'),name:file?.name,bytes:Buffer.from(await file.arrayBuffer())});
    attempt++;
    if(attempt===1)return reply({callId:'fake-waiting'});
    if(attempt===2)return reply({status:'duplicate',callId:'fake-existing'});
    if(attempt===3)return reply({error:'fake_failure',message:'가짜 전송 실패: 다시 시도하세요.'},500);
    return reply({callId:'fake-retried'});
   }
   if(url.pathname.startsWith('/api/calls/')){polls++;return reply({status:'ready',card:{status:'draft'}});}
   errors.push(`Unexpected API ${req.method()} ${url.pathname}`);return reply({error:'unexpected'},500);
  });
  const page=await context.newPage();activePage=page;page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(origin);await page.waitForFunction(()=>window.uploadMounted);
  const button=page.locator('[data-act="upload"]'),consent=page.locator('[data-ref="fake"]');
  const add=name=>page.locator('[data-ref="file"]').setInputFiles({name,mimeType:'audio/wav',buffer:wav});
  await add('fake-first.wav');assert.equal(await button.isDisabled(),true);assert.equal(requests.length,0);
  await consent.check();await consent.uncheck();assert.equal(await button.isDisabled(),true);assert.equal(requests.length,0);
  await consent.check();await page.locator('[data-ref="caller"]').fill('010-0000-0000');await button.click();
  await page.locator('.upload-row.is-done').waitFor();assert.match(await page.locator('.upload-row').first().innerText(),/받아쓰기 기다리는 중/);
  assert.equal(await page.getByText('카드 열기 ›',{exact:true}).count(),0,'upload success is not transcription completion');
  await page.clock.fastForward(10001);await page.getByText('카드 열기 ›',{exact:true}).waitFor();assert.ok(polls>0);
  await add('fake-duplicate.wav');await button.click();await page.locator('.upload-row.is-duplicate').waitFor();assert.match(await page.locator('.upload-row.is-duplicate').innerText(),/이미 올린 파일/);
  await add('fake-retry.wav');await button.click();await page.locator('.upload-row.is-error').waitFor();assert.match(await page.locator('.upload-row.is-error').innerText(),/가짜 전송 실패/);
  await page.locator('[data-act="retry"]').click();assert.equal(attempt,3,'retry preparation must not send automatically');
  await consent.uncheck();assert.equal(await button.isDisabled(),true);await consent.check();await button.click();
  await page.waitForFunction(()=>document.querySelectorAll('.upload-row.is-done').length===2);
  assert.equal(requests.length,4);assert.deepEqual(requests.map(r=>r.name),['fake-first.wav','fake-duplicate.wav','fake-retry.wav','fake-retry.wav']);
  for(const r of requests){assert.equal(r.workspace,workspace);assert.equal(r.fake,demo?'yes':null);assert.equal(r.consent,demo?null:'yes');assert.equal(r.caller,'010-0000-0000');assert.ok(Number.isFinite(Date.parse(r.when)));assert.deepEqual(r.bytes,wav);}
  await page.evaluate(()=>window.disposeUpload());await context.close();results.push({mode:demo?'demo':'private',uploads:requests.length,status:'passed'});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 const report=JSON.stringify({scope:'real upload UI + mocked API; no backend ingestion/transcription or authentication verified',results,errors,blocked},null,2);
 await mkdir(artifacts,{recursive:true});await writeFile(path.join(artifacts,'report.json'),report+'\n');console.log(report);
}catch(error){
 await mkdir(artifacts,{recursive:true});
 if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});
 await writeFile(path.join(artifacts,'report.json'),JSON.stringify({scope:'UI to mocked API only',status:'failed',message:error.message,results,errors,blocked},null,2)+'\n');throw error;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
