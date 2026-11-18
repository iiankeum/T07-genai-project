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
import {verifyRuntime,startRuntime,runWithParent,portAvailable} from '../local-runtime.mjs';

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
