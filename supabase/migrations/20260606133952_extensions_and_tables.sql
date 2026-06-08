-- ============================================
-- Migration 1: Extensions and Tables
-- ScopeShield AI
-- ============================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector; -- reserved for future RAG

-- ----------------------------------------
-- PROFILES
-- Auto-populated via trigger on auth.users
-- ----------------------------------------
create table if not exists public.profiles (
  id           uuid        primary key references auth.users on delete cascade,
  full_name    text,
  avatar_url   text,
  plan         text        not null default 'free'
                           check (plan in ('free', 'pro', 'agency')),
  credits_balance  integer not null default 30,
  credits_reset_at timestamptz default now(),
  created_at   timestamptz default now()
);

-- ----------------------------------------
-- PROJECTS
-- ----------------------------------------
create table if not exists public.projects (
  id             uuid        primary key default uuid_generate_v4(),
  user_id        uuid        not null references auth.users on delete cascade,
  name           text        not null,
  client_name    text,
  original_scope text        not null,
  deliverables   text,
  exclusions     text,
  revision_limit integer,
  hourly_rate    numeric(10,2),
  status         text        not null default 'active'
                             check (status in ('active', 'completed', 'archived')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ----------------------------------------
-- SCOPE CHECKS
-- ----------------------------------------
create table if not exists public.scope_checks (
  id                      uuid        primary key default uuid_generate_v4(),
  user_id                 uuid        not null references auth.users on delete cascade,
  project_id              uuid        not null references public.projects on delete cascade,
  client_request          text        not null,
  urgency                 text        check (urgency in ('low', 'medium', 'high')),
  client_tone             text        check (client_tone in ('friendly', 'neutral', 'pushy', 'aggressive')),
  extra_notes             text,
  scope_status            text        check (scope_status in ('in_scope', 'out_of_scope', 'needs_clarification')),
  risk_level              text        check (risk_level in ('low', 'medium', 'high')),
  estimated_hours_min     integer,
  estimated_hours_max     integer,
  ai_reason               text,
  suggested_action        text,
  professional_reply      text,
  change_request_summary  text,
  ai_raw_response         jsonb,
  model_used              text        default 'gpt-4o-mini',
  tokens_input            integer,
  tokens_output           integer,
  credits_used            integer     not null default 8,
  created_at              timestamptz default now()
);

-- ----------------------------------------
-- USAGE LOGS  (append-only credit ledger)
-- ----------------------------------------
create table if not exists public.usage_logs (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references auth.users on delete cascade,
  action       text        not null,
  credits_used integer     not null,
  tokens_input integer,
  tokens_output integer,
  model        text,
  project_id   uuid        references public.projects,
  check_id     uuid        references public.scope_checks,
  created_at   timestamptz default now()
);