// Fake DOM only: asset failure must not leave the existing form inaccessible.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('./montage/runtime.js',import.meta.url),'utf8')).replace('export function','function');
function harness(){
 const links=[],timers=new Map();let id=0;
 const context=vm.createContext({document:{createElement:()=>({remove(){this.removed=true}}),head:{append:link=>links.push(link)}},setTimeout(fn){timers.set(++id,fn);return id},clearTimeout(id){timers.delete(id)},Error});
 vm.runInContext(source,context);
 return {load:()=>vm.runInContext('ensureMontageStyles()',context),links,timers};
}
test('Montage stylesheet succeeds once and is reused',async()=>{
 const h=harness(),a=h.load();assert.equal(h.load(),a);assert.equal(h.links[0].href,'/montage/tokens.css');h.links[0].onload();await a;assert.equal(h.timers.size,0);assert.equal(h.load(),a);
});
test('Montage stylesheet error removes link and permits retry',async()=>{
 const h=harness(),a=h.load();const result=assert.rejects(a,/Montage/);h.links[0].onerror();await result;assert.equal(h.links[0].removed,true);const b=h.load();assert.notEqual(a,b);h.links[1].onload();await b;
});
test('Montage stylesheet timeout rejects instead of hanging navigation',async()=>{
 const h=harness(),a=h.load();const result=assert.rejects(a,/Montage/);h.timers.values().next().value();await result;assert.equal(h.links[0].removed,true);assert.equal(h.links[0].onload,null);
});
