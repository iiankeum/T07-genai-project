// 파일 존재가 아니라 OS fd 수명으로 잠근다. PID 추정이나 legacy 잠금 삭제는 하지 않는다.
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
const NAMES=new Set(['.model-prepare.lock','.whisper-prepare.lock','.whisper-install.lock','.whisper-pyav-lgpl-dev-install.lock']);
const BUSY='preparation_busy_or_interrupted_lock';
async function directoryChain(dir){const parent=path.dirname(dir);if(parent!==dir)await directoryChain(parent);const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('unsafe_lock_path');}
function same(a,b){return a.dev===b.dev&&a.ino===b.ino;}
async function marker(dir){
 const entries=await fs.readdir(dir);if(entries.length!==1||entries[0]!=='owner.json')throw Error(BUSY);
 let handle;try{handle=await fs.open(path.join(dir,'owner.json'),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const st=await handle.stat();if(!st.isFile()||st.size>1024||st.nlink!==1)throw Error(BUSY);return JSON.parse(await handle.readFile('utf8'));}catch{throw Error(BUSY);}finally{await handle?.close();}
}
function validMarker(value,kernel){return value&&isDeepStrictEqual(Object.keys(value).sort(),['kernel','kind','nonce','version'])&&value.version===1&&value.kind==='ahmatda-os-model-lock'&&typeof value.nonce==='string'&&/^[a-f0-9-]{36}$/.test(value.nonce)&&isDeepStrictEqual(value.kernel,{dev:kernel.dev,ino:kernel.ino});}
export async function acquireModelLock(root,name,{signal}={}){
 if(!NAMES.has(name))throw Error('invalid_model_lock_name');
 root=path.resolve(root);await directoryChain(root);signal?.throwIfAborted();
 const legacy=path.join(root,name),kernelFile=path.join(root,name+'.kernel');let handle,owned;
 try{
  // 이 파일은 해제·복구 때도 삭제하거나 교체하지 않는다.
  handle=await fs.open(kernelFile,constants.O_RDWR|constants.O_CREAT|constants.O_NOFOLLOW|constants.O_NONBLOCK,0o600);
  const kernel=await handle.stat();
  if(!kernel.isFile()||kernel.size!==0||kernel.nlink!==1||(kernel.mode&0o077)!==0)throw Error('unsafe_kernel_lock');
  const command=process.platform==='darwin'?'/usr/bin/lockf':process.platform==='linux'?'/usr/bin/flock':null;
  if(!command)throw Error('os_lock_unavailable');
  const args=process.platform==='darwin'?['-s','-t','0','3']:['-n','3'];
  // fd 3은 동일 open-file description이다. 하위 명령 종료 후 Node fd가 잠금을 유지한다.
  const result=spawnSync(command,args,{stdio:['ignore','ignore','ignore',handle.fd],timeout:5000});
  if(result.error||result.signal)throw Error('os_lock_unavailable');
  if(result.status!==0){if(result.status===(process.platform==='darwin'?75:1))throw Error(BUSY);throw Error('os_lock_unavailable');}
  const assertKernel=async()=>{const current=await fs.lstat(kernelFile);if(!current.isFile()||current.isSymbolicLink()||!same(current,kernel)||current.nlink!==1)throw Error('kernel_lock_changed');};
  await assertKernel();signal?.throwIfAborted();
  let previous;try{previous=await fs.lstat(legacy);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(previous){
   if(!previous.isDirectory()||previous.isSymbolicLink())throw Error(BUSY);
   const saved=await marker(legacy);if(!validMarker(saved,kernel))throw Error(BUSY);
   // OS 잠금을 확보했으므로 같은 inode를 쓰던 새 helper는 종료된 상태다.
   // 빈 legacy/미완성 marker는 여기까지 오지 않으며 그대로 보존한다.
   if(!same(await fs.lstat(legacy),previous)||!isDeepStrictEqual(await marker(legacy),saved))throw Error(BUSY);
   await assertKernel();await fs.unlink(path.join(legacy,'owner.json'));await fs.rmdir(legacy);
  }
  try{await fs.mkdir(legacy,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw Error(BUSY);throw e;}
  const dir=await fs.lstat(legacy),value={version:1,kind:'ahmatda-os-model-lock',kernel:{dev:kernel.dev,ino:kernel.ino},nonce:randomUUID()};
  // 이 기록 중 강제 종료하면 불완전 legacy 상태로 남아 자동 복구하지 않는다.
  await fs.writeFile(path.join(legacy,'owner.json'),JSON.stringify(value),{flag:'wx',mode:0o600});owned={dir,value,kernel};
  await assertKernel();signal?.throwIfAborted();
  let released=false;
  return async()=>{
   if(released)return;released=true;
   try{await assertKernel();const current=await fs.lstat(legacy);if(!same(current,dir)||!isDeepStrictEqual(await marker(legacy),value))throw Error('lock_ownership_changed');await fs.unlink(path.join(legacy,'owner.json'));await fs.rmdir(legacy);}finally{await handle.close();}
  };
 }catch(error){
  // 획득 중 취소라도 완성된 본인 marker만 해제한다. 불명확한 경로는 보존한다.
  if(owned){try{if(same(await fs.lstat(kernelFile),owned.kernel)&&same(await fs.lstat(legacy),owned.dir)&&isDeepStrictEqual(await marker(legacy),owned.value)){await fs.unlink(path.join(legacy,'owner.json'));await fs.rmdir(legacy);}}catch{}}
  await handle?.close();throw error;
 }
}
