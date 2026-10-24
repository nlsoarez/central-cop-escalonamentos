-- Projeto CENTRAL COP — executar APENAS no Supabase novo e independente.
-- O SIM não utiliza nem deve receber esta migração.
begin;

alter table public.cop_profiles
 add column if not exists login_id text,
 add column if not exists must_change_password boolean not null default false;

create unique index if not exists cop_profiles_login_id_unique
 on public.cop_profiles (upper(btrim(login_id)))
 where login_id is not null;

alter table public.cop_profiles
 drop constraint if exists cop_profiles_login_id_format;
alter table public.cop_profiles
 add constraint cop_profiles_login_id_format
 check (login_id is null or login_id ~ '^[A-Z][A-Z0-9]{4,14}$');

-- O usuário que recebeu senha provisória ainda NÃO pode consultar contatos.
-- Um login válido, isoladamente, não dá acesso a recursos operacionais.
create or replace function public.cop_is_active()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.cop_profiles
   where id = (select auth.uid()) and active and not must_change_password
 )
$$;

create or replace function public.cop_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.cop_profiles
   where id = (select auth.uid()) and active and role = 'admin' and not must_change_password
 )
$$;

-- Usuário vê apenas o próprio perfil; administrador vê os usuários ativos
-- e inativos (política já criada em 001_initial.sql).
-- Nenhum leitor comum pode editar dados da própria matrícula, função ou papel.
revoke all on public.cop_profiles from anon;
grant select on public.cop_profiles to authenticated;
grant update on public.cop_profiles to authenticated;

commit;
