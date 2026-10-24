// Homologação real com identidades sintéticas. Nunca imprime senhas ou tokens.
// Executar somente na stack própria, antes da importação de dados operacionais.
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';

const base=process.env.LIVE_BASE||'http://127.0.0.1:8000';
const service=process.env.SERVICE_ROLE_KEY,anon=process.env.ANON_KEY;
if(!service||!anon)throw Error('Private environment required');
const created=[];const results=[];const run=randomUUID().replaceAll('-','').slice(0,10);
const fixtureName='COP_SYNTH_'+run;
const password=()=>randomBytes(24).toString('base64url');
async function request(path,{method='GET',body,key=service,token=service,headers={}}={}){
 const response=await fetch(base+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 let data;try{data=await response.json();}catch{}
 return {status:response.status,data};
}
async function success(path,options){
 const response=await request(path,options);
 if(response.status>=300)throw Error('Unexpected status '+response.status+' at '+path.split('?')[0]+': '+(response.data?.error||response.data?.message||''));
 return response.data;
}
const login=async(email,secret)=>success('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password:secret},key:anon,token:anon});
const profile=async(id,values)=>success('/rest/v1/cop_profiles?id=eq.'+id,{method:'PATCH',body:values});
const asUser=(token,body)=>({method:'POST',body,key:anon,token});
let adminId;
try{
 const existing=await success('/rest/v1/cop_contacts?select=id&limit=1');
 assert.equal(existing.length,0,'Homologação requer diretório operacional vazio');
 const adminEmail='cop-smoke-'+run+'@example.invalid',adminPassword=password();
 const admin=await success('/auth/v1/admin/users',{method:'POST',body:{email:adminEmail,password:adminPassword,email_confirm:true}});
 adminId=admin.id;created.push(admin.id);
 await profile(admin.id,{role:'admin',active:true,must_change_password:false});
 const adminSession=await login(adminEmail,adminPassword);const at=adminSession.access_token;
 const anonRead=await request('/rest/v1/cop_contacts',{key:anon,token:anon});
 assert.ok([401,403].includes(anonRead.status));results.push('anonymous_denied');
 const operatorLogin='T'+run.toUpperCase();
 const provisioning=await success('/functions/v1/cop-manage-users',asUser(at,{action:'create',users:[{login:operatorLogin,nome:'Pessoa Sintética '+run}]}));
 const entry=provisioning.results[0];assert.equal(entry.status,'created');assert.ok(entry.temporaryPassword);
 const profiles=await success('/rest/v1/cop_profiles?select=id,login_id&login_id=eq.'+operatorLogin);
 const userId=profiles[0].id;created.push(userId);
 const userEmail=operatorLogin.toLowerCase()+'@users.central-cop.invalid';
 const first=await login(userEmail,entry.temporaryPassword);
 assert.equal((await success('/rest/v1/cop_contacts',{key:anon,token:first.access_token})).length,0);
 const forbidden=await request('/functions/v1/cop-manage-users',asUser(first.access_token,{action:'reset',userId:admin.id}));
 assert.equal(forbidden.status,403);results.push('individual_user_and_first_access');
 const newPassword=password();
 const changed=await success('/functions/v1/cop-change-password',asUser(first.access_token,{currentPassword:entry.temporaryPassword,newPassword}));
 assert.equal(changed.reauthenticate,true);
 assert.equal((await success('/rest/v1/rpc/cop_session_valid',asUser(first.access_token,{}))),false);
 const personal=await login(userEmail,newPassword);results.push('password_change_and_revocation');
 const make=(cluster,suffix)=>({cluster,full_name:fixtureName+suffix,phone_e164:'5521999990001',scope:'regional',active:true});
 await success('/rest/v1/rpc/cop_publish_contacts',asUser(at,{p_rows:[make('RJ','RJ'),make('MG','MG')],p_mode:'merge'}));
 assert.equal((await success('/rest/v1/cop_contacts',{key:anon,token:personal.access_token})).length,2);
 const replaced=await success('/rest/v1/rpc/cop_publish_contacts',asUser(at,{p_rows:[make('RJ','RJ_NEW')],p_mode:'replace_clusters'}));
 await success('/rest/v1/rpc/cop_publish_contacts',asUser(at,{p_rows:[make('MG','MG_NEW')],p_mode:'replace_clusters'}));
 await success('/rest/v1/rpc/cop_restore_import',asUser(at,{p_batch_id:replaced.batch_id}));
 const contacts=await success('/rest/v1/cop_contacts?select=cluster,full_name');
 assert.ok(contacts.some(c=>c.cluster==='MG'&&c.full_name.endsWith('MG_NEW')));results.push('regional_import_and_restore');
 const elevate=await request('/rest/v1/cop_profiles?id=eq.'+userId,{method:'PATCH',body:{role:'admin'},key:anon,token:personal.access_token});
 assert.ok([401,403].includes(elevate.status));results.push('privilege_escalation_denied');
 await success('/functions/v1/cop-manage-users',asUser(at,{action:'set_active',userId,active:false}));
 await success('/functions/v1/cop-manage-users',asUser(at,{action:'set_active',userId,active:true}));
 assert.equal((await success('/rest/v1/rpc/cop_session_valid',asUser(personal.access_token,{}))),false);
 const reset=await success('/functions/v1/cop-manage-users',asUser(at,{action:'reset',userId}));
 assert.ok(reset.temporaryPassword);results.push('block_reactivate_reset');
 const audits=await success('/rest/v1/cop_user_audit?select=event&actor=eq.'+admin.id);
 assert.ok(audits.some(a=>a.event==='reset'));results.push('administrative_audit');
 const initialToken=randomBytes(32).toString('hex'),initialPassword=password();
 await profile(admin.id,{must_change_password:true});
 await success('/rest/v1/cop_initial_setup',{method:'POST',body:{user_id:admin.id,token_hash:createHash('sha256').update(initialToken).digest('hex'),expires_at:new Date(Date.now()+3600000).toISOString()}});
 await success('/functions/v1/cop-initial-setup',{method:'POST',key:anon,token:anon,body:{token:initialToken,password:initialPassword}});
 assert.equal((await request('/functions/v1/cop-initial-setup',{method:'POST',key:anon,token:anon,body:{token:initialToken,password:password()}})).status,400);
 const activated=await login(adminEmail,initialPassword);assert.ok(activated.access_token);results.push('single_use_admin_activation');
 for(let i=0;i<11;i++){
  const invalid=await request('/auth/v1/token?grant_type=password',{method:'POST',key:anon,token:anon,body:{email:'absent-'+run+'@example.invalid',password:'invalid-secret'}});
  assert.equal(invalid.status,i<10?401:429);
 }
 results.push('real_login_rate_limit');
 console.log(JSON.stringify({passed:true,checks:results,realUsersImported:0}));
}finally{
 // Só remover fixtures desta execução; usuários e contatos reais nunca são alvo.
 await success('/rest/v1/cop_contacts?full_name=like.'+fixtureName+'*',{method:'DELETE'});
 if(adminId)await success('/rest/v1/cop_import_batches?created_by=eq.'+adminId,{method:'DELETE'});
 for(const id of created.reverse())await success('/auth/v1/admin/users/'+id,{method:'DELETE'});
 console.log(JSON.stringify({syntheticCleanup:true,accountsRemoved:created.length}));
}
