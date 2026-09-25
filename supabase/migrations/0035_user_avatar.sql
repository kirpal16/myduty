-- Migration 0035: User Profile Avatar & Photo Support
-- 1. Add avatar_url column to users table
alter table public.users
  add column if not exists avatar_url text;

-- 2. Create security definer function for updating user avatar
create or replace function public.update_own_avatar(
  p_avatar_url text
) returns public.users language plpgsql security definer set search_path = public as $$
declare
  v_row public.users;
begin
  update public.users
  set avatar_url = p_avatar_url
  where id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;
