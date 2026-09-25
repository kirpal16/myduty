-- Tests for public.holiday_dates_for_year(), the function every Holiday Leave
-- number is derived from.
--
-- It earns a dedicated test because its failure mode is silent: a wrong count
-- still looks like a plausible count. Nobody would notice an allocation of 77
-- that should have been 78 — but they would notice the day it refuses a leave
-- they are entitled to.
--
-- Run against a local database (never a hosted one — it writes fixtures):
--   supabase start
--   supabase test db
--
-- Requires pgTAP:  create extension if not exists pgtap;

begin;
create extension if not exists pgtap;
select plan(16);

-- ---------------------------------------------------------------------------
-- Fixtures: two officers on two different profiles, so cross-officer and
-- cross-profile leakage can actually be observed rather than assumed absent.
-- ---------------------------------------------------------------------------
create temporary table t_ids (label text primary key, id uuid);

insert into t_ids values
  ('profile_a', gen_random_uuid()),
  ('profile_b', gen_random_uuid()),
  ('officer_a', gen_random_uuid()),
  ('officer_b', gen_random_uuid());

insert into public.profiles (id, name, code, is_active)
select id, 'Profile A', 'PROF_A', true from t_ids where label = 'profile_a';
insert into public.profiles (id, name, code, is_active)
select id, 'Profile B', 'PROF_B', true from t_ids where label = 'profile_b';

insert into public.users (id, profile_id, role, status, full_name)
select (select id from t_ids where label = 'officer_a'),
       (select id from t_ids where label = 'profile_a'),
       'USER', 'APPROVED', 'Officer A';
insert into public.users (id, profile_id, role, status, full_name)
select (select id from t_ids where label = 'officer_b'),
       (select id from t_ids where label = 'profile_b'),
       'USER', 'APPROVED', 'Officer B';

-- 2026 dates used below, chosen for their weekday:
--   2026-09-05  1st Saturday   (working day)
--   2026-09-12  2nd Saturday   (holiday)
--   2026-09-19  3rd Saturday   (working day)
--   2026-09-26  4th Saturday   (holiday)
--   2026-08-29  5th Saturday   (working day)
--   2026-09-06  Sunday         (holiday)
--   2026-09-08  Tuesday        (working day)
insert into public.holidays (name, holiday_date, scope, is_government)
values ('Global Festival', '2026-03-10', 'GLOBAL', false),
       ('Global Gazetted', '2026-03-11', 'GLOBAL', true);

insert into public.holidays (name, holiday_date, scope, profile_id)
select 'Profile A Off', '2026-03-12', 'PROFILE', id from t_ids where label = 'profile_a';
insert into public.holidays (name, holiday_date, scope, profile_id)
select 'Profile B Off', '2026-03-13', 'PROFILE', id from t_ids where label = 'profile_b';

insert into public.holidays (name, holiday_date, scope, user_id)
select 'Officer A Personal', '2026-03-14', 'USER', id from t_ids where label = 'officer_a';
insert into public.holidays (name, holiday_date, scope, user_id)
select 'Officer B Personal', '2026-03-16', 'USER', id from t_ids where label = 'officer_b';

-- The regression this file exists for: a personal row that is ALSO flagged
-- government. is_government is a label, not a grant — treating it as one would
-- let officer B's private import inflate officer A's entitlement.
insert into public.holidays (name, holiday_date, scope, user_id, is_government)
select 'Officer B Gazetted Import', '2026-03-17', 'USER', id, true
from t_ids where label = 'officer_b';

-- A gazetted festival deliberately placed on a Sunday, to prove the count is
-- over distinct DATES and not over sources.
insert into public.holidays (name, holiday_date, scope, is_government)
values ('Festival On A Sunday', '2026-09-06', 'GLOBAL', true);

-- Two rows on one date, from different scopes.
insert into public.holidays (name, holiday_date, scope, user_id)
select 'Also Mine', '2026-03-10', 'USER', id from t_ids where label = 'officer_a';

-- ---------------------------------------------------------------------------
-- The function is SECURITY DEFINER and gates on auth.uid(), so the tests run
-- as officer A. This helper stands in for Supabase's auth.uid().
-- ---------------------------------------------------------------------------
create or replace function pg_temp.as_officer_a() returns setof date
language sql as $$
  select public.holiday_dates_for_year(
    2026, (select id from t_ids where label = 'officer_a'));
$$;

set local role postgres;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id::text from t_ids where label = 'officer_a'))::text,
  true);

create temporary view v_dates as select d from pg_temp.as_officer_a() d;

-- ---------------------------------------------------------------------------
-- Scope-based visibility
-- ---------------------------------------------------------------------------
select ok((select bool_or(d = '2026-03-10') from v_dates),
          'GLOBAL holiday is included');

select ok((select bool_or(d = '2026-03-11') from v_dates),
          'GLOBAL + is_government is included (because GLOBAL, not the flag)');

select ok((select bool_or(d = '2026-03-14') from v_dates),
          'USER holiday owned by the officer is included');

select ok((select coalesce(bool_and(d <> '2026-03-16'), true) from v_dates),
          'USER holiday owned by ANOTHER officer is excluded');

select ok((select coalesce(bool_and(d <> '2026-03-17'), true) from v_dates),
          'USER + is_government owned by another officer is excluded');

select ok((select bool_or(d = '2026-03-12') from v_dates),
          'PROFILE holiday on the officer''s own profile is included');

select ok((select coalesce(bool_and(d <> '2026-03-13'), true) from v_dates),
          'PROFILE holiday on a different profile is excluded');

-- ---------------------------------------------------------------------------
-- Weekend rule
-- ---------------------------------------------------------------------------
select ok((select bool_or(d = '2026-09-06') from v_dates), 'Sunday is included');
select ok((select bool_or(d = '2026-09-12') from v_dates), '2nd Saturday is included');
select ok((select bool_or(d = '2026-09-26') from v_dates), '4th Saturday is included');

select ok((select coalesce(bool_and(d <> '2026-09-05'), true) from v_dates),
          '1st Saturday is excluded');
select ok((select coalesce(bool_and(d <> '2026-09-19'), true) from v_dates),
          '3rd Saturday is excluded');
select ok((select coalesce(bool_and(d <> '2026-08-29'), true) from v_dates),
          '5th Saturday is excluded');
select ok((select coalesce(bool_and(d <> '2026-09-08'), true) from v_dates),
          'an ordinary weekday is excluded');

-- ---------------------------------------------------------------------------
-- Counted once, however many sources agree
-- ---------------------------------------------------------------------------
select is((select count(*)::int from v_dates where d = '2026-09-06'), 1,
          'a gazetted festival falling on a Sunday is counted once');

select is((select count(*)::int from v_dates where d = '2026-03-10'), 1,
          'a date carrying both a GLOBAL and a personal row is counted once');

select * from finish();
rollback;
