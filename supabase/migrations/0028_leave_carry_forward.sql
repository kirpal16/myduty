-- ---------------------------------------------------------------------------
-- 0028: leave carry-forward.
--
-- Unused leave rolls into the next year, up to a maximum accumulated balance
-- that differs per officer and per leave type. Until now the model had no
-- notion of it: user_leave_balances stored exactly one number per
-- (officer, type, year) and each year stood alone.
--
-- The arithmetic here must match src/lib/leave/carryForward.ts exactly. That
-- file is the specification and carries the unit tests; this view is what the
-- application actually reads.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The rule: per officer, per leave type -- deliberately NOT per year.
--
--    "This officer may bank up to 30 days of CL" stays true across years.
--    Keying it by year would force the admin to re-enter it every January,
--    which is the yearly ritual this feature exists to avoid.
-- ---------------------------------------------------------------------------
create table if not exists public.user_leave_carry_rules (
  user_id uuid not null references public.users(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  carry_forward boolean not null default false,
  -- Maximum accumulated balance available in a year:
  -- current year's allocation + carried-in balance cannot exceed this value.
  -- NULL means no maximum -- NOT "cap at the annual allocation".
  max_accumulated numeric check (max_accumulated is null or max_accumulated >= 0),
  primary key (user_id, leave_type_id)
);

alter table public.user_leave_carry_rules enable row level security;

-- Policies mirror user_leave_balances (0009 + 0017) exactly: an officer reads
-- and writes their own rule, a super admin reads and writes anyone's. A
-- mismatch here is how 0026 leaked every officer's balances.
drop policy if exists carry_rules_select on public.user_leave_carry_rules;
create policy carry_rules_select on public.user_leave_carry_rules for select
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists carry_rules_write on public.user_leave_carry_rules;
create policy carry_rules_write on public.user_leave_carry_rules for all
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists carry_rules_self_write on public.user_leave_carry_rules;
create policy carry_rules_self_write on public.user_leave_carry_rules for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. The per-year override.
--
--    The computed figure is a starting point, not the last word. An override
--    applies to ITS OWN YEAR only; the next year computes fresh, so a one-off
--    correction cannot quietly propagate forward as a new baseline.
--
--    NULL = "use the computed value". 0 = a deliberate "nothing carried".
--    Those must stay distinguishable, which is why this is nullable rather
--    than `not null default 0`.
-- ---------------------------------------------------------------------------
alter table public.user_leave_balances
  add column if not exists carried_override numeric;

alter table public.user_leave_balances
  drop constraint if exists user_leave_balances_carried_override_nonneg;
alter table public.user_leave_balances
  add constraint user_leave_balances_carried_override_nonneg
    check (carried_override is null or carried_override >= 0);

-- ---------------------------------------------------------------------------
-- 3. The two rules, as functions.
--
--    Each is needed twice inside the recursive view below (once in the anchor,
--    once in the recursive term). Written inline they would be duplicated
--    expressions that could drift apart on the next edit -- which for this
--    feature means one year's arithmetic silently disagreeing with the next.
--
--    immutable + plain SQL so the planner can inline them; no table access, so
--    no RLS implications.
-- ---------------------------------------------------------------------------
create or replace function public.leave_carried_in(
  p_carry_forward boolean,
  p_override numeric,
  p_prev_remaining numeric
) returns numeric
language sql
immutable
as $$
  select case
    -- Carry forward OFF wins over any override. A stored override is inert
    -- data, not an escape hatch: otherwise switching the rule off would fail
    -- to stop the carry, which is the one thing it exists to do.
    when not coalesce(p_carry_forward, false) then 0::numeric
    -- Only a POSITIVE remainder carries. `remaining` is deliberately allowed
    -- to go negative (0017), and a deficit must not eat next year's grant.
    else coalesce(p_override, greatest(coalesce(p_prev_remaining, 0), 0))
  end;
$$;

create or replace function public.leave_total_available(
  p_allocated numeric,
  p_carried_in numeric,
  p_max_accumulated numeric
) returns numeric
language sql
immutable
as $$
  select case
    -- NULL max means NO ceiling. 60 granted on top of 60 carried is 120, not
    -- 60 -- it must never fall back to the annual allocation.
    when p_max_accumulated is null then coalesce(p_allocated, 0) + coalesce(p_carried_in, 0)
    else least(coalesce(p_allocated, 0) + coalesce(p_carried_in, 0), p_max_accumulated)
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. leave_balance_view, rewritten to walk the years.
--
--    Each year's opening balance comes from the year before, so the years can
--    no longer be resolved independently -- hence the recursive CTE.
--
--    Three things carried over from 0026 that must not regress:
--      * security_invoker stays on. Without it the view runs as its owner and
--        bypasses RLS, which is the bug 0026 exists to fix.
--      * holiday_count_for_year() is evaluated ONCE per row, in `base`. Its
--        own comment notes it walks 365 days with a lookup per day; calling
--        it again inside the recursion would multiply that by the year count.
--      * `remaining` may legitimately go negative. Over-use is displayed,
--        never prevented.
--
--    The recursive term carries only what the next step needs -- the running
--    total and the days used. Everything else is joined back on at the end:
--    a recursive reference may not sit inside a subquery or LATERAL, so the
--    derived columns cannot be computed mid-recursion.
-- ---------------------------------------------------------------------------
drop view if exists public.leave_balance_view;

create view public.leave_balance_view
with (security_invoker = on)
as
with recursive years as (
  select generate_series(
           extract(year from now())::int - 3,
           extract(year from now())::int + 1
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
