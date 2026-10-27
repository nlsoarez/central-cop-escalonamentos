import {DEFAULT_ORIGIN,consumeLimit,recordAudit,revokeSessions,withAccountLock} from './security.mjs';

export const GMAIL_ACCOUNT='nlsoarez@gmail.com';
const generic={success:true,message:'Se houver um primeiro acesso pendente para esta matrícula, enviaremos um link ao e-mail corporativo cadastrado. Confira também o spam.'};
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
export function gmailOptions(secret){
 if(typeof secret!=='string'||!/^[A-Za-z0-9]{16}$/.test(secret))throw Error('Credencial de envio não configurada');
 return {host:'smtp.gmail.com',port:465,secure:true,auth:{user:GMAIL_ACCOUNT,pass:secret},
  tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,
  logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true};
}
export function firstAccessEmail(email,token){
 if(typeof email!=='string'||email.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@claro\.com\.br$/.test(email)||!/^[a-f0-9]{64}$/.test(token))throw Error('Destino ou token inválido');
 return {from:{name:'Central COP — Escalonamentos',address:GMAIL_ACCOUNT},to:email,
  subject:'Central COP — Defina sua senha de acesso',
  text:'Você solicitou o primeiro acesso ao Central COP.\n\nDefina sua senha pessoal pelo link abaixo:\n'+DEFAULT_ORIGIN+'/#activate='+token+
   '\n\nO link expira em 30 minutos e só pode ser utilizado uma vez. Um novo link substitui o anterior.\nNunca compartilhe este link ou sua senha. Se não solicitou este acesso, ignore a mensagem.\n\nCentral COP — Escalonamentos'};
}

export function firstAccessHandler({admin,sendMail,enabled,defer}){
 return async req=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
   'Access-Control-Allow-Origin':DEFAULT_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS',
   'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.headers.get('origin')&&req.headers.get('origin')!==DEFAULT_ORIGIN)return reply({error:'Origem não autorizada'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'Método não autorizado'},405);
  if(!enabled)return reply({error:'Primeiro acesso ainda não disponível. Contate o administrador.'},503);
  try{
   const raw=await req.text();if(raw.length>4096)return reply({error:'Solicitação inválida'},400);
   const body=JSON.parse(raw);
   if(body.action==='request'){
    const login=typeof body.login==='string'?body.login.trim().toUpperCase():'';
    if(!/^[A-Z][A-Z0-9]{4,14}$/.test(login))return reply({error:'Informe uma matrícula válida.'},400);
    // Limites persistidos também para matrículas inexistentes, sem expor sua existência.
    const hash=await digest('first-access:'+login);
    const subject=hash.slice(0,8)+'-'+hash.slice(8,12)+'-'+hash.slice(12,16)+'-'+hash.slice(16,20)+'-'+hash.slice(20,32);
    await consumeLimit(admin,subject,'first-access-request',3,3600);
    await consumeLimit(admin,'00000000-0000-4000-8000-000000000058','first-access-global',60,3600);
    const token=hex(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await digest(token);
    const {data,error}=await admin.rpc('cop_reserve_first_access',{p_login:login,p_token_hash:tokenHash});
    if(error)throw Error('Reservation failed');
    if(data?.[0]){
     const entry=data[0];
     // A resposta pública não aguarda SMTP nem revela sucesso de entrega.
     defer((async()=>{
      try{
       await sendMail(firstAccessEmail(entry.email,token));
       await admin.from('cop_first_access').update({delivery:'sent'}).eq('user_id',entry.user_id).eq('token_hash',tokenHash);
      }catch{
       await admin.from('cop_first_access').update({delivery:'failed'}).eq('user_id',entry.user_id).eq('token_hash',tokenHash);
      }
     })());
    }
    return reply(generic);
   }
   if(body.action==='activate'){
    if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)||typeof body.password!=='string'||body.password.length<12||body.password.length>128)return reply({error:'Link inválido ou senha fora dos limites de 12 a 128 caracteres.'},400);
    await consumeLimit(admin,'00000000-0000-4000-8000-000000000058','first-access-activate',100,3600);
    const hash=await digest(body.token);
    const {data:entry,error}=await admin.from('cop_first_access').select('user_id').eq('token_hash',hash).maybeSingle();
    if(error)throw Error('Lookup failed');
    if(!entry)return reply({error:'Link inválido, expirado ou já utilizado.'},400);
    return await withAccountLock(admin,entry.user_id,async()=>{
     const {data:consumed,error:consumeError}=await admin.rpc('cop_consume_first_access',{p_user_id:entry.user_id,p_token_hash:hash});
     if(consumeError||consumed!==true)return reply({error:'Link inválido, expirado ou já utilizado.'},400);
     // Falhas deixam a conta bloqueada para operação e exigem novo link.
     await revokeSessions(admin,entry.user_id);
     const {error:passwordError}=await admin.auth.admin.updateUserById(entry.user_id,{password:body.password});
     if(passwordError)throw Error('Password update failed');
     await recordAudit(admin,entry.user_id,entry.user_id,'change_password');
     const {error:profileError}=await admin.from('cop_profiles').update({must_change_password:false}).eq('id',entry.user_id).eq('active',true).eq('role','viewer').select('id').single();
     if(profileError)throw Error('Profile update failed');
     return reply({success:true});
    });
   }
   return reply({error:'Solicitação inválida'},400);
  }catch(error){
   const status=[429,409].includes(error?.status)?error.status:503;
   return reply({error:status===429?'Aguarde antes de tentar novamente.':'Não foi possível concluir. Tente novamente ou solicite um novo link.'},status);
  }
 };
}
