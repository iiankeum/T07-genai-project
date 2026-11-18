// 실제 Ollama·11434·11435에는 연결하지 않는 가짜 자식 프로세스 회귀.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {PassThrough} from 'node:stream';
import {verifyRuntime,ensureRuntime,startRuntime,runWithParent,portAvailable} from '../local-runtime.mjs';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function unusedPort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function fixture(t,kind='normal') {
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'ahmatda-supervisor-test-')));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const dir=path.join(root,'runtime/ollama-vtest');await fs.mkdir(dir,{recursive:true});await fs.mkdir(path.join(root,'models/ollama'),{recursive:true});
 const script=`import http from 'node:http';
 import {spawn} from 'node:child_process'; import fs from 'node:fs';
 const port=Number(process.env.OLLAMA_HOST.split(':')[1]);
 if(${JSON.stringify(kind)}==='descendant') {
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 fs.writeFileSync(process.env.HOME+'/descendant.pid',String(child.pid));
 }
 if(${JSON.stringify(kind)}==='exit')process.exit(2);
 if(${JSON.stringify(kind)}==='silent'){setInterval(()=>{},1000);}else{
 const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({version:${JSON.stringify(kind==='wrong'?'wrong':'test')}}));});
 server.listen(port,'127.0.0.1',()=>console.log('Listening on 127.0.0.1:'+port));
 if(${JSON.stringify(kind)}==='stubborn')process.on('SIGTERM',()=>{});
 }
 `;
 await fs.writeFile(path.join(dir,'ollama'),script,{mode:0o700});
 const entries=[{path:'ollama',size:Buffer.byteLength(script),sha256:createHash('sha256').update(script).digest('hex')}];
 let pid,env;
 const spawnRuntime=(file,args,options)=>{env=options.env;const child=spawn(process.execPath,[file],options);pid=child.pid;return child;};
 return {root,dir,entries,spawnRuntime,version:'test',port:await unusedPort(),startupMs:1500,stopMs:150,pid:()=>pid,env:()=>env};
}
test('전체 runtime 파일과 symlink를 검증하고 손상·추가 실행파일을 거절',async t=>{
 const f=await fixture(t);await verifyRuntime(f.dir,{entries:f.entries});
 await fs.writeFile(path.join(f.dir,'injected.dylib'),'bad');await assert.rejects(verifyRuntime(f.dir,{entries:f.entries}),/unexpected/);
 await fs.unlink(path.join(f.dir,'injected.dylib'));await fs.appendFile(path.join(f.dir,'ollama'),'bad');await assert.rejects(verifyRuntime(f.dir,{entries:f.entries}),/unverified/);
});
test('허용된 상대 symlink만 검증하고 외부 link를 거절',async t=>{
 const f=await fixture(t);await fs.symlink('ollama',path.join(f.dir,'alias'));const entries=[...f.entries,{path:'alias',link:'ollama'}];
 await verifyRuntime(f.dir,{entries});await fs.unlink(path.join(f.dir,'alias'));await fs.symlink('/usr/bin/true',path.join(f.dir,'alias'));await assert.rejects(verifyRuntime(f.dir,{entries}),/unverified/);
});
test('다른 port 소유자를 종료하거나 재사용하지 않는다',async t=>{
 const f=await fixture(t);const other=net.createServer();await new Promise(r=>other.listen(f.port,'127.0.0.1',r));t.after(()=>new Promise(r=>other.close(r)));
 let spawned=false;await assert.rejects(startRuntime(f.root,{...f,spawnRuntime:()=>{spawned=true;throw Error();}}),/port_in_use/);
 assert.equal(spawned,false);assert.equal(await portAvailable(f.port),false);
});
test('자기 child와 version health를 확인한 후 ready, 비밀 환경 전달 없음',async t=>{
 const f=await fixture(t);const events=[];const h=await startRuntime(f.root,{...f,emit:e=>events.push(e)});t.after(()=>h.stop());
 assert.deepEqual(events.map(e=>e.event),['starting','ready']);
 assert.equal(f.env().OLLAMA_NO_CLOUD,'1');assert.equal(f.env().OLLAMA_HOST,`127.0.0.1:${f.port}`);assert.equal(f.env().ANTHROPIC_API_KEY,undefined);assert.equal(f.env().DYLD_LIBRARY_PATH,undefined);
 await h.stop();await h.done;assert.equal(await portAvailable(f.port),true);assert.throws(()=>process.kill(f.pid(),0),{code:'ESRCH'});
});
test('startup 실패는 원문 로그 없이 error로 처리',async t=>{
 const f=await fixture(t,'exit');const events=[];await assert.rejects(startRuntime(f.root,{...f,emit:e=>events.push(e)}),/runtime_exited/);
 assert.equal(events.some(e=>e.event==='ready'),false);assert.equal(await portAvailable(f.port),true);
});
test('잘못된 health version은 ready가 아니며 시간제한 후 자기child 종료',async t=>{
 const f=await fixture(t,'wrong');await assert.rejects(startRuntime(f.root,{...f,startupMs:300}),/timeout/);assert.equal(await portAvailable(f.port),true);
});
test('부모 stdin 종료가 자기 런타임을 종료',async t=>{
 const f=await fixture(t);const input=new PassThrough();let ready;const readyPromise=new Promise(r=>ready=r);
 const done=runWithParent(f.root,{...f,input,emit:e=>{if(e.event==='ready')ready();}});
 await readyPromise;input.end();await done;assert.equal(await portAvailable(f.port),true);
});
test('SIGTERM 무시하는 자식도 제한시간 내 자기group KILL',async t=>{
 const f=await fixture(t,'stubborn');const h=await startRuntime(f.root,f);const start=Date.now();await h.stop();await h.done;
 assert.ok(Date.now()-start<1500);assert.throws(()=>process.kill(f.pid(),0),{code:'ESRCH'});
});
test('갑작스런 자기 child 종료는 부모에게 실패 전달',async t=>{
 const f=await fixture(t);const h=await startRuntime(f.root,f);const done=assert.rejects(h.done,/runtime_exited/);process.kill(f.pid(),'SIGKILL');await done;assert.equal(await portAvailable(f.port),true);
});
test('start 중 abort는 자기 child만 정리',async t=>{
 const f=await fixture(t,'silent');const controller=new AbortController();setTimeout(()=>controller.abort(),150);
 await assert.rejects(startRuntime(f.root,{...f,signal:controller.signal}),{name:'AbortError'});assert.throws(()=>process.kill(f.pid(),0),{code:'ESRCH'});
});

test('자기 process group의 후손도 종료하고 다른 서버는 유지',async t=>{
 const f=await fixture(t,'descendant');const other=net.createServer();await new Promise(r=>other.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>other.close(r)));const otherPort=other.address().port;
 const h=await startRuntime(f.root,f);const childPid=Number(await fs.readFile(path.join(f.root,'runtime/home/descendant.pid'),'utf8'));await h.stop();await h.done;
 for(let i=0;i<20;i++){try{process.kill(childPid,0);await wait(50);}catch{break;}}
 assert.throws(()=>process.kill(childPid,0),{code:'ESRCH'});assert.equal(await portAvailable(otherPort),false);
});

test('번들에서 빈 사용자 루트에 stage 설치하고 재실행은 기존 파일 유지',async t=>{
 const f=await fixture(t);const root=path.join(f.root,'new-user');const events=[];
 const result=await ensureRuntime(root,f.root,{entries:f.entries,version:'test',emit:e=>events.push(e)});
 assert.equal(result.installed,true);await verifyRuntime(result.runtimeDir,{entries:f.entries});
 assert.equal((await fs.stat(result.runtimeDir)).mode&0o777,0o700);
 assert.deepEqual(events.map(e=>e.event),['installing','installed']);
 const before=await fs.stat(path.join(result.runtimeDir,'ollama'));
 const again=await ensureRuntime(root,path.join(f.root,'no-bundle'),{entries:f.entries,version:'test'});
 assert.equal(again.installed,false);assert.equal((await fs.stat(path.join(result.runtimeDir,'ollama'))).ino,before.ino);
});
test('기존 손상 실행기를 덮어쓰지 않음',async t=>{
 const f=await fixture(t);const root=path.join(f.root,'existing');const dest=path.join(root,'runtime/ollama-vtest');await fs.mkdir(dest,{recursive:true});await fs.writeFile(path.join(dest,'ollama'),'keep-corrupt');
 await assert.rejects(ensureRuntime(root,f.root,{entries:f.entries,version:'test'}),/runtime_unverified/);
 assert.equal(await fs.readFile(path.join(dest,'ollama'),'utf8'),'keep-corrupt');
});
test('동시 설치 또는 이전 비정상 종료 lock은 그대로 유지',async t=>{
 const f=await fixture(t);const root=path.join(f.root,'locked');const lock=path.join(root,'runtime/.install-ollama-test.lock');await fs.mkdir(lock,{recursive:true});
 await assert.rejects(ensureRuntime(root,f.root,{entries:f.entries,version:'test'}),/install_busy/);assert.ok((await fs.stat(lock)).isDirectory());
});
test('복사 실패와 취소에서 target 미노출 및 stage 정리',async t=>{
 const f=await fixture(t);
 for(const cancel of [false,true]) {
  const root=path.join(f.root,cancel?'cancelled':'failed');const controller=new AbortController();
  const copyFile=async(source,dest)=>{await fs.copyFile(source,dest);if(cancel)controller.abort();else throw Error('fake_copy_failure');};
  await assert.rejects(ensureRuntime(root,f.root,{entries:f.entries,version:'test',signal:controller.signal,copyFile}),cancel?{name:'AbortError'}:/fake_copy_failure/);
  assert.deepEqual(await fs.readdir(path.join(root,'runtime')),[]);
 }
});
test('게시 직전에 나타난 목적지를 보존',async t=>{
 const f=await fixture(t);const root=path.join(f.root,'appeared');const dest=path.join(root,'runtime/ollama-vtest');
 const copyFile=async(source,target)=>{await fs.copyFile(source,target);await fs.mkdir(dest);await fs.writeFile(path.join(dest,'keep'),'original');};
 await assert.rejects(ensureRuntime(root,f.root,{entries:f.entries,version:'test',copyFile}),/target_appeared/);
 assert.equal(await fs.readFile(path.join(dest,'keep'),'utf8'),'original');assert.deepEqual(await fs.readdir(path.join(root,'runtime')),['ollama-vtest']);
});
test('손상 번들·없는 번들·symlink 목적지는 실행하지 않음',async t=>{
 const f=await fixture(t);const root=path.join(f.root,'new');
 await assert.rejects(ensureRuntime(root,path.join(f.root,'missing'),{entries:f.entries,version:'test'}),/bundle_missing/);
 await fs.appendFile(path.join(f.dir,'ollama'),'corruption');await assert.rejects(ensureRuntime(root,f.root,{entries:f.entries,version:'test'}),/runtime_unverified/);
 await fs.mkdir(path.join(root,'runtime'),{recursive:true});await fs.symlink(f.dir,path.join(root,'runtime/ollama-vtest'));
 await assert.rejects(ensureRuntime(root,f.root,{entries:f.entries,version:'test'}),/unsafe_runtime_path/);
});
test('bundled runtime을 첫 설치한 뒤 빈 모델 폴더를 만들고 기동',async t=>{
 const f=await fixture(t);const root=path.join(f.root,'firststart');const events=[];
 const h=await startRuntime(root,{...f,bundleRoot:f.root,emit:e=>events.push(e)});await h.stop();await h.done;
 assert.deepEqual(events.map(e=>e.event),['installing','installed','starting','ready','stopped']);
 assert.ok((await fs.stat(path.join(root,'models/ollama'))).isDirectory());
});

test('group 쓰기 가능한 runtime 디렉터리와 사용자 저장소는 거절',async t=>{
 const f=await fixture(t);await fs.chmod(f.dir,0o770);await assert.rejects(verifyRuntime(f.dir,{entries:f.entries}),/unsafe_runtime_permissions/);await fs.chmod(f.dir,0o700);
 const root=path.join(f.root,'writable-home');await fs.mkdir(root,{mode:0o770});await fs.chmod(root,0o770);await assert.rejects(ensureRuntime(root,f.root,{entries:f.entries,version:'test'}),/unsafe_runtime_permissions/);
});
