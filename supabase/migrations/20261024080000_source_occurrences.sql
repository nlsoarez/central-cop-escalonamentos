-- Cada ocorrência da planilha é independente, mesmo com pessoa e abrangência iguais.
-- As linhas já existentes permanecem com ocorrência 1. Nenhum contato é excluído.
begin;
select pg_advisory_xact_lock(1836472101);
lock table public.cop_contacts in access exclusive mode;
alter table public.cop_contacts add column source_occurrence integer not null default 1
  check (source_occurrence between 1 and 2000);
drop index public.cop_contact_unique_logical;
create unique index cop_contact_unique_logical on public.cop_contacts (
  cluster,lower(btrim(area)),lower(btrim(cidade)),lower(btrim(topologia)),
  lower(btrim(full_name)),lower(btrim(cargo)),lower(btrim(nivel)),source_occurrence
);

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
  v_occurrence integer;
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
    v_occurrence:=coalesce((v_row->>'source_occurrence')::integer,1);
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
      or v_occurrence not between 1 and 2000
      or (v_valid_from is not null and v_valid_until is not null and v_valid_from>v_valid_until)
    then raise exception 'Contato inválido na importação'; end if;
    select * into v_match from public.cop_contacts c
      where c.cluster=v_cluster and lower(btrim(c.area))=lower(v_area)
      and lower(btrim(c.cidade))=lower(v_cidade)
      and lower(btrim(c.topologia))=lower(v_topologia)
      and lower(btrim(c.full_name))=lower(v_name)
      and lower(btrim(c.cargo))=lower(v_cargo)
      and lower(btrim(c.nivel))=lower(v_nivel)
      and c.source_occurrence=v_occurrence
      limit 1;
    if not found then
      insert into public.cop_contacts(cluster,area,cidade,topologia,full_name,cargo,nivel,phone_e164,phone_display,notes,scope,active,valid_from,valid_until,source_occurrence)
      values(v_cluster,v_area,v_cidade,v_topologia,v_name,v_cargo,v_nivel,v_phone,coalesce(v_row->>'phone_display',''),v_notes,v_scope,v_active,v_valid_from,v_valid_until,v_occurrence)
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
 insert into public.cop_contacts(id,cluster,area,cidade,topologia,full_name,cargo,nivel,phone_e164,phone_display,notes,scope,active,valid_from,valid_until,created_at,source_occurrence)
 select id,cluster,area,cidade,topologia,full_name,cargo,nivel,phone_e164,phone_display,notes,scope,active,valid_from,valid_until,created_at,coalesce(source_occurrence,1)
 from jsonb_populate_recordset(null::public.cop_contacts,v_snapshot) where cluster=any(v_clusters);
 get diagnostics v_rows = row_count;
 insert into public.cop_import_batches(created_by,mode,clusters,row_count,added,changed,removed,before_snapshot)
 values(auth.uid(),'restore',v_clusters,v_rows,v_rows,0,0,v_current) returning id into v_batch;
 return jsonb_build_object('batch_id',v_batch,'restored',v_rows);
end $$;


NOTIFY pgrst, 'reload schema';
commit;
