-- Privileged operator script, not an RPC. Requires an explicit account promotion request.
-- psql variables: target_login, target_name, operator_login. Run after contact_reports migration.
begin;
select set_config('cop.promotion_login',upper(btrim(:'target_login')),true);
select set_config('cop.promotion_name',lower(btrim(regexp_replace(:'target_name','\s+',' ','g'))),true);
select set_config('cop.promotion_operator',upper(btrim(:'operator_login')),true);
do $$
declare target public.cop_profiles; operator_id uuid;
begin
 select * into target from public.cop_profiles
  where upper(btrim(login_id))=current_setting('cop.promotion_login') for update;
 if not found then raise exception 'Matrícula de destino não encontrada'; end if;
 if lower(btrim(regexp_replace(target.display_name,'\s+',' ','g')))<>current_setting('cop.promotion_name') then
  raise exception 'Nome de destino não confere. Nenhuma permissão foi alterada';
 end if;
 if not target.active then raise exception 'Conta inativa. A promoção não reativa usuários'; end if;
 select id into operator_id from public.cop_profiles where upper(btrim(login_id))=current_setting('cop.promotion_operator') and active and role='admin';
 if not found then raise exception 'Administrador responsável não encontrado'; end if;
 if target.role<>'admin' then
  update public.cop_profiles set role='admin',updated_at=now() where id=target.id;
  insert into public.cop_user_audit(actor,target,event) values(operator_id,target.id,'promote_admin');
 end if;
end $$;
commit;
