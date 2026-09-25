-- ---------------------------------------------------------------------------
-- 0038: a Super Admin can manage the system leave types too
--
-- 0026 limited the admin write policy to `is_system = false`, so HL, OH and
-- SPL could not be renamed, recoloured, deactivated or deleted by anyone —
-- and because RLS answers a forbidden write with "0 rows", the admin screen
-- showed those actions succeeding while nothing changed.
--
-- The Super Admin now has full control of every global type. The app keeps
-- the guards that matter: a system type's CODE never changes (the leave
-- rules find HL/OH/SPL by it), and no type with logged leave can be deleted.
-- Officers' own personal types are unaffected (leave_types_self_write).
-- ---------------------------------------------------------------------------

drop policy if exists leave_types_write on public.leave_types;

create policy leave_types_write on public.leave_types for all
  using (public.is_super_admin() and user_id is null)
  with check (public.is_super_admin() and user_id is null);
