// 동일 Mac의 임시 폴더·빈 HOME에서 ZIP 구성요소를 시험한다. 실물 신규 Mac 검증은 아니다.
import {createHash} from 'node:crypto';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import net from 'node:net';import {spawn,spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
if(!process.argv.includes('--inspect-development-bundle'))throw Error('explicit --inspect-development-bundle required');
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'ahmatda-clean-package-'));let child;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function command(file,args,env){const r=spawnSync(file,args,{env,cwd:root,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stderr||r.error?.message);return r.stdout;}
try{
 const home=path.join(root,'empty-home');await fs.mkdir(home,{mode:0o700});
 const env={PATH:'/usr/bin:/bin',HOME:home,LANG:'en_US.UTF-8',HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'};
 command('/usr/bin/ditto',['-x','-k',path.join(repo,'out/Ahmatda-macos-arm64.zip'),root],env);
 const app=path.join(root,'Ahmatda.app'),resources=path.join(app,'Contents/Resources');
 command('/usr/bin/codesign',['--verify','--deep','--strict',app],env);
 const revision=(await fs.readFile(path.join(resources,'app/REVISION'),'utf8')).trim();
 const notices=JSON.parse(await fs.readFile(path.join(resources,'ThirdPartySupplemental/sources.json'),'utf8'));assert.equal(notices.sources.length,3);for(const item of notices.sources){assert.match(item.file,/^[a-z0-9.-]+-LICENSE$/);const data=await fs.readFile(path.join(resources,'ThirdPartySupplemental',item.file));assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);}
 const forbidden=[];let files=0;
 async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory()){if(['.data','.git','outbox'].includes(entry.name))forbidden.push(path.relative(app,p));await walk(p);}else if(entry.isFile()){files++;if(entry.name==='.env'||/\.sqlite(?:-shm|-wal)?$/.test(entry.name)||entry.name==='model.bin'||entry.name==='worker.env'||entry.name==='local-worker.capability')forbidden.push(path.relative(app,p));}}}
 await walk(app);assert.deepEqual(forbidden,[],'private data or model weights in package');
 const python=path.join(resources,'runtime/whisper-portable-3.12.16/python/bin/python3.12');
 const imported=command(python,['-I','-B','-c','import json,faster_whisper,ctranslate2,numpy;print(json.dumps({"whisper":faster_whisper.__version__,"ctranslate2":ctranslate2.__version__,"numpy":numpy.__version__}))'],env).trim();
 const ffmpeg=path.join(resources,'runtime/ffmpeg-audio-9.0.2/bin/ffmpeg'),ffprobe=path.join(resources,'runtime/ffmpeg-audio-9.0.2/bin/ffprobe');
 command(ffmpeg,['-version'],env);command(ffprobe,['-version'],env);
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 child=spawn(path.join(app,'Contents/MacOS/node'),[path.join(resources,'app/server.mjs')],{cwd:path.join(resources,'app'),env:{...env,HOST:'127.0.0.1',PORT:String(port),PUBLIC_BASE_URL:'http://127.0.0.1:'+port,DATA_DIR:path.join(home,'data'),DEMO_MODE:'0',AUTH_MAIL_MODE:'outbox',AI_PROVIDER:'off',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',TRUST_PROXY:'0',FFMPEG_PATH:ffmpeg,FFPROBE_PATH:ffprobe},stdio:['ignore','ignore','ignore']});
 let health;for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:'+port+'/healthz');if(r.ok){health=await r.json();break;}}catch{}if(child.exitCode!==null)throw Error('bundled server exited');await sleep(100);}
 assert.equal(health?.ok,true);
 const index=await fetch('http://127.0.0.1:'+port+'/');assert.equal(index.status,200);
 const fonts=(await fs.readdir(path.join(resources,'app/public/fonts'))).filter(f=>f.endsWith('.woff2'));assert.ok(fonts.length>0);const font=await fetch('http://127.0.0.1:'+port+'/fonts/'+fonts[0]);assert.equal(font.status,200);
 child.kill('SIGTERM');for(let i=0;i<50&&child.exitCode===null&&!child.signalCode;i++)await sleep(100);assert.ok(child.exitCode!==null||child.signalCode,'server failed to stop');child=null;
 const result={at:new Date().toISOString(),revision,sameMacTemporaryHome:true,systemPathOnly:true,bundledNodeHealth:true,bundledPythonImports:JSON.parse(imported),bundledAudioCommands:true,localFontServed:true,supplementalLicensesVerified:3,privateDataPatternsFound:forbidden,files,adHocIntegrityVerified:true,serverStopped:true,limits:['동일 Mac에서 ZIP을 새 임시폴더에 풀고 빈 HOME/PATH로 시험','실물 신규 Mac·Gatekeeper 허용·Developer ID/공증·사용자 가입 검증 아님','실모델 추론·OS 네트워크 차단·수일운영 시험 아님']};
 await fs.mkdir(path.join(repo,'src/app/artifacts'),{recursive:true});await fs.writeFile(path.join(repo,'src/app/artifacts/clean-package.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(child&&child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');await fs.rm(root,{recursive:true,force:true});}
