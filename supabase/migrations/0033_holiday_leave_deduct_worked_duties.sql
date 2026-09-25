-- ---------------------------------------------------------------------------
-- 0033: Holiday Leave (HL) balance deducts worked holidays
--
-- Business Rule:
-- An officer's Holiday Leave allocation (e.g. 99 days) covers all qualifying
-- holiday dates in that calendar year.
-- When an officer WORKS on a holiday (duty logged on that holiday date):
--   - That day is worked, so it is no longer an available holiday to take off.
--   - Therefore, working a holiday consumes 1 day of Holiday Leave (HL).
--   - "used" for HL = (days taken in leave_logs) + (holiday days worked in duties).
--   - "remaining" = total_available - used.
--
-- Revert / Dynamic Flow:
--   - Duty logged on holiday -> worked holiday count increases -> remaining deducts (e.g. 98 / 99 days left)
--   - Duty removed / cancelled -> worked holiday count decreases -> remaining increases (reverts back to 99)
--   - Holiday Leave logged -> leave count increases -> remaining deducts
--   - Holiday Leave removed -> leave count decreases -> remaining increases (reverts back)
-- ---------------------------------------------------------------------------

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
usage as (
  select
    user_id,
    leave_type_id,
    extract(year from start_date)::int as year,
    sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end) as used_days
  from public.leave_logs
  group by user_id, leave_type_id, extract(year from start_date)
),
worked_holidays as (
  -- Distinct holiday dates with active (non-cancelled) holiday duties
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
