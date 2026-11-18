import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/css/app.css',import.meta.url),'utf8');
const color=name=>{const match=css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`,'i'));assert.ok(match, name);return match[1];};
function luminance(hex){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a,b){const [lo,hi]=[luminance(a),luminance(b)].sort((x,y)=>x-y);return (hi+.05)/(lo+.05);}
test('아차 브랜드와 의미별 상태의 기본 텍스트 대비를 유지한다',()=>{
 for(const [fg,bg] of [['paper','brand'],['paper','brand-hover'],['brand-ink','paper'],['brand-ink','brand-soft'],['muted','paper'],['ink','bg'],['ok','ok-soft'],['warn','warn-soft'],['danger','danger-soft']]){
  assert.ok(contrast(color(fg),color(bg))>=4.5,`${fg}/${bg} text contrast >= 4.5`);
 }
 assert.ok(contrast(color('brand-ink'),color('paper'))>=3,'focus outline contrast');
 assert.notEqual(color('danger'),color('brand'));
 assert.notEqual(color('warn'),color('brand'));
});
