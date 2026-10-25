import test from 'node:test';
import assert from 'node:assert/strict';
let serial=0;
async function load(config,supabase){
 globalThis.window={CENTRAL_COP_CONFIG:config,supabase};
 return (await import('../src/store.mjs?test='+serial++)).store;
}
test('backend configurado com biblioteca ausente falha sem entrar em demonstração',async()=>{
 const store=await load({supabaseUrl:'https://example.invalid',supabaseAnonKey:'public'});
 assert.equal(store.demo,false);assert.equal(store.configured,true);assert.ok(store.configurationError);
});
test('configuração parcial falha e configuração vazia permite demonstração',async()=>{
 const partial=await load({supabaseUrl:'https://example.invalid'});
 assert.equal(partial.demo,false);assert.ok(partial.configurationError);
 const demo=await load({});assert.equal(demo.demo,true);assert.equal(demo.configurationError,'');
});
test('sessão revogada é encerrada antes de consultar o perfil',async()=>{
 let signedOut=false;
 const store=await load({supabaseUrl:'https://example.invalid',supabaseAnonKey:'public'},{createClient:()=>({
  auth:{getUser:async()=>({data:{user:{id:'synthetic'}}}),signOut:async()=>{signedOut=true;}},
  rpc:async()=>({data:false}),from:()=>{throw Error('Perfil não deve ser consultado');}
 })});
 assert.equal(await store.session(),null);assert.equal(signedOut,true);
});
test('falha de rede após senha aceita é identificada como validação de sessão',async()=>{
 const store=await load({supabaseUrl:'https://example.invalid',supabaseAnonKey:'public'},{createClient:()=>({
  auth:{signInWithPassword:async()=>({data:{}}),getUser:async()=>({data:{user:{id:'synthetic'}}})},
  rpc:async()=>({error:Error('Failed to fetch')})
 })});
 await assert.rejects(store.signIn('F9900001','synthetic'),error=>error.stage==='session'&&error.message.includes('senha foi aceita'));
});
test('recupera e renova sessão pelo SDK antes de validar usuário e backend',async()=>{
 const order=[];
 const store=await load({supabaseUrl:'https://example.invalid',supabaseAnonKey:'public'},{createClient:(_u,_k,options)=>{
  assert.equal(options.auth.persistSession,true);assert.equal(options.auth.autoRefreshToken,true);
  return {auth:{getSession:async()=>{order.push('recover-refresh');return {data:{session:{}}};},getUser:async()=>{order.push('verify-user');return {data:{user:{id:'synthetic'}}};}},rpc:async()=>{order.push('verify-session');return {data:true};},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'synthetic',active:true,role:'viewer'}})})})})};
 }});
 assert.equal((await store.session()).active,true);assert.deepEqual(order,['recover-refresh','verify-user','verify-session']);
});
test('falhas temporárias do Auth ou RPC não executam logout',async()=>{
 for(const point of ['recover','user','rpc']){
  let logouts=0;
  const store=await load({supabaseUrl:'https://example.invalid',supabaseAnonKey:'public'},{createClient:()=>({auth:{getSession:async()=>point==='recover'?{error:{status:503}}:{data:{session:{}}},getUser:async()=>point==='user'?{error:{status:503,name:'AuthRetryableFetchError'}}:{data:{user:{id:'synthetic'}}},signOut:async()=>{logouts++;}},rpc:async()=>({error:Error('temporary outage')})})});
  await assert.rejects(store.session());assert.equal(logouts,0);
 }
});
test('sessão ausente ou refresh inválido não vira sessão autorizada',async()=>{
 for(const result of [{data:{session:null}},{error:{status:400,code:'refresh_token_not_found'}}]){
  const store=await load({supabaseUrl:'https://example.invalid',supabaseAnonKey:'public'},{createClient:()=>({auth:{getSession:async()=>result,getUser:async()=>{throw Error('must not authorize');}}})});
  assert.equal(await store.session(),null);
 }
});
test('logout manual limpa somente a sessão deste backend mesmo sem conexão',async()=>{
 const removed=[];
 const store=await load({supabaseUrl:'https://example.invalid',supabaseAnonKey:'public'},{createClient:()=>({auth:{signOut:async()=>({error:Error('offline')})}})});
 window.localStorage={removeItem:key=>removed.push(key)};
 await assert.rejects(store.signOut());
 assert.deepEqual(removed,['sb-example-auth-token','sb-example-auth-token-code-verifier','sb-example-auth-token-user']);
});
