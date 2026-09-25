-- Add ta_vehicle_type to duties table
-- Supports 'private' (ખાનગી વાહન / ખ.વા.) and 'govt' (સરકારી વાહન / સ.વા.)
alter table public.duties
  add column if not exists ta_vehicle_type text default 'private';

alter table public.duties drop constraint if exists duties_ta_vehicle_type_check;

alter table public.duties
  add constraint duties_ta_vehicle_type_check
    check (ta_vehicle_type is null or ta_vehicle_type in ('private', 'govt', 'ખ.વા.', 'સ.વા.'));
