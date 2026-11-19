import {build} from 'vite';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('..',import.meta.url)),dir=path.join(app,'montage'),output=path.join(app,'public/montage');
const entry=Object.fromEntries((await readdir(dir)).filter(f=>f.endsWith('.jsx')).map(f=>[f.slice(0,-4),path.join(dir,f)]));
// Keep dependency module IDs relative to this app, including when node_modules is a symlink.
// Otherwise machine-specific real paths enter source comments and change chunk hashes.
await build({configFile:false,root:app,publicDir:false,resolve:{preserveSymlinks:true},define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{target:'esnext',outDir:output,emptyOutDir:true,minify:true,license:{fileName:'BUNDLED-LICENSES.md'},lib:{entry,formats:['es'],fileName:(_,name)=>name+'.js'},rolldownOptions:{onwarn(warning,handler){if(warning.code!=='MODULE_LEVEL_DIRECTIVE')handler(warning)},output:{chunkFileNames:'chunks/[name]-[hash].js'}}}});
// Vite library mode does not replace Node globals by default. Browsers have no process.
async function verifyBrowserModules(dir){
 for(const file of await readdir(dir,{withFileTypes:true})){
  const full=path.join(dir,file.name);
  if(file.isDirectory())await verifyBrowserModules(full);
  else if(file.name.endsWith('.js')&&/\bprocess\.env\.NODE_ENV\b/.test(await readFile(full,'utf8')))throw Error(`Unresolved browser build constant: ${file.name}`);
 }
}
await verifyBrowserModules(output);
let tokens=await readFile(path.join(app,'node_modules/@montage-ui/core/dist/theme.css'),'utf8');
tokens=tokens.replace(':root {','.montage-scope {').replace("html[data-theme='dark'] {",".montage-scope[data-theme='dark'] {");
await mkdir(output,{recursive:true});await writeFile(path.join(output,'tokens.css'),tokens+'\n'+await readFile(path.join(dir,'brand.css'),'utf8'));await writeFile(path.join(output,'MONTAGE-LICENSE.txt'),await readFile(path.join(app,'node_modules/@montage-ui/core/LICENSE.md')));
