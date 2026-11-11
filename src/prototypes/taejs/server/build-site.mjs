// 배포 패키징 전용. 테스트/린트/브라우저 검증을 실행하지 않는다.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const assets={};
async function collect(dir,prefix='') {for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||entry.name==='server'||entry.name==='dist'||entry.name==='node_modules')continue;const name=prefix+entry.name;if(entry.isDirectory())await collect(path.join(dir,entry.name),name+'/');else if(/\.(html|css|js|svg)$/.test(name))assets['/'+name]=await readFile(path.join(dir,entry.name),'utf8');}}
await collect(root);
const api=await readFile(new URL('./assistant.mjs',import.meta.url),'utf8');
const worker=api+'\nconst assets='+JSON.stringify(assets)+';\n'+`export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/api/assistant')return assistant(request,env);let key=decodeURIComponent(url.pathname);if(key.endsWith('/'))key+='index.html';if(!Object.prototype.hasOwnProperty.call(assets,key))return new Response('Not found',{status:404});const type=key.endsWith('.css')?'text/css':key.endsWith('.js')?'text/javascript':key.endsWith('.svg')?'image/svg+xml':'text/html';return new Response(assets[key],{headers:{'Content-Type':type+'; charset=utf-8','X-Content-Type-Options':'nosniff'}});}};`;
await mkdir('dist/server',{recursive:true});await writeFile('dist/server/index.js',worker);
console.log('Packaged prototype assets and assistant endpoint into dist/server/index.js');
