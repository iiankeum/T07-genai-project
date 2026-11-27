// 가짜 계정·합성음성만 사용하는 명시적 실모델 시험. 사용자 자료를 읽거나 기존 공간을 연결하지 않는다.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
if(!process.argv.includes('--run-real-local-model')) throw Error('explicit --run-real-local-model required');
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'ahmatda-managed-fake-'));
const support=path.join(os.homedir(),'Library/Application Support/Ahmatda');
const capability=randomBytes(32).toString('hex');
const controller=new AbortController();let server,worker,browser;
const soakArg=process.argv.find(a=>a.startsWith('--soak-seconds='));const soakSeconds=soakArg?Number(soakArg.split('=')[1]):0;
if(!Number.isInteger(soakSeconds)||soakSeconds<0||soakSeconds>600)throw Error('soak duration must be 0..600 seconds');
let heartbeatChecks=0;const events=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try {
 await fs.mkdir(path.join(root,'data'),{mode:0o700});
 const {copyVerifiedRuntime,RUNTIME_NAME}=await import('../install-whisper-runtime.mjs');
 await fs.mkdir(path.join(root,'runtime'),{mode:0o700});
 await copyVerifiedRuntime(path.join(support,'runtime',RUNTIME_NAME),path.join(root,'runtime',RUNTIME_NAME),{privateFiles:true});
 await fs.cp(path.join(support,'whisper-small'),path.join(root,'whisper-small'),{recursive:true,errorOnExist:true});
 Object.assign(process.env,{DATA_DIR:path.join(root,'data'),DEMO_MODE:'0',AUTH_MAIL_MODE:'outbox',AI_PROVIDER:'fixture',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',HOST:'127.0.0.1',PORT:'5601',PUBLIC_BASE_URL:'http://127.0.0.1:5601',TRUST_PROXY:'0',AHMATDA_LOCAL_MAC:'1',AHMATDA_LOCAL_WORKER_CAPABILITY:capability,FFMPEG_PATH:'unavailable-in-this-test'});
 const {buildRouter,createApp}=await import(repo+'/src/app/server.mjs');
 const {router}=await buildRouter();server=http.createServer(createApp(router));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5601,'127.0.0.1',resolve);});
 const base='http://127.0.0.1:5601';let cookie,workspace;
 async function request(url,body,method='POST') {
  const headers={Origin:base,'content-type':'application/json'};if(cookie)headers.Cookie=cookie;if(workspace)headers['x-ahmatda-workspace']=workspace;
  const r=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();assert.equal(r.status,200,JSON.stringify({status:r.status,value}));return {r,value};
 }
 const email='managed-worker-fake@example.test',password='fake-local-test-942!';
 await request('/api/auth/signup',{email,password,name:'가짜 검증계정',agreeTerms:true,agreePrivacy:true});
 const mails=await fs.readdir(path.join(root,'data/outbox'));let token;
 for(const f of mails){const m=JSON.parse(await fs.readFile(path.join(root,'data/outbox',f),'utf8'));if(m.to===email&&m.kind==='verify')token=new URLSearchParams(new URL(m.url).hash.split('?')[1]).get('token');}
 assert.ok(token);await request('/api/auth/verify',{token,password});
 const logged=await request('/api/auth/login',{email,password});cookie=logged.r.headers.get('set-cookie').split(';')[0];
 workspace=(await request('/api/auth/workspaces',{name:'가짜 자동일꾼 검증'})).value.access.workspace.id;
 const {chromium}=createRequire(path.join(repo,'src/app/package.json'))('playwright');
 browser=await chromium.launch({headless:true});const context=await browser.newContext();
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const equals=cookie.indexOf('=');await context.addCookies([{name:cookie.slice(0,equals),value:cookie.slice(equals+1),url:base,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();await page.goto(base+'/#/settings/integrations');
 await page.locator('#local-worker-connect input[name=confirm]').check();await page.locator('#local-worker-connect button').click();
 await page.getByText('현재 작업공간이 연결돼 있어요.',{exact:true}).waitFor();
 const connected=(await request('/api/settings/integrations',undefined,'GET')).value.localWorker;assert.equal(connected.connected,true);assert.equal(connected.token,undefined);
 const {supervisor}=await import('../whisper-worker.mjs');
 worker=supervisor({root,bundleRoot:path.join(repo,'out/Ahmatda.app/Contents/Resources'),capability,signal:controller.signal,emit:e=>{events.push(e);console.log(JSON.stringify(e));}}).catch(e=>{if(!controller.signal.aborted)throw e;});
 const audio=path.join(root,'synthetic-fake.wav');
 const speech=spawnSync('/usr/bin/say',['-v','Yuna','-o',audio,'--file-format=WAVE','--data-format=LEI16@16000','앞 브레이크 패드 한 세트와 앞 디스크 두 개 부탁합니다.'],{encoding:'utf8',timeout:30000});assert.equal(speech.status,0,speech.stderr);
 const form=new FormData();form.set('fakeConfirm','yes');form.set('file',new Blob([await fs.readFile(audio)],{type:'audio/wav'}),'synthetic-fake.wav');
 const uploaded=await fetch(base+'/api/calls/upload',{method:'POST',headers:{Origin:base,Cookie:cookie,'x-ahmatda-workspace':workspace},body:form});const queued=await uploaded.json();assert.equal(uploaded.status,201,JSON.stringify(queued));
 let call;for(let i=0;i<180;i++){call=(await request('/api/calls/'+queued.callId,undefined,'GET')).value;if(call.transcript&&['ready','failed'].includes(call.status))break;await sleep(1000);}
 assert.equal(call.transcript,'앞 브레이크 패드 한 세트와 앞 디스크 두 개 부탁합니다.');assert.equal(call.status,'ready');
 const soakUntil=Date.now()+soakSeconds*1000;while(Date.now()<soakUntil){await sleep(Math.min(6000,soakUntil-Date.now()));const status=(await request('/api/worker/status',undefined,'GET')).value;assert.equal(status.online,true);heartbeatChecks++;}
 assert.equal(events.filter(e=>e.event==='running').length,1,'worker unexpectedly restarted');
 await page.locator('#local-worker-disconnect input[name=confirm]').check();await page.locator('#local-worker-disconnect button').click();
 await page.locator('#local-worker-disconnect').waitFor({state:'detached'});await sleep(3500);
 assert.equal((await request('/api/settings/integrations',undefined,'GET')).value.localWorker.connected,false);
 controller.abort();await worker;worker=null;
 assert.ok(events.some(e=>e.event==='running'));assert.equal(events.at(-1)?.event,'stopped');
 const result={at:new Date().toISOString(),syntheticInput:true,isolatedTemporaryWorkspace:true,realWhisperWorker:true,browserConnectDisconnect:true,soakSeconds,heartbeatChecks,cardProvider:'fixture (not real LLM)',status:call.status,transcript:call.transcript,events,disconnected:true,limits:['가짜 계정·합성음성 한 건','실제 사용자 네이티브 가입/약관 동의 검증 아님','새 Mac 전체 설치·현장 음성 품질·OS 네트워크 차단 검증 아님']};
 const output=path.join(repo,'src/app/artifacts/real-managed-worker.json');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,artifact:output}));
}finally{await browser?.close();controller.abort();await worker?.catch(()=>{});if(server)await new Promise(r=>{server.closeAllConnections();server.close(r);});await fs.rm(root,{recursive:true,force:true});}
