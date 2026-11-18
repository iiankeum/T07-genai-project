// 가짜 계정·카드·WAV만 사용한 중지 상태 전체 디렉터리 tar 복원 시험.
// Docker 볼륨·운영 중 백업·실제 서버 복구·암호화 보관을 검증하는 시험은 아니다.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('stopped whole-directory backup restores accounts, two workspace DBs, cards and exact audio with access isolation',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ahmatda-fake-backup-'));let closeRestored=async()=>{};
 t.after(async()=>{await closeRestored();fs.rmSync(root,{recursive:true,force:true});});
 const source=path.join(root,'source'),restored=path.join(root,'restored'),archive=path.join(root,'fake-data.tar.gz');
 fs.mkdirSync(source,{mode:0o700});fs.mkdirSync(restored,{mode:0o700});
 const env={...process.env,DATA_DIR:source,DEMO_MODE:'0',AI_PROVIDER:'off',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',FFMPEG_PATH:'/missing-fake-ffmpeg'};
 const appRoot=path.resolve(import.meta.dirname,'..');
 const wsA='ws_'+'a'.repeat(19),wsB='ws_'+'b'.repeat(19),password='FakeRestorePassword123';
 // This child owns every SQLite connection. Archive starts only after it has exited.
 const seed=`
 import fs from 'node:fs';import path from 'node:path';import {scryptSync} from 'node:crypto';
 import {accountDb,machineWorkspace} from './lib/auth.mjs';import {db,dataDir,withWorkspace} from './lib/db.mjs';
 import {makeWav} from './test/fixtures/worker-helpers.mjs';
 const now=new Date().toISOString(),a=accountDb(),salt='a'.repeat(32),pw='scrypt:'+salt+':'+scryptSync(${JSON.stringify(password)},salt,64).toString('hex');
 for(const [id,ws,role]of [['fake-a',${JSON.stringify(wsA)},'admin'],['fake-b',${JSON.stringify(wsB)},'admin'],['fake-viewer',${JSON.stringify(wsA)},'viewer']]){
 a.prepare('INSERT OR IGNORE INTO workspaces(id,name,created_at)VALUES(?,?,?)').run(ws,'가짜 '+ws,now);
 a.prepare('INSERT INTO users(id,email,name,password_hash,verified_at,terms_version,consent_at,created_at)VALUES(?,?,?,?,?,?,?,?)').run(id,id+'@example.test',id,pw,now,'fake-test',now,now);
 a.prepare('INSERT INTO memberships(workspace_id,user_id,role,active,created_at)VALUES(?,?,?,1,?)').run(ws,id,role,now);
 }
 for(const [index,ws]of [${JSON.stringify(wsA)},${JSON.stringify(wsB)}].entries())withWorkspace(machineWorkspace(ws),()=>{
 const d=db(),dir=dataDir();fs.mkdirSync(path.join(dir,'audio'),{recursive:true,mode:0o700});
 const audio=makeWav(.15,{freq:400+index*300});fs.writeFileSync(path.join(dir,'audio/fake.wav'),audio,{mode:0o600});
 d.prepare("INSERT INTO calls(id,created_at,recorded_at,source,status,title,transcript,audio_file,is_fake)VALUES(?,?,?,'upload','ready',?,?,?,1)").run('fake-call-'+index,now,now,'가짜 제목 '+index,'가짜 받아쓰기 '+index,'audio/fake.wav');
 d.prepare('INSERT INTO cards(call_id,note,created_at,updated_at)VALUES(?,?,?,?)').run('fake-call-'+index,'가짜 카드 원본 '+index,now,now);
 d.close();});a.close();
 `;
 execFileSync(process.execPath,['--input-type=module','-e',seed],{cwd:appRoot,env,stdio:'pipe'});
 const expected=[wsA,wsB].map(ws=>{const file=path.join(source,'workspaces',ws,'audio/fake.wav');return {hash:hash(fs.readFileSync(file)),mode:fs.statSync(file).mode&0o777};});
 fs.writeFileSync(archive,'',{flag:'wx',mode:0o600});
 execFileSync('tar',['-C',source,'-czf',archive,'.'],{stdio:'pipe'});
 assert.equal(fs.statSync(archive).mode&0o777,0o600);
 // Changes after the snapshot must not leak into the restored copy.
 fs.writeFileSync(path.join(source,'workspaces',wsA,'audio/fake.wav'),'after-backup fake bytes');
 execFileSync('tar',['-C',restored,'-xzf',archive],{stdio:'pipe'});
 for(const [index,ws]of [wsA,wsB].entries()){const file=path.join(restored,'workspaces',ws,'audio/fake.wav');assert.equal(hash(fs.readFileSync(file)),expected[index].hash);assert.equal(fs.statSync(file).mode&0o777,expected[index].mode);}
 Object.assign(process.env,{...env,DATA_DIR:restored});
 const {buildRouter,createApp}=await import('../server.mjs');const {accountDb,machineWorkspace}=await import('../lib/auth.mjs');const {db,withWorkspace}=await import('../lib/db.mjs');
 const {router}=await buildRouter();const server=http.createServer(createApp(router));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 closeRestored=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));for(const ws of [wsA,wsB])withWorkspace(machineWorkspace(ws),()=>db().close());accountDb().close();};
 const base='http://127.0.0.1:'+server.address().port;
 const request=(route,cookie,options={})=>fetch(base+route,{...options,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...options.headers}});
 const cookies=[];
 for(const id of ['fake-a','fake-b','fake-viewer']){const login=await request('/api/auth/login',null,{method:'POST',body:JSON.stringify({email:id+'@example.test',password})});assert.equal(login.status,200);cookies.push(login.headers.get('set-cookie').split(';')[0]);}
 for(let i=0;i<2;i++){
 const audio=await request('/api/calls/fake-call-'+i+'/audio',cookies[i]);assert.equal(audio.status,200);assert.equal(hash(Buffer.from(await audio.arrayBuffer())),expected[i].hash);
 const detail=await request('/api/calls/fake-call-'+i,cookies[i]);assert.equal(detail.status,200);const text=await detail.text();assert.ok(text.includes('가짜 카드 원본 '+i));assert.ok(text.includes('가짜 받아쓰기 '+i));
 assert.equal((await request('/api/calls/fake-call-'+(1-i)+'/audio',cookies[i])).status,404);
 assert.equal((await request('/api/calls/fake-call-'+(1-i),cookies[i])).status,404);
 }
 assert.equal((await request('/api/calls/fake-call-0/audio')).status,401);
 assert.equal((await request('/api/calls/fake-call-0/audio',cookies[2])).status,200);
 assert.equal((await request('/api/cards/fake-call-0',cookies[2],{method:'PATCH',body:JSON.stringify({note:'forbidden fake edit'})})).status,403);
 assert.equal((await request('/api/settings/data/export',cookies[2])).status,403);
 assert.equal((await request('/api/auth/workspaces/switch',cookies[1],{method:'POST',body:JSON.stringify({workspaceId:wsA})})).status,403);
 withWorkspace(machineWorkspace(wsA),()=>assert.equal(db().prepare('SELECT note FROM cards WHERE call_id=?').get('fake-call-0').note,'가짜 카드 원본 0'));
});
