-- Migration 0045: User Profile Signature Support
-- 1. Add signature_url column to users table
alter table public.users
  add column if not exists signature_url text;

-- 2. Create security definer function for updating own signature
create or replace function public.update_own_signature(
  p_signature_url text
) returns public.users language plpgsql security definer set search_path = public as $$
declare
  v_row public.users;
begin
  update public.users
  set signature_url = p_signature_url
  where id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;
