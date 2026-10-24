-- Aplicar somente ao backend NOVO do Central COP, após 001 e 002.
begin;

-- Apenas as funções administrativas com service_role podem alterar perfis.
drop policy if exists cop_profiles_admin_update on public.cop_profiles;
revoke update on public.cop_profiles from authenticated;

-- JWT assinado continua existindo após logout: conferir a sessão no servidor.
-- Limite absoluto de 12 horas também vale para tokens renovados.
create or replace function public.cop_session_valid()
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.sessions s
   where s.id::text = (select auth.jwt()->>'session_id')
     and s.user_id = (select auth.uid())
     and s.created_at > now() - interval '12 hours')
$$;
revoke all on function public.cop_session_valid() from public;
grant execute on function public.cop_session_valid() to authenticated;

create or replace function public.cop_is_active()
returns boolean language sql stable security definer set search_path = '' as $$
 select public.cop_session_valid() and exists(select 1 from public.cop_profiles
 where id=(select auth.uid()) and active and not must_change_password)
$$;
create or replace function public.cop_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
 select public.cop_is_active() and exists(select 1 from public.cop_profiles
 where id=(select auth.uid()) and role='admin')
$$;

drop policy cop_profiles_select on public.cop_profiles;
create policy cop_profiles_select on public.cop_profiles for select to authenticated
 using ((id=(select auth.uid()) and (select public.cop_session_valid())) or (select public.cop_is_admin()));
drop policy cop_contacts_read on public.cop_contacts;
create policy cop_contacts_read on public.cop_contacts for select to authenticated
 using ((select public.cop_is_active()) and
   ((active and (valid_from is null or valid_from <= current_date)
     and (valid_until is null or valid_until >= current_date)) or (select public.cop_is_admin())));

-- Revoga refresh e access via verificação de auth.sessions nas RLS/funções.
create or replace function public.cop_revoke_sessions(p_user_id uuid)
returns void language sql security definer set search_path = '' as $$
 delete from auth.sessions where user_id=p_user_id
$$;
revoke all on function public.cop_revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.cop_revoke_sessions(uuid) to service_role;

create table public.cop_user_audit (
 id bigint generated always as identity primary key,
 actor uuid not null, target uuid not null,
 event text not null check(event in ('create','reset','activate','deactivate','change_password')),
 created_at timestamptz not null default now()
);
alter table public.cop_user_audit enable row level security;
revoke all on public.cop_user_audit from anon, authenticated;
grant select on public.cop_user_audit to authenticated;
create policy cop_user_audit_read on public.cop_user_audit for select to authenticated
 using ((select public.cop_is_admin()));
grant all on public.cop_user_audit to service_role;
grant usage, select on sequence public.cop_user_audit_id_seq to service_role;

-- Contador atômico compartilhado entre instâncias, sem senhas, nomes ou IPs.
create table public.cop_request_limits (
 subject uuid not null, action text not null, bucket bigint not null, attempts integer not null,
 primary key(subject, action, bucket)
);
alter table public.cop_request_limits enable row level security;
revoke all on public.cop_request_limits from public, anon, authenticated;
create or replace function public.cop_consume_limit(p_subject uuid,p_action text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_bucket bigint; v_count integer;
begin
 if p_limit not between 1 and 100 or p_window_seconds not between 1 and 3600 then
   raise exception 'Invalid limit';
 end if;
 v_bucket := floor(extract(epoch from now()) / p_window_seconds)::bigint;
 delete from public.cop_request_limits where bucket < floor(extract(epoch from now()) / p_window_seconds)::bigint - 2 and action=p_action;
 insert into public.cop_request_limits(subject,action,bucket,attempts)
 values(p_subject,p_action,v_bucket,1)
 on conflict(subject,action,bucket) do update set attempts=public.cop_request_limits.attempts+1
 returning attempts into v_count;
 return v_count <= p_limit;
end $$;
revoke all on function public.cop_consume_limit(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.cop_consume_limit(uuid,text,integer,integer) to service_role;

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
  lock table public.cop_contacts in share row exclusive mode;
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


-- Restaurar somente os clusters da publicação escolhida.
create or replace function public.cop_restore_import(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_snapshot jsonb; v_current jsonb; v_clusters text[]; v_batch uuid; v_rows int;
begin
 if not public.cop_is_admin() then raise exception 'Sem permissão para restaurar'; end if;
 perform pg_advisory_xact_lock(1836472101);
 lock table public.cop_contacts in share row exclusive mode;
 select before_snapshot,clusters into v_snapshot,v_clusters from public.cop_import_batches where id=p_batch_id;
 if not found then raise exception 'Versão não encontrada'; end if;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into v_current from public.cop_contacts c;
 delete from public.cop_contacts where cluster=any(v_clusters);
 insert into public.cop_contacts(id,cluster,area,cidade,topologia,full_name,cargo,nivel,phone_e164,phone_display,notes,scope,active,valid_from,valid_until,created_at)
 select id,cluster,area,cidade,topologia,full_name,cargo,nivel,phone_e164,phone_display,notes,scope,active,valid_from,valid_until,created_at
 from jsonb_populate_recordset(null::public.cop_contacts,v_snapshot) where cluster=any(v_clusters);
 get diagnostics v_rows = row_count;
 insert into public.cop_import_batches(created_by,mode,clusters,row_count,added,changed,removed,before_snapshot)
 values(auth.uid(),'restore',v_clusters,v_rows,v_rows,0,0,v_current) returning id into v_batch;
 return jsonb_build_object('batch_id',v_batch,'restored',v_rows);
end $$;

create or replace function public.cop_session_valid_for(p_user_id uuid,p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.sessions where id=p_session_id and user_id=p_user_id
 and created_at > now() - interval '12 hours')
$$;
revoke all on function public.cop_session_valid_for(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cop_session_valid_for(uuid,uuid) to service_role;

create table public.cop_account_locks(user_id uuid primary key, token uuid not null, expires_at timestamptz not null);
alter table public.cop_account_locks enable row level security;
revoke all on public.cop_account_locks from public,anon,authenticated;
create or replace function public.cop_acquire_account_lock(p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_token uuid;
begin
 insert into public.cop_account_locks(user_id,token,expires_at)
 values(p_user_id,gen_random_uuid(),now()+interval '5 minutes')
 on conflict(user_id) do update set token=excluded.token,expires_at=excluded.expires_at
 where public.cop_account_locks.expires_at < now()
 returning token into v_token;
 return v_token;
end $$;
create or replace function public.cop_release_account_lock(p_user_id uuid,p_token uuid)
returns void language sql security definer set search_path = '' as $$
 delete from public.cop_account_locks where user_id=p_user_id and token=p_token
$$;
revoke all on function public.cop_acquire_account_lock(uuid) from public,anon,authenticated;
revoke all on function public.cop_release_account_lock(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cop_acquire_account_lock(uuid) to service_role;
grant execute on function public.cop_release_account_lock(uuid,uuid) to service_role;
commit;
