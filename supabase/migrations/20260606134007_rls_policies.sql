-- ============================================
-- Migration 3: Row Level Security
-- Every user sees only their own data.
-- ============================================

-- Enable RLS on all tables
alter table public.profiles    enable row level security;
alter table public.projects    enable row level security;
alter table public.scope_checks enable row level security;
alter table public.usage_logs  enable row level security;

-- ----------------------------------------
-- PROFILES policies
-- ----------------------------------------
drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row"
  on public.profiles
  for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- ----------------------------------------
-- PROJECTS policies
-- ----------------------------------------
drop policy if exists "projects: own rows" on public.projects;
create policy "projects: own rows"
  on public.projects
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------
-- SCOPE CHECKS policies
-- ----------------------------------------
drop policy if exists "scope_checks: own rows" on public.scope_checks;
create policy "scope_checks: own rows"
  on public.scope_checks
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------
-- USAGE LOGS policies
-- ----------------------------------------
drop policy if exists "usage_logs: insert own"  on public.usage_logs;
drop policy if exists "usage_logs: select own"  on public.usage_logs;

-- Insert: users can only log their own usage
create policy "usage_logs: insert own"
  on public.usage_logs
  for insert
  with check (auth.uid() = user_id);

-- Select: users can only read their own logs
create policy "usage_logs: select own"
  on public.usage_logs
  for select
  using (auth.uid() = user_id);

-- No update or delete on usage_logs — it is an append-only ledger