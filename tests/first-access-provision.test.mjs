import test from 'node:test';
import assert from 'node:assert/strict';
import {provisionFirstAccess,validateFirstAccessMapping} from '../scripts/provision-first-access.mjs';
const entries=Array.from({length:58},(_,i)=>({login:i===0?'N4014011':'F'+String(i).padStart(7,'0'),name:'Pessoa Sintetica '+i,email:'synthetic'+i+'@claro.com.br'}));
const roster=entries.map(e=>({login_id:e.login,display_name:e.name}));
const profiles=[{id:'owner',login_id:'NLSOARE',role:'admin',active:true,must_change_password:false},...entries.map((e,i)=>({id:'viewer-'+i,login_id:e.login,display_name:e.name,role:'viewer',active:true,must_change_password:false}))];
test('vínculo exige lista revisada, identidade da matrícula e ausência de conflitos',()=>{
 assert.equal(validateFirstAccessMapping(entries,roster,profiles,[]).missing.length,0);
 assert.throws(()=>validateFirstAccessMapping(entries.slice(1),roster,profiles,[]));
 assert.throws(()=>validateFirstAccessMapping(entries.map((e,i)=>i===1?{...e,email:entries[0].email}:e),roster,profiles,[]));
 assert.throws(()=>validateFirstAccessMapping(entries,roster.map((r,i)=>i===2?{...r,display_name:'Outra Pessoa'}:r),profiles,[]));
 assert.throws(()=>validateFirstAccessMapping(entries,roster,profiles,[{login_id:entries[0].login,email:'changed@claro.com.br',display_name:entries[0].name}]));
 assert.throws(()=>validateFirstAccessMapping(entries,roster,profiles.map(p=>p.login_id==='N4014011'?{...p,role:'admin'}:p),[]));
});
test('prévia não escreve; aplicação preserva contas existentes e reseta somente o login autorizado',async()=>{
 const calls=[];
 const api=async(path,method='GET',body)=>{
  calls.push({path,method,body});
  if(method==='GET')return path.includes('cop_pending_roster')?roster:path.includes('cop_profiles')?profiles:[];
  return path.endsWith('cop_acquire_account_lock')?'lease':null;
 };
 const preview=await provisionFirstAccess({entries,api});assert.equal(preview.newAccounts,0);assert.ok(calls.every(c=>c.method==='GET'));
 calls.length=0;
 await provisionFirstAccess({entries,api,apply:true,resetTestAccount:true});
 const passwordCalls=calls.filter(c=>c.path.startsWith('/auth/v1/admin/users/'));
 assert.equal(passwordCalls.length,1);assert.equal(passwordCalls[0].path,'/auth/v1/admin/users/viewer-0');
 assert.equal(calls.some(c=>c.body?.role),false);assert.equal(calls.find(c=>c.path.endsWith('cop_revoke_sessions')).body.p_user_id,'viewer-0');
});
