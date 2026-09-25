-- ---------------------------------------------------------------------------
-- 0030: close public access to duties_tz_correction_backup.
--
-- THE PROBLEM
--   `public.duties_tz_correction_backup` exists in the hosted database with
--   RLS disabled (Supabase shows it as UNRESTRICTED). It lives in the `public`
--   schema, which PostgREST exposes to anyone holding the anon key, so any
--   logged-in officer could read every officer's duty rows from it --
--   locations, TA amounts, notes. `duties` itself is protected; its backup
--   was not.
--
--   The table was created directly against the database: nothing in
--   supabase/, src/ or scripts/ creates or references it. This migration is
--   the first time the repo acknowledges it exists.
--
-- WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT
--   Enables RLS and creates NO policies. In Postgres that means deny-all for
--   the anon and authenticated roles -- the table becomes unreachable through
--   the API. It stays fully readable by `service_role` and by anyone with the
--   database password, so a restore from this backup is unaffected.
--
--   It does NOT drop the table and does NOT move it. Dropping is irreversible
--   and nothing in the repo records whether the timezone correction it backs
--   up was ever verified. See the follow-up steps at the bottom of this file.
--
-- SAFE TO RUN ANYWHERE
--   Guarded with to_regclass, so on a database that has no such table -- a
--   fresh `supabase db reset`, or CI -- this is a no-op rather than an error.
--   Re-running it is also a no-op.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.duties_tz_correction_backup') is null then
    raise notice '0030: public.duties_tz_correction_backup not present - nothing to secure.';
    return;
  end if;

  -- No policies follow, and that is the point: RLS with zero policies denies
  -- every row to every non-superuser role. service_role bypasses RLS entirely,
  -- so restores and admin scripts keep working.
  execute 'alter table public.duties_tz_correction_backup enable row level security';

  -- Belt and braces. RLS alone already blocks the API roles; revoking the
  -- table grants means a policy added later by accident cannot silently
  -- re-expose it either.
  execute 'revoke all on table public.duties_tz_correction_backup from anon, authenticated';

  raise notice '0030: RLS enabled and API grants revoked on duties_tz_correction_backup.';
end
$$;

-- ---------------------------------------------------------------------------
-- FOLLOW-UP, once you have decided about the backup. Not run by this file.
--
-- 1. Verify the correction actually landed before you consider deleting the
--    only copy of the pre-correction data. Row counts first:
--
--      select
--        (select count(*) from public.duties)                        as live_rows,
--        (select count(*) from public.duties_tz_correction_backup)   as backup_rows;
--
--    Then confirm the shift is what you expected, and uniform -- a correction
--    that moved some rows and not others is the case worth catching:
--
--      select distinct
--             d.starts_at - b.starts_at as shift,
--             count(*) over (partition by d.starts_at - b.starts_at) as rows
--        from public.duties d
--        join public.duties_tz_correction_backup b using (id)
--       order by rows desc;
--
-- 2. Then move it out of the API's reach for good. Reversible, and it keeps
--    the data:
--
--      create schema if not exists backup;
--      alter table public.duties_tz_correction_backup set schema backup;
--
-- 3. Only when you are certain you will never restore from it:
--
--      drop table backup.duties_tz_correction_backup;
--
--    There is no undo for step 3. Take a project backup first.
-- ---------------------------------------------------------------------------
