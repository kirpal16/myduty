-- ---------------------------------------------------------------------------
-- 0032: Optional Holiday (OH) system leave type & holidays.is_optional flag
--
-- 1. Adds `is_optional` column to public.holidays (default false).
-- 2. Excludes optional holidays from public.holiday_dates_for_year so they do
--    NOT inflate public Holiday Leave (HL) entitlement.
-- 3. Seeds 'Optional Holiday' ('OH') as a protected system leave type.
-- 4. Updates leave_balance_view so OH automatically receives 2 allocated days
--    per year without requiring manual balance seeding.
-- ---------------------------------------------------------------------------

-- 1. Column on holidays
alter table public.holidays
  add column if not exists is_optional boolean not null default false;

-- 2. Exclude optional holidays from HL calendar count
create or replace function public.holiday_dates_for_year(p_year int, p_user_id uuid)
returns setof date
language sql
stable
security definer
set search_path = public
as $$
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
      -- 2nd or 4th Saturday
      or (extract(dow from d) = 6 and ceil(extract(day from d) / 7.0) in (2, 4))
      -- A public or departmental holiday row (excluding optional holidays)
      or exists (
        select 1
        from public.holidays h
        where h.holiday_date = d::date
          and coalesce(h.is_optional, false) = false
          and (
            h.scope = 'GLOBAL'
            or (h.scope = 'PROFILE'
                and h.profile_id = (select u.profile_id from public.users u where u.id = p_user_id))
            or (h.scope = 'USER' and h.user_id = p_user_id)
          )
      )
    );
$$;

-- 3. Seed 'Optional Holiday' system leave type
insert into public.leave_types (name, code, is_active, color, is_system)
select 'Optional Holiday', 'OH', true, '#8b5cf6', true
where not exists (
  select 1 from public.leave_types where code = 'OH' and user_id is null
);

update public.leave_types
   set is_system = true, is_active = true, color = '#8b5cf6'
 where code = 'OH' and user_id is null;

-- 4. Update leave_balance_view to support OH with 2-day allocation
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
