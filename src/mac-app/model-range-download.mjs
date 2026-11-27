// 모델별 URL 승인 함수는 호출자가 제공한다. 네트워크·부분 재개만 공유한다.
import {createHash} from 'node:crypto';
import {constants,createReadStream,createWriteStream} from 'node:fs';
import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
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
export function downloadHTTP(url, target, item, {signal,onProgress=()=>{},redirects=0,offset=0,get=https.get,approved}={}) {
  // 계정 헤더·토큰·쿠키·요청 본문·로컬 자료는 전송하지 않는다.
  return new Promise((resolve,reject)=>{
    if(typeof approved!=='function')return reject(new Error('source_policy_required'));
    if(!Number.isSafeInteger(offset)||offset<0||offset>=item.size)return reject(new Error('invalid_resume_offset'));
    const parsed=new URL(url);
    if(!approved(url,item,redirects>0)) return reject(new Error('unapproved_source'));
    let activeResponse,delegated=false;
    const request=get(parsed,{signal,agent:false,headers:{'user-agent':'Ahmatda-model-preparer/1','accept-encoding':'identity',...(offset?{range:`bytes=${offset}-`}:{})}},response=>{
      // 공식 저장소에서 실제 확인한 CDN의 해당 digest 경로만 허용한다.
      if([301,302,303,307,308].includes(response.statusCode)) {
        const location=response.headers.location; response.destroy();
        if(!location || redirects>=3) {reject(new Error('redirect_limit'));return;}
        let next; try {next=new URL(location,parsed).href;} catch {reject(new Error('unapproved_redirect'));return;}
        if(!approved(next,item,true)) {reject(new Error('unapproved_redirect'));return;}
        delegated=true;
        downloadHTTP(next,target,item,{signal,onProgress,redirects:redirects+1,offset,get,approved}).then(resolve,reject);return;
      }
      const fail=message=>{response.destroy();reject(new Error(message));};
      if(![200,206].includes(response.statusCode))return fail('download_http_'+response.statusCode);
      if(response.headers['content-encoding'] && response.headers['content-encoding']!=='identity')return fail('encoded_response');
      const start=response.statusCode===206?offset:0;
      if(response.statusCode===206 && (!offset || response.headers['content-range']!==`bytes ${offset}-${item.size-1}/${item.size}`))return fail('invalid_content_range');
      if(response.statusCode===200 && response.headers['content-range']!==undefined)return fail('invalid_content_range');
      const length=response.headers['content-length'];
      if((response.statusCode===206 && length===undefined) || (length!==undefined && length!==String(item.size-start)))return fail('size_mismatch');
      let count=0,last=0;
      const limiter=new Transform({transform(chunk,encoding,done){count+=chunk.length;
        if(count>item.size-start) return done(new Error('size_limit'));
        if(Date.now()-last>250){onProgress(start+count);last=Date.now();}done(null,chunk);}});
      activeResponse=response;
      pipeline(response,limiter,createWriteStream(target,{flags:offset?(constants.O_WRONLY|constants.O_NOFOLLOW|(start?constants.O_APPEND:constants.O_TRUNC)):'wx',mode:0o600}),{signal})
        .then(()=>{if(count!==item.size-start) throw new Error('size_mismatch'); onProgress(start+count); resolve();}).catch(reject);
    });
    request.setTimeout(30_000,()=>request.destroy(new Error('download_timeout')));
    // 응답 쓰기가 시작된 뒤에는 pipeline이 닫힌 후에만 실패를 전달한다.
    request.on('error',error=>{if(activeResponse)activeResponse.destroy(error);else if(!delegated)reject(error);});
  });
}
// 부분 캐시는 완료 blob과 분리한다. 중단 시 기록한 부분 SHA도 재사용 전에 검사한다.
async function partialHash(file){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file,{flags:constants.O_RDONLY|constants.O_NOFOLLOW}))hash.update(chunk);
  return hash.digest('hex');
}
const resumableFailure=e=>e.name==='AbortError'||['ECONNRESET','ETIMEDOUT','EPIPE','ENETUNREACH','EAI_AGAIN','ERR_STREAM_PREMATURE_CLOSE'].includes(e.code)||e.message==='download_timeout';
export async function validatedPartial(cache,item){
  // 호출자는 모델 준비 lock을 보유한다. stale lock은 자동 삭제하지 않는다.
  const key=createHash('sha256').update(JSON.stringify({digest:item.digest,size:item.size})).digest('hex');
  await safeDirectory(cache);const dir=path.join(cache,key);await safeDirectory(dir);
  const partial=path.join(dir,'partial'),meta=path.join(dir,'metadata.json');
  for(const entry of await fs.readdir(dir))if(!['partial','metadata.json'].includes(entry))throw Error('unexpected_partial_entry');
  for(const file of [partial,meta]){try{const st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink())throw Error('unsafe_partial');}catch(e){if(e.code!=='ENOENT')throw e;}}
  let offset=0;
  const clean=async()=>{await fs.rm(partial,{force:true});await fs.rm(meta,{force:true});};
  const existing=await regular(partial),metadata=await regular(meta);
  if(existing&&metadata){
    // 크기를 먼저 제한하여 잘못된 캐시를 끝없이 읽지 않는다.
    if(existing.size<1||existing.size>item.size){await clean();throw Error('partial_integrity_failed');}
    if(metadata.size>1024){await clean();throw Error('invalid_partial_metadata');}
    let saved,handle;try{handle=await fs.open(meta,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const info=await handle.stat();if(!info.isFile()||info.size>1024)throw Error('invalid_partial_metadata');saved=JSON.parse(await handle.readFile('utf8'));}catch(e){if(e instanceof SyntaxError||e.message==='invalid_partial_metadata'){await clean();throw Error('invalid_partial_metadata');}throw e;}finally{await handle?.close();}
    const expected={version:1,digest:item.digest,size:item.size,bytes:existing.size,sha256:await partialHash(partial)};
    if(!isDeepStrictEqual(saved,expected)){await clean();throw Error('partial_integrity_failed');}
    offset=existing.size;
  }else if(existing||metadata){await clean();}
  return {partial,meta,offset,clean};
}
export async function resumeHTTP(url,target,item,{cache,signal,onProgress,get,approved}={}){
  if(typeof approved!=='function')throw new Error('source_policy_required');
  const {partial,meta,offset,clean}=await validatedPartial(cache,item);
  try{
    if(offset!==item.size)await downloadHTTP(url,partial,item,{signal,onProgress,offset,get,approved});
    if(!await verifyFile(partial,item,signal))throw Error('checksum_mismatch');
    signal?.throwIfAborted();
    await fs.link(partial,target);await clean();
  }catch(e){
    const st=await regular(partial);
    if(resumableFailure(e)&&st&&st.size>0&&st.size<=item.size){
      const value={version:1,digest:item.digest,size:item.size,bytes:st.size,sha256:await partialHash(partial)};
      // 이전 메타데이터를 제거한 뒤 wx로 기록. SIGKILL 중간 상태는 재사용하지 않는다.
      await fs.rm(meta,{force:true});await fs.writeFile(meta,JSON.stringify(value),{flag:'wx',mode:0o600});
    }else await clean();
    throw e;
  }
}
