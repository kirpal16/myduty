-- Phase 4: duty module. Own duties always visible via RLS; DUTY_VIEW_ALL
-- needed to see others'. DUTY_CREATE is admin/scheduler-assigned (no
-- user_id = auth.uid() check on insert), matching the decision that
-- regular officers don't self-schedule duties.
create extension if not exists btree_gist;

create type public.duty_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');

create table public.duties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  duty_type_id uuid not null references public.duty_types(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  status public.duty_status not null default 'SCHEDULED',
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- DB-level double-booking prevention: a user cannot have two non-cancelled
  -- duties with overlapping time ranges.
  exclude using gist (user_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status <> 'CANCELLED')
);

alter table public.duties enable row level security;

create policy duties_select on public.duties for select
  using (user_id = auth.uid() or public.has_permission('DUTY_VIEW_ALL'));
create policy duties_insert on public.duties for insert
  with check (public.has_permission('DUTY_CREATE'));
create policy duties_update on public.duties for update
  using (public.has_permission('DUTY_EDIT'));
create policy duties_delete on public.duties for delete
  using (public.has_permission('DUTY_DELETE'));

create trigger set_duties_updated_at before update on public.duties
  for each row execute function public.set_updated_at();

create trigger audit_duties after insert or update or delete on public.duties
  for each row execute function public.write_audit_log('duty');
