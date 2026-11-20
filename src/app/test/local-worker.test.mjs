// 가짜 계정·자격증명만 사용하는 로컬 받아쓰기 등록 보안 회귀. 모델/API 호출 없음.
import { before, beforeEach, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ahmatda-local-worker-'));
Object.assign(process.env,{DATA_DIR:root,DEMO_MODE:'0',AI_PROVIDER:'off',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',
 AHMATDA_LOCAL_MAC:'1',AHMATDA_LOCAL_WORKER_CAPABILITY:'a'.repeat(64),HOST:'127.0.0.1',PORT:'5601',
 PUBLIC_BASE_URL:'http://127.0.0.1:5601',TRUST_PROXY:'0',WORKER_TOKEN:'legacy-fake-worker'});
const auth=await import('../lib/auth.mjs');
const {withWorkspace,db}=await import('../lib/db.mjs');
const {buildRouter,createApp}=await import('../server.mjs');
const hash=x=>createHash('sha256').update(x).digest('hex');
const A='ws_'+'a'.repeat(19), B='ws_'+'b'.repeat(19);
const user='fake-local-owner', session='s'.repeat(43), file=path.join(root,'local-worker.json');
const access={workspace:{id:A,name:'가짜 A'},user:{id:user,name:'가짜 관리자'},role:'admin',demo:false};
const run=fn=>withWorkspace(access,fn);
const req=(headers={},remoteAddress='127.0.0.1')=>({headers:{host:'127.0.0.1:5601',origin:'http://127.0.0.1:5601','x-ahmatda-workspace':A,...headers},socket:{remoteAddress}});
const connect=(r=req())=>run(()=>auth.connectLocalWorker(r,{confirm:true}));
const credentials=()=>JSON.parse(fs.readFileSync(file,'utf8'));
const worker=(raw,headers={},remoteAddress='127.0.0.1')=>auth.workerAccess(req({authorization:'Bearer '+raw,...headers},remoteAddress));
const rejects=(fn,status)=>assert.throws(fn,e=>e.status===status);
let server,base;
before(async()=>{
 const d=auth.accountDb(),now=new Date().toISOString();
 d.prepare('INSERT INTO users(id,email,name,password_hash,verified_at,terms_version,consent_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
  .run(user,'fake@example.test','가짜 관리자','not-a-real-password',now,'test',now,now);
 for(const id of [A,B]){d.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(id,'가짜 공간',now);d.prepare('INSERT INTO memberships(workspace_id,user_id,role,active,created_at) VALUES(?,?,?,1,?)').run(id,user,'admin',now);}
 d.prepare('INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES(?,?,?,?)').run(hash(session),user,A,Date.now()+600000);
 const {router}=await buildRouter();server=http.createServer(createApp(router));await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
});
beforeEach(()=>{
 const d=auth.accountDb();d.prepare('DELETE FROM local_worker_connection').run();
 d.prepare("UPDATE memberships SET role='admin',active=1 WHERE user_id=?").run(user);
 d.prepare('UPDATE users SET verified_at=? WHERE id=?').run(new Date().toISOString(),user);
 fs.chmodSync(root,0o700);try{fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}
});
after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});

test('로컬 모드 capability·host·port·proxy·demo gating은 기본 거부한다',()=>{
 for(const override of [{AHMATDA_LOCAL_MAC:'0'},{AHMATDA_LOCAL_WORKER_CAPABILITY:''},{HOST:'0.0.0.0'},{PORT:'5600'},{TRUST_PROXY:'1'},{DEMO_MODE:'1'}]){
  const script=`import {connectLocalWorker} from './lib/auth.mjs';try{connectLocalWorker({},{});process.exit(1)}catch(e){if(e.status!==404)throw e;}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:path.resolve(import.meta.dirname,'..'),env:{...process.env,...override},encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);
 }
});

test('등록은 exact Origin/Host·실제 loopback·workspace·관리자·명시동의를 요구한다',()=>{
 for(const origin of [undefined,'null','https://evil.example','http://localhost:5601'])rejects(()=>connect(req({origin})),403);
 for(const host of ['evil.example','127.0.0.1:5602'])rejects(()=>connect(req({host})),403);
 rejects(()=>connect(req({},'192.0.2.1')),403);
 for(const ws of [undefined,B])rejects(()=>connect(req({'x-ahmatda-workspace':ws})),409);
 rejects(()=>run(()=>auth.connectLocalWorker(req(),{confirm:false})),400);
 rejects(()=>withWorkspace({...access,role:'viewer'},()=>auth.connectLocalWorker(req(),{confirm:true})),403);
 rejects(()=>withWorkspace({...access,machine:true},()=>auth.connectLocalWorker(req(),{confirm:true})),403);
 rejects(()=>withWorkspace({...access,demo:true},()=>auth.connectLocalWorker(req(),{confirm:true})),403);
});

test('실제 HTTP 등록은 로그인·CSRF·stale workspace를 검증하고 raw token을 응답하지 않는다',async()=>{
 async function post(headers){
  const payload=JSON.stringify({confirm:true});
  return new Promise((resolve,reject)=>{
   const r=http.request(base+'/api/settings/local-worker',{method:'POST',headers:{Host:'127.0.0.1:5601',Origin:'http://127.0.0.1:5601','Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),'X-Ahmatda-Workspace':A,...headers}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,text:async()=>Buffer.concat(chunks).toString()}));
   });r.on('error',reject);r.end(payload);
  });
 }
 assert.equal((await post({})).status,401);
 const cookie='ahmatda_session='+session;
 assert.equal((await post({Cookie:cookie,Origin:'http://evil.example'})).status,403);
 assert.equal((await post({Cookie:cookie,'X-Ahmatda-Workspace':B})).status,409);
 const good=await post({Cookie:cookie});const body=await good.text();assert.equal(good.status,200,body);assert.equal(JSON.parse(body).connected,true);assert.ok(!body.includes(credentials().token));
});

test('token은 승인 workspace에 고정되고 헤더로 다른 공간에 접근할 수 없다',()=>{
 const status=connect(),c=credentials();assert.equal(status.connected,true);assert.equal(fs.statSync(file).mode&0o777,0o600);assert.equal(c.capabilityHash,hash('a'.repeat(64)));
 assert.equal(worker(c.token,{'x-workspace-id':B,'x-ahmatda-workspace':B}).workspace.id,A);
 rejects(()=>worker(c.token,{},'192.0.2.1'),401);rejects(()=>worker(c.token,{host:'evil.example'}),401);
 rejects(()=>worker('ah_local_worker_'+'z'.repeat(43)),401);
 const audit=run(()=>db().prepare("SELECT after_json FROM audit_log WHERE entity='local-worker'").all());assert.ok(!JSON.stringify(audit).includes(c.token));
});

test('만료·권한회수·검증취소·교체·해제는 이전 토큰을 무효화한다',()=>{
 connect();let c=credentials();const d=auth.accountDb();
 d.prepare('UPDATE local_worker_connection SET expires_at=0').run();rejects(()=>worker(c.token),401);
 connect();c=credentials();d.prepare("UPDATE memberships SET role='reception' WHERE workspace_id=?").run(A);rejects(()=>worker(c.token),401);
 d.prepare("UPDATE memberships SET role='admin',active=0 WHERE workspace_id=?").run(A);rejects(()=>worker(c.token),401);
 d.prepare('UPDATE memberships SET active=1 WHERE workspace_id=?').run(A);d.prepare('UPDATE users SET verified_at=NULL WHERE id=?').run(user);rejects(()=>worker(c.token),401);
 d.prepare('UPDATE users SET verified_at=? WHERE id=?').run(new Date().toISOString(),user);
 connect();const fresh=credentials();rejects(()=>worker(c.token),401);assert.equal(worker(fresh.token).workspace.id,A);
 run(()=>auth.disconnectLocalWorker(req(),{confirm:true}));rejects(()=>worker(fresh.token),401);assert.equal(fs.existsSync(file),false);
});

test('다른 workspace는 연결 상태만 알 수 있고 기존 연결을 해제할 수 없다',()=>{
 connect();const other={...access,workspace:{id:B,name:'가짜 B'}};
 const status=withWorkspace(other,()=>auth.localWorkerSettings());assert.equal(status.configuredElsewhere,true);assert.equal(status.expiresAt,null);
 rejects(()=>withWorkspace(other,()=>auth.disconnectLocalWorker(req({'x-ahmatda-workspace':B}),{confirm:true})),403);
});

test('공개권한 파일·symlink·공개권한 데이터 폴더를 거부하고 worker.env를 보존한다',()=>{
 const legacy=path.join(root,'worker.env');fs.writeFileSync(legacy,'fake-do-not-overwrite',{mode:0o600});connect();assert.equal(fs.readFileSync(legacy,'utf8'),'fake-do-not-overwrite');
 fs.chmodSync(file,0o644);rejects(()=>connect(),503);fs.unlinkSync(file);
 fs.symlinkSync(legacy,file);rejects(()=>connect(),503);assert.equal(fs.readFileSync(legacy,'utf8'),'fake-do-not-overwrite');fs.unlinkSync(file);
 fs.chmodSync(root,0o755);rejects(()=>connect(),503);fs.chmodSync(root,0o700);
});

test('DB COMMIT 실패는 교체된 파일과 기존 DB token을 원상복구한다',()=>{
 connect();const before=fs.readFileSync(file,'utf8'),old=credentials();const d=auth.accountDb(),original=d.exec;
 d.exec=function(sql){if(sql==='COMMIT')throw new Error('fake commit failure');return original.call(this,sql);};
 try{assert.throws(()=>connect(),/fake commit failure/);}finally{d.exec=original;}
 assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(worker(old.token).workspace.id,A);
 assert.equal(fs.readdirSync(root).filter(f=>/^\.local-worker-/.test(f)).length,0);
});

test('최초 등록 DB COMMIT 실패는 새 자격증명 파일을 남기지 않는다',()=>{
 const d=auth.accountDb(),original=d.exec;d.exec=function(sql){if(sql==='COMMIT')throw new Error('fake commit failure');return original.call(this,sql);};
 try{assert.throws(()=>connect(),/fake commit failure/);}finally{d.exec=original;}
 assert.equal(fs.existsSync(file),false);assert.equal(d.prepare('SELECT count(*) AS n FROM local_worker_connection').get().n,0);
});

test('파일 rename 실패는 기존 파일/DB를 보존한다',()=>{
 connect();const before=fs.readFileSync(file,'utf8'),old=credentials();
 const mocked=mock.method(fs,'renameSync',()=>{throw new Error('fake rename failure');});syncBuiltinESMExports();
 try{assert.throws(()=>connect(),/fake rename failure/);}finally{mocked.mock.restore();syncBuiltinESMExports();}
 assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(worker(old.token).workspace.id,A);
 assert.equal(fs.readdirSync(root).filter(f=>/^\.local-worker-/.test(f)).length,0);
});


test('기존 환경변수 worker scope는 새 연결과 독립적으로 유지한다',()=>{
 process.env.WORKER_WORKSPACE_ID=B;connect();
 assert.equal(worker('legacy-fake-worker',{'x-ahmatda-workspace':A}).workspace.id,B);
 assert.equal(worker(credentials().token,{'x-ahmatda-workspace':B}).workspace.id,A);
 delete process.env.WORKER_WORKSPACE_ID;
});

test('다른 소유자의 자격증명 파일은 교체하지 않는다',()=>{
 connect();const before=fs.readFileSync(file,'utf8'),original=fs.lstatSync;
 const mocked=mock.method(fs,'lstatSync',(p,...args)=>{
  const st=original(p,...args);if(p===file)st.uid=process.getuid()+1;return st;
 });syncBuiltinESMExports();
 try{rejects(()=>connect(),503);}finally{mocked.mock.restore();syncBuiltinESMExports();}
 assert.equal(fs.readFileSync(file,'utf8'),before);
});

test('authorization endpoint reports token-bound workspace rather than requested workspace',async()=>{
 connect();const c=credentials();
 const response=await new Promise((resolve,reject)=>{const r=http.get(base+'/api/worker/authorization',{headers:{Host:'127.0.0.1:5601',Authorization:'Bearer '+c.token,'x-ahmatda-workspace':B}},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}));});r.on('error',reject);});
 assert.equal(response.status,200);assert.deepEqual(response.body,{authorized:true,workspaceId:A});
});
