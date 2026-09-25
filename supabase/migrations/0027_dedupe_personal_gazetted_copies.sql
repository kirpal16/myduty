-- Removes personal copies of holidays that are already global.
--
-- THE BUG
-- importGujaratGovernmentHolidays() deduplicated with `.eq("scope", scope)` —
-- it only looked for existing rows at the SAME scope. Once 0025 seeded the
-- gazetted list as GLOBAL rows, an officer running the import (which uses
-- scope 'USER' for anyone without HOLIDAY_CREATE) found no USER rows, decided
-- nothing was present, and inserted a personal copy of every festival that was
-- already there globally. Every holiday then appeared twice.
--
-- The unique index from 0025 could not stop it: a GLOBAL row and a USER row
-- differ in scope, so both are legitimately distinct rows. The duplication was
-- in what the application asked for, not in what the table allowed.
--
-- The action is fixed to check every visible scope. This clears what the old
-- version already created.
--
-- NOT affected: Holiday Leave allocations. holiday_dates_for_year() counts
-- DISTINCT dates, so a duplicated row never inflated anyone's entitlement —
-- this is a display and tidiness problem, not a balance one.
--
-- Safely re-runnable.

-- Only personal, government-flagged copies are removed, and only where a
-- GLOBAL row already covers the same festival on the same date. A personal
-- holiday the officer created themselves is never touched: it is not
-- is_government, and nothing global matches it.
delete from public.holidays personal
where personal.scope = 'USER'
  and personal.is_government = true
  and exists (
    select 1
    from public.holidays global
    where global.scope = 'GLOBAL'
      and global.holiday_date = personal.holiday_date
      and lower(btrim(global.name)) = lower(btrim(personal.name))
  );

-- Belt and braces: the same festival duplicated within one scope, which the
-- 0025 index now prevents but earlier imports could have produced. Keep the
-- oldest of each group.
delete from public.holidays h
using public.holidays keep
where h.id <> keep.id
  and h.holiday_date = keep.holiday_date
  and lower(btrim(h.name)) = lower(btrim(keep.name))
  and h.scope = keep.scope
  and coalesce(h.profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(keep.profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
  and coalesce(h.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(keep.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  and (keep.created_at, keep.id) < (h.created_at, h.id);
