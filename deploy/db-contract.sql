-- Contrato de claims do PostgREST moderno na stack própria.
-- Não executar em bancos de terceiros ou de outros projetos.
create or replace function auth.jwt() returns jsonb
language sql stable set search_path = '' as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
create or replace function auth.uid() returns uuid
language sql stable set search_path = '' as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
   auth.jwt()->>'sub')::uuid
$$;
revoke all on function auth.jwt() from public;
grant execute on function auth.jwt() to anon,authenticated,service_role,supabase_auth_admin;
-- Aplicam-se somente a objetos criados pelas migrações deste projeto.
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant all on sequences to service_role;
