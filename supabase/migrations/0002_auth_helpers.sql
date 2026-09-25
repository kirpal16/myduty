-- Phase 1/2: security-definer helper functions used by every RLS policy
-- from here on, the trigger-based signup flow, and RLS enablement for all
-- Phase 1 tables.

-- ---------------------------------------------------------------------------
-- Helper functions. security definer so they can read public.users /
-- public.user_permissions even under the restrictive RLS placed on those
-- same tables (a self-referential RLS check on `users` would otherwise
-- deadlock policy evaluation). set search_path guards against search-path
-- hijacking.
-- ---------------------------------------------------------------------------
create function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'SUPER_ADMIN' and status = 'APPROVED'
  );
$$;

create function public.has_permission(perm_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists (
    select 1 from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    join public.users u on u.id = up.user_id
    where up.user_id = auth.uid() and p.code = perm_code and u.status = 'APPROVED'
  );
$$;

create function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and status = 'APPROVED');
$$;

-- ---------------------------------------------------------------------------
-- write_audit_log(): generic audit trigger function. Attached to specific
-- tables incrementally in later migrations (Phase 3 attaches it to
-- users/user_permissions, Phase 4 to duties, etc.) — defined once here.
-- Pass the entity_type as the trigger's first TG_ARGV.
-- ---------------------------------------------------------------------------
create function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (
    auth.uid(),
    tg_argv[0] || '.' || lower(tg_op),
    tg_argv[0],
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger-based signup (Phase 2, review item #1): the client never inserts
-- into public.users directly — there is no INSERT policy on that table at
-- all. Instead, this trigger on auth.users creates the row, hardcoding
-- role='USER' and status='PENDING' regardless of what a client puts in
-- signUp()'s raw_user_meta_data. profile_id is only honored if it resolves
-- to an existing ACTIVE profile; anything else silently becomes null rather
-- than trusting unvalidated input.
-- ---------------------------------------------------------------------------
create function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles
    where id = (new.raw_user_meta_data->>'profile_id')::uuid and is_active = true;

  insert into public.users (id, profile_id, department_id, role, status, full_name, employee_code, phone)
  values (
    new.id,
    v_profile_id,
    (new.raw_user_meta_data->>'department_id')::uuid,
    'USER',
    'PENDING',
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'employee_code',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- update_own_profile_info(): the ONLY way a user can edit their own row
-- post-signup. Whitelists columns explicitly — role/status/profile_id can
-- never be touched through this path.
-- ---------------------------------------------------------------------------
create function public.update_own_profile_info(
  p_full_name text, p_phone text, p_department_id uuid
) returns public.users language plpgsql security definer set search_path = public as $$
declare
  v_row public.users;
begin
  update public.users
    set full_name = coalesce(p_full_name, full_name),
        phone = coalesce(p_phone, phone),
        department_id = coalesce(p_department_id, department_id)
    where id = auth.uid()
    returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.duty_types enable row level security;
alter table public.users enable row level security;
alter table public.permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.audit_logs enable row level security;

-- profiles / departments / duty_types: readable by any approved user,
-- writable only by super admin.
create policy profiles_select on public.profiles for select using (public.is_approved());
create policy profiles_write on public.profiles for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy departments_select on public.departments for select using (public.is_approved());
create policy departments_write on public.departments for all
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy duty_types_select on public.duty_types for select using (public.is_approved());
create policy duty_types_write on public.duty_types for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- users: self can read own row; super admin can read/update all. No insert
-- policy at all (see handle_new_auth_user above) and no broad self-update
-- policy (see update_own_profile_info above) — this is how self-approval
-- and self-promotion are closed off at the database layer.
create policy users_select on public.users for select
  using (id = auth.uid() or public.is_super_admin());
create policy users_update_admin on public.users for update
  using (public.is_super_admin()) with check (public.is_super_admin());

-- permissions catalog: readable by any approved user, writable only by
-- super admin.
create policy permissions_select on public.permissions for select using (public.is_approved());
create policy permissions_write on public.permissions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- user_permissions: self reads own grants; super admin manages all.
create policy user_permissions_select on public.user_permissions for select
  using (user_id = auth.uid() or public.is_super_admin());
create policy user_permissions_write on public.user_permissions for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- audit_logs: select requires AUDIT_VIEW or super admin. No insert/update/
-- delete policy for any client role — writable only via write_audit_log().
create policy audit_logs_select on public.audit_logs for select
  using (public.has_permission('AUDIT_VIEW') or public.is_super_admin());
