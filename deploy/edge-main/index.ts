// Dispatcher exclusivo das funções do Central COP. HS256 legado desta stack.
const names=new Set(['cop-manage-users','cop-change-password','cop-initial-setup','cop-first-access']);
const decode=(part:string)=>Uint8Array.from(atob(part.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('JWT_SECRET')), {name:'HMAC',hash:'SHA-256'},false,['verify']);
Deno.serve(async(req:Request)=>{
 const name=new URL(req.url).pathname.split('/')[1];
 if(!names.has(name))return Response.json({error:'Não encontrado'},{status:404});
 if(req.method!=='OPTIONS'){
  try{
   const token=(req.headers.get('authorization')||'').match(/^Bearer\s+(\S+)$/i)?.[1];
   const parts=token?.split('.');if(!parts||parts.length!==3)throw Error('Token');
   const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
   const payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));
   if(header.alg!=='HS256'||!Number.isFinite(payload.exp)||payload.exp<=Date.now()/1000)throw Error('Token');
   if(!await crypto.subtle.verify('HMAC',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('Token');
  }catch{return Response.json({error:'Sessão inválida'},{status:401});}
 }
 try{
  const worker=await EdgeRuntime.userWorkers.create({servicePath:'/home/deno/functions/'+name,
   memoryLimitMb:128,workerTimeoutMs:60000,cpuTimeSoftLimitMs:10000,cpuTimeHardLimitMs:15000,
   noModuleCache:false,envVars:Object.entries(Deno.env.toObject())});
  return await worker.fetch(req);
 }catch{return Response.json({error:'Serviço temporariamente indisponível'},{status:503});}
});
