-- Phase 6: three-tier holidays. GLOBAL (everyone), PROFILE (that profile's
-- users), USER (personal — the owning user manages their own, no admin
-- permission required, and no one else can see or touch it).
create type public.holiday_scope as enum ('GLOBAL', 'PROFILE', 'USER');

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  scope public.holiday_scope not null,
  profile_id uuid references public.profiles(id),
  user_id uuid references public.users(id) on delete cascade,
  is_government boolean not null default false,
  is_recurring_yearly boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (scope = 'GLOBAL'  and profile_id is null     and user_id is null) or
    (scope = 'PROFILE' and profile_id is not null and user_id is null) or
    (scope = 'USER'    and user_id is not null    and profile_id is null)
  )
);

alter table public.holidays enable row level security;

create policy holidays_select on public.holidays for select
  using (
    scope = 'GLOBAL'
    or (scope = 'PROFILE' and profile_id = (select profile_id from public.users where id = auth.uid()))
    or (scope = 'USER' and user_id = auth.uid())
    or public.is_super_admin()
  );

create policy holidays_insert on public.holidays for insert
  with check (
    (scope in ('GLOBAL','PROFILE') and (public.has_permission('HOLIDAY_CREATE') or public.is_super_admin()))
    or (scope = 'USER' and user_id = auth.uid())
  );
create policy holidays_delete on public.holidays for delete
  using (
    (scope in ('GLOBAL','PROFILE') and (public.has_permission('HOLIDAY_DELETE') or public.is_super_admin()))
    or (scope = 'USER' and user_id = auth.uid())
  );

create trigger audit_holidays after insert or delete on public.holidays
  for each row execute function public.write_audit_log('holiday');
