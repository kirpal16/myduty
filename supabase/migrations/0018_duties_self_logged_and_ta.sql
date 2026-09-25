-- v3 rework: duties are self-logged. The officer records the duty they
-- worked; nobody assigns it to them, and nobody else edits their line.
-- Safely re-runnable.

drop policy if exists duties_insert on public.duties;
drop policy if exists duties_update on public.duties;
drop policy if exists duties_delete on public.duties;

-- duties_select is deliberately left as-is (own row, or DUTY_VIEW_ALL —
-- which a Super Admin satisfies via is_super_admin()): everyone can be
-- *seen*, but only the owner writes.
create policy duties_insert on public.duties for insert
  with check (user_id = auth.uid());
create policy duties_update on public.duties for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy duties_delete on public.duties for delete
  using (user_id = auth.uid());

-- TA (Travelling Allowance): an optional section on each duty entry, so
-- travel is recorded against the duty that caused it and both come back in
-- one query/report.
alter table public.duties
  add column if not exists ta_from_place text,
  add column if not exists ta_to_place text,
  add column if not exists ta_distance_km numeric,
  add column if not exists ta_amount numeric;

alter table public.duties drop constraint if exists duties_ta_distance_nonneg;
alter table public.duties drop constraint if exists duties_ta_amount_nonneg;

alter table public.duties
  add constraint duties_ta_distance_nonneg
    check (ta_distance_km is null or ta_distance_km >= 0),
  add constraint duties_ta_amount_nonneg
    check (ta_amount is null or ta_amount >= 0);
