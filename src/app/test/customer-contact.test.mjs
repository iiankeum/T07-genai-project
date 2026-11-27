import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './fixtures/worker-helpers.mjs';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ahmatda-knowledge-'));
process.env.DATA_DIR = dataDir;
process.env.DEMO_MODE = '1';
process.env.AUTH_MAIL_MODE = 'outbox';
process.env.AI_PROVIDER = 'off';
const { db, nowIso } = await import('../lib/db.mjs');
const { dictionaryForAi, customerByPhone } = await import('../lib/repo.mjs');
const { seedDemo, loadSeedFiles } = await import('../lib/seed.mjs');
const routes = await Promise.all([import('../routes/glossary.mjs'), import('../routes/auth.mjs')]);
let server;
before(async () => {
  await seedDemo({ reset: true });
  server = await startServer(routes);
});
after(async () => {
  await server?.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function req(method, url, { body, ip = '10.1.0.1', cookie, raw } = {}) {
  const headers = { 'x-forwarded-for': ip };
  if (body !== undefined) headers['content-type'] = raw ? 'text/plain' : 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await fetch(server.base + url, { method, headers, body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)) });
  const text = await res.text();
  const json = res.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(text) : null;
  return { status: res.status, json, text, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
const k = (id) => '/api/knowledge/' + id;
const review = (itemId, revisionId, decision = 'approve', opts = {}) => req('POST', k(itemId) + '/revisions/' + revisionId + '/review', { ...opts, body: { decision, ...opts.body } });
const dictionaryHas = (term) => dictionaryForAi().glossary.some((item) => item.term === term);

test('거래처 담당자 승인·마스킹·CSV·AI 제외·수정 유지와 삭제', async () => {
 const made=await req('POST','/api/knowledge',{body:{kind:'거래처',term:'가짜 담당자 시험 거래처',contactName:'가짜담당자',phone:'010-0000-1234',note:'가짜 정의',evidenceNote:'가짜 출처'}});
 assert.equal(made.status,200,made.text);const id=made.json.id;
 assert.equal(made.json.contactName,'***');assert.ok(!made.text.includes('가짜담당자'));
 assert.equal(db().prepare('SELECT contact_name FROM glossary WHERE id=?').get(id).contact_name,'가짜담당자');
 assert.equal(dictionaryForAi().customers.some(x=>x.name==='가짜 담당자 시험 거래처'),false);
 assert.equal((await review(id,made.json.revisionId)).status,200);
 assert.ok(!JSON.stringify(dictionaryForAi()).includes('가짜담당자'));
 const detail=await req('GET',k(id));assert.ok(!detail.text.includes('가짜담당자'));assert.equal(detail.json.item.contactName,'***');
 const csv=await req('GET','/api/knowledge.csv');assert.equal(csv.status,200);assert.ok(csv.text.includes('contactName'));assert.ok(!csv.text.includes('가짜담당자'));
 const imported=await req('POST','/api/knowledge/import',{body:{csv:'kind,term,contactName\n거래처,가짜 담당자 시험 거래처,\n'}});
 assert.equal(imported.status,200,imported.text);await review(id,imported.json.results[0].revisionId);
 assert.equal(db().prepare('SELECT contact_name FROM glossary WHERE id=?').get(id).contact_name,'가짜담당자');
 const edit=await req('PATCH',k(id),{body:{contactName:'***',note:'다른 가짜 정의',evidenceNote:'가짜 근거'}});assert.equal(edit.status,200,edit.text);await review(id,edit.json.revisionId);
 assert.equal(db().prepare('SELECT contact_name FROM glossary WHERE id=?').get(id).contact_name,'가짜담당자');
 const clear=await req('PATCH',k(id),{body:{contactName:'',note:'가짜 정의',evidenceNote:'가짜 출처'}});await review(id,clear.json.revisionId);
 assert.equal(db().prepare('SELECT contact_name FROM glossary WHERE id=?').get(id).contact_name,null);
});
test('담당자 글자수·타입·제어문자 검사, 거래처 외 저장 금지, 구버전 이력 호환',async()=>{
 for(const contactName of ['가'.repeat(41),42,{name:'x'},'가짜\n이름']){
  const r=await req('POST','/api/knowledge',{body:{kind:'거래처',term:'가짜 길이 검사',contactName,note:'가짜',evidenceNote:'가짜'}});assert.equal(r.status,400,r.text);
 }
 const r=await req('POST','/api/knowledge',{body:{kind:'부품',term:'가짜 부품 담당자',contactName:'가짜담당자',note:'가짜',evidenceNote:'가짜'}});assert.equal(r.status,200,r.text);assert.equal(r.json.contactName,null);
 const old=await req('POST','/api/knowledge',{body:{kind:'거래처',term:'가짜 구버전 담당자',note:'가짜',evidenceNote:'가짜'}});
 db().prepare("UPDATE knowledge_revisions SET snapshot=json_remove(snapshot,'$.contactName') WHERE id=?").run(old.json.revisionId);
 assert.equal((await review(old.json.id,old.json.revisionId)).status,200);
 assert.equal(db().prepare('SELECT contact_name FROM glossary WHERE id=?').get(old.json.id).contact_name,null);
});
test('기존 DB 행에 contact_name 기본 null 마이그레이션',async()=>{
 const {openDb}=await import('../lib/db.mjs');const file=path.join(dataDir,'fake-legacy-contact.sqlite');let d=openDb(file);
 d.exec('ALTER TABLE glossary DROP COLUMN contact_name');
 d.prepare("INSERT INTO glossary(id,kind,term,status,source,created_at,updated_at) VALUES('fake-old','거래처','가짜 기존 거래처','approved','사용자','2026','2026')").run();d.close();
 d=openDb(file);assert.equal(d.prepare("SELECT contact_name FROM glossary WHERE id='fake-old'").get().contact_name,null);d.close();
});

test('CSV 담당자 입력은 승인 대기이며 기존 이름 없는 CSV도 호환된다',async()=>{
 const imported=await req('POST','/api/knowledge/import',{body:{csv:'kind,term,contactName\n거래처,가짜 CSV 담당자 거래처,가짜새담당\n'}});assert.equal(imported.status,200,imported.text);
 const id=imported.json.results[0].id;const row=db().prepare('SELECT status,contact_name FROM glossary WHERE id=?').get(id);assert.equal(row.status,'pending');assert.equal(row.contact_name,'가짜새담당');
 const old=await req('POST','/api/knowledge/import',{body:{csv:'kind,term\n거래처,가짜 CSV 구형 거래처\n'}});assert.equal(old.status,200,old.text);assert.equal(db().prepare('SELECT contact_name FROM glossary WHERE id=?').get(old.json.results[0].id).contact_name,null);
});
