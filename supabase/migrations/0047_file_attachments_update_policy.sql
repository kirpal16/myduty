-- Migration 0047: Add UPDATE policy on file_attachments table
-- Allows the uploader or super admin to update file metadata (e.g. original_filename, description)

drop policy if exists attachments_update on public.file_attachments;
create policy attachments_update on public.file_attachments for update
  using (uploaded_by = auth.uid() or public.is_super_admin())
  with check (uploaded_by = auth.uid() or public.is_super_admin());
