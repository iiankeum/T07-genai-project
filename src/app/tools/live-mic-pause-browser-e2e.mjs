// 가짜 SpeechRecognition + 가짜 저장. 실제 마이크/음성 서버/유료 AI를 사용하지 않는다.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const harness = `<!doctype html><meta charset="utf-8"><style>.hidden{display:none}</style><main id="app"></main><script type="module">
window.instances=[];window.posts=[];
window.SpeechRecognition=class {
 constructor(){instances.push(this);this.stops=0;this.aborts=0;}
 start(){if(window.failStart)throw new Error('fake start failure');this.onstart?.();}
 stop(){this.stops++;} abort(){this.aborts++;}
 result(text,final=true){const r=[{transcript:text}];r.isFinal=final;this.onresult?.({resultIndex:0,results:[r]});}
 end(){this.onend?.();} error(error){this.onerror?.({error});}
};
const {default:live}=await import('/js/pages/live.js');
const {api}=await import('/js/api.js');
api.post=async(url,body)=>{if(url!=='/api/live/save')throw new Error('unexpected API');posts.push({url,body});return {callId:'fake'};};
window.dispose=await live.mount(document.querySelector('#app'),{meta:{aiEnabled:false}});window.ready=true;
</script>`;
const server = http.createServer(async (req,res) => {
 try {
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/')return res.setHeader('content-type','text/html').end(harness);
  if(!/^\/js\/[A-Za-z0-9_./-]+$/.test(u.pathname)||u.pathname.includes('..'))return res.writeHead(404).end();
  res.setHeader('content-type','text/javascript').end(await readFile(path.join(root,u.pathname)));
 } catch { res.writeHead(404).end(); }
});
let browser; const errors=[], external=[],results=[];
try {
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage();page.setDefaultTimeout(5000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
 const fresh=async()=>{await page.goto(origin);await page.waitForFunction(()=>window.ready);};
 const click=act=>page.locator(`[data-act="${act}"]`).click();
 const lineCount=()=>page.locator('[data-ref="lineCount"]').innerText();
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:900});await fresh();
  await click('mic');await page.evaluate(()=>instances[0].result('가짜 첫 문장',false));
  await click('pause');assert.equal(await page.locator('[data-act="pause"]').isDisabled(),true);
  await page.evaluate(()=>{instances[0].result('가짜 첫 문장',true);instances[0].end();});
  assert.equal(await lineCount(),'1줄');assert.equal(await page.locator('[data-act="pause"]').innerText(),'재개');
  await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>instances.length),1);
  const before=await page.locator('[data-ref="settled"]').innerText();
  await click('pause');assert.equal(await page.evaluate(()=>instances.length),2);
  await page.evaluate(()=>{instances[0].result('낡은 세션 무시');instances[0].end();instances[1].result('가짜 두 번째 문장');});
  assert.equal(await lineCount(),'2줄');assert.ok((await page.locator('[data-ref="settled"]').innerText()).includes(before));
  await click('pause');await page.evaluate(()=>instances[1].end());await click('save');
  await page.waitForFunction(()=>posts.length===1);
  const body=await page.evaluate(()=>posts[0].body);
  assert.equal(body.text,'가짜 첫 문장\n가짜 두 번째 문장');assert.equal(body.segments.length,2);
  assert.ok(body.segments[1].start>=body.segments[0].end);
  assert.ok(body.durationSec<1.5,'paused time must not inflate active duration');
  assert.equal(await page.evaluate(()=>instances.length),2);await page.evaluate(()=>dispose());
  results.push({width,pauseResumePreservesLines:true,noRestartWhilePaused:true,staleCallbacksIgnored:true,savedSegments:true});
 }
 await fresh();await click('mic');await page.evaluate(()=>{instances[0].error('not-allowed');instances[0].end();});
 assert.match(await page.locator('[data-ref="state"]').innerText(),/마이크 사용이 막혀/);assert.equal(await page.locator('[data-act="pause"]').isVisible(),false);
 await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>instances.length),1);await page.evaluate(()=>dispose());results.push({permissionDeniedNoRestart:true});
 await fresh();await page.evaluate(()=>window.failStart=true);await click('mic');assert.match(await page.locator('[data-ref="state"]').innerText(),/시작하지 못/);await page.evaluate(()=>dispose());results.push({syncStartFailureRecovered:true});
 await fresh();await click('mic');await click('pause');await page.evaluate(()=>{dispose();instances[0].result('폐기 후 무시');instances[0].end();});
 await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>instances.length),1);assert.equal(await lineCount(),'0줄');assert.equal(await page.evaluate(()=>instances[0].aborts),1);results.push({routeCleanupIgnoresLateEvents:true});
 await fresh();await click('mic');await click('pause');await page.evaluate(()=>instances[0].end());await click('reset');assert.equal(await page.locator('[data-act="pause"]').isVisible(),false);await click('mic');assert.equal(await page.evaluate(()=>instances.length),2);await page.evaluate(()=>dispose());results.push({pausedResetStartsFresh:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({results,errors,external,realMicrophoneTested:false},null,2));
} finally { await browser?.close();await new Promise(r=>server.close(r)); }
