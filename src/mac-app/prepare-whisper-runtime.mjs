// 개발 빌드 전용. 사용자의 Python·venv·전역 패키지를 수정하지 않는다.
import fs from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import https from 'node:https';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
export const PYTHON=Object.freeze({version:'3.12.16',release:'20261110',filename:'python.tar.gz',size:25371130,sha256:'e956e60bc9465d577ef8062059aa05cd3a2665b4b8678a2ed24e432368330b8f',url:'https://github.com/astral-sh/python-build-standalone/releases/download/20261110/cpython-3.12.16%2B20261110-aarch64-apple-darwin-install_only.tar.gz',license:'Python distribution and bundled dependency notices; release review required'});
export const WHEELS=Object.freeze([
  {
    "name": "anyio",
    "version": "4.16.0",
    "filename": "anyio-4.16.0-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/a9/16/7757fb84c819accc7d7e9af5291b261e4abb8627ee040f99e7d35ef2457a/anyio-4.16.0-py3-none-any.whl",
    "size": 134521,
    "sha256": "c66ae634e0b8228396b801741beb3294326d4b6102f7bba4041c0dfb58c29026",
    "license": "MIT"
  },
  {
    "name": "av",
    "version": "19.0.2",
    "filename": "av-19.0.2-cp312-abi3-macosx_14_0_arm64.whl",
    "url": "https://files.pythonhosted.org/packages/7c/42/067d0bcd2c07103f18cc23b510a8289dd80330e984c49d51ce0bafcee017/av-19.0.2-cp312-abi3-macosx_14_0_arm64.whl",
    "size": 18556422,
    "sha256": "b0dff6dfcc6ff9944fbbff15bc4ee2d90a2c1695d493bdea96e86f48823e9feb",
    "license": "BSD-3-Clause"
  },
  {
    "name": "click",
    "version": "8.5.1",
    "filename": "click-8.5.1-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/31/7d/164b7ffc8624fe9efb4221bf9af485d5c1e41b9ae118045d2b6dc5457d8b/click-8.5.1-py3-none-any.whl",
    "size": 126163,
    "sha256": "8bb5376d2006950386f8c6427613334a2acadc5f559cb80e638d00b4df957e37",
    "license": "BSD-3-Clause"
  },
  {
    "name": "ctranslate2",
    "version": "4.9.0",
    "filename": "ctranslate2-4.9.0-cp312-cp312-macosx_11_0_arm64.whl",
    "url": "https://files.pythonhosted.org/packages/6e/75/4a4a3de8a92f288c3bd6b38d744d3dd3fb7fb28cb8afc2daf374d5bf2500/ctranslate2-4.9.0-cp312-cp312-macosx_11_0_arm64.whl",
    "size": 1662843,
    "sha256": "ca2cc29f5d561e231c15e9e97b13dcbd1913d6615b727fafa1eeffcb0c1f242a",
    "license": "MIT"
  },
  {
    "name": "faster-whisper",
    "version": "1.2.1",
    "filename": "faster_whisper-1.2.1-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/05/99/49ee85903dee060d9f08297b4a342e5e0bcfca2f027a07b4ee0a38ab13f9/faster_whisper-1.2.1-py3-none-any.whl",
    "size": 1118909,
    "sha256": "79a66ad50688c0b794dd501dc340a736992a6342f7f95e5811be60b5224a26a7",
    "license": "MIT"
  },
  {
    "name": "filelock",
    "version": "4.2.12",
    "filename": "filelock-4.2.12-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/8a/c9/eb6b6528c7edb958d4c24ac47a8b94113d9de36e4cfc6eecd599b1a4f349/filelock-4.2.12-py3-none-any.whl",
    "size": 222442,
    "sha256": "21decfec02f116ed4c954433cdb31f28c3b346b784543177b6d7059da2702ee9",
    "license": "MIT"
  },
  {
    "name": "flatbuffers",
    "version": "25.12.19",
    "filename": "flatbuffers-25.12.19-py2.py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/e8/2d/d2a548598be01649e2d46231d151a6c56d10b964d94043a335ae56ea2d92/flatbuffers-25.12.19-py2.py3-none-any.whl",
    "size": 26661,
    "sha256": "7634f50c427838bb021c2d66a3d1168e9d199b0607e6329399f04846d42e20b4",
    "license": "Apache 2.0"
  },
  {
    "name": "fsspec",
    "version": "2026.9.0",
    "filename": "fsspec-2026.9.0-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/6c/c0/a98505f18594f1bce828bb159cec0fcf9860562f1a2c85913409fc8f3d9e/fsspec-2026.9.0-py3-none-any.whl",
    "size": 221738,
    "sha256": "8dd6e646e99ea382bd85f97a45e6b526a442d79423a7dc673f1e2756d05fcb5f",
    "license": "BSD-3-Clause"
  },
  {
    "name": "h11",
    "version": "0.16.0",
    "filename": "h11-0.16.0-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/04/4b/29cac41a4d98d144bf5f6d33995617b185d14b22401f75ca86f384e87ff1/h11-0.16.0-py3-none-any.whl",
    "size": 37515,
    "sha256": "63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86",
    "license": "MIT"
  },
  {
    "name": "hf-xet",
    "version": "1.8.0",
    "filename": "hf_xet-1.8.0-cp38-abi3-macosx_11_0_arm64.whl",
    "url": "https://files.pythonhosted.org/packages/d4/f2/ef25e2085e92dcaeaa675331e443923aed2006f6fe2d984e15d8b8d40766/hf_xet-1.8.0-cp38-abi3-macosx_11_0_arm64.whl",
    "size": 3600947,
    "sha256": "3e8934784425781f0f779b91044df441f3a7af4dab47375d7e3aeaecbb8eecb4",
    "license": "Apache-2.0"
  },
  {
    "name": "httpcore2",
    "version": "2.16.2",
    "filename": "httpcore2-2.16.2-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/2a/e8/009c347feac27f8960605aa98d55ed263b5870dd4fd80b82fd1d00d5716c/httpcore2-2.16.2-py3-none-any.whl",
    "size": 85551,
    "sha256": "16051ae2a42f776007543f32de9349a317b23d2cbb4e1456b4bac0e88b87419a",
    "license": "BSD-3-Clause"
  },
  {
    "name": "httpx2",
    "version": "2.16.2",
    "filename": "httpx2-2.16.2-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/77/de/8c4306a3d6aa2495111986addf33a9e561eff4c47552e4c4b9251160d0ad/httpx2-2.16.2-py3-none-any.whl",
    "size": 97893,
    "sha256": "f05c13aade4c45dbf1c9060647a1058f0acad62398fad96e741269edb33d46f5",
    "license": "BSD-3-Clause"
  },
  {
    "name": "huggingface_hub",
    "version": "2.4.0",
    "filename": "huggingface_hub-2.4.0-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/d4/55/ff47f1b082ecf5f43f4bc1e3b932d68eead171dabbbd1a92666c686301d7/huggingface_hub-2.4.0-py3-none-any.whl",
    "size": 857021,
    "sha256": "42ecfd93ede47bdd333daebbf66a32d7bfe2e18752754fe4d2d4f98a0179d801",
    "license": "Apache-2.0"
  },
  {
    "name": "idna",
    "version": "3.20",
    "filename": "idna-3.20-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/58/a2/bb081bab032533a855d44de1d56f8e8426114ff1ba5d1f07a438a0a654f8/idna-3.20-py3-none-any.whl",
    "size": 69583,
    "sha256": "ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c",
    "license": "BSD-3-Clause"
  },
  {
    "name": "numpy",
    "version": "2.5.5",
    "filename": "numpy-2.5.5-cp312-cp312-macosx_14_0_arm64.whl",
    "url": "https://files.pythonhosted.org/packages/8a/92/6de34324a266b73c04ba977db5864b9016500076b26f09078a565f527d34/numpy-2.5.5-cp312-cp312-macosx_14_0_arm64.whl",
    "size": 5513680,
    "sha256": "a3856a97e48ed8371c680fb04120b99fbcc29f2076ebe6dc3deb34f77947c5ca",
    "license": "BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0"
  },
  {
    "name": "onnxruntime",
    "version": "1.32.0",
    "filename": "onnxruntime-1.32.0-cp312-cp312-macosx_14_0_arm64.whl",
    "url": "https://files.pythonhosted.org/packages/6f/a4/480cd367bc135dd9951c89d461cc6af6be9302cd2ce91e231f6cb0e7ee1b/onnxruntime-1.32.0-cp312-cp312-macosx_14_0_arm64.whl",
    "size": 22519308,
    "sha256": "d52510bbbcc880c13b826f7d75cdf33ac5cf0bb864d960000fc29ce73f0cb83e",
    "license": "MIT License"
  },
  {
    "name": "packaging",
    "version": "26.3",
    "filename": "packaging-26.3-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/63/34/ba1c580383c9eada3711951fef0795c80b829a078d72188184bcab9dd527/packaging-26.3-py3-none-any.whl",
    "size": 129956,
    "sha256": "d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c",
    "license": "Apache-2.0 OR BSD-2-Clause"
  },
  {
    "name": "protobuf",
    "version": "7.36.2",
    "filename": "protobuf-7.36.2-cp310-abi3-macosx_10_9_universal2.whl",
    "url": "https://files.pythonhosted.org/packages/32/72/98342feb672507c8f3a69e34b4fa8961f608edba5c1a48a6f47156d92cb5/protobuf-7.36.2-cp310-abi3-macosx_10_9_universal2.whl",
    "size": 456039,
    "sha256": "cbc70b17ee27e28894c7fee8bb04be1abead49e936bc70eb60052531eee2079e",
    "license": "3-Clause BSD License"
  },
  {
    "name": "PyYAML",
    "version": "6.0.3",
    "filename": "pyyaml-6.0.3-cp312-cp312-macosx_11_0_arm64.whl",
    "url": "https://files.pythonhosted.org/packages/89/a0/6cf41a19a1f2f3feab0e9c0b74134aa2ce6849093d5517a0c550fe37a648/pyyaml-6.0.3-cp312-cp312-macosx_11_0_arm64.whl",
    "size": 173973,
    "sha256": "fc09d0aa354569bc501d4e787133afc08552722d3ab34836a80547331bb5d4a0",
    "license": "MIT"
  },
  {
    "name": "socksio",
    "version": "1.0.0",
    "filename": "socksio-1.0.0-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/37/c3/6eeb6034408dac0fa653d126c9204ade96b819c936e136c5e8a6897eee9c/socksio-1.0.0-py3-none-any.whl",
    "size": 12763,
    "sha256": "95dc1f15f9b34e8d7b16f06d74b8ccf48f609af32ab33c608d08761c5dcbb1f3",
    "license": "UNKNOWN"
  },
  {
    "name": "tokenizers",
    "version": "0.23.3",
    "filename": "tokenizers-0.23.3-cp310-abi3-macosx_11_0_arm64.whl",
    "url": "https://files.pythonhosted.org/packages/b2/72/01e49f032bb346e5aaf06c10c74fe8aeec847173adbadd66eb7c53054bf2/tokenizers-0.23.3-cp310-abi3-macosx_11_0_arm64.whl",
    "size": 3101381,
    "sha256": "68649e97d5b43c44c031d8d848874a6eecae8f8fe40ea989aa777a5a83aca716",
    "license": "See wheel license files"
  },
  {
    "name": "tqdm",
    "version": "4.70.1",
    "filename": "tqdm-4.70.1-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/a7/03/921a3d3c75785aca9ebfbfcabfbc3a1be12e2ab5265deb026d55a5a3f83e/tqdm-4.70.1-py3-none-any.whl",
    "size": 80199,
    "sha256": "c293e525e6fef9c20e8728fd4612df02a0aa31bb5fe91ecd93e123b1b7bffa73",
    "license": "MPL-2.0 AND MIT"
  },
  {
    "name": "truststore",
    "version": "0.10.5",
    "filename": "truststore-0.10.5-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/51/e9/3a7820be2bb0fe53b6bc9c3be26d3d1158004e4c3ab953aa6840b955b1e9/truststore-0.10.5-py3-none-any.whl",
    "size": 19017,
    "sha256": "9aaaedaefaf06d8b206278cf8b5012bc897f485a874503501e12d776df78951c",
    "license": "MIT"
  },
  {
    "name": "typing_extensions",
    "version": "4.16.0",
    "filename": "typing_extensions-4.16.0-py3-none-any.whl",
    "url": "https://files.pythonhosted.org/packages/49/d3/b8441a820a491ddfc024b0b0cf0393375b75ea13866d9c66727e54c2fc80/typing_extensions-4.16.0-py3-none-any.whl",
    "size": 45571,
    "sha256": "481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8",
    "license": "PSF-2.0"
  }
]);
const bundleName='whisper-portable-3.12.16';
const marker='ahmatda-runtime-manifest.json';
export const manifestHash=createHash('sha256').update(JSON.stringify({python:PYTHON,wheels:WHEELS})).digest('hex');
const totalBytes=PYTHON.size+WHEELS.reduce((s,x)=>s+x.size,0);
async function safeDirectory(dir){const p=path.dirname(dir);if(p!==dir)await safeDirectory(p);try{await fs.mkdir(dir,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}const s=await fs.lstat(dir);if(!s.isDirectory()||s.isSymbolicLink())throw Error('unsafe_path');}
export async function verifyFile(file,item,signal){signal?.throwIfAborted();let s;try{s=await fs.lstat(file);}catch(e){if(e.code==='ENOENT')return false;throw e;}if(!s.isFile()||s.isSymbolicLink()||s.size!==item.size)return false;const h=createHash('sha256');for await(const c of createReadStream(file,{signal}))h.update(c);return h.digest('hex')===item.sha256;}
export function approvedURL(url,item,redirect=false){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;if(url===item.url)return true;return redirect&&item.url===PYTHON.url&&u.hostname==='release-assets.githubusercontent.com'&&u.pathname.startsWith('/github-production-release-asset/');}
export function download(url,target,item,{signal,emit=()=>{},redirects=0}={}){return new Promise((resolve,reject)=>{
 if(!approvedURL(url,item,redirects>0))return reject(Error('unapproved_source'));
 const req=https.get(url,{agent:false,signal,headers:{'user-agent':'Ahmatda-runtime-builder/1'}},res=>{
  if([301,302,303,307,308].includes(res.statusCode)){const loc=res.headers.location;res.destroy();if(!loc||redirects>=3)return reject(Error('redirect_limit'));let next;try{next=new URL(loc,url).href;}catch{return reject(Error('unapproved_redirect'));}if(!approvedURL(next,item,true))return reject(Error('unapproved_redirect'));download(next,target,item,{signal,emit,redirects:redirects+1}).then(resolve,reject);return;}
  if(res.statusCode!==200){res.destroy();return reject(Error('download_http_'+res.statusCode));}
  if(res.headers['content-length']!==undefined&&Number(res.headers['content-length'])!==item.size){res.destroy();return reject(Error('size_mismatch'));}
  let count=0,last=0;const limit=new Transform({transform(chunk,enc,done){count+=chunk.length;if(count>item.size)return done(Error('size_limit'));if(Date.now()-last>500){last=Date.now();emit({event:'progress',file:item.filename,completed:count,total:item.size});}done(null,chunk);}});
  pipeline(res,limit,createWriteStream(target,{flags:'wx',mode:0o600}),{signal}).then(()=>{if(count!==item.size)throw Error('size_mismatch');resolve();}).catch(reject);
 });req.setTimeout(30_000,()=>req.destroy(Error('download_timeout')));req.on('error',reject);
});}
export function archiveNamesSafe(text){return text.trim().split('\n').every(name=>name==='python/'||(name.startsWith('python/')&&!name.split('/').includes('..')&&!name.includes('\\')&&!name.includes('\0')));}
export function run(executable,args,{cwd,signal}={}){return new Promise((resolve,reject)=>{
 const child=spawn(executable,args,{cwd,signal,env:{PATH:'/usr/bin:/bin',HOME:cwd||'/tmp',LANG:'en_US.UTF-8',PYTHONDONTWRITEBYTECODE:'1',HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1'},stdio:['ignore','pipe','pipe']});
 let out='',bytes=0,failed;
 for(const stream of [child.stdout,child.stderr])stream.on('data',c=>{bytes+=c.length;if(bytes>2*1024*1024){failed=Error('process_output_limit');child.kill('SIGTERM');}else out+=c;});
 child.on('error',e=>{failed=e;});
 child.on('close',code=>{if(failed)reject(failed);else if(code!==0)reject(Error('runtime_build_step_failed'));else resolve(out);});
});}
// 설치 후 실제 런타임 파일과 내부 상대 symlink를 기록한다. 외부 Python 의존은 거절한다.
export async function inventory(root,signal){const entries=[];
 async function walk(relative){for(const name of await fs.readdir(path.join(root,relative))){signal?.throwIfAborted();const rel=path.join(relative,name);if(rel===marker)continue;const file=path.join(root,rel),s=await fs.lstat(file);
  if(s.isSymbolicLink()){const target=await fs.readlink(file);const resolved=path.resolve(path.dirname(file),target);if(path.isAbsolute(target)||!(resolved===root||resolved.startsWith(root+path.sep)))throw Error('external_runtime_symlink');entries.push({path:rel,link:target});}
  else if(s.isDirectory())await walk(rel);
  else if(s.isFile()){const hash=createHash('sha256');for await(const chunk of createReadStream(file,{signal}))hash.update(chunk);entries.push({path:rel,size:s.size,sha256:hash.digest('hex')});}
  else throw Error('unsupported_runtime_file');
 }}await walk('');return entries.sort((a,b)=>a.path.localeCompare(b.path));}
export async function inspect(root,{signal}={}){const target=path.join(root,'runtime',bundleName);let prepared=false,filesVerified=false;
 try{const meta=JSON.parse(await fs.readFile(path.join(target,marker),'utf8'));prepared=meta.manifestHash===manifestHash;
  if(prepared)filesVerified=JSON.stringify(meta.inventory)===JSON.stringify(await inventory(target,signal));
 }catch(e){if(signal?.aborted)throw e;}
 return {event:'status',runtime:'whisper-portable',pythonVersion:PYTHON.version,platform:'darwin-arm64',downloadBytes:totalBytes,prepared,filesVerified,inferenceVerified:false,developerPreparationOnly:true,distributionSigningVerified:false,automaticSystemInstall:false};}
export async function buildStage(stage,{signal,emit=()=>{},transfer=download}={}){
 const downloads=path.join(stage,'downloads');const output=path.join(stage,'bundle');await fs.mkdir(downloads);await fs.mkdir(output);
 for(const item of [PYTHON,...WHEELS]){signal?.throwIfAborted();const file=path.join(downloads,item.filename);await transfer(item.url,file,item,{signal,emit});if(!await verifyFile(file,item,signal))throw Error('checksum_mismatch');}
 emit({event:'building',step:'extract-python'});
 const archive=path.join(downloads,PYTHON.filename);const listing=await run('/usr/bin/tar',['-tzf',archive],{cwd:stage,signal});if(!archiveNamesSafe(listing))throw Error('unsafe_archive');
 await run('/usr/bin/tar',['-xzf',archive,'-C',output,'--no-same-owner'],{cwd:stage,signal});
 const python=path.join(output,'python/bin/python3.12');
 const requirements=path.join(stage,'requirements.lock');await fs.writeFile(requirements,WHEELS.map(x=>`${x.name}==${x.version} --hash=sha256:${x.sha256}`).join('\n')+'\n');
 emit({event:'building',step:'install-pinned-wheels-offline'});
 await run(python,['-I','-B','-m','pip','--isolated','install','--no-index','--no-deps','--no-compile','--only-binary=:all:','--require-hashes','--find-links',downloads,'-r',requirements],{cwd:stage,signal});
 await run(python,['-I','-B','-m','pip','--isolated','check'],{cwd:stage,signal});
 await run(python,['-I','-B','-c','import faster_whisper,ctranslate2,numpy; assert faster_whisper.__version__ == "1.2.1"; print("imports_ok")'],{cwd:stage,signal});
 // pip의 실행 스크립트 shebang은 stage 절대경로다. 지원 진입점은 Python -I 뿐이다.
 await fs.writeFile(path.join(output,'BUILD-NOTICE.txt'),'Development-only portable Python runtime. Use python/bin/python3.12 -I. Do not use generated pip or console scripts after relocation. All bundled license files are retained; final redistribution review, Developer ID signing and notarization remain required.\n');
 return output;
}
export async function prepare(root,{signal,emit=()=>{},builder=buildStage,platform=process.platform,arch=process.arch}={}){
 if(platform!=='darwin'||arch!=='arm64')throw Error('requires_macos_arm64');root=path.resolve(root);await safeDirectory(root);const runtime=path.join(root,'runtime');await safeDirectory(runtime);const dest=path.join(runtime,bundleName);const lock=path.join(runtime,'.portable-whisper-prepare.lock');let owned=false,stage;
 try{try{await fs.mkdir(lock,{mode:0o700});owned=true;}catch(e){if(e.code==='EEXIST')throw Error('preparation_busy_or_interrupted_lock');throw e;}
  const state=await inspect(root,{signal});emit(state);if(state.filesVerified){emit({event:'ready',runtime:'whisper-portable',inferenceVerified:false});return;}
  try{await fs.lstat(dest);throw Error('existing_runtime_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
  const disk=await fs.statfs(runtime);if(disk.bavail*disk.bsize<1024*1024*1024)throw Error('insufficient_disk_space');
  stage=await fs.mkdtemp(path.join(runtime,'.portable-stage-'));emit({event:'preparing',downloadBytes:totalBytes,pythonVersion:PYTHON.version,wheels:WHEELS.length,developerPreparationOnly:true});
  const output=await builder(stage,{signal,emit});if(path.dirname(output)!==stage)throw Error('invalid_builder_output');
  const files=await inventory(output,signal);await fs.writeFile(path.join(output,marker),JSON.stringify({manifestHash,inventory:files,python:PYTHON,wheels:WHEELS},null,2),{flag:'wx',mode:0o600});signal?.throwIfAborted();
  try{await fs.lstat(dest);throw Error('destination_created_during_prepare');}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.rename(output,dest);emit({event:'ready',runtime:'whisper-portable',inferenceVerified:false});
 }finally{if(stage)await fs.rm(stage,{recursive:true,force:true});if(owned)await fs.rmdir(lock);}
}
async function main(){const args=process.argv.slice(2);if(args.length>1||(args.length&&!['--status','--prepare-development-runtime'].includes(args[0])))throw Error('usage: --status | --prepare-development-runtime');const c=new AbortController();process.once('SIGINT',()=>c.abort());process.once('SIGTERM',()=>c.abort());const root=path.join(homedir(),'Library/Application Support/Ahmatda');const emit=x=>process.stdout.write(JSON.stringify(x)+'\n');if(args[0]==='--prepare-development-runtime')await prepare(root,{signal:c.signal,emit});else emit(await inspect(root,{signal:c.signal}));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{process.stdout.write(JSON.stringify({event:'error',code:e.name==='AbortError'?'cancelled':e.message})+'\n');process.exitCode=1;});
