// 가짜 WAV와 임시 DB만 사용한다. 실제 디스크를 채우지 않는 ENOSPC 오류 주입 시험.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test, after} from 'node:test';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ahmatda-storage-recovery-'));
Object.assign(process.env, {DATA_DIR:root, DEMO_MODE:'1', AI_PROVIDER:'off', ALLOW_PAID_AI:'0', FFMPEG_PATH:'/missing-test-ffmpeg'});
const {makeWav} = await import('./fixtures/worker-helpers.mjs');
const {acceptRecording} = await import('../lib/jobs.mjs');
const {db,dataDir} = await import('../lib/db.mjs');
const d = db();
const workspace = dataDir();
after(()=>{d.close();fs.rmSync(root,{recursive:true,force:true});});
const files = name => fs.existsSync(path.join(workspace,name)) ? fs.readdirSync(path.join(workspace,name)).sort() : [];
const counts = () => ['calls','jobs'].map(table=>d.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
for (const [index,stage] of ['input','output','rename'].entries()) {
 test(`저장 공간 부족(${stage}) 뒤 임시 파일 정리·기존 자료 보존·같은 녹음 재시도`, async t=>{
  const input={buf:makeWav(.2,{freq:400+index*100}),source:'upload',isFake:true};
  const before={counts:counts(),audio:files('audio')};
  const target=stage==='rename'?'renameSync':'writeFileSync';
  const original=fs[target];let injected=false;
  t.mock.method(fs,target,function(file,...args){
   if(String(file).startsWith(path.join(workspace,'tmp')+path.sep) &&
      (stage==='rename'||String(file).endsWith('.out.wav')===(stage==='output'))){
    injected=true;
    // 쓰다가 실패한 경우도 검사한다. rename 실패는 완성된 임시 출력이 남는다.
    if(stage!=='rename')original.call(fs,file,Buffer.from('partial fake audio'));
    throw Object.assign(new Error('synthetic storage failure'),{code:'ENOSPC'});
   }
   return original.call(fs,file,...args);
  });
  try {await assert.rejects(acceptRecording(input),{code:'ENOSPC'});}
  finally {t.mock.restoreAll();}
  assert.equal(injected,true);
  assert.deepEqual(counts(),before.counts);
  assert.deepEqual(files('audio'),before.audio);
  assert.deepEqual(files('tmp'),[]);
  const saved=await acceptRecording(input);
  assert.equal(saved.duplicate,false);
  assert.deepEqual(counts(),before.counts.map(n=>n+1));
  const row=d.prepare('SELECT audio_file FROM calls WHERE id=?').get(saved.callId);
  assert.deepEqual(fs.readFileSync(path.join(workspace,row.audio_file)),input.buf);
  assert.deepEqual(files('tmp'),[]);
  const retry=await acceptRecording(input);
  assert.equal(retry.duplicate,true);
  assert.equal(retry.callId,saved.callId);
  assert.deepEqual(counts(),before.counts.map(n=>n+1));
  assert.equal(files('audio').length,before.audio.length+1);
 });
}

test('일감 DB 저장 실패는 통화 행·완성 WAV도 되돌리고 재시도를 허용한다', async()=>{
 const input={buf:makeWav(.2,{freq:850}),source:'upload',isFake:true};
 const before={counts:counts(),audio:files('audio')};
 // SQLite FULL 자체가 아니라 INSERT 실패 시 원자성과 파일 정리를 확인한다.
 d.exec("CREATE TEMP TRIGGER fail_fake_job BEFORE INSERT ON jobs BEGIN SELECT RAISE(ABORT, 'synthetic job storage failure'); END");
 try {await assert.rejects(acceptRecording(input),/synthetic job storage failure/);}
 finally {d.exec('DROP TRIGGER fail_fake_job');}
 assert.deepEqual(counts(),before.counts);
 assert.deepEqual(files('audio'),before.audio);
 assert.deepEqual(files('tmp'),[]);
 const saved=await acceptRecording(input);
 assert.equal(saved.duplicate,false);
 assert.deepEqual(counts(),before.counts.map(n=>n+1));
});
