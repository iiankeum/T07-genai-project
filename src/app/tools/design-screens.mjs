// 가짜 데이터 전용 시각 회귀: 사용자 공간/유료 API를 사용하지 않는다.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.resolve(process.env.DESIGN_OUTPUT || 'artifacts/design');
const data=await mkdtemp(path.join(os.tmpdir(),'ahmatda-design-fake-'));
const port=Number(process.env.DESIGN_PORT||5634),base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.mjs'],{cwd:app,env:{PATH:process.env.PATH,HOME:process.env.HOME,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:data,DEMO_MODE:'1',AI_PROVIDER:'fixture',ALLOW_PAID_AI:'0',ANTHROPIC_API_KEY:'',AUTH_MAIL_MODE:'outbox'},stdio:'ignore'});
let browser;const results=[];
try {
 await mkdir(dir,{recursive:true});
 for(let i=0;i<100;i++){try{if((await fetch(base+'/healthz')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [name,route] of [['today','/'],['calls','/calls'],['board','/board'],['shipping','/shipping'],['upload','/upload'],['live','/live'],['assistant','/assistant'],['settings','/settings'],['tools','/more']]){
  for(const [size,w,h] of [['desktop',1440,1000],['mobile',390,844]]){
   await page.setViewportSize({width:w,height:h});await page.goto(base+'/#'+route);await page.locator('#view h1').first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
   if(name==='assistant' && size==='mobile') {
    assert.equal(await page.locator('.as-sidebar').evaluate(el=>el.open),false,'mobile suggestions start collapsed');
    await page.locator('.as-sidebar summary').click();assert.equal(await page.locator('.as-sidebar').evaluate(el=>el.open),true);
    await page.locator('.as-sidebar summary').click();
   }
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${name} ${size} overflow`);
   await page.screenshot({path:path.join(dir,`${name}-${size}-fake.png`),fullPage:false});results.push({name,size,overflow,heading:await page.locator('#view h1').first().innerText()});
   if(size==='mobile'){await page.locator('#bigTextBtn').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${name} large text overflow`);await page.locator('#bigTextBtn').click();}
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 assert.equal(await page.locator('.brand-name').innerText(),'아차');
 assert.ok((await page.title()).includes('아차'));
 const manifest=await (await page.request.get(base+'/manifest.webmanifest')).json();assert.equal(manifest.short_name,'아차');
 await page.goto(base+'/#/');await page.locator('#sideNav .nav-link').first().waitFor();
 for(const href of ['#/','#/calls','#/board','#/shipping','#/more','#/settings'])assert.equal(await page.locator(`#sideNav a[href="${href}"]`).count(),1,'desktop primary destination retained');
 assert.equal(await page.locator('#sideNav .lnb-workspace a[href="#/workspaces"]').count(),1,'workspace switch retained');
 await page.locator('#sideNav a[href="#/more"]').click();await page.locator('.tools-directory').waitFor();assert.equal(await page.locator('.tools-section').count(),4);
 for(const href of ['#/upload','#/live','#/assistant','#/ask','#/knowledge','#/settings/notifications','#/help'])assert.equal(await page.locator(`.menu-list a[href="${href}"]`).count(),1,'secondary destination retained');
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/#/');await page.locator('#today-priority a').first().waitFor();
 assert.ok(await page.locator('#today-priority').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('.today-overview')) & Node.DOCUMENT_POSITION_FOLLOWING)),'tasks before metrics in DOM');
 for(const route of ['board','shipping']){await page.locator(`.tabbar a[href="#/${route}"]`).click();await page.locator('#view h1').first().waitFor();assert.ok(page.url().endsWith('#/'+route),'one tap primary task');}
 await page.goto(base+'/#/calls/fx-c51');await page.locator('.cd-actions').waitFor();await page.waitForTimeout(300);
 assert.equal(await page.locator('.cd-history').evaluate(el=>el.open),false,'recent history starts collapsed without removing access');
 await page.locator('.cd-history > summary').click();await page.locator('.cd-list-link').first().waitFor();
 await page.locator('#cd-history-q').fill('신흥모터스');await page.locator('.cd-search-submit').click();
 await page.waitForFunction(()=>document.querySelector('.cd-history-scroll')?.textContent.includes('신흥모터스'));
 await page.locator('.cd-history > summary').click();

 assert.equal(await page.locator('.tabbar').isVisible(),false,'no global nav in detail');
 assert.ok(await page.locator('.cd-actions').evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>innerHeight*.5;}),'current action visible at viewport bottom');
 await page.screenshot({path:path.join(dir,'call-mobile-fake.png')});
 await page.locator('.cd-card input').last().scrollIntoViewIfNeeded();
 await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await page.waitForTimeout(200);
 assert.ok(await page.locator('.cd-card input').last().evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('.cd-actions').getBoundingClientRect().top),'last input clears fixed actions at page end');
 await page.locator('[data-jump="trans"]').click();assert.equal(await page.locator('.cd-actions').isVisible(),false,'card actions absent in transcript');
 await page.locator('[data-jump="card"]').click();assert.equal(await page.locator('.cd-actions').isVisible(),true);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/#/shipping');await page.locator('.ship-tools a[download]').waitFor();
 await page.locator('[data-act="scope"][data-scope="today"]').click();
 assert.equal(await page.locator('[data-scope="today"]').getAttribute('aria-pressed'),'true');
 assert.ok((await page.locator('.ship-tools a[download]').getAttribute('href')).includes('scope=today'),'CSV scope matches screen');
 const csv=await page.request.get(new URL(await page.locator('.ship-tools a[download]').getAttribute('href'),base).href);
 assert.equal(csv.status(),200);assert.ok((await csv.text()).includes('거래처'),'CSV includes customer header');
 await page.locator('[data-act="scope"][data-scope="all"]').click();
 await page.locator('[data-act="print"]:not([disabled])').waitFor();
 await page.evaluate(()=>{window.__printCount=0;window.print=()=>window.__printCount++;});
 await page.locator('[data-act="print"]').click();assert.equal(await page.evaluate(()=>window.__printCount),1,'print triggers once without real print dialog');
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.topbar').isVisible(),false,'print hides navigation');await page.emulateMedia({media:'screen'});
 await page.goto(base+'/#/upload');await page.locator('[data-ref="file"]').waitFor();
 await page.locator('[data-ref="file"]').setInputFiles({name:'가짜-invalid.txt',mimeType:'text/plain',buffer:Buffer.from('fake')});
 assert.equal(await page.locator('[data-act="upload"]').isDisabled(),true);assert.equal(await page.locator('.upload-row.is-blocked').count(),1);
 await page.locator('[data-act="remove"]').click();
 await page.locator('[data-ref="file"]').setInputFiles({name:'가짜-staging-only.wav',mimeType:'audio/wav',buffer:Buffer.alloc(128)});
 assert.equal(await page.locator('[data-act="upload"]').isDisabled(),true);
 await page.locator('[data-ref="fake"]').check();assert.equal(await page.locator('[data-act="upload"]').isEnabled(),true);
 await page.locator('[data-ref="fake"]').uncheck();assert.equal(await page.locator('[data-act="upload"]').isDisabled(),true);
 await page.locator('[data-act="remove"]').click();
 await page.goto(base+'/#/settings');await page.locator('.settings-directory').waitFor();assert.equal(await page.locator('.settings-destination').count(),7);
 await page.locator('.settings-destination[href="#/settings/display"]').click();await page.getByRole('heading',{name:'화면 설정',exact:true}).waitFor();
 assert.equal(await page.locator('.settings-nav [aria-current="page"]').getAttribute('href'),'#/settings/display');
 assert.deepEqual(errors,[]);await writeFile(path.join(dir,'results.json'),JSON.stringify({fakeData:true,paidAI:false,checks:["shipping scope and CSV content", "print action and print-only layout", "desktop primary and secondary routes retained", "workspace switch retained", "mobile primary task navigation", "task queue before metrics", "detail fixed action visibility and last input clearance", "detail transcript/card switch", "8 mobile large-text layouts","responsive assistant disclosure","upload invalid file rejection","upload consent gate without sending audio","7 settings cards and display navigation"],results,errors},null,2));console.log(`PASS ${results.length} viewports`);
}finally{await browser?.close();child.kill('SIGTERM');await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));await rm(data,{recursive:true,force:true});}
