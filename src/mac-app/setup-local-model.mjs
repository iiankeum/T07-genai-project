import {resolveStorageRoot} from './whisper-runtime-profile.mjs';
// 개발용 모델 준비 helper. 런타임은 앱 업데이트로 제공한다. 모델 외 다운로드·실행·추론 없음.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import https from 'node:https';
import { homedir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';

const descriptor = (hash, size, type) => ({mediaType: type, digest: `sha256:${hash}`, size});
const prefix = 'application/vnd.ollama.image.';
export const MODEL = Object.freeze({
  name: 'qwen3:4b', license: 'Apache-2.0', source: 'https://registry.ollama.ai/v2/library/qwen3',
  digest: '359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7',
  manifest: {schemaVersion:2,mediaType:'application/vnd.docker.distribution.manifest.v2+json',
    config:descriptor('e18a783aae5525fd2852fc94c985541a77e791e034abc2d3056474d59de336fc',487,'application/vnd.docker.container.image.v1+json'),
    layers:[descriptor('3e4cb14174460404e7a233e531675303b2fbf7749c02f91864fe311ab6344e4f',2497280480,prefix+'model'),
      descriptor('2d54db2b9bb29ce7db54fea63a891f5859603813c555b1f88b5e0994652897f9',1506,prefix+'template'),
      descriptor('d18a5cc71b84bc4af394a31116bd3932b42241de70c77d2b76d69a314ec8aa12',11338,prefix+'license'),
      descriptor('cff3f395ef3756ab63e58b0ad1b32bb6f802905cae1472e6a12034e4246fbbdb',120,prefix+'params')]},
});
export const RUNTIME = Object.freeze({version:'0.40.16',relative:'runtime/ollama-v0.40.16/ollama',
  size:78301616, digest:'sha256:5c3cf935be8d896433a5caefefc8857bc2bb9e32c77c35e7c3d38b7c5919822f'});
const allFiles = model => [model.manifest.config, ...model.manifest.layers];
const blobName = item => item.digest.replace(':','-');

async function safeDirectory(dir) {
  // 심볼릭 링크를 포함한 예상 밖 경로에는 쓰지 않는다.
  const parent=path.dirname(dir);
  if(parent!==dir) await safeDirectory(parent);
  try { await fs.mkdir(dir,{mode:0o700}); } catch(e) { if(e.code!=='EEXIST') throw e; }
  const s=await fs.lstat(dir); if(!s.isDirectory() || s.isSymbolicLink()) throw new Error('unsafe_path');
}
async function regular(file) {
  try { const s=await fs.lstat(file); return s.isFile() && !s.isSymbolicLink() ? s : null; }
  catch(e) { if(e.code==='ENOENT') return null; throw e; }
}
export async function verifyFile(file,item,signal) {
  signal?.throwIfAborted();
  const s=await regular(file); if(!s || s.size!==item.size) return false;
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file,{signal})) hash.update(chunk);
  return `sha256:${hash.digest('hex')}`===item.digest;
}
const MODEL_CDN = 'dd20bb891979d25aebc8bec07b2b3bbc.r2.cloudflarestorage.com';
export function approvedDownloadURL(url,item,redirect=false) {
  const u=new URL(url); const hash=item.digest.slice(7);
  if(u.protocol!=='https:' || u.port || u.username || u.password || u.hash) return false;
  if(!redirect) return u.hostname==='registry.ollama.ai' && u.pathname===`/v2/library/qwen3/blobs/${item.digest}` && !u.search;
  return (u.hostname==='registry.ollama.ai' && u.pathname===`/v2/library/qwen3/blobs/${item.digest}` && !u.search) ||
    (u.hostname===MODEL_CDN && u.pathname===`/ollama/docker/registry/v2/blobs/sha256/${hash.slice(0,2)}/${hash}/data`);
}
export function download(url, target, item, {signal,onProgress=()=>{},redirects=0}={}) {
  // 계정 헤더·토큰·쿠키·요청 본문·로컬 자료는 전송하지 않는다.
  return new Promise((resolve,reject)=>{
    const parsed=new URL(url);
    if(!approvedDownloadURL(url,item,redirects>0)) return reject(new Error('unapproved_source'));
    const request=https.get(parsed,{signal,agent:false,headers:{'user-agent':'Ahmatda-model-preparer/1'}},response=>{
      // 공식 저장소에서 실제 확인한 CDN의 해당 digest 경로만 허용한다.
      if([301,302,303,307,308].includes(response.statusCode)) {
        const location=response.headers.location; response.destroy();
        if(!location || redirects>=3) {reject(new Error('redirect_limit'));return;}
        let next; try {next=new URL(location,parsed).href;} catch {reject(new Error('unapproved_redirect'));return;}
        if(!approvedDownloadURL(next,item,true)) {reject(new Error('unapproved_redirect'));return;}
        download(next,target,item,{signal,onProgress,redirects:redirects+1}).then(resolve,reject);return;
      }
      if(response.statusCode!==200) { response.destroy(); reject(new Error('download_http_'+response.statusCode)); return; }
      const length=response.headers['content-length'];
      if(length!==undefined && Number(length)!==item.size) { response.destroy();reject(new Error('size_mismatch'));return; }
      let count=0,last=0;
      const limiter=new Transform({transform(chunk,encoding,done){count+=chunk.length;
        if(count>item.size) return done(new Error('size_limit'));
        if(Date.now()-last>250){onProgress(count);last=Date.now();}done(null,chunk);}});
      pipeline(response,limiter,createWriteStream(target,{flags:'wx',mode:0o600}),{signal})
        .then(()=>{if(count!==item.size) throw new Error('size_mismatch'); onProgress(count); resolve();}).catch(reject);
    });
    request.setTimeout(30_000,()=>request.destroy(new Error('download_timeout')));
    request.on('error',reject);
  });
}
export async function inspect(root,{model=MODEL,runtime=RUNTIME,signal}={}) {
  const models=path.join(root,'models/ollama');
  const installed=[];
  for(const item of allFiles(model)) installed.push(await verifyFile(path.join(models,'blobs',blobName(item)),item,signal));
  let manifest=false;
  try {
    const file=path.join(models,'manifests/registry.ollama.ai/library/qwen3/4b');
    if(await regular(file)) {
      const saved=JSON.parse(await fs.readFile(file,'utf8'));
      manifest=saved.config?.digest===model.manifest.config.digest &&
        model.manifest.layers.every(item=>saved.layers?.some(x=>x.digest===item.digest && x.size===item.size));
    }
  } catch(e) { if(e.code!=='ENOENT' && !(e instanceof SyntaxError)) throw e; }
  return {event:'status',model:model.name,license:model.license,source:model.source,
    downloadBytes:allFiles(model).reduce((sum,x)=>sum+x.size,0),runtimeVersion:runtime.version,
    runtimeVerified:await verifyFile(path.join(root,runtime.relative),runtime,signal),
    modelVerified:installed.every(Boolean)&&manifest,filesVerified:installed.filter(Boolean).length,totalFiles:installed.length,
    inferenceVerified:false,automaticRuntimeInstall:false,automaticServerStart:false,cloudEnabled:false};
}
export async function prepare(root,{model=MODEL,runtime=RUNTIME,signal,emit=()=>{},transfer=download}={}) {
  root=path.resolve(root);
  await safeDirectory(root);
  const lock=path.join(root,'.model-prepare.lock');
  let owned=false,stage;
  try {
    try{await fs.mkdir(lock,{mode:0o700});owned=true;}catch(e){if(e.code==='EEXIST')throw new Error('preparation_busy_or_interrupted_lock');throw e;}
    const state=await inspect(root,{model,runtime,signal});emit(state);
    if(!state.runtimeVerified) throw new Error('runtime_missing_or_unverified_use_app_update');
    if(state.modelVerified){emit({event:'ready',model:model.name,inferenceVerified:false});return;}
    const models=path.join(root,'models/ollama');
    const blobs=path.join(models,'blobs');
    const manifests=path.join(models,'manifests/registry.ollama.ai/library/qwen3');
    await safeDirectory(blobs);await safeDirectory(manifests);
    stage=await fs.mkdtemp(path.join(models,'.prepare-'));
    const missing=[];
    for(const item of allFiles(model)) if(!await verifyFile(path.join(blobs,blobName(item)),item,signal)) missing.push(item);
    const required=missing.reduce((sum,item)=>sum+item.size,0)+64*1024*1024;
    const disk=await fs.statfs(models); if(disk.bavail*disk.bsize<required) throw new Error('insufficient_disk_space');
    emit({event:'preparing',model:model.name,downloadBytes:missing.reduce((s,x)=>s+x.size,0),source:model.source,license:model.license});
    // 먼저 모든 파일을 임시 저장한다. 실패·취소 시 활성 모델을 바꾸지 않는다.
    for(const item of missing){
      signal?.throwIfAborted();
      const file=path.join(stage,blobName(item));
      await transfer(`${model.source}/blobs/${item.digest}`,file,item,{signal,onProgress:completed=>emit({event:'progress',digest:item.digest,completed,total:item.size})});
      if(!await verifyFile(file,item,signal)) throw new Error('checksum_mismatch');
    }
    signal?.throwIfAborted();
    for(const item of missing){
      const dest=path.join(blobs,blobName(item));
      try { await fs.lstat(dest); throw new Error('existing_invalid_blob_preserved'); }
      catch(e){if(e.code!=='ENOENT')throw e;}
    }
    for(const item of missing) await fs.link(path.join(stage,blobName(item)),path.join(blobs,blobName(item)));
    const manifest=path.join(manifests,'4b');
    const old=await regular(manifest);
    if(old) await fs.copyFile(manifest,path.join(manifests,`4b.backup-${randomUUID()}`));
    else {try {await fs.lstat(manifest);throw new Error('unsafe_manifest');}catch(e){if(e.code!=='ENOENT')throw e;}}
    const pending=path.join(stage,'manifest');
    await fs.writeFile(pending,JSON.stringify(model.manifest),{mode:0o600,flag:'wx'});
    signal?.throwIfAborted();
    await fs.rename(pending,manifest);
    emit({event:'ready',model:model.name,inferenceVerified:false});
  } finally {
    if(stage) await fs.rm(stage,{recursive:true,force:true});
    if(owned) await fs.rmdir(lock);
  }
}
async function main(){
  const args=process.argv.slice(2);
  if(args.length>1 || (args.length && !['--status','--prepare'].includes(args[0]))) throw new Error('usage: --status | --prepare');
  const root=await resolveStorageRoot(path.dirname(fileURLToPath(import.meta.url)));
  const controller=new AbortController();
  process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());
  const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
  if(args[0]==='--prepare') await prepare(root,{signal:controller.signal,emit});
  else emit(await inspect(root,{signal:controller.signal}));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{process.stdout.write(JSON.stringify({event:'error',code:error.name==='AbortError'?'cancelled':error.message})+'\n');process.exitCode=1;});
}
