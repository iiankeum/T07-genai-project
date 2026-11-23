// 가짜 데이터만 사용한다. 운영 서버·계정·키를 읽거나 배포하지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';import {pathToFileURL} from 'node:url';import net from 'node:net';
const app=path.resolve(import.meta.dirname,'..');
const baseline=path.resolve(process.env.GATE_BASE_APP||'');
assert.ok(process.env.GATE_BASE_APP && baseline!==app,'GATE_BASE_APP must identify a separate baseline checkout');
assert.ok(fs.existsSync(path.join(baseline,'lib/db.mjs')),'baseline database module missing');
const revision=dir=>execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8',timeout:3000}).trim();
const candidateSHA=revision(app),baselineSHA=revision(baseline);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ahcha-release-fake-'));
const env={PATH:process.env.PATH,HOME:root,TMPDIR:root,DATA_DIR:root,DEMO_MODE:'0',AI_PROVIDER:'off',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=200',HOST:'127.0.0.1',PORT:'0',GIT_COMMIT:candidateSHA};
function runDb(dir,seed=false){
 const code=`import assert from 'node:assert/strict';import {openDb} from ${JSON.stringify(pathToFileURL(path.join(dir,'lib/db.mjs')).href)};
 const d=openDb(${JSON.stringify(path.join(root,'callnote.sqlite'))});
 ${seed?`d.prepare("INSERT INTO calls(id,created_at,recorded_at,source,status,title,is_fake) VALUES(?,?,?,?,?,?,1)").run('fake-release-call','2026-01-01','2026-01-01','seed','ready','가짜 보존 자료');d.prepare("INSERT INTO meta(key,value)VALUES(?,?)").run('fake-release','preserve-me');
d.prepare("INSERT INTO cards(call_id,note,created_at,updated_at)VALUES(?,?,?,?)").run('fake-release-call','가짜 주문 보존','2026-01-01','2026-01-01');
d.prepare("INSERT INTO glossary(id,kind,term,created_at,updated_at)VALUES(?,?,?,?,?)").run('fake-term','현장말','가짜 용어','2026-01-01','2026-01-01');`:''}
 assert.equal(d.prepare("SELECT title FROM calls WHERE id='fake-release-call'").get().title,'가짜 보존 자료');
 assert.equal(d.prepare("SELECT value FROM meta WHERE key='fake-release'").get().value,'preserve-me');
 assert.equal(d.prepare("SELECT note FROM cards WHERE call_id='fake-release-call'").get().note,'가짜 주문 보존');
 assert.equal(d.prepare("SELECT term FROM glossary WHERE id='fake-term'").get().term,'가짜 용어');
 ${dir===app?`assert.equal(d.prepare("SELECT domain_version FROM cards WHERE call_id='fake-release-call'").get().domain_version,'automotive@1');`:''}
 d.prepare("UPDATE meta SET value=? WHERE key='fake-release'").run('preserve-me');
 assert.equal(d.prepare('PRAGMA integrity_check').get().integrity_check,'ok');d.close();`;
 execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:dir,env,stdio:'pipe',timeout:20000});
}
const demo=process.env.GATE_DEMO_MODE==='1';
let child;let logs='';
try{
 runDb(baseline,true);runDb(app);runDb(baseline);runDb(app); // upgrade + old-code reopen, no destructive data rewrite
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 child=spawn(process.execPath,['--import',path.join(app,'tools/no-paid-ai.mjs'),'src/app/server.mjs'],{cwd:path.resolve(app,'../..'),env:{...env,DEMO_MODE:demo?'1':'0',PORT:String(port)},stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-4096);});
 let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error('isolated server exited '+child.exitCode);try{const r=await fetch('http://127.0.0.1:'+port+'/healthz',{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'production entrypoint startup timeout');
 const base='http://127.0.0.1:'+port;
 const health=await fetch(base+'/healthz',{signal:AbortSignal.timeout(3000)});assert.equal(health.status,200);const h=await health.json();assert.equal(h.ok,true);assert.equal(h.commit,candidateSHA);
 const page=await fetch(base+'/',{signal:AbortSignal.timeout(3000)});assert.equal(page.status,200);assert.match(await page.text(),/아차/);
 assert.equal((await fetch(base+'/api/calls',{signal:AbortSignal.timeout(3000)})).status,demo?200:401,'calls access must match demo/private mode');
 console.log(JSON.stringify({candidateSHA,baselineSHA,fakeDataOnly:true,productionDependencies:true,heapLimitMB:200,baselineUpgradeAndOldCodeReopen:'pass',sqliteIntegrity:'pass',health:'pass',callsStatus:demo?200:401,demoMode:demo,limits:['not a production database backup','no real signup/mail/worker/model verification','not a 300MB cgroup load test']}));
}catch(error){console.error(logs);throw error;}finally{if(child && child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,3000))]);if(child.exitCode===null){child.kill('SIGKILL');await new Promise(r=>child.once('exit',r));}}fs.rmSync(root,{recursive:true,force:true});}
