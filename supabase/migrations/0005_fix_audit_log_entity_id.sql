-- Fix: write_audit_log() referenced new.id/old.id directly, which is a
-- compile-time field access in plpgsql — it throws "record has no field
-- id" for any table without a single `id` column, such as user_permissions
-- (composite primary key user_id, permission_id). That error aborted the
-- whole triggering statement, breaking permission grants/revokes entirely.
--
-- Fix: read the id via to_jsonb(...)->>'id' instead, which returns NULL
-- for a missing key rather than erroring. Tables without an `id` column
-- (like user_permissions) get entity_id = null in the audit row — the
-- before/after jsonb blobs still identify the row via its actual key
-- columns, so nothing is lost.
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    tg_argv[0] || '.' || lower(tg_op),
    tg_argv[0],
    coalesce(
      (to_jsonb(new)->>'id')::uuid,
      (to_jsonb(old)->>'id')::uuid
    ),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;
