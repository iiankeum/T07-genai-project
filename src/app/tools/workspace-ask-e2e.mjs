// Actual local shell and route modules; assistant response fixture, no provider calls.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
Object.assign(process.env,{DATA_DIR:await mkdtemp(path.join(os.tmpdir(),'global-ask-')),DEMO_MODE:'1',AI_PROVIDER:'off',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:''});
const {buildRouter,createApp}=await import('../server.mjs');
const {db,withWorkspace}=await import('../lib/db.mjs');
const {demoAccess}=await import('../lib/auth.mjs');
const t=new Date().toISOString();
withWorkspace(demoAccess(),()=>db().prepare("INSERT INTO calls(id,created_at,recorded_at,source,status,title,transcript,is_fake) VALUES('ask-test',?,?,'upload','ready','가짜 통화','앞 범퍼 두 개 주문',1)").run(t,t));
const {router}=await buildRouter();
const server=http.createServer(createApp(router));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const out=process.env.WORKSPACE_ASK_OUTPUT || await mkdtemp(path.join(os.tmpdir(),'workspace-ask-evidence-'));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  const results=[], blocked=[], errors=[], requests=[];
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  await context.route('**/*',async route=>{
    const req=route.request(), u=new URL(req.url());
    if (u.origin!==origin) { blocked.push(u.origin);return route.abort(); }
    if(u.pathname!=='/api/assistant')return route.continue();
    const body=req.method()==='POST'?req.postDataJSON():null;
    requests.push({method:req.method(),callId:body?.callId??u.searchParams.get('callId')});
    const payload=body?{ answer:'테스트 답변 하나',thread:{id:'thread-demo',title:'테스트 대화',updatedAt:t,messages:[{role:'user',text:body.message},{role:'assistant',text:'테스트 답변 하나'}]} }:
      {calls:[{id:'ask-test',title:'가짜 통화'}],selected:{id:'ask-test'},threads:[],suggestions:[],approvedCount:0};
    return route.fulfill({json:payload});
  });
  const p=await context.newPage();p.setDefaultTimeout(9000);p.on('pageerror',e=>errors.push(e.message));
  const rail=p.locator('#workspaceAskRail');
  const question=rail.locator('#as-question');
  const nav=route=>p.evaluate(r=>location.hash=r,route);
  await p.goto(origin+'/#/');
  await rail.waitFor();
  await p.getByRole('heading',{name:'오늘 브리핑',exact:true}).waitFor();
  assert.equal(requests.length,0);
  await question.fill('테스트 질문');await rail.locator('[data-act="send"]').click();
  await rail.getByText('테스트 답변 하나',{exact:true}).waitFor();
  assert.deepEqual(requests, [{method:'GET',callId:null},{method:'POST',callId:null}]);
  const instance=await rail.evaluateHandle(el=>el);
  await question.fill('입력 중인 질문');
  for (const [route,page,title] of [['/calls','calls','통화 기록'],['/board','board','주문 보드'],['/shipping','shipping','출고 목록']]) {
    await nav(route);await p.getByRole('heading',{name:title,exact:true}).waitFor();
    assert.equal(await rail.evaluate((el,old)=>el===old,instance),true,page);
    assert.equal(await question.inputValue(),'입력 중인 질문');
    const right=await rail.evaluate(el=>el.getBoundingClientRect().right);
    assert.equal(right,1440);
    assert.equal(await p.locator('.wl-ask,.cd-assistant').count(),0);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,page);
    results.push(page);
  }
  await p.screenshot({path:path.join(out,'workspace-ask-desktop.png')});
  await nav('/calls/ask-test');await p.locator('#cd-assistant').waitFor();
  assert.equal(await rail.count(),0);
  assert.equal(requests.length,2);
  await nav('/board');await rail.waitFor();
  assert.equal(await rail.evaluate((el,old)=>el===old,instance),true);
  await p.setViewportSize({width:390,height:844});
  const launch=p.locator('.workspace-ask-launch');
  await launch.click();
  const dialog=p.locator('#workspaceAskDialog[open]');
  await dialog.waitFor();
  assert.equal(await question.inputValue(),'입력 중인 질문');
  await rail.getByText('테스트 답변 하나',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.screenshot({path:path.join(out,'workspace-ask-mobile.png')});
  await p.keyboard.press('Escape');
  await dialog.waitFor({state:'detached'});
  assert.equal(await launch.evaluate(el=>document.activeElement===el),true);
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('ahmatda:workspace-changed')));
  assert.equal(await rail.count(),0);
  await nav('/shipping');
  await p.getByRole('heading',{name:'출고 목록',exact:true}).waitFor();
  assert.equal(await rail.count(),0);
  assert.equal(requests.length,2);
  assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);
  const proof={pass:true,routeRetention:results,callScopedOnly:true,workspaceInvalidationClears:true,mobileFocusRestored:true,requests};
  await writeFile(path.join(out,'workspace-ask.json'),JSON.stringify(proof,null,2));console.log(out,proof);
}finally{await browser.close();await new Promise(r=>server.close(r));}
