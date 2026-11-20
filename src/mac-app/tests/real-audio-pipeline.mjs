import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mkdtempSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
// 명시적으로 실행하는 실모델 통합 시험. 실제 고객 녹음은 읽지 않고 합성음성을 만든다.
if (!process.argv.includes('--run-real-local-model')) throw new Error('--run-real-local-model로 명시적으로 실행하세요.');
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const artifacts=path.join(repo,'src/app/artifacts/real-local-audio');
await fs.mkdir(artifacts,{recursive:true});
const root=mkdtempSync('/tmp/ahmatda-real-http-');
Object.assign(process.env,{DATA_DIR:root,DEMO_MODE:'1',AI_PROVIDER:'ollama',OLLAMA_MODEL:'qwen3:4b',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',WORKER_TOKEN:'fake-local-pipeline-worker',FFMPEG_PATH:'unavailable-in-this-test'});
delete process.env.PUBLIC_BASE_URL;
const {startServer,sleep}=await import(repo+'/src/app/test/fixtures/worker-helpers.mjs');
const routes=await Promise.all(['system','upload','worker','calls'].map(name=>import(repo+'/src/app/routes/'+name+'.mjs')));
const server=await startServer(routes); let out; let browser;
async function post(url,body){const r=await fetch(server.base+url,{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer fake-local-pipeline-worker'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}
try {
 const synthetic=path.join(root,'synthetic-fake.wav');
 const speech=spawnSync('/usr/bin/say',['-v','Yuna','-o',synthetic,'--file-format=WAVE','--data-format=LEI16@16000','앞 브레이크 패드 한 세트와 앞 디스크 두 개 부탁합니다.'],{timeout:30000,encoding:'utf8'});
 assert.equal(speech.status,0,'macOS Yuna 합성 음성이 필요합니다. '+speech.stderr);
 const wav=await fs.readFile(synthetic);const form=new FormData();form.set('fakeConfirm','yes');form.set('file',new Blob([wav],{type:'audio/wav'}),'synthetic-fake.wav');
 const uploaded=await fetch(server.base+'/api/calls/upload',{method:'POST',body:form});const queued=await uploaded.json();assert.equal(uploaded.status,201,JSON.stringify(queued));
 const lease=await post('/api/worker/claim',{worker:'real-local-fake-test'});assert.equal(lease.callId,queued.callId);
 const audioRes=await fetch(lease.audioUrl,{headers:{Authorization:'Bearer fake-local-pipeline-worker'}});assert.equal(audioRes.status,200);const downloaded=Buffer.from(await audioRes.arrayBuffer());assert.equal(createHash('sha256').update(downloaded).digest('hex'),lease.audioSha256);
 const audioPath=path.join(root,'worker-input.wav');await fs.writeFile(audioPath,downloaded);
 const py=`import sys,json\nsys.path.insert(0,${JSON.stringify(repo+'/src/pc-agent')})\nfrom callnote_agent import WhisperTranscriber,read_wav_16k_mono\nfrom pathlib import Path\nt=WhisperTranscriber(str(Path.home()/'Library/Application Support/Ahmatda/whisper-small'),device='cpu')\nr=t.transcribe(read_wav_16k_mono(Path(sys.argv[1]).read_bytes()),None,'ko')\nPath(sys.argv[2]).write_text(json.dumps(r,ensure_ascii=False))\n`;
 await fs.writeFile(path.join(root,'transcribe.py'),py);
 const proc=spawnSync(path.join(os.homedir(),'Library/Application Support/Ahmatda/whisper-venv/bin/python'),[path.join(root,'transcribe.py'),audioPath,path.join(root,'stt.json')],{env:{...process.env,HF_HUB_OFFLINE:'1'},encoding:'utf8',timeout:60000});assert.equal(proc.status,0,proc.stderr);
 const stt=JSON.parse(await fs.readFile(path.join(root,'stt.json'),'utf8'));
 await post('/api/worker/jobs/'+lease.jobId+'/result',{worker:'real-local-fake-test',...stt,engine:'faster-whisper-small-real-local'});
 let call;for(let i=0;i<120;i++){call=await(await fetch(server.base+'/api/calls/'+queued.callId)).json();if(['ready','failed'].includes(call.status))break;await sleep(500);}
 out={at:new Date().toISOString(),syntheticInput:true,realModels:true,scope:'HTTP upload, queue lease, audio download, real Whisper, result API, real card extraction and SQLite readback',stt,call,limits:['합성음성 한 건. 실전화/잡음/사투리 정확도 보장 아님','단일 임시 데모 공간. 실제 사용자 가입/전체 워커 프로세스 관리 검증 아님','네트워크 자체를 끈 오프라인 시험 아님']};
 await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify(out,null,2));

 assert.equal(call.status,'ready'); assert.equal(call.card.customer,null); assert.equal(call.card.carModel,null); assert.ok(!call.summary.includes('우리공업사')); assert.ok(!call.summary.includes('아반떼'));  assert.match(call.card.aiModel,/qwen3/);assert.equal(call.card.items.length,2);
 assert.ok(call.card.items.some(x=>x.part.includes('패드')&&x.qty===1));assert.ok(call.card.items.some(x=>x.part.includes('디스크')&&x.qty===2));
 const require=createRequire(path.join(repo,'src/app/package.json'));
 const {chromium}=require('playwright');
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage();
 await page.goto(server.base+'/#/calls/'+queued.callId);
 await page.getByText('앞 브레이크 패드 한 세트와 앞 디스크 두 개 부탁합니다.',{exact:true}).first().waitFor();
 await page.screenshot({path:path.join(artifacts,'real-audio-fake-input.png')});
 out.browserRendered=true;
 await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify(out,null,2));
 console.log(JSON.stringify({status:'passed',realModels:true,browserRendered:true,callStatus:call.status,customer:call.card.customer,carModel:call.card.carModel,items:call.card.items.map(({part,qty})=>({part,qty})),warningCount:call.card.unsure.length},null,2));
} finally {await browser?.close();await server.close();await fs.rm(root,{recursive:true,force:true});}

