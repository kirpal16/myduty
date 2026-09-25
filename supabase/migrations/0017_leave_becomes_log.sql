-- v3 rework: this app is a LOG BOOK, not an approval workflow. An officer
-- takes leave through their real-world official channel and then records it
-- here. There is no apply -> approve cycle, so leave entries carry no status
-- at all: a leave log is simply a record that leave was taken.
--
-- Written to be safely re-runnable: the rename is guarded, and every drop
-- uses IF EXISTS, so a partial state doesn't block another attempt.

-- The approval path disappears entirely.
drop function if exists public.approve_leave(uuid);
drop function if exists public.reject_leave(uuid);
drop function if exists public.apply_leave(uuid, date, date, boolean, text, text);

-- "requests" is now actively misleading. (Constraint names keep their old
-- leave_requests_* prefix — Postgres doesn't rename them with the table, and
-- the app's PostgREST embeds reference them by that name.)
do $$
begin
  if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'leave_requests')
     and not exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'leave_logs')
  then
    alter table public.leave_requests rename to leave_logs;
  end if;
end $$;

-- Policies must go BEFORE the columns they reference: the old
-- self-transition policy depends on `status`, and Postgres refuses to drop
-- a column an existing policy still reads.
drop policy if exists leave_requests_select on public.leave_logs;
drop policy if exists leave_requests_insert on public.leave_logs;
drop policy if exists leave_requests_self_transition on public.leave_logs;

drop view if exists public.leave_balance_view;

alter table public.leave_logs drop column if exists status;
alter table public.leave_logs drop column if exists approved_by;
alter table public.leave_logs drop column if exists approved_at;
drop type if exists public.leave_status;

-- Counts EVERY logged entry now (there is no status to filter on).
-- `remaining` may legitimately go negative — that is the over-allowance
-- signal the UI surfaces rather than something to prevent.
create view public.leave_balance_view as
select
  b.user_id,
  b.leave_type_id,
  b.year,
  b.allocated,
  coalesce(u.used_days, 0) as used,
  b.allocated - coalesce(u.used_days, 0) as remaining
from public.user_leave_balances b
left join (
  select user_id, leave_type_id,
         extract(year from start_date)::int as year,
         sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end) as used_days
  from public.leave_logs
  group by user_id, leave_type_id, extract(year from start_date)
) u on u.user_id = b.user_id and u.leave_type_id = b.leave_type_id and u.year = b.year;

-- log_leave(): keeps date/half-day validation and the half-day-aware overlap
-- rule, but drops the balance check and the user_leave_balances row lock —
-- with no hard limit there is no race left to protect against.
--
-- Note this is back to `security invoker`. The `security definer` escalation
-- in 0012 existed ONLY to work around Postgres requiring UPDATE-policy rights
-- for SELECT ... FOR UPDATE. With the lock gone, invoker is correct and
-- safer: the insert and the overlap read are both own-row operations that
-- ordinary RLS already permits.
create or replace function public.log_leave(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text
) returns public.leave_logs language plpgsql security invoker as $$
declare
  v_user_id uuid := auth.uid();
  v_overlap int; v_row public.leave_logs;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if p_end_date < p_start_date then raise exception 'end date is before start date'; end if;
  if p_is_half_day and p_start_date <> p_end_date then raise exception 'a half-day entry must be a single date'; end if;
  if p_is_half_day and coalesce(p_half_day_session, '') not in ('AM','PM') then raise exception 'half-day session must be AM or PM'; end if;

  -- Overlap rule: any date overlap conflicts, UNLESS both entries are
  -- half-days on the same single date in different sessions (AM + PM coexist).
  select count(*) into v_overlap from public.leave_logs
    where user_id = v_user_id
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
      and (
        not p_is_half_day or not is_half_day
        or (start_date = p_start_date and half_day_session = p_half_day_session)
      );
  if v_overlap > 0 then raise exception 'you already have a leave entry covering these dates'; end if;

  insert into public.leave_logs (user_id, leave_type_id, start_date, end_date, is_half_day, half_day_session, reason)
  values (v_user_id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day, p_half_day_session, p_reason)
  returning * into v_row;
  return v_row;
end; $$;

-- RLS: own logs are fully the user's own to manage; nobody else can write
-- them, not even a Super Admin (view-only over other people's records is
-- what keeps the log trustworthy).
drop policy if exists leave_logs_select on public.leave_logs;
drop policy if exists leave_logs_insert on public.leave_logs;
drop policy if exists leave_logs_update on public.leave_logs;
drop policy if exists leave_logs_delete on public.leave_logs;

create policy leave_logs_select on public.leave_logs for select
  using (user_id = auth.uid() or public.has_permission('LEAVE_VIEW_ALL'));
create policy leave_logs_insert on public.leave_logs for insert
  with check (user_id = auth.uid());
create policy leave_logs_update on public.leave_logs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy leave_logs_delete on public.leave_logs for delete
  using (user_id = auth.uid());

-- Leave allowance becomes self-service: the officer sets their own count,
-- and a Super Admin can also set it (onboarding/corrections). Neither can
-- touch another regular user's row.
drop policy if exists balances_self_write on public.user_leave_balances;
create policy balances_self_write on public.user_leave_balances for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The audit trigger followed the table through the rename, but still labels
-- rows 'leave_request' and ignores deletes — users can now delete their own
-- entries, and that belongs in the trail.
drop trigger if exists audit_leave_requests on public.leave_logs;
drop trigger if exists audit_leave_logs on public.leave_logs;
create trigger audit_leave_logs after insert or update or delete on public.leave_logs
  for each row execute function public.write_audit_log('leave_log');
