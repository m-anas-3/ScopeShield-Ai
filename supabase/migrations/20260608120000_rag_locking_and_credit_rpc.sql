-- ============================================
-- Migration 4: Scope locking, RAG storage, and atomic credits
-- ============================================

create extension if not exists vector;

-- ----------------------------------------
-- PROJECT LOCKING METADATA
-- ----------------------------------------
alter table public.projects
  add column if not exists scope_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists scope_embedding_model text,
  add column if not exists scope_chunks_count integer not null default 0;

do $$
begin
  alter table public.projects
    add constraint projects_id_user_id_unique unique (id, user_id);
exception
  when duplicate_object then null;
end $$;

create or replace function public.prevent_locked_project_scope_edits()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.scope_locked and not new.scope_locked then
    raise exception 'Locked project scopes cannot be unlocked.';
  end if;

  if old.scope_locked and (
    new.name is distinct from old.name or
    new.client_name is distinct from old.client_name or
    new.original_scope is distinct from old.original_scope or
    new.deliverables is distinct from old.deliverables or
    new.exclusions is distinct from old.exclusions or
    new.revision_limit is distinct from old.revision_limit or
    new.hourly_rate is distinct from old.hourly_rate
  ) then
    raise exception 'Locked project scopes cannot be edited.';
  end if;

  if not old.scope_locked and new.scope_locked and new.locked_at is null then
    new.locked_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_locked_project_scope_edits on public.projects;
create trigger prevent_locked_project_scope_edits
  before update on public.projects
  for each row execute function public.prevent_locked_project_scope_edits();

-- ----------------------------------------
-- SCOPE CHUNKS
-- ----------------------------------------
create table if not exists public.scope_chunks (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references auth.users on delete cascade,
  project_id      uuid        not null references public.projects on delete cascade,
  chunk_index     integer     not null check (chunk_index >= 0),
  source_field    text        not null check (
                               source_field in (
                                 'original_scope',
                                 'deliverables',
                                 'exclusions',
                                 'terms'
                               )
                             ),
  chunk_text      text        not null check (char_length(chunk_text) > 0),
  token_estimate  integer     not null default 0 check (token_estimate >= 0),
  embedding       vector(1536) not null,
  embedding_model text        not null default 'text-embedding-3-small',
  created_at      timestamptz default now(),
  unique (project_id, chunk_index)
);

do $$
begin
  alter table public.scope_chunks
    add constraint scope_chunks_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

create index if not exists scope_chunks_project_user_idx
  on public.scope_chunks (project_id, user_id);

create index if not exists scope_chunks_embedding_hnsw_idx
  on public.scope_chunks using hnsw (embedding vector_cosine_ops);

alter table public.scope_chunks enable row level security;

drop policy if exists "scope_chunks: own rows" on public.scope_chunks;
drop policy if exists "scope_chunks: select own" on public.scope_chunks;
drop policy if exists "scope_chunks: insert own unlocked project" on public.scope_chunks;
drop policy if exists "scope_chunks: delete own unlocked project" on public.scope_chunks;

create policy "scope_chunks: select own"
  on public.scope_chunks
  for select
  using (auth.uid() = user_id);

create policy "scope_chunks: insert own unlocked project"
  on public.scope_chunks
  for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1
      from public.projects
      where projects.id = scope_chunks.project_id
        and projects.user_id = auth.uid()
        and projects.scope_locked = false
    )
  );

create policy "scope_chunks: delete own unlocked project"
  on public.scope_chunks
  for delete
  using (
    auth.uid() = user_id and
    exists (
      select 1
      from public.projects
      where projects.id = scope_chunks.project_id
        and projects.user_id = auth.uid()
        and projects.scope_locked = false
    )
  );

-- ----------------------------------------
-- RAG MATCHING RPC
-- ----------------------------------------
create or replace function public.match_scope_chunks(
  p_project_id uuid,
  p_query_embedding vector(1536),
  p_match_count integer default 6,
  p_similarity_threshold double precision default 0.1
)
returns table (
  id uuid,
  project_id uuid,
  chunk_index integer,
  source_field text,
  chunk_text text,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    sc.id,
    sc.project_id,
    sc.chunk_index,
    sc.source_field,
    sc.chunk_text,
    1 - (sc.embedding <=> p_query_embedding) as similarity
  from public.scope_chunks sc
  where sc.project_id = p_project_id
    and sc.user_id = auth.uid()
    and 1 - (sc.embedding <=> p_query_embedding) >= p_similarity_threshold
  order by sc.embedding <=> p_query_embedding
  limit least(greatest(coalesce(p_match_count, 6), 1), 12);
$$;

grant execute on function public.match_scope_chunks(uuid, vector, integer, double precision)
  to authenticated;

-- ----------------------------------------
-- STORE RETRIEVAL EVIDENCE WITH CHECKS
-- ----------------------------------------
alter table public.scope_checks
  add column if not exists matched_clauses jsonb not null default '[]'::jsonb,
  add column if not exists matched_clause_ids jsonb not null default '[]'::jsonb,
  add column if not exists embedding_model text;

do $$
begin
  alter table public.scope_checks
    add constraint scope_checks_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

-- ----------------------------------------
-- ATOMIC CREDIT RPCS
-- ----------------------------------------
create or replace function public.consume_credits(p_credits integer)
returns table (
  success boolean,
  credits_balance integer,
  reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
begin
  if v_user_id is null then
    return query select false, null::integer, 'unauthorized'::text;
    return;
  end if;

  if p_credits is null or p_credits <= 0 then
    return query select false, null::integer, 'invalid_amount'::text;
    return;
  end if;

  update public.profiles as p
  set credits_balance = p.credits_balance - p_credits
  where p.id = v_user_id
    and p.credits_balance >= p_credits
  returning p.credits_balance into v_balance;

  if found then
    return query select true, v_balance, null::text;
    return;
  end if;

  select p.credits_balance
  into v_balance
  from public.profiles as p
  where p.id = v_user_id;

  if v_balance is null then
    return query select false, null::integer, 'profile_not_found'::text;
  else
    return query select false, v_balance, 'insufficient_credits'::text;
  end if;
end;
$$;

create or replace function public.refund_credits(p_credits integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if p_credits is null or p_credits <= 0 then
    raise exception 'Invalid credit amount';
  end if;

  update public.profiles as p
  set credits_balance = p.credits_balance + p_credits
  where p.id = v_user_id
  returning p.credits_balance into v_balance;

  if v_balance is null then
    raise exception 'Profile not found';
  end if;

  return v_balance;
end;
$$;

grant execute on function public.consume_credits(integer) to authenticated;
grant execute on function public.refund_credits(integer) to authenticated;

-- ----------------------------------------
-- RLS HARDENING
-- ----------------------------------------
drop policy if exists "profiles: own row" on public.profiles;
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "scope_checks: own rows" on public.scope_checks;
drop policy if exists "scope_checks: select own" on public.scope_checks;
drop policy if exists "scope_checks: insert own project" on public.scope_checks;

create policy "scope_checks: select own"
  on public.scope_checks
  for select
  using (auth.uid() = user_id);

create policy "scope_checks: insert own project"
  on public.scope_checks
  for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1
      from public.projects
      where projects.id = scope_checks.project_id
        and projects.user_id = auth.uid()
    )
  );

drop policy if exists "usage_logs: insert own" on public.usage_logs;
create policy "usage_logs: insert own"
  on public.usage_logs
  for insert
  with check (
    auth.uid() = user_id and
    (
      project_id is null or
      exists (
        select 1
        from public.projects
        where projects.id = usage_logs.project_id
          and projects.user_id = auth.uid()
      )
    ) and
    (
      check_id is null or
      exists (
        select 1
        from public.scope_checks
        where scope_checks.id = usage_logs.check_id
          and scope_checks.user_id = auth.uid()
      )
    )
  );
