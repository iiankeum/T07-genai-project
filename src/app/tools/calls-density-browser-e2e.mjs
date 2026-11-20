// 가짜 fixture 전용: 사용자 DB/유료 AI/외부 발송을 사용하지 않는다.
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';import {mkdtemp,mkdir,rm,writeFile,readFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const port=Number(process.env.CALLS_DENSITY_PORT||5699);
const app=fileURLToPath(new URL('../',import.meta.url)),data=await mkdtemp(path.join(os.tmpdir(),'ahcha-visual-fake-')),base=`http://127.0.0.1:${port}`,out=path.resolve(process.env.CALLS_DENSITY_OUTPUT||'/tmp/ahcha-calls-density');await mkdir(out,{recursive:true});
const child=spawn(process.execPath,['server.mjs'],{cwd:app,env:{PATH:process.env.PATH,HOME:process.env.HOME,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:data,DEMO_MODE:'1',AI_PROVIDER:'fixture',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',AUTH_MAIL_MODE:'outbox'},stdio:['ignore','pipe','pipe']});let browser;const errors=[],external=[],mutations=[];try{
await new Promise((resolve,reject)=>{let output='';const t=setTimeout(()=>reject(new Error('listen timeout')),12000);child.on('error',e=>{clearTimeout(t);reject(e);});child.on('exit',c=>{clearTimeout(t);reject(new Error('child exit '+c));});child.stdout.on('data',b=>{output+=b; if(output.split('\n').some(l=>l.startsWith('[callnote] '+base+' · commit ')&&l.endsWith(' · data '+data))){clearTimeout(t);resolve();}});child.stderr.on('data',b=>process.stderr.write(b));});
browser=await chromium.launch({headless:true});const page=await browser.newPage({reducedMotion:'reduce'});page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{const req=r.request();if(new URL(req.url()).origin!==base){external.push(req.url());return r.abort();}if(!['GET','HEAD'].includes(req.method())){mutations.push({method:req.method(),url:req.url()});return r.abort();}return child.exitCode===null&&child.signalCode===null?r.continue():r.abort();});
const metrics=[];
for(const width of [1440,390]){
 await page.goto('about:blank');
 await page.setViewportSize({width,height:900});await page.goto(base+'/#/calls');await page.locator('.cl-item').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);await page.evaluate(()=>scrollTo(0,0));
 const rows=await page.locator('.cl-item').evaluateAll(es=>es.slice(0,5).map(e=>{const r=e.getBoundingClientRect();return {height:r.height,top:r.top,bottom:r.bottom};}));
 const target=await page.locator('.cl-cust').first().boundingBox();assert.ok(target.width>=44&&target.height>=44,'customer target >=44px');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);metrics.push({width,rows,fullyVisible:rows.filter(r=>r.bottom<=900-64).length,customerTarget:target});
 await page.screenshot({path:out+'/calls-'+width+'.png'});

 const fullSummary=await page.locator('.cl-summary').first().textContent();
 await page.locator('.cl-title').first().focus();await page.keyboard.press('Enter');await page.locator('.cd-card').waitFor();
 const summary=page.getByRole('button',{name:'통화 요약',exact:true});
 assert.equal(await summary.isVisible(),false,'order-first detail starts with transcript closed');
 if(width===390)await page.locator('[data-jump="trans"]').click();
 else await page.getByRole('button',{name:'스크립트',exact:true}).press('Enter');
 await summary.click();
 if(!(await page.locator('.cd-summary-view').innerText()).includes(fullSummary))throw new Error('full summary unavailable');
 await page.goto(base+'/#/calls');await page.locator('.cl-item').first().waitFor();await page.locator('.cl-cust').first().focus();await page.keyboard.press('Enter');await page.locator('.customer-page').waitFor();
 await page.goto(base+'/#/calls');await page.locator('.cl-item').first().waitFor();
 await page.locator('.cl-title').first().evaluate(e=>e.textContent='가짜 아주 긴 거래처 이름을 확인하는 테스트 지점');
 await page.locator('#bigTextBtn').click();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw new Error('large text overflow');
 await page.locator('#bigTextBtn').click();
 metrics.at(-1).keyboardPrimaryAndCustomer=true;metrics.at(-1).fullSummaryAccessible=true;metrics.at(-1).longNameLargeTextNoOverflow=true;
}
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(mutations,[]);await writeFile(out+'/results.json',JSON.stringify({fakeDataOnly:true,metrics,errors,external,mutations},null,2));console.log(JSON.stringify({metrics,errors,external,mutations}));}finally{await browser?.close();child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null||child.signalCode!==null||!child.pid)return r();child.once('exit',r);});await rm(data,{recursive:true,force:true});}
