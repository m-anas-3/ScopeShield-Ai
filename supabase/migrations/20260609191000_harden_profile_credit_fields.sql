-- ============================================
-- Profile credit-field hardening
-- ============================================

-- The original broad "for all" profile policy allowed authenticated clients to
-- update every column on their own profile. Keep self-service reads and limited
-- profile edits, but reserve credit/billing fields for trusted server code.
drop policy if exists "profiles: own row" on public.profiles;
drop policy if exists "profiles: select own" on public.profiles;
drop policy if exists "profiles: update own editable fields" on public.profiles;

create policy "profiles: select own"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles: update own editable fields"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke insert, delete on public.profiles from public;
revoke insert, delete on public.profiles from anon;
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from public;
revoke update on public.profiles from anon;
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
