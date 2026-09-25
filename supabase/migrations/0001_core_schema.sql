-- Phase 1: profiles, departments, duty_types, users, permissions, audit_logs.
-- Own-data access is never permission-gated; permissions only gate *elevated*
-- access to other users' records (see the *_VIEW_ALL codes below).

-- ---------------------------------------------------------------------------
-- profiles: extensible duty "profiles" (Police, later Medical/Education/...)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- departments: groundwork for future scheduler-scoping (Phase 4 note). Not
-- yet enforced anywhere in v1 — just present so a later migration can add
-- scoping without a redesign.
-- ---------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- duty_types: per-profile catalog of duty types
-- ---------------------------------------------------------------------------
create table public.duty_types (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  code text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, code)
);

-- ---------------------------------------------------------------------------
-- users: extends auth.users. Row creation is handled entirely by a trigger
-- in 0002_auth_helpers.sql (see handle_new_auth_user) — there is
-- deliberately NO client-reachable INSERT policy on this table.
-- ---------------------------------------------------------------------------
create type public.user_status as enum ('PENDING', 'APPROVED', 'REJECTED');
create type public.user_role as enum ('SUPER_ADMIN', 'USER');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  department_id uuid references public.departments(id),
  role public.user_role not null default 'USER',
  status public.user_status not null default 'PENDING',
  full_name text not null,
  employee_code text,
  phone text,
  created_at timestamptz not null default now(),
  approved_by uuid references public.users(id),
  approved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- permissions catalog + per-user grants
-- ---------------------------------------------------------------------------
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null,
  description text
);

create table public.user_permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted_by uuid references public.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- audit_logs: immutable from the client. Only the write_audit_log()
-- security-definer trigger function (0002) can insert into this table.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- generic updated_at trigger, reused by duties (Phase 4) and any future
-- mutable table
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Row Level Security (enable flags + policies) is set up entirely in
-- 0002_auth_helpers.sql, since every policy below depends on the
-- is_super_admin()/has_permission()/is_approved() functions defined there.
-- Until 0002 runs, RLS is not yet enabled on these tables.
