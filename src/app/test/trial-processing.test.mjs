// 가짜 신청/관리자와 폐기 가능한 DB만 사용한다. 연락·메일·외부 API 없음.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import { Readable } from 'node:stream';
process.env.DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'fake-trial-process-'));
process.env.ADMIN_PASSCODE='fake-trial-admin-only';
const { globalDb, openDb }=await import('../lib/db.mjs');
const { Router }=await import('../lib/http.mjs');
const { adminLogin }=await import('../lib/security.mjs');
const { register }=await import('../routes/admin.mjs');
const { DatabaseSync }=await import('node:sqlite');
const router=new Router();register(router);
const cookie='cn_admin='+adminLogin(process.env.ADMIN_PASSCODE);
const d=globalDb();
d.prepare('INSERT INTO trials(id,created_at,name,contact,consent_at) VALUES(?,?,?,?,?)').run('fake-trial','2026-01-01','가짜 개인정보','fake@example.invalid','2026-01-01');
function invoke(method,id='',body={},authorized=true){const m=router.match(method,'/api/admin/trials'+(id?'/'+id:''));const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.headers={'content-type':'application/json',...(authorized?{cookie}:{})};return m.route.handler({req,params:m.params});}
test('관리자 전용, boolean 검증, 없는 신청',async()=>{
 await assert.rejects(invoke('PATCH','fake-trial',{processed:true},false),e=>e.status===401&&e.code==='admin_required');
 for(const body of [{},{processed:'true'},{processed:1},{processed:null},{processed:true,name:'변조'}])await assert.rejects(invoke('PATCH','fake-trial',body),e=>e.status===400);
 await assert.rejects(invoke('PATCH','missing',{processed:true}),e=>e.status===404);
 assert.equal(d.prepare('SELECT processed FROM trials').get().processed,0);
});
test('표시·취소·중복은 안정적이며 감사에 개인정보 없음, 별도 연결 읽기 유지',async()=>{
 const a=await invoke('PATCH','fake-trial',{processed:true});assert.equal(a.changed,true);assert.ok(a.processedAt);
 const b=await invoke('PATCH','fake-trial',{processed:true});assert.equal(b.changed,false);assert.equal(b.processedAt,a.processedAt);
 const listed=invoke('GET').trials.find(t=>t.id==='fake-trial');assert.equal(listed.processed,true);
 const reopened=openDb(path.join(process.env.DATA_DIR,'callnote.sqlite'));assert.equal(reopened.prepare('SELECT processed FROM trials WHERE id=?').get('fake-trial').processed,1);reopened.close();
 const c=await invoke('PATCH','fake-trial',{processed:false});assert.equal(c.processed,false);assert.equal(c.processedAt,null);
 await invoke('PATCH','fake-trial',{processed:false});
 const logs=d.prepare("SELECT * FROM audit_log WHERE entity='trial'").all();assert.equal(logs.length,2);
 assert.deepEqual(logs.map(x=>x.action),['mark_processed','unmark_processed']);
 for(const r of logs){assert.equal(r.actor_name,null);assert.equal(r.before_json,null);assert.equal(r.after_json,null);}
 assert.doesNotMatch(JSON.stringify(logs),/가짜 개인정보|example.invalid/);
});
test('감사 저장 실패면 처리 여부도 롤백',async()=>{
 d.exec("CREATE TRIGGER fake_audit_failure BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'fake audit failure'); END;");
 await assert.rejects(invoke('PATCH','fake-trial',{processed:true}),/fake audit failure/);
 assert.equal(d.prepare('SELECT processed FROM trials').get().processed,0);d.exec('DROP TRIGGER fake_audit_failure');
});
test('기존 행 마이그레이션 기본 미처리 및 재오픈 무손실',()=>{
 const file=path.join(process.env.DATA_DIR,'fake-old.sqlite');const old=new DatabaseSync(file);
 old.exec('CREATE TABLE trials(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,name TEXT NOT NULL,org TEXT,contact TEXT NOT NULL,role TEXT,message TEXT,consent_at TEXT NOT NULL,ip_hash TEXT,extra TEXT)');
 old.prepare('INSERT INTO trials(id,created_at,name,contact,consent_at) VALUES(?,?,?,?,?)').run('fake-old','2026','가짜 이름','fake','2026');old.close();
 for(let i=0;i<2;i++){const migrated=openDb(file);const row=migrated.prepare('SELECT * FROM trials').get();assert.equal(row.processed,0);assert.equal(row.processed_at,null);assert.equal(row.name,'가짜 이름');assert.throws(()=>migrated.exec('UPDATE trials SET processed=2'),/CHECK/);migrated.close();}
});
test('기존 삭제 유지',()=>{assert.equal(invoke('DELETE','fake-trial').ok,true);assert.equal(invoke('GET').trials.length,0);});
after(()=>fs.rmSync(process.env.DATA_DIR,{recursive:true,force:true}));
