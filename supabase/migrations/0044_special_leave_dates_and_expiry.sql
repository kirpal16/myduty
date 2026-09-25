-- ---------------------------------------------------------------------------
-- 0044: Leave Approvals (SPL + LWP), Date Ranges, 6-Month Expiry & Daily Salary
--
-- 1. Adds Binpagari Leave (બિનપગારી રજા) [LWP] as a system leave type.
-- 2. Generalizes special_leave_applications by adding leave_type_id referencing leave_types.
-- 3. Adds optional date range (valid_from, valid_to) to special_leave_applications.
-- 4. Adds expires_at date: automatically computed as approved_date + 6 months
--    when an application is approved.
-- 5. Trigger automatically populates expires_at when approved_date is set/updated.
-- 6. Over-logging trigger enforce_special_leave_limits blocks logging against
--    expired sanctions (where leave start_date > expires_at).
-- 7. Adds daily_salary_rate to user_settings for unpaid leave salary deduction calculations.
-- ---------------------------------------------------------------------------

-- 1. Insert Binpagari Leave (બિનપગારી રજા) system leave type
insert into public.leave_types (name, code, is_active, color, is_system)
select 'Binpagari Leave (બિનપગારી રજા)', 'LWP', true, '#e11d48', true
where not exists (
  select 1 from public.leave_types where code = 'LWP' and user_id is null
);

-- 2. Add columns to special_leave_applications
alter table public.special_leave_applications
  add column if not exists leave_type_id uuid references public.leave_types(id) on delete cascade,
  add column if not exists valid_from date,
  add column if not exists valid_to date,
  add column if not exists expires_at date;

-- Backfill existing rows with SPL leave type id
update public.special_leave_applications
   set leave_type_id = (select id from public.leave_types where code = 'SPL' and user_id is null limit 1)
 where leave_type_id is null;

-- Add check constraint to ensure valid_to is on or after valid_from when both provided
alter table public.special_leave_applications
  drop constraint if exists special_leave_valid_range_chk;

alter table public.special_leave_applications
  add constraint special_leave_valid_range_chk
  check (
    (valid_from is null or valid_to is null) or (valid_to >= valid_from)
  );

-- 3. Add daily_salary_rate to user_settings
alter table public.user_settings
  add column if not exists daily_salary_rate numeric(10, 2) default 0;

-- 4. Trigger function to compute expires_at on approval
create or replace function public.compute_special_leave_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- When status is APPROVED and approved_date is set, calculate 6-month expiry
  if NEW.status = 'APPROVED' and NEW.approved_date is not null then
    NEW.expires_at := (NEW.approved_date + interval '6 months')::date;
  elsif NEW.status in ('PENDING', 'REJECTED', 'CANCELLED') then
    NEW.expires_at := null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_compute_special_leave_expiry on public.special_leave_applications;
create trigger trg_compute_special_leave_expiry
  before insert or update of status, approved_date on public.special_leave_applications
  for each row execute function public.compute_special_leave_expiry();

-- Backfill existing approved applications with expires_at
update public.special_leave_applications
   set expires_at = (approved_date + interval '6 months')::date
 where status = 'APPROVED'
   and approved_date is not null
   and expires_at is null;

-- 5. Update over-logging trigger to enforce 6-month expiration rule
create or replace function public.enforce_special_leave_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.special_leave_applications;
  v_already_logged numeric;
  v_incoming_days numeric;
begin
  if NEW.special_leave_application_id is null then
    return NEW;
  end if;

  -- Lock the application row to prevent race conditions during concurrent logging
  select * into v_app
    from public.special_leave_applications
   where id = NEW.special_leave_application_id
   for update;

  if not found then
    raise exception 'Leave approval application not found';
  end if;

  if v_app.status <> 'APPROVED' then
    raise exception 'Cannot log leave against an unapproved application (status: %)', v_app.status;
  end if;

  if v_app.approved_days is null or v_app.approved_days <= 0 then
    raise exception 'Application has no approved days';
  end if;

  -- Expiration enforcement: Check if sanction has expired
  if v_app.expires_at is not null and (NEW.start_date > v_app.expires_at) then
    raise exception 'Cannot log leave: Leave sanction expired on % (valid for 6 months from approval date %)',
      v_app.expires_at, v_app.approved_date;
  end if;

  -- Calculate days already logged for this application (excluding this log if updating)
  select coalesce(sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end), 0)
    into v_already_logged
    from public.leave_logs
   where special_leave_application_id = NEW.special_leave_application_id
     and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_incoming_days := case when NEW.is_half_day then 0.5 else (NEW.end_date - NEW.start_date + 1) end;

  if (v_already_logged + v_incoming_days) > v_app.approved_days then
    raise exception 'Cannot log % days: only % days remain out of % approved days for this sanction',
      v_incoming_days,
      (v_app.approved_days - v_already_logged),
      v_app.approved_days;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_special_leave_limits on public.leave_logs;
create trigger trg_enforce_special_leave_limits
  before insert or update on public.leave_logs
  for each row execute function public.enforce_special_leave_limits();
