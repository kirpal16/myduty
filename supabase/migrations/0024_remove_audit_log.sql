-- Removes the audit log entirely.
--
-- >>> THIS IS IRREVERSIBLE. <<<
-- Dropping public.audit_logs destroys every change record the system has
-- collected. There is no export step here — take a dump first if the history
-- has any value, because nothing below can bring it back.
--
-- Kept as its own migration so it can be reviewed and applied in isolation
-- rather than riding along with feature work.
--
-- Safely re-runnable.

-- Triggers first: the function cannot be dropped while they depend on it.
--
-- audit_leave_requests is deliberately absent: 0017 renamed leave_requests to
-- leave_logs, and `drop trigger if exists ... on public.leave_requests` would
-- still fail, because IF EXISTS forgives a missing trigger but not a missing
-- table.
drop trigger if exists audit_users on public.users;
drop trigger if exists audit_user_permissions on public.user_permissions;
drop trigger if exists audit_duties on public.duties;
drop trigger if exists audit_leave_logs on public.leave_logs;
drop trigger if exists audit_holidays on public.holidays;
drop trigger if exists audit_file_attachments on public.file_attachments;
drop trigger if exists audit_profiles on public.profiles;
drop trigger if exists audit_departments on public.departments;

drop function if exists public.write_audit_log();

drop policy if exists audit_logs_select on public.audit_logs;
drop table if exists public.audit_logs;

-- The permission existed only to gate the page being deleted. Any grants of it
-- disappear with it: user_permissions.permission_id is ON DELETE CASCADE
-- (0001_core_schema.sql:78), so this needs no companion cleanup.
delete from public.permissions where code = 'AUDIT_VIEW';
