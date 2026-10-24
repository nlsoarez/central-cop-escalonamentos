// Executar apenas dentro do gateway próprio. Senha inicial aleatória descartada.
// A saída entrega ao proprietário um link de ativação de uso único, nunca senha.
import {randomBytes,createHash} from 'node:crypto';
const login=String(process.env.COP_ADMIN_LOGIN||'').trim().toUpperCase();
if(!/^[A-Z][A-Z0-9]{4,14}$/.test(login))throw Error('Admin login required');
const service=process.env.SERVICE_ROLE_KEY;
if(!service)throw Error('Private gateway environment required');
async function api(path,method='GET',body,extra={}){
 const response=await fetch('http://127.0.0.1:8000'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
 let data;try{data=await response.json();}catch{}
 if(!response.ok)throw Error('Administrator bootstrap failed at '+path.split('?')[0]+' ('+response.status+')');
 return data;
}
const profiles=await api('/rest/v1/cop_profiles?login_id=eq.'+login+'&select=id,role,must_change_password');
let id=profiles[0]?.id;
if(id&&(profiles[0].role!=='admin'||!profiles[0].must_change_password))throw Error('Existing account cannot be changed by this bootstrap');
if(!id){
 const user=await api('/auth/v1/admin/users','POST',{email:login.toLowerCase()+'@users.central-cop.invalid',password:randomBytes(32).toString('base64url'),email_confirm:true});
 id=user.id;
 try{await api('/rest/v1/cop_profiles?id=eq.'+id,'PATCH',{login_id:login,display_name:'Administrador Central COP',role:'admin',active:true,must_change_password:true});}
 catch(error){await api('/auth/v1/admin/users/'+id,'DELETE');throw error;}
 await api('/rest/v1/cop_user_audit','POST',{actor:id,target:id,event:'create'});
}
if(process.env.COP_SETUP_PREPARE_ONLY==='true'){
 console.log(JSON.stringify({login,administrators:1,activationPending:true}));
}else{
 const token=randomBytes(32).toString('hex');
 await api('/rest/v1/cop_initial_setup','POST',{user_id:id,token_hash:createHash('sha256').update(token).digest('hex'),expires_at:new Date(Date.now()+3600000).toISOString(),consumed_at:null},{Prefer:'resolution=merge-duplicates'});
 console.log(JSON.stringify({login,activationUrl:'https://central-cop-escalonamentos.vercel.app/#setup='+token,expiresInMinutes:60,administrators:1}));
}
