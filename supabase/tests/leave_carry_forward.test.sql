-- Tests for leave carry-forward: the two rule functions and the rewritten
-- leave_balance_view.
--
-- These earn a dedicated test for the same reason holiday_dates_for_year does:
-- every failure mode is a plausible-looking number. An officer cannot tell a
-- balance of 100 from a balance of 120 by looking at it — they find out when
-- they try to take the leave.
--
-- The same rules are unit-tested in TypeScript (src/lib/leave/carryForward.ts,
-- which is the specification). These tests exist to prove the SQL agrees with
-- it, since the application reads the view and not the TypeScript.
--
-- Run against a local database (never a hosted one — it writes fixtures):
--   supabase start
--   supabase test db
--
-- Requires pgTAP:  create extension if not exists pgtap;

begin;
create extension if not exists pgtap;
select plan(21);

-- ---------------------------------------------------------------------------
-- Part 1: the rule functions, in isolation.
-- ---------------------------------------------------------------------------

-- leave_carried_in(carry_forward, override, previous_remaining)

select is(
  public.leave_carried_in(false, null, 60),
  0::numeric,
  'carry off carries nothing, however large the previous balance'
);

select is(
  public.leave_carried_in(false, 99, 60),
  0::numeric,
  'carry off beats a stored override — the switch must actually stop the carry'
);

select is(
  public.leave_carried_in(true, null, 60),
  60::numeric,
  'carry on with no override carries the previous remainder'
);

select is(
  public.leave_carried_in(true, 12, 60),
  12::numeric,
  'an override replaces the computed figure'
);

select is(
  public.leave_carried_in(true, 0, 60),
  0::numeric,
  'an override of 0 is a deliberate "nothing carried", not "unset"'
);

select is(
  public.leave_carried_in(true, null, -12),
  0::numeric,
  'a deficit does not carry forward as a debt'
);

select is(
  public.leave_carried_in(null, null, 60),
  0::numeric,
  'a missing rule row (null) means no carry'
);

-- leave_total_available(allocated, carried_in, max_accumulated)

select is(
  public.leave_total_available(60, 60, null),
  120::numeric,
  'no maximum means NO ceiling — never a fallback to the annual allocation'
);

select is(
  public.leave_total_available(60, 60, 100),
  100::numeric,
  'the maximum accumulated balance caps allocation + carried'
);

select is(
  public.leave_total_available(60, 60, 300),
  120::numeric,
  'a generous maximum leaves the total untouched'
);

select is(
  public.leave_total_available(30, 40, 0),
  0::numeric,
  'a maximum of 0 is honoured, and is not treated as "unset"'
);

-- ---------------------------------------------------------------------------
-- Part 2: the view, walking real years.
--
-- Fixtures: one officer, three leave types carrying the three rule shapes
-- (off, capped, uncapped) so one query can compare them side by side.
-- ---------------------------------------------------------------------------
create temporary table t_ids (label text primary key, id uuid);

insert into t_ids values
  ('profile', gen_random_uuid()),
  ('officer', gen_random_uuid()),
  ('type_off', gen_random_uuid()),
  ('type_capped', gen_random_uuid()),
  ('type_uncapped', gen_random_uuid());

insert into public.profiles (id, name, code, is_active)
select id, 'Test Profile', 'TEST_PROF', true from t_ids where label = 'profile';

insert into public.users (id, profile_id, role, status, full_name)
select (select id from t_ids where label = 'officer'),
       (select id from t_ids where label = 'profile'),
       'USER', 'APPROVED', 'Carry Officer';

insert into public.leave_types (id, profile_id, name, code, is_active)
select (select id from t_ids where label = 'type_off'),
       (select id from t_ids where label = 'profile'),
       'No Carry', 'T_OFF', true;
insert into public.leave_types (id, profile_id, name, code, is_active)
select (select id from t_ids where label = 'type_capped'),
       (select id from t_ids where label = 'profile'),
       'Capped Carry', 'T_CAP', true;
insert into public.leave_types (id, profile_id, name, code, is_active)
select (select id from t_ids where label = 'type_uncapped'),
       (select id from t_ids where label = 'profile'),
       'Uncapped Carry', 'T_UNCAP', true;

insert into public.user_leave_carry_rules (user_id, leave_type_id, carry_forward, max_accumulated)
select (select id from t_ids where label = 'officer'),
       (select id from t_ids where label = 'type_capped'), true, 100;
insert into public.user_leave_carry_rules (user_id, leave_type_id, carry_forward, max_accumulated)
select (select id from t_ids where label = 'officer'),
       (select id from t_ids where label = 'type_uncapped'), true, null;
-- type_off deliberately has NO rule row: absent must behave as "no carry".

-- 60 days granted in each of two consecutive years, none taken. The view's
-- window is now()-3 .. now()+1, so use last year and this year.
insert into public.user_leave_balances (user_id, leave_type_id, year, allocated)
select (select id from t_ids where label = 'officer'), t.id, y.year, 60
from public.leave_types t
cross join (
  select extract(year from now())::int - 1 as year
  union all select extract(year from now())::int
) y
where t.code in ('T_OFF', 'T_CAP', 'T_UNCAP');

-- The agreed worked example, as three rows of one query.
select is(
  (select total_available from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_off')
      and year = extract(year from now())::int),
  60::numeric,
  'view: carry off — this year is the grant alone'
);

select is(
  (select total_available from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_capped')
      and year = extract(year from now())::int),
  100::numeric,
  'view: carry on with a 100 maximum — 60 + 60 capped to 100'
);

select is(
  (select capped_away from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_capped')
      and year = extract(year from now())::int),
  20::numeric,
  'view: the 20 days the cap swallowed are reported, not hidden'
);

select is(
  (select total_available from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_uncapped')
      and year = extract(year from now())::int),
  120::numeric,
  'view: no maximum means 120 — the trap case'
);

select is(
  (select carried_in from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_uncapped')
      and year = extract(year from now())::int - 1),
  0::numeric,
  'view: the window''s earliest year carries in nothing'
);

-- The per-year override.
update public.user_leave_balances
   set carried_override = 5
 where user_id = (select id from t_ids where label = 'officer')
   and leave_type_id = (select id from t_ids where label = 'type_uncapped')
   and year = extract(year from now())::int;

select is(
  (select carried_in from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_uncapped')
      and year = extract(year from now())::int),
  5::numeric,
  'view: a per-year override replaces the computed carry'
);

-- An override on a type whose rule is off must stay inert.
update public.user_leave_balances
   set carried_override = 99
 where user_id = (select id from t_ids where label = 'officer')
   and leave_type_id = (select id from t_ids where label = 'type_off')
   and year = extract(year from now())::int;

select is(
  (select carried_in from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_off')
      and year = extract(year from now())::int),
  0::numeric,
  'view: an override cannot smuggle days past a disabled carry rule'
);

-- allocation_exists: the distinction the January prompt depends on.
select ok(
  (select allocation_exists from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_off')
      and year = extract(year from now())::int),
  'view: a saved allocation row reports allocation_exists = true'
);

select ok(
  not (select allocation_exists from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_off')
      and year = extract(year from now())::int + 1),
  'view: a year with no row reports allocation_exists = false'
);

-- A row saved as 0 must NOT read as "no row", or the officer is nagged forever.
insert into public.user_leave_balances (user_id, leave_type_id, year, allocated)
select (select id from t_ids where label = 'officer'),
       (select id from t_ids where label = 'type_off'),
       extract(year from now())::int + 1, 0;

select ok(
  (select allocation_exists from public.leave_balance_view
    where user_id = (select id from t_ids where label = 'officer')
      and leave_type_id = (select id from t_ids where label = 'type_off')
      and year = extract(year from now())::int + 1),
  'view: an allocation of 0 is a real answer, distinct from no row at all'
);

select * from finish();
rollback;
