-- Personal leave types, layered on top of the admin's.
--
--   Admin/global leave type (user_id is null)  -> available to every officer
--   Personal leave type     (user_id = <uid>)  -> visible to that officer only
--
-- An officer's picker is "global types + my own types". The admin set stays
-- read-only to them; only their own rows are editable. Colour moves onto the
-- type so the calendar can stop hardcoding one shade per event category.
-- Safely re-runnable.
--
-- >>> BEFORE APPLYING <<< inspect the live data for rows this migration's
-- indexes would reject, and resolve them first rather than forcing the index:
--   select profile_id, code, count(*) from public.leave_types
--     group by 1,2 having count(*) > 1;
--   select profile_id, count(*) from public.leave_types group by 1;

alter table public.leave_types
  add column if not exists user_id uuid references public.users(id) on delete cascade,
  add column if not exists color text not null default '#10b981';

alter table public.leave_types drop constraint if exists leave_types_color_hex;
alter table public.leave_types
  add constraint leave_types_color_hex check (color ~ '^#[0-9a-fA-F]{6}$');

-- A personal type belongs to one officer, not to a profile.
alter table public.leave_types drop constraint if exists leave_types_personal_has_no_profile;
alter table public.leave_types
  add constraint leave_types_personal_has_no_profile check (
    user_id is null or profile_id is null
  );

-- The old unique(profile_id, code) would stop an officer creating a personal
-- "OTHER" alongside the global one. Split it into two partial indexes so each
-- namespace is unique on its own.
alter table public.leave_types drop constraint if exists leave_types_profile_id_code_key;
drop index if exists public.leave_types_global_code_idx;
drop index if exists public.leave_types_user_code_idx;

create unique index leave_types_global_code_idx on public.leave_types
  (coalesce(profile_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
  where user_id is null;

create unique index leave_types_user_code_idx on public.leave_types (user_id, code)
  where user_id is not null;

-- Officers see the global set plus their own; they write only their own.
-- The super-admin write policy is scoped to the global set so an admin cannot
-- silently edit somebody's personal type.
drop policy if exists leave_types_select on public.leave_types;
drop policy if exists leave_types_write on public.leave_types;
drop policy if exists leave_types_self_write on public.leave_types;

create policy leave_types_select on public.leave_types for select
  using (public.is_approved() and (user_id is null or user_id = auth.uid()));

create policy leave_types_write on public.leave_types for all
  using (public.is_super_admin() and user_id is null)
  with check (public.is_super_admin() and user_id is null);

create policy leave_types_self_write on public.leave_types for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Give the seeded global types distinguishable calendar colours.
update public.leave_types set color = v.color
from (values
  ('CL',           '#3b82f6'),  -- blue
  ('PL',           '#8b5cf6'),  -- violet
  ('MEDICAL',      '#ef4444'),  -- red
  ('SICK',         '#f59e0b'),  -- amber
  ('COMPENSATORY', '#14b8a6'),  -- teal
  ('OTHER',        '#64748b')   -- slate
) as v(code, color)
where public.leave_types.code = v.code
  and public.leave_types.user_id is null
  and public.leave_types.color = '#10b981';
