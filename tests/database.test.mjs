import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('migrações, RLS, sessões e importações em PostgreSQL isolado',async t=>{
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text);
 create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now());
 create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
 $$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;
 `);
 const directory=new URL('../supabase/migrations/',import.meta.url);
 for(const name of (await readdir(directory)).filter(n=>n.endsWith('.sql')).sort()){
  let sql=await readFile(new URL(name,directory),'utf8');
  // gen_random_uuid() é nativo deste PostgreSQL; pgcrypto é extensão do Supabase.
  sql=sql.replace('create extension if not exists pgcrypto;','');
  await db.exec(sql);
 }
 const admin='10000000-0000-4000-8000-000000000001';
 const viewer='10000000-0000-4000-8000-000000000002';
 const adminSession='20000000-0000-4000-8000-000000000001';
 const viewerSession='20000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.users values ($1,$2),($3,$4)',[admin,'admin@example.invalid',viewer,'viewer@example.invalid']);
 await db.query("update public.cop_profiles set active=true, role=case when id=$1 then 'admin' else 'viewer' end",[admin]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[adminSession,admin,viewerSession,viewer]);
 async function as(role,id,session){
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,session_id:session})]);
  await db.exec('set role '+role);
 }
 async function root(){await db.exec('reset role');}
 const contact=(cluster,name='Pessoa fictícia')=>({cluster,full_name:name,phone_e164:cluster==='MG'?'5531999990001':'5521999990001',area:'',cidade:'',topologia:'',cargo:'',nivel:''});
 const publish=async(rows,mode='merge')=>(await db.query('select public.cop_publish_contacts($1::jsonb,$2) result',[JSON.stringify(rows),mode])).rows[0].result;
 await as('authenticated',admin,adminSession);
 await publish([contact('RJ'),contact('MG')]);

 await t.test('anônimo não lê contatos nem importa',async()=>{
  await as('anon',null,null);
  await assert.rejects(db.query('select * from public.cop_contacts'),/permission denied/);
  await assert.rejects(publish([contact('RJ')]),/permission denied/);
 });
 await t.test('viewer vê apenas o próprio perfil e não pode elevar privilégios',async()=>{
  await as('authenticated',viewer,viewerSession);
  assert.equal((await db.query('select * from public.cop_profiles')).rows.length,1);
  await assert.rejects(db.query("update public.cop_profiles set role='admin' where id=$1",[viewer]),/permission denied/);
  await assert.rejects(publish([contact('RJ')]),/Sem permissão/);
  assert.equal((await db.query('select * from public.cop_user_audit')).rows.length,0);
 });
 await t.test('troca obrigatória e suspensão são aplicadas pelo banco',async()=>{
  await root();await db.query('update public.cop_profiles set must_change_password=true where id=$1',[viewer]);
  await as('authenticated',viewer,viewerSession);
  assert.equal((await db.query('select * from public.cop_contacts')).rows.length,0);
  await root();await db.query('update public.cop_profiles set must_change_password=false,active=false where id=$1',[viewer]);
  await as('authenticated',viewer,viewerSession);
  assert.equal((await db.query('select * from public.cop_contacts')).rows.length,0);
  await root();await db.query('update public.cop_profiles set active=true where id=$1',[viewer]);
 });
 await t.test('JWT revogado não recupera acesso ao reativar a conta',async()=>{
  await as('service_role',null,null);
  await db.query('select public.cop_revoke_sessions($1)',[viewer]);
  await as('authenticated',viewer,viewerSession);
  assert.equal((await db.query('select * from public.cop_contacts')).rows.length,0);
  assert.equal((await db.query('select * from public.cop_profiles')).rows.length,0);
  await root();await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[viewerSession,viewer]);
 });
 await t.test('sessão expira após 12 horas mesmo com token renovado',async()=>{
  await root();await db.query("update auth.sessions set created_at=now()-interval '13 hours' where id=$1",[viewerSession]);
  await as('authenticated',viewer,viewerSession);
  assert.equal((await db.query('select public.cop_session_valid() ok')).rows[0].ok,false);
  await root();await db.query('update auth.sessions set created_at=now() where id=$1',[viewerSession]);
 });
 await t.test('substituição e restauração parcial preservam outras regiões',async()=>{
  await as('authenticated',admin,adminSession);
  const result=await publish([contact('RJ','Nova pessoa')],'replace_clusters');
  await publish([contact('MG','Nova pessoa MG')],'replace_clusters');
  await db.query('select public.cop_restore_import($1)',[result.batch_id]);
  const rows=(await db.query('select cluster,full_name from public.cop_contacts order by cluster')).rows;
  assert.deepEqual(rows,[{cluster:'MG',full_name:'Nova pessoa MG'},{cluster:'RJ',full_name:'Pessoa fictícia'}]);
 });
 await t.test('duplicidades e dados inválidos revertem a importação inteira',async()=>{
  await as('authenticated',admin,adminSession);
  await assert.rejects(publish([contact('BA'),contact('BA')]),/duplicado/);
  await assert.rejects(publish([contact('ES'),{...contact('RJ'),phone_e164:'999'}]),/inválido/);
  assert.equal((await db.query("select * from public.cop_contacts where cluster in ('BA','ES')")).rows.length,0);
 });
 await t.test('contatos suspensos são visíveis apenas ao administrador',async()=>{
  await as('authenticated',admin,adminSession);
  await db.query("update public.cop_contacts set active=false where cluster='RJ'");
  assert.equal((await db.query('select * from public.cop_contacts')).rows.length,2);
  await as('authenticated',viewer,viewerSession);
  assert.deepEqual((await db.query('select cluster from public.cop_contacts')).rows,[{cluster:'MG'}]);
 });
 await t.test('nem administrador pode contornar os fluxos de perfil via REST',async()=>{
  await as('authenticated',admin,adminSession);
  await assert.rejects(db.query('update public.cop_profiles set must_change_password=false'),/permission denied/);
  await assert.rejects(db.query('select public.cop_revoke_sessions($1)',[viewer]),/permission denied/);
  await assert.rejects(db.query('select public.cop_consume_limit($1,$2,5,900)',[admin,'change_password']),/permission denied/);
 });
 await t.test('limite compartilhado permite cinco tentativas e bloqueia a sexta',async()=>{
  await as('service_role',null,null);
  for(let i=0;i<6;i++)assert.equal((await db.query('select public.cop_consume_limit($1,$2,5,900) ok',[viewer,'change_password'])).rows[0].ok,i<5);
 });
 await t.test('operações concorrentes da conta são serializadas',async()=>{
  await as('service_role',null,null);
  const token=(await db.query('select public.cop_acquire_account_lock($1) token',[viewer])).rows[0].token;
  assert.ok(token);
  assert.equal((await db.query('select public.cop_acquire_account_lock($1) token',[viewer])).rows[0].token,null);
  await db.query('select public.cop_release_account_lock($1,$2)',[viewer,admin]);
  assert.equal((await db.query('select public.cop_acquire_account_lock($1) token',[viewer])).rows[0].token,null);
  await db.query('select public.cop_release_account_lock($1,$2)',[viewer,token]);
  assert.ok((await db.query('select public.cop_acquire_account_lock($1) token',[viewer])).rows[0].token);
 });
 await t.test('lista de analistas é privada e restrita ao administrador',async()=>{
  await root();await db.query("insert into public.cop_pending_roster(login_id,display_name) values('F9900001','Pessoa Sintética')");
  await as('authenticated',viewer,viewerSession);
  assert.equal((await db.query('select * from public.cop_pending_roster')).rows.length,0);
  await as('authenticated',admin,adminSession);
  assert.equal((await db.query('select * from public.cop_pending_roster')).rows.length,1);
 });
 await t.test('token de ativação expira, é de único uso e não pode ser consumido pelo usuário',async()=>{
  await root();await db.query('update public.cop_profiles set must_change_password=true where id=$1',[admin]);
  await db.query("insert into public.cop_initial_setup(user_id,token_hash,expires_at) values($1,$2,now()+interval '1 hour')",[admin,'a'.repeat(64)]);
  await as('authenticated',viewer,viewerSession);
  await assert.rejects(db.query('select public.cop_consume_initial_setup($1) id',['a'.repeat(64)]),/permission denied/);
  await as('service_role',null,null);
  assert.equal((await db.query('select public.cop_consume_initial_setup($1) id',['a'.repeat(64)])).rows[0].id,admin);
  assert.equal((await db.query('select public.cop_consume_initial_setup($1) id',['a'.repeat(64)])).rows[0].id,null);
  await root();await db.query("update public.cop_initial_setup set consumed_at=null,expires_at=now()-interval '1 hour'");
  await as('service_role',null,null);
  assert.equal((await db.query('select public.cop_consume_initial_setup($1) id',['a'.repeat(64)])).rows[0].id,null);
 });
});
