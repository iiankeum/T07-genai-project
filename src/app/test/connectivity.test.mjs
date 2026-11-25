// 가짜 연결 이벤트/DOM 전용. 실제 네트워크·저장·재시도 호출 없음.
import { test } from 'node:test';import assert from 'node:assert/strict';
import { mountConnectivity } from '../public/js/connectivity.js';
function fixture(onLine=true) {
 class Element extends EventTarget {
  constructor(){super();this.children=[];this.attrs=new Map();this.props=new Map();this.style={setProperty:(k,v)=>this.props.set(k,v),removeProperty:k=>this.props.delete(k)};}
  append(...xs){this.children.push(...xs);}prepend(x){this.children.unshift(x);}setAttribute(k,v){this.attrs.set(k,v);}removeAttribute(k){this.attrs.delete(k);}getBoundingClientRect(){return {height:80};}remove(){this.removed=true;}
 }
 const win=new EventTarget();win.navigator={onLine};win.fetch=()=>{throw new Error('network prohibited');};
 const body=new Element();const draft={value:'가짜 작성 중 내용',selectionStart:3};body.children.push(draft);
 const doc={body,activeElement:draft,createElement:()=>new Element()};
 const dispose=mountConnectivity(win,doc);return {win,doc,draft,body,banner:body.children[0],dispose};
}
test('처음 온라인은 숨김, API 오류는 복구로 추정하지 않음',()=>{
 const f=fixture();assert.equal(f.banner.hidden,true);f.win.dispatchEvent(new Event('online'));assert.equal(f.banner.hidden,true);f.dispose();
});
test('오프라인→연결 신호 복귀: 입력/포커스 유지, 중복 이벤트에도 배너 하나, 수동 닫기',()=>{
 const f=fixture();f.win.dispatchEvent(new Event('offline'));f.win.dispatchEvent(new Event('offline'));
 assert.equal(f.banner.hidden,false);assert.equal(f.body.children.length,2);assert.match(f.banner.children[0].textContent,/완료되지 않았을/);
 assert.equal(f.banner.children[1].hidden,true);assert.equal(f.body.props.get('--connectivity-h'),'80px');
 f.win.dispatchEvent(new Event('online'));assert.match(f.banner.children[0].textContent,/서버 연결과 저장 결과는 아직 확인하지 않았/);assert.equal(f.banner.children[1].hidden,false);
 assert.equal(f.draft.value,'가짜 작성 중 내용');assert.equal(f.draft.selectionStart,3);assert.equal(f.doc.activeElement,f.draft);
 f.banner.children[1].dispatchEvent(new Event('click'));assert.equal(f.banner.hidden,true);assert.equal(f.body.attrs.has('data-connectivity-visible'),false);
 f.win.dispatchEvent(new Event('offline'));assert.equal(f.banner.hidden,false);f.dispose();
});
test('최초 오프라인 표시, 정리 후 이벤트 무시 및 높이/리스너 제거',()=>{
 const f=fixture(false);assert.equal(f.banner.hidden,false);assert.equal(f.banner.attrs.get('role'),'status');
 f.dispose();assert.equal(f.banner.removed,true);assert.equal(f.body.props.has('--connectivity-h'),false);
 f.win.dispatchEvent(new Event('offline'));assert.equal(f.banner.hidden,true);
});
