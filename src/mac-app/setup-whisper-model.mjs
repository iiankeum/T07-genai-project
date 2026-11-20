import {acquireModelLock} from './model-prepare-lock.mjs';
import {downloadHTTP,resumeHTTP,validatedPartial} from './model-range-download.mjs';
import {resolveStorageRoot} from './whisper-runtime-profile.mjs';
// 개발용 Whisper 가중치 준비. Python 설치·실행·음성 전송·추론은 하지 않는다.
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const MODEL=Object.freeze({name:'faster-whisper-small',license:'MIT',revision:'536b0662742c02347bc0e980a01041f333bce120',source:'https://huggingface.co/Systran/faster-whisper-small',files:[
 {name:'config.json',size:2370,sha256:'b55496ac7940a7ae47d2c01eab40edfd8701feec1229d9cce3b40014383fb828'},
 {name:'tokenizer.json',size:2203239,sha256:'fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab'},
 {name:'vocabulary.txt',size:459861,sha256:'34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913'},
 {name:'model.bin',size:483546902,sha256:'3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671'},
]});
const CACHE_ROOT='.whisper-verified-cache';
const CACHE_MANIFEST='manifest.json';
function manifest(model){
 if(!model||typeof model.name!=='string'||typeof model.license!=='string'||typeof model.source!=='string'||!/^https:\/\//.test(model.source)||!/^[a-f0-9]{40}$/.test(model.revision||'')||!Array.isArray(model.files)||!model.files.length)throw Error('invalid_model_manifest');
 const names=new Set();let total=0;
 for(const item of model.files){if(!item||!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(item.name||'')||['manifest.json','ahmatda-manifest.json'].includes(item.name)||names.has(item.name)||!Number.isSafeInteger(item.size)||item.size<1||!/^[a-f0-9]{64}$/.test(item.sha256||''))throw Error('invalid_model_manifest');names.add(item.name);total+=item.size;if(!Number.isSafeInteger(total)||!Number.isSafeInteger(total*2+64*1024*1024))throw Error('model_size_overflow');}
 return {name:model.name,license:model.license,revision:model.revision,source:model.source,files:model.files.map(({name,size,sha256})=>({name,size,sha256}))};
}
export function cacheKey(model=MODEL){return createHash('sha256').update(JSON.stringify(manifest(model))).digest('hex');}
export function cacheDirectory(root,model=MODEL){return path.join(root,CACHE_ROOT,cacheKey(model));}
async function checkedCache(root,model){
 const cache=cacheDirectory(root,model);await directory(cache);const file=path.join(cache,CACHE_MANIFEST),expected=JSON.stringify(manifest(model));
 // 완료파일 재사용의 경계를 manifest와 namespace 두 곳에서 확인한다.
 let handle;try{handle=await fs.open(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);}catch(e){if(e.code!=='ENOENT')throw Error('unsafe_cache_manifest');}
 if(handle){try{const stat=await handle.stat();if(!stat.isFile()||stat.size>65536||(await handle.readFile('utf8'))!==expected)throw Error('cache_manifest_mismatch');}finally{await handle.close();}}
 else await fs.writeFile(file,expected,{flag:'wx',mode:0o600});
 const allowed=new Set([CACHE_MANIFEST,...model.files.map(x=>x.name)]);if((await fs.readdir(cache)).some(name=>!allowed.has(name)))throw Error('unexpected_cache_entry');
 return cache;
}
async function cachedFile(cache,item,signal){
 const file=path.join(cache,item.name);let stat;try{stat=await fs.lstat(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}
 if(!stat.isFile()||stat.isSymbolicLink())throw Error('unsafe_cached_file');
 if(await verifyFile(file,item,signal))return file;
 // 잘못된 캐시의 정규파일만 지운다. 설치된 모델과 링크 대상은 건드리지 않는다.
 await fs.unlink(file);return null;
}
async function directory(dir){const parent=path.dirname(dir);if(parent!==dir)await directory(parent);try{await fs.mkdir(dir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_path');}
export async function verifyFile(file,item,signal){signal?.throwIfAborted();let s;try{s=await fs.lstat(file);}catch(e){if(e.code==='ENOENT')return false;throw e;}if(!s.isFile()||s.isSymbolicLink()||s.size!==item.size)return false;const hash=createHash('sha256');for await(const c of createReadStream(file,{signal}))hash.update(c);return hash.digest('hex')===item.sha256;}
export function approvedURL(value,item,redirect=false,model=MODEL){
 const u=new URL(value);if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash)return false;
 const initial=`/Systran/faster-whisper-small/resolve/${model.revision}/${item.name}`;
 if(u.hostname==='huggingface.co')return u.pathname===initial || (redirect&&u.pathname===`/api/resolve-cache/models/Systran/faster-whisper-small/${model.revision}/${item.name}`);
 // 공식 model.bin의 302 응답에서 확인한 정확한 Xet 객체 경로. 다른 모델·CDN은 거절한다.
 return redirect&&item.name==='model.bin'&&u.hostname==='us.aws.cdn.hf.co'&&u.pathname==='/xet-bridge-us/655f212f4f2c90ed74120fdd/429ffc84492c1122da005d7274fc397bf142fe12066eb7e4612dc25c579db2ea';
}
const descriptor=item=>({digest:`sha256:${item.sha256}`,size:item.size});
export function download(url,target,item,options={}){return downloadHTTP(url,target,descriptor(item),{...options,approved:(value,_descriptor,redirect)=>approvedURL(value,item,redirect)});}
export function partialDirectory(root,model=MODEL){return path.join(root,'.whisper-partial-cache',cacheKey(model));}
export async function inspect(root,{model=MODEL,signal}={}){
 manifest(model);let modelDirectory=false;try{const stat=await fs.lstat(path.join(root,'whisper-small'));modelDirectory=stat.isDirectory()&&!stat.isSymbolicLink();}catch(e){if(e.code!=='ENOENT')throw e;}const files=[];for(const item of model.files)files.push(modelDirectory&&await verifyFile(path.join(root,'whisper-small',item.name),item,signal));
 let runtimePresent=false;try{await fs.access(path.join(root,'whisper-venv/bin/python'));runtimePresent=true;}catch{}
 return {event:'status',model:model.name,license:model.license,revision:model.revision,source:model.source,downloadBytes:model.files.reduce((s,x)=>s+x.size,0),modelVerified:files.every(Boolean),filesVerified:files.filter(Boolean).length,totalFiles:files.length,runtimePresent,runtimeVerified:false,inferenceVerified:false,automaticRuntimeInstall:false,automaticServerStart:false,cloudEnabled:false};
}
export async function prepare(root,{model=MODEL,signal,emit=()=>{},transfer=download,requestGet,statfs=fs.statfs}={}){
 manifest(model);root=path.resolve(root);await directory(root);let release,stage;
 try{
  release=await acquireModelLock(root,'.whisper-prepare.lock',{signal});
  const state=await inspect(root,{model,signal});emit(state);if(state.modelVerified){emit({event:'ready',model:model.name,inferenceVerified:false});return;}
  const dest=path.join(root,'whisper-small');
  try{await fs.lstat(dest);throw Error('existing_incomplete_model_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
  const cache=await checkedCache(root,model);let savedBytes=0;
  for(const item of model.files){
   if(await cachedFile(cache,item,signal))savedBytes+=item.size;
   else if(transfer===download)savedBytes+=(await validatedPartial(partialDirectory(root,model),descriptor(item))).offset;
  }
  // 최종 stage와 독립 완료 캐시를 모두 확보한다. 검증된 기존 바이트만 차감한다.
  const disk=await statfs(root);if(disk.bavail*disk.bsize<state.downloadBytes*2-savedBytes+64*1024*1024)throw Error('insufficient_disk_space');
  stage=await fs.mkdtemp(path.join(root,'.whisper-stage-'));emit({event:'preparing',model:model.name,downloadBytes:state.downloadBytes,source:model.source,license:model.license,resumeMode:transfer===download?'verified-files-and-byte-range':'verified-files-only'});
  let index=0;
  for(const item of model.files){
   signal?.throwIfAborted();const file=path.join(stage,item.name),cached=await cachedFile(cache,item,signal);
   if(cached){await fs.copyFile(cached,file,fs.constants.COPYFILE_EXCL);if(!await verifyFile(file,item,signal))throw Error('cached_copy_checksum_mismatch');emit({event:'progress',file:item.name,completed:item.size,total:item.size,reusedVerifiedFile:true});}
   else{
    const url=`${model.source}/resolve/${model.revision}/${item.name}`,options={signal,onProgress:completed=>emit({event:'progress',file:item.name,completed,total:item.size})};
    if(transfer===download)await resumeHTTP(url,file,descriptor(item),{...options,cache:partialDirectory(root,model),get:requestGet,approved:(value,_descriptor,redirect)=>approvedURL(value,item,redirect)});
    else await transfer(url,file,item,options);
    if(!await verifyFile(file,item,signal))throw Error('checksum_mismatch');
    // 완성 파일만 cache에 게시한다. 부분 전송과 복사 중간 파일은 stage와 함께 삭제된다.
    const ready=path.join(stage,`.cache-ready-${index++}`);await fs.copyFile(file,ready,fs.constants.COPYFILE_EXCL);if(!await verifyFile(ready,item,signal))throw Error('cache_copy_checksum_mismatch');signal?.throwIfAborted();
    // 같은 파일시스템의 hard-link 생성은 기존 cache 경로를 덮어쓰지 않는 원자적 게시다.
    await fs.link(ready,path.join(cache,item.name));await fs.unlink(ready);
   }
  }
  await fs.writeFile(path.join(stage,'ahmatda-manifest.json'),JSON.stringify(model,null,2),{flag:'wx',mode:0o600});signal?.throwIfAborted();
  // 다른 설치기의 파일이 생겼으면 덮어쓰지 않는다. 비어 있는 디렉터리도 보존한다.
  try{await fs.lstat(dest);throw Error('destination_created_during_prepare');}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.rename(stage,dest);stage=null;emit({event:'ready',model:model.name,inferenceVerified:false});
 }finally{try{if(stage)await fs.rm(stage,{recursive:true,force:true});}finally{if(release)await release();}}
}
async function main(){const args=process.argv.slice(2);if(args.length>1||(args.length&&!['--status','--prepare'].includes(args[0])))throw Error('usage: --status | --prepare');const root=await resolveStorageRoot(path.dirname(fileURLToPath(import.meta.url)));const c=new AbortController();process.once('SIGINT',()=>c.abort());process.once('SIGTERM',()=>c.abort());const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');if(args[0]==='--prepare')await prepare(root,{signal:c.signal,emit});else emit(await inspect(root,{signal:c.signal}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{process.stdout.write(JSON.stringify({event:'error',code:error.name==='AbortError'?'cancelled':error.message})+'\n');process.exitCode=1;});
