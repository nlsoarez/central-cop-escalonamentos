-- Backend novo do Central COP. Tokens brutos e senhas não são armazenados.
begin;
create table public.cop_initial_setup (
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null,
 consumed_at timestamptz
);
alter table public.cop_initial_setup enable row level security;
revoke all on public.cop_initial_setup from public,anon,authenticated;
grant all on public.cop_initial_setup to service_role;
create or replace function public.cop_consume_initial_setup(p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
 update public.cop_initial_setup s set consumed_at=now()
 where token_hash=p_token_hash and consumed_at is null and expires_at>now()
 and exists(select 1 from public.cop_profiles p where p.id=s.user_id and p.active and p.role='admin' and p.must_change_password)
 returning user_id into v_user;
 return v_user;
end $$;
revoke all on function public.cop_consume_initial_setup(text) from public,anon,authenticated;
grant execute on function public.cop_consume_initial_setup(text) to service_role;

create table public.cop_pending_roster (
 login_id text primary key check(login_id ~ '^[A-Z][A-Z0-9]{4,14}$'),
 display_name text not null check(length(display_name) between 3 and 120),
 created_at timestamptz not null default now()
);
alter table public.cop_pending_roster enable row level security;
revoke all on public.cop_pending_roster from public,anon,authenticated;
grant select on public.cop_pending_roster to authenticated;
grant all on public.cop_pending_roster to service_role;
create policy cop_pending_roster_admin on public.cop_pending_roster for select to authenticated
 using((select public.cop_is_admin()));
commit;
