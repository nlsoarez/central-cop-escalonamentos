-- CENTRAL COP | ESCALONAMENTOS
-- USAR SOMENTE EM PROJETO SUPABASE NOVO E INDEPENDENTE. NÃO EXECUTAR NO SIM.
begin;

create extension if not exists pgcrypto;

create table if not exists public.cop_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuário',
  role text not null default 'viewer' check (role in ('admin','viewer')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.cop_provision_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.cop_profiles(id,display_name,role,active)
  values(new.id,coalesce(nullif(split_part(new.email,'@',1),''),'Usuário'),'viewer',false)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists cop_auth_user_created on auth.users;
create trigger cop_auth_user_created after insert on auth.users
for each row execute function public.cop_provision_user();

insert into public.cop_profiles(id,display_name,role,active)
select id,coalesce(nullif(split_part(email,'@',1),''),'Usuário'),'viewer',false
from auth.users on conflict (id) do nothing;

create or replace function public.cop_is_active()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.cop_profiles where id=(select auth.uid()) and active)
$$;
create or replace function public.cop_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.cop_profiles where id=(select auth.uid()) and active and role='admin')
$$;

create table if not exists public.cop_contacts (
  id uuid primary key default gen_random_uuid(),
  cluster text not null check (cluster in ('RJ','ES','MG','CO','NE','NO','BA')),
  area text not null default '',
  cidade text not null default '',
  topologia text not null default '',
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  cargo text not null default '',
  nivel text not null default '',
  phone_e164 text not null check (phone_e164 ~ '^55[1-9][1-9]([2-9][0-9]{7}|9[0-9]{8})$'),
  phone_display text not null default '',
  notes text not null default '' check (char_length(notes)<=3000),
  scope text not null default 'local' check (scope in ('local','regional')),
  active boolean not null default true,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint cop_valid_range check (valid_from is null or valid_until is null or valid_from<=valid_until)
);

create unique index if not exists cop_contact_unique_logical
  on public.cop_contacts (
    cluster,lower(btrim(area)),lower(btrim(cidade)),lower(btrim(topologia)),
    lower(btrim(full_name)),lower(btrim(cargo)),lower(btrim(nivel))
  );
create index if not exists cop_contacts_region_idx on public.cop_contacts(cluster,area,cidade,topologia);
create index if not exists cop_contacts_updated_idx on public.cop_contacts(updated_at desc);

create table if not exists public.cop_import_batches (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 mode text not null check (mode in ('merge','replace_clusters','restore')),
 clusters text[] not null default '{}',
 row_count integer not null default 0,
 added integer not null default 0,
 changed integer not null default 0,
 removed integer not null default 0,
 before_snapshot jsonb not null default '[]'::jsonb
);
create index if not exists cop_import_batches_date_idx on public.cop_import_batches(created_at desc);

create table if not exists public.cop_contact_audit (
 id bigint generated always as identity primary key,
 contact_id uuid,
 actor uuid,
 event text not null check (event in ('INSERT','UPDATE','DELETE')),
 changed_at timestamptz not null default now(),
 before_value jsonb,
 after_value jsonb
);
create index if not exists cop_audit_contact_date_idx on public.cop_contact_audit(contact_id,changed_at desc);

create or replace function public.cop_audit_contact()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op='INSERT' then
    new.updated_by:=auth.uid();
    new.updated_at:=now();
    insert into public.cop_contact_audit(contact_id,actor,event,before_value,after_value)
      values(new.id,auth.uid(),'INSERT',null,to_jsonb(new));
    return new;
  elsif tg_op='UPDATE' then
    new.updated_by:=auth.uid();
    new.updated_at:=now();
    insert into public.cop_contact_audit(contact_id,actor,event,before_value,after_value)
      values(new.id,auth.uid(),'UPDATE',to_jsonb(old),to_jsonb(new));
    return new;
  else
    insert into public.cop_contact_audit(contact_id,actor,event,before_value,after_value)
      values(old.id,auth.uid(),'DELETE',to_jsonb(old),null);
    return old;
  end if;
end $$;

drop trigger if exists cop_contact_audit_trigger on public.cop_contacts;
create trigger cop_contact_audit_trigger before insert or update or delete
on public.cop_contacts for each row execute function public.cop_audit_contact();

alter table public.cop_profiles enable row level security;
alter table public.cop_contacts enable row level security;
alter table public.cop_import_batches enable row level security;
alter table public.cop_contact_audit enable row level security;

create policy cop_profiles_select on public.cop_profiles
for select to authenticated using (id=(select auth.uid()) or (select public.cop_is_admin()));
create policy cop_profiles_admin_update on public.cop_profiles
for update to authenticated using ((select public.cop_is_admin()))
with check ((select public.cop_is_admin()));

create policy cop_contacts_read on public.cop_contacts
for select to authenticated using ((select public.cop_is_active()));
create policy cop_contacts_insert on public.cop_contacts
for insert to authenticated with check ((select public.cop_is_admin()));
create policy cop_contacts_update on public.cop_contacts
for update to authenticated using ((select public.cop_is_admin()))
with check ((select public.cop_is_admin()));
create policy cop_contacts_delete on public.cop_contacts
for delete to authenticated using ((select public.cop_is_admin()));

create policy cop_import_batches_admin_select on public.cop_import_batches
for select to authenticated using ((select public.cop_is_admin()));
create policy cop_audit_admin_select on public.cop_contact_audit
for select to authenticated using ((select public.cop_is_admin()));

revoke all on public.cop_profiles,public.cop_contacts,public.cop_import_batches,public.cop_contact_audit from anon;
grant select,update on public.cop_profiles to authenticated;
grant select,insert,update,delete on public.cop_contacts to authenticated;
grant select on public.cop_import_batches,public.cop_contact_audit to authenticated;
grant usage,select on sequence public.cop_contact_audit_id_seq to authenticated;

-- Toda publicação ocorre em uma transação. A função executa validações no servidor.
create or replace function public.cop_publish_contacts(p_rows jsonb,p_mode text default 'merge')
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb;
  v_snapshot jsonb;
  v_clusters text[];
  v_existing uuid;
  v_seen uuid[] := array[]::uuid[];
  v_id uuid;
  v_added int := 0;
  v_changed int := 0;
  v_removed int := 0;
  v_phone text;
  v_cluster text;
  v_name text;
  v_area text;
  v_cidade text;
  v_topologia text;
  v_cargo text;
  v_nivel text;
  v_notes text;
  v_scope text;
  v_valid_from date;
  v_valid_until date;
  v_active boolean;
  v_match public.cop_contacts%rowtype;
  v_batch uuid;
begin
  if not public.cop_is_admin() then raise exception 'Sem permissão para importar'; end if;
  if p_mode not in ('merge','replace_clusters') then raise exception 'Modo inválido'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    raise exception 'A lista deve conter entre 1 e 2000 contatos';
  end if;
  perform pg_advisory_xact_lock(1836472101);
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_snapshot from public.cop_contacts c;
  select array_agg(distinct item->>'cluster') into v_clusters
  from jsonb_array_elements(p_rows) as item;
  if exists(select 1 from unnest(v_clusters) c where c is null or c not in ('RJ','ES','MG','CO','NE','NO','BA'))
  then raise exception 'Cluster inválido ou não informado'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_cluster:=v_row->>'cluster';
    v_name:=btrim(coalesce(v_row->>'full_name',''));
    v_area:=btrim(coalesce(v_row->>'area',''));
    v_cidade:=btrim(coalesce(v_row->>'cidade',''));
    v_topologia:=btrim(coalesce(v_row->>'topologia',''));
    v_cargo:=btrim(coalesce(v_row->>'cargo',''));
    v_nivel:=btrim(coalesce(v_row->>'nivel',''));
    v_phone:=v_row->>'phone_e164';
    v_notes:=coalesce(v_row->>'notes','');
    v_scope:=coalesce(v_row->>'scope','local');
    v_active:=coalesce((v_row->>'active')::boolean,true);
    v_valid_from:=nullif(v_row->>'valid_from','')::date;
    v_valid_until:=nullif(v_row->>'valid_until','')::date;
    if v_cluster is null or v_cluster not in ('RJ','ES','MG','CO','NE','NO','BA') or length(v_name)<2
      or v_phone is null or v_phone !~ '^55[1-9][1-9]([2-9][0-9]{7}|9[0-9]{8})$'
      or v_scope not in ('local','regional')
      or length(v_notes)>3000
      or (v_valid_from is not null and v_valid_until is not null and v_valid_from>v_valid_until)
    then raise exception 'Contato inválido na importação'; end if;
    select * into v_match from public.cop_contacts c
      where c.cluster=v_cluster and lower(btrim(c.area))=lower(v_area)
      and lower(btrim(c.cidade))=lower(v_cidade)
      and lower(btrim(c.topologia))=lower(v_topologia)
      and lower(btrim(c.full_name))=lower(v_name)
      and lower(btrim(c.cargo))=lower(v_cargo)
      and lower(btrim(c.nivel))=lower(v_nivel)
      limit 1;
    if not found then
      insert into public.cop_contacts(cluster,area,cidade,topologia,full_name,cargo,nivel,phone_e164,phone_display,notes,scope,active,valid_from,valid_until)
      values(v_cluster,v_area,v_cidade,v_topologia,v_name,v_cargo,v_nivel,v_phone,coalesce(v_row->>'phone_display',''),v_notes,v_scope,v_active,v_valid_from,v_valid_until)
      returning id into v_id;
      v_added:=v_added+1;
    else
      v_id:=v_match.id;
      if v_match.phone_e164 is distinct from v_phone
        or v_match.phone_display is distinct from coalesce(v_row->>'phone_display','')
        or v_match.notes is distinct from v_notes
        or v_match.scope is distinct from v_scope
        or v_match.active is distinct from v_active
        or v_match.valid_from is distinct from v_valid_from
        or v_match.valid_until is distinct from v_valid_until
      then
        update public.cop_contacts set
          phone_e164=v_phone,phone_display=coalesce(v_row->>'phone_display',''),
          notes=v_notes,scope=v_scope,active=v_active,
          valid_from=v_valid_from,valid_until=v_valid_until
        where id=v_id;
        v_changed:=v_changed+1;
      end if;
    end if;
    if v_id=any(v_seen) then raise exception 'Contato duplicado no arquivo'; end if;
    v_seen:=array_append(v_seen,v_id);
  end loop;

  if p_mode='replace_clusters' then
    select count(*) into v_removed from public.cop_contacts
    where cluster=any(v_clusters) and not (id=any(v_seen));
    delete from public.cop_contacts where cluster=any(v_clusters) and not(id=any(v_seen));
  end if;
  insert into public.cop_import_batches(created_by,mode,clusters,row_count,added,changed,removed,before_snapshot)
  values(auth.uid(),p_mode,v_clusters,jsonb_array_length(p_rows),v_added,v_changed,v_removed,v_snapshot)
  returning id into v_batch;
  return jsonb_build_object('batch_id',v_batch,'added',v_added,'changed',v_changed,'removed',v_removed);
end $$;

create or replace function public.cop_restore_import(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_snapshot jsonb; v_current jsonb; v_batch uuid; v_rows int;
begin
  if not public.cop_is_admin() then raise exception 'Sem permissão para restaurar'; end if;
  perform pg_advisory_xact_lock(1836472101);
  select before_snapshot into v_snapshot from public.cop_import_batches where id=p_batch_id;
  if not found then raise exception 'Versão não encontrada'; end if;
  select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_current from public.cop_contacts c;
  delete from public.cop_contacts;
  insert into public.cop_contacts(id,cluster,area,cidade,topologia,full_name,cargo,nivel,phone_e164,phone_display,notes,scope,active,valid_from,valid_until,created_at)
  select id,cluster,area,cidade,topologia,full_name,cargo,nivel,phone_e164,phone_display,notes,scope,active,valid_from,valid_until,created_at
  from jsonb_populate_recordset(null::public.cop_contacts,v_snapshot);
  select count(*) into v_rows from public.cop_contacts;
  insert into public.cop_import_batches(created_by,mode,clusters,row_count,added,changed,removed,before_snapshot)
  values(auth.uid(),'restore',array['RJ','ES','MG','CO','NE','NO','BA'],v_rows,v_rows,0,0,v_current) returning id into v_batch;
  return jsonb_build_object('batch_id',v_batch,'restored',v_rows);
end $$;

revoke execute on function public.cop_provision_user() from public;
revoke execute on function public.cop_is_active() from public;
revoke execute on function public.cop_is_admin() from public;
revoke execute on function public.cop_publish_contacts(jsonb,text) from public;
revoke execute on function public.cop_restore_import(uuid) from public;
grant execute on function public.cop_is_active() to authenticated;
grant execute on function public.cop_is_admin() to authenticated;
grant execute on function public.cop_publish_contacts(jsonb,text) to authenticated;
grant execute on function public.cop_restore_import(uuid) to authenticated;

commit;
