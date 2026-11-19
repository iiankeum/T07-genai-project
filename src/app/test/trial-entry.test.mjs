// Source contracts only. Run on user Mac alongside trial-processing.test.mjs.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('dedicated existing trial route is available to guests and linked from intro/login',()=>{
 const app=read('public/js/app.js');assert.match(app,/page: 'trial'/);assert.match(app,/\['account', 'help', 'trial', 'legal'\]/);
 assert.match(read('public/intro/index.html'),/href="\/#\/trial"/);
 assert.match(read('public/js/pages/account.js'),/href="#\/trial">무료 체험 신청<\/a>/);
});
test('official supplied logo and runtime product name agree',()=>{
 assert.match(read('public/intro/index.html'),/<img src="\/assets\/ahcha-logo-original.jpeg"/);
 assert.match(read('public/intro/intro.js'),/productName: '아차'/);
 assert.match(read('routes/trial.mjs'),/controller: '아차 데모 — T07 팀 수업 프로젝트'/);
});
test('consent and server policy remain prerequisites; no auto submission added',()=>{
 const page=read('public/js/pages/trial.js');assert.match(page,/busy \|\| !policyOk/);
 assert.match(page,/btn.disabled = busy \|\| !policyOk \|\| !form.elements\?\.consent\?\.checked/);
 assert.match(page,/api.get\('\/api\/trial\/policy'\)/);assert.match(page,/await api.post\('\/api\/trial', data\)/);
 assert.match(page,/if \(!data.consent\)/);assert.doesNotMatch(page,/consent"[^>]*checked/);
});
test('receipt distinguishes saved request from automatic email or account activation',()=>{
 const page=read('public/js/pages/trial.js');assert.match(page,/무료 체험 신청이 접수됐어요/);
 assert.match(page,/확인 메일은 자동 발송되지 않습니다/);assert.match(page,/계정은 자동으로 만들어지지 않습니다/);
 assert.match(read('public/intro/intro.js'),/확인 메일은 자동 발송되지 않으며/);
});
