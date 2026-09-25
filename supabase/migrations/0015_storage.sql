-- Phase 7: file_attachments metadata table. The bucket itself
-- ('duty-app-files') is private with no storage.objects RLS policy for the
-- 'authenticated' role at all — ordinary clients cannot reach it through
-- the Supabase client library under any circumstance. All access goes
-- through Next.js Route Handlers using the service-role client, which only
-- runs after the handler has independently verified permission/ownership
-- with the caller's own session. That's a deliberate absence, not an
-- oversight — do not add a storage.objects policy for 'authenticated'.
create table public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  bucket_path text not null,
  related_entity_type text not null,
  related_entity_id uuid,
  uploaded_by uuid references public.users(id) on delete set null,
  original_filename text not null,
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
