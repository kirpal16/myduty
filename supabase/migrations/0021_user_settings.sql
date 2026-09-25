-- Per-officer duty defaults.
--
-- Holiday extra pay and shift times were retyped on every duty entry. These
-- become per-user settings so the form can pre-fill them; the amount stays
-- editable per duty because TA and allowances genuinely vary.
--
-- Deliberately per-user, not global: rates differ by posting, and there is no
-- app_settings table to hang an org-wide default on.
-- Safely re-runnable.

create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  holiday_day_rate numeric not null default 0 check (holiday_day_rate >= 0),
  default_shift_start time not null default '10:00',
  default_shift_end time not null default '18:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_self on public.user_settings;
drop policy if exists user_settings_admin_select on public.user_settings;

-- Own row only. No row is created at signup; reads fall back to the column
-- defaults and the first save upserts.
create policy user_settings_self on public.user_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_settings_admin_select on public.user_settings for select
  using (public.is_super_admin());

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
