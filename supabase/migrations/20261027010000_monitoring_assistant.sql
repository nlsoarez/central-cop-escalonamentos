begin;
-- Vínculos explícitos: nenhum município/UF é inferido da planilha legada.
create function public.cop_monitor_text(p_value text) returns text language sql immutable set search_path='' as $$
 select lower(regexp_replace(btrim(translate(coalesce(p_value,''),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç','AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),'\s+',' ','g'))
$$;
create table public.cop_monitor_groups(
 alias text primary key,
 cluster text not null check(cluster in ('RJ','ES','MG','CO','NE','NO','BA')),
 ufs text[] not null
);
insert into public.cop_monitor_groups values
 ('grupo rio de janeiro','RJ',array['RJ']),('grupo espirito santo','ES',array['ES']),('grupo minas gerais','MG',array['MG']),
 ('grupo centro-oeste','CO',array['DF','GO','MS','MT']),('grupo nordeste','NE',array['AL','BA','CE','MA','PB','PE','PI','RN','SE']),
 ('grupo norte','NO',array['AC','AM','AP','PA','RO','RR','TO']),('grupo bahia/sergipe','BA',array['BA','SE']);
create table public.cop_monitor_coverage(
 id uuid primary key default gen_random_uuid(),
 contact_id uuid not null references public.cop_contacts(id) on delete cascade,
 city text not null check(length(btrim(city)) between 2 and 120),
 city_key text generated always as(public.cop_monitor_text(city)) stored,
 uf text not null check(uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
 technology text not null check(technology in ('HFC','GPON','FIBRA','COAXIAL','EMPRESARIAL','BKB','ALL')),
 contact_revision text not null,
 confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null default now(),
 unique(contact_id,city_key,uf,technology)
);
create index cop_monitor_coverage_search on public.cop_monitor_coverage(city_key,uf,technology);
create table public.cop_monitor_audit(
 id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),
 contact_id uuid references public.cop_contacts(id) on delete set null,event text not null check(event in ('coverage_confirm','coverage_remove','group_save')),
 details jsonb not null,created_at timestamptz not null default now()
);
alter table public.cop_monitor_groups enable row level security;
alter table public.cop_monitor_coverage enable row level security;
alter table public.cop_monitor_audit enable row level security;
revoke all on public.cop_monitor_groups,public.cop_monitor_coverage,public.cop_monitor_audit from public,anon,authenticated;
grant select on public.cop_monitor_groups,public.cop_monitor_coverage,public.cop_monitor_audit to authenticated;
grant all on public.cop_monitor_groups,public.cop_monitor_coverage,public.cop_monitor_audit to service_role;
create policy cop_monitor_groups_admin on public.cop_monitor_groups for select to authenticated using((select public.cop_is_admin()));
create policy cop_monitor_coverage_admin on public.cop_monitor_coverage for select to authenticated using((select public.cop_is_admin()));
create policy cop_monitor_audit_admin on public.cop_monitor_audit for select to authenticated using((select public.cop_is_admin()));
-- A revisão inclui o registro completo: reimportação/edição exige reconferência.
create function public.cop_monitor_contact_revision(p_contact public.cop_contacts) returns text language sql immutable set search_path='' as $$select md5(to_jsonb(p_contact)::text)$$;
create function public.cop_set_monitor_coverage(p_contact_id uuid,p_rows jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare c public.cop_contacts; r jsonb;
begin
 if not public.cop_is_admin() then raise exception 'Acesso restrito ao administrador'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>2000 then raise exception 'Lista inválida (máximo 2000 vínculos)'; end if;
 select * into c from public.cop_contacts where id=p_contact_id for update;
 if not found then raise exception 'Contato indisponível'; end if;
 delete from public.cop_monitor_coverage where contact_id=p_contact_id;
 for r in select value from jsonb_array_elements(p_rows) loop
  insert into public.cop_monitor_coverage(contact_id,city,uf,technology,contact_revision,confirmed_by)
  values(c.id,btrim(r->>'city'),upper(btrim(r->>'uf')),upper(btrim(r->>'technology')),public.cop_monitor_contact_revision(c),auth.uid());
 end loop;
 insert into public.cop_monitor_audit(actor,contact_id,event,details) values(auth.uid(),c.id,case when jsonb_array_length(p_rows)=0 then 'coverage_remove' else 'coverage_confirm' end,jsonb_build_object('bindings',p_rows));
end $$;
create function public.cop_set_monitor_group(p_alias text,p_cluster text,p_ufs text[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.cop_is_admin() then raise exception 'Acesso restrito ao administrador'; end if;
 if length(btrim(p_alias)) not between 2 and 120 or p_ufs is null or cardinality(p_ufs) not between 1 and 27 or exists(select 1 from unnest(p_ufs) u where u is null or u not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')) then raise exception 'Grupo/UF inválido'; end if;
 insert into public.cop_monitor_groups(alias,cluster,ufs) values(public.cop_monitor_text(p_alias),p_cluster,p_ufs)
 on conflict(alias) do update set cluster=excluded.cluster,ufs=excluded.ufs;
 insert into public.cop_monitor_audit(actor,event,details) values(auth.uid(),'group_save',jsonb_build_object('alias',public.cop_monitor_text(p_alias),'cluster',p_cluster,'ufs',p_ufs));
end $$;
create function public.cop_lookup_monitoring(p_group text,p_city text,p_uf text,p_technology text,p_level integer,p_contact_id uuid default null,p_revision text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.cop_monitor_groups; result jsonb;
begin
 if not public.cop_is_active() then raise exception 'Sessão indisponível'; end if;
 if length(p_group)>120 or length(btrim(p_city)) not between 2 and 120 or p_city is null or p_level is null or p_level not in (1,2,3) or p_technology is null or p_technology not in ('HFC','GPON','FIBRA','COAXIAL','EMPRESARIAL','BKB') or p_uf is null then raise exception 'Contexto inválido'; end if;
 if not public.cop_consume_limit(auth.uid(),'monitor-lookup',100,60) then raise exception 'Limite de consultas atingido'; end if;
 select * into g from public.cop_monitor_groups where alias=public.cop_monitor_text(p_group);
 if not found or not(p_uf=any(g.ufs)) then return jsonb_build_object('code','UNKNOWN_GROUP','candidates','[]'::jsonb); end if;
 select coalesce(jsonb_agg(item order by rank,name,id),'[]'::jsonb) into result from (
  select c.id,c.full_name as name,case when c.scope='local' then 0 else 1 end as rank,
   jsonb_build_object('id',c.id,'name',c.full_name,'role',c.cargo,'level',p_level,'technology',p_technology,'scope',c.scope,'coverage',p_city||'/'||p_uf||case when c.area<>'' then ' · '||c.area else '' end,
   'revision',public.cop_monitor_contact_revision(c),'phone',case when p_contact_id is not null then '+'||c.phone_e164 else null end) as item
  from public.cop_contacts c where c.cluster=g.cluster and c.active
   and (c.valid_from is null or c.valid_from<=current_date) and (c.valid_until is null or c.valid_until>=current_date)
   and regexp_replace(upper(btrim(c.nivel)),'^N\s*','')=p_level::text
   and (p_contact_id is null or (c.id=p_contact_id and public.cop_monitor_contact_revision(c)=p_revision))
   and exists(select 1 from public.cop_monitor_coverage b where b.contact_id=c.id and b.city_key=public.cop_monitor_text(p_city) and b.uf=p_uf and b.technology in (p_technology,'ALL') and b.contact_revision=public.cop_monitor_contact_revision(c))
 order by rank,name,id limit 101) matches;
 if jsonb_array_length(result)>100 then return jsonb_build_object('code','TOO_MANY','candidates','[]'::jsonb); end if;
 return jsonb_build_object('code',case when jsonb_array_length(result)=0 then 'NO_MATCH' else 'OK' end,'candidates',result);
end $$;
revoke all on function public.cop_monitor_text(text),public.cop_monitor_contact_revision(public.cop_contacts),public.cop_set_monitor_coverage(uuid,jsonb),public.cop_set_monitor_group(text,text,text[]),public.cop_lookup_monitoring(text,text,text,text,integer,uuid,text) from public,anon;
grant execute on function public.cop_set_monitor_coverage(uuid,jsonb),public.cop_set_monitor_group(text,text,text[]),public.cop_lookup_monitoring(text,text,text,text,integer,uuid,text) to authenticated;
commit;
