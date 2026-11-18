// 개발용 PyAV wheel 제작. 원본 Python·앱·기본 런타임 manifest를 변경하지 않는다.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {SOURCE as FFMPEG,CONFIG as AUDIO_CONFIG,run} from './prepare-audio-runtime.mjs';
import {download,verifyFile,inventory} from './prepare-whisper-runtime.mjs';
export const MANIFEST=JSON.parse(await fs.readFile(new URL('./pyav-build-manifest.json',import.meta.url),'utf8'));
export const CONFIG=Object.freeze(AUDIO_CONFIG.filter(x=>!['--disable-shared','--enable-static','--disable-ffplay','--disable-avdevice','--disable-swscale','--enable-ffmpeg','--enable-ffprobe'].includes(x)).concat(['--disable-static','--enable-shared','--disable-programs','--enable-avdevice','--enable-swscale','--enable-avutil','--disable-libx264','--disable-libx265']));
export function status(){return {event:'status',developerOnly:true,explicitPreparationRequired:true,automaticInstall:false,pyav:MANIFEST.pyav.version,ffmpeg:FFMPEG.version,downloadBytes:[FFMPEG,MANIFEST.pyav,...MANIFEST.buildWheels].reduce((n,x)=>n+x.size,0),distributionReady:false};}
export function archiveTypesSafe(text){return text.trim().split('\n').every(x=>x.startsWith('-')||x.startsWith('d'));}
export function archiveSafe(text,prefix){return text.trim().split('\n').every(x=>x.startsWith(prefix+'/')&&!x.split('/').includes('..')&&!x.includes('\\')&&!x.includes('\0'));}
async function directoryChain(p){p=path.resolve(p);const parent=path.dirname(p);if(parent!==p)await directoryChain(parent);const s=await fs.lstat(p);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_directory');}
export async function validate({pythonSource,output,pkgConfig}){
 if(!pythonSource||!output||!pkgConfig||!path.isAbsolute(pkgConfig))throw Error('explicit_python_output_pkgconfig_required');
 const source=path.resolve(pythonSource),dest=path.resolve(output),pkg=path.resolve(pkgConfig);
 await directoryChain(source);await directoryChain(path.dirname(dest));
 if(dest===source||dest.startsWith(source+path.sep)||source.startsWith(dest+path.sep))throw Error('source_output_overlap');
 try{await fs.lstat(dest);throw Error('existing_output_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
 const interpreter=await fs.realpath(path.join(source,'bin/python3.12'));if(!interpreter.startsWith(source+path.sep))throw Error('external_python_symlink');
 if(!(await fs.stat(interpreter)).isFile()||!(await fs.stat(pkg)).isFile())throw Error('missing_build_executable');
 return {source,dest,pkg};
}
const AUDIT=String.raw`
import av,pathlib,ctypes,subprocess,re,json
base=pathlib.Path(av.__file__).parent
files=list(base.rglob('*.so'))+list(base.rglob('*.dylib'))
assert files
records=[]
for p in files:
 assert not any(x in p.name for x in ['x264','x265'])
 desc=subprocess.check_output(['/usr/bin/file','-b',str(p)],text=True)
 assert 'arm64' in desc
 load=subprocess.check_output(['/usr/bin/otool','-l',str(p)],text=True)
 dependencies=[]
 for block in load.split('Load command '):
  if re.search(r'cmd LC_(?:LOAD|LOAD_WEAK|REEXPORT)_DYLIB',block):
   m=re.search(r'name (\S+) \(offset',block)
   if m:
    dep=m[1];dependencies.append(dep)
    assert not ('x264' in dep or 'x265' in dep)
    assert not dep.startswith('/') or dep.startswith(('/usr/lib/','/System/Library/'))
 subprocess.run(['/usr/bin/codesign','--verify','--strict',str(p)],check=True,capture_output=True)
 records.append({'path':str(p.relative_to(base)),'dependencies':dependencies})
codec=next(base.rglob('libavcodec.*.dylib'));lib=ctypes.CDLL(str(codec))
lib.avcodec_license.restype=ctypes.c_char_p;lib.avcodec_configuration.restype=ctypes.c_char_p
license=lib.avcodec_license().decode();config=lib.avcodec_configuration().decode()
assert license=='LGPL version 2.1 or later'
for option in ['--disable-gpl','--disable-nonfree','--disable-version3','--disable-network','--disable-autodetect','--disable-libx264','--disable-libx265']:assert option in config
for option in ['--enable-gpl','--enable-nonfree','--enable-version3','--enable-libx264','--enable-libx265']:assert option not in config
print(json.dumps({'pyav':av.__version__,'license':license,'configure':config,'files':records,'distributionReady':False},indent=2))
`;
export async function copyPython(source,dest,signal){
 const before=await inventory(source,signal);
 await fs.cp(source,dest,{recursive:true,dereference:false,verbatimSymlinks:true,errorOnExist:true,force:false,filter:()=>{signal?.throwIfAborted();return true;}});
 if(JSON.stringify(before)!==JSON.stringify(await inventory(dest,signal)))throw Error('python_copy_mismatch');
 return before;
}
export async function build(stage,{source,pkg,signal,emit=()=>{},transfer=download}){
 const downloads=path.join(stage,'sources'),logs=path.join(stage,'logs');await fs.mkdir(downloads);await fs.mkdir(logs);
 const items=[FFMPEG,MANIFEST.pyav,...MANIFEST.buildWheels];
 for(const item of items){signal?.throwIfAborted();const file=path.join(downloads,item.filename);await transfer(item.url,file,item,{signal,emit});if(!await verifyFile(file,item,signal))throw Error('checksum_mismatch');}
 async function step(name,command,args,cwd=stage,env={}){
  emit({event:'building',step:name});
  // 정적 shell wrapper는 인자를 그대로 전달한다. 출력은 개발 로그에만 보존한다.
  return run('/bin/sh',['-c','log="$1"; shift; exec "$@" > "$log" 2>&1','build-log',path.join(logs,name+'.log'),'/usr/bin/env',...Object.entries(env).map(([k,v])=>k+'='+v),command,...args],{cwd,signal});
 }
 const before=await copyPython(source,path.join(stage,'python'),signal);
 const py=path.join(stage,'python/bin/python3.12');
 await step('build-tools',py,['-I','-B','-m','pip','--isolated','install','--no-index','--no-deps','--no-compile','--force-reinstall',...MANIFEST.buildWheels.map(x=>path.join(downloads,x.filename))]);
 for(const [item,prefix] of [[FFMPEG,'ffmpeg-9.0.2'],[MANIFEST.pyav,'av-19.0.2']]){
  const file=path.join(downloads,item.filename);const list=await run('/usr/bin/tar',['-tf',file],{cwd:stage,signal});const types=await run('/usr/bin/tar',['-tvf',file],{cwd:stage,signal});if(!archiveSafe(list,prefix)||!archiveTypesSafe(types))throw Error('unsafe_archive');await step('extract-'+prefix,'/usr/bin/tar',['-xf',file,'--no-same-owner']);
 }
 const vendor=path.join(stage,'vendor'),ff=path.join(stage,'ffmpeg-9.0.2'),config=['--prefix='+vendor,...CONFIG];
 await step('ffmpeg-configure','/bin/sh',['./configure',...config],ff);await step('ffmpeg-make','/usr/bin/make',['-j4'],ff);await step('ffmpeg-install','/usr/bin/make',['install'],ff);
 const wheels=path.join(stage,'wheels'),repaired=path.join(stage,'repaired');await fs.mkdir(wheels);await fs.mkdir(repaired);
 const env={PKG_CONFIG:pkg,PKG_CONFIG_PATH:path.join(vendor,'lib/pkgconfig'),MACOSX_DEPLOYMENT_TARGET:'14.0',PIP_NO_INDEX:'1',PYTHONDONTWRITEBYTECODE:'1'};
 await step('pyav-build',py,['-I','-B','-m','pip','--isolated','wheel','--no-build-isolation','--no-deps','--no-index','.', '-w',wheels],path.join(stage,'av-19.0.2'),env);
 const built=(await fs.readdir(wheels)).filter(x=>/^av-19\.0\.2-.*\.whl$/.test(x));if(built.length!==1)throw Error('unexpected_wheel_output');
 await step('wheel-repair',py,['-I','-B','-m','delocate.cmd.delocate_wheel','--require-archs','arm64','--require-target-macos-version','14.0','-w',repaired,path.join(wheels,built[0])],stage,env);
 // 새 wheel을 복사본에만 설치해 원래 PyAV·외부 라이브러리 혼입을 검사한다.
 await step('remove-old-av',py,['-I','-B','-m','pip','--isolated','uninstall','-y','av']);
 await step('assert-old-av-absent',py,['-I','-B','-c',"import importlib.util; assert importlib.util.find_spec('av') is None"]);
 const fixed=(await fs.readdir(repaired)).filter(x=>x.endsWith('.whl'));if(fixed.length!==1)throw Error('unexpected_repaired_wheel');
 await step('install-rebuilt-av',py,['-I','-B','-m','pip','--isolated','install','--no-index','--no-deps',path.join(repaired,fixed[0])]);
 await step('audit-wheel',py,['-I','-B','-c',AUDIT],stage);
 // 재배포 검토 자료만 결과에 옮긴다. 개발 Python은 결과물에 넣지 않는다.
 const output=path.join(stage,'result');await fs.mkdir(output);await fs.cp(repaired,path.join(output,'wheels'),{recursive:true});await fs.mkdir(path.join(output,'sources'));
 for(const item of [FFMPEG,MANIFEST.pyav])await fs.copyFile(path.join(downloads,item.filename),path.join(output,'sources',item.filename));
 await fs.copyFile(path.join(ff,'COPYING.LGPLv2.1'),path.join(output,'sources/COPYING.LGPLv2.1'));await fs.copyFile(path.join(ff,'LICENSE.md'),path.join(output,'sources/FFmpeg-LICENSE.md'));await fs.copyFile(path.join(stage,'av-19.0.2/LICENSE.txt'),path.join(output,'sources/PyAV-LICENSE.txt'));await fs.copyFile(path.join(ff,'ffbuild/config.log'),path.join(logs,'ffmpeg-full-config.log'));await fs.cp(logs,path.join(output,'logs'),{recursive:true});
 await fs.writeFile(path.join(output,'build-manifest.json'),JSON.stringify({ffmpeg:FFMPEG,...MANIFEST,configure:config,pythonSourceInventorySHA256:createHash('sha256').update(JSON.stringify(before)).digest('hex'),builtWheelFiles:await inventory(path.join(output,'wheels'),signal),byteReproducibilityGuaranteed:false,inferenceVerified:false,developerOnly:true,distributionReady:false},null,2));
 await fs.writeFile(path.join(output,'NOTICE.txt'),'Development wheel only. Includes corresponding unmodified FFmpeg/PyAV source and build configuration. PGP, final redistribution compliance, Developer ID, notarization and clean macOS14 tests remain unverified. Build tools are not bundled. No default application runtime has been replaced.\n');
 if(JSON.stringify(before)!==JSON.stringify(await inventory(source,signal)))throw Error('source_python_changed_during_build');
 return output;
}
export async function prepare(options,{signal,emit=()=>{},builder=build,platform=process.platform,arch=process.arch}={}){
 if(platform!=='darwin'||arch!=='arm64')throw Error('requires_macos_arm64');const args=await validate(options);const disk=await fs.statfs(path.dirname(args.dest));if(disk.bavail*disk.bsize<2*1024**3)throw Error('insufficient_disk_space');
 const lock=args.dest+'.prepare-lock';let owned=false,stage;
 try{await fs.mkdir(lock,{mode:0o700});owned=true;stage=await fs.mkdtemp(path.join(path.dirname(args.dest),'.pyav-build-'));signal?.throwIfAborted();const output=await builder(stage,{...args,signal,emit});if(path.dirname(output)!==stage)throw Error('invalid_builder_output');signal?.throwIfAborted();
  // 목적지 이름을 독점한다. 이미 생긴 폴더는 비어 있어도 보존한다.
  await fs.mkdir(args.dest,{mode:0o700});try{for(const name of await fs.readdir(output)){signal?.throwIfAborted();await fs.rename(path.join(output,name),path.join(args.dest,name));}}catch(e){await fs.rm(args.dest,{recursive:true,force:true});throw e;}
  emit({event:'ready',output:args.dest,developerOnly:true,distributionReady:false});
 }finally{if(stage)await fs.rm(stage,{recursive:true,force:true});if(owned)await fs.rmdir(lock);}
}
async function main(){const args=process.argv.slice(2);if(!args.length||args.length===1&&args[0]==='--status'){console.log(JSON.stringify(status()));return;}
 if(args[0]!=='--prepare-development-wheel'||args.length!==7)throw Error('explicit_prepare_and_three_paths_required');const opts={};for(let i=1;i<args.length;i+=2){const key={'--python-source':'pythonSource','--output':'output','--pkg-config':'pkgConfig'}[args[i]];if(!key||opts[key])throw Error('invalid_arguments');opts[key]=args[i+1];}
 const controller=new AbortController();process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());await prepare(opts,{signal:controller.signal,emit:x=>console.log(JSON.stringify(x))});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(JSON.stringify({event:'error',code:e.message}));process.exitCode=1;});
