// Único uso para ativar o administrador inicial sem enviar senha por arquivo/log.
import {createClient} from 'npm:@supabase/supabase-js@2.112.3';
import {DEFAULT_ORIGIN,recordAudit,revokeSessions,withAccountLock} from '../_shared/security.mjs';
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin');
 const allowed=!origin||origin===DEFAULT_ORIGIN;
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
  'Access-Control-Allow-Origin':DEFAULT_ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
 const reply=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers});
 if(!allowed)return reply({error:'Origem não autorizada'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Método não autorizado'},405);
 try{
  const body=await req.json();
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)||typeof body.password!=='string'||body.password.length<12||body.password.length>128)return reply({error:'Link inválido ou senha fora dos limites de 12 a 128 caracteres'},400);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.token))),b=>b.toString(16).padStart(2,'0')).join('');
  const admin=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userId,error}=await admin.rpc('cop_consume_initial_setup',{p_token_hash:hash});
  if(error||!userId)return reply({error:'Link inválido, expirado ou já utilizado'},400);
  return await withAccountLock(admin,userId,async()=>{
   const {error:passwordError}=await admin.auth.admin.updateUserById(userId,{password:body.password});
   if(passwordError)return reply({error:'Falha ao ativar. Solicite um novo link ao responsável pela implantação.'},500);
   await revokeSessions(admin,userId);
   const {error:profileError}=await admin.from('cop_profiles').update({must_change_password:false}).eq('id',userId).eq('role','admin').select('id').single();
   if(profileError)return reply({error:'Ativação pendente. Contate o responsável pela implantação.'},500);
   await recordAudit(admin,userId,userId,'change_password');
   return reply({success:true},200);
  });
 }catch{return reply({error:'Falha na ativação. Solicite um novo link se necessário.'},400);}
});
