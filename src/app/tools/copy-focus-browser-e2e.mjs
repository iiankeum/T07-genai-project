// 가짜 텍스트와 clipboard/execCommand 대역만 사용. 실제 클립보드·계정·외부 접속 없음.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const moduleFile=process.env.COPY_FOCUS_MODULE||path.resolve(import.meta.dirname,'../public/js/ui.js');
const output=path.resolve(process.env.COPY_FOCUS_OUTPUT_DIR||path.join(import.meta.dirname,'../artifacts/e2e/copy-focus'));
const harness=`<!doctype html><meta charset="utf-8"><button id="before">before</button><button id="copy">copy fake text</button><textarea id="editor">fake editable text</textarea><button id="after">after</button><script type="module">
import {copyText} from '/ui.js';window.copyText=copyText;window.mode='normal';window.calls=[];
Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.calls.push({method:'clipboard',text});if(window.mode==='normal')return;if(window.mode==='deferred'){await new Promise(r=>window.rejectNow=r);}throw Error('fake clipboard denied');}}});
document.execCommand=command=>{window.calls.push({method:'execCommand',command,text:document.activeElement.value});if(window.mode==='remove')document.querySelector(window.source)?.remove();if(window.mode==='moved')document.querySelector('#after').focus();if(window.mode==='throw')throw Error('fake copy failed');return window.mode!=='failure';};
window.run=async()=>{window.result=await copyText('fake copy payload');window.complete=true;};
document.querySelector('#copy').addEventListener('click',()=>window.run());window.ready=true;
</script>`;
const server=http.createServer(async(req,res)=>{if(req.url==='/'){res.setHeader('content-type','text/html');res.end(harness);}else if(req.url==='/ui.js'){res.setHeader('content-type','text/javascript');res.end(await readFile(moduleFile));}else res.writeHead(404).end();});
const results=[],blocked=[],errors=[];let browser,page;
try{
await mkdir(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
browser=await chromium.launch({headless:true,env:{HOME:process.env.HOME,PATH:process.env.PATH},...(process.env.E2E_CHROMIUM_PATH?{executablePath:process.env.E2E_CHROMIUM_PATH}:{})});
const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){blocked.push(route.request().url());return route.abort();}return route.continue();});
for(const mode of ['normal','success','failure','throw','remove','deferred','moved'])for(const source of ['#copy','#editor']){
page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
await page.goto(origin);await page.waitForFunction(()=>window.ready);await page.evaluate(({mode,source})=>{window.mode=mode;window.source=source;const el=document.querySelector(source);el.focus();if(source==='#editor')el.setSelectionRange(2,8,'backward');}, {mode,source});
if(source==='#copy')await page.keyboard.press('Enter');else await page.evaluate(()=>{window.run();});
let expected=mode==='moved'?'#after':source;if(mode==='deferred'){await page.waitForFunction(()=>window.rejectNow);await page.locator('#after').focus();expected='#after';await page.evaluate(()=>window.rejectNow());}
await page.waitForFunction(()=>window.complete);
assert.equal(await page.evaluate(()=>window.result),!['failure','throw'].includes(mode));
assert.equal(await page.locator('textarea').count(),source==='#editor'&&mode==='remove'?0:1,'temporary textarea always removed');
if(mode!=='remove'){
assert.equal(await page.evaluate(()=>document.activeElement.id),expected.slice(1),'focus restored to element active when fallback starts');
if(expected==='#editor')assert.deepEqual(await page.locator('#editor').evaluate(el=>[el.selectionStart,el.selectionEnd,el.selectionDirection]),[2,8,'backward']);
if(expected!=='#after'){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),expected==='#copy'?'editor':'after','next Tab continues original order');}
}else assert.equal(await page.locator(source).count(),0);
const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,mode==='normal'?1:2);assert.equal(calls[0].text,'fake copy payload');if(mode!=='normal'){assert.equal(calls[1].command,'copy');assert.equal(calls[1].text,'fake copy payload');}
results.push({mode,source,pass:true});
}catch(e){results.push({mode,source,pass:false,error:e.message});await page.screenshot({path:path.join(output,`${mode}-${source.slice(1)}.png`)});}
finally{await page.close();}
}
assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);assert.ok(results.every(r=>r.pass),'copy focus regression failed');
}catch(e){process.exitCode=1;results.push({runError:e.message});}
finally{await browser?.close();await new Promise(r=>server.close(r));await mkdir(output,{recursive:true});await writeFile(path.join(output,'report.json'),JSON.stringify({scope:'actual ui.copyText + fake clipboard/execCommand, not native clipboard validation',results,blocked,errors},null,2));console.log(JSON.stringify(results));}
