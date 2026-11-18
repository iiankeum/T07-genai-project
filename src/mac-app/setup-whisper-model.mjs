import {resolveStorageRoot} from './whisper-runtime-profile.mjs';
// 개발용 Whisper 가중치 준비. Python 설치·실행·음성 전송·추론은 하지 않는다.
import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import https from 'node:https';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
export const MODEL=Object.freeze({name:'faster-whisper-small',license:'MIT',revision:'536b0662742c02347bc0e980a01041f333bce120',source:'https://huggingface.co/Systran/faster-whisper-small',files:[
 {name:'config.json',size:2370,sha256:'b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828'},
 {name:'tokenizer.json',size:2203239,sha256:'fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab'},
 {name:'vocabulary.txt',size:459861,sha256:'34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913'},
 {name:'model.bin',size:483546902,sha256:'3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671'},
]});
async function directory(dir){const parent=path.dirname(dir);if(parent!==dir)await directory(parent);try{await fs.mkdir(dir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_path');}
export async function verifyFile(file,item,signal){signal?.throwIfAborted();let s;try{s=await fs.lstat(file);}catch(e){if(e.code==='ENOENT')return false;throw e;}if(!s.isFile()||s.isSymbolicLink()||s.size!==item.size)return false;const hash=createHash('sha256');for await(const c of createReadStream(file,{signal}))hash.update(c);return hash.digest('hex')===item.sha256;}
export function approvedURL(value,item,redirect=false,model=MODEL){
 const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash)return false;
 const initial=`/Systran/faster-whisper-small/resolve/${model.revision}/${item.name}`;
 if(u.hostname==='huggingface.co')return u.pathname===initial || (redirect&&u.pathname===`/api/resolve-cache/models/Systran/faster-whisper-small/${model.revision}/${item.name}`);
 // 공식 model.bin의 302 응답에서 확인한 정확한 Xet 객체 경로. 다른 모델·CDN은 거절한다.
 return redirect&&item.name==='model.bin'&&u.hostname==='us.aws.cdn.hf.co'&&u.pathname==='/xet-bridge-us/655f212f4f2c90ed74120fdd/429ffc84492c1122da005d7274fc397bf142fe12066eb7e4612dc25c579db2ea';
}
export function download(url,target,item,{signal,onProgress=()=>{},redirects=0}={}){
 return new Promise((resolve,reject)=>{
  if(!approvedURL(url,item,redirects>0))return reject(Error('unapproved_source'));
  const request=https.get(url,{signal,agent:false,headers:{'user-agent':'Ahmatda-whisper-preparer/1'}},response=>{
   if([301,302,303,307,308].includes(response.statusCode)){
    const location=response.headers.location;response.destroy();if(!location||redirects>=3)return reject(Error('redirect_limit'));
    let next;try{next=new URL(location,url).href;}catch{return reject(Error('unapproved_redirect'));}
    if(!approvedURL(next,item,true))return reject(Error('unapproved_redirect'));
    download(next,target,item,{signal,onProgress,redirects:redirects+1}).then(resolve,reject);return;
   }
   if(response.statusCode!==200){response.destroy();return reject(Error('download_http_'+response.statusCode));}
   if(response.headers['content-length']!==undefined&&Number(response.headers['content-length'])!==item.size){response.destroy();return reject(Error('size_mismatch'));}
   let bytes=0,last=0;const limit=new Transform({transform(chunk,enc,done){bytes+=chunk.length;if(bytes>item.size)return done(Error('size_limit'));if(Date.now()-last>250){last=Date.now();onProgress(bytes);}done(null,chunk);}});
   pipeline(response,limit,createWriteStream(target,{flags:'wx',mode:0o600}),{signal}).then(()=>{if(bytes!==item.size)throw Error('size_mismatch');onProgress(bytes);resolve();}).catch(reject);
  });request.setTimeout(30_000,()=>request.destroy(Error('download_timeout')));request.on('error',reject);
 });
}
export async function inspect(root,{model=MODEL,signal}={}){
 const files=[];for(const item of model.files)files.push(await verifyFile(path.join(root,'whisper-small',item.name),item,signal));
 let runtimePresent=false;try{await fs.access(path.join(root,'whisper-venv/bin/python'));runtimePresent=true;}catch{}
 return {event:'status',model:model.name,license:model.license,revision:model.revision,source:model.source,downloadBytes:model.files.reduce((s,x)=>s+x.size,0),modelVerified:files.every(Boolean),filesVerified:files.filter(Boolean).length,totalFiles:files.length,runtimePresent,runtimeVerified:false,inferenceVerified:false,automaticRuntimeInstall:false,automaticServerStart:false,cloudEnabled:false};
}
export async function prepare(root,{model=MODEL,signal,emit=()=>{},transfer=download}={}){
 root=path.resolve(root);await directory(root);const lock=path.join(root,'.whisper-prepare.lock');let owned=false,stage;
 try{
  try{await fs.mkdir(lock,{mode:0o700});owned=true;}catch(e){if(e.code==='EEXIST')throw Error('preparation_busy_or_interrupted_lock');throw e;}
  const state=await inspect(root,{model,signal});emit(state);if(state.modelVerified){emit({event:'ready',model:model.name,inferenceVerified:false});return;}
  const dest=path.join(root,'whisper-small');
  try{await fs.lstat(dest);throw Error('existing_incomplete_model_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
  const disk=await fs.statfs(root);if(disk.bavail*disk.bsize<state.downloadBytes+64*1024*1024)throw Error('insufficient_disk_space');
  stage=await fs.mkdtemp(path.join(root,'.whisper-stage-'));emit({event:'preparing',model:model.name,downloadBytes:state.downloadBytes,source:model.source,license:model.license});
  for(const item of model.files){signal?.throwIfAborted();const file=path.join(stage,item.name);await transfer(`${model.source}/resolve/${model.revision}/${item.name}`,file,item,{signal,onProgress:completed=>emit({event:'progress',file:item.name,completed,total:item.size})});if(!await verifyFile(file,item,signal))throw Error('checksum_mismatch');}
  await fs.writeFile(path.join(stage,'ahmatda-manifest.json'),JSON.stringify(model,null,2),{flag:'wx',mode:0o600});signal?.throwIfAborted();
  // 다른 설치기의 파일이 생겼으면 덮어쓰지 않는다. 비어 있는 디렉터리도 보존한다.
  try{await fs.lstat(dest);throw Error('destination_created_during_prepare');}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.rename(stage,dest);stage=null;emit({event:'ready',model:model.name,inferenceVerified:false});
 }finally{if(stage)await fs.rm(stage,{recursive:true,force:true});if(owned)await fs.rmdir(lock);}
}
async function main(){const args=process.argv.slice(2);if(args.length>1||(args.length&&!['--status','--prepare'].includes(args[0])))throw Error('usage: --status | --prepare');const root=await resolveStorageRoot(path.dirname(fileURLToPath(import.meta.url)));const c=new AbortController();process.once('SIGINT',()=>c.abort());process.once('SIGTERM',()=>c.abort());const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');if(args[0]==='--prepare')await prepare(root,{signal:c.signal,emit});else emit(await inspect(root,{signal:c.signal}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{process.stdout.write(JSON.stringify({event:'error',code:error.name==='AbortError'?'cancelled':error.message})+'\n');process.exitCode=1;});
