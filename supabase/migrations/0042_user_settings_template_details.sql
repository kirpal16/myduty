-- Add template customization columns to user_settings
-- Allows officers to persist letterhead header lines, place, and notes:
-- print_header_line1, print_header_line2, print_header_line1_en, print_header_line2_en,
-- print_footer_place, and print_footer_note.

alter table public.user_settings
  add column if not exists print_header_line1 text default 'ગુજરાત પોલીસ (GUJARAT POLICE)',
  add column if not exists print_header_line2 text default '',
  add column if not exists print_header_line1_en text default 'Gujarat Police',
  add column if not exists print_header_line2_en text default 'Duty & Roster Records',
  add column if not exists print_footer_place text default '',
  add column if not exists print_footer_note text default '';
