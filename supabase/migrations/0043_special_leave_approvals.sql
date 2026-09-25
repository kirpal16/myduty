-- ---------------------------------------------------------------------------
-- 0043: Special Leave Approvals & Quota Enforcement
--
-- Special Leave (SPL) requires prior official sanction/approval:
-- 1. An officer applies for Z days (status PENDING).
-- 2. Authority approves ZX days (status APPROVED, with approved_date, approved_by, approved_days).
-- 3. Leave can only be logged against an APPROVED sanction, up to approved_days.
-- 4. Over-logging is blocked at the database level via a PostgreSQL trigger
--    with row-level locking on the parent application.
-- 5. Cancellation is guarded so applications with logged days cannot be cancelled
--    without removing or unlinking those logs first.
-- ---------------------------------------------------------------------------

-- 1. Applications table
create table if not exists public.special_leave_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  year int not null,
  applied_date date not null,
  applied_days numeric(4, 1) not null check (applied_days > 0),
  reason text,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approved_date date,
  approved_by text,
  approved_days numeric(4, 1) check (
    approved_days is null or (approved_days >= 0 and approved_days <= applied_days)
  ),
  order_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists special_leave_apps_user_year_idx
  on public.special_leave_applications (user_id, year, status);

alter table public.special_leave_applications enable row level security;

-- RLS: Officers manage their own applications. Super Admins can view/update all.
drop policy if exists special_leave_apps_select on public.special_leave_applications;
drop policy if exists special_leave_apps_insert on public.special_leave_applications;
drop policy if exists special_leave_apps_update on public.special_leave_applications;
drop policy if exists special_leave_apps_delete on public.special_leave_applications;

create policy special_leave_apps_select on public.special_leave_applications for select
  using (user_id = auth.uid() or public.has_permission('LEAVE_VIEW_ALL'));

create policy special_leave_apps_insert on public.special_leave_applications for insert
  with check (user_id = auth.uid());

create policy special_leave_apps_update on public.special_leave_applications for update
  using (user_id = auth.uid() or public.has_permission('LEAVE_MANAGE_ALL'))
  with check (user_id = auth.uid() or public.has_permission('LEAVE_MANAGE_ALL'));

create policy special_leave_apps_delete on public.special_leave_applications for delete
  using (user_id = auth.uid());

-- 2. Link leave_logs to special_leave_applications
alter table public.leave_logs
  add column if not exists special_leave_application_id uuid
  references public.special_leave_applications(id) on delete restrict;

create index if not exists leave_logs_spl_app_idx
  on public.leave_logs (special_leave_application_id)
  where special_leave_application_id is not null;

-- 3. Database-Level Trigger for Over-Logging Protection (Row-level lock)
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
    raise exception 'Special leave application not found';
  end if;

  if v_app.status <> 'APPROVED' then
    raise exception 'Cannot log leave against an unapproved application (status: %)', v_app.status;
  end if;

  if v_app.approved_days is null or v_app.approved_days <= 0 then
    raise exception 'Application has no approved days';
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

-- 4. Trigger to prevent cancelling or reducing an application below already logged days
create or replace function public.enforce_special_leave_cancellation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_logged_days numeric;
begin
  if TG_OP = 'UPDATE' then
    -- If status is changing to CANCELLED or REJECTED, ensure no logs are attached
    if NEW.status in ('CANCELLED', 'REJECTED') and OLD.status <> NEW.status then
      select coalesce(sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end), 0)
        into v_logged_days
        from public.leave_logs
       where special_leave_application_id = NEW.id;

      if v_logged_days > 0 then
        raise exception 'Cannot cancel application: % days have already been logged against it. Delete the leave logs first.', v_logged_days;
      end if;
    end if;

    -- If approved_days is being reduced, ensure it is not below already logged days
    if NEW.approved_days is not null and (OLD.approved_days is null or NEW.approved_days < OLD.approved_days) then
      select coalesce(sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end), 0)
        into v_logged_days
        from public.leave_logs
       where special_leave_application_id = NEW.id;

      if NEW.approved_days < v_logged_days then
        raise exception 'Cannot reduce approved days to %: % days are already logged.', NEW.approved_days, v_logged_days;
      end if;
    end if;

    NEW.updated_at := now();
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_special_leave_cancellation on public.special_leave_applications;
create trigger trg_enforce_special_leave_cancellation
  before update on public.special_leave_applications
  for each row execute function public.enforce_special_leave_cancellation();

-- 5. Updated log_leave and log_leave_with_days RPCs to accept special_leave_application_id
create or replace function public.log_leave(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text,
  p_special_leave_application_id uuid default null
) returns public.leave_logs language plpgsql security invoker as $$
declare
  v_user_id uuid := auth.uid();
  v_overlap int; v_row public.leave_logs;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if p_end_date < p_start_date then raise exception 'end date is before start date'; end if;
  if p_is_half_day and p_start_date <> p_end_date then raise exception 'a half-day entry must be a single date'; end if;
  if p_is_half_day and coalesce(p_half_day_session, '') not in ('AM','PM') then raise exception 'half-day session must be AM or PM'; end if;

  select count(*) into v_overlap from public.leave_logs
    where user_id = v_user_id
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
      and (
        not p_is_half_day or not is_half_day
        or (start_date = p_start_date and half_day_session = p_half_day_session)
      );
  if v_overlap > 0 then raise exception 'you already have a leave entry covering these dates'; end if;

  insert into public.leave_logs (
    user_id, leave_type_id, start_date, end_date, is_half_day, half_day_session, reason, special_leave_application_id
  ) values (
    v_user_id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day, p_half_day_session, p_reason, p_special_leave_application_id
  ) returning * into v_row;
  return v_row;
end; $$;

-- Also maintain backwards-compatible 6-argument overload
create or replace function public.log_leave(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text
) returns public.leave_logs language plpgsql security invoker as $$
begin
  return public.log_leave(
    p_leave_type_id, p_start_date, p_end_date,
    p_is_half_day, p_half_day_session, p_reason,
    null
  );
end; $$;

create or replace function public.log_leave_with_days(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text,
  p_days jsonb,
  p_special_leave_application_id uuid default null
) returns public.leave_logs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.leave_logs;
begin
  v_row := public.log_leave(
    p_leave_type_id, p_start_date, p_end_date,
    p_is_half_day, p_half_day_session, p_reason,
    p_special_leave_application_id
  );
  perform public.set_leave_log_days(v_row.id, p_days);
  return v_row;
end;
$$;

create or replace function public.log_leave_with_days(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text,
  p_days jsonb
) returns public.leave_logs
language plpgsql
security invoker
set search_path = public
as $$
begin
  return public.log_leave_with_days(
    p_leave_type_id, p_start_date, p_end_date,
    p_is_half_day, p_half_day_session, p_reason,
    p_days, null
  );
end;
$$;
