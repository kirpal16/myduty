-- The schema had no explicit indexes at all — only the implicit ones behind
-- primary keys and unique constraints. Every list, filter, dashboard tile and
-- report added by this release would table-scan. These cover the access paths
-- those features actually use.
-- Safely re-runnable.

-- Duty list, dashboard and reports all filter by officer and order by date.
create index if not exists duties_user_starts_at_idx
  on public.duties (user_id, starts_at desc);

-- The admin-wide views (DUTY_VIEW_ALL) drop the user_id predicate.
create index if not exists duties_starts_at_idx
  on public.duties (starts_at desc);

-- Fetching the sibling rows of a multi-day duty.
create index if not exists duties_group_idx
  on public.duties (duty_group_id);

-- The holiday day-type filter and the holiday reports. Partial: worked
-- holidays are the rare case, so the index stays small.
create index if not exists duties_user_holiday_idx
  on public.duties (user_id, is_holiday_duty) where is_holiday_duty;

-- Calendar and balance queries scan a date window per officer.
create index if not exists leave_logs_user_dates_idx
  on public.leave_logs (user_id, start_date, end_date);

-- resolveHoliday() loads every holiday in a date range, filtered by scope.
create index if not exists holidays_date_scope_idx
  on public.holidays (holiday_date, scope);

-- Attachment lists on duty/leave detail pages, and the storage browser.
create index if not exists attachments_entity_idx
  on public.file_attachments (related_entity_type, related_entity_id);

create index if not exists attachments_uploader_idx
  on public.file_attachments (uploaded_by, created_at desc);

-- Attachment delete was owner-only with no super-admin path, so an admin
-- deleting somebody else's file got a silent 404 rather than a refusal or a
-- deletion. Super admins can already SEE every attachment via
-- STORAGE_VIEW_ALL; being unable to remove one was an oversight, not a policy.
drop policy if exists attachments_delete on public.file_attachments;
create policy attachments_delete on public.file_attachments for delete
  using (uploaded_by = auth.uid() or public.is_super_admin());
