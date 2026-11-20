// Actual local app, API, storage and dashboard. Only the model response is a deferred fixture.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
Object.assign(process.env, { DATA_DIR: await mkdtemp(path.join(os.tmpdir(), 'acha-transcript-order-')), DEMO_MODE:'1', AI_PROVIDER:'fixture', ALLOW_PAID_AI:'0', ANTHROPIC_API_KEY:'' });
const { buildRouter, createApp } = await import('../server.mjs');
const { db, withWorkspace } = await import('../lib/db.mjs');
const { demoAccess } = await import('../lib/auth.mjs');
const { onTranscript } = await import('../lib/pipeline.mjs');
const { setClientForTest } = await import('../lib/ai.mjs');
const { callHref } = await import('../public/js/pages/board.js');
const { AiError } = await import('../lib/ai-error.mjs');
const stamp = new Date().toISOString();
const segments = [{start:0,end:7,text:'예시 정비소인데 앞 범퍼 두 개 주세요. 차종은 확인하고 다시 전화드릴게요.'}];
withWorkspace(demoAccess(), () => {
  const insert = db().prepare("INSERT INTO calls(id, created_at, recorded_at, source, status, title, transcript, segments, is_fake) VALUES(?,?,?,'upload','ready',?,?,?,1)");
  for (const id of ['fixture-order','fixture-failure','fixture-auto']) insert.run(id,stamp,stamp,'예시 정비소 앞 범퍼',segments[0].text,JSON.stringify(segments));
});
let release, requests=0, fail=false;
const fake = async () => {
  requests++;
  await new Promise(resolve => { release=resolve; });
  if (fail) throw new AiError('no_key');
  const card = {call_type:'주문',customer:'예시 정비소',contact:null,car_model:null,model_year:null,plate:null,
    items:[{part:'앞 범퍼',side:null,qty:2,part_no:null,quote:'앞 범퍼 두 개 주세요'}],urgent:false,due:null,delivery:null,
    ask_back:['차종 확인'],unsure:[],fixes:[],note:null,highlights:[], summary:'앞 범퍼 두 개',
    evidence:{customer:'예시 정비소인데',contact:'',car_model:'',model_year:'',plate:'',urgent:'',due:'',delivery:''}};
  return {model:'fixture',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(card)}]};
};
setClientForTest({beta:{messages:{create:fake}},messages:{create:fake}});
const {router} = await buildRouter();
const server=http.createServer(createApp(router));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const out=process.env.TRANSCRIPT_ORDER_OUT || await mkdtemp(path.join(os.tmpdir(),'acha-transcript-order-evidence-'));
await mkdir(out,{recursive:true});
const b=await chromium.launch({headless:true});
try {
  const context=await b.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'});
  const blocked=[], errors=[];
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(blocked.push(r.request().url()),r.abort()));
  const p=await context.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));
  const start=async (id, mobile=false)=>{
    release=null;
    await p.goto(origin+'/'+callHref(id));
    const open=p.locator(mobile ? '[data-jump="summary"]:visible' : '[data-document="summary"]:visible').first();
    await open.click();
    const cta=p.locator('[data-act="trans-order-draft"]');
    await cta.focus(); await p.keyboard.press('Enter');
    await p.locator('#confirmDialog[open] [value="yes"]').click();
    await p.getByText('AI가 이 대화로 초안을 정리하는 중…').waitFor();
    assert.equal(await cta.isDisabled(),true);
    await p.waitForFunction(()=>Boolean(document.querySelector('[data-act="trans-order-draft"]')?.disabled));
    for(let i=0;!release&&i<60;i++)await p.waitForTimeout(20);
    assert.ok(release);
  };
  await start('fixture-order');
  await p.screenshot({path:path.join(out,'draft-loading.png')});
  release();
  await p.getByText('새 주문 초안을 저장했어요.',{exact:false}).waitFor();
  assert.equal(await p.locator('#toast').textContent(), '');
  await p.screenshot({path:path.join(out,'draft-saved.png')});
  const todayHref=await p.getByRole('link',{name:'오늘 할 일 보기'}).getAttribute('href');
  await p.getByRole('button',{name:'주문 초안 열기'}).click();
  assert.equal(await p.evaluate(()=>document.activeElement.id),'cd-card');
  await p.goto(origin+'/'+todayHref);
  const action=p.locator('.today-queue a').filter({hasText:'예시 정비소'});
  await action.first().waitFor();
  const ap=await fetch(origin+'/api/dashboard').then(r=>r.json());
  assert.equal(ap.todos.find(t=>t.callId==='fixture-order')?.kind,'callback');
  assert.match(ap.todos.find(t=>t.callId==='fixture-order').why,/차종 확인/);
  await p.screenshot({path:path.join(out,'today-action.png')});
  fail=true;
  await start('fixture-failure');release();
  await p.getByText('초안을 정리하지 못했습니다. 기존 카드 내용은 그대로입니다.').waitFor();
  assert.equal(await p.locator('[data-act="trans-order-draft"]').isDisabled(),false);
  assert.equal(await p.locator('[data-draft-result]').count(),0);
  assert.equal(await p.evaluate(()=>document.activeElement.dataset.act),'trans-order-draft');
  assert.equal(await p.locator('#toast').textContent(), '');
  await p.setViewportSize({width:390,height:844});
  await start('fixture-failure', true);release();
  await p.locator('.cd-draft-result.is-error').waitFor();
  assert.equal(await p.locator('#toast').textContent(), '');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.screenshot({path:path.join(out,'draft-mobile-error.png')});
  fail=false;
  release=null;
  await p.setViewportSize({width:1440,height:950});
  const auto=withWorkspace(demoAccess(),()=>onTranscript('fixture-auto',{text:segments[0].text,segments}));
  try {
    await p.goto(origin+'/'+callHref('fixture-auto'));
    await p.getByText('AI가 이 대화에서 초안을 만들고 있습니다. 추가로 누를 버튼은 없어요.').waitFor();
    assert.equal(await p.locator('[data-act="trans-order-draft"], [data-act="reextract"]').count(),0);
  } finally { release?.(); }
  await auto;
  await p.locator('.cd-auto-draft').waitFor({timeout:12000});
  assert.match(await p.locator('.cd-auto-draft').innerText(),/차종 확인/);
  assert.equal(await p.locator('[data-act="trans-order-draft"], [data-act="reextract"]').count(),0);
  assert.equal(await p.locator('#toast').textContent(), '');
  await p.screenshot({path:path.join(out,'auto-draft.png')});
  assert.equal(requests,4);
  assert.deepEqual(blocked,[]);
  assert.deepEqual(errors,[]);
  const results={scope:'actual local app, database and dashboard with deferred model fixture; no paid/external',pass:true,loading:true,openDraftFocus:true,todaySameSavedOrder:true,failureRestoresFocus:true,scopedToastAbsent:true,mobileErrorNoOverflow:true,autoDraftNoClick:true,requests,errors,blocked};
  await writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(out,results);
} finally { await b.close(); await new Promise(resolve=>server.close(resolve));setClientForTest(null); }
