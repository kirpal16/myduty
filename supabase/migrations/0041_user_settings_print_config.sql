-- Add print and report configuration to user_settings
-- Allows officers to customize their default Gujarati letterhead:
-- recipient title (પ્રતિ), station name, signature/name, vehicle default, and Gujarati numerals toggle.

alter table public.user_settings
  add column if not exists print_recipient_title text default 'પોલીસ સબ ઇન્સપેક્ટરશ્રી',
  add column if not exists print_station_name text default '',
  add column if not exists print_signatory_name text default '',
  add column if not exists print_default_vehicle text default 'private',
  add column if not exists print_use_gujarati_digits boolean default true;
