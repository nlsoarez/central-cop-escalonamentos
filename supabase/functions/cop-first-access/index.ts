import {createClient} from 'npm:@supabase/supabase-js@2.112.3';
import nodemailer from 'npm:nodemailer@10.2.1';
import {firstAccessHandler,gmailOptions} from '../_shared/first-access.mjs';
const enabled=Deno.env.get('COP_FIRST_ACCESS_ENABLED')==='true';
const admin=createClient(Deno.env.get('SUPABASE_URL')||'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
// Lazy initialization: configuração inválida não derruba o dispatcher de outras funções.
const sendMail=async message=>{
 const transport=nodemailer.createTransport(gmailOptions(Deno.env.get('COP_GMAIL_APP_PASSWORD')));
 try{
  const result=await transport.sendMail(message);
  if(!result.accepted?.length||result.rejected?.length)throw Error('Delivery refused');
 }finally{transport.close();}
};
const handler=firstAccessHandler({admin,sendMail,enabled,defer:promise=>EdgeRuntime.waitUntil(promise)});
Deno.serve(async req=>{
 // Checagem de SMTP sem envio, disponível somente à chave privada do serviço.
 if(req.headers.get('x-cop-mail-check')==='verify'){
  if(req.method!=='POST'||req.headers.get('authorization')!=='Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))return Response.json({error:'Não autorizado'},{status:403,headers:{'Cache-Control':'no-store'}});
  let transport;
  try{transport=nodemailer.createTransport(gmailOptions(Deno.env.get('COP_GMAIL_APP_PASSWORD')));await transport.verify();return Response.json({smtp:true,sent:false},{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({error:'Falha ao validar SMTP'},{status:503,headers:{'Cache-Control':'no-store'}});}
  finally{transport?.close();}
 }
 return handler(req);
});
