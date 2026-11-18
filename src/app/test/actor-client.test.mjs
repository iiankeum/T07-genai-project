import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('browser actor stays pinned across meta change, requests, uploads and media links',async t=>{
 const saved=new Map(['window','location','fetch','XMLHttpRequest','CustomEvent'].map(k=>[k,globalThis[k]]));t.after(()=>{for(const[k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
 const events=[],requests=[];globalThis.window={dispatchEvent:e=>events.push(e)};globalThis.location={origin:'https://fake.test',hash:'#/today'};globalThis.CustomEvent=class{constructor(type,options){this.type=type;this.detail=options?.detail;}};
 let actor='user-a',error=null;
 globalThis.fetch=async(url,options)=>{requests.push({url,options});return url==='/api/meta'?new Response(JSON.stringify({access:{workspace:{id:'ws-a'},user:actor?{id:actor}:null}}),{headers:{'Content-Type':'application/json'}}):new Response(JSON.stringify(error?{error}:{ok:true}),{status:error?409:200,headers:{'Content-Type':'application/json'}});};
 let uploadHeaders;
 globalThis.XMLHttpRequest=class{constructor(){this.upload={};this.headers={};}open(){}setRequestHeader(k,v){this.headers[k]=v;}send(){uploadHeaders=this.headers;this.status=409;this.responseText='{"error":"actor_changed"}';this.onload();}};
 const source=fs.readFileSync(new URL('../public/js/api.js',import.meta.url),'utf8');const {api,getMeta}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.equal((await getMeta(true)).access.user.id,'user-a');actor='user-b';assert.equal((await getMeta(true)).access.user.id,'user-a');assert.equal(events.at(-1).detail.reason,'actor_changed');
 await api.patch('/api/cards/fake',{note:'fake'});assert.equal(requests.at(-1).options.headers['X-Ahmatda-Actor'],'user-a');assert.equal(requests.at(-1).options.headers['X-Ahmatda-Workspace'],'ws-a');
 const media=new URL(api.url('/api/calls/fake/audio?actor=spoof'),location.origin);assert.equal(media.searchParams.get('actor'),'user-a');assert.equal(media.searchParams.get('workspace'),'ws-a');assert.equal(api.url('https://external.test/api/calls/fake/audio'),'https://external.test/api/calls/fake/audio');
 await assert.rejects(api.upload('/api/ingest',{},null),e=>e.code==='actor_changed');assert.equal(uploadHeaders['X-Ahmatda-Actor'],'user-a');
 for(const route of ['profile','preferences','password/change','workspaces','workspaces/switch','invite/accept','logout']){await api.post('/api/auth/'+route,{});assert.equal(requests.at(-1).options.headers['X-Ahmatda-Actor'],'user-a');}
 for(const route of ['login','signup','password/request','password/reset','invite/info','verify']){await api.post('/api/auth/'+route,{});assert.equal(requests.at(-1).options.headers['X-Ahmatda-Actor'],undefined);}
 error='actor_changed';await assert.rejects(api.post('/api/cards/fake',{}),e=>e.code==='actor_changed');assert.equal(events.at(-1).detail.reason,'actor_changed');
 actor=null;assert.equal((await getMeta(true)).access.user.id,'user-a');assert.equal(events.at(-1).detail.reason,'actor_changed');
});
