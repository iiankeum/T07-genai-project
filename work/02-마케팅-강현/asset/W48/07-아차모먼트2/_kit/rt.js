const { chromium } = require('playwright'); const path=require('path');
(async()=>{const [file,out]=process.argv.slice(2);const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:2000}});
await p.goto('file://'+path.resolve(file));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
const s=await p.$$('.slide');for(let i=0;i<s.length;i++)await s[i].screenshot({path:`${out}/o${i+1}.png`,omitBackground:true});await b.close();})();
