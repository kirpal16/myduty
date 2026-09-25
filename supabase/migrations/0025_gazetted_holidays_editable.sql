-- Gazetted holidays become editable data instead of hardcoded TypeScript.
--
-- Until now the Gujarat government holiday list lived in
-- src/lib/holidays/weekendRules.ts (GUJARAT_GOVT_HOLIDAYS_CATALOG, 2026 and
-- 2027 only) and resolveHoliday() consulted it alongside this table. That made
-- the list impossible to correct -- a wrong date needed a code change and a
-- deploy -- and let the calendar and the database disagree about the same day.
--
-- This migration makes the table the single source of truth: it seeds the
-- catalog in as GLOBAL rows, and adds the UPDATE policy that has never existed.
-- Without the seed, demoting the catalog in code would make every gazetted
-- holiday silently vanish from the calendar.
--
-- Safely re-runnable.

-- ---------------------------------------------------------------------------
-- 1. Editing was never possible: 0013 created SELECT, INSERT and DELETE
--    policies and no UPDATE. With RLS on and no policy, an update matches zero
--    rows and reports success -- an edit feature would have appeared to work
--    and silently changed nothing.
-- ---------------------------------------------------------------------------
drop policy if exists holidays_update on public.holidays;
create policy holidays_update on public.holidays for update
  using (
    (scope = 'USER' and user_id = auth.uid())
    or (scope in ('GLOBAL','PROFILE')
        and (public.has_permission('HOLIDAY_CREATE') or public.is_super_admin()))
  )
  with check (
    (scope = 'USER' and user_id = auth.uid())
    or (scope in ('GLOBAL','PROFILE')
        and (public.has_permission('HOLIDAY_CREATE') or public.is_super_admin()))
  );

-- ---------------------------------------------------------------------------
-- 2. Seed the catalog as GLOBAL government holidays.
--    GLOBAL is what makes them count for every officer. Scope is the only
--    thing that grants visibility -- is_government is a label, not a grant,
--    and an officer's own USER-scoped import must never leak into anyone
--    else's calendar or Holiday Leave count.
-- ---------------------------------------------------------------------------
insert into public.holidays (name, holiday_date, scope, is_government, is_recurring_yearly)
select v.name, v.holiday_date::date, 'GLOBAL', true, false
from (values
  ('Makar Sankranti / Uttarayan (ઉત્તરાયણ)', '2026-01-14'),
  ('Vasi Uttarayan (વાસી ઉત્તરાયણ)', '2026-01-15'),
  ('Republic Day (પ્રજાસત્તાક દિન)', '2026-01-26'),
  ('Maha Shivratri (મહા શિવરાત્રિ)', '2026-02-15'),
  ('Holi 2nd Day - Dhuleti (ધૂળેટી)', '2026-03-04'),
  ('Cheti Chand (ચેટીચાંદ)', '2026-03-20'),
  ('Ramzan-Id / Eid-ul-Fitr (રમઝાન ઈદ)', '2026-03-21'),
  ('Shree Ram Navami (રામ નવમી)', '2026-03-28'),
  ('Mahavir Janma Kalyanak (મહાવીર જયંતિ)', '2026-03-31'),
  ('Good Friday (ગુડ ફ્રાઈડે)', '2026-04-03'),
  ('Dr. B. R. Ambedkar Jayanti (ડૉ. બાબાસાહેબ આંબેડકર જયંતિ)', '2026-04-14'),
  ('Gujarat Gaurav Divas (ગુજરાત ગૌરવ દિવસ)', '2026-05-01'),
  ('Bakri-Id / Eid-ul-Adha (બકરી ઈદ)', '2026-05-28'),
  ('Muharram (મોહરમ)', '2026-06-26'),
  ('Independence Day (સ્વાતંત્ર્ય દિન)', '2026-08-15'),
  ('Raksha Bandhan (રક્ષાબંધન)', '2026-08-28'),
  ('Janmashtami (જન્માષ્ટમી - કૃષ્ણ જન્મોત્સવ)', '2026-09-04'),
  ('Samvatsari / Ganesh Chaturthi (સંવત્સરી / ગણેશ ચતુર્થી)', '2026-09-14'),
  ('Eid-e-Milad (ઈદ-એ-મિલાદ)', '2026-09-25'),
  ('Mahatma Gandhi Jayanti (ગાંધી જયંતિ)', '2026-10-02'),
  ('Dussehra / Vijaya Dashami (વિજયાદશમી - દશેરા)', '2026-10-20'),
  ('Sardar Vallabhbhai Patel Jayanti (સરદાર પટેલ જયંતિ)', '2026-10-31'),
  ('Diwali (દિવાળી)', '2026-11-08'),
  ('New Year Day / Bestu Varas (નૂતન વર્ષાભિનંદન / બેસતું વર્ષ)', '2026-11-10'),
  ('Bhai Bij (ભાઈબીજ)', '2026-11-11'),
  ('Guru Nanak Jayanti (ગુરુ નાનક જયંતિ)', '2026-11-24'),
  ('Christmas (નાતાલ)', '2026-12-25'),
  ('Makar Sankranti / Uttarayan (ઉત્તરાયણ)', '2027-01-14'),
  ('Republic Day (પ્રજાસત્તાક દિન)', '2027-01-26'),
  ('Maha Shivratri (મહા શિવરાત્રિ)', '2027-03-06'),
  ('Holi 2nd Day - Dhuleti (ધૂળેટી)', '2027-03-23'),
  ('Dr. B. R. Ambedkar Jayanti (ડૉ. બાબાસાહેબ આંબેડકર જયંતિ)', '2027-04-14'),
  ('Gujarat Gaurav Divas (ગુજરાત ગૌરવ દિવસ)', '2027-05-01'),
  ('Independence Day (સ્વાતંત્ર્ય દિન)', '2027-08-15'),
  ('Janmashtami (જન્માષ્ટમી)', '2027-08-25'),
  ('Mahatma Gandhi Jayanti (ગાંધી જયંતિ)', '2027-10-02'),
  ('Dussehra (દશેરા)', '2027-10-10'),
  ('Diwali (દિવાળી)', '2027-10-29'),
  ('New Year Day / Bestu Varas (બેસતું વર્ષ)', '2027-10-31'),
  ('Christmas (નાતાલ)', '2027-12-25')
) as v(name, holiday_date)
where not exists (
  select 1 from public.holidays h
  where h.holiday_date = v.holiday_date::date
    and h.name = v.name
    and h.scope = 'GLOBAL'
);

-- ---------------------------------------------------------------------------
-- 3. Dedup before the unique index, or creating it would abort the migration.
--    The importer deduplicated in application code only, so repeat syncs
--    before this release could leave genuine duplicates behind. Keep the
--    oldest row of each group -- it is the one other records may reference.
-- ---------------------------------------------------------------------------
delete from public.holidays h
using public.holidays keep
where h.id <> keep.id
  and h.holiday_date = keep.holiday_date
  and h.name = keep.name
  and h.scope = keep.scope
  and coalesce(h.profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(keep.profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
  and coalesce(h.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(keep.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  and (keep.created_at, keep.id) < (h.created_at, h.id);

-- A unique INDEX, not a table constraint: Postgres constraints cannot contain
-- expressions, and the coalesce() calls are what let two officers each hold a
-- personal holiday with the same name and date.
--
-- The sentinels can never collide across scopes, because 0013 already enforces
-- by CHECK that profile_id and user_id are mutually exclusive and determined
-- entirely by scope (GLOBAL -> both null, PROFILE -> profile_id, USER -> user_id).
create unique index if not exists holidays_unique_effective_idx
  on public.holidays (
    holiday_date,
    name,
    scope,
    coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(user_id,    '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Supports the per-officer visibility lookup that the Holiday Leave count runs
-- once per day of the year.
create index if not exists holidays_date_visibility_idx
  on public.holidays (holiday_date, scope, profile_id, user_id);
