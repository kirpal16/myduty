-- Migration 0034: Officer Profile Extensions & Career Timeline
-- 1. Add personal and professional service columns to users table
-- 2. Create officer_timeline table for milestones (Joining, Training, Posting, Transfer, Promotion, Duty, Achievement)
-- 3. Create security definer function create_or_get_department for dynamic department addition
-- 4. Create update_own_officer_profile security definer RPC

-- 1. Extend users table
alter table public.users
  add column if not exists designation text,
  add column if not exists joining_date date,
  add column if not exists joining_place text,
  add column if not exists current_posting text,
  add column if not exists date_of_birth date,
  add column if not exists blood_group text,
  add column if not exists emergency_contact text,
  add column if not exists home_district text,
  add column if not exists bio text;

-- 2. Create officer_timeline table
create table if not exists public.officer_timeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'JOINING',
      'TRAINING',
      'POSTING',
      'TRANSFER',
      'PROMOTION',
      'SPECIAL_DUTY',
      'ACHIEVEMENT',
      'OTHER'
    )
  ),
  title text not null,
  designation text,
  department text,
  location text,
  from_location text,
  to_location text,
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_timeline_dates check (end_date is null or end_date >= start_date)
);

-- Trigger to auto-update updated_at
drop trigger if exists set_officer_timeline_updated_at on public.officer_timeline;
create trigger set_officer_timeline_updated_at
  before update on public.officer_timeline
  for each row execute function public.set_updated_at();

-- Index for timeline ordering by user and date
create index if not exists idx_officer_timeline_user_date
  on public.officer_timeline(user_id, start_date desc);

-- RLS policies for officer_timeline
alter table public.officer_timeline enable row level security;

drop policy if exists timeline_select on public.officer_timeline;
create policy timeline_select on public.officer_timeline for select
  using (user_id = auth.uid() or public.is_super_admin());

drop policy if exists timeline_insert on public.officer_timeline;
create policy timeline_insert on public.officer_timeline for insert
  with check (user_id = auth.uid());

drop policy if exists timeline_update on public.officer_timeline;
create policy timeline_update on public.officer_timeline for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists timeline_delete on public.officer_timeline;
create policy timeline_delete on public.officer_timeline for delete
  using (user_id = auth.uid());

-- 3. Dynamic Department Creation (allows users to add missing departments)
create or replace function public.create_or_get_department(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_trimmed text;
  v_code text;
  v_row public.departments;
begin
  v_trimmed := trim(p_name);
  if length(v_trimmed) < 2 then
    raise exception 'Department name must have at least 2 characters';
  end if;

  -- Case-insensitive search for existing department
  select * into v_row
  from public.departments
  where lower(name) = lower(v_trimmed)
  limit 1;

  if found then
    return json_build_object(
      'id', v_row.id,
      'name', v_row.name,
      'code', v_row.code,
      'is_new', false
    );
  end if;

  -- Generate uppercase slug code
  v_code := upper(regexp_replace(v_trimmed, '[^a-zA-Z0-9]+', '_', 'g'));
  v_code := trim(both '_' from v_code);
  if length(v_code) = 0 then
    v_code := 'DEPT';
  end if;

  -- If code already taken, append random hex
  if exists (select 1 from public.departments where code = v_code) then
    v_code := substr(v_code, 1, 15) || '_' || substr(md5(random()::text), 1, 4);
  end if;

  insert into public.departments (name, code, is_active)
  values (v_trimmed, v_code, true)
  returning * into v_row;

  return json_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'code', v_row.code,
    'is_new', true
  );
end;
$$;

-- 4. RPC for updating complete officer profile details
create or replace function public.update_own_officer_profile(
  p_full_name text,
  p_phone text,
  p_department_id uuid,
  p_designation text,
  p_employee_code text,
  p_joining_date date,
  p_joining_place text,
  p_current_posting text,
  p_date_of_birth date,
  p_blood_group text,
  p_emergency_contact text,
  p_home_district text,
  p_bio text
) returns public.users language plpgsql security definer set search_path = public as $$
declare
  v_row public.users;
begin
  update public.users
  set
    full_name = coalesce(p_full_name, full_name),
    phone = coalesce(p_phone, phone),
    department_id = p_department_id,
    designation = p_designation,
    employee_code = coalesce(p_employee_code, employee_code),
    joining_date = p_joining_date,
    joining_place = p_joining_place,
    current_posting = p_current_posting,
    date_of_birth = p_date_of_birth,
    blood_group = p_blood_group,
    emergency_contact = p_emergency_contact,
    home_district = p_home_district,
    bio = p_bio
  where id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;
