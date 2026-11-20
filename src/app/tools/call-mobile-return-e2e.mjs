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
 for(const count of [5,10])for(const width of [360,390])for(const big of [false,true]){
 await page.goto('about:blank');await page.setViewportSize({width,height:844});await page.goto(base+'/#/calls/fx-c51');await page.locator('.cd-actions').waitFor();
 await page.evaluate(async n=>{const{api}=await import('/js/api.js');const c=await api.get('/api/calls/fx-c51');const items=Array.from({length:n},(_,i)=>({id:'return-fake-'+i,part:'가짜 시험 부품 '+(i+1),qty:1,partNo:'FAKE-'+i,quote:c.segments?.[2]?.text||'가짜 근거',at:13,seg:3}));await api.patch('/api/cards/fx-c51',{expectedRevision:c.card.revision,items});},count);await page.reload();await page.locator('.cd-actions').waitFor();assert.equal(await page.locator('.cd-item').count(),count,'fixture prepared item count');if(big){await page.getByRole('button',{name:'통화 상세 도구'}).click();await page.locator('#bigTextBtn').click();await page.getByRole('button',{name:'통화 상세 도구'}).click();}
 const input=page.locator(`[data-item="partNo"][data-i="${count-1}"]`);const saved=page.waitForResponse(r=>r.url().endsWith('/api/cards/fx-c51')&&r.request().method()==='PATCH'&&r.ok());await input.fill('FAKE-RETURN-2');await input.press('Tab');await saved;
 await page.locator(`[data-ev="item:${count-1}"] .cd-evbtn`).click();
 await page.locator(`[data-ev="item:${count-1}"] [data-act="to-trans"]`).click();
 assert.equal(await page.locator('.cd-page').getAttribute('data-mobile-pane'),'trans');
 assert.ok(await page.locator('.cd-seg.is-mark').count());
 const before=await page.locator('#cd-trans-query').inputValue();
 await page.locator('[data-jump="card"]').click();
 const focus=await page.evaluate(()=>({tag:document.activeElement.tagName,item:document.activeElement.dataset.item,index:document.activeElement.dataset.i}));
 assert.equal(focus.item,'partNo','return focuses previously edited item input');assert.equal(focus.index,String(count-1));
 assert.equal(await input.inputValue(),'FAKE-RETURN-2');
 assert.ok(await input.evaluate(e=>{const r=e.getBoundingClientRect(),a=document.querySelector('.cd-actions').getBoundingClientRect();return r.top>=0&&r.bottom<=a.top;}),'returned input is not hidden by actions');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await page.screenshot({path:path.join(dir,`return-${count}-${width}-${big?'large':'normal'}.png`)});
 // Ordinary tab switching remembers the newly selected basic field, not an older evidence block.
 const customer=page.locator('[data-field="customer"]');await customer.focus();await page.locator('[data-jump="trans"]').click();assert.equal(await page.locator('#cd-trans-query').inputValue(),before);await page.locator('[data-jump="card"]').click();assert.equal(await customer.evaluate(e=>document.activeElement===e),true);
 // Choosing another item's explicit evidence returns to that item rather than the previous basic field.
 await page.locator('[data-ev="item:0"] .cd-evbtn').click();await page.locator('[data-ev="item:0"] [data-act="to-trans"]').click();await page.locator('[data-jump="card"]').click();assert.equal(await page.evaluate(()=>document.activeElement.dataset.item),'part');assert.equal(await page.evaluate(()=>document.activeElement.dataset.i),'0');
 results.push({count,width,big,returnsEditedInput:true,visibleAboveActions:true,normalTabRetainsField:true,otherEvidenceUsesOwnItem:true});
 if(big){await page.getByRole('button',{name:'통화 상세 도구'}).click();await page.locator('#bigTextBtn').click();await page.getByRole('button',{name:'통화 상세 도구'}).click();}
 }
 // Real UI re-render: removing an earlier row changes indexes while the remembered item ID survives.
 await page.locator('[data-item="partNo"][data-i="9"]').focus();
 await page.locator('[data-ev="item:9"] .cd-evbtn').click();await page.locator('[data-ev="item:9"] [data-act="to-trans"]').click();
 await page.setViewportSize({width:1440,height:1000});
 let removal=page.waitForResponse(r=>r.url().endsWith('/api/cards/fx-c51')&&r.request().method()==='PATCH'&&r.ok());
 await page.locator('[data-del="0"]').click();await page.locator('#confirmDialog button[value="yes"]').click();await removal;
 assert.equal(await page.locator('.cd-item').count(),9);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-jump="card"]').click();
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.item),'partNo');assert.equal(await page.evaluate(()=>document.activeElement.dataset.i),'8');
 assert.equal(await page.locator('[data-item="partNo"][data-i="8"]').inputValue(),'FAKE-RETURN-2');
 results.push({boundary:'prior row removed, stable ID restored after re-render',passed:true});
 // Deleting the remembered row must not focus an unrelated replacement row.
 await page.locator('[data-ev="item:8"] .cd-evbtn').click();await page.locator('[data-ev="item:8"] [data-act="to-trans"]').click();
 await page.setViewportSize({width:1440,height:1000});
 removal=page.waitForResponse(r=>r.url().endsWith('/api/cards/fx-c51')&&r.request().method()==='PATCH'&&r.ok());await page.locator('[data-del="8"]').click();await page.locator('#confirmDialog button[value="yes"]').click();await removal;
 await page.setViewportSize({width:390,height:844});await page.locator('[data-jump="card"]').click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'cd-card');assert.equal(await page.locator('.cd-item').count(),8);
 results.push({boundary:'deleted remembered row falls back to card, never unrelated input',passed:true});
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 await writeFile(path.join(dir,'results.json'),JSON.stringify({fixtureOnly:true,results,errors,blocked},null,2));
 console.log('PASS',JSON.stringify(results));
}finally{await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(data,{recursive:true,force:true});}
