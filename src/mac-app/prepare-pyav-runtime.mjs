// 개발용 대안 런타임. 기본 WHEELS·앱·기존 설치·선택 경로를 바꾸지 않는다.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyRuntime as verifyBase,copyVerifiedRuntime} from './install-whisper-runtime.mjs';
import {inventory,verifyFile,manifestHash as baseManifestHash} from './prepare-whisper-runtime.mjs';
import {SOURCE as FFMPEG,run} from './prepare-audio-runtime.mjs';
import {MANIFEST,CONFIG} from './prepare-pyav-wheel.mjs';
const MARKER='ahmatda-runtime-manifest.json';
export const KIND='development-whisper-pyav-lgpl-v1';
export async function safeDirectory(dir){dir=path.resolve(dir);const parent=path.dirname(dir);if(parent!==dir)await safeDirectory(parent);const st=await fs.lstat(dir);if(!st.isDirectory()||st.isSymbolicLink())throw Error('unsafe_directory');}
async function jsonFile(file){const st=await fs.lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size>4*1024*1024)throw Error('unsafe_metadata');return JSON.parse(await fs.readFile(file,'utf8'));}
export async function validatePaths({sourceRuntime,wheelBuild,output}){
 if(!sourceRuntime||!wheelBuild||!output)throw Error('three_explicit_paths_required');const source=path.resolve(sourceRuntime),build=path.resolve(wheelBuild),dest=path.resolve(output);
 await safeDirectory(source);await safeDirectory(build);await safeDirectory(path.dirname(dest));
 for(const existing of [source,build])if(dest===existing||dest.startsWith(existing+path.sep)||existing.startsWith(dest+path.sep))throw Error('overlapping_paths');
 try{await fs.lstat(dest);throw Error('existing_output_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
 return{source,build,dest};
}
export async function verifyBuild(build,{signal}={}){
 await safeDirectory(build);const files=await inventory(build,signal);if(files.some(x=>x.link))throw Error('build_symlink_rejected');
 const meta=await jsonFile(path.join(build,'build-manifest.json'));
 if(JSON.stringify(meta.ffmpeg)!==JSON.stringify(FFMPEG)||JSON.stringify(meta.pyav)!==JSON.stringify(MANIFEST.pyav)||JSON.stringify(meta.buildWheels)!==JSON.stringify(MANIFEST.buildWheels))throw Error('build_sources_mismatch');
 if(!Array.isArray(meta.configure)||meta.configure.length!==CONFIG.length+1||!meta.configure[0].startsWith('--prefix=')||JSON.stringify(meta.configure.slice(1))!==JSON.stringify(CONFIG))throw Error('build_configuration_mismatch');
 for(const item of [FFMPEG,MANIFEST.pyav])if(!await verifyFile(path.join(build,'sources',item.filename),item,signal))throw Error('source_checksum_mismatch');
 const wheel=meta.builtWheelFiles?.[0];if(meta.builtWheelFiles?.length!==1||wheel.path!=='av-19.0.2-cp312-abi3-macosx_14_0_arm64.whl'||!/^[a-f0-9]{64}$/.test(wheel.sha256)||!Number.isSafeInteger(wheel.size))throw Error('invalid_wheel_record');
 if(!await verifyFile(path.join(build,'wheels',wheel.path),wheel,signal))throw Error('wheel_checksum_mismatch');
 const audit=await jsonFile(path.join(build,'logs/audit-wheel.log'));
 if(audit.pyav!=='19.0.2'||audit.license!=='LGPL version 2.1 or later'||!Array.isArray(audit.files)||audit.files.length<7)throw Error('invalid_build_audit');
 for(const x of audit.files)for(const dep of x.dependencies||[])if(/x26[45]/.test(dep)||(dep.startsWith('/')&&!dep.startsWith('/usr/lib/')&&!dep.startsWith('/System/Library/')))throw Error('unsafe_build_dependencies');
 return{wheel,inventory:files,buildManifest:meta};
}
export async function inspect(output,{signal}={}){
 await safeDirectory(output);const meta=await jsonFile(path.join(output,MARKER));
 if(meta.kind!==KIND||meta.baseManifestHash!==baseManifestHash||!Array.isArray(meta.inventory)||!meta.wheel?.sha256)throw Error('alternative_runtime_manifest_mismatch');
 if(JSON.stringify(meta.inventory)!==JSON.stringify(await inventory(output,signal)))throw Error('alternative_runtime_inventory_mismatch');
 return{event:'status',kind:KIND,filesVerified:true,networkRequired:false,defaultRuntimeChanged:false,distributionReady:false,verification:'local-build-inventory-change-detection',publisherSignatureVerified:false,inferenceVerified:false,wheelSHA256:meta.wheel.sha256};
}
const ZIP_CHECK=String.raw`
import zipfile,sys,pathlib,stat
with zipfile.ZipFile(sys.argv[1]) as z:
 for i in z.infolist():
  p=pathlib.PurePosixPath(i.filename)
  assert not p.is_absolute() and '..' not in p.parts and chr(92) not in i.filename
  assert not stat.S_ISLNK(i.external_attr >> 16)
`;
const AUDIT=String.raw`
import av,pathlib,subprocess,re,json,ctypes,importlib.metadata as md
base=pathlib.Path(av.__file__).parent;records=[]
for p in list(base.rglob('*.so'))+list(base.rglob('*.dylib')):
 assert not re.search('x26[45]',p.name)
 assert 'arm64' in subprocess.check_output(['/usr/bin/file','-b',str(p)],text=True)
 deps=[]
 for block in subprocess.check_output(['/usr/bin/otool','-l',str(p)],text=True).split('Load command '):
  if re.search(r'cmd LC_(?:LOAD|LOAD_WEAK|REEXPORT)_DYLIB',block):
   m=re.search(r'name (\S+) \(offset',block)
   if m:
    dep=m[1];assert not re.search('x26[45]',dep)
    assert not dep.startswith('/') or dep.startswith(('/usr/lib/','/System/Library/'))
    deps.append(dep)
 subprocess.run(['/usr/bin/codesign','--verify','--strict',str(p)],check=True,capture_output=True)
 records.append({'path':str(p.relative_to(base)),'dependencies':deps})
lib=ctypes.CDLL(str(next(base.rglob('libavcodec.*.dylib'))));lib.avcodec_license.restype=ctypes.c_char_p;lib.avcodec_configuration.restype=ctypes.c_char_p
license=lib.avcodec_license().decode();config=lib.avcodec_configuration().decode()
assert license=='LGPL version 2.1 or later'
for x in ['gpl','nonfree','version3','network','autodetect','libx264','libx265']:assert '--disable-'+x in config
for x in ['gpl','nonfree','version3','libx264','libx265']:assert '--enable-'+x not in config
packages=sorted((d.metadata['Name'].lower().replace('_','-'),d.version) for d in md.distributions())
print(json.dumps({'license':license,'configure':config,'files':records,'packages':packages,'distributionReady':False},indent=2))
`;
export async function buildCandidate(stage,{source,build,signal,emit=()=>{}}){
 const baseline=await verifyBase(source,{signal});const verified=await verifyBuild(build,{signal});
 const candidate=path.join(stage,'candidate');await copyVerifiedRuntime(source,candidate,{signal,privateFiles:true});const py=path.join(candidate,'python/bin/python3.12');
 async function step(name,args){signal?.throwIfAborted();emit({event:'preparing',step:name});return run(py,['-I','-B',...args],{cwd:stage,signal});}
 const packages=JSON.parse(await step('baseline-packages',['-c',"import importlib.metadata as m,json; print(json.dumps(sorted((d.metadata['Name'].lower().replace('_','-'),d.version) for d in m.distributions())))"]));
 const wheelSource=path.join(build,'wheels',verified.wheel.path),wheel=path.join(stage,verified.wheel.path);await fs.copyFile(wheelSource,wheel,fs.constants.COPYFILE_EXCL);if(!await verifyFile(wheel,verified.wheel,signal))throw Error('copied_wheel_checksum_mismatch');
 await step('wheel-path-check',['-c',ZIP_CHECK,wheel]);
 await step('remove-old-av',['-m','pip','--isolated','uninstall','-y','av']);
 await step('old-av-absent',['-c',"import importlib.util; assert importlib.util.find_spec('av') is None"]);
 await step('install-alternative-av',['-m','pip','--isolated','install','--no-index','--no-deps','--no-compile',wheel]);
 const audit=JSON.parse(await step('verify-alternative-libraries',['-c',AUDIT]));if(JSON.stringify(packages)!==JSON.stringify(audit.packages))throw Error('unexpected_package_set_change');
 const materials=path.join(candidate,'pyav-redistribution');await fs.mkdir(materials);
 await fs.cp(path.join(build,'sources'),path.join(materials,'sources'),{recursive:true,dereference:false,verbatimSymlinks:true,errorOnExist:true,force:false});await fs.copyFile(path.join(build,'build-manifest.json'),path.join(materials,'wheel-build-manifest.json'));await fs.copyFile(path.join(build,'NOTICE.txt'),path.join(materials,'wheel-build-NOTICE.txt'));
 await fs.writeFile(path.join(materials,'runtime-audit.json'),JSON.stringify(audit,null,2));
 if(JSON.stringify(baseline.inventory)!==JSON.stringify((await verifyBase(source,{signal})).inventory))throw Error('base_runtime_changed');
 if(JSON.stringify(verified.inventory)!==JSON.stringify((await verifyBuild(build,{signal})).inventory))throw Error('build_input_changed');
 // 별도 kind로 기본 설치기의 manifest와 혼동하지 않게 한다. 이전 경로는 그대로 둔다.
 const files=await inventory(candidate,signal);await fs.writeFile(path.join(candidate,MARKER),JSON.stringify({kind:KIND,baseManifestHash,wheel:verified.wheel,inventory:files,packageSet:packages,developerOnly:true,distributionReady:false},null,2),{mode:0o600});await inspect(candidate,{signal});return candidate;
}
export async function prepare(options,{signal,emit=()=>{},builder=buildCandidate,platform=process.platform,arch=process.arch}={}){
 if(platform!=='darwin'||arch!=='arm64')throw Error('requires_macos_arm64');const args=await validatePaths(options);const disk=await fs.statfs(path.dirname(args.dest));if(disk.bavail*disk.bsize<1024**3)throw Error('insufficient_disk_space');
 let stage,owned=false;const lock=args.dest+'.prepare-lock';
 try{await fs.mkdir(lock,{mode:0o700});owned=true;stage=await fs.mkdtemp(path.join(path.dirname(args.dest),'.pyav-runtime-'));signal?.throwIfAborted();const candidate=await builder(stage,{...args,signal,emit});if(path.dirname(candidate)!==stage)throw Error('invalid_candidate');signal?.throwIfAborted();
  await fs.mkdir(args.dest,{mode:0o700});try{for(const name of await fs.readdir(candidate)){signal?.throwIfAborted();await fs.rename(path.join(candidate,name),path.join(args.dest,name));}}catch(e){await fs.rm(args.dest,{recursive:true,force:true});throw e;}
  emit({event:'ready',output:args.dest,kind:KIND,defaultRuntimeChanged:false,distributionReady:false});
 }finally{if(stage)await fs.rm(stage,{recursive:true,force:true});if(owned)await fs.rmdir(lock);}
}
async function main(){const args=process.argv.slice(2);if(!args.length||args.length===1&&args[0]==='--status'){console.log(JSON.stringify({event:'status',explicitPreparationRequired:true,networkRequired:false,defaultRuntimeChanged:false}));return;}
 const controller=new AbortController();process.once('SIGTERM',()=>controller.abort());process.once('SIGINT',()=>controller.abort());
 if(args.length===2&&args[0]==='--inspect'){console.log(JSON.stringify(await inspect(path.resolve(args[1]),{signal:controller.signal})));return;}
 if(args.length!==7||args[0]!=='--prepare-development-runtime')throw Error('explicit_prepare_and_three_paths_required');const options={};for(let i=1;i<args.length;i+=2){const key={'--source-runtime':'sourceRuntime','--wheel-build':'wheelBuild','--output':'output'}[args[i]];if(!key||options[key])throw Error('invalid_arguments');options[key]=args[i+1];}await prepare(options,{signal:controller.signal,emit:x=>console.log(JSON.stringify(x))});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(JSON.stringify({event:'error',code:e.message}));process.exitCode=1;});
