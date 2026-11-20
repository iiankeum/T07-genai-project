// 실제 route 함수와 가짜 DOM/메타만 사용한다. 실제 네트워크·페이지 API 없음.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../public/js/app.js',import.meta.url),'utf8');
const routeSource=source.slice(source.indexOf('async function route()'),source.indexOf('// ── 일꾼 상태'));
function setup(page='more') {
 let resolve;const pending=new Promise(r=>{resolve=r;});const moves=[];const ask=[];const main={replaceChildren(){},focus(opts){moves.push(opts);doc.activeElement=main;}};
 const doc={body:{dataset:{},classList:{toggle(){}}},activeElement:{name:'old nav'},getElementById:()=>({textContent:''}),createElement:()=>({}),querySelector:()=>({hidden:false}),title:''};
 const c={seq:0,parseHash:()=>({page,params:{},query:{}}),document:doc,renderNav(){},workspaceLabelInvalidated:false,workspaceAsk:{sync(page){ask.push(['sync',page]);return false;},reset(){ask.push(['reset']);},hide(){ask.push(['hide']);}},shellMeta:{},NAV:[],LIVE:{},SETTINGS:{},HELP:{},ADMIN:{},isActive:()=>false,cleanup:null,window:{scrollTo(){}},view:main,render(){},html:()=>'',ensureCss(){},getMeta:()=>pending,goToLogin(){},location:{hash:'#/more'},renderMore(){doc.activeElement={name:'page-selected-input'};},console};
 vm.createContext(c);vm.runInContext(routeSource+';globalThis.run=route;',c);
 return {run:c.run,resolve,moves,doc,main,ask};
}
test('메뉴 전환 즉시 본문으로 이동하고 페이지 자체 포커스를 뒤에 덮지 않는다',async()=>{
 const f=setup();const pending=f.run();assert.equal(f.doc.activeElement,f.main);assert.equal(f.moves.length,1);assert.equal(f.moves[0].preventScroll,true);
 f.resolve({});await pending;assert.equal(f.doc.activeElement.name,'page-selected-input');assert.equal(f.moves.length,1);assert.deepEqual(f.ask,[['sync','more']]);
});
test('없는 화면도 키보드 포커스를 본문에 두고 오류 화면으로 이어간다',async()=>{
 const f=setup('notfound');await f.run();assert.equal(f.doc.activeElement,f.main);assert.equal(f.moves.length,1);assert.match(f.doc.title,/없는 화면/);assert.deepEqual(f.ask,[['reset']]);
});
test('메타 갱신은 route 호출이 아니며 기존 main은 프로그래밍 포커스 가능',()=>{
 assert.match(source,/refreshMeta:\s*\(\) => getMeta\(true\)/);
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.match(index,/<main[^>]*id="view"[^>]*tabindex="-1"/);
});
