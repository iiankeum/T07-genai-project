// Local fixture-only transcript navigation. No account or external AI.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.resolve(process.env.MOBILE_RETURN_OUTPUT||'/tmp/ahcha-mobile-return');
const data=await mkdtemp(path.join(os.tmpdir(),'ahcha-transcript-fixture-'));
const port=Number(process.env.MOBILE_RETURN_PORT||5671),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['server.mjs'],{cwd:app,env:{PATH:process.env.PATH,HOME:process.env.HOME,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:data,DEMO_MODE:'1',AI_PROVIDER:'fixture',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',AUTH_MAIL_MODE:'outbox'},stdio:'ignore'});
let browser; const errors=[],blocked=[],results=[];
try{
 await mkdir(dir,{recursive:true});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();blocked.push(r.request().url());return r.abort();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const width of [360,390])for(const big of [false,true]){
 await page.goto('about:blank');await page.setViewportSize({width,height:844});await page.goto(base+'/#/calls/fx-c51');await page.locator('.cd-actions').waitFor();if(big)await page.locator('#bigTextBtn').click();
 const input=page.locator('[data-item="partNo"][data-i="1"]');await input.fill('FAKE-RETURN-2');await input.press('Tab');
 await page.locator('[data-ev="item:1"] .cd-evbtn').click();
 await page.locator('[data-ev="item:1"] [data-act="to-trans"]').click();
 assert.equal(await page.locator('.cd-page').getAttribute('data-mobile-pane'),'trans');
 assert.ok(await page.locator('.cd-seg.is-mark').count());
 const before=await page.locator('#cd-trans-query').inputValue();
 await page.locator('[data-jump="card"]').click();
 const focus=await page.evaluate(()=>({tag:document.activeElement.tagName,item:document.activeElement.dataset.item,index:document.activeElement.dataset.i}));
 assert.equal(focus.item,'partNo','return focuses previously edited item input');assert.equal(focus.index,'1');
 assert.equal(await input.inputValue(),'FAKE-RETURN-2');
 assert.ok(await input.evaluate(e=>{const r=e.getBoundingClientRect(),a=document.querySelector('.cd-actions').getBoundingClientRect();return r.top>=0&&r.bottom<=a.top;}),'returned input is not hidden by actions');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:path.join(dir,`return-${width}-${big?'large':'normal'}.png`)});
 // Ordinary tab switching remembers the newly selected basic field, not an older evidence block.
 const customer=page.locator('[data-field="customer"]');await customer.focus();await page.locator('[data-jump="trans"]').click();assert.equal(await page.locator('#cd-trans-query').inputValue(),before);await page.locator('[data-jump="card"]').click();assert.equal(await customer.evaluate(e=>document.activeElement===e),true);
 // Choosing another item's explicit evidence returns to that item rather than the previous basic field.
 await page.locator('[data-ev="item:0"] .cd-evbtn').click();await page.locator('[data-ev="item:0"] [data-act="to-trans"]').click();await page.locator('[data-jump="card"]').click();assert.equal(await page.evaluate(()=>document.activeElement.dataset.item),'part');assert.equal(await page.evaluate(()=>document.activeElement.dataset.i),'0');
 results.push({width,big,returnsEditedInput:true,visibleAboveActions:true,normalTabRetainsField:true,otherEvidenceUsesOwnItem:true});
 if(big)await page.locator('#bigTextBtn').click();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 await writeFile(path.join(dir,'results.json'),JSON.stringify({fixtureOnly:true,results,errors,blocked},null,2));
 console.log('PASS',JSON.stringify(results));
}finally{await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(data,{recursive:true,force:true});}
