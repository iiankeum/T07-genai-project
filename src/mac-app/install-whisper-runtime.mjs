// 앱에 포함된 개발용 portable 실행기만 private 폴더로 복사한다. 다운로드·pip·추론 없음.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {acquireModelLock} from './model-prepare-lock.mjs';
import {inventory,manifestHash} from './prepare-whisper-runtime.mjs';
import {RUNTIME_NAME,DEFAULT_PROFILE,DEVELOPMENT_PROFILE,runtimeNameForProfile,resolveRuntimePaths,resolveStorageRoot} from './whisper-runtime-profile.mjs';
export {RUNTIME_NAME,DEFAULT_PROFILE,DEVELOPMENT_PROFILE,DEVELOPMENT_RUNTIME_NAME,PROFILE_FILE,runtimeNameForProfile,resolveRuntimeProfile,resolveRuntimePaths,profileInfo,resolveStorageRoot} from './whisper-runtime-profile.mjs';
const marker='ahmatda-runtime-manifest.json';
async function safeDirectory(dir,{create=false}={}){
 const parent=path.dirname(dir);if(parent!==dir)await safeDirectory(parent,{create});
 if(create)try{await fs.mkdir(dir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
 const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_path');
}
export async function verifyRuntime(source,{signal,profile=DEFAULT_PROFILE}={}){
 runtimeNameForProfile(profile);
 source=path.resolve(source);await safeDirectory(source);
 const markerStat=await fs.lstat(path.join(source,marker));
 if(!markerStat.isFile()||markerStat.isSymbolicLink()||markerStat.size>4*1024*1024)throw Error('invalid_runtime_inventory');
 const meta=JSON.parse(await fs.readFile(path.join(source,marker),'utf8'));
 if(!Array.isArray(meta.inventory))throw Error('runtime_manifest_mismatch');
 if(profile===DEFAULT_PROFILE){if(meta.manifestHash!==manifestHash||meta.kind)throw Error('runtime_manifest_mismatch');}
 else if(meta.kind!==DEVELOPMENT_PROFILE||meta.baseManifestHash!==manifestHash||meta.wheel?.path!=='av-19.0.2-cp312-abi3-macosx_14_0_arm64.whl'||!/^[a-f0-9]{64}$/.test(meta.wheel?.sha256||''))throw Error('runtime_profile_manifest_mismatch');
 const actual=await inventory(source,signal);
 if(JSON.stringify(meta.inventory)!==JSON.stringify(actual))throw Error('runtime_inventory_mismatch');
 if(!actual.some(x=>x.path==='python/bin/python3.12'&&x.sha256))throw Error('python_entry_missing');
 return {manifestHash,inventory:actual,...(profile===DEFAULT_PROFILE?{}:{profile})};
}
export async function copyVerifiedRuntime(source,dest,{signal,privateFiles=false,profile=DEFAULT_PROFILE}={}){
 const meta=await verifyRuntime(source,{signal,profile});
 await safeDirectory(path.dirname(dest),{create:true});
 try{await fs.mkdir(dest,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw Error('destination_exists');throw e;}
 // inventory()가 내부 상대 symlink와 정규파일만 허용한다. caller의 기존 파일을 덮어쓰지 않는다.
 for(const item of meta.inventory){signal?.throwIfAborted();const to=path.join(dest,item.path);await safeDirectory(path.dirname(to),{create:true});
  if(item.link)await fs.symlink(item.link,to);
  else{await fs.copyFile(path.join(source,item.path),to,fs.constants.COPYFILE_EXCL);if(privateFiles){const s=await fs.stat(path.join(source,item.path));await fs.chmod(to,(s.mode&0o100)?0o700:0o600);}}
 }
 await fs.copyFile(path.join(source,marker),path.join(dest,marker),fs.constants.COPYFILE_EXCL);
 if(privateFiles)await fs.chmod(path.join(dest,marker),0o600);
 await verifyRuntime(dest,{signal,profile});
 return meta;
}
export async function status(source,root,{signal,profile=DEFAULT_PROFILE}={}){
 const runtimeName=runtimeNameForProfile(profile);
 let bundledVerified=false,installedVerified=false;
 try{await verifyRuntime(source,{signal,profile});bundledVerified=true;}catch(e){if(signal?.aborted)throw e;}
 try{await verifyRuntime(path.join(root,'runtime',runtimeName),{signal,profile});installedVerified=true;}catch(e){if(signal?.aborted)throw e;}
 return {event:'status',runtime:runtimeName,...(profile===DEFAULT_PROFILE?{}:{profile}),bundledVerified,installedVerified,verification:'build-inventory-change-detection',distributionSigningVerified:false,inferenceVerified:false,networkRequired:false};
}
export async function install(source,root,{signal,emit=()=>{},profile=DEFAULT_PROFILE}={}){
 const runtimeName=runtimeNameForProfile(profile);
 root=path.resolve(root);await safeDirectory(root,{create:true});
 const permissions=await fs.stat(root);if((typeof process.getuid==='function'&&permissions.uid!==process.getuid())||(permissions.mode&0o077))throw Error('private_storage_permissions_required');
 const runtime=path.join(root,'runtime');await safeDirectory(runtime,{create:true});
 const lockName=profile===DEFAULT_PROFILE?'.whisper-install.lock':'.whisper-pyav-lgpl-dev-install.lock';let release,stage;
 try{
  try{release=await acquireModelLock(runtime,lockName,{signal});}catch(e){if(e.message==='preparation_busy_or_interrupted_lock')throw Error('installation_busy_or_interrupted_lock');throw e;}
  const current=await status(source,root,{signal,profile});emit(current);
  if(current.installedVerified){emit({event:'ready',runtime:runtimeName,inferenceVerified:false});return;}
  if(!current.bundledVerified)throw Error('bundled_runtime_missing_or_unverified');
  const dest=path.join(runtime,runtimeName);try{await fs.lstat(dest);throw Error('existing_runtime_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
  const meta=await verifyRuntime(source,{signal,profile});const bytes=meta.inventory.reduce((s,x)=>s+(x.size||0),0);const disk=await fs.statfs(runtime);
  if(disk.bavail*disk.bsize<bytes+64*1024*1024)throw Error('insufficient_disk_space');
  emit({event:'installing',runtime:runtimeName,totalBytes:bytes,networkRequired:false});
  stage=await fs.mkdtemp(path.join(runtime,'.whisper-install-'));const candidate=path.join(stage,runtimeName);
  await copyVerifiedRuntime(source,candidate,{signal,privateFiles:true,profile});signal?.throwIfAborted();
  try{await fs.lstat(dest);throw Error('destination_created_during_install');}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.rename(candidate,dest);emit({event:'ready',runtime:runtimeName,inferenceVerified:false});
 }finally{
  // 현재 호출이 만든 stage만 정리한다. 이전 강제종료의 stage는 보존한다.
  try{if(stage)await fs.rm(stage,{recursive:true,force:true});}finally{await release?.();}
 }
}
async function main(){const args=process.argv.slice(2);if(args.length>1||(args.length&&!['--status','--install-from-bundle'].includes(args[0])))throw Error('usage: --status | --install-from-bundle');
 const here=path.dirname(fileURLToPath(import.meta.url));const root=await resolveStorageRoot(here);const {source,profile}=await resolveRuntimePaths(here,root);const c=new AbortController();process.once('SIGINT',()=>c.abort());process.once('SIGTERM',()=>c.abort());const emit=x=>process.stdout.write(JSON.stringify(x)+'\n');if(args[0]==='--install-from-bundle')await install(source,root,{signal:c.signal,emit,profile});else emit(await status(source,root,{signal:c.signal,profile}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{process.stdout.write(JSON.stringify({event:'error',code:e.name==='AbortError'?'cancelled':e.message})+'\n');process.exitCode=1;});
