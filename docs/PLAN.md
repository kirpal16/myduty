# Duty Management App — Phased Build Plan (v2, security-reviewed)

## Context

`D:\Duty app` is currently an empty directory (not yet a git repo). The user wants a full "Duty Management" platform — initially for a Police department, architected so other duty "profiles" (Medical, Education, Government, Other) can be added later without redesign. Scope: auth with an approval workflow, RBAC via granular permissions, duty scheduling, leave management with computed (never manually edited) balances, a combined calendar, private file storage gated by permissions, an admin panel, and reports.

Confirmed stack: **Next.js (App Router, TS) + Supabase (Postgres/Auth/Storage, RLS as the real security boundary) + Tailwind/shadcn + React Hook Form/Zod + FullCalendar (free core) + Vercel + npm**. No separate backend server. The user already has Supabase project keys ready.

A first draft of this plan went through a security review from the user, who found real gaps: the signup insert policy could be spoofed, `DUTY_VIEW`/`LEAVE_VIEW` conflated "see my own data" with "see everyone's data," leave-balance checks in a Server Action had a TOCTOU race, duty double-booking wasn't prevented, storage RLS was too permissive for a design that already routes through server-side handlers, there was no audit trail, and verification was manual-only. **This version bakes all of those fixes directly into the schema and phase sequencing** rather than deferring them.

Decisions locked in earlier: duties are **admin/scheduler-assigned**, not self-service; **single profile per user**; **FullCalendar free core only**; leave over-balance requests are **hard-blocked**.

Every phase still layers three enforcement points — Zod validation → `requirePermission()`/RPC-level checks → Postgres RLS — but state-changing operations with race conditions (leave approval) now go through **security-definer Postgres functions with row locking**, not just a Server Action check.

---

## Phase 0 — Project Scaffolding + Supabase Client Wiring + Test/CI Tooling

- `git init`; `npx create-next-app@latest . --typescript --tailwind --app --src-dir --eslint --import-alias "@/*"`; `npx shadcn@latest init`.
- Install: `@supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers`, `supabase` CLI (dev); `supabase init`.
- **Test tooling (new):** `vitest` (unit tests for permission helpers/Zod schemas), `@playwright/test` (e2e), and `supabase/tests/` set up for pgTAP-based RLS integration tests (`supabase test db`). `.github/workflows/ci.yml` running lint, typecheck, `vitest run`, `supabase db lint`, and a migration dry-run against a throwaway local DB.
- `.env.local` (gitignored): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only); `.env.example` with placeholders.
- `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server, cookie-aware, user-scoped — respects RLS), `src/lib/supabase/admin.ts` (service-role — bypasses RLS entirely; only ever imported from Route Handlers/scripts, never a `"use client"` file or a Server Action that hasn't already done its own authorization check).
- `src/middleware.ts` scaffold; folder skeleton per the layout used throughout this plan; `README.md`.

**Verify:** `npm run dev` renders the default page; env/client wiring confirmed against the real project; `supabase link` succeeds; CI workflow runs green on an empty diff.

---

## Phase 1 — Core Schema, RLS Helpers, Departments, Audit Log

`supabase/migrations/0001_core_schema.sql`:
- `profiles` (id, name, code, description, is_active) — seed Police/POLICE.
- `departments` (id, name, code, is_active) — **new**, scaffolds future scheduler-scoping (see Phase 4 note) without forcing a redesign later; not yet enforced in v1, just present. Seed one placeholder department.
- `duty_types` (id, profile_id FK, name, code, description, is_active, unique(profile_id, code)) — seed the 12 Police duty types.
- `user_status` enum (PENDING/APPROVED/REJECTED), `user_role` enum (SUPER_ADMIN/USER); `users` table (id references `auth.users`, profile_id, department_id, role, status, full_name, employee_code, phone, approved_by, approved_at). **No client-reachable INSERT policy on this table at all** — see Phase 2 for why.
- `permissions` catalog — revised code list (own-data access is never permission-gated; permissions only gate *elevated* access):
  ```
  DUTY_VIEW_ALL, DUTY_CREATE, DUTY_EDIT, DUTY_DELETE
  LEAVE_VIEW_ALL, LEAVE_EDIT
  STORAGE_UPLOAD, STORAGE_VIEW_ALL, STORAGE_DELETE
  HOLIDAY_CREATE, HOLIDAY_DELETE
  REPORT_VIEW, REPORT_EXPORT
  AUDIT_VIEW
  ```
  (Dropped `DUTY_VIEW`/`LEAVE_VIEW`/`LEAVE_CREATE`/`CALENDAR_*` from the original draft — own duties, own leave applications, and the merged calendar are always available via RLS `user_id = auth.uid()` with no permission needed; `*_VIEW_ALL` is what a scheduler/manager needs to see *other* people's records.)
- `user_permissions` join table.
- **`audit_logs` (new):** `id, actor_id, action, entity_type, entity_id, before jsonb, after jsonb, created_at`. RLS: `select` requires `AUDIT_VIEW` or super admin; **no insert/update/delete policy for any client role**, so it's writable only by the `security definer` trigger function below.

`supabase/migrations/0002_auth_helpers.sql` — `security definer` functions used by every RLS policy from here on: `is_super_admin()`, `has_permission(code)`, `is_approved()`. Also `write_audit_log()`, a generic `security definer` trigger function (inserts a row into `audit_logs` capturing `to_jsonb(old)`/`to_jsonb(new)` and the acting `auth.uid()`) — attached to the relevant tables incrementally as each is created in later phases (`users` here in Phase 1/2, `user_permissions` in Phase 3, `duties` in Phase 4, `leave_requests` in Phase 5, `holidays` in Phase 6, `file_attachments` in Phase 7).

RLS: `profiles`/`departments`/`duty_types`/`permissions` readable by any approved user, writable only by super admin. `users`: self can `select` own row; only super admin can `update` (role/status changes gated). `user_permissions`: self reads own grants, super admin manages all.

`supabase/seed.sql` seeds the rows above (revised permission codes). Generate `src/types/database.ts`.

**Verify (manual + automated):** migrations apply cleanly; seed rows present; anon client gets 0 rows from `profiles`. **pgTAP tests** in `supabase/tests/`: assert anon/pending/approved/super-admin each get the expected row visibility on `profiles`/`duty_types`/`users`; assert no role can `insert`/`update`/`delete` `audit_logs` directly.

---

## Phase 2 — Auth + Trigger-Based Signup + Approval Flow + Super Admin Bootstrap

**Signup security fix (the review's #1 item):** rather than a client-reachable `INSERT` policy on `public.users` (which only constrains column *values*, and is easy to get subtly wrong), row creation is done entirely by a `security definer` trigger on `auth.users`, so the client never inserts into `public.users` at all:

```sql
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles
    where id = (new.raw_user_meta_data->>'profile_id')::uuid and is_active = true;

  insert into public.users (id, profile_id, department_id, role, status, full_name, employee_code, phone)
  values (
    new.id, v_profile_id,
    (new.raw_user_meta_data->>'department_id')::uuid,
    'USER', 'PENDING',   -- hardcoded; any client-supplied role/status in metadata is ignored
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'employee_code',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();
```
`profile_id` is only honored if it resolves to an existing **active** profile row — a spoofed/invalid id silently becomes `null` rather than erroring or trusting garbage. This makes it structurally impossible to end up with an authenticated `auth.users` row lacking a matching `public.users` row, and impossible for signup metadata to grant a role or approval status.

- `src/app/(auth)/signup/page.tsx` calls `supabase.auth.signUp({ email, password, options: { data: { profile_id, department_id, full_name, employee_code, phone } } })` — the trigger does the rest.
- A narrow `security definer` RPC `update_own_profile_info(full_name, phone, department_id)` lets a user edit *only* those columns post-signup (not `role`/`status`/`profile_id`) — used instead of any broad self-update RLS policy.
- `src/app/(auth)/login/page.tsx`, `pending-approval/page.tsx`.
- `src/middleware.ts` (completed): unauthenticated → `/login`; `PENDING` → `/pending-approval`; `REJECTED` → rejection notice; `APPROVED` hitting `/login`/`/signup` → `/dashboard`.
- `src/lib/auth/getCurrentUser.ts` — request-cached server helper.

**Super Admin bootstrap** (unchanged from v1, still the right mechanism): `scripts/bootstrap-super-admin.ts`, run manually via `npm run bootstrap:admin`, service-role client, refuses if a `SUPER_ADMIN` already exists, creates the `auth.users` row (the trigger above fires and creates a normal PENDING `public.users` row), then the script immediately promotes it to `SUPER_ADMIN`/`APPROVED` and grants all permissions — this promotion step is the *only* code path that ever sets `role='SUPER_ADMIN'` outside of an already-authenticated super admin using the admin UI.

**Verify:** pgTAP/integration test asserting a `signUp` call with `raw_user_meta_data` containing `role: "SUPER_ADMIN"` or `status: "APPROVED"` still produces a `USER`/`PENDING` row (proves the trigger ignores untrusted fields); bootstrap script idempotency; approval flow end-to-end; Playwright e2e for signup → pending → (admin approves) → dashboard access.

---

## Phase 3 — Authorization Helper + Permission-Assignment Admin UI

- `src/lib/permissions/hasPermission.ts` (`hasPermission()`/`requirePermission()`), `src/lib/permissions/constants.ts` (typed codes matching the Phase 1 catalog — includes `AUDIT_VIEW` now).
- `src/components/permission-gate.tsx` — UI convenience layer only, never the actual boundary.
- `src/app/admin/users/page.tsx`, `src/app/admin/permissions/page.tsx` (per-user matrix, writes trigger `audit_logs` rows automatically via the `user_permissions` audit trigger added here), `src/app/admin/dashboard/page.tsx` (stub), `src/app/admin/layout.tsx` (gates the route group), `src/app/admin/audit-log/page.tsx` — **new**, `AUDIT_VIEW`-gated read-only log viewer.
- Migration `0003_permission_audit_trigger.sql`: attach `write_audit_log()` to `user_permissions` and `users` (captures approvals/role changes).

**Verify:** approve a user via the UI and confirm an `audit_logs` row appears with correct before/after; toggling a permission on/off both changes access and produces an audit row; non-admin blocked from `/admin/*` and `/admin/audit-log` by URL. Unit tests for `hasPermission`/`requirePermission` (mocked Supabase client, all role/status combinations).

---

## Phase 4 — Duty Module (own-vs-all access, overlap prevention, scheduler scope groundwork)

`supabase/migrations/0004_duties.sql`:
```sql
create extension if not exists btree_gist;

create type public.duty_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');

create table public.duties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  duty_type_id uuid not null references public.duty_types(id),
  starts_at timestamptz not null,      -- timestamptz, not date+time: overnight duties span correctly
  ends_at timestamptz not null,
  location text,
  notes text,
  status public.duty_status not null default 'SCHEDULED',
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- DB-level double-booking prevention (review item #4): a user cannot have two
  -- non-cancelled duties with overlapping time ranges.
  exclude using gist (user_id with =, tstzrange(starts_at, ends_at) with &&)
    where (status <> 'CANCELLED')
);

alter table public.duties enable row level security;

-- own data always visible; DUTY_VIEW_ALL needed to see others' (review item #2)
create policy duties_select on public.duties for select
  using (user_id = auth.uid() or public.has_permission('DUTY_VIEW_ALL'));
create policy duties_insert on public.duties for insert
  with check (public.has_permission('DUTY_CREATE'));   -- admin/scheduler-assigned, per earlier decision
create policy duties_update on public.duties for update
  using (public.has_permission('DUTY_EDIT'));
create policy duties_delete on public.duties for delete
  using (public.has_permission('DUTY_DELETE'));

create trigger audit_duties after insert or update or delete on public.duties
  for each row execute function public.write_audit_log('duty');
```
**Scheduler scope (review item #7):** the `departments`/`department_id` columns from Phase 1 exist but `duties_insert` above deliberately stays global for v1 — any `DUTY_CREATE` holder can assign any user, matching "initially grant global scope to Super Admin." A future migration can tighten `duties_insert` to also check a `scheduler_scopes(scheduler_user_id, department_id)` mapping against the target user's `department_id` without touching the table shape, application code, or existing data.

- `src/app/admin/duty-types/page.tsx`, `src/app/duty/page.tsx` (lists own always; shows others' too if `DUTY_VIEW_ALL`), `src/app/duty/new/page.tsx` (scheduler picks target user + start/end timestamps), `src/app/duty/[id]/page.tsx`.
- `src/actions/duty.ts`, `src/lib/validations/duty.ts` (Zod schema validates `endsAt > startsAt`, surfaces the DB exclusion-constraint violation as a friendly "conflicts with an existing duty" error rather than a raw Postgres error).

**Verify:** attempting to insert two overlapping duties for the same user raises the exclusion-constraint error, both via direct SQL and through the UI form; a `DUTY_VIEW_ALL`-less user sees only their own duties; `DUTY_CREATE` without `DUTY_VIEW_ALL` still lets a scheduler *create* for others even though they can't list everyone's duties (documented as intentional — flag if the user wants schedulers to also get `DUTY_VIEW_ALL` by default, likely yes in practice, so the admin UI should grant both together as a bundle when provisioning a "Scheduler" user).

---

## Phase 5 — Leave Module (concurrency-safe balance + state-transition rules)

`supabase/migrations/0005_leave.sql`:
- `leave_types` (per-profile or global), `user_leave_balances` (user_id, leave_type_id, year, `allocated numeric` only — still no stored `used`/`remaining`), `leave_status` enum, `leave_requests` (user_id, leave_type_id, start_date, end_date, `is_half_day boolean not null default false`, `half_day_session text check (half_day_session in ('AM','PM'))`, reason, status, approved_by, approved_at, `check (not is_half_day or start_date = end_date)` — a half-day request can only ever be a single date), `leave_balance_view` (computes `used`/`remaining` as `numeric`, counting half-day requests as `0.5`, from `APPROVED` requests, read-only).
- **v1 granularity decision (review item #3, "half-day rules before Phase 5" — resolved):** leave supports **full day and half day** (AM/PM session on a single date); hourly leave is out of scope for v1. `allocated`/`used`/`remaining` are `numeric` throughout to hold `0.5` increments cleanly.

**Concurrency-safe application & approval (review item #3, the TOCTOU race):** balance checks and status transitions move out of Server Actions and into `security definer`/row-locking Postgres functions, so two simultaneous requests can't both succeed past the limit:

Both functions count a half-day request as `0.5` and a full-day range as `end_date - start_date + 1` days, and both use the half-day-aware overlap rule: two requests conflict if their date ranges intersect, **unless both are half-day requests on the same single date in different sessions** (an AM request and a PM request on the same day don't conflict; anything involving a full-day request conflicts on any date overlap, since a full day occupies both sessions).

```sql
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

  -- lock this user's allocation row for the year so a concurrent apply_leave call
  -- serializes behind this one instead of both reading a stale "remaining"
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
        not p_is_half_day or not is_half_day                                   -- either side full-day -> any overlap conflicts
        or (start_date = p_start_date and half_day_session = p_half_day_session) -- both half-day: only same session conflicts
      );
  if v_overlap > 0 then raise exception 'overlapping leave request already exists'; end if;

  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, is_half_day, half_day_session, reason, status)
  values (v_user_id, p_leave_type_id, p_start_date, p_end_date, p_is_half_day, p_half_day_session, p_reason, 'PENDING')
  returning * into v_row;
  return v_row;
end; $$;

create or replace function public.approve_leave(p_request_id uuid)
returns public.leave_requests language plpgsql security definer set search_path = public as $$
declare
  v_row public.leave_requests; v_days numeric; v_allocated numeric; v_used numeric;
begin
  if not public.has_permission('LEAVE_EDIT') then raise exception 'not authorized'; end if;

  select * into v_row from public.leave_requests where id = p_request_id for update;
  if v_row.status <> 'PENDING' then raise exception 'request is not pending'; end if;
  v_days := case when v_row.is_half_day then 0.5 else (v_row.end_date - v_row.start_date + 1) end;

  select allocated into v_allocated from public.user_leave_balances
    where user_id = v_row.user_id and leave_type_id = v_row.leave_type_id
      and year = extract(year from v_row.start_date)::int for update;
  select coalesce(sum(case when is_half_day then 0.5 else (end_date - start_date + 1) end), 0) into v_used
    from public.leave_requests
    where user_id = v_row.user_id and leave_type_id = v_row.leave_type_id and status = 'APPROVED'
      and extract(year from start_date) = extract(year from v_row.start_date);

  if v_days > (v_allocated - v_used) then
    raise exception 'approving would exceed remaining balance (re-checked at approval time)';
  end if;

  update public.leave_requests set status = 'APPROVED', approved_by = auth.uid(), approved_at = now()
    where id = p_request_id returning * into v_row;
  return v_row;
end; $$;
-- reject_leave(p_request_id) mirrors approve_leave minus the balance check.
```
`apply_leave` is `security invoker` (its own `insert`/lock still go through normal RLS as the calling user — own-row `for update` is permitted by the existing `balances_select` policy). `approve_leave`/`reject_leave` are `security definer` **and are the only path that can ever move a request to `APPROVED`/`REJECTED`** — see the RLS policies below, which deliberately grant no client-reachable route to that transition.

RLS (review item #3, explicit state-transition rule):
```sql
alter table public.leave_types enable row level security;
alter table public.user_leave_balances enable row level security;
alter table public.leave_requests enable row level security;

create policy leave_types_select on public.leave_types for select using (public.is_approved());
create policy leave_types_write on public.leave_types for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy balances_select on public.user_leave_balances for select using (user_id = auth.uid() or public.is_super_admin());
create policy balances_write on public.user_leave_balances for all using (public.is_super_admin()) with check (public.is_super_admin());

create policy leave_requests_select on public.leave_requests for select
  using (user_id = auth.uid() or public.has_permission('LEAVE_VIEW_ALL'));
create policy leave_requests_insert on public.leave_requests for insert
  with check (user_id = auth.uid());   -- applying for one's own leave needs no special permission
-- Users may only touch their own PENDING request, and only to edit-while-pending or self-cancel —
-- never to set APPROVED/REJECTED themselves. Approval/rejection only happens via the
-- security-definer functions above, which bypass RLS internally after their own permission check.
create policy leave_requests_self_transition on public.leave_requests for update
  using (user_id = auth.uid() and status = 'PENDING')
  with check (user_id = auth.uid() and status in ('PENDING','CANCELLED'));

create trigger audit_leave_requests after insert or update on public.leave_requests
  for each row execute function public.write_audit_log('leave_request');
```

- `src/app/leave/page.tsx`, `apply/page.tsx` (form has a "Half day" toggle that, when on, locks the date range to a single date and requires an AM/PM session select; calls `supabase.rpc('apply_leave', {...})`, surfaces the raised exception text), `balance/page.tsx` (reads `leave_balance_view`, displaying fractional remaining balances e.g. "9.5 days"); `src/app/admin/leave-types/page.tsx`, `leave-policies/page.tsx`; `src/actions/leave.ts` thinly wraps the three RPCs plus `cancelLeave` (a plain client-side update, permitted by `leave_requests_self_transition`).

**Verify:** allocate 12 CL days; two near-simultaneous `apply_leave` calls for 10 days each (fired concurrently in a test) — assert exactly one succeeds and the other raises the balance-exceeded exception (proves the row lock closes the race, review item #3's core ask); overlapping-date application rejected; a direct client `update leave_requests set status='APPROVED'` as the owner is rejected by RLS even though `approve_leave()` as an authorized approver succeeds; `approve_leave` re-check rejects if two requests are approved back-to-back past the limit. **Half-day cases:** an AM half-day and a PM half-day on the same date for the same user both succeed (no conflict); two AM half-days on the same date conflict; a half-day request overlapping a date already covered by a full-day request conflicts; approving two 0.5-day requests correctly deducts 1.0 total from the balance.

---

## Phase 6 — Calendar (Duty + Leave + Holidays, three-tier holiday scope, own-vs-all consistent with Phase 4/5)

**Holiday scoping (per the user's requirement: "a user can add/remove their own holiday, and it should affect only that user"):** holidays are three-tiered — `GLOBAL` (e.g. government holidays, visible to everyone), `PROFILE` (e.g. Police-only holidays, visible to that profile's users), and `USER` (a personal holiday, visible and manageable only by that one user, no admin permission required to add/remove it). This is designed in now, not deferred.

`supabase/migrations/0006_holidays.sql`:
```sql
create type public.holiday_scope as enum ('GLOBAL', 'PROFILE', 'USER');

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  scope public.holiday_scope not null,
  profile_id uuid references public.profiles(id),   -- set only when scope = 'PROFILE'
  user_id uuid references public.users(id),          -- set only when scope = 'USER'
  is_government boolean not null default false,
  is_recurring_yearly boolean not null default false,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  check (
    (scope = 'GLOBAL'  and profile_id is null     and user_id is null) or
    (scope = 'PROFILE' and profile_id is not null and user_id is null) or
    (scope = 'USER'    and user_id is not null    and profile_id is null)
  )
);

alter table public.holidays enable row level security;

-- visibility: everyone sees GLOBAL; PROFILE holidays visible to users on that profile;
-- USER holidays visible only to their own owner (and super admin, for audit/support)
create policy holidays_select on public.holidays for select
  using (
    scope = 'GLOBAL'
    or (scope = 'PROFILE' and profile_id = (select profile_id from public.users where id = auth.uid()))
    or (scope = 'USER' and user_id = auth.uid())
    or public.is_super_admin()
  );

-- GLOBAL/PROFILE holidays: admin-managed via HOLIDAY_CREATE/HOLIDAY_DELETE, as before.
-- USER holidays: the owning user manages their own — no permission needed, matches the
-- "affects only that user" requirement directly at the RLS layer, not just in the UI.
create policy holidays_insert on public.holidays for insert
  with check (
    (scope in ('GLOBAL','PROFILE') and (public.has_permission('HOLIDAY_CREATE') or public.is_super_admin()))
    or (scope = 'USER' and user_id = auth.uid())
  );
create policy holidays_delete on public.holidays for delete
  using (
    (scope in ('GLOBAL','PROFILE') and (public.has_permission('HOLIDAY_DELETE') or public.is_super_admin()))
    or (scope = 'USER' and user_id = auth.uid())
  );

create trigger audit_holidays after insert or delete on public.holidays
  for each row execute function public.write_audit_log('holiday');
```

- `src/app/calendar/page.tsx` merges the viewer's own duties + own leave + `GLOBAL` holidays + their profile's `PROFILE` holidays + their own `USER` holidays by default; if the viewer holds `DUTY_VIEW_ALL`/`LEAVE_VIEW_ALL` the same RLS-scoped queries naturally return more rows — the calendar never issues a broader query than the underlying modules already allow, so the own-vs-all boundary from Phase 4/5 carries through automatically. Other users' personal `USER` holidays are never visible to anyone but the owner and super admin, by design.
- `src/components/calendar/duty-calendar.tsx` — FullCalendar free core only, color-coded by event type (duty/leave/global holiday/profile holiday/personal holiday all visually distinct).
- `src/app/holidays/page.tsx` — admin view for `GLOBAL`/`PROFILE` holidays; a separate "My Holidays" section (or `src/app/holidays/mine/page.tsx`) lets any approved user add/remove their own `USER`-scope entries directly, no admin involvement.

**Verify:** seed a `GLOBAL` government holiday, a `PROFILE` Police holiday, and have two different users each add a personal `USER` holiday on different dates. Confirm: both users see the global and profile holidays; each user sees only *their own* personal holiday, never the other's; a user can delete their own personal holiday but cannot delete the other user's (RLS rejects it) or a `GLOBAL`/`PROFILE` holiday without `HOLIDAY_DELETE`. Also confirm the original v1 scenario (holiday + approved leave + duty in one month) still renders correctly, and that a `DUTY_VIEW_ALL`-holding scheduler sees other officers' duties on the calendar while a regular officer does not.

---

## Phase 7 — Storage: Private Bucket, Zero Client-Side Access, Route-Handler-Mediated

**Tightened from v1 (review item #5):** the bucket is private as before, but this time **no `storage.objects` RLS policy grants the `authenticated` role any read/write at all** — with RLS enabled and no permissive policy, ordinary clients (even logged-in ones with a valid JWT) cannot touch the bucket through the Supabase client library under any circumstance. All access is exclusively mediated by Route Handlers using the **service-role** client (`src/lib/supabase/admin.ts`), which only ever runs *after* the handler has independently verified the caller's permission and entity ownership using the caller's own user-scoped session. This removes the earlier "authenticated users can hit the bucket directly" baseline policy entirely — Route Handlers are the only door.

`supabase/migrations/0007_storage.sql`:
```sql
create table public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  bucket_path text not null,
  related_entity_type text not null,     -- 'duty' | 'leave' | 'user' | 'report'
  related_entity_id uuid,
  uploaded_by uuid not null references public.users(id),
  original_filename text not null,       -- display-only; never used as the storage path
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);
alter table public.file_attachments enable row level security;
create policy attachments_select on public.file_attachments for select
  using (uploaded_by = auth.uid() or public.has_permission('STORAGE_VIEW_ALL'));
create policy attachments_insert on public.file_attachments for insert
  with check (public.has_permission('STORAGE_UPLOAD'));
create policy attachments_delete on public.file_attachments for delete
  using (public.has_permission('STORAGE_DELETE') or uploaded_by = auth.uid());
create trigger audit_file_attachments after insert or delete on public.file_attachments
  for each row execute function public.write_audit_log('file_attachment');
-- Deliberately: no policies on storage.objects for 'authenticated' — Route Handlers use
-- the service-role client, which bypasses RLS, and are the sole access path.
```

**Concrete upload restrictions, defined now rather than deferred (review item #5):**
- `src/lib/validations/storage.ts` — allowlisted MIME types (`application/pdf`, `image/jpeg`, `image/png`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`), max size **10 MB**, max **5 attachments** per `(related_entity_type, related_entity_id)` pair (checked via a count query before upload).
- Storage key is always server-generated (`${crypto.randomUUID()}.${safeExtensionFromMime}`) — the client-supplied filename is stored only in `original_filename` for display, never used to build a path (closes path-traversal/collision risk).
- `src/app/api/storage/upload/route.ts` — `requirePermission('STORAGE_UPLOAD')` → validate MIME/size/count → service-role upload → insert `file_attachments` row.
- `src/app/api/storage/[id]/route.ts` GET — `requirePermission('STORAGE_VIEW_ALL')` or ownership check on the row → service-role `createSignedUrl()` with a **60-second** TTL (intentionally short; not a placeholder to be "fixed" later) → redirect. DELETE — permission/ownership check → service-role remove.
- `src/app/storage/page.tsx`, `src/components/storage/file-uploader.tsx`.

**Verify:** an anon or authenticated-but-unauthorized Supabase client call directly against `storage.from('duty-app-files')` fails for *every* operation, not just unexpected ones (proves the "no client policy at all" boundary); oversized/wrong-MIME uploads rejected before reaching the bucket; a 6th attachment on the same entity rejected; signed URL expires after 60s; deleting a file produces an `audit_logs` row.

---

## Phase 8 — Remaining Admin Screens + Reports (own-vs-all consistent) + Profile Deactivation Semantics

- `src/app/admin/dashboard/page.tsx` completed (pending approvals, active users, upcoming duties, pending leave).
- `src/app/admin/profiles/page.tsx` — CRUD for `profiles`. **Explicit deactivation behavior (review item #8):** setting `is_active=false` blocks the profile from (a) the signup profile dropdown and (b) new duty/leave-type selection for that profile going forward, but does **not** revoke login or historical read access for existing users already on that profile — this is enforced purely by filtering `where is_active = true` in the signup and duty/leave-type queries, with no RLS change needed, since existing `select` policies never checked `profiles.is_active` in the first place.
- `src/app/admin/holidays/page.tsx`, `src/app/admin/departments/page.tsx` (basic CRUD, groundwork for future scheduler scoping per Phase 4's note).
- `src/app/reports/page.tsx` + `src/actions/reports.ts` — gated by `REPORT_VIEW`/`REPORT_EXPORT`; queries reuse the same RLS-scoped client, so a `REPORT_VIEW`-only user without `DUTY_VIEW_ALL`/`LEAVE_VIEW_ALL` sees only their own data in the report, exactly like the list pages — reports never get a broader query than the UI does. CSV export via `src/app/api/reports/export/route.ts`.
- `src/app/admin/audit-log/page.tsx` (built in Phase 3) gets filters (by entity type/actor/date range) here.

**Verify:** deactivating a duty type/profile removes it from new-entry pickers while historical records still render; adding a "Medical" profile is selectable at signup with zero code changes; a `REPORT_VIEW`-only, non-`*_VIEW_ALL` user's exported CSV contains only their own rows; Playwright e2e: signup → pending → approve → scheduler assigns duty → officer applies leave → manager approves → both appear correctly scoped on calendar/reports for each role.

---

## Cross-Cutting Notes

- Re-run `supabase gen types typescript --linked` after every schema-changing phase.
- `set_updated_at()` trigger (Phase 1) attaches to `duties` and other mutable tables.
- CI (Phase 0) runs lint/typecheck/unit tests/`supabase db lint` on every push; pgTAP suite runs against a local Supabase instance in CI.
- Grep-based CI check confirming `SUPABASE_SERVICE_ROLE_KEY` / `src/lib/supabase/admin.ts` are never imported from a `"use client"` file.
- **Scheduler bundle note (Phase 4):** when provisioning a "Scheduler" user in the admin permissions UI, grant `DUTY_CREATE` + `DUTY_VIEW_ALL` together in practice, even though they're independent permission codes — otherwise a scheduler can assign duties to people whose schedules they can't see, which is usually not the intended real-world role.

## Remaining Deferred Items (genuinely v2, not security-relevant)

Leave accrual/carry-forward rules beyond flat yearly allocation; multi-tier leave approval workflow (single-tier `LEAVE_EDIT` in v1); PDF report export (CSV only in v1); email/push notifications on approval events. (Per-individual holidays are no longer deferred — see Phase 6. Leave granularity is resolved below, not deferred.)

## Critical Files

- `supabase/migrations/0001_core_schema.sql`, `0002_auth_helpers.sql` — profiles/departments/duty_types/users/permissions/audit_logs + the `security definer` helper functions every later RLS policy and trigger depends on
- `supabase/migrations/0005_leave.sql` — `apply_leave()`/`approve_leave()` row-locking functions closing the concurrency hole
- `src/lib/permissions/hasPermission.ts` — the one authorization helper used throughout Phases 3–8
- `src/middleware.ts` — global route protection
- `scripts/bootstrap-super-admin.ts` — the only path that ever creates the first `SUPER_ADMIN`
- `src/lib/supabase/server.ts` / `src/lib/supabase/admin.ts` — user-scoped vs. service-role client separation the entire security model (including the Phase 7 storage redesign) relies on
