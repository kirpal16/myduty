-- Add enable_multi_duty toggle to user_settings
-- Allows officers to toggle between standard single-duty mode and single-day multi-duty mode.

alter table public.user_settings
  add column if not exists enable_multi_duty boolean default false;
