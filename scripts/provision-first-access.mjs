// Executar dentro do gateway próprio; entrada privada por stdin, nunca argumentos.
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {withAccountLock,revokeSessions,recordAudit} from '../supabase/functions/_shared/security.mjs';
const canonical=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
export function validateFirstAccessMapping(entries,roster,profiles,existingEmails){
 if(!Array.isArray(entries)||entries.length!==58)throw Error('Expected the reviewed list of 58 analysts');
 const ids=new Set(),emails=new Set();
 for(const entry of entries){
  if(!entry||! /^[A-Z][A-Z0-9]{4,14}$/.test(entry.login)||typeof entry.name!=='string'||entry.name.length<3||entry.name.length>120||typeof entry.email!=='string'||entry.email!==entry.email.toLowerCase()||entry.email.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@claro\.com\.br$/.test(entry.email))throw Error('Invalid private mapping');
  if(ids.has(entry.login)||emails.has(entry.email))throw Error('Duplicate private mapping');
  ids.add(entry.login);emails.add(entry.email);
  const reference=roster.find(r=>canonical(r.login_id)===entry.login);
  const profile=profiles.find(p=>canonical(p.login_id)===entry.login);
  if(!reference||canonical(reference.display_name)!==canonical(entry.name))throw Error('Roster identity conflict: '+entry.login);
  if(profile?.role==='viewer'&&canonical(profile.display_name)!==canonical(entry.name))throw Error('Profile identity conflict: '+entry.login);
  const prior=existingEmails.find(e=>e.login_id===entry.login||e.email===entry.email);
  if(prior&&(prior.login_id!==entry.login||prior.email!==entry.email||canonical(prior.display_name)!==canonical(entry.name)))throw Error('Existing email conflict: '+entry.login);
 }
 const reset=profiles.find(p=>canonical(p.login_id)==='N4014011');
 if(!entries.some(e=>e.login==='N4014011')||!reset||reset.role!=='viewer'||!reset.active)throw Error('Reset target must be an existing active viewer');
 return {missing:entries.filter(e=>!profiles.some(p=>canonical(p.login_id)===e.login)),reset};
}
export async function provisionFirstAccess({entries,api,apply=false,resetTestAccount=false}){
 const [roster,profiles,existingEmails]=await Promise.all([
  api('/rest/v1/cop_pending_roster?select=login_id,display_name'),
  api('/rest/v1/cop_profiles?select=id,login_id,display_name,role,active,must_change_password'),
  api('/rest/v1/cop_account_emails?select=login_id,display_name,email')]);
 const owner=profiles.find(p=>canonical(p.login_id)==='NLSOARE'&&p.active&&p.role==='admin'&&!p.must_change_password);
 if(!owner)throw Error('Expected active owner administrator');
 const {missing,reset}=validateFirstAccessMapping(entries,roster,profiles,existingEmails);
 const summary={mapped:entries.length,newAccounts:missing.length,existingAccounts:entries.length-missing.length,resetLogin:'N4014011',applied:false};
 if(!apply)return summary;
 // Small adapter preserves the same account-lock, revocation and audit contracts.
 const adapter={rpc:async(name,args)=>({data:await api('/rest/v1/rpc/'+name,'POST',args)}),from:table=>({insert:async row=>{await api('/rest/v1/'+table,'POST',row);return {};}})};
 for(const entry of missing){
  const created=await api('/auth/v1/admin/users','POST',{email:entry.login.toLowerCase()+'@users.central-cop.invalid',password:randomBytes(32).toString('base64url'),email_confirm:true});
  try{
   await api('/rest/v1/cop_profiles?id=eq.'+created.id,'PATCH',{login_id:entry.login,display_name:entry.name,role:'viewer',active:true,must_change_password:true});
   await recordAudit(adapter,owner.id,created.id,'create');
  }catch(error){
   // A failed account remains gated/inactive for recovery; no implicit deletion.
   throw error;
  }
 }
 // Never overwrite trusted bindings on a retry. Conflicts were checked above.
 await api('/rest/v1/cop_account_emails','POST',entries.map(e=>({login_id:e.login,display_name:e.name,email:e.email})),{Prefer:'resolution=ignore-duplicates'});
 if(resetTestAccount){
  await withAccountLock(adapter,reset.id,async()=>{
   await api('/rest/v1/cop_profiles?id=eq.'+reset.id,'PATCH',{must_change_password:true});
   await revokeSessions(adapter,reset.id);
   await api('/auth/v1/admin/users/'+reset.id,'PUT',{password:randomBytes(32).toString('base64url')});
   await recordAudit(adapter,owner.id,reset.id,'reset');
  });
 }
 return {...summary,applied:true,resetApplied:resetTestAccount};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  const service=process.env.SERVICE_ROLE_KEY;if(!service)throw Error('Private gateway environment required');
  let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>65536)throw Error('Input too large');}
  const entries=JSON.parse(raw);raw='';
  const api=async(path,method='GET',body,extra={})=>{
   const response=await fetch('http://127.0.0.1:8000'+path,{method,signal:AbortSignal.timeout(20000),headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
   if(!response.ok)throw Error('Private provisioning failed ('+response.status+') at '+path.split('?')[0]);
   const text=await response.text();return text?JSON.parse(text):null;
  };
  console.log(JSON.stringify(await provisionFirstAccess({entries,api,apply:process.env.COP_PROVISION_APPLY==='true',resetTestAccount:process.env.COP_RESET_TEST_ACCOUNT==='true'})));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
