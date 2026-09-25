-- v3 rework: per-user 12h/24h time preference, and retiring the permission
-- codes the log-book model made meaningless.

alter table public.users
  add column if not exists time_format text not null default '24h'
    check (time_format in ('12h','24h'));

-- update_own_profile_info stays the ONLY self-update path (it whitelists
-- columns, so role/status remain untouchable) — extend it with the new
-- preference rather than opening a broad self-update RLS policy.
drop function if exists public.update_own_profile_info(text, text, uuid);

create or replace function public.update_own_profile_info(
  p_full_name text, p_phone text, p_department_id uuid, p_time_format text
) returns public.users language plpgsql security definer set search_path = public as $$
declare
  v_row public.users;
begin
  if p_time_format is not null and p_time_format not in ('12h','24h') then
    raise exception 'time_format must be 12h or 24h';
  end if;

  update public.users
    set full_name = coalesce(p_full_name, full_name),
        phone = coalesce(p_phone, phone),
        department_id = coalesce(p_department_id, department_id),
        time_format = coalesce(p_time_format, time_format)
    where id = auth.uid()
    returning * into v_row;
  return v_row;
end;
$$;

-- With self-logging, "may I create/edit/delete my own entry" is inherent,
-- not a grant. What's left governs only elevated visibility (seeing other
-- people's records) and shared configuration.
delete from public.permissions where code in (
  'DUTY_CREATE', 'DUTY_EDIT', 'DUTY_DELETE',
  'LEAVE_EDIT',
  'STORAGE_UPLOAD', 'STORAGE_DELETE'
);

-- file_attachments follows the same own-data rule as the logs.
drop policy if exists attachments_insert on public.file_attachments;
drop policy if exists attachments_delete on public.file_attachments;

create policy attachments_insert on public.file_attachments for insert
  with check (uploaded_by = auth.uid());
create policy attachments_delete on public.file_attachments for delete
  using (uploaded_by = auth.uid());
