-- Sample global and profile holidays.
insert into public.holidays (name, holiday_date, scope, is_government, is_recurring_yearly)
values ('Republic Day', '2027-01-26', 'GLOBAL', true, true);

insert into public.holidays (name, holiday_date, scope, profile_id, is_recurring_yearly)
select 'Police Commemoration Day', '2026-10-21', 'PROFILE', id, true
from public.profiles where code = 'POLICE';
