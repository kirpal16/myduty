-- Fix: audit_logs.actor_id, users.approved_by, and user_permissions.granted_by
-- all had no ON DELETE behavior (defaults to RESTRICT). Since these are
-- "who did this" historical references rather than live relationships,
-- that meant deleting ANY user who ever approved someone, granted a
-- permission, or performed an audited action (nearly everyone — even being
-- approved creates a row) was permanently blocked, including via Supabase
-- Studio's own "delete user" button, not just this app's UI (which doesn't
-- even have a delete-user feature yet). The historical record should
-- survive the actor's deletion — only the reference needs to go null, not
-- the fact that something happened — so offboarding a user is never
-- silently blocked by their past admin actions.
alter table public.audit_logs
  drop constraint audit_logs_actor_id_fkey,
  add constraint audit_logs_actor_id_fkey
    foreign key (actor_id) references public.users(id) on delete set null;

alter table public.users
  drop constraint users_approved_by_fkey,
  add constraint users_approved_by_fkey
    foreign key (approved_by) references public.users(id) on delete set null;

alter table public.user_permissions
  drop constraint user_permissions_granted_by_fkey,
  add constraint user_permissions_granted_by_fkey
    foreign key (granted_by) references public.users(id) on delete set null;
