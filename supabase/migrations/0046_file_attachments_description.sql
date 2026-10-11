-- Add description column to file_attachments table
alter table public.file_attachments
  add column if not exists description text;
