// Troca autenticada: senha atual, conta ativa, sessão real e limite compartilhado.
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { DEFAULT_ORIGIN, assertSession, consumeLimit, recordAudit, revokeSessions, withAccountLock } from '../_shared/security.mjs';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const origins = new Set([DEFAULT_ORIGIN,...(Deno.env.get('COP_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean)]);
  const allowed = !origin || origins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const headers = {
    'Access-Control-Allow-Origin':origin&&allowed?origin:DEFAULT_ORIGIN,
    'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store','Content-Type':'application/json'
  };
  const reply=(data:unknown,status:number)=>new Response(JSON.stringify(data),{status,headers});
  if(req.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers});
  if(!allowed)return reply({error:'Origem não autorizada'},403);
  if(req.method!=='POST')return reply({error:'Método não autorizado'},405);
  const url=Deno.env.get('SUPABASE_URL')||'';
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const publicKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('COP_SUPABASE_PUBLISHABLE_KEY')||'';
  if(!url||!key||!publicKey)return reply({error:'Serviço não configurado'},503);
  try {
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const bearer=(req.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
    if(!bearer)return reply({error:'Sessão necessária'},401);
    const {data,error}=await admin.auth.getUser(bearer);
    if(error||!data.user?.email)return reply({error:'Sessão inválida'},401);
    const user=data.user;
    await assertSession(admin,bearer,user.id);
    await consumeLimit(admin,user.id,'change_password',5,900);
    return await withAccountLock(admin,user.id,async()=>{
      // Uma suspensão administrativa impede também trocar senhas com JWT antigo.
      const {data:profile,error:profileError}=await admin.from('cop_profiles').select('active').eq('id',user.id).single();
      if(profileError||!profile?.active)return reply({error:'Acesso não autorizado'},403);
      const body=await req.json();
      const current=typeof body.currentPassword==='string'?body.currentPassword:'';
      const desired=typeof body.newPassword==='string'?body.newPassword:'';
      if(!current||current.length>128||desired.length<12||desired.length>128||desired===current){
        return reply({error:'A nova senha deve ter de 12 a 128 caracteres e ser diferente da anterior'},400);
      }
      const authClient=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const check=await authClient.auth.signInWithPassword({email:user.email,password:current});
      if(check.error)return reply({error:'Não foi possível confirmar a senha atual'},400);
      // Encerrar também a sessão temporária criada para conferir a senha.
      try {
        const {error:changeError}=await admin.auth.admin.updateUserById(user.id,{password:desired});
        if(changeError)return reply({error:'Não foi possível alterar a senha'},400);
        await revokeSessions(admin,user.id);
        const {error:releaseError}=await admin.from('cop_profiles').update({must_change_password:false}).eq('id',user.id).select('id').single();
        if(releaseError)return reply({error:'Senha alterada, liberação pendente. Contate o administrador.'},500);
        await recordAudit(admin,user.id,user.id,'change_password');
        return reply({success:true,reauthenticate:true},200);
      } finally { await authClient.auth.signOut({scope:'local'}); }
    });
  } catch(error) {
    const ex=error as Error & {status?:number};
    const status=typeof ex.status==='number'?ex.status:error instanceof SyntaxError?400:500;
    return reply({error:status>=500?'Falha interna na operação':status===400?'Solicitação inválida':ex.message},status);
  }
});
