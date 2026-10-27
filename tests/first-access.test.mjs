import test from 'node:test';
import assert from 'node:assert/strict';
import {firstAccessHandler,firstAccessEmail,gmailOptions,GMAIL_ACCOUNT} from '../supabase/functions/_shared/first-access.mjs';
import {DEFAULT_ORIGIN} from '../supabase/functions/_shared/security.mjs';
const id='10000000-0000-4000-8000-000000000002';
const token='a'.repeat(64);
function fixture(options={}){
 const calls=[],jobs=[],messages=[];
 const admin={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='cop_consume_limit')return {data:options.limit!==false};
  if(name==='cop_acquire_account_lock')return {data:options.lock===false?null:'lease'};
  if(name==='cop_reserve_first_access')return {data:options.known===false?[]:[{user_id:id,email:'synthetic@claro.com.br'}],error:options.dbError};
  if(name==='cop_consume_first_access')return {data:options.consume!==false};
  return {};
 },auth:{admin:{updateUserById:async(user,values)=>{calls.push({name:'password',user,values});return {error:options.passwordError};}}},
 from(table){
  let values;const filters={};
  const result=()=>{calls.push({name:table,values,filters:{...filters}});return {data:options.known===false?null:{user_id:id,id},error:null};};
  const query={select:()=>query,eq:(key,value)=>{filters[key]=value;return query;},update:v=>{values=v;return query;},insert:v=>{values=v;return query;},single:async()=>result(),maybeSingle:async()=>result(),then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};return query;
 }};
 const handler=firstAccessHandler({admin,enabled:options.enabled!==false,sendMail:async msg=>{messages.push(msg);if(options.smtpError)throw Error('private SMTP detail');},defer:job=>jobs.push(job)});
 const request=(body,origin=DEFAULT_ORIGIN)=>handler(new Request('https://example.invalid',{method:'POST',headers:{origin},body:JSON.stringify(body)}));
 return {calls,jobs,messages,request,handler};
}
test('SMTP usa remetente fixo, TLS e nenhum logger; mensagem não aceita destino arbitrário',()=>{
 const options=gmailOptions('a'.repeat(16));assert.equal(options.auth.user,GMAIL_ACCOUNT);assert.equal(options.secure,true);assert.equal(options.tls.rejectUnauthorized,true);assert.equal(options.debug,false);
 assert.throws(()=>gmailOptions(''));assert.throws(()=>firstAccessEmail('other@example.invalid',token));assert.throws(()=>firstAccessEmail('a@claro.com.br\r\nBcc:other@claro.com.br',token));
 const mail=firstAccessEmail('synthetic@claro.com.br',token);assert.match(mail.text,/#activate=a{64}/);assert.equal(mail.to,'synthetic@claro.com.br');assert.ok(!('attachments' in mail));
});
test('matrícula normaliza caixa; resposta não revela existência ou entrega SMTP',async()=>{
 const known=fixture(),unknown=fixture({known:false});
 const a=await known.request({action:'request',login:' n4014011 ',email:'attacker@example.invalid'});
 const b=await unknown.request({action:'request',login:'N4014011'});
 assert.equal(a.status,200);assert.deepEqual(await a.json(),await b.json());
 assert.equal(known.calls.find(c=>c.name==='cop_reserve_first_access').args.p_login,'N4014011');
 await Promise.all(known.jobs);assert.equal(known.messages[0].to,'synthetic@claro.com.br');assert.equal(unknown.messages.length,0);
 assert.equal(known.calls.findLast(c=>c.name==='cop_first_access').values.delivery,'sent');
});
test('falha SMTP fica privada e invalida a entrega; nenhum token sai na resposta',async()=>{
 const f=fixture({smtpError:true});const response=await f.request({action:'request',login:'N4014011'});await Promise.all(f.jobs);
 assert.doesNotMatch(await response.text(),/private SMTP|activate=|token/);
 assert.equal(f.calls.findLast(c=>c.name==='cop_first_access').values.delivery,'failed');
});
test('CORS, configuração e limites impedem envio',async()=>{
 for(const [options,status]of [[{enabled:false},503],[{limit:false},429]]){
  const f=fixture(options);assert.equal((await f.request({action:'request',login:'N4014011'})).status,status);assert.equal(f.messages.length,0);
 }
 const f=fixture();assert.equal((await f.request({},'https://evil.invalid')).status,403);assert.equal((await f.request({action:'request',login:'bad'})).status,400);
});
test('ativação exige consumo único sob lock e revoga sessões antes de liberar o perfil',async()=>{
 const f=fixture();assert.equal((await f.request({action:'activate',token,password:'synthetic-password-123'})).status,200);
 const names=f.calls.map(c=>c.name);
 assert.ok(names.indexOf('cop_acquire_account_lock')<names.indexOf('cop_consume_first_access'));
 assert.ok(names.indexOf('cop_revoke_sessions')<names.indexOf('password'));
 assert.ok(names.indexOf('cop_user_audit')<names.indexOf('cop_profiles'));
 assert.equal(names.at(-1),'cop_release_account_lock');
 for(const options of [{consume:false},{known:false},{lock:false}]){
  const rejected=fixture(options);assert.ok([400,409].includes((await rejected.request({action:'activate',token,password:'synthetic-password-123'})).status));assert.equal(rejected.calls.some(c=>c.name==='password'),false);
 }
});
test('falha ao atualizar senha mantém o acesso operacional bloqueado',async()=>{
 const f=fixture({passwordError:true});assert.equal((await f.request({action:'activate',token,password:'synthetic-password-123'})).status,503);
 assert.equal(f.calls.some(c=>c.name==='cop_profiles'),false);
});
