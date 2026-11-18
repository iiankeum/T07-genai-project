// 가짜 카드만 사용하는 UI→mock API 회귀. 실제 로그인·서버 저장·외부 요청·유료 AI 없음.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url));
const artifacts=path.resolve(process.env.CARD_RECOVERY_OUTPUT_DIR||fileURLToPath(new URL('../artifacts/e2e/card-recovery/',import.meta.url)));
const harness=`<!doctype html><meta charset="utf-8"><div id="app"></div><script type="module">
import {mountCard} from '/js/pages/call-card.js';import {api,getMeta} from '/js/api.js';
window.expired=[];window.addEventListener('ahmatda:session-expired',e=>window.expired.push(e.detail));
const meta=await getMeta(),call=await api.get('/api/calls/fake-card');
window.cardUI=mountCard(document.querySelector('#app'),{callId:'fake-card',call,meta,hasAudio:false,resolve:()=>null,onEvidence:()=>{},onCardChange:()=>{},onCallReplaced:()=>{},onJumpToTranscript:()=>{}});window.mounted=true;
</script>`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(harness);return;}if(!/^\/js\/[A-Za-z0-9_/-]+\.js$/.test(u.pathname)||u.pathname.includes('..')){res.writeHead(404).end();return;}res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile(path.join(root,u.pathname)));}catch{res.writeHead(404).end();}});
const makeCard=()=>({status:'draft',revision:1,customer:'가짜 거래처',carModel:'가짜 차종',callType:'주문',note:'서버 원본',items:[{id:'fake-item',part:'가짜 부품',qty:1,partNo:'FAKE-001'}],unsure:[],askBack:[]});
let browser,page,mode='offline',space='fake-a',user='fake-user-a',demo=false;const states={'fake-a':makeCard(),'fake-b':makeCard()},requests=[],errors=[],blocked=[],results=[];
const key=(s,u=user)=>'cn.card.pending:v2:'+[(demo?'demo':u),s,'fake-card'].map(encodeURIComponent).join(':');
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,env:{HOME:process.env.HOME,PATH:'/usr/bin:/bin:/usr/sbin:/sbin'},...(process.env.E2E_CHROMIUM_PATH?{executablePath:process.env.E2E_CHROMIUM_PATH}:{})});
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==origin){blocked.push(url.origin);return route.abort();}if(!url.pathname.startsWith('/api/'))return route.continue();const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 if(url.pathname==='/api/meta')return reply({demo,access:{demo,role:'admin',user:user?{id:user}:null,workspace:{id:space}},aiEnabled:false});
 if(url.pathname==='/api/calls/fake-card')return reply({id:'fake-card',status:'ready',card:states[space]});
 if(url.pathname==='/api/cards/fake-card'&&req.method()==='PATCH'){
  const body=req.postDataJSON(),workspace=req.headers()['x-ahmatda-workspace'];requests.push({mode,workspace,body});
  if(mode==='offline')return route.abort('internetdisconnected');
  if(mode==='expired')return reply({error:'unauthorized',message:'가짜 세션 만료'},401);
  if(workspace!==space)return reply({error:'workspace_changed',message:'가짜 작업공간 변경'},409);
  if(body.expectedRevision!==states[space].revision)return reply({error:'card_conflict',message:'가짜 동시 수정'},409);
  const {expectedRevision,...patch}=body;states[space]={...states[space],...patch,revision:expectedRevision+1};return reply({card:states[space]});
 }
 errors.push(`Unexpected API ${req.method()} ${url.pathname}`);return reply({error:'unexpected'},500);
 });
 page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());await page.clock.install();
 const load=async()=>{await page.goto(origin+'/#/calls/fake-card');await page.waitForFunction(()=>window.mounted);};
 const note=()=>page.locator('[data-field="note"]');
 const pending=()=>page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)||'null'),key(space));
 await load();await note().fill('가짜 오프라인 변경');await page.clock.fastForward(1001);await page.locator('[data-act="retry-save"]').waitFor();
 assert.equal((await pending()).patch.note,'가짜 오프라인 변경');assert.equal(states[space].note,'서버 원본');assert.equal(await note().inputValue(),'가짜 오프라인 변경');
 mode='ok';await page.locator('[data-act="retry-save"]').click();await page.waitForFunction(k=>sessionStorage.getItem(k)===null,key(space));assert.equal(states[space].note,'가짜 오프라인 변경');results.push('network failure keeps input; manual retry saves and clears pending');
 mode='offline';await note().fill('가짜 새로고침 복원');await page.clock.fastForward(1001);await page.locator('[data-act="retry-save"]').waitFor();const revision=states[space].revision;
 await page.reload();await page.waitForFunction(()=>window.mounted);assert.equal(await note().inputValue(),'가짜 새로고침 복원');assert.equal((await pending()).revision,revision);
 mode='ok';await page.clock.fastForward(1001);await page.waitForFunction(k=>sessionStorage.getItem(k)===null,key(space));assert.equal(states[space].note,'가짜 새로고침 복원');results.push('reload restores pending patch and original expectedRevision');
 mode='expired';await note().fill('가짜 로그인 후 복원');await page.clock.fastForward(1001);await page.waitForFunction(()=>window.expired.length>0);assert.equal((await pending()).patch.note,'가짜 로그인 후 복원');
 const count=requests.length;await page.clock.fastForward(30000);assert.equal(requests.length,count,'401 must not schedule network retry');
 mode='ok';await page.reload();await page.waitForFunction(()=>window.mounted);assert.equal(await note().inputValue(),'가짜 로그인 후 복원');await page.clock.fastForward(1001);await page.waitForFunction(k=>sessionStorage.getItem(k)===null,key(space));results.push('401 emits session-expired and keeps pending; simulated authenticated remount restores');
 mode='offline';await note().fill('A 공간에만 남길 변경');await page.clock.fastForward(1001);await page.locator('[data-act="retry-save"]').waitFor();
 space='fake-b';await page.reload();await page.waitForFunction(()=>window.mounted);assert.equal(await note().inputValue(),'서버 원본');assert.equal(await pending(),null);assert.equal(await page.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).patch.note,key('fake-a')),'A 공간에만 남길 변경');
 mode='ok';await note().fill('B 공간 변경');await page.clock.fastForward(1001);await page.waitForFunction(k=>sessionStorage.getItem(k)===null,key(space));assert.equal(states['fake-b'].note,'B 공간 변경');assert.notEqual(states['fake-a'].note,'B 공간 변경');
 space='fake-a';await page.reload();await page.waitForFunction(()=>window.mounted);assert.equal(await note().inputValue(),'A 공간에만 남길 변경');await page.clock.fastForward(1001);await page.waitForFunction(k=>sessionStorage.getItem(k)===null,key(space));results.push('same-tab workspace switch never restores or submits another workspace pending patch');
 mode='expired';await note().fill('A 계정 비공개 임시입력');await page.clock.fastForward(1001);await page.waitForFunction(()=>window.expired.length>0);
 user='fake-user-b';mode='ok';await page.reload();await page.waitForFunction(()=>window.mounted);
 assert.notEqual(await note().inputValue(),'A 계정 비공개 임시입력','another user in the same workspace must not restore first user pending text');
 assert.ok(await page.evaluate(k=>sessionStorage.getItem(k),key(space,'fake-user-a')),'A pending remains available to A');
 const beforeOther=requests.length;await page.clock.fastForward(1001);assert.equal(requests.length,beforeOther);
 user='fake-user-a';await page.reload();await page.waitForFunction(()=>window.mounted);assert.equal(await note().inputValue(),'A 계정 비공개 임시입력');await page.clock.fastForward(1001);await page.waitForFunction(k=>sessionStorage.getItem(k)===null,key(space));
 results.push('same workspace different user cannot restore or auto-save another account pending; original user can recover');
 const legacy='cn.card.pending:'+space+':fake-card';await page.evaluate(k=>sessionStorage.setItem(k,JSON.stringify({revision:1,patch:{note:'작성자 불명 legacy'}})),legacy);
 await page.reload();await page.waitForFunction(()=>window.mounted);assert.notEqual(await note().inputValue(),'작성자 불명 legacy');assert.ok(await page.evaluate(k=>sessionStorage.getItem(k),legacy));results.push('unscoped legacy pending is preserved but never restored');
 user=null;mode='offline';await page.reload();await page.waitForFunction(()=>window.mounted);const beforeStorage=await page.evaluate(()=>JSON.stringify({...sessionStorage}));await note().fill('신원없는 메모리입력');await page.clock.fastForward(1001);await page.locator('[data-act="retry-save"]').waitFor();assert.equal(await page.evaluate(()=>JSON.stringify({...sessionStorage})),beforeStorage);await page.reload();await page.waitForFunction(()=>window.mounted);assert.notEqual(await note().inputValue(),'신원없는 메모리입력');results.push('private unidentified user retains only memory, not persisted restoration');
 demo=true;space='demo';states.demo=makeCard();await page.reload();await page.waitForFunction(()=>window.mounted);await note().fill('가짜 데모 복원');await page.clock.fastForward(1001);await page.locator('[data-act="retry-save"]').waitFor();await page.reload();await page.waitForFunction(()=>window.mounted);assert.equal(await note().inputValue(),'가짜 데모 복원');mode='ok';await page.clock.fastForward(1001);await page.waitForFunction(k=>sessionStorage.getItem(k)===null,key(space));results.push('explicit demo still restores its own pending draft');
 assert.ok(requests.every(r=>['fake-a','fake-b','demo'].includes(r.workspace)&&Number.isSafeInteger(r.body.expectedRevision)));assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 const report={scope:'actual mountCard/api.js + mock API; real app login routing, authentication and backend persistence NOT verified',status:'passed',results,requests:requests.length,errors,blocked};await mkdir(artifacts,{recursive:true});await writeFile(path.join(artifacts,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){await mkdir(artifacts,{recursive:true});if(page&&!page.isClosed())await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(path.join(artifacts,'report.json'),JSON.stringify({status:'failed',message:error.message,results,errors,blocked},null,2));throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
