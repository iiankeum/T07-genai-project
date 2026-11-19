// 실제 draw 함수를 가짜 DOM으로 실행한다. 주문·네트워크 호출 없음.
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../public/js/pages/board.js',import.meta.url),'utf8');
const draw=source.slice(source.indexOf('    function draw()'),source.indexOf('    async function loadColumn'));
function run(dataset,inside=true,alive=true){
 const moves=[];const old={dataset};const doc={activeElement:old};
 const context={document:doc,alive:()=>alive,root:{contains:x=>inside&&x===old,querySelector:selector=>({focus:opts=>{moves.push({selector,preventScroll:opts.preventScroll});doc.activeElement={selector};}})},state:{customers:[],customer:'가짜 거래처',col:'draft',working:0,sort:'board'},columns:{draft:{total:1},confirmed:{total:2},shipped:{total:0}},COLS:[{key:'draft'},{key:'confirmed'},{key:'shipped'}],SORTS:[],columnView:()=>'',html:()=>'',render:()=>{doc.activeElement={name:'body'};},href:()=>''};
 vm.runInNewContext(draw+';draw();',context);return {moves,doc};
}
test('거래처와 정렬 선택의 키보드 위치를 DOM 교체 뒤 보존',()=>{
 for(const filter of ['customer','sort'])assert.deepEqual(run({filter}).moves,[{selector:`[data-filter="${filter}"]`,preventScroll:true}]);
});
test('선택한 상태 탭만 복원, 다음 비동기 draw도 같은 위치 유지',()=>{
 for(const col of ['draft','confirmed','shipped'])assert.equal(run({act:'col',col}).moves[0].selector,`[data-act="col"][data-col="${col}"]`);
});
test('외부 포커스·주문 작업·임의 selector·폐기 화면은 포커스를 가져오지 않는다',()=>{
 for(const [dataset,inside,alive] of [[{filter:'sort'},false,true],[{act:'ship',id:'fake'},true,true],[{filter:'x]'},true,true],[{act:'col',col:'bad'},true,true],[{filter:'sort'},true,false]])assert.equal(run(dataset,inside,alive).moves.length,0);
});
