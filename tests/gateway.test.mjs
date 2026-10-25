import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {AttemptLimiter,createGateway} from '../deploy/gateway.mjs';

test('limites não podem ser ignorados esgotando o mapa ou aguardando TTL errado',()=>{
 let now=0;const limiter=new AttemptLimiter({clock:()=>now,maxEntries:2});
 assert.equal(limiter.take('one',2,100),true);assert.equal(limiter.take('one',2,100),true);
 assert.equal(limiter.take('one',2,100),false);assert.equal(limiter.take('two',2,100),true);
 assert.equal(limiter.take('three',2,100),false);now=101;
 assert.equal(limiter.take('three',2,100),true);
});
test('gateway aplica chaves, CORS, fluxo de senha e limites via HTTP',async t=>{
 let requests=0;
 const upstream=http.createServer((req,res)=>{requests++;res.writeHead(req.url.startsWith('/token')?400:200,{'Content-Type':'application/json'});res.end('{"message":"provider_internal_detail"}');});
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const address='http://127.0.0.1:'+upstream.address().port;
 const gateway=createGateway({anonKey:'anon-test',serviceKey:'service-test',origins:['https://allowed.invalid'],upstreams:{auth:address,rest:address,functions:address}});
 await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
 t.after(()=>{gateway.closeAllConnections();gateway.close();upstream.closeAllConnections();upstream.close();});
 const base='http://127.0.0.1:'+gateway.address().port;
 const request=(path,options={})=>fetch(base+path,{...options,headers:{apikey:'anon-test',...options.headers}});
 assert.equal((await fetch(base+'/rest/v1/cop_contacts')).status,401);
 assert.equal((await request('/rest/v1/cop_contacts',{headers:{apikey:'é'.repeat(9)}})).status,401);
 assert.equal((await request('/rest/v1/cop_contacts',{headers:{origin:'https://evil.invalid'}})).status,403);
 const preflight=await request('/rest/v1/rpc/cop_session_valid',{method:'OPTIONS',headers:{origin:'https://allowed.invalid','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'apikey,authorization,content-type,content-profile,x-client-info'}});
 assert.equal(preflight.status,204);
 const allowedHeaders=preflight.headers.get('access-control-allow-headers').split(',').map(s=>s.trim());
 assert.ok(allowedHeaders.includes('content-profile'),'Supabase RPC headers must pass browser CORS');
 assert.ok(allowedHeaders.includes('accept-profile'),'Supabase table reads must pass browser CORS');
 assert.equal((await request('/auth/v1/user',{method:'PUT',body:'{}'})).status,403);
 assert.equal((await request('/auth/v1/signup',{method:'POST',body:'{}'})).status,404);
 assert.equal((await request('/auth/v1/admin/users',{method:'GET'})).status,404);
 const payload={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.invalid',password:'incorrect'})};
 for(let i=0;i<10;i++){
  const response=await request('/auth/v1/token?grant_type=password',payload);
  assert.equal(response.status,401);assert.ok(!(await response.text()).includes('provider_internal_detail'));
 }
 const before=requests;
 assert.equal((await request('/auth/v1/token?grant_type=password',payload)).status,429);
 assert.equal(requests,before);
 assert.equal((await request('/functions/v1/arbitrary-worker',{method:'POST'})).status,404);
 assert.equal((await request('/rest/v1/cop_contacts')).status,200);
});
test('gateway não permite que a rota REST troque o servidor de destino',async t=>{
 let unexpected=0;
 const attacker=http.createServer((req,res)=>{unexpected++;res.end('unexpected');});
 const upstream=http.createServer((req,res)=>res.end('expected'));
 await new Promise(r=>attacker.listen(0,'127.0.0.1',r));
 await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const address='http://127.0.0.1:'+upstream.address().port;
 const gateway=createGateway({anonKey:'anon-test',serviceKey:'service-test',origins:['https://allowed.invalid'],upstreams:{auth:address,rest:address,functions:address}});
 await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
 t.after(()=>{for(const server of [attacker,upstream,gateway]){server.closeAllConnections();server.close();}});
 const base='http://127.0.0.1:'+gateway.address().port;
 const rawRequest=path=>new Promise((resolve,reject)=>{
  const req=http.request(base,{path,headers:{apikey:'anon-test'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
  req.on('error',reject);req.end();
 });
 for(const path of ['http://[','//other.invalid/rest/v1/cop_contacts','/rest/v1/\\other.invalid/probe']) assert.equal(await rawRequest(path),400);
 const response=await fetch(base+'/rest/v1//127.0.0.1:'+attacker.address().port+'/probe',{headers:{apikey:'anon-test',authorization:'Bearer synthetic-not-a-credential'}});
 assert.equal(response.status,400);
 assert.equal(unexpected,0,'rota controlada pelo cliente não pode alcançar outro servidor');
 const legitimate=await fetch(base+'/rest/v1/cop_contacts?select=id',{headers:{apikey:'anon-test'}});
 assert.equal(await legitimate.text(),'expected');
});
