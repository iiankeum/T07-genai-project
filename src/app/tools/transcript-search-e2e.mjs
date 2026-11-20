// Local fixture-only transcript navigation. No account or external AI.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.resolve(process.env.TRANSCRIPT_OUTPUT||'/tmp/ahcha-transcript-search');
const data=await mkdtemp(path.join(os.tmpdir(),'ahcha-transcript-fixture-'));
const port=Number(process.env.TRANSCRIPT_PORT||5657),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.mjs'],{cwd:app,env:{PATH:process.env.PATH,HOME:process.env.HOME,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:data,DEMO_MODE:'1',AI_PROVIDER:'fixture',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',AUTH_MAIL_MODE:'outbox'},stdio:'ignore'});
let browser; const errors=[],blocked=[],results=[];
try{
 await mkdir(dir,{recursive:true});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();blocked.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const [size,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto(base+'/#/calls/fx-c51');await page.locator('.cd-actions').waitFor();
  const q=page.locator('#cd-trans-query');
  if(size==='mobile')await page.locator('[data-jump="trans"]').click();
  else {
   const open=page.getByRole('button',{name:'스크립트',exact:true});
   assert.equal(await q.isVisible(),false,'order workspace initially hides the transcript');
   assert.equal(await open.getAttribute('aria-pressed'),'false');
   await open.press('Enter');
   assert.equal(await open.getAttribute('aria-pressed'),'true');
  }
  await q.waitFor();await q.fill('');
  assert.equal(await page.locator('[data-trans-find="next"]').isDisabled(),true);
  const writes=[];const track=r=>{if(r.method()!=='GET')writes.push(r.url());};page.on('request',track);
  await q.fill('패드');
  const matches=await page.locator('.cd-seg.is-search-match').count();assert.ok(matches>=1);
  assert.equal(await page.locator('#cd-trans-search-count').innerText(),`1/${matches} 문장`);
  await q.press('Enter');assert.equal(await page.locator('#cd-trans-search-count').innerText(),`${1%matches+1}/${matches} 문장`);
  await q.press('Shift+Enter');assert.equal(await page.locator('#cd-trans-search-count').innerText(),`1/${matches} 문장`);
  assert.equal(await q.evaluate(el=>document.activeElement===el),true,'keyboard focus retained');
  await page.locator('[data-trans-find="prev"]').click();assert.equal(await page.locator('#cd-trans-search-count').innerText(),`${matches}/${matches} 문장`);
  await page.locator('[data-trans-view="summary"]').click();assert.equal(await q.count(),0);
  await page.locator('[data-trans-view="text"]').click();assert.equal(await q.inputValue(),'패드');
  await q.fill('일치하지않는검색어');assert.equal(await page.locator('#cd-trans-search-count').innerText(),'일치 없음');assert.equal(await page.locator('[data-trans-find="next"]').isDisabled(),true);
  await q.press('Escape');assert.equal(await q.inputValue(),'');assert.equal(await page.locator('.is-search-match').count(),0);
  await q.fill('패드');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(dir,`${size}.png`)});
  if(size==='mobile')await page.getByRole('button',{name:'통화 상세 도구'}).click();await page.locator('#bigTextBtn').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.locator('#bigTextBtn').click();if(size==='mobile')await page.getByRole('button',{name:'통화 상세 도구'}).click();
  if(size==='desktop'){
   const order=page.getByRole('button',{name:'주문서',exact:true});
   const open=page.getByRole('button',{name:'스크립트',exact:true});
   await order.press('Enter');await q.waitFor({state:'hidden'});
   assert.equal(await order.getAttribute('aria-pressed'),'true');
   assert.equal(await open.getAttribute('aria-pressed'),'false');
   assert.equal(await order.evaluate(el=>document.activeElement===el),true,'keyboard focus stays on the order tab');
   await open.press('Enter');await q.waitFor();assert.equal(await q.inputValue(),'패드');
  }
  assert.equal(writes.length,0,'search never writes or calls AI');page.off('request',track);
  results.push({size,matches,keyboard:true,summaryRestoresQuery:true,noWriteRequests:true,noOverflow:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 await writeFile(path.join(dir,'results.json'),JSON.stringify({fixtureOnly:true,results,errors,blocked},null,2));console.log('PASS',JSON.stringify(results));
}finally{await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(data,{recursive:true,force:true});}
