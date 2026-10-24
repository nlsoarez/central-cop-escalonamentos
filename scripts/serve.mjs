// Servidor local de teste; não utilizar como servidor público de produção.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/[\\/]$/,'');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png'};
http.createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(path==='/config.js'){
   let config='';try{config=await readFile(resolve(root,'config.js'),'utf8');}catch{}
   res.writeHead(200,{'Content-Type':'text/javascript'});res.end(config);return;
  }
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/'))throw Error('Invalid path');
  if(!['/index.html','/config.example.js'].includes(path)&&path!=='/'&&!/^\/(src|assets)\//.test(path))throw Error('Not public');
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(8087,'127.0.0.1',()=>console.log('Central COP local: http://127.0.0.1:8087'));
