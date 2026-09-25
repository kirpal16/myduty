-- Phase 8 introduces the first admin UI that mutates profiles/departments
-- directly (previously only touched by seed.sql) — attach the audit
-- trigger now that there's something worth auditing.
create trigger audit_profiles after insert or update on public.profiles
  for each row execute function public.write_audit_log('profile');

create trigger audit_departments after insert or update on public.departments
  for each row execute function public.write_audit_log('department');
