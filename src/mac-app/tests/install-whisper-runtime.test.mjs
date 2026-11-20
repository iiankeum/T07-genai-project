import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {inventory,manifestHash} from '../prepare-whisper-runtime.mjs';import {install,status,verifyRuntime,copyVerifiedRuntime,RUNTIME_NAME} from '../install-whisper-runtime.mjs';
async function fixture(t){const base=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'whisper-install-test-'));t.after(()=>fs.rm(base,{recursive:true,force:true}));const source=path.join(base,'source');await fs.mkdir(path.join(source,'python/bin'),{recursive:true});await fs.writeFile(path.join(source,'python/bin/python3.12'),'test-python',{mode:0o755});await fs.symlink('python3.12',path.join(source,'python/bin/python'));await fs.writeFile(path.join(source,'ahmatda-runtime-manifest.json'),JSON.stringify({manifestHash,inventory:await inventory(source)}));const root=path.join(base,'private');return{base,source,root};}
test('install preserves relative symlinks, executable permissions and verifies',async t=>{const{source,root}=await fixture(t);await install(source,root);const target=path.join(root,'runtime',RUNTIME_NAME);await verifyRuntime(target);assert.equal((await fs.stat(path.join(target,'python/bin/python3.12'))).mode&0o777,0o700);assert.equal(await fs.readlink(path.join(target,'python/bin/python')),'python3.12');await install(source,root);assert.equal((await status(source,root)).installedVerified,true);});
test('unverified source never creates installed runtime',async t=>{const{source,root}=await fixture(t);await fs.writeFile(path.join(source,'python/bin/python3.12'),'changed');await assert.rejects(install(source,root),/bundled_runtime_missing_or_unverified/);await assert.rejects(fs.stat(path.join(root,'runtime',RUNTIME_NAME)));});
test('existing invalid installation is preserved',async t=>{const{source,root}=await fixture(t);await fs.mkdir(path.join(root,'runtime',RUNTIME_NAME),{recursive:true,mode:0o700});await fs.writeFile(path.join(root,'runtime',RUNTIME_NAME,'keep'),'old');await assert.rejects(install(source,root),/existing_runtime_preserved/);assert.equal(await fs.readFile(path.join(root,'runtime',RUNTIME_NAME,'keep'),'utf8'),'old');});
test('public storage permissions refused',async t=>{const{source,root}=await fixture(t);await fs.mkdir(root,{mode:0o755});await assert.rejects(install(source,root),/private_storage_permissions_required/);});
test('symlink root refused',async t=>{const{base,source,root}=await fixture(t);await fs.symlink(base,root);await assert.rejects(install(source,root),/unsafe_path/);});
test('source external symlink and manifest symlink refused',async t=>{const{source}=await fixture(t);await fs.symlink('/usr/bin/python3',path.join(source,'outside'));await assert.rejects(verifyRuntime(source),/external_runtime_symlink/);});
test('cancel preserves source and cleans lock',async t=>{const{source,root}=await fixture(t);const c=new AbortController();await assert.rejects(install(source,root,{signal:c.signal,emit:e=>{if(e.event==='installing')c.abort();}}),{name:'AbortError'});await verifyRuntime(source);assert.deepEqual(await fs.readdir(path.join(root,'runtime')),['.whisper-install.lock.kernel']);});
test('copy refuses existing destination',async t=>{const{source,base}=await fixture(t);const dest=path.join(base,'existing');await fs.mkdir(dest);await assert.rejects(copyVerifiedRuntime(source,dest),/destination_exists/);});
test('stale lock remains for inspection',async t=>{const{source,root}=await fixture(t);await fs.mkdir(path.join(root,'runtime/.whisper-install.lock'),{recursive:true,mode:0o700});await assert.rejects(install(source,root),/installation_busy/);assert.ok((await fs.stat(path.join(root,'runtime/.whisper-install.lock'))).isDirectory());});

// 실제 실행기는 사용하지 않는다. 작은 가짜 inventory를 복사하는 자식만 강제종료한다.
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {acquireModelLock} from '../model-prepare-lock.mjs';
import {DEFAULT_PROFILE,DEVELOPMENT_PROFILE,runtimeNameForProfile} from '../whisper-runtime-profile.mjs';
const installURL=new URL('../install-whisper-runtime.mjs',import.meta.url).href;
const installLock=profile=>profile===DEFAULT_PROFILE?'.whisper-install.lock':'.whisper-pyav-lgpl-dev-install.lock';
async function developmentSource(source){
 const actual=await inventory(source);
 await fs.writeFile(path.join(source,'ahmatda-runtime-manifest.json'),JSON.stringify({kind:DEVELOPMENT_PROFILE,baseManifestHash:manifestHash,wheel:{path:'av-19.0.2-cp312-abi3-macosx_14_0_arm64.whl',sha256:'a'.repeat(64)},inventory:actual}));
}
async function pausedInstaller(source,root,profile){
 const script=`import fs from 'node:fs/promises';
 const original=fs.copyFile;let paused=false;
 fs.copyFile=async(...args)=>{await original(...args);if(!paused&&String(args[1]).includes('/.whisper-install-')){paused=true;process.stdout.write('copy-paused\\n');await new Promise(()=>setInterval(()=>{},1000));}};
 const {install}=await import(${JSON.stringify(installURL)});
 await install(${JSON.stringify(source)},${JSON.stringify(root)},{profile:${JSON.stringify(profile)}});`;
 const child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe']});
 // fixture cleanup보다 먼저 실행되도록 반환 이후 명시 종료한다. 실패 시에도 살아 있는 자식은 종료한다.
 let stderr='';child.stderr.on('data',x=>stderr+=x);
 const stop=async()=>{if(child.exitCode===null&&!child.signalCode){const ended=once(child,'exit');child.kill('SIGKILL');await ended;}};
 try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('installer_timeout '+stderr)),10000);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error('installer_exited '+stderr));});child.stdout.once('data',x=>{clearTimeout(timer);if(String(x)==='copy-paused\n')resolve();else reject(Error('unexpected_child_output'));});});}catch(e){await stop();throw e;}
 return{child,stop};
}
test('가짜 복사 SIGKILL 후 재설치: 기본·개발 kernel inode와 이전 stage 보존',async t=>{
 for(const profile of [DEFAULT_PROFILE,DEVELOPMENT_PROFILE]){
  const{source,root}=await fixture(t);if(profile===DEVELOPMENT_PROFILE)await developmentSource(source);
  const paused=await pausedInstaller(source,root,profile);
  try{
   const runtime=path.join(root,'runtime'),lock=installLock(profile),kernel=await fs.stat(path.join(runtime,lock+'.kernel'));
   const stages=(await fs.readdir(runtime)).filter(x=>x.startsWith('.whisper-install-'));assert.equal(stages.length,1);
   const stage=path.join(runtime,stages[0]);const stageStat=await fs.stat(stage);
   await assert.rejects(install(source,root,{profile}),/installation_busy/);
   await paused.stop();
   await install(source,root,{profile});
   assert.equal((await status(source,root,{profile})).installedVerified,true);
   assert.equal((await fs.stat(path.join(runtime,lock+'.kernel'))).ino,kernel.ino);
   assert.equal((await fs.stat(stage)).ino,stageStat.ino);
   assert.deepEqual((await fs.readdir(runtime)).filter(x=>x.startsWith('.whisper-install-')),stages);
   await assert.rejects(fs.lstat(path.join(runtime,lock)),{code:'ENOENT'});
  }finally{await paused.stop();}
 }
});
test('설치 중 다른 프로파일은 독립 설치, 같은 프로파일 동시 요청은 거절',async t=>{
 const{source,root,base}=await fixture(t),dev=path.join(base,'dev-source');
 await fs.cp(source,dev,{recursive:true,verbatimSymlinks:true});await developmentSource(dev);
 const paused=await pausedInstaller(source,root,DEFAULT_PROFILE);
 try{
  await assert.rejects(install(source,root),/installation_busy/);
  await install(dev,root,{profile:DEVELOPMENT_PROFILE});
  await verifyRuntime(path.join(root,'runtime',runtimeNameForProfile(DEVELOPMENT_PROFILE)),{profile:DEVELOPMENT_PROFILE});
  await assert.rejects(fs.lstat(path.join(root,'runtime',RUNTIME_NAME)),{code:'ENOENT'});
 }finally{await paused.stop();}
 await install(source,root);
 assert.equal((await status(source,root)).installedVerified,true);
});
test('설치 legacy 빈·손상 marker는 두 프로파일 모두 보존',async t=>{
 for(const profile of [DEFAULT_PROFILE,DEVELOPMENT_PROFILE])for(const marker of [null,'{invalid']){
  const{source,root}=await fixture(t);if(profile===DEVELOPMENT_PROFILE)await developmentSource(source);
  const lock=path.join(root,'runtime',installLock(profile));await fs.mkdir(lock,{recursive:true,mode:0o700});
  if(marker!==null)await fs.writeFile(path.join(lock,'owner.json'),marker);
  await assert.rejects(install(source,root,{profile}),/installation_busy/);
  assert.ok((await fs.stat(lock)).isDirectory());
  if(marker!==null)assert.equal(await fs.readFile(path.join(lock,'owner.json'),'utf8'),marker);
 }
});
test('동시 설치 잠금 획득자는 하나뿐이고 두 설치 이름만 추가 허용',async t=>{
 const{root}=await fixture(t);await fs.mkdir(root,{mode:0o700});
 for(const name of ['.whisper-install.lock','.whisper-pyav-lgpl-dev-install.lock']){
  const results=await Promise.allSettled([acquireModelLock(root,name),acquireModelLock(root,name)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,1);
  await results.find(x=>x.status==='fulfilled').value();
 }
 await assert.rejects(acquireModelLock(root,'.arbitrary-install.lock'),/invalid_model_lock_name/);
});
test('현재 stage 정리 실패에도 설치 OS 잠금을 해제하고 잔여 stage 보존',async t=>{
 const{source,root}=await fixture(t),remove=fs.rm;
 const mock=t.mock.method(fs,'rm',async function(target,...args){if(String(target).startsWith(path.join(root,'runtime','.whisper-install-')))throw Error('fake_cleanup_failure');return remove.call(this,target,...args);});
 try{
  await assert.rejects(install(source,root),/fake_cleanup_failure/);
  const runtime=path.join(root,'runtime');
  assert.equal((await status(source,root)).installedVerified,true);
  assert.equal((await fs.readdir(runtime)).filter(x=>x.startsWith('.whisper-install-')).length,1);
  await assert.rejects(fs.lstat(path.join(runtime,'.whisper-install.lock')),{code:'ENOENT'});
  const release=await acquireModelLock(runtime,'.whisper-install.lock');await release();
 }finally{mock.mock.restore();}
});
