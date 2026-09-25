-- Phase 3: attach the audit trigger (defined in 0002) to users and
-- user_permissions, so approvals, role changes, and permission grants/
-- revokes are all captured in audit_logs.
create trigger audit_users after update on public.users
  for each row execute function public.write_audit_log('user');

create trigger audit_user_permissions after insert or delete on public.user_permissions
  for each row execute function public.write_audit_log('user_permission');
