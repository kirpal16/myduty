-- Holiday Leave (HL): a leave entitlement derived from the holiday calendar.
--
-- The officer's HL allocation for a year IS the number of holidays in that
-- year. There is no stored number, so there is nothing to keep in sync: adding,
-- editing or deleting a holiday changes the balance on the very next query.
--
-- The rule it encodes (R1):
--
--   a holiday date
--     |-- worked        -> duty row, extra pay, HL untouched
--     |-- logged as HL  -> no pay,             HL - 1
--     '-- neither       -> nothing at all
--
-- So a year is never "holidays x rate". Fifteen holidays with three worked and
-- two taken as HL is three lots of extra pay and two HL consumed, not fifteen.
--
-- Safely re-runnable.

-- ---------------------------------------------------------------------------
-- 1. System leave types.
--    HL is owned by the application, not by an admin or an officer: its
--    meaning is wired into the duty rules, so renaming, deleting or
--    deactivating it would break them silently.
-- ---------------------------------------------------------------------------
alter table public.leave_types
  add column if not exists is_system boolean not null default false;

insert into public.leave_types (name, code, is_active, color, is_system)
select 'Holiday Leave', 'HL', true, '#f59e0b', true
where not exists (
  select 1 from public.leave_types where code = 'HL' and user_id is null
);

-- Make sure a pre-existing hand-made 'HL' row is adopted rather than shadowed.
update public.leave_types
   set is_system = true, is_active = true
 where code = 'HL' and user_id is null and is_system = false;

-- Nobody writes system types: not the super admin through the global policy,
-- not the officer through their own. 0022 created both; they are replaced here
-- with the same rules plus that exclusion.
drop policy if exists leave_types_write on public.leave_types;
drop policy if exists leave_types_self_write on public.leave_types;

create policy leave_types_write on public.leave_types for all
  using (public.is_super_admin() and user_id is null and is_system = false)
  with check (public.is_super_admin() and user_id is null and is_system = false);

create policy leave_types_self_write on public.leave_types for all
  using (user_id = auth.uid() and is_system = false)
  with check (user_id = auth.uid() and is_system = false);

-- ---------------------------------------------------------------------------
-- 2. The holiday calendar, as data.
--
--    A date counts when it is a Sunday, the 2nd or 4th Saturday, or carries a
--    holidays row the officer can see. DISTINCT dates, so a gazetted festival
--    falling on a Sunday counts once rather than twice.
--
--    Visibility comes from `scope` alone, mirroring the holidays_select policy.
--    is_government is deliberately NOT consulted: importGujaratGovernmentHolidays
--    writes scope = 'USER' for any officer without HOLIDAY_CREATE, so those rows
--    are personal AND flagged government. Treating the flag as a grant would let
--    one officer's private import inflate every other officer's allocation.
--
--    The is_super_admin() branch that holidays_select carries is also omitted:
--    an admin must not have every officer's personal holidays folded into their
--    own count.
-- ---------------------------------------------------------------------------
create or replace function public.holiday_dates_for_year(p_year int, p_user_id uuid)
returns setof date
language sql
stable
security definer
set search_path = public
as $$
  -- SECURITY DEFINER bypasses RLS, so the function guards its own input: it
  -- answers for the caller, or for anyone if the caller is a super admin.
  -- Otherwise it would enumerate another officer's personal calendar.
  select d::date
  from generate_series(
         make_date(p_year, 1, 1),
         make_date(p_year, 12, 31),
         interval '1 day'
       ) as d
  where (p_user_id = auth.uid() or public.is_super_admin())
    and (
      -- Sunday
      extract(dow from d) = 0
      -- 2nd or 4th Saturday. The 1st, 3rd and 5th are ordinary working days.
      or (extract(dow from d) = 6 and ceil(extract(day from d) / 7.0) in (2, 4))
      -- A holiday row this officer can see
      or exists (
        select 1
        from public.holidays h
        where h.holiday_date = d::date
          and (
            h.scope = 'GLOBAL'
            or (h.scope = 'PROFILE'
                and h.profile_id = (select u.profile_id from public.users u where u.id = p_user_id))
            or (h.scope = 'USER' and h.user_id = p_user_id)
          )
      )
    );
$$;

create or replace function public.holiday_count_for_year(p_year int, p_user_id uuid)
returns int
language sql
stable
as $$
  select count(*)::int from public.holiday_dates_for_year(p_year, p_user_id);
$$;

-- ---------------------------------------------------------------------------
-- 3. Balances.
--
--    Two changes from 0017. HL's allocation is computed rather than stored,
--    and the view is no longer driven solely by user_leave_balances -- under
--    the old shape a leave type with no allocation row was invisible even when
--    leave had been logged against it, so those days simply did not appear.
-- ---------------------------------------------------------------------------
drop view if exists public.leave_balance_view;

-- NOTE: security_invoker is new here, and it is a fix rather than a detail.
-- A view without it runs as its owner (postgres), which bypasses RLS on the
-- tables underneath -- so the old view handed every officer's balances to any
-- authenticated caller, and the balance page's missing user_id filter never
-- showed it. With security_invoker the underlying policies apply again:
-- an officer sees their own rows, a super admin still sees all.
create view public.leave_balance_view
with (security_invoker = on)
as
with years as (
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
resolved as (
  select
    v.user_id,
    v.leave_type_id,
    y.year,
    -- Computed once. holiday_count_for_year walks 365 days with a lookup per
    -- day, so evaluating it again for `remaining` would double that work.
    case
      when v.is_system and v.code = 'HL'
        then public.holiday_count_for_year(y.year, v.user_id)::numeric
      else coalesce(b.allocated, 0)
    end as allocated,
    coalesce(u.used_days, 0) as used
  from visible_types v
  cross join years y
  left join public.user_leave_balances b
    on b.user_id = v.user_id and b.leave_type_id = v.leave_type_id and b.year = y.year
  left join usage u
    on u.user_id = v.user_id and u.leave_type_id = v.leave_type_id and u.year = y.year
)
select
  user_id,
  leave_type_id,
  year,
  allocated,
  used,
  allocated - used as remaining
from resolved;
