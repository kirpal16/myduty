-- ---------------------------------------------------------------------------
-- 0038: Merge duplicate Special Leave types
--
-- Migration 0036 introduced 'Special Leave' with code 'SPL' and is_system = true.
-- If an existing 'Special Leave' (code 'SL') already existed with user allocations
-- and logs, two Special Leave entries appeared in the UI, and the smart leave
-- engine failed to route the user's custom SL.
--
-- This migration:
-- 1. Merges any logs, balances, and carry rules from unused SPL into the active one,
--    or removes the empty duplicate SPL.
-- 2. Ensures the remaining Special Leave has code = 'SPL' and is_system = true.
-- ---------------------------------------------------------------------------

do $$
declare
  v_old_sl_id uuid;
  v_new_spl_id uuid;
begin
  -- Find the custom/legacy SL type and the new SPL type
  select id into v_old_sl_id from public.leave_types where code = 'SL' and user_id is null limit 1;
  select id into v_new_spl_id from public.leave_types where code = 'SPL' and user_id is null limit 1;

  if v_old_sl_id is not null and v_new_spl_id is not null and v_old_sl_id != v_new_spl_id then
    -- If v_new_spl_id has no logs, we delete it and update v_old_sl_id to code 'SPL'
    if not exists (select 1 from public.leave_logs where leave_type_id = v_new_spl_id)
       and not exists (select 1 from public.leave_log_days where leave_type_id = v_new_spl_id) then
      delete from public.user_leave_balances where leave_type_id = v_new_spl_id;
      delete from public.user_leave_carry_rules where leave_type_id = v_new_spl_id;
      delete from public.leave_types where id = v_new_spl_id;

      update public.leave_types
         set code = 'SPL',
             is_system = true,
             is_active = true
       where id = v_old_sl_id;
    else
      -- If v_new_spl_id has logs, migrate references from v_old_sl_id to v_new_spl_id
      update public.leave_logs set leave_type_id = v_new_spl_id where leave_type_id = v_old_sl_id;
      update public.leave_log_days set leave_type_id = v_new_spl_id where leave_type_id = v_old_sl_id;
      delete from public.leave_types where id = v_old_sl_id;
    end if;
  elsif v_old_sl_id is not null and v_new_spl_id is null then
    update public.leave_types
       set code = 'SPL',
           is_system = true,
           is_active = true
     where id = v_old_sl_id;
  end if;
end;
$$;
