-- ---------------------------------------------------------------------------
-- 0029: widen the leave_balance_view year window.
--
-- From now()-3 .. now()+1 to now()-4 .. now()+2, so officers can look back at
-- older records and plan further ahead than the next year.
--
-- WHY +2 AND NOT +1:
--   The dashboard's expiry alert reads NEXT year's balances to work out what
--   will be lost (dashboard/page.tsx, `.eq("year", year + 1)`). The moment the
--   year selector offers now+1, that query asks for now+2 -- and against a +1
--   window it returns nothing, so the alert silently reports no days at risk.
--   +2 is what keeps that feature working.
--
-- WHAT THIS FILE IS:
--   `create or replace view` needs the whole definition, so the body below is
--   0028's view COPIED VERBATIM with only the two generate_series bounds
--   changed. Everything else is load-bearing:
--
--     * security_invoker -- three consumers pass no user_id filter and rely on
--       RLS alone. Losing it leaks every officer's balances (the bug 0026 fixed).
--     * the recursive `walked` CTE -- carry-forward itself.
--     * allocation_exists, decided BEFORE the coalesce -- the January
--       "set this year's allowance" prompt cannot otherwise tell "no row"
--       from "a row saying 0".
--     * all twelve output columns -- src/types/database.ts is hand-written, so
--       a dropped column fails at runtime, not at compile time.
--
--   Verify with:
--     git diff --no-index supabase/migrations/0028_leave_carry_forward.sql --                         supabase/migrations/0029_expand_leave_balance_years.sql
--   The only differences should be this header and the two bounds.
--
-- EXPECT BALANCES TO MOVE. The window's earliest year always carries in zero,
-- so moving the floor back shifts every later year's carried-in for officers
-- with history that far back. That is more correct, not a regression.
--
-- leave_carried_in() and leave_total_available() are untouched by this file.
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
  -- Global types apply to everyone; a personal type only to its owner.
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
base as (
  select
    v.user_id,
    v.leave_type_id,
    y.year,
    case
      when v.is_system and v.code = 'HL'
        then public.holiday_count_for_year(y.year, v.user_id)::numeric
      else coalesce(b.allocated, 0)
    end as allocated,
    -- Whether an allocation row actually EXISTS, decided BEFORE the coalesce
    -- above flattens "no row" and "a row saying 0" into the same number.
    -- The dashboard's "set this year's allowance" prompt keys off this: an
    -- officer who genuinely has no entitlement sets 0 once and must not be
    -- nagged forever. Holiday Leave never stores a row -- its allocation is
    -- computed from the calendar -- so it reports true and never prompts.
    ((v.is_system and v.code = 'HL') or b.user_id is not null) as allocation_exists,
    coalesce(u.used_days, 0) as used,
    b.carried_override,
    coalesce(r.carry_forward, false) as carry_forward,
    r.max_accumulated
  from visible_types v
  cross join years y
  left join public.user_leave_balances b
    on b.user_id = v.user_id and b.leave_type_id = v.leave_type_id and b.year = y.year
  left join usage u
    on u.user_id = v.user_id and u.leave_type_id = v.leave_type_id and u.year = y.year
  left join public.user_leave_carry_rules r
    on r.user_id = v.user_id and r.leave_type_id = v.leave_type_id
),
walked as (
  -- Anchor: the window's earliest year opens at zero. Days banked before the
  -- window are invisible here -- seed them as that year's allocation.
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
  -- Days the cap swallowed, so the UI can say so rather than silently showing
  -- a smaller number than the officer expects.
  (b.allocated + w.carried_in) - w.total_available as capped_away,
  w.used,
  -- Kept as `remaining` for every existing caller. It now includes carried
  -- days, which is the point of the feature.
  w.total_available - w.used as remaining
from walked w
join base b
  on b.user_id = w.user_id
 and b.leave_type_id = w.leave_type_id
 and b.year = w.year;
