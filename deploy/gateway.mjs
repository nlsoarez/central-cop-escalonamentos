import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export class AttemptLimiter {
 constructor({clock=Date.now,maxEntries=10000}={}){this.clock=clock;this.maxEntries=maxEntries;this.entries=new Map();}
 take(key,limit,windowMs){
  const now=this.clock();
  for(const [id,bucket] of this.entries)if(bucket.until<=now)this.entries.delete(id);
  let bucket=this.entries.get(key);
  if(!bucket){
   // Esgotar memória não pode criar um bypass para novas identidades.
   if(this.entries.size>=this.maxEntries)return false;
   bucket={count:0,until:now+windowMs};this.entries.set(key,bucket);
  }
  return ++bucket.count<=limit;
 }
}
export function createGateway({anonKey,serviceKey,origins,trustProxy=false,limiter=new AttemptLimiter(),upstreams={auth:'http://auth:9999',rest:'http://rest:3000',functions:'http://functions:9000'}}){
 if(!anonKey||!serviceKey||!origins?.length)throw Error('Gateway configuration missing');
 return http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  const cors={
   'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',
   ...(origin&&origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
   'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type,accept-profile,content-profile,prefer,range,range-unit,x-supabase-api-version',
   'Access-Control-Allow-Methods':'GET,HEAD,POST,PATCH,DELETE,OPTIONS',
   'Access-Control-Expose-Headers':'content-range,range-unit,preference-applied,x-total-count'
  };
  const reply=(status,data)=>{res.writeHead(status,{...cors,'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(origin&&!origins.includes(origin)){reply(403,{error:'Origem não autorizada'});return;}
  if(req.method==='OPTIONS'){res.writeHead(204,cors);res.end();return;}
  // This is an origin server, never an open forward proxy. Malformed request
  // targets must produce 400 rather than reject the async handler/process.
  let url;
  try{
   if(!req.url?.startsWith('/')||req.url.startsWith('//')||req.url.includes('\\'))throw Error('Invalid target');
   url=new URL(req.url,'http://gateway');
  }catch{reply(400,{error:'Solicitação inválida'});return;}
  if(url.pathname==='/health'&&req.method==='GET'){reply(200,{status:'ok'});return;}
  const key=req.headers.apikey;
  if(!equal(key,anonKey)&&!equal(key,serviceKey)){reply(401,{error:'Chave de aplicação inválida'});return;}
  const service=equal(key,serviceKey);
  let destination;
  const route=(path,base,search='')=>{
   if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw Error('Invalid route');
   const target=new URL(base);
   // Assign the pathname as data: new URL('//host', base) changes authority.
   target.pathname=path;target.search=search;target.hash='';
   return target;
  };
  try{
  if(url.pathname.startsWith('/auth/v1/')){
   const path=url.pathname.slice('/auth/v1'.length);
   // Cadastro, recovery e alterações de e-mail ficam fora da API pública.
   if(!service&&!['/token','/user','/logout','/settings','/health'].includes(path)){reply(404,{error:'Não encontrado'});return;}
   if(!service&&path==='/user'&&req.method!=='GET'){reply(403,{error:'Use o fluxo de troca de senha do portal'});return;}
   destination=route(path,upstreams.auth,url.search);
  }else if(url.pathname.startsWith('/rest/v1/'))destination=route(url.pathname.slice('/rest/v1'.length),upstreams.rest,url.search);
  else if(/^\/functions\/v1\/(cop-manage-users|cop-change-password|cop-initial-setup)$/.test(url.pathname))destination=route(url.pathname.slice('/functions/v1'.length),upstreams.functions);
  else {reply(404,{error:'Não encontrado'});return;}
  }catch{reply(400,{error:'Solicitação inválida'});return;}
  const isToken=url.pathname==='/auth/v1/token';
  const maximum=isToken?16384:8*1024*1024;
  try{
   const chunks=[];let length=0;
   for await(const chunk of req){length+=chunk.length;if(length>maximum){reply(413,{error:'Solicitação muito grande'});return;}chunks.push(chunk);}
   const body=Buffer.concat(chunks);
   if(isToken&&!service){
    const grant=url.searchParams.get('grant_type');
    if(!['password','refresh_token'].includes(grant)){reply(400,{error:'Fluxo não autorizado'});return;}
    const ip=trustProxy?String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim():req.socket.remoteAddress;
    if(!limiter.take('ip:'+ip,300,900000)){reply(429,{error:'Aguarde antes de tentar novamente.'});return;}
    if(grant==='password'){
     let login;try{login=JSON.parse(body);}catch{reply(401,{error:'Matrícula ou senha inválida'});return;}
     const email=typeof login.email==='string'?login.email.trim().toLowerCase():'';
     if(!email||email.length>254||typeof login.password!=='string'||login.password.length>128){reply(401,{error:'Matrícula ou senha inválida'});return;}
     const account=createHash('sha256').update(email).digest('hex');
     if(!limiter.take('account:'+account,10,900000)){reply(429,{error:'Aguarde antes de tentar novamente.'});return;}
    }
   }
   const headers={...req.headers,host:destination.host};
   delete headers.connection;delete headers['transfer-encoding'];delete headers['content-length'];
   // IP enviado pelo cliente nunca chega como autoridade ao Auth.
   if(!trustProxy)delete headers['x-forwarded-for'];
   if(body.length)headers['content-length']=String(body.length);
   const upstream=http.request(destination,{method:req.method,headers,timeout:65000},up=>{
    if(isToken&&up.statusCode===400&&url.searchParams.get('grant_type')==='password'){
     up.resume();reply(401,{error:'Matrícula ou senha inválida'});return;
    }
    const upstreamHeaders={...up.headers};delete upstreamHeaders['access-control-allow-origin'];delete upstreamHeaders.connection;
    res.writeHead(up.statusCode||502,{...upstreamHeaders,...cors});up.pipe(res);
   });
   upstream.on('timeout',()=>upstream.destroy());
   upstream.on('error',()=>{if(!res.headersSent)reply(502,{error:'Serviço temporariamente indisponível'});else res.destroy();});
   res.on('close',()=>upstream.destroy());
   upstream.end(body);
  }catch{if(!res.headersSent)reply(400,{error:'Solicitação inválida'});}
 });
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const gateway=createGateway({anonKey:process.env.ANON_KEY,serviceKey:process.env.SERVICE_ROLE_KEY,
  origins:(process.env.COP_ALLOWED_ORIGINS||'').split(',').filter(Boolean),trustProxy:process.env.TRUST_PROXY==='true'});
 gateway.requestTimeout=70000;gateway.headersTimeout=10000;gateway.maxConnections=100;
 gateway.listen(8000,'0.0.0.0',()=>console.log('Central COP gateway ready'));
}
