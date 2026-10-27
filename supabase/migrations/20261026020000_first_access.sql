-- E-mails corporativos independentes dos aliases internos de autenticacao.
begin;
create table public.cop_account_emails (
 login_id text primary key check(login_id ~ '^[A-Z][A-Z0-9]{4,14}$'),
 display_name text not null check(length(display_name) between 3 and 120),
 email text not null unique check(length(email) between 6 and 254 and email=lower(btrim(email)) and email !~ '[[:space:][:cntrl:]]'),
 verified_at timestamptz not null default now()
);
create table public.cop_first_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 issued_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 delivery text not null default 'pending' check(delivery in ('pending','sent','failed'))
);
alter table public.cop_account_emails enable row level security;
alter table public.cop_first_access enable row level security;
revoke all on public.cop_account_emails, public.cop_first_access from public,anon,authenticated;
grant all on public.cop_account_emails, public.cop_first_access to service_role;
create function public.cop_reserve_first_access(p_login text,p_token_hash text)
returns table(user_id uuid,email text,display_name text)
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid token'; end if;
 select p.id into v_id from public.cop_profiles p
 join public.cop_account_emails e on e.login_id=upper(btrim(p.login_id))
 where e.login_id=p_login and p.active and p.must_change_password and p.role='viewer';
 if v_id is null then return; end if;
 insert into public.cop_first_access as s(user_id,token_hash,expires_at)
 values(v_id,p_token_hash,now()+interval '30 minutes')
 on conflict on constraint cop_first_access_pkey do update
 set token_hash=excluded.token_hash,issued_at=now(),expires_at=excluded.expires_at,consumed_at=null,delivery='pending'
 where s.issued_at < now()-interval '2 minutes' returning s.user_id into v_id;
 if v_id is null then return; end if;
 return query select v_id,e.email,e.display_name from public.cop_account_emails e where e.login_id=p_login;
end $$;
create function public.cop_consume_first_access(p_user_id uuid,p_token_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 update public.cop_first_access s set consumed_at=now()
 where s.user_id=p_user_id and s.token_hash=p_token_hash and s.consumed_at is null
 and s.expires_at>now() and s.delivery='sent'
 and exists(select 1 from public.cop_profiles p where p.id=s.user_id and p.active and p.role='viewer' and p.must_change_password)
 returning s.user_id into v_id;
 return v_id is not null;
end $$;
revoke all on function public.cop_reserve_first_access(text,text),public.cop_consume_first_access(uuid,text) from public,anon,authenticated;
grant execute on function public.cop_reserve_first_access(text,text),public.cop_consume_first_access(uuid,text) to service_role;
commit;
