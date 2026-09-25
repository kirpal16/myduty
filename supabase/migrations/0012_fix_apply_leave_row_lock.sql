-- Fix: SELECT ... FOR UPDATE requires satisfying the table's UPDATE-context
-- RLS policy, not just its SELECT policy — this is documented PostgreSQL
-- RLS behavior (a locking select is treated as an update-intent read).
-- user_leave_balances.balances_write is super-admin-only, so a regular
-- officer's own row-lock inside apply_leave() was silently excluded even
-- though a plain SELECT of the same row succeeds (confirmed: direct table
-- query returns the row; the FOR UPDATE lock inside the function does not).
--
-- Fix: apply_leave() becomes security definer, like approve_leave()/
-- reject_leave() already are. This is safe — the function only ever
-- targets auth.uid() (hardcoded as v_user_id, never a parameter), so a
-- caller can never apply for anyone but themselves regardless of RLS.
create or replace function public.apply_leave(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text
) returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_year int := extract(year from p_start_date)::int;
  v_days numeric := case when p_is_half_day then 0.5 else (p_end_date - p_start_date + 1) end;
  v_allocated numeric; v_used numeric; v_overlap int; v_row public.leave_requests;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  if p_end_date < p_start_date then raise exception 'end_date before start_date'; end if;
  if p_is_half_day and p_start_date <> p_end_date then raise exception 'half-day requests must be a single date'; end if;
  if p_is_half_day and p_half_day_session not in ('AM','PM') then raise exception 'half_day_session must be AM or PM'; end if;

  select allocated into v_allocated from public.user_leave_balances
    where user_id = v_user_id and leave_type_id = p_leave_type_id and year = v_year for update;
  if v_allocated is null then raise exception 'no allocation for this type/year'; end if;

  select coalesce(sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end), 0) into v_used
    from public.leave_requests
    where user_id = v_user_id and leave_type_id = p_leave_type_id and status = 'APPROVED'
      and extract(year from start_date) = v_year;

  if v_days > (v_allocated - v_used) then
    raise exception 'requested % day(s) exceeds remaining balance of %', v_days, (v_allocated - v_used);
  end if;

  select count(*) into v_overlap from public.leave_requests
    where user_id = v_user_id and status in ('PENDING','APPROVED')
      and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
      and (
        not p_is_half_day or not is_half_day
        or (start_date = p_start_date and half_day_session = p_half_day_session)
      );
  if v_overlap > 0 then raise exception 'overlapping leave request already exists'; end if;

  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, is_half_day, half_day_session, reason, status)
  values (v_user_id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day, p_half_day_session, p_reason, 'PENDING')
  returning * into v_row;
  return v_row;
end; $$;
