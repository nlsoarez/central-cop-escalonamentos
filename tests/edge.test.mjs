import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import * as security from '../supabase/functions/_shared/security.mjs';

const actor='10000000-0000-4000-8000-000000000001';
const target='10000000-0000-4000-8000-000000000002';
const sid='20000000-0000-4000-8000-000000000001';
const token='header.'+Buffer.from(JSON.stringify({session_id:sid})).toString('base64url')+'.signature';
function fixture(options={}){
 const profiles=new Map([[actor,{id:actor,role:'admin',active:true,must_change_password:false}],
  [target,{id:target,login_id:'F000001',role:'viewer',active:true,must_change_password:false}]]);
 Object.assign(profiles.get(actor),options.operator);
 Object.assign(profiles.get(target),options.target);
 const calls=[];const audit=[];let sequence=3;
 const principal=options.principal||actor;
 const admin={
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='cop_consume_initial_setup')return {data:options.setupUser||null,error:null};
   if(name==='cop_session_valid_for')return {data:options.sessionValid!==false};
   if(name==='cop_consume_limit')return {data:options.limit!==false};
   if(name==='cop_acquire_account_lock')return {data:options.locked?null:'lease'};
   return {data:null,error:null};
  },
  auth:{
   getUser:async()=>({data:{user:{id:principal,email:'test@example.invalid'}},error:options.invalidAuth?Error('invalid'):null}),
   admin:{
    createUser:async()=>{
     const id='10000000-0000-4000-8000-'+String(sequence++).padStart(12,'0');
     calls.push({name:'createUser'});profiles.set(id,{id,active:false,role:'viewer'});
     return {data:{user:{id}}};
    },
    deleteUser:async(id)=>{profiles.delete(id);return {};},
    updateUserById:async()=>{calls.push({name:'passwordUpdate'});return {error:options.passwordError?Error('provider failed'):null};}
   }
  },
  from(table){
   let filters={};let values;let mode='select';
   const execute=()=>{
    if(table==='cop_user_audit'){audit.push(values);return {error:null};}
    let rows=[...profiles.values()].filter(p=>Object.entries(filters).every(([k,v])=>p[k]===v));
    if(mode==='update'){
     calls.push({name:'profileUpdate',values:{...values}});
     if(options.gateError&&values.must_change_password===true)return {data:null,error:Error('database failed')};
     rows.forEach(p=>Object.assign(p,values));
    }
    return {data:rows[0]?{...rows[0]}:null,error:null};
   };
   const query={
    select(){return query;},eq(k,v){filters[k]=v;return query;},
    update(v){values=v;mode='update';return query;},
    insert(v){values=v;mode='insert';return query;},
    single:async()=>execute(),maybeSingle:async()=>execute(),
    then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
   };return query;
  }
 };
 const publicClient={auth:{
  signInWithPassword:async()=>({error:options.wrongPassword?Error('wrong'):null}),
  signOut:async()=>{calls.push({name:'verificationSignOut'});return {};}
 }};
 return {profiles,calls,audit,createClient:(_url,key)=>key==='public'?publicClient:admin};
}
async function load(name,options){
 const f=fixture(options);let handler;
 let source=await readFile(new URL('../supabase/functions/'+name+'/index.ts',import.meta.url),'utf8');
 source=source.replace(/^import .+;\r?\n/gm,'');
 const context={...security,createClient:f.createClient,Request,Response,crypto,btoa,atob,console,TextEncoder,
  Deno:{env:{get:key=>({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'public'})[key]},serve:fn=>{handler=fn;}}};
 vm.runInNewContext(stripTypeScriptTypes(source),context);
 return {...f,handler};
}
const request=(body,headers={})=>new Request('https://example.invalid/function',{
 method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',origin:security.DEFAULT_ORIGIN,...headers},body:JSON.stringify(body)
});

test('funções rejeitam CORS desconhecido e aceitam o domínio oficial',async()=>{
 for(const name of ['cop-manage-users','cop-change-password']){
  const f=await load(name);
  assert.equal((await f.handler(request({}, {origin:'https://evil.invalid'}))).status,403);
  const response=await f.handler(new Request('https://example.invalid',{method:'OPTIONS',headers:{origin:security.DEFAULT_ORIGIN}}));
  assert.equal(response.status,204);assert.equal(response.headers.get('access-control-allow-origin'),security.DEFAULT_ORIGIN);
 }
});
test('gestão exige administrador ativo com sessão válida e senha pessoal',async()=>{
 for(const options of [{operator:{role:'viewer'}},{operator:{active:false}},{operator:{must_change_password:true}},{sessionValid:false},{invalidAuth:true}]){
  const f=await load('cop-manage-users',options);
  const response=await f.handler(request({action:'create',users:[{login:'F000009',nome:'Pessoa fictícia'}]}));
  assert.ok([401,403].includes(response.status));assert.equal(f.calls.filter(c=>c.name==='createUser').length,0);
 }
 const f=await load('cop-manage-users');
 assert.equal((await f.handler(request({}, {authorization:''}))).status,401);
});
test('cadastro detecta duplicados e preserva conta existente',async()=>{
 const f=await load('cop-manage-users');
 const duplicate=await f.handler(request({action:'create',users:[{login:'F000009',nome:'Pessoa fictícia'},{login:'f000009',nome:'Outra pessoa'}]}));
 assert.equal(duplicate.status,400);
 const existing=await f.handler(request({action:'create',users:[{login:'F000001',nome:'Pessoa fictícia'}]}));
 assert.equal((await existing.json()).results[0].status,'exists');
 assert.equal(f.calls.filter(c=>c.name==='passwordUpdate'||c.name==='createUser').length,0);
});
test('cadastro gera senhas distintas somente na resposta sem cache',async()=>{
 const f=await load('cop-manage-users');
 const response=await f.handler(request({action:'create',users:[{login:'F000008',nome:'Pessoa oito'},{login:'F000009',nome:'Pessoa nove'}]}));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const data=await response.json();
 assert.equal(data.results.length,2);assert.notEqual(data.results[0].temporaryPassword,data.results[1].temporaryPassword);
 assert.ok(data.results.every(r=>r.temporaryPassword.length>=24));
 assert.equal(f.audit.length,2);assert.ok(f.audit.every(a=>!JSON.stringify(a).includes('Password')));
 assert.ok([...f.profiles.values()].every(p=>!('password' in p)&&!('temporaryPassword' in p)));
});
test('reset restringe conta antes de atualizar senha e falha de forma fechada',async()=>{
 for(const options of [{gateError:true},{passwordError:true},{}]){
  const f=await load('cop-manage-users',options);
  const response=await f.handler(request({action:'reset',userId:target}));
  if(options.gateError){assert.equal(response.status,500);assert.ok(!f.calls.some(c=>c.name==='passwordUpdate'));}
  else {
   assert.equal(f.profiles.get(target).must_change_password,true);
   const gate=f.calls.findIndex(c=>c.name==='profileUpdate');
   const revoke=f.calls.findIndex(c=>c.name==='cop_revoke_sessions');
   const password=f.calls.findIndex(c=>c.name==='passwordUpdate');
   assert.ok(gate<revoke&&revoke<password);
   assert.equal(response.status,options.passwordError?500:200);
  }
 }
});
test('admin não redefine outro administrador nem opera com lock ocupado',async()=>{
 const adminTarget=await load('cop-manage-users',{target:{role:'admin'}});
 assert.equal((await adminTarget.handler(request({action:'reset',userId:target}))).status,403);
 const locked=await load('cop-manage-users',{locked:true});
 assert.equal((await locked.handler(request({action:'reset',userId:target}))).status,409);
 assert.ok(!locked.calls.some(c=>c.name==='passwordUpdate'));
});
test('desativar e reativar revogam as sessões da conta',async()=>{
 for(const active of [false,true]){
  const f=await load('cop-manage-users');
  assert.equal((await f.handler(request({action:'set_active',userId:target,active}))).status,200);
  assert.equal(f.profiles.get(target).active,active);
  assert.ok(f.calls.some(c=>c.name==='cop_revoke_sessions'));
  assert.equal(f.audit[0].event,active?'activate':'deactivate');
 }
});
test('troca de senha bloqueia conta inativa, JWT revogado, limite e senha incorreta',async()=>{
 for(const [options,status] of [[{target:{active:false}},403],[{sessionValid:false},401],[{limit:false},429],[{wrongPassword:true},400]]){
  const f=await load('cop-change-password',{principal:target,...options});
  assert.equal((await f.handler(request({currentPassword:'CurrentPassword123',newPassword:'NewPassword123456'}))).status,status);
  assert.ok(!f.calls.some(c=>c.name==='passwordUpdate'));
 }
});
test('troca bem-sucedida revoga sessões e exige nova autenticação',async()=>{
 const f=await load('cop-change-password',{principal:target,target:{must_change_password:true}});
 const response=await f.handler(request({currentPassword:'CurrentPassword123',newPassword:'NewPassword123456'}));
 assert.equal(response.status,200);assert.equal((await response.json()).reauthenticate,true);
 assert.equal(f.profiles.get(target).must_change_password,false);
 assert.ok(f.calls.some(c=>c.name==='cop_revoke_sessions'));
 assert.ok(f.calls.some(c=>c.name==='verificationSignOut'));
 assert.equal(f.audit[0].event,'change_password');
});
test('ativação inicial exige token válido e não aceita senha curta',async()=>{
 const f=await load('cop-initial-setup');
 assert.equal((await f.handler(request({token:'a'.repeat(64),password:'short'}))).status,400);
 assert.equal((await f.handler(request({token:'a'.repeat(64),password:'LongSynthetic123!'}))).status,400);
 assert.ok(!f.calls.some(c=>c.name==='passwordUpdate'));
});
test('ativação inicial altera senha apenas do administrador vinculado ao token',async()=>{
 const f=await load('cop-initial-setup',{setupUser:actor,operator:{must_change_password:true}});
 const response=await f.handler(request({token:'a'.repeat(64),password:'LongSynthetic123!'}));
 assert.equal(response.status,200);assert.equal(f.profiles.get(actor).must_change_password,false);
 assert.ok(f.calls.some(c=>c.name==='cop_revoke_sessions'));
});
