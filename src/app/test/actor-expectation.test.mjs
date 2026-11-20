import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import http from 'node:http';import {createHash} from 'node:crypto';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ahmatda-actor-'));
Object.assign(process.env,{DATA_DIR:root,DEMO_MODE:'0',AI_PROVIDER:'off',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:''});
const {accountDb}=await import('../lib/auth.mjs');const {buildRouter,createApp}=await import('../server.mjs');
const ws='ws_'+'a'.repeat(19), other='ws_'+'b'.repeat(19),users=['fake-actor-a','fake-actor-b'],tokens=['a'.repeat(43),'b'.repeat(43)];let server,base;
before(async()=>{const d=accountDb(),now=new Date().toISOString();
 for(const id of [ws,other])d.prepare('INSERT INTO workspaces(id,name,created_at) VALUES(?,?,?)').run(id,'가짜 공간',now);
 for(let i=0;i<2;i++){d.prepare('INSERT INTO users(id,email,name,password_hash,verified_at,terms_version,consent_at,created_at) VALUES(?,?,?,?,?,?,?,?)').run(users[i],`fake${i}@example.test`,'가짜 사용자','not-real',now,'test',now,now);d.prepare('INSERT INTO memberships(workspace_id,user_id,role,active,created_at) VALUES(?,?,?,1,?)').run(ws,users[i],'admin',now);d.prepare('INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES(?,?,?,?)').run(createHash('sha256').update(tokens[i]).digest('hex'),users[i],ws,Date.now()+600000);}
 const {router}=await buildRouter();server=http.createServer(createApp(router));await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
});
after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});});
function req(route,{actor=users[0],workspace=ws,method='GET',body,identity=1}={}){return fetch(base+route,{method,headers:{cookie:`ahmatda_session=${tokens[identity]}`,...(actor===null?{}:{'X-Ahmatda-Actor':actor}),...(workspace===null?{}:{'X-Ahmatda-Workspace':workspace}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
test('same-workspace cookie switch cannot save under a different actor',async()=>{
 const res=await req('/api/settings/workspace',{method:'PATCH',body:{name:'다른 계정으로 저장되면 안 됨'}});
 assert.equal(res.status,409);assert.equal((await res.json()).error,'actor_changed');assert.equal(accountDb().prepare('SELECT name FROM workspaces WHERE id=?').get(ws).name,'가짜 공간');
});
test('old actor query blocks export/audio, even with current actor header',async()=>{for(const route of ['/api/settings/data/export','/api/calls/fake-call/audio']){const res=await req(`${route}?actor=${users[0]}&workspace=${ws}`,{actor:users[1]});assert.equal(res.status,409);assert.equal((await res.json()).error,'actor_changed');}});
test('current actor succeeds and absent expectation keeps legacy compatibility',async()=>{assert.equal((await req('/api/calls',{actor:users[1]})).status,200);assert.equal((await req('/api/calls',{actor:null})).status,200);});
test('workspace mismatch still refused with correct actor',async()=>{const res=await req('/api/calls',{actor:users[1],workspace:other});assert.equal(res.status,409);assert.equal((await res.json()).error,'workspace_changed');});

test('fresh workspace header cannot override stale export/audio query',async()=>{for(const route of ['/api/settings/data/export','/api/calls/fake-call/audio']){const res=await req(`${route}?actor=${users[1]}&workspace=${other}`,{actor:users[1],workspace:ws});assert.equal(res.status,409);assert.equal((await res.json()).error,'workspace_changed');}});

test('stale actor cannot mutate profile or preferences in the same workspace',async()=>{
 for(const [route,body]of [['profile',{name:'stale-name'}],['preferences',{bigText:true}]]){const res=await req('/api/auth/'+route,{method:'PATCH',body});assert.equal(res.status,409);assert.equal((await res.json()).error,'actor_changed');}
 assert.equal(accountDb().prepare('SELECT name FROM users WHERE id=?').get(users[1]).name,'가짜 사용자');
});
test('current actor account mutation succeeds and public auth lifecycle ignores stale expectation',async()=>{
 assert.equal((await req('/api/auth/profile',{actor:users[1],method:'PATCH',body:{name:'current-fake'}})).status,200);
 assert.equal((await req('/api/auth/preferences',{actor:users[1],method:'PATCH',body:{bigText:false}})).status,200);
 for(const route of ['login','signup','password/request','password/reset','invite/info','verify']){const res=await req('/api/auth/'+route,{method:'POST',body:{}});assert.notEqual(res.status,409);assert.notEqual((await res.json()).error,'actor_changed');}
});
test('all explicit authenticated lifecycle mutations reject stale actor before their handler',async()=>{
 for(const route of ['password/change','workspaces','workspaces/switch','invite/accept','logout']){const res=await req('/api/auth/'+route,{method:'POST',body:{}});assert.equal(res.status,409);assert.equal((await res.json()).error,'actor_changed');}
});
