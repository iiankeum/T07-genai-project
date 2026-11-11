import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {assistant} from './assistant.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://'+req.headers.host);
    if(url.pathname==='/api/assistant') {
      let body='';for await(const chunk of req){body+=chunk;if(body.length>90000){res.writeHead(413);res.end('Request too large');return;}}
      const response=await assistant(new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}:{})}),process.env);
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    let relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');if(!relative||relative.endsWith('/'))relative+='index.html';
    const file=path.resolve(root,relative);
    if(!file.startsWith(root)||relative.split('/').some(s=>s.startsWith('.'))||relative.startsWith('server/')||!types[path.extname(file)]){res.writeHead(404);res.end('Not found');return;}
    const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'});res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(Number(process.env.PORT)||4177,'127.0.0.1',()=>console.log('T07 prototypes: http://localhost:'+(process.env.PORT||4177)));
