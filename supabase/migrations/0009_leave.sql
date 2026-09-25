-- Phase 5: leave module. Full day + half day (AM/PM) granularity. Balance
-- checks and status transitions are concurrency-safe via row-locking
-- functions (apply_leave/approve_leave/reject_leave) rather than
-- Server-Action-only checks, closing the TOCTOU race where two simultaneous
-- requests could both succeed past the allocation.

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),   -- null = applies to all profiles
  name text not null,
  code text not null,
  is_active boolean not null default true,
  unique (profile_id, code)
);

create table public.user_leave_balances (
  user_id uuid not null references public.users(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id),
  year int not null,
  allocated numeric not null default 0,
  primary key (user_id, leave_type_id, year)
  -- No "used"/"remaining" columns — both are always derived (leave_balance_view),
  -- never stored, so there's nothing for a client to tamper with.
);

create type public.leave_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id),
  start_date date not null,
  end_date date not null,
  is_half_day boolean not null default false,
  half_day_session text check (half_day_session in ('AM','PM')),
  reason text,
  status public.leave_status not null default 'PENDING',
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (not is_half_day or start_date = end_date)
);

create view public.leave_balance_view as
select
  b.user_id,
  b.leave_type_id,
  b.year,
  b.allocated,
  coalesce(u.used_days, 0) as used,
  b.allocated - coalesce(u.used_days, 0) as remaining
from public.user_leave_balances b
left join (
  select user_id, leave_type_id,
         extract(year from start_date)::int as year,
         sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end) as used_days
  from public.leave_requests
  where status = 'APPROVED'
  group by user_id, leave_type_id, extract(year from start_date)
) u on u.user_id = b.user_id and u.leave_type_id = b.leave_type_id and u.year = b.year;

-- ---------------------------------------------------------------------------
-- Concurrency-safe application & approval
-- ---------------------------------------------------------------------------
create or replace function public.apply_leave(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text
) returns public.leave_requests language plpgsql security invoker as $$
declare
  v_user_id uuid := auth.uid();
  v_year int := extract(year from p_start_date)::int;
  v_days numeric := case when p_is_half_day then 0.5 else (p_end_date - p_start_date + 1) end;
  v_allocated numeric; v_used numeric; v_overlap int; v_row public.leave_requests;
begin
  if p_end_date < p_start_date then raise exception 'end_date before start_date'; end if;
  if p_is_half_day and p_start_date <> p_end_date then raise exception 'half-day requests must be a single date'; end if;
  if p_is_half_day and p_half_day_session not in ('AM','PM') then raise exception 'half_day_session must be AM or PM'; end if;

  select allocated into v_allocated from public.user_leave_balances
    where user_id = v_user_id and leave_type_id = p_leave_type_id and year = v_year for update;
  if v_allocated is null then raise exception 'no allocation for this type/year'; end if;

  select coalesce(sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end), 0) into v_used
    from public.leave_requests
    where user_id = v_user_id and leave_type_id = p_leave_type_id and status = 'APPROVED'
      and extract(year from start_date) = v_year;

  if v_days > (v_allocated - v_used) then
    raise exception 'requested % day(s) exceeds remaining balance of %', v_days, (v_allocated - v_used);
  end if;

  select count(*) into v_overlap from public.leave_requests
    where user_id = v_user_id and status in ('PENDING','APPROVED')
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
      and (
        not p_is_half_day or not is_half_day
        or (start_date = p_start_date and half_day_session = p_half_day_session)
      );
  if v_overlap > 0 then raise exception 'overlapping leave request already exists'; end if;

  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, is_half_day, half_day_session, reason, status)
  values (v_user_id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day, p_half_day_session, p_reason, 'PENDING')
  returning * into v_row;
  return v_row;
end; $$;

create or replace function public.approve_leave(p_request_id uuid)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_row public.leave_requests; v_days numeric; v_allocated numeric; v_used numeric;
begin
  if not public.has_permission('LEAVE_EDIT') then raise exception 'not authorized'; end if;

  select * into v_row from public.leave_requests where id = p_request_id for update;
  if v_row.status <> 'PENDING' then raise exception 'request is not pending'; end if;
  v_days := case when v_row.is_half_day then 0.5 else (v_row.end_date - v_row.start_date + 1) end;

  select allocated into v_allocated from public.user_leave_balances
    where user_id = v_row.user_id and leave_type_id = v_row.leave_type_id
      and year = extract(year from v_row.start_date)::int for update;
  select coalesce(sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end), 0) into v_used
    from public.leave_requests
    where user_id = v_row.user_id and leave_type_id = v_row.leave_type_id and status = 'APPROVED'
      and extract(year from start_date) = extract(year from v_row.start_date);

  if v_days > (v_allocated - v_used) then
    raise exception 'approving would exceed remaining balance (re-checked at approval time)';
  end if;

  update public.leave_requests set status = 'APPROVED', approved_by = auth.uid(), approved_at = now()
    where id = p_request_id returning * into v_row;
  return v_row;
end; $$;

create or replace function public.reject_leave(p_request_id uuid)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_row public.leave_requests;
begin
  if not public.has_permission('LEAVE_EDIT') then raise exception 'not authorized'; end if;

  select * into v_row from public.leave_requests where id = p_request_id for update;
  if v_row.status <> 'PENDING' then raise exception 'request is not pending'; end if;

  update public.leave_requests set status = 'REJECTED', approved_by = auth.uid(), approved_at = now()
    where id = p_request_id returning * into v_row;
  return v_row;
end; $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.leave_types enable row level security;
alter table public.user_leave_balances enable row level security;
alter table public.leave_requests enable row level security;

create policy leave_types_select on public.leave_types for select using (public.is_approved());
create policy leave_types_write on public.leave_types for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy balances_select on public.user_leave_balances for select
  using (user_id = auth.uid() or public.is_super_admin());
create policy balances_write on public.user_leave_balances for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy leave_requests_select on public.leave_requests for select
  using (user_id = auth.uid() or public.has_permission('LEAVE_VIEW_ALL'));
create policy leave_requests_insert on public.leave_requests for insert
  with check (user_id = auth.uid());
-- Users may only touch their own PENDING request, and only to edit-while-
-- pending or self-cancel — never to set APPROVED/REJECTED themselves.
-- Approval/rejection only happens via the security-definer functions above,
-- which bypass RLS internally after their own permission check.
create policy leave_requests_self_transition on public.leave_requests for update
  using (user_id = auth.uid() and status = 'PENDING')
  with check (user_id = auth.uid() and status in ('PENDING','CANCELLED'));

create trigger audit_leave_requests after insert or update on public.leave_requests
  for each row execute function public.write_audit_log('leave_request');
