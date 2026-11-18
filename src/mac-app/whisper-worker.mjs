// 로컬 서버가 발급한 일회성 작업공간 권한으로만 앱 전용 CPU 일꾼을 관리한다.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,timingSafeEqual} from 'node:crypto';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {verifyRuntime,install,RUNTIME_NAME} from './install-whisper-runtime.mjs';
import {inspect as inspectModel,MODEL} from './setup-whisper-model.mjs';
export const SERVER='http://127.0.0.1:5601';
const NAME='ahmatda-local-mac';
async function checkedDirectory(dir,{create=false}={}){const p=path.dirname(dir);if(p!==dir)await checkedDirectory(p,{create});if(create)try{await fs.mkdir(dir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_directory');}
export async function readCredential(root,capability,{now=Date.now()}={}){
 if(!/^[a-f0-9]{64}$/.test(capability||''))throw Error('invalid_capability');
 const data=path.join(root,'data');await checkedDirectory(data);
 const file=path.join(data,'local-worker.json');
 const h=await fs.open(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const s=await h.stat();if(!s.isFile()||s.size>4096||(s.mode&0o777)!==0o600||(typeof process.getuid==='function'&&s.uid!==process.getuid()))throw Error('private_credentials_required');
  let c;try{c=JSON.parse(await h.readFile('utf8'));}catch{throw Error('invalid_credentials');}
  const expires=typeof c.expiresAt==='number'?c.expiresAt:Date.parse(c.expiresAt);
  if(c.version!==1||c.server!==SERVER||!/^ws_[a-z0-9]{19}$/.test(c.workspaceId||'')||!/^ah_local_worker_[A-Za-z0-9_-]{43}$/.test(c.token||'')||!Number.isFinite(expires)||expires<=now||!/[a-f0-9]{64}/.test(c.capabilityHash||'')||c.capabilityHash.length!==64)throw Error('invalid_or_expired_credentials');
  const hash=createHash('sha256').update(capability).digest();if(!timingSafeEqual(hash,Buffer.from(c.capabilityHash,'hex')))throw Error('capability_mismatch');
  return {...c,expiresAt:expires};
 }finally{await h.close();}
}
export function authorizationMatches(value,credentials){return value?.authorized===true&&typeof value.workspaceId==='string'&&value.workspaceId===credentials.workspaceId;}
export function checkAuthorization(credentials,{signal}={}){return new Promise(resolve=>{
 // Node http는 프록시·리다이렉트를 사용하지 않는다. 토큰은 이 loopback 요청에만 넣는다.
 const req=http.request({hostname:'127.0.0.1',port:5601,path:'/api/worker/authorization',method:'GET',agent:false,signal,headers:{authorization:`Bearer ${credentials.token}`}},res=>{
  let body='',bytes=0;res.on('data',chunk=>{bytes+=chunk.length;if(bytes>4096){res.destroy();resolve(false);}else body+=chunk;});res.on('end',()=>{try{resolve(res.statusCode===200&&authorizationMatches(JSON.parse(body),credentials));}catch{resolve(false);}});res.on('error',()=>resolve(false));
 });req.setTimeout(1500,()=>req.destroy());req.on('error',()=>resolve(false));req.end();
});}
export async function ensureAssets(root,bundleRoot,{signal}={}){
 // 파일이 없는 동안에는 대용량 해시를 반복하지 않는다. 다음 poll에서 새 파일을 발견한다.
 for(const item of MODEL.files){let s;try{s=await fs.lstat(path.join(root,'whisper-small',item.name));}catch{throw Error('model_not_prepared');}if(!s.isFile()||s.isSymbolicLink()||s.size!==item.size)throw Error('model_not_prepared');}
 const local=path.join(root,'runtime',RUNTIME_NAME);
 try{await verifyRuntime(local,{signal});}catch(e){if(signal?.aborted)throw e;try{await install(path.join(bundleRoot,'runtime',RUNTIME_NAME),root,{signal});}catch(e){if(signal?.aborted)throw e;throw Error('runtime_not_prepared');}}
 const state=await inspectModel(root,{signal});if(!state.modelVerified)throw Error('model_integrity_failed');
 const agent=path.join(bundleRoot,'pc-agent/callnote_agent.py');const s=await fs.lstat(agent);if(!s.isFile()||s.isSymbolicLink())throw Error('agent_missing');
 return {python:path.join(local,'python/bin/python3.12'),agent,model:path.join(root,'whisper-small')};
}
export function workerCommand(root,assets,credential,secrets){return {
 executable:assets.python,args:['-I','-B',assets.agent,'worker','--server',SERVER,'--model',assets.model,'--device','cpu','--name',NAME],
 options:{cwd:root,env:{PATH:'/usr/bin:/bin',HOME:root,LANG:'en_US.UTF-8',WORKER_TOKEN:credential.token,SERVER_URL:SERVER,CALLNOTE_SECRETS_DIR:secrets,CALLNOTE_AGENT_HOME:path.join(root,'worker'),HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',OMP_NUM_THREADS:'4'},stdio:['ignore','ignore','ignore']},
};}
export async function stopOwnedChild(child,{graceMs=2500,killMs=1000}={}){
 if(!child||child.exitCode!==null||child.signalCode)return;
 let exited=false;const done=new Promise(resolve=>{child.once('close',()=>{exited=true;resolve();});});
 child.kill('SIGINT');await Promise.race([done,delay(graceMs)]);
 if(!exited){child.kill('SIGTERM');await Promise.race([done,delay(killMs)]);}
 if(!exited){child.kill('SIGKILL');await Promise.race([done,delay(killMs)]);}
}
export async function supervisor({root,bundleRoot,capability,signal,emit=()=>{},pollMs=2000,
 read=readCredential,authorize=checkAuthorization,assets=ensureAssets,spawnChild=spawn,now=Date.now}={}){
 if(!root||!bundleRoot||!/^[a-f0-9]{64}$/.test(capability||''))throw Error('supervisor_configuration_required');
 root=path.resolve(root);bundleRoot=path.resolve(bundleRoot);await checkedDirectory(root,{create:true});
 const rootStat=await fs.stat(root);if((rootStat.mode&0o077)||(typeof process.getuid==='function'&&rootStat.uid!==process.getuid()))throw Error('private_storage_permissions_required');
 const secrets=await fs.mkdtemp(path.join(root,'.worker-secrets-'));await fs.chmod(secrets,0o700);
 let child=null,key=null,lastEvent=null,nextAssetCheck=0;
 const report=code=>{if(code!==lastEvent){lastEvent=code;const reason=['model_not_prepared','model_integrity_failed'].includes(code)?'model_missing':code==='runtime_not_prepared'?'runtime_missing':code==='authorization_unavailable'?'authorization_failed':'connection_missing';emit({event:code==='worker_started'?'running':code==='worker_start_failed'?'error':'waiting',...(code==='worker_started'?{}:{reason}),code,transcriptionVerified:false});}};
 const stop=async()=>{const owned=child;child=null;key=null;await stopOwnedChild(owned);};
 try{
  while(!signal?.aborted){
   try{
    const c=await read(root,capability,{now:now()});
    const fingerprint=createHash('sha256').update(JSON.stringify([c.workspaceId,c.token,c.expiresAt,c.capabilityHash])).digest('hex');
    if(child&&key!==fingerprint)await stop();
    if(!await authorize(c,{signal})){await stop();report('authorization_unavailable');}
    else if(!child&&now()>=nextAssetCheck){
     let prepared;try{prepared=await assets(root,bundleRoot,{signal});nextAssetCheck=0;}catch(e){if(e.message!=='model_not_prepared')nextAssetCheck=now()+15000;throw e;}
     // 모델/실행기 검사 중 파일이 회수·회전될 수 있으므로 기동 직전 다시 확인한다.
     const fresh=await read(root,capability,{now:now()});
     const freshKey=createHash('sha256').update(JSON.stringify([fresh.workspaceId,fresh.token,fresh.expiresAt,fresh.capabilityHash])).digest('hex');
     if(freshKey!==fingerprint||!await authorize(fresh,{signal}))throw Error('authorization_changed');
     signal?.throwIfAborted();const command=workerCommand(root,prepared,fresh,secrets);
     emit({event:'starting',code:'worker_starting',transcriptionVerified:false});
     const owned=spawnChild(command.executable,command.args,command.options);child=owned;key=fingerprint;
     owned.once('error',()=>{if(child===owned){child=null;key=null;nextAssetCheck=now()+15000;report('worker_start_failed');}});
     owned.once('close',()=>{if(child===owned){child=null;key=null;nextAssetCheck=now()+15000;report('worker_stopped');}});
     owned.once('spawn',()=>{if(child===owned)report('worker_started');});
    }
   }catch(e){await stop();if(signal?.aborted)break;report(['model_not_prepared','model_integrity_failed','runtime_not_prepared'].includes(e.message)?e.message:'local_worker_not_ready');}
   try{await delay(pollMs,undefined,{signal});}catch{break;}
  }
 }finally{await stop();await fs.rm(secrets,{recursive:true,force:true});emit({event:'stopped',code:'supervisor_stopped',transcriptionVerified:false});}
}
async function main(){if(process.argv.length!==3||!['--start','--supervise'].includes(process.argv[2]))throw Error('usage: --start');const c=new AbortController();process.once('SIGINT',()=>c.abort());process.once('SIGTERM',()=>c.abort());process.stdin.once('end',()=>c.abort());process.stdin.once('error',()=>c.abort());process.stdin.resume();try{await supervisor({root:path.join(homedir(),'Library/Application Support/Ahmatda'),bundleRoot:path.dirname(fileURLToPath(import.meta.url)),capability:process.env.AHMATDA_LOCAL_WORKER_CAPABILITY,signal:c.signal,emit:e=>process.stdout.write(JSON.stringify(e)+'\n')});}finally{process.stdin.pause();process.stdin.destroy();}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{process.stdout.write(JSON.stringify({event:'error',code:'worker_supervisor_failed'})+'\n');process.exitCode=1;});
