import {spawn} from 'node:child_process';import {once} from 'node:events';import {fileURLToPath} from 'node:url';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import {EventEmitter} from 'node:events';import {setTimeout as delay} from 'node:timers/promises';import {readCredential,workerCommand,supervisor,SERVER,ensureAssets,authorizationMatches,stopOwnedChild} from '../whisper-worker.mjs';
const capability='a'.repeat(64);const token='ah_local_worker_'+'b'.repeat(43);const credential=()=>({version:1,workspaceId:'ws_'+'a'.repeat(19),token,expiresAt:Date.now()+60000,capabilityHash:createHash('sha256').update(capability).digest('hex'),server:SERVER});
async function fixture(t){const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()),'whisper-worker-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'data'),{mode:0o700});await fs.writeFile(path.join(root,'data/local-worker.json'),JSON.stringify(credential()),{mode:0o600});return root;}
class Child extends EventEmitter{constructor(){super();this.exitCode=null;this.signalCode=null;this.signals=[];queueMicrotask(()=>this.emit('spawn'));}kill(signal){this.signals.push(signal);this.signalCode=signal;queueMicrotask(()=>this.emit('close',0,signal));return true;}}
const fakeAssets=async()=>({python:'/fake/python',agent:'/fake/agent',model:'/fake/model'});
async function until(check){for(let i=0;i<150;i++){if(check())return;await delay(5);}throw Error('test_timeout');}
test('private token scope, capability, expiry and permissions validated',async t=>{const root=await fixture(t);assert.equal((await readCredential(root,capability)).token,token);await assert.rejects(readCredential(root,'c'.repeat(64)),/capability_mismatch/);await assert.rejects(readCredential(root,capability,{now:Date.now()+120000}),/expired/);await fs.chmod(path.join(root,'data/local-worker.json'),0o644);await assert.rejects(readCredential(root,capability),/private_credentials/);});
test('symlink credential rejected',async t=>{const root=await fixture(t);await fs.rename(path.join(root,'data/local-worker.json'),path.join(root,'data/real'));await fs.symlink('real',path.join(root,'data/local-worker.json'));await assert.rejects(readCredential(root,capability));});
test('worker fixed loopback; token only child env; no proxy inheritance',()=>{const c=workerCommand('/private', {python:'/python',agent:'/agent',model:'/model'},credential(),'/secrets');assert.equal(c.args.includes(token),false);assert.equal(c.options.env.WORKER_TOKEN,token);assert.equal(c.options.env.HTTP_PROXY,undefined);assert.equal(c.options.env.AHMATDA_LOCAL_WORKER_CAPABILITY,undefined);assert.equal(c.options.env.HF_HUB_OFFLINE,'1');assert.ok(c.args.includes(SERVER));assert.deepEqual(c.args.slice(0,2),['-I','-B']);});
test('model missing is cheap and never installs or downloads',async t=>{const root=await fixture(t);await assert.rejects(ensureAssets(root,'/missing'),/model_not_prepared/);assert.deepEqual(await fs.readdir(root),['data']);});
test('late model readiness starts on later poll; revoke stops owned child',async t=>{const root=await fixture(t);const abort=new AbortController();let prepared=false,allowed=true;const children=[],events=[];const task=supervisor({root,bundleRoot:root,capability,signal:abort.signal,pollMs:5,authorize:async()=>allowed,assets:async()=>{if(!prepared)throw Error('model_not_prepared');return fakeAssets();},spawnChild:()=>{const c=new Child();children.push(c);return c;},emit:e=>events.push(e)});await until(()=>events.some(e=>e.code==='model_not_prepared'));prepared=true;await until(()=>children.length===1);allowed=false;await until(()=>children[0].signals.length>0);abort.abort();await task;assert.equal(JSON.stringify(events).includes(token),false);assert.equal((await fs.readdir(root)).some(x=>x.startsWith('.worker-secrets-')),false);});
test('rotation stops old worker before starting replacement',async t=>{const root=await fixture(t);const abort=new AbortController();let c=credential();const children=[];const task=supervisor({root,bundleRoot:root,capability,signal:abort.signal,pollMs:5,read:async()=>c,authorize:async()=>true,assets:fakeAssets,spawnChild:()=>{const child=new Child();children.push(child);return child;}});await until(()=>children.length===1);c={...c,token:'ah_local_worker_'+'d'.repeat(43)};await until(()=>children.length===2);assert.ok(children[0].signals.length);abort.abort();await task;assert.ok(children[1].signals.length);});
test('credential disappears stops worker without restart',async t=>{const root=await fixture(t);const abort=new AbortController();const children=[];const task=supervisor({root,bundleRoot:root,capability,signal:abort.signal,pollMs:5,authorize:async()=>true,assets:fakeAssets,spawnChild:()=>{const c=new Child();children.push(c);return c;}});await until(()=>children.length===1);await fs.unlink(path.join(root,'data/local-worker.json'));await until(()=>children[0].signals.length>0);abort.abort();await task;assert.equal(children.length,1);});
test('permission revoked during asset verification prevents spawn',async t=>{const root=await fixture(t);const abort=new AbortController();let allowed=true,spawned=false;const task=supervisor({root,bundleRoot:root,capability,signal:abort.signal,pollMs:5,authorize:async()=>allowed,assets:async()=>{allowed=false;return fakeAssets();},spawnChild:()=>{spawned=true;return new Child();}});await delay(25);abort.abort();await task;assert.equal(spawned,false);});

test('authorization response must match the credential workspace',()=>{const c=credential();assert.equal(authorizationMatches({authorized:true,workspaceId:c.workspaceId},c),true);for(const value of [{authorized:true},{authorized:true,workspaceId:'ws_'+'c'.repeat(19)},{authorized:false,workspaceId:c.workspaceId},null])assert.equal(authorizationMatches(value,c),false);});


// These exercise temporary mock processes, not real Whisper throughput or long-term uptime.
test('expiry during execution stops the owned worker without restart',async t=>{
 const root=await fixture(t),abort=new AbortController(),children=[];let clock=Date.now();
 const task=supervisor({root,bundleRoot:root,capability,signal:abort.signal,pollMs:5,now:()=>clock,authorize:async()=>true,assets:fakeAssets,spawnChild:()=>{const c=new Child();children.push(c);return c;}});
 t.after(async()=>{abort.abort();await task;});await until(()=>children.length===1);clock+=120000;
 await until(()=>children[0].signals.length>0);await delay(25);assert.equal(children.length,1);
});

test('crashed worker observes restart backoff and rechecks authorization',async t=>{
 const root=await fixture(t),abort=new AbortController(),children=[],events=[],fixedCredential=credential();let clock=Date.now(),checks=0;
 const task=supervisor({root,bundleRoot:root,capability,signal:abort.signal,pollMs:5,now:()=>clock,read:async()=>fixedCredential,authorize:async()=>{checks++;return true;},assets:fakeAssets,spawnChild:()=>{const c=new Child();children.push(c);return c;},emit:e=>events.push(e)});
 t.after(async()=>{abort.abort();await task;});await until(()=>children.length===1);
 children[0].exitCode=1;children[0].emit('close',1,null);await delay(25);assert.equal(children.length,1);
 const before=checks;clock+=15001;await until(()=>children.length===2);assert.ok(checks>=before+2);assert.ok(events.some(e=>e.code==='worker_stopped'));
});

test('spawn error is sanitized and cannot cause a rapid restart loop',async t=>{
 const root=await fixture(t),abort=new AbortController(),events=[];let count=0;
 const task=supervisor({root,bundleRoot:root,capability,signal:abort.signal,pollMs:5,authorize:async()=>true,assets:fakeAssets,spawnChild:()=>{count++;const c=new EventEmitter();queueMicrotask(()=>c.emit('error',Error(token)));return c;},emit:e=>events.push(e)});
 t.after(async()=>{abort.abort();await task;});await until(()=>events.some(e=>e.code==='worker_start_failed'));await delay(30);
 assert.equal(count,1);assert.equal(JSON.stringify(events).includes(token),false);
});

async function mockProcess(t,script){
 const child=spawn(process.execPath,['-e',script],{stdio:['ignore','pipe','ignore']});
 t.after(()=>{if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');});
 await once(child.stdout,'data');return child;
}
test('unresponsive owned subprocess escalates to SIGKILL within bounded shutdown; unrelated child survives',async t=>{
 const owned=await mockProcess(t,"process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});setInterval(()=>{},1000);console.log('ready')");
 const unrelated=await mockProcess(t,"setInterval(()=>{},1000);console.log('ready')");
 const start=Date.now();await stopOwnedChild(owned,{graceMs:25,killMs:25});
 assert.equal(owned.signalCode,'SIGKILL');assert.ok(Date.now()-start<2000);assert.equal(unrelated.exitCode,null);assert.equal(unrelated.signalCode,null);
});
test('already exited subprocess is never signalled',async()=>{
 const child={exitCode:0,signalCode:null,kill(){throw Error('unexpected_signal');}};await stopOwnedChild(child,{graceMs:1,killMs:1});
});

for(const stop of ['stdin EOF','SIGTERM'])test(`CLI ${stop} exits cleanly while waiting for explicit connection`,{timeout:10000},async t=>{
 const home=await fixture(t);const helper=fileURLToPath(new URL('../whisper-worker.mjs',import.meta.url));
 const child=spawn(process.execPath,[helper,'--start'],{env:{HOME:home,PATH:'/usr/bin:/bin',AHMATDA_LOCAL_WORKER_CAPABILITY:capability},stdio:['pipe','pipe','pipe']});
 t.after(()=>{if(child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');});
 let output='';child.stdout.on('data',d=>output+=d);const closed=once(child,'close');
 await until(()=>output.includes('"event":"waiting"'));
 if(stop==='stdin EOF')child.stdin.end();else child.kill('SIGTERM');
 const [code,signal]=await closed;assert.equal(code,0);assert.equal(signal,null);assert.ok(output.includes('"event":"stopped"'));assert.equal(output.includes(token),false);
});
