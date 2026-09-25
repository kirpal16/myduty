-- ---------------------------------------------------------------------------
-- 0036: Per-day leave allocation (Smart Leave Engine)
--
-- One leave_logs row stays one leave (one application, one entry in the log
-- book), but the days inside it can be charged to different types:
--
--   a Casual Leave over a weekend      -> CL, CL, HL, HL, CL
--   a Casual Leave on an optional day  -> OH while quota remains, else CL
--   a Special Leave starting on a Sat  -> HL, HL, SPL, SPL ...
--
-- leave_log_days records that per-day decision, made by the app's engine
-- (src/lib/leave/allocateLeaveDays.ts). The balance view now sums DAYS from
-- it, by the year each day falls in, so a leave crossing 31 December is
-- charged to both years instead of entirely to the first.
--
-- 1. leave_log_days table + RLS
-- 2. Special Leave (SPL) system type
-- 3. Backfill: every existing log gets one row per date, charged to its own
--    type, so historical balances do not move
-- 4. log_leave_with_days() / set_leave_log_days(): atomic writes
-- 5. leave_balance_view reads per-day usage
-- ---------------------------------------------------------------------------

-- 1. Table
create table if not exists public.leave_log_days (
  id uuid primary key default gen_random_uuid(),
  leave_log_id uuid not null references public.leave_logs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  leave_date date not null,
  leave_type_id uuid not null references public.leave_types(id),
  fraction numeric(3, 1) not null default 1 check (fraction in (0.5, 1)),
  created_at timestamptz not null default now(),
  unique (leave_log_id, leave_date)
);

create index if not exists leave_log_days_user_date_idx
  on public.leave_log_days (user_id, leave_date);
create index if not exists leave_log_days_type_idx
  on public.leave_log_days (leave_type_id);

alter table public.leave_log_days enable row level security;

-- Same shape as leave_logs (0017): the officer owns their rows, a
-- LEAVE_VIEW_ALL holder may read everyone's, nobody writes another's.
drop policy if exists leave_log_days_select on public.leave_log_days;
drop policy if exists leave_log_days_insert on public.leave_log_days;
drop policy if exists leave_log_days_delete on public.leave_log_days;

create policy leave_log_days_select on public.leave_log_days for select
  using (user_id = auth.uid() or public.has_permission('LEAVE_VIEW_ALL'));
create policy leave_log_days_insert on public.leave_log_days for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.leave_logs l
      where l.id = leave_log_id and l.user_id = auth.uid()
    )
  );
create policy leave_log_days_delete on public.leave_log_days for delete
  using (user_id = auth.uid());

-- 2. Special Leave system type
insert into public.leave_types (name, code, is_active, color, is_system)
select 'Special Leave', 'SPL', true, '#0ea5e9', true
where not exists (
  select 1 from public.leave_types where code = 'SPL' and user_id is null
);

update public.leave_types
   set is_system = true, is_active = true
 where code = 'SPL' and user_id is null;

-- 3. Backfill
insert into public.leave_log_days (leave_log_id, user_id, leave_date, leave_type_id, fraction)
select
  l.id,
  l.user_id,
  g::date,
  l.leave_type_id,
  case when l.is_half_day then 0.5 else 1 end
from public.leave_logs l
cross join lateral generate_series(l.start_date, l.end_date, interval '1 day') as g
on conflict (leave_log_id, leave_date) do nothing;

-- 4. Writes
--
-- p_days is a JSON array: [{"date": "2026-09-12", "leave_type_id": "…", "fraction": 1}, …]
create or replace function public.set_leave_log_days(p_leave_log_id uuid, p_days jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_log public.leave_logs;
begin
  select * into v_log
    from public.leave_logs
   where id = p_leave_log_id and user_id = auth.uid();
  if not found then
    raise exception 'leave entry not found';
  end if;

  delete from public.leave_log_days where leave_log_id = p_leave_log_id;

  insert into public.leave_log_days (leave_log_id, user_id, leave_date, leave_type_id, fraction)
  select
    p_leave_log_id,
    v_log.user_id,
    (e ->> 'date')::date,
    (e ->> 'leave_type_id')::uuid,
    coalesce((e ->> 'fraction')::numeric, 1)
  from jsonb_array_elements(coalesce(p_days, '[]'::jsonb)) as e;

  if exists (
    select 1 from public.leave_log_days
     where leave_log_id = p_leave_log_id
       and (leave_date < v_log.start_date or leave_date > v_log.end_date)
  ) then
    raise exception 'an allocated day falls outside the leave dates';
  end if;
end;
$$;

-- log_leave() plus its day rows in one transaction: either both are saved
-- or neither is, so a leave can never exist without its allocation.
create or replace function public.log_leave_with_days(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text,
  p_days jsonb
) returns public.leave_logs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.leave_logs;
begin
  v_row := public.log_leave(
    p_leave_type_id, p_start_date, p_end_date,
    p_is_half_day, p_half_day_session, p_reason
  );
  perform public.set_leave_log_days(v_row.id, p_days);
  return v_row;
end;
$$;

-- 5. Balance view
drop view if exists public.leave_balance_view;

create view public.leave_balance_view
with (security_invoker = on)
as
with recursive years as (
  select generate_series(
           extract(year from now())::int - 4,
           extract(year from now())::int + 2
         ) as year
),
visible_types as (
  select u.id as user_id, lt.id as leave_type_id, lt.code, lt.is_system
  from public.users u
  join public.leave_types lt
    on lt.user_id is null or lt.user_id = u.id
),
charged_days as (
  -- The engine's per-day decisions…
  select d.user_id, d.leave_type_id, d.leave_date, d.fraction
  from public.leave_log_days d
  union all
  -- …and, for any log without them (written outside the app), every date
  -- of the log charged to its own type, exactly as before this migration.
  select
    l.user_id,
    l.leave_type_id,
    g::date,
    case when l.is_half_day then 0.5 else 1 end
  from public.leave_logs l
  cross join lateral generate_series(l.start_date, l.end_date, interval '1 day') as g
  where not exists (
    select 1 from public.leave_log_days d where d.leave_log_id = l.id
  )
),
usage as (
  select
    user_id,
    leave_type_id,
    extract(year from leave_date)::int as year,
    sum(fraction) as used_days
  from charged_days
  group by user_id, leave_type_id, extract(year from leave_date)
),
worked_holidays as (
  select
    d.user_id,
    extract(year from d.starts_at)::int as year,
    count(distinct d.starts_at::date)::numeric as worked_days
  from public.duties d
  where d.status != 'CANCELLED'
    and d.is_holiday_duty = true
  group by d.user_id, extract(year from d.starts_at)::int
),
base as (
  select
    v.user_id,
    v.leave_type_id,
    y.year,
    case
      when v.is_system and v.code = 'HL'
        then public.holiday_count_for_year(y.year, v.user_id)::numeric
      when v.is_system and v.code = 'OH'
        then 2::numeric
      else coalesce(b.allocated, 0)
    end as allocated,
    ((v.is_system and v.code in ('HL', 'OH')) or b.user_id is not null) as allocation_exists,
    case
      when v.is_system and v.code = 'HL'
        then coalesce(u.used_days, 0) + coalesce(wh.worked_days, 0)
      else coalesce(u.used_days, 0)
    end as used,
    b.carried_override,
    coalesce(r.carry_forward, false) as carry_forward,
    r.max_accumulated
  from visible_types v
  cross join years y
  left join public.user_leave_balances b
    on b.user_id = v.user_id and b.leave_type_id = v.leave_type_id and b.year = y.year
  left join usage u
    on u.user_id = v.user_id and u.leave_type_id = v.leave_type_id and u.year = y.year
  left join worked_holidays wh
    on wh.user_id = v.user_id and wh.year = y.year
  left join public.user_leave_carry_rules r
    on r.user_id = v.user_id and r.leave_type_id = v.leave_type_id
),
walked as (
  select
    b.user_id,
    b.leave_type_id,
    b.year,
    0::numeric as carried_in,
    public.leave_total_available(b.allocated, 0, b.max_accumulated) as total_available,
    b.used
  from base b
  where b.year = (select min(year) from years)

  union all

  select
    n.user_id,
    n.leave_type_id,
    n.year,
    public.leave_carried_in(
      n.carry_forward, n.carried_override, w.total_available - w.used
    ) as carried_in,
    public.leave_total_available(
      n.allocated,
      public.leave_carried_in(
        n.carry_forward, n.carried_override, w.total_available - w.used
      ),
      n.max_accumulated
    ) as total_available,
    n.used
  from walked w
  join base n
    on n.user_id = w.user_id
   and n.leave_type_id = w.leave_type_id
   and n.year = w.year + 1
)
select
  w.user_id,
  w.leave_type_id,
  w.year,
  b.allocated,
  b.allocation_exists,
  w.carried_in,
  b.allocated + w.carried_in as total_before_cap,
  w.total_available,
  b.max_accumulated,
  b.carry_forward,
  (b.allocated + w.carried_in) - w.total_available as capped_away,
  w.used,
  w.total_available - w.used as remaining
from walked w
join base b
  on b.user_id = w.user_id
 and b.leave_type_id = w.leave_type_id
 and b.year = w.year;
