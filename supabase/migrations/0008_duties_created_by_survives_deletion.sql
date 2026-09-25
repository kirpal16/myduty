-- Same fix as 0006, applied to a column that migration missed:
-- duties.created_by is a "who scheduled this" historical reference, not a
-- live relationship — it had no ON DELETE behavior (defaults to RESTRICT),
-- so deleting any scheduler/admin who ever created a duty was permanently
-- blocked. The duty record should survive the creator's deletion.
-- created_by was NOT NULL, which would conflict with ON DELETE SET NULL
-- (the creator's deletion would try to null it, then fail the NOT NULL
-- check) — drop that constraint too. A duty record with created_by = null
-- just means "creator no longer exists," same as approved_by/granted_by.
alter table public.duties alter column created_by drop not null;

alter table public.duties
  drop constraint duties_created_by_fkey,
  add constraint duties_created_by_fkey
    foreign key (created_by) references public.users(id) on delete set null;
