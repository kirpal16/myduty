-- Dedicated seed for Duty Types
-- Can be executed standalone or removed as needed.
-- Uses ON CONFLICT to ensure idempotence.

insert into public.duty_types (profile_id, name, code, description, is_active)
select p.id, d.name, d.code, null, true
from public.profiles p
cross join (values
  ('Patrolling',                  'PATROLLING'),
  ('Bandobast',                   'BANDOBAST'),
  ('Combing',                     'COMBING'),
  ('Nakabandi',                   'NAKABANDI'),
  ('Court Duty',                  'COURT_DUTY'),
  ('Station Duty',                'STATION_DUTY'),
  ('Office Duty',                 'OFFICE_DUTY'),
  ('Escort Duty',                 'ESCORT_DUTY'),
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
