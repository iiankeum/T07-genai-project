// 개발 준비 전용. 전역 패키지와 사용자 미디어는 변경하지 않는다.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {download, verifyFile, inventory} from './prepare-whisper-runtime.mjs';
// 별도 프로세스 그룹은 이 준비 작업이 시작한 컴파일 자식만 함께 취소한다.
export function run(executable,args,{cwd,signal}={}){signal?.throwIfAborted();return new Promise((resolve,reject)=>{
 const child=spawn(executable,args,{cwd,detached:true,env:{PATH:'/usr/bin:/bin',HOME:cwd||'/tmp',LANG:'en_US.UTF-8'},stdio:['ignore','pipe','pipe']});let out='',bytes=0,failure,timer;
 const kill=signalName=>{if(child.pid)try{process.kill(-child.pid,signalName);}catch(e){if(e.code!=='ESRCH')failure=e;}};
 const abort=()=>{failure=Error('preparation_cancelled');kill('SIGTERM');timer=setTimeout(()=>kill('SIGKILL'),1500);};
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 for(const stream of [child.stdout,child.stderr])stream.on('data',c=>{bytes+=c.length;if(bytes>4*1024*1024){failure=Error('process_output_limit');kill('SIGTERM');}else out+=c;});
 child.on('error',e=>{failure=e;});child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(failure)reject(failure);else if(code!==0)reject(Error('audio_build_step_failed'));else resolve(out);});
});}
export const SOURCE=Object.freeze({version:'9.0.2',filename:'ffmpeg-9.0.2.tar.xz',size:12040788,sha256:'8c3850283eb25fa026482078a04051e0be17347b09ef81a0849bec15a96e002e',url:'https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz',hashSource:'https://formulae.brew.sh/api/formula/ffmpeg.json',license:'LGPL-2.1-or-later',pgpVerified:false});
export const bundleName='ffmpeg-audio-9.0.2';
export const CONFIG=Object.freeze(['--disable-autodetect','--disable-gpl','--disable-version3','--disable-nonfree','--disable-network','--disable-everything','--disable-shared','--enable-static','--disable-doc','--disable-debug','--disable-ffplay','--disable-avdevice','--disable-swscale','--disable-videotoolbox','--disable-audiotoolbox','--enable-ffmpeg','--enable-ffprobe','--enable-avcodec','--enable-avformat','--enable-avfilter','--enable-swresample','--enable-protocol=file,pipe','--enable-demuxer=wav,mp3,mov,aac,flac,ogg','--enable-decoder=pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_f64le,mp3,mp3float,aac,alac,flac,vorbis,opus','--enable-parser=aac,mpegaudio,flac,opus,vorbis','--enable-encoder=pcm_s16le','--enable-muxer=wav','--enable-filter=aresample,aformat,anull','--cc=/usr/bin/clang','--extra-cflags=-mmacosx-version-min=14.0','--extra-ldflags=-mmacosx-version-min=14.0']);
const marker='ahmatda-runtime-manifest.json';
export const manifestHash=createHash('sha256').update(JSON.stringify({SOURCE,CONFIG})).digest('hex');
async function safeDirectory(dir){const parent=path.dirname(dir);if(parent!==dir)await safeDirectory(parent);await fs.mkdir(dir,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_path');}
export function archiveNamesSafe(text){return text.trim().split('\n').every(x=>x.startsWith('ffmpeg-9.0.2/')&&!x.split('/').includes('..')&&!x.includes('\\')&&!x.includes('\0'));}
export function systemDependenciesOnly(text){return text.split('\n').slice(1).filter(x=>x.trim()).every(x=>/^\s+(\/usr\/lib\/|\/System\/Library\/)/.test(x));}
export async function inspect(root,{signal}={}){let filesVerified=false;const dest=path.join(root,'runtime',bundleName);try{const stat=await fs.lstat(dest);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('unsafe_path');const meta=JSON.parse(await fs.readFile(path.join(dest,marker),'utf8'));filesVerified=meta.manifestHash===manifestHash&&JSON.stringify(meta.inventory)===JSON.stringify(await inventory(dest,signal));}catch(e){if(signal?.aborted)throw e;}return{event:'status',runtime:bundleName,filesVerified,downloadBytes:SOURCE.size,developerPreparationOnly:true,distributionSigningVerified:false,pgpVerified:false,conversionVerified:false};}
export async function buildStage(stage,{signal,emit=()=>{},transfer=download}={}){const archive=path.join(stage,SOURCE.filename);await transfer(SOURCE.url,archive,SOURCE,{signal,emit});if(!await verifyFile(archive,SOURCE,signal))throw Error('checksum_mismatch');const listing=await run('/usr/bin/tar',['-tJf',archive],{cwd:stage,signal});if(!archiveNamesSafe(listing))throw Error('unsafe_archive');await run('/usr/bin/tar',['-xJf',archive,'--no-same-owner'],{cwd:stage,signal});const source=path.join(stage,'ffmpeg-9.0.2');emit({event:'building',step:'configure'});await run('/bin/sh',['./configure',...CONFIG],{cwd:source,signal});emit({event:'building',step:'compile'});await run('/usr/bin/make',['-j4','ffmpeg','ffprobe'],{cwd:source,signal});const output=path.join(stage,'bundle');await fs.mkdir(path.join(output,'bin'),{recursive:true});await fs.mkdir(path.join(output,'redistribution'));for(const name of ['ffmpeg','ffprobe']){const from=path.join(source,name);const deps=await run('/usr/bin/otool',['-L',from],{cwd:stage,signal});if(!systemDependenciesOnly(deps))throw Error('non_system_dynamic_dependency');await fs.copyFile(from,path.join(output,'bin',name));await fs.writeFile(path.join(output,'redistribution',name+'-dependencies.txt'),deps);}
await fs.copyFile(archive,path.join(output,'redistribution',SOURCE.filename));for(const name of ['COPYING.LGPLv2.1','LICENSE.md'])await fs.copyFile(path.join(source,name),path.join(output,'redistribution',name));await fs.copyFile(path.join(source,'ffbuild/config.log'),path.join(output,'redistribution/config.log'));await fs.writeFile(path.join(output,'redistribution/build.json'),JSON.stringify({source:SOURCE,configure:CONFIG,make:['-j4','ffmpeg','ffprobe']},null,2));await fs.writeFile(path.join(output,'redistribution/NOTICE.txt'),'FFmpeg 9.0.2, https://ffmpeg.org/, LGPL 2.1 or later. Matching unmodified source archive and configure options included. No GPL, version3, nonfree, network or autodetected external libraries. SHA256 checked against Homebrew source registry; release PGP signature NOT verified. Development build only: full redistribution compliance review, Developer ID signing and notarization still required. This inventory is local change detection, not publisher signature assurance.\n');return output;}
export async function prepare(root,{signal,emit=()=>{},builder=buildStage,platform=process.platform,arch=process.arch}={}){if(platform!=='darwin'||arch!=='arm64')throw Error('requires_macos_arm64');root=path.resolve(root);await safeDirectory(root);const runtime=path.join(root,'runtime');await safeDirectory(runtime);const dest=path.join(runtime,bundleName),lock=path.join(runtime,'.audio-prepare.lock');let owned=false,stage;try{await fs.mkdir(lock,{mode:0o700});owned=true;const state=await inspect(root,{signal});emit(state);if(state.filesVerified)return state;
// 기존 설치는 불완전해도 덮어쓰거나 삭제하지 않는다.
try{await fs.lstat(dest);throw Error('existing_runtime_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
const disk=await fs.statfs(runtime);if(disk.bavail*disk.bsize<1024**3)throw Error('insufficient_disk_space');stage=await fs.mkdtemp(path.join(runtime,'.audio-stage-'));signal?.throwIfAborted();const output=await builder(stage,{signal,emit});if(path.dirname(output)!==stage)throw Error('invalid_builder_output');const files=await inventory(output,signal);await fs.writeFile(path.join(output,marker),JSON.stringify({manifestHash,inventory:files,source:SOURCE,configure:CONFIG},null,2),{flag:'wx',mode:0o600});signal?.throwIfAborted();try{await fs.lstat(dest);throw Error('destination_created_during_prepare');}catch(e){if(e.code!=='ENOENT')throw e;}await fs.rename(output,dest);emit({event:'ready',runtime:bundleName,conversionVerified:false});}finally{if(stage)await fs.rm(stage,{recursive:true,force:true});if(owned)await fs.rmdir(lock);}}
// 번들 복사는 자체 inventory 대조와 현재 Mach-O 의존성을 다시 검사한다.
// 이 검사는 공급자 서명이나 재배포 라이선스 검토를 대신하지 않는다.
async function assertDirectoryChain(dir){const parent=path.dirname(dir);if(parent!==dir)await assertDirectoryChain(parent);const st=await fs.lstat(dir);if(!st.isDirectory()||st.isSymbolicLink())throw Error('unsafe_path');}
export async function verifyRuntime(source,{signal}={}){
 source=path.resolve(source);await assertDirectoryChain(source);signal?.throwIfAborted();
 const markerPath=path.join(source,marker),stat=await fs.lstat(markerPath);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)throw Error('invalid_audio_manifest');
 const meta=JSON.parse(await fs.readFile(markerPath,'utf8'));
 if(meta.manifestHash!==manifestHash)throw Error('audio_manifest_mismatch');
 const files=await inventory(source,signal);
 // 이 작은 오디오 번들에는 symlink가 필요하지 않으므로 내부 링크도 거절한다.
 if(files.some(x=>x.link!==undefined))throw Error('audio_symlink_rejected');
 if(JSON.stringify(files)!==JSON.stringify(meta.inventory))throw Error('audio_inventory_mismatch');
 for(const name of ['ffmpeg','ffprobe']){
  const binary=path.join(source,'bin',name),st=await fs.lstat(binary);
  if(!st.isFile()||st.isSymbolicLink()||!(st.mode&0o111))throw Error('audio_binary_invalid');
  if(!systemDependenciesOnly(await run('/usr/bin/otool',['-L',binary],{signal})))throw Error('non_system_dynamic_dependency');
 }
 return {runtime:bundleName,filesVerified:true,systemDependenciesOnly:true,verification:'build-inventory-change-detection',distributionSigningVerified:false,pgpVerified:false,conversionVerified:false,files:files.length,bytes:files.reduce((n,x)=>n+x.size,0)};
}
export async function copyVerifiedRuntime(source,dest,{signal}={}){
 source=path.resolve(source);dest=path.resolve(dest);
 if(dest===source||dest.startsWith(source+path.sep))throw Error('invalid_copy_destination');
 await verifyRuntime(source,{signal});await assertDirectoryChain(path.dirname(dest));
 let owned=false;try{
  // mkdir는 이미 존재하는 빈 폴더까지 거절하여 다른 작업 결과를 보존한다.
  await fs.mkdir(dest,{mode:0o700});owned=true;
  for(const name of await fs.readdir(source))await fs.cp(path.join(source,name),path.join(dest,name),{recursive:true,dereference:false,force:false,errorOnExist:true,filter:()=>{signal?.throwIfAborted();return true;}});
  signal?.throwIfAborted();return await verifyRuntime(dest,{signal});
 }catch(e){if(owned)await fs.rm(dest,{recursive:true,force:true});throw e;}
}
async function main(){const args=process.argv.slice(2);if(args.length>1||(args.length&&!['--status','--prepare-development-runtime'].includes(args[0])))throw Error('usage: --status | --prepare-development-runtime');const controller=new AbortController();process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());const opts={signal:controller.signal,emit:x=>process.stdout.write(JSON.stringify(x)+'\n')};const root=path.join(homedir(),'Library/Application Support/Ahmatda');if(args[0]==='--prepare-development-runtime')await prepare(root,opts);else opts.emit(await inspect(root,opts));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{process.stderr.write(JSON.stringify({event:'error',code:e.message})+'\n');process.exitCode=1;});
