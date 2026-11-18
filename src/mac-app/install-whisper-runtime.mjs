// 앱에 포함된 개발용 portable 실행기만 private 폴더로 복사한다. 다운로드·pip·추론 없음.
import fs from 'node:fs/promises';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {inventory,manifestHash} from './prepare-whisper-runtime.mjs';
export const RUNTIME_NAME='whisper-portable-3.12.16';
const marker='ahmatda-runtime-manifest.json';
async function safeDirectory(dir,{create=false}={}){
 const parent=path.dirname(dir);if(parent!==dir)await safeDirectory(parent,{create});
 if(create)try{await fs.mkdir(dir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}
 const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_path');
}
export async function verifyRuntime(source,{signal}={}){
 source=path.resolve(source);await safeDirectory(source);
 const markerStat=await fs.lstat(path.join(source,marker));
 if(!markerStat.isFile()||markerStat.isSymbolicLink()||markerStat.size>4*1024*1024)throw Error('invalid_runtime_inventory');
 const meta=JSON.parse(await fs.readFile(path.join(source,marker),'utf8'));
 if(meta.manifestHash!==manifestHash||!Array.isArray(meta.inventory))throw Error('runtime_manifest_mismatch');
 const actual=await inventory(source,signal);
 if(JSON.stringify(meta.inventory)!==JSON.stringify(actual))throw Error('runtime_inventory_mismatch');
 if(!actual.some(x=>x.path==='python/bin/python3.12'&&x.sha256))throw Error('python_entry_missing');
 return {manifestHash,inventory:actual};
}
export async function copyVerifiedRuntime(source,dest,{signal,privateFiles=false}={}){
 const meta=await verifyRuntime(source,{signal});
 await safeDirectory(path.dirname(dest),{create:true});
 try{await fs.mkdir(dest,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw Error('destination_exists');throw e;}
 // inventory()가 내부 상대 symlink와 정규파일만 허용한다. caller의 기존 파일을 덮어쓰지 않는다.
 for(const item of meta.inventory){signal?.throwIfAborted();const to=path.join(dest,item.path);await safeDirectory(path.dirname(to),{create:true});
  if(item.link)await fs.symlink(item.link,to);
  else{await fs.copyFile(path.join(source,item.path),to,fs.constants.COPYFILE_EXCL);if(privateFiles){const s=await fs.stat(path.join(source,item.path));await fs.chmod(to,(s.mode&0o100)?0o700:0o600);}}
 }
 await fs.copyFile(path.join(source,marker),path.join(dest,marker),fs.constants.COPYFILE_EXCL);
 if(privateFiles)await fs.chmod(path.join(dest,marker),0o600);
 await verifyRuntime(dest,{signal});
 return meta;
}
export async function status(source,root,{signal}={}){
 let bundledVerified=false,installedVerified=false;
 try{await verifyRuntime(source,{signal});bundledVerified=true;}catch(e){if(signal?.aborted)throw e;}
 try{await verifyRuntime(path.join(root,'runtime',RUNTIME_NAME),{signal});installedVerified=true;}catch(e){if(signal?.aborted)throw e;}
 return {event:'status',runtime:RUNTIME_NAME,bundledVerified,installedVerified,verification:'build-inventory-change-detection',distributionSigningVerified:false,inferenceVerified:false,networkRequired:false};
}
export async function install(source,root,{signal,emit=()=>{}}={}){
 root=path.resolve(root);await safeDirectory(root,{create:true});
 const permissions=await fs.stat(root);if((typeof process.getuid==='function'&&permissions.uid!==process.getuid())||(permissions.mode&0o077))throw Error('private_storage_permissions_required');
 const runtime=path.join(root,'runtime');await safeDirectory(runtime,{create:true});
 const lock=path.join(runtime,'.whisper-install.lock');let owned=false,stage;
 try{
  try{await fs.mkdir(lock,{mode:0o700});owned=true;}catch(e){if(e.code==='EEXIST')throw Error('installation_busy_or_interrupted_lock');throw e;}
  const current=await status(source,root,{signal});emit(current);
  if(current.installedVerified){emit({event:'ready',runtime:RUNTIME_NAME,inferenceVerified:false});return;}
  if(!current.bundledVerified)throw Error('bundled_runtime_missing_or_unverified');
  const dest=path.join(runtime,RUNTIME_NAME);try{await fs.lstat(dest);throw Error('existing_runtime_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
  const meta=await verifyRuntime(source,{signal});const bytes=meta.inventory.reduce((s,x)=>s+(x.size||0),0);const disk=await fs.statfs(runtime);
  if(disk.bavail*disk.bsize<bytes+64*1024*1024)throw Error('insufficient_disk_space');
  emit({event:'installing',runtime:RUNTIME_NAME,totalBytes:bytes,networkRequired:false});
  stage=await fs.mkdtemp(path.join(runtime,'.whisper-install-'));const candidate=path.join(stage,RUNTIME_NAME);
  await copyVerifiedRuntime(source,candidate,{signal,privateFiles:true});signal?.throwIfAborted();
  try{await fs.lstat(dest);throw Error('destination_created_during_install');}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.rename(candidate,dest);emit({event:'ready',runtime:RUNTIME_NAME,inferenceVerified:false});
 }finally{if(stage)await fs.rm(stage,{recursive:true,force:true});if(owned)await fs.rmdir(lock);}
}
async function main(){const args=process.argv.slice(2);if(args.length>1||(args.length&&!['--status','--install-from-bundle'].includes(args[0])))throw Error('usage: --status | --install-from-bundle');
 const here=path.dirname(fileURLToPath(import.meta.url));const source=path.join(here,'runtime',RUNTIME_NAME);const root=path.join(homedir(),'Library/Application Support/Ahmatda');const c=new AbortController();process.once('SIGINT',()=>c.abort());process.once('SIGTERM',()=>c.abort());const emit=x=>process.stdout.write(JSON.stringify(x)+'\n');if(args[0]==='--install-from-bundle')await install(source,root,{signal:c.signal,emit});else emit(await status(source,root,{signal:c.signal}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{process.stdout.write(JSON.stringify({event:'error',code:e.name==='AbortError'?'cancelled':e.message})+'\n');process.exitCode=1;});
