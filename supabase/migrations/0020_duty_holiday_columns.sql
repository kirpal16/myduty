-- Holiday duty state gets real columns.
--
-- Until now "worked on a holiday" and "holiday extra pay" were serialised
-- into duties.notes as `[Holiday Shift Worked]` / `[Holiday Extra Pay: Rs N]`
-- and regex-parsed back out on read. Nothing could filter, sum, badge or
-- report on it. These columns replace that tag entirely.
--
-- Two facts are kept deliberately separate (see R1 in the plan):
--   is_holiday       -- the DATE is a holiday/weekend/day-off (classification)
--   is_holiday_duty  -- the officer actually WORKED it (classification AND not cancelled)
-- A holiday alone pays nothing; only a worked holiday earns the allowance.
-- Safely re-runnable.

alter table public.duties
  add column if not exists is_holiday boolean not null default false,
  add column if not exists is_holiday_duty boolean not null default false,
  add column if not exists manual_holiday_claim boolean not null default false,
  add column if not exists holiday_allowance numeric not null default 0,
  add column if not exists duty_group_id uuid;

-- ---------------------------------------------------------------------------
-- Backfill runs BEFORE the invariant constraints, so the constraints validate
-- the migrated data rather than blocking it.
-- ---------------------------------------------------------------------------

-- The old note tag was a USER ASSERTION that holiday pay was owed, not a
-- derived fact, so it becomes manual_holiday_claim. The derived flags
-- (is_holiday / is_holiday_duty) are computed afterwards by
-- scripts/backfill-holiday-flags.ts, which can reach the gazetted holiday
-- catalog that lives in TypeScript. That script MUST run after the 0020a
-- datetime correction, or it will classify shifted dates.
update public.duties set
  holiday_allowance = coalesce(
    nullif(substring(notes from '\[Holiday Extra Pay: ₹([0-9.]+)\]'), '')::numeric, 0
  )
where notes is not null and notes ~ '\[Holiday Extra Pay:';

update public.duties set manual_holiday_claim = true
where notes is not null and notes ~ '\[Holiday (Extra Pay|Shift Worked)';

update public.duties set
  notes = nullif(btrim(regexp_replace(notes, '\n?\[Holiday [^\]]*\]', '', 'g')), '')
where notes is not null and notes ~ '\[Holiday ';

-- A cancelled duty was not worked, so nothing is owed for it.
update public.duties
  set holiday_allowance = 0, is_holiday_duty = false, manual_holiday_claim = false
where status = 'CANCELLED';

-- duty_group_id links the per-day rows produced by one multi-day submission.
-- Single-day duties get their own group so the column is uniformly non-null
-- and no query needs null-handling; a row belongs to a multi-day batch when
-- its group has more than one member.
update public.duties set duty_group_id = gen_random_uuid() where duty_group_id is null;
alter table public.duties alter column duty_group_id set not null;

-- ---------------------------------------------------------------------------
-- Invariants (R1). These hold for every write path, not just the server action.
-- ---------------------------------------------------------------------------

alter table public.duties drop constraint if exists duties_holiday_allowance_nonneg;
alter table public.duties
  add constraint duties_holiday_allowance_nonneg check (holiday_allowance >= 0);

-- A cancelled duty can never be a holiday duty and can never carry an allowance.
alter table public.duties drop constraint if exists duties_cancelled_no_holiday_pay;
alter table public.duties
  add constraint duties_cancelled_no_holiday_pay check (
    status <> 'CANCELLED' or (is_holiday_duty = false and holiday_allowance = 0)
  );

-- is_holiday_duty may only be true when the date is actually a holiday.
alter table public.duties drop constraint if exists duties_holiday_duty_implies_holiday;
alter table public.duties
  add constraint duties_holiday_duty_implies_holiday check (
    is_holiday_duty = false or is_holiday = true
  );

-- A manual claim is the escape hatch for being owed holiday pay on a day the
-- calendar does NOT classify as a holiday. It is meaningless on a real
-- holiday, where the allowance is automatic.
alter table public.duties drop constraint if exists duties_manual_claim_only_off_holiday;
alter table public.duties
  add constraint duties_manual_claim_only_off_holiday check (
    manual_holiday_claim = false or is_holiday = false
  );
