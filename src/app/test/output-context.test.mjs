// 가짜 임시 작업공간만 사용하는 출력 맥락 회귀. 실제 사용자·메일·AI 없음.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';import path from 'node:path';import http from 'node:http';
const dir=mkdtempSync(path.join(os.tmpdir(),'ahcha-output-test-'));
process.env.DATA_DIR=dir;process.env.AI_PROVIDER='off';delete process.env.ANTHROPIC_API_KEY;
const {Router}=await import('../lib/http.mjs');
const {withWorkspace}=await import('../lib/db.mjs');
const {register}=await import('../routes/insights.mjs');
const {transcriptText}=await import('../public/js/pages/call-util.js');
test('복사한 통화 글은 개별 isFake true에만 가짜 표시를 붙인다',()=>{
 const base={title:'가짜 시험 제목',source:'upload',transcript:'가짜 시험 원문',segments:[]};
 for(const isFake of [true,false,undefined]){const output=transcriptText({...base,isFake});assert.equal(output.includes('(가짜 통화 데이터'),isFake===true);assert.ok(output.includes(base.transcript));}
});
test('실제 CSV route HTTP: demo만 demo 파일명, private는 중립 파일명 (인증 검증 아님)',async()=>{
 const router=new Router();register(router);let demo=true;
 const server=http.createServer((req,res)=>withWorkspace({demo,role:'admin',workspace:{id:demo?'demo':'legacy'}},()=>{
  const u=new URL(req.url,'http://localhost');router.match(req.method,u.pathname).route.handler({req,res,query:Object.fromEntries(u.searchParams)});
 }));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const mode of [true,false]){demo=mode;const res=await fetch(`http://127.0.0.1:${server.address().port}/api/shipping.csv?day=2026-01-01`);assert.equal(res.status,200);assert.equal(res.headers.get('content-disposition'),`attachment; filename="ahcha-${demo?'demo-':''}shipping-2026-01-01.csv"`);assert.match(await res.text(),/거래처/);}}
 finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});
