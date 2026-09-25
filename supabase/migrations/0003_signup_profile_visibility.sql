-- Fix: the signup form needs to show a dropdown of active profiles to
-- someone who isn't authenticated at all yet (no public.users row exists
-- pre-signup, so is_approved() is always false for them). Profile
-- name/code/description isn't sensitive — it's just an organizational
-- category ("Police", "Medical", ...) — so make active profiles publicly
-- readable, while still hiding inactive ones from anyone but approved users
-- (e.g. an admin reviewing a deactivated profile's history).
drop policy profiles_select on public.profiles;

create policy profiles_select on public.profiles for select
  using (is_active = true or public.is_approved());
