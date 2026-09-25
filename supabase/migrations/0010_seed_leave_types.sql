-- Seed the standard leave types, global (profile_id = null, applies to
-- every profile) rather than Police-specific.
insert into public.leave_types (name, code, is_active) values
  ('Casual Leave',       'CL',            true),
  ('Privilege Leave',    'PL',            true),
  ('Medical Leave',      'MEDICAL',       true),
  ('Sick Leave',         'SICK',          true),
  ('Compensatory Leave', 'COMPENSATORY',  true),
  ('Other',              'OTHER',         true);
