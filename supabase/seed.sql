-- Phase 1 seed data: one profile (Police), its 12 duty types, a placeholder
-- department, and the full permissions catalog.

insert into public.profiles (id, name, code, description, is_active)
values (gen_random_uuid(), 'Police', 'POLICE', 'Police department duty profile', true);

insert into public.departments (id, name, code, is_active)
values (gen_random_uuid(), 'General', 'GENERAL', true);

insert into public.duty_types (profile_id, name, code, description, is_active)
select p.id, d.name, d.code, null, true
from public.profiles p
cross join (values
  ('Patrolling',   'PATROLLING'),
  ('Bandobast',    'BANDOBAST'),
  ('Combing',      'COMBING'),
  ('Nakabandi',    'NAKABANDI'),
  ('Court Duty',   'COURT_DUTY'),
  ('Station Duty', 'STATION_DUTY'),
  ('Office Duty',  'OFFICE_DUTY'),
  ('Escort Duty',  'ESCORT_DUTY'),
  ('VIP Duty',                    'VIP_DUTY'),
  ('Training',                    'TRAINING'),
  ('Night Duty',                  'NIGHT_DUTY'),
  ('Reserve Duty',                'RESERVE_DUTY'),
  ('Night Patrolling',            'NIGHT_PATROLLING'),
  ('Combing Night',               'COMBING_NIGHT'),
  ('Point Duty',                  'POINT_DUTY'),
  ('Parade Duty',                 'PARADE_DUTY'),
  ('Rehearsal Duty',              'REHEARSAL_DUTY'),
  ('Annual Inspection Bandobast', 'ANNUAL_INSPECTION_BANDOBAST'),
  ('Guard Duty',                  'GUARD_DUTY'),
  ('Mock Drill Duty',             'MOCK_DRILL_DUTY'),
  ('Festival Bandobast Duty',     'FESTIVAL_BANDOBAST_DUTY'),
  ('Standby Duty',                'STANDBY_DUTY'),
  ('Sanskrtik Karyakram Duty',    'SANSKRTIK_KARYAKRAM_DUTY'),
  ('Other',                       'OTHER')
) as d(name, code)
where p.code = 'POLICE'
on conflict (profile_id, code) do nothing;

insert into public.permissions (code, category, description) values
  ('DUTY_VIEW_ALL',    'DUTY',     'View duties belonging to other users'),
  ('DUTY_CREATE',      'DUTY',     'Create/assign a duty to a user'),
  ('DUTY_EDIT',        'DUTY',     'Edit any duty'),
  ('DUTY_DELETE',      'DUTY',     'Delete any duty'),
  ('LEAVE_VIEW_ALL',   'LEAVE',    'View leave requests belonging to other users'),
  ('LEAVE_EDIT',       'LEAVE',    'Approve/reject leave requests'),
  ('STORAGE_UPLOAD',   'STORAGE',  'Upload file attachments'),
  ('STORAGE_VIEW_ALL', 'STORAGE',  'View file attachments uploaded by other users'),
  ('STORAGE_DELETE',   'STORAGE',  'Delete any file attachment'),
  ('HOLIDAY_CREATE',   'HOLIDAY',  'Create global/profile holidays'),
  ('HOLIDAY_DELETE',   'HOLIDAY',  'Delete global/profile holidays'),
  ('REPORT_VIEW',      'REPORT',   'Access the reports page'),
  ('REPORT_EXPORT',    'REPORT',   'Export reports (CSV)');
