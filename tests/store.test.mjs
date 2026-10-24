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
