// 모든 통화와 오디오는 가짜 테스트 데이터다. 외부 제공자를 호출하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.DEMO_MODE = '0';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-err07-'));
const { db, dataDir, withWorkspace } = await import('../lib/db.mjs');
const { enqueue, claim, fail, complete } = await import('../lib/jobs.mjs');
const { config } = await import('../lib/config.mjs');
const { retryTranscription, register } = await import('../routes/calls.mjs');
const { Router } = await import('../lib/http.mjs');
const access = (id='ws_aaaaaaaaaaaaaaaaaaa', role='reception') => ({workspace:{id},user:{id:'fake-user',name:'가짜'},role,demo:false});
function seed(id, audio=true) {
 const now=new Date().toISOString();
 db().prepare("INSERT INTO calls(id,created_at,recorded_at,source,status,audio_file,is_fake) VALUES(?,?,?,'upload','queued',?,1)").run(id,now,now,audio?`audio/${id}.wav`:null);
 if(audio){fs.mkdirSync(path.join(dataDir(),'audio'),{recursive:true});fs.writeFileSync(path.join(dataDir(),`audio/${id}.wav`),Buffer.from('fake audio'));}
 const j=enqueue(id);
 for(let i=0;i<config.jobMaxAttempts;i++){const job=claim('fake-worker');assert.equal(job.id,j);fail(j,'fake-worker','fake transcription failure');}
 assert.equal(db().prepare('SELECT status FROM calls WHERE id=?').get(id).status,'failed');return j;
}
test('exhausted failure requeues once, retains audio/history, succeeds without upload',async()=>withWorkspace(access(),async()=>{
 const old=seed('fake_retry');const before=fs.readFileSync(path.join(dataDir(),'audio/fake_retry.wav'));
 const results=await Promise.all(Array.from({length:20},async()=>retryTranscription('fake_retry')));
 assert.equal(new Set(results.map(x=>x.jobId)).size,1);assert.equal(results.filter(x=>x.requeued).length,1);
 assert.equal(db().prepare("SELECT count(*) n FROM jobs WHERE call_id='fake_retry' AND state IN ('queued','leased')").get().n,1);
 assert.equal(db().prepare('SELECT state FROM jobs WHERE id=?').get(old).state,'failed');assert.deepEqual(fs.readFileSync(path.join(dataDir(),'audio/fake_retry.wav')),before);
 const next=claim('fake-worker');assert.equal(retryTranscription('fake_retry').jobId,next.id);assert.ok(complete(next.id,'fake-worker'));
 assert.equal(db().prepare("SELECT status FROM calls WHERE id='fake_retry'").get().status,'extracting');assert.throws(()=>retryTranscription('fake_retry'),e=>e.code==='not_retryable');
}));
test('reject missing audio and traversal, no new queue',()=>withWorkspace(access(),()=>{
 for(const id of ['fake_missing','fake_gone','fake_escape']){seed(id,id!=='fake_missing');if(id==='fake_gone')fs.unlinkSync(path.join(dataDir(),`audio/${id}.wav`));if(id==='fake_escape')db().prepare('UPDATE calls SET audio_file=? WHERE id=?').run('../elsewhere.wav',id);assert.throws(()=>retryTranscription(id),e=>e.code==='no_audio');}
 assert.equal(db().prepare("SELECT count(*) n FROM jobs WHERE state IN ('queued','leased')").get().n,0);
}));
test('workspace isolation, unauthenticated and read-only rejection',()=>{
 withWorkspace(access('ws_bbbbbbbbbbbbbbbbbbb'),()=>assert.throws(()=>retryTranscription('fake_retry'),e=>e.code==='not_found'));
 withWorkspace(access(undefined,'viewer'),()=>assert.throws(()=>retryTranscription('fake_retry'),e=>e.code==='permission_denied'));
 withWorkspace(access(undefined,'shipping'),()=>assert.throws(()=>retryTranscription('fake_retry'),e=>e.code==='permission_denied'));
 assert.throws(()=>retryTranscription('fake_retry'),e=>e.code==='login_required');
});
test('POST route exists and completed transcript cannot retry',()=>withWorkspace(access(),()=>{
 const r=new Router();register(r);assert.ok(r.match('POST','/api/calls/fake_retry/retry-transcription')?.route);
 seed('fake_transcript');db().prepare("UPDATE calls SET transcript='가짜 받아쓰기' WHERE id='fake_transcript'").run();assert.throws(()=>retryTranscription('fake_transcript'),e=>e.code==='not_retryable');
}));

test('initial queued job is not a manual retry and escaped symlink cannot enqueue',()=>withWorkspace(access(),()=>{
 const now=new Date().toISOString();db().prepare("INSERT INTO calls(id,created_at,recorded_at,source,status,is_fake) VALUES('fake_pending',?,?,'upload','queued',1)").run(now,now);
 assert.throws(()=>retryTranscription('fake_pending'),e=>e.code==='not_retryable');
 seed('fake_link');const f=path.join(dataDir(),'audio/fake_link.wav');fs.unlinkSync(f);const outside=path.join(process.env.DATA_DIR,'fake-outside.wav');fs.writeFileSync(outside,'fake');fs.symlinkSync(outside,f);assert.throws(()=>retryTranscription('fake_link'),e=>e.code==='no_audio');
}));
