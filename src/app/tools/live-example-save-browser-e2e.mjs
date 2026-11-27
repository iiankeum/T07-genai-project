// Actual live module + fake save. Microphone and external AI never used.
import http from 'node:http';import {readFile,writeFile,mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';import path from 'node:path';import {chromium} from 'playwright';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url));const out=process.env.LIVE_EXAMPLE_OUTPUT||'/tmp/ahcha-live-example-results';
const harness=`<!doctype html><meta charset="utf-8"><main id="app"></main><script type="module">import live from '/js/pages/live.js';import {api} from '/js/api.js';window.posts=[];api.post=async(url,body)=>{posts.push({url,body});if(url!=='/api/live/save')throw new Error('unexpected API');if(window.failSave)throw new Error('가짜 저장 실패');return {callId:'fake-saved'};};window.stop=await live.mount(document.querySelector('#app'),{meta:{aiEnabled:false,access:{demo:true}},refreshMeta:()=>{}});window.ready=true;</script>`;
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/')return res.setHeader('content-type','text/html').end(harness);if(!/^\/js\/[A-Za-z0-9_.\/-]+$/.test(u.pathname)||u.pathname.includes('..'))return res.writeHead(404).end();res.setHeader('content-type','text/javascript');res.end(await readFile(path.join(root,u.pathname)));}catch{res.writeHead(404).end();}});let browser;const errors=[],external=[],results=[];
try{await mkdir(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));page.on('dialog',d=>d.accept());
const fresh=async(width,motion='no-preference')=>{await page.goto('about:blank');await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:motion});await page.goto(origin,{waitUntil:'commit'});await page.waitForFunction(()=>window.ready);await page.locator('details summary').click();};
const waitLines=async n=>page.waitForFunction(n=>document.querySelector('[data-ref="lineCount"]').textContent===n+'줄',n);
for(const width of [1440,390])for(const motion of ['no-preference','reduce']){
 await fresh(width,motion);await page.locator('[data-act="example"]').first().click();await waitLines(1);await page.locator('[data-act="example"]').nth(1).click();
 if(motion==='no-preference'){
 await page.locator('.is-typing').waitFor();assert.equal(await page.locator('[data-act="save"]').isDisabled(),true);assert.match(await page.locator('[data-ref="state"]').innerText(),/완성되면 저장/);
 // Force a disabled-looking button to dispatch through UI handler, checking save() guard too.
 await page.locator('[data-act="save"]').evaluate(e=>{e.disabled=false;e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});assert.equal(await page.evaluate(()=>posts.length),0);
 }
 await waitLines(2);await page.evaluate(()=>window.failSave=true);await page.locator('[data-act="save"]').click();await page.locator('[data-ref="saved"] [role="alert"]').waitFor();assert.equal(await page.locator('[data-act="save"]').isEnabled(),true);await waitLines(2);await page.evaluate(()=>window.failSave=false);await page.locator('[data-act="save"]').click();await page.locator('[data-ref="goCall"]').waitFor();
 const posts=await page.evaluate(()=>posts);const texts=await page.locator('[data-act="example"]').evaluateAll(es=>es.map(e=>e.dataset.text));assert.equal(posts.length,2);for(const post of posts){assert.equal(post.url,'/api/live/save');assert.equal(post.body.text,texts.join('\n'));assert.deepEqual(post.body.segments.map(s=>s.text),texts);}assert.equal(await page.locator('[data-act="save"]').isDisabled(),true);results.push({width,motion,typingGuard:motion==='no-preference'?true:'not-applicable-reduced-motion',completePayload:true,failureKeepsLines:true,explicitRetry:true});
 await page.evaluate(()=>stop());
}
for(const width of [1440,390]){
 await fresh(width);await page.locator('[data-act="sample"]').click();await waitLines(1);assert.equal(await page.locator('[data-act="save"]').isDisabled(),true);await page.locator('[data-act="save"]').evaluate(e=>{e.disabled=false;e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});assert.equal(await page.evaluate(()=>posts.length),0);await page.locator('[data-act="sample"]').click();assert.equal(await page.locator('[data-act="save"]').isEnabled(),true);await page.evaluate(()=>stop());results.push({width,sampleGuardPreserved:true});
 await fresh(width);await page.locator('[data-act="example"]').first().click();await page.locator('.is-typing').waitFor();await page.locator('[data-act="reset"]').click();await waitLines(0);await page.waitForTimeout(1200);await waitLines(0);assert.equal(await page.locator('[data-act="save"]').isDisabled(),true);assert.equal(await page.evaluate(()=>posts.length),0);await page.evaluate(()=>stop());results.push({width,resetCancelsPartialExample:true});
}
// Text that resembles HTML must remain text inside real article elements.
for(const width of [1440,390]){
 await fresh(width,'reduce');const malicious='<img src=x onerror="window.injected=true"> & <script>window.injected=true</script>';
 await page.locator('[data-act="example"]').first().evaluate((e,text)=>e.dataset.text=text,malicious);
 await page.locator('[data-act="example"]').first().click();await waitLines(1);
 assert.equal(await page.locator('[data-ref="settled"] article.live-line[data-line="0"]').count(),1);
 assert.equal(await page.locator('[data-ref="settled"] .live-text').innerText(),malicious);
 assert.equal(await page.locator('[data-ref="settled"] img, [data-ref="settled"] script').count(),0);
 assert.equal(await page.evaluate(()=>Boolean(window.injected)),false);
 await page.locator('[data-act="save"]').click();await page.locator('[data-ref="goCall"]').waitFor();assert.equal(await page.evaluate(()=>posts[0].body.text),malicious);
 await page.evaluate(()=>stop());results.push({width,actualArticleDOM:true,markupLikeTextEscaped:true,savedTextUnchanged:true});
}
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);const report={scope:'actual live module/fake API, no microphone or external AI; viewport flow not visual/user study',results,errors,external};await writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
