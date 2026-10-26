-- Central COP only. User reports never update the operational directory directly.
begin;
create table public.cop_contact_reports (
 id uuid primary key default gen_random_uuid(),
 contact_id uuid references public.cop_contacts(id) on delete set null,
 contact_name text not null,
 contact_cluster text not null,
 contact_area text not null default '',
 contact_city text not null default '',
 reporter_id uuid references public.cop_profiles(id) on delete set null,
 reason text not null check(reason in ('contact_changed','left_role','left_company','other')),
 message text not null check(char_length(btrim(message)) between 10 and 2000),
 status text not null default 'open' check(status in ('open','resolved')),
 review_note text not null default '' check(char_length(review_note)<=1000),
 reviewed_by uuid references public.cop_profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create index cop_contact_reports_reporter_idx on public.cop_contact_reports(reporter_id,created_at desc);
create index cop_contact_reports_status_idx on public.cop_contact_reports(status,created_at desc);
alter table public.cop_contact_reports enable row level security;
revoke all on public.cop_contact_reports from public,anon,authenticated;
grant select on public.cop_contact_reports to authenticated;
grant all on public.cop_contact_reports to service_role;
create policy cop_contact_reports_read on public.cop_contact_reports for select to authenticated
 using((select public.cop_is_active()) and (reporter_id=(select auth.uid()) or (select public.cop_is_admin())));

create function public.cop_submit_contact_report(p_contact_id uuid,p_reason text,p_message text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.cop_contacts; report_id uuid;
begin
 if not public.cop_is_active() then raise exception 'Acesso não autorizado'; end if;
 if p_reason is null or p_reason not in ('contact_changed','left_role','left_company','other')
    or char_length(btrim(coalesce(p_message,''))) not between 10 and 2000 then
  raise exception 'Informe o motivo e uma descrição entre 10 e 2000 caracteres';
 end if;
 select * into c from public.cop_contacts where id=p_contact_id and (active or public.cop_is_admin());
 if not found then raise exception 'Contato indisponível'; end if;
 if not public.cop_consume_limit(auth.uid(),'contact-report',10,3600) then
  raise exception 'Limite de informações atingido. Tente novamente mais tarde';
 end if;
 insert into public.cop_contact_reports(contact_id,contact_name,contact_cluster,contact_area,contact_city,reporter_id,reason,message)
 values(c.id,c.full_name,c.cluster,c.area,c.cidade,auth.uid(),p_reason,btrim(p_message)) returning id into report_id;
 return report_id;
end $$;
revoke all on function public.cop_submit_contact_report(uuid,text,text) from public,anon;
grant execute on function public.cop_submit_contact_report(uuid,text,text) to authenticated;

create function public.cop_review_contact_report(p_report_id uuid,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare r public.cop_contact_reports;
begin
 if not public.cop_is_admin() then raise exception 'Acesso restrito ao administrador'; end if;
 if char_length(coalesce(p_note,''))>1000 then raise exception 'Resposta limitada a 1000 caracteres'; end if;
 select * into r from public.cop_contact_reports where id=p_report_id for update;
 if not found then raise exception 'Informação não encontrada'; end if;
 if r.status<>'open' then raise exception 'Esta informação já foi analisada'; end if;
 update public.cop_contact_reports set status='resolved',review_note=btrim(coalesce(p_note,'')),
  reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
end $$;
revoke all on function public.cop_review_contact_report(uuid,text) from public,anon;
grant execute on function public.cop_review_contact_report(uuid,text) to authenticated;

-- A one-off, explicitly authorized administrator promotion can be audited.
alter table public.cop_user_audit drop constraint cop_user_audit_event_check;
alter table public.cop_user_audit add constraint cop_user_audit_event_check
 check(event in ('create','reset','activate','deactivate','change_password','promote_admin'));
commit;
