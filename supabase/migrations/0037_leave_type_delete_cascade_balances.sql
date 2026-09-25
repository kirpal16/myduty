-- ---------------------------------------------------------------------------
-- 0037: deleting a leave type removes its allowance rows
--
-- user_leave_balances.leave_type_id (0009) was the one reference to
-- leave_types without ON DELETE CASCADE. So a type nobody had ever logged
-- leave against still could not be deleted the moment any officer (or the
-- allowance prompt) had set a yearly allowance for it — Postgres refused with
-- a foreign-key error. The carry-forward rules (0028) and per-user disabled
-- flags (0031) already cascade; allowances now do too.
--
-- Logged leave stays protected: leave_logs and leave_log_days keep their
-- restricting references, and the app refuses to delete a type that has any.
-- ---------------------------------------------------------------------------

alter table public.user_leave_balances
  drop constraint if exists user_leave_balances_leave_type_id_fkey;

alter table public.user_leave_balances
  add constraint user_leave_balances_leave_type_id_fkey
  foreign key (leave_type_id) references public.leave_types(id) on delete cascade;
