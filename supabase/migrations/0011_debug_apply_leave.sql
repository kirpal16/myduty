-- TEMPORARY debug migration — will be superseded once the bug is found.
create or replace function public.apply_leave(
  p_leave_type_id uuid, p_start_date date, p_end_date date,
  p_is_half_day boolean, p_half_day_session text, p_reason text
) returns public.leave_requests language plpgsql security invoker as $$
declare
  v_user_id uuid := auth.uid();
  v_year int := extract(year from p_start_date)::int;
  v_days numeric := case when p_is_half_day then 0.5 else (p_end_date - p_start_date + 1) end;
  v_allocated numeric; v_used numeric; v_overlap int; v_row public.leave_requests;
begin
  if p_end_date < p_start_date then raise exception 'end_date before start_date'; end if;
  if p_is_half_day and p_start_date <> p_end_date then raise exception 'half-day requests must be a single date'; end if;
  if p_is_half_day and p_half_day_session not in ('AM','PM') then raise exception 'half_day_session must be AM or PM'; end if;

  select allocated into v_allocated from public.user_leave_balances
    where user_id = v_user_id and leave_type_id = p_leave_type_id and year = v_year for update;
  if v_allocated is null then
    raise exception 'DEBUG no allocation: v_user_id=% p_leave_type_id=% v_year=% p_start_date=%', v_user_id, p_leave_type_id, v_year, p_start_date;
  end if;

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
