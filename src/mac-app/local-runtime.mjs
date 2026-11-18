// 앱 전용 Ollama 감독기. 다운로드·유료 API·다른 프로세스 제어를 하지 않는다.
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const VERSION = '0.40.16';
export const PORT = 11435;
export const ARCHIVE_SHA256 = 'a743717494315da7cd352982b805f6b992d4b4452ca117fd5fbf86c4ee46fca0';
// 공식 위 archive의 실행 데이터에서 산출했다. macOS가 xattr로 푸는 AppleDouble 메타데이터는 제외한다.
// 나머지 일반 파일·정확한 상대 symlink 및 별도로 받은 공식 MIT LICENSE를 검증한다.
export const RUNTIME_FILES = Object.freeze([{"path":"ollama","size":78301616,"sha256":"5c3cf935be8d896433a5caefefc8857bc2bb9e32c77c35e7c3d38b7c5919822f"},{"path":"llama-server","size":20023632,"sha256":"3806b140070f86d9fb4ab6eb90bebeda995bcba313a17590d34d3332d406e951"},{"path":"llama-quantize","size":11924544,"sha256":"61e9a567d9e89ee6169203457cf679db810bd5d8432c88c7feda1bbd134ff66c"},{"path":"libggml-blas.so","size":52560,"sha256":"2a02cbfc099941f578e6e348533e9e3636cd75e6abbe2efdc3d24e8693fa1a2c"},{"path":"libggml-cpu-alderlake.so","size":1585008,"sha256":"47cfd7c56e864b97f62f96303507879e29250417a0037a24da912af6bae919bd"},{"path":"libggml-cpu-cannonlake.so","size":1853312,"sha256":"ebd24f955f108c4c933a1f21a496852ded68bcefcb40e557127d9777c9f03f4f"},{"path":"libggml-cpu-cascadelake.so","size":1825808,"sha256":"6f42a81e858e40b8f3630c9ada718e15952e078c40ef3080aeb311603d2a4994"},{"path":"libggml-cpu-cooperlake.so","size":1825936,"sha256":"a53e0d9f07db33115795093ce51e3ed7c5e6a8367b5825389ef856b13103a0e9"},{"path":"libggml-cpu-haswell.so","size":1593264,"sha256":"be36d9cffcdf474185d0fc65d6dbf54bbf8b6b59dc10f4dcb80bcfb8f52dbcf3"},{"path":"libggml-cpu-icelake.so","size":1834064,"sha256":"df973a0e8ce9f556a5225cca692c94810b66f6847accb017c54e0a29efdbd654"},{"path":"libggml-cpu-ivybridge.so","size":1433376,"sha256":"fbe4638ae7fb15265577d4b847bdff59f3af9c0add54ad3ba0862c2d6a0f36dc"},{"path":"libggml-cpu-piledriver.so","size":1445680,"sha256":"c7e62fec218ad7d26a9d08820fd71614a8ff1d0a0ae17d73a77d0355028554c4"},{"path":"libggml-cpu-sandybridge.so","size":1453152,"sha256":"c1f20e2d595857150f67bc11b7baad1a729cf4cad5ba84c5094a371a7ff875ee"},{"path":"libggml-cpu-sapphirerapids.so","size":2068816,"sha256":"e7f17f8bcfd0e1543e4fde96f513fe11151bdd298164a7d9674ef2deca98256e"},{"path":"libggml-cpu-skylakex.so","size":1845056,"sha256":"04dbe94dd99b1bb220237540582d4fd2834d67ad77c8402dc9ac10b562a67c2a"},{"path":"libggml-cpu-sse42.so","size":1087664,"sha256":"1c4fdf66b6bbe3307d1a74918cf57d3fd76e9a5b2b6f8922094c3633c4395990"},{"path":"libggml-cpu-x64.so","size":1100048,"sha256":"557200f6e51c22c07f8bb26c25885ccf382e4ebb78a935a14380b2eb690aa4d2"},{"path":"libggml-cpu-zen4.so","size":1834192,"sha256":"9cd65ed41697f6bf690fe8c645849c076c14b950820e320196ddf7c97e4cfc9d"},{"path":"libggml-base.0.29.0.dylib","size":823568,"sha256":"e70a97307235a39ee84d78a7398776dabeb4962952081cdfe1b9244cd691a0ef"},{"path":"libggml-base.0.dylib","link":"libggml-base.0.29.0.dylib"},{"path":"libggml-base.dylib","link":"libggml-base.0.dylib"},{"path":"libggml.0.29.0.dylib","size":57728,"sha256":"04e4ae10c64579af2fd9f69c36899492af40cacf65dbc66ef0afe768ac3c0a5c"},{"path":"libggml.0.dylib","link":"libggml.0.29.0.dylib"},{"path":"libggml.dylib","link":"libggml.0.dylib"},{"path":"libllama-common.0.9.0.dylib","size":5673136,"sha256":"d904ec546b1b06b6a281e1b5844615e081eea44a9e37b86172f47f4258eb4713"},{"path":"libllama-common.0.dylib","link":"libllama-common.0.9.0.dylib"},{"path":"libllama-common.dylib","link":"libllama-common.0.dylib"},{"path":"libllama-quantize-impl.dylib","size":89984,"sha256":"96993a56d3db5842b5a2663c09b5fd4c0866915981caaab7d9ed61d3218c8408"},{"path":"libllama-server-impl.dylib","size":4079072,"sha256":"32475b547b5cf7c0a55b73a40f03ef1e224f99f8970b3ddefcf5280e280417bd"},{"path":"libllama.0.9.0.dylib","size":4336000,"sha256":"faceed35a9084aa185a5eeb1faa36e64ea70e07433c81e5245e925dc43ce7ea7"},{"path":"libllama.0.dylib","link":"libllama.0.9.0.dylib"},{"path":"libllama.dylib","link":"libllama.0.dylib"},{"path":"libmtmd.0.9.0.dylib","size":1829632,"sha256":"b7e98c261bba03c8ec3e6aaf85cf4ba84e016ee142a1460bec47eef12797e38e"},{"path":"libmtmd.0.dylib","link":"libmtmd.0.9.0.dylib"},{"path":"libmtmd.dylib","link":"libmtmd.0.dylib"},{"path":"CPP_HTTPLIB_LICENSE","size":1075,"sha256":"4b45cbe16d7b71b89ae6127e26e0d90a029198ca5e958ad8e3d0b8bbed364d8b"},{"path":"DLPACK_LICENSE","size":11345,"sha256":"3e8f6bc39276a586d60c8c5aaece2ff989262181cf2b3d2a128db58f97a9300c"},{"path":"FMT_LICENSE","size":1431,"sha256":"07580f2a3b35709ce703d523f447b242f6dfec7582a8c0df102c7fa2849375f8"},{"path":"GO_LICENSE","size":163159,"sha256":"3d4141fbdef53a211326be2e0278e1b9959b4d848bcf727dd230636a3523c00c"},{"path":"LLAMA_CPP_LICENSE","size":1078,"sha256":"94f29bbed6a22c35b992c5c6ebf0e7c92f13b836b90f36f461c9cf2f0f1d010d"},{"path":"LLAMA_CPP_VENDORS_LICENSE","size":7257,"sha256":"eb17b411e39c75c4ac40916d66e39287ee9723b8bbe54daf020fc27acf670c11"},{"path":"MLX_C_LICENSE","size":1067,"sha256":"44326a4ea062241ae6fc26ee2ec90bdc81af7eb7b9d3966181b733fa69d42057"},{"path":"MLX_LICENSE","size":1066,"sha256":"ccfab7ccb2ea306f71531c8ca77bb55507606cd90768b1e32b8b52ab5b48cf01"},{"path":"PICOJSON_LICENSE","size":1414,"sha256":"52a7da16781b4b899382c9ddfcf059235cdee73e2f45cfd7402c2ae9a2e9d28d"},{"path":"XGRAMMAR_LICENSE","size":11357,"sha256":"c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4"},{"path":"XGRAMMAR_NOTICE","size":54,"sha256":"769c6907073c65801bfcfe3ce1c0e80bf0ae4e124e2769d4f026c038ad583c0f"},{"path":"mlx_metal_v3/libmlx.dylib","size":49813776,"sha256":"aaba47a7e672fd25c82719aa408f4dcff87f91fcc189d5d5643cb585b02079b8"},{"path":"mlx_metal_v3/mlx.metallib","size":151032032,"sha256":"0b8b2751e711343fce2abd16606a8e5caea8c413505159103cdd18595070ec93"},{"path":"mlx_metal_v3/libmlxc.dylib","size":2063488,"sha256":"29e9b7e6651cab2db01714a218da39dced774b9902bb17bc99b2259f4cf0b6b8"},{"path":"mlx_metal_v3/libollama_xgrammar.dylib","size":5192592,"sha256":"f341a6d2c322c401a774a3a133a7e7c6118eb3b4a93ec04d3775578ef096be02"},{"path":"mlx_metal_v4/libjaccl.dylib","size":2137056,"sha256":"0c8172d83ebe9f1033b57d99d5b9f5f4331ff76371f8f48e0940485d1af3bb5c"},{"path":"mlx_metal_v4/libmlx.dylib","size":21553392,"sha256":"9af11f7e223d17c5dbe7553ed5d632c9b210367105fd756de89b68053a9c06fa"},{"path":"mlx_metal_v4/mlx.metallib","size":221454912,"sha256":"9a95574a08d6383e621fcef301105984bf9c42b22b537b2ebef6a43b7053873d"},{"path":"mlx_metal_v4/libmlxc.dylib","size":1031184,"sha256":"edf644dc9a9d4686075a721e7f0d90e9a5302970275e0ec667e6138ca2198ff7"},{"path":"mlx_metal_v4/libollama_xgrammar.dylib","size":2489552,"sha256":"c56ac550df09c3f502ad750144db42ffc793679561d529a864b3071b7ad06c90"},{"path":"LICENSE","size":1058,"sha256":"5934ed2ce0d15154bcdb9c85203210abac0da4314af34081e36df4599f90b226"}]);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = code => { throw new Error(code); };
async function safeDirectory(dir, create = false) {
  const parent = path.dirname(dir);
  if (parent !== dir) await safeDirectory(parent);
  if (create) await fs.mkdir(dir, {mode:0o700}).catch(e => {if(e.code !== 'EEXIST') throw e;});
  const stat = await fs.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('unsafe_runtime_path');
  // 시스템 소유 상위 디렉터리는 허용하되 쓰기 대상은 현재 사용자만 소유한다.
  if (create && (stat.uid !== process.getuid() || (stat.mode & 0o022))) fail('unsafe_runtime_permissions');
}
async function digest(file, signal) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file, {signal})) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyRuntime(runtimeDir, {entries=RUNTIME_FILES, signal, allowRootOwner=false}={}) {
  await safeDirectory(runtimeDir);
  const expected = new Set(entries.map(e => e.path));
  const directories = new Set(['']);
  for (const item of entries) {
    if (path.isAbsolute(item.path) || item.path.split('/').includes('..')) fail('unsafe_manifest');
    for (let dir=path.dirname(item.path); dir!=='.'; dir=path.dirname(dir)) directories.add(dir);
    const file=path.join(runtimeDir,item.path);
    const stat=await fs.lstat(file).catch(()=>null);
    if (!stat || (stat.uid!==process.getuid() && !(allowRootOwner && stat.uid===0)) || (!stat.isSymbolicLink() && (stat.mode & 0o022))) fail('runtime_unverified');
    if (item.link) {
      if (!stat.isSymbolicLink() || await fs.readlink(file)!==item.link || path.isAbsolute(item.link)) fail('runtime_unverified');
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(item.path),item.link));
      if (!expected.has(resolved)) fail('runtime_unverified');
    } else if (!stat.isFile() || stat.isSymbolicLink() || stat.size!==item.size || await digest(file,signal)!==item.sha256) {
      fail('runtime_unverified');
    }
  }
  async function scan(relative='') {
    const dir=path.join(runtimeDir,relative);
    await safeDirectory(dir);
    const dirStat=await fs.lstat(dir);
    if((dirStat.uid!==process.getuid() && !(allowRootOwner && dirStat.uid===0)) || (dirStat.mode & 0o022)) fail('unsafe_runtime_permissions');
    for (const item of await fs.readdir(dir,{withFileTypes:true})) {
      const rel=relative ? relative+'/'+item.name : item.name;
      if (item.isDirectory()) { if(!directories.has(rel)) fail('unexpected_runtime_file'); await scan(rel); }
      else if (!expected.has(rel)) {
        // 설치에 사용한 공식 archive를 남긴 경우만 추가로 허용한다.
        if (rel!=='ollama-darwin.tgz' || !item.isFile() || await digest(path.join(runtimeDir,rel),signal)!==ARCHIVE_SHA256) fail('unexpected_runtime_file');
      }
    }
  }
  await scan();
  signal?.throwIfAborted();
  return true;
}
async function copyRuntimeFile(source, target, signal) {
  await pipeline(createReadStream(source),createWriteStream(target,{flags:'wx',mode:0o700}),{signal});
}

/** 네트워크 없이 helper 옆 앱 번들의 검증된 실행기만 설치한다. 기존 대상은 덮어쓰지 않는다. */
export async function ensureRuntime(root, bundleRoot=path.dirname(fileURLToPath(import.meta.url)), {
  entries=RUNTIME_FILES,version=VERSION,signal,emit=()=>{},copyFile=copyRuntimeFile,
}={}) {
  root=path.resolve(root);
  const parent=path.join(root,'runtime');
  const target=path.join(parent,'ollama-v'+version);
  signal?.throwIfAborted();
  await safeDirectory(root,true);
  await safeDirectory(parent,true);
  const exists=await fs.lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(exists) {
    await verifyRuntime(target,{entries,signal});
    return {installed:false,runtimeDir:target};
  }
  const source=path.join(path.resolve(bundleRoot),'runtime','ollama-v'+version);
  const sourceStat=await fs.lstat(source).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(!sourceStat) fail('runtime_bundle_missing');
  await verifyRuntime(source,{entries,signal,allowRootOwner:true});
  await safeDirectory(root,true);
  await safeDirectory(parent,true);
  const lock=path.join(parent,'.install-ollama-'+version+'.lock');
  let locked=false,stage;
  try {
    try {await fs.mkdir(lock,{mode:0o700});locked=true;}catch(e){if(e.code==='EEXIST')fail('runtime_install_busy');throw e;}
    // 다른 협조적 설치가 lock을 기다리는 사이 완료된 경우도 기존 대상은 그대로 쓴다.
    const appeared=await fs.lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(appeared) {await verifyRuntime(target,{entries,signal});return {installed:false,runtimeDir:target};}
    const required=entries.reduce((sum,item)=>sum+(item.size||0),0)+64*1024*1024;
    const disk=await fs.statfs(parent);
    if(disk.bavail*disk.bsize<required) fail('runtime_install_disk_space');
    stage=await fs.mkdtemp(path.join(parent,'.install-ollama-'+version+'-'));
    await fs.chmod(stage,0o700);
    emit({event:'installing',runtimeVersion:version,network:false});
    for(const item of entries) {
      signal?.throwIfAborted();
      const dest=path.join(stage,item.path);
      const relativeParent=path.dirname(item.path);
      if(relativeParent!=='.') {
        await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o700});
        await safeDirectory(path.dirname(dest),true);
      }
      if(item.link) await fs.symlink(item.link,dest);
      else await copyFile(path.join(source,item.path),dest,signal);
    }
    await verifyRuntime(stage,{entries,signal});
    signal?.throwIfAborted();
    const current=await fs.lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(current) fail('runtime_target_appeared');
    // 전용 lock과 존재 재검사로 정상 동시 실행을 막는다. 동일 사용자에 의한 적대적
    // 검사/rename 사이 경로 교체까지 막는 OS RENAME_EXCL 원자성은 Node API가 제공하지 않는다.
    await fs.rename(stage,target);
    stage=null;
    emit({event:'installed',runtimeVersion:version,network:false});
    return {installed:true,runtimeDir:target};
  } finally {
    if(stage) await fs.rm(stage,{recursive:true,force:true});
    if(locked) await fs.rmdir(lock);
  }
}

export async function portAvailable(port) {
  const server=net.createServer();
  return new Promise((resolve,reject)=>{
    server.once('error',e => e.code==='EADDRINUSE' ? resolve(false) : reject(new Error('loopback_unavailable')));
    server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));
  });
}
function health(port, version) {
  return new Promise(resolve=>{
    const req=http.get({hostname:'127.0.0.1',port,path:'/api/version',agent:false,timeout:500},res=>{
      if(res.statusCode!==200){res.destroy();resolve(false);return;}
      let bytes=0,body='';
      res.on('data',data=>{bytes+=data.length;if(bytes>4096){res.destroy();resolve(false);}else body+=data;});
      res.on('end',()=>{try{resolve(JSON.parse(body).version===version);}catch{resolve(false);}});
      res.on('error',()=>resolve(false));
    });
    req.on('timeout',()=>req.destroy());req.on('error',()=>resolve(false));
  });
}

/** 내부 port/entries/spawnRuntime 주입은 시험용이다. CLI에는 임의 실행경로·포트 입력을 노출하지 않는다. */
export async function startRuntime(root, {
  signal, emit=()=>{}, port=PORT, entries=RUNTIME_FILES, version=VERSION,
  startupMs=15000, stopMs=1500, spawnRuntime=spawn, bundleRoot=path.dirname(fileURLToPath(import.meta.url)),
}={}) {
  root=path.resolve(root);
  signal?.throwIfAborted();
  const runtimeDir=path.join(root,'runtime','ollama-v'+version);
  const verifySignal=signal ? AbortSignal.any([signal,AbortSignal.timeout(startupMs)]) : AbortSignal.timeout(startupMs);
  await ensureRuntime(root,bundleRoot,{entries,version,signal:verifySignal,emit});
  if (!await portAvailable(port)) fail('runtime_port_in_use');
  await safeDirectory(path.join(root,'runtime','home'),true);
  await safeDirectory(path.join(root,'models'),true);
  await safeDirectory(path.join(root,'models','ollama'),true);
  signal?.throwIfAborted();
  const env={HOME:path.join(root,'runtime','home'),PATH:'/usr/bin:/bin:/usr/sbin:/sbin',
    OLLAMA_HOST:`127.0.0.1:${port}`,OLLAMA_MODELS:path.join(root,'models','ollama'),
    OLLAMA_NO_CLOUD:'1',OLLAMA_CONTEXT_LENGTH:'4096',OLLAMA_NUM_PARALLEL:'1',OLLAMA_MAX_LOADED_MODELS:'1',OLLAMA_KEEP_ALIVE:'5m'};
  emit({event:'starting',port,cloudEnabled:false,runtimeVersion:version});
  const child=spawnRuntime(path.join(runtimeDir,'ollama'),['serve'],{
    cwd:runtimeDir,env,detached:true,stdio:['ignore','pipe','pipe'],shell:false,
  });
  let exited=false,spawnError=false,stopping=false,listening=false,tail='';
  let resolveExit;
  const exit=new Promise(resolve=>{resolveExit=resolve;});
  const capture=chunk=>{
    // 준비 신호만 검사하고 런타임의 원문/경로/개인 데이터는 전달하거나 저장하지 않는다.
    tail=(tail+String(chunk)).slice(-4096);
    if(tail.includes(`Listening on 127.0.0.1:${port}`)) listening=true;
  };
  child.stdout?.on('data',capture);child.stderr?.on('data',capture);
  child.once('error',()=>{spawnError=true;exited=true;resolveExit();});
  child.once('exit',()=>{
    // 방금 종료한 자기 group leader의 남은 자식만 종료 신호를 보낸다.
    if(!stopping && child.pid) {try{process.kill(-child.pid,'SIGTERM');}catch{/* 이미 끝난 group */}}
    exited=true;resolveExit();
  });
  const kill=kind=>{
    if(!child.pid || exited) return;
    try { process.kill(-child.pid,kind); } catch(e) {if(e.code!=='ESRCH') throw e;}
  };
  let stopPromise;
  function stop() {
    if(stopPromise) return stopPromise;
    stopping=true;
    stopPromise=(async()=>{
    kill('SIGTERM');
    await Promise.race([exit,delay(stopMs)]);
    if(!exited) kill('SIGKILL');
    await Promise.race([exit,delay(stopMs)]);
    signal?.removeEventListener('abort',abort);
    if(!exited) fail('runtime_stop_timeout');
    emit({event:'stopped'});
    })();
    return stopPromise;
  }
  const abort=()=>{stop().catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try {
    const until=Date.now()+startupMs;
    while(Date.now()<until) {
      signal?.throwIfAborted();
      if(exited) fail(spawnError?'runtime_start_failed':'runtime_exited');
      if(listening && await health(port,version)) {
        if(exited || stopping) fail('runtime_exited');
        tail='';emit({event:'ready',port,cloudEnabled:false,runtimeVersion:version});
        return {stop,done:exit.then(()=>{
          signal?.removeEventListener('abort',abort);
          if(!stopping) fail('runtime_exited');
        })};
      }
      await delay(100);
    }
    fail('runtime_start_timeout');
  } catch(error) {await stop();throw error;}
}

export async function runWithParent(root,{input=process.stdin,emit=()=>{},...options}={}) {
  const controller=new AbortController();
  const abort=()=>controller.abort();
  process.once('SIGINT',abort);process.once('SIGTERM',abort);
  input.once('end',abort);input.once('error',abort);input.resume();
  try {
    const runtime=await startRuntime(root,{...options,signal:controller.signal,emit});
    await runtime.done;
  } finally {
    process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);
    input.removeListener('end',abort);input.removeListener('error',abort);input.pause();
  }
}
async function main() {
  if(process.argv.length!==3 || process.argv[2]!=='--start') fail('usage_start_required');
  if(process.platform!=='darwin' || process.arch!=='arm64') fail('unsupported_platform');
  process.umask(0o077);
  const root=path.join(homedir(),'Library/Application Support/Ahmatda');
  await runWithParent(root,{emit:value=>process.stdout.write(JSON.stringify(value)+'\n')});
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{
    const allowed=['usage_start_required','unsupported_platform','runtime_unverified','unsafe_runtime_path','unsafe_runtime_permissions','unsafe_manifest','unexpected_runtime_file','loopback_unavailable','runtime_port_in_use','runtime_start_failed','runtime_exited','runtime_start_timeout','runtime_stop_timeout','runtime_bundle_missing','runtime_install_busy','runtime_install_disk_space','runtime_target_appeared'];
    const code=error.name==='AbortError'?'cancelled':allowed.includes(error.message)?error.message:'runtime_unavailable';
    process.stdout.write(JSON.stringify({event:'error',code})+'\n');process.exitCode=code==='cancelled'?0:1;
    process.stdin.pause();
  });
}
