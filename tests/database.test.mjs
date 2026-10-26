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
 await t.test('viewer não altera contatos, lê lista privada ou executa RPC privilegiada',async()=>{
  await as('authenticated',viewer,viewerSession);
  assert.equal((await db.query('select * from public.cop_pending_roster')).rows.length,0);
  assert.equal((await db.query('select * from public.cop_import_batches')).rows.length,0);
  assert.equal((await db.query('select * from public.cop_contact_audit')).rows.length,0);
  assert.equal((await db.query("update public.cop_contacts set notes='unauthorized' returning id")).rows.length,0);
  assert.equal((await db.query('delete from public.cop_contacts returning id')).rows.length,0);
  await assert.rejects(db.query("insert into public.cop_contacts(cluster,full_name,phone_e164) values('RJ','Unauthorized','5521999990001')"),/row-level security/);
  await assert.rejects(db.query('select public.cop_revoke_sessions($1)',[admin]),/permission denied/);
  await assert.rejects(db.query('select public.cop_consume_initial_setup($1)',['0'.repeat(64)]),/permission denied/);
  await assert.rejects(db.query('select public.cop_acquire_account_lock($1)',[admin]),/permission denied/);
  await as('anon',null,null);
  for(const table of ['cop_profiles','cop_pending_roster','cop_user_audit','cop_import_batches','cop_contact_audit','cop_initial_setup','cop_request_limits','cop_account_locks']){
   await assert.rejects(db.query('select * from public.'+table),/permission denied/);
  }
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
 await t.test('ocorrências repetidas da planilha são gravadas e reimportadas sem consolidação',async()=>{
  await root();await db.query('update public.cop_profiles set must_change_password=false where id=$1',[admin]);
  await as('authenticated',admin,adminSession);
  const repeated=[1,2,3].map(source_occurrence=>({...contact('NO','Gestor sintético repetido'),source_occurrence,notes:'Origem: Norte, linha '+(source_occurrence+2)}));
  const first=await publish(repeated);
  assert.equal(first.added,3);
  assert.deepEqual((await db.query("select source_occurrence from public.cop_contacts where cluster='NO' order by source_occurrence")).rows.map(r=>r.source_occurrence),[1,2,3]);
  const second=await publish(repeated);
  assert.equal(second.added,0);assert.equal(second.changed,0);
  const changed=await publish(repeated.map(r=>r.source_occurrence===2?{...r,phone_e164:'5591999990002'}:r));
  assert.equal(changed.added,0);assert.equal(changed.changed,1);
  await db.query('select public.cop_restore_import($1)',[changed.batch_id]);
  const restored=(await db.query("select source_occurrence,phone_e164 from public.cop_contacts where cluster='NO' order by source_occurrence")).rows;
  assert.equal(restored.length,3);assert.ok(restored.every(r=>r.phone_e164===repeated[0].phone_e164));
  await assert.rejects(publish([{...contact('BA'),source_occurrence:0}]),/inválido/);
  await assert.rejects(publish([repeated[0],repeated[0]]),/duplicado/);
  assert.equal((await db.query("select count(*) from public.cop_contacts where cluster='NO'")).rows[0].count,3);
 });
 await t.test('relatos são privados, não alteram contatos e apenas administrador pode concluir',async()=>{
  await root();
  const target=(await db.query("select id,full_name from public.cop_contacts where active limit 1")).rows[0];
  await as('authenticated',viewer,viewerSession);
  const result=await db.query("select public.cop_submit_contact_report($1,'left_role','Pessoa não atua mais nesta função.') id",[target.id]);
  const report=result.rows[0].id;
  assert.equal((await db.query('select count(*) from public.cop_contact_reports')).rows[0].count,1);
  await assert.rejects(db.query("update public.cop_contact_reports set status='resolved' where id=$1",[report]),/permission denied/);
  await assert.rejects(db.query('select public.cop_review_contact_report($1,$2)',[report,'fake']),/restrito/);
  await assert.rejects(db.query("select public.cop_submit_contact_report($1,'invalid','Descrição suficiente')",[target.id]),/motivo/);
  await assert.rejects(db.query("select public.cop_submit_contact_report($1,'other','curto')",[target.id]),/descrição/);
  await as('authenticated',admin,adminSession);
  assert.equal((await db.query('select contact_name from public.cop_contact_reports where id=$1',[report])).rows[0].contact_name,target.full_name);
  const own=(await db.query("select public.cop_submit_contact_report($1,'contact_changed','Telefone precisa ser atualizado.') id",[target.id])).rows[0].id;
  await db.query('select public.cop_review_contact_report($1,$2)',[report,'Cadastro conferido pela administração.']);
  await assert.rejects(db.query('select public.cop_review_contact_report($1,$2)',[report,'again']),/já foi analisada/);
  await as('authenticated',viewer,viewerSession);
  assert.equal((await db.query('select count(*) from public.cop_contact_reports where id=$1',[own])).rows[0].count,0);
  assert.equal((await db.query('select status,review_note from public.cop_contact_reports where id=$1',[report])).rows[0].status,'resolved');
  assert.equal((await db.query('select full_name from public.cop_contacts where id=$1',[target.id])).rows[0].full_name,target.full_name);
  await as('anon',null,null);
  await assert.rejects(db.query('select * from public.cop_contact_reports'),/permission denied/);
  await assert.rejects(db.query("select public.cop_submit_contact_report($1,'other','Descrição suficiente')",[target.id]),/permission denied/);
 });
 await t.test('relatos exigem sessão válida e impõem limite por usuário',async()=>{
  await root();const target=(await db.query('select id from public.cop_contacts where active limit 1')).rows[0].id;
  await as('authenticated',viewer,'29999999-0000-4000-8000-000000000001');
  await assert.rejects(db.query("select public.cop_submit_contact_report($1,'other','Descrição suficiente')",[target]),/não autorizado/);
  await as('authenticated',viewer,viewerSession);
  for(let i=0;i<9;i++)await db.query("select public.cop_submit_contact_report($1,'other','Outra informação sobre o contato.')",[target]);
  await assert.rejects(db.query("select public.cop_submit_contact_report($1,'other','Mais uma informação sobre o contato.')",[target]),/Limite/);
 });
 await t.test('promoção por operador confere matrícula e nome, é auditada e não reativa contas',async()=>{
  await root();
  await db.query("update public.cop_profiles set login_id='F9900001',display_name='Operador Sintético' where id=$1",[admin]);
  await db.query("update public.cop_profiles set login_id='F9900002',display_name='Analista Sintético' where id=$1",[viewer]);
  const template=await readFile(new URL('../deploy/promote-admin.sql',import.meta.url),'utf8');
  const sql=name=>template.replaceAll(":'target_login'","'f9900002'").replaceAll(":'target_name'",name).replaceAll(":'operator_login'","'F9900001'");
  await assert.rejects(db.exec(sql("'Outra Pessoa'")),/não confere/);await db.exec('rollback');
  assert.equal((await db.query('select role from public.cop_profiles where id=$1',[viewer])).rows[0].role,'viewer');
  await db.query('update public.cop_profiles set active=false where id=$1',[viewer]);
  await assert.rejects(db.exec(sql("'Analista Sintético'")),/inativa/);await db.exec('rollback');
  await db.query('update public.cop_profiles set active=true where id=$1',[viewer]);
  await db.exec(sql("'Analista Sintético'"));await db.exec(sql("'Analista Sintético'"));
  assert.equal((await db.query('select role from public.cop_profiles where id=$1',[viewer])).rows[0].role,'admin');
  assert.equal((await db.query("select count(*) from public.cop_user_audit where target=$1 and event='promote_admin'",[viewer])).rows[0].count,1);
  await db.query("update public.cop_profiles set role='viewer' where id=$1",[viewer]);
 });
 await t.test('restauração de snapshot antigo sem ocorrência continua compatível',async()=>{
  await as('authenticated',admin,adminSession);
  await publish([contact('ES','Gestor legado')]);
  const update=await publish([{...contact('ES','Gestor legado'),phone_e164:'5527999990002'}]);
  await root();
  await db.query("update public.cop_import_batches set before_snapshot=(select jsonb_agg(item-'source_occurrence') from jsonb_array_elements(before_snapshot) item) where id=$1",[update.batch_id]);
  await as('authenticated',admin,adminSession);
  await db.query('select public.cop_restore_import($1)',[update.batch_id]);
  const restored=(await db.query("select source_occurrence,phone_e164 from public.cop_contacts where cluster='ES'")).rows[0];
  assert.equal(restored.source_occurrence,1);assert.equal(restored.phone_e164,contact('ES').phone_e164);
 });
});
