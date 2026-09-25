-- Per-user leave type preference: allow officers to disable leave types
-- (both department global types and personal types) for themselves.
-- When disabled, the leave type will not appear in their leave log form dropdown.

create table if not exists public.user_disabled_leave_types (
  user_id uuid not null references public.users(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, leave_type_id)
);

create index if not exists idx_user_disabled_leave_types_user on public.user_disabled_leave_types (user_id);

alter table public.user_disabled_leave_types enable row level security;

drop policy if exists user_disabled_leave_types_select on public.user_disabled_leave_types;
drop policy if exists user_disabled_leave_types_insert on public.user_disabled_leave_types;
drop policy if exists user_disabled_leave_types_delete on public.user_disabled_leave_types;

create policy user_disabled_leave_types_select on public.user_disabled_leave_types
  for select using (auth.uid() = user_id);

create policy user_disabled_leave_types_insert on public.user_disabled_leave_types
  for insert with check (auth.uid() = user_id);

create policy user_disabled_leave_types_delete on public.user_disabled_leave_types
  for delete using (auth.uid() = user_id);
