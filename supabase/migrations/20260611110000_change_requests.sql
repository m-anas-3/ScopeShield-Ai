-- ============================================
-- Change requests, public approvals, and reports
-- ============================================

create extension if not exists pgcrypto;

create table if not exists public.change_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  scope_check_id uuid references public.scope_checks on delete set null,
  title text not null check (
    char_length(title) between 3 and 160
  ),
  summary text not null check (
    char_length(summary) between 1 and 6000
  ),
  client_message text,
  estimated_hours_min integer check (
    estimated_hours_min is null or estimated_hours_min >= 0
  ),
  estimated_hours_max integer check (
    estimated_hours_max is null or estimated_hours_max >= 0
  ),
  hourly_rate_snapshot numeric(10,2) check (
    hourly_rate_snapshot is null or hourly_rate_snapshot >= 0
  ),
  fixed_price numeric(12,2) check (
    fixed_price is null or fixed_price >= 0
  ),
  estimated_total numeric(12,2) check (
    estimated_total is null or estimated_total >= 0
  ),
  currency text not null default 'USD' check (
    currency = upper(currency) and char_length(currency) = 3
  ),
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'approved', 'rejected', 'paid')
  ),
  public_share_token text not null default encode(gen_random_bytes(24), 'hex')
    check (char_length(public_share_token) >= 32),
  client_response_note text,
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_requests_hours_range_check check (
    estimated_hours_min is null or
    estimated_hours_max is null or
    estimated_hours_min <= estimated_hours_max
  )
);

do $$
begin
  alter table public.change_requests
    add constraint change_requests_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

create unique index if not exists change_requests_public_share_token_unique
  on public.change_requests (public_share_token);

create unique index if not exists change_requests_scope_check_unique
  on public.change_requests (scope_check_id)
  where scope_check_id is not null;

create index if not exists change_requests_user_created_idx
  on public.change_requests (user_id, created_at desc);

create index if not exists change_requests_project_created_idx
  on public.change_requests (project_id, created_at desc);

create index if not exists change_requests_user_status_created_idx
  on public.change_requests (user_id, status, created_at desc);

create or replace function public.validate_change_request_links()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.projects as p
    where p.id = new.project_id
      and p.user_id = new.user_id
  ) then
    raise exception 'Change request project must belong to the user.';
  end if;

  if new.scope_check_id is not null and not exists (
    select 1
    from public.scope_checks as sc
    where sc.id = new.scope_check_id
      and sc.user_id = new.user_id
      and sc.project_id = new.project_id
  ) then
    raise exception 'Change request scope check must belong to the same project and user.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_change_request_links on public.change_requests;
create trigger validate_change_request_links
  before insert or update on public.change_requests
  for each row execute function public.validate_change_request_links();

create or replace function public.sync_change_request_status_timestamps()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'paid' and new.status is distinct from old.status then
    raise exception 'Paid change requests cannot change status.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'rejected' and new.status is distinct from old.status then
    raise exception 'Rejected change requests cannot change status.';
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and new.status not in ('approved', 'paid') then
    raise exception 'Approved change requests can only be marked paid.';
  end if;

  if new.status = 'approved' and (
    tg_op = 'INSERT' or old.status is distinct from new.status
  ) and new.approved_at is null then
    new.approved_at = now();
  end if;

  if new.status = 'rejected' and (
    tg_op = 'INSERT' or old.status is distinct from new.status
  ) and new.rejected_at is null then
    new.rejected_at = now();
  end if;

  if new.status = 'paid' and (
    tg_op = 'INSERT' or old.status is distinct from new.status
  ) and new.paid_at is null then
    new.paid_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_change_request_status_timestamps on public.change_requests;
create trigger sync_change_request_status_timestamps
  before insert or update on public.change_requests
  for each row execute function public.sync_change_request_status_timestamps();

drop trigger if exists change_requests_updated_at on public.change_requests;
create trigger change_requests_updated_at
  before update on public.change_requests
  for each row execute function public.handle_updated_at();

alter table public.change_requests enable row level security;

drop policy if exists "change_requests: select own" on public.change_requests;
drop policy if exists "change_requests: insert own project/check" on public.change_requests;
drop policy if exists "change_requests: update own project/check" on public.change_requests;
drop policy if exists "change_requests: delete own" on public.change_requests;

create policy "change_requests: select own"
  on public.change_requests
  for select
  using (auth.uid() = user_id);

create policy "change_requests: insert own project/check"
  on public.change_requests
  for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1
      from public.projects
      where projects.id = change_requests.project_id
        and projects.user_id = auth.uid()
    ) and (
      change_requests.scope_check_id is null or
      exists (
        select 1
        from public.scope_checks
        where scope_checks.id = change_requests.scope_check_id
          and scope_checks.user_id = auth.uid()
          and scope_checks.project_id = change_requests.project_id
      )
    )
  );

create policy "change_requests: update own project/check"
  on public.change_requests
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id and
    exists (
      select 1
      from public.projects
      where projects.id = change_requests.project_id
        and projects.user_id = auth.uid()
    ) and (
      change_requests.scope_check_id is null or
      exists (
        select 1
        from public.scope_checks
        where scope_checks.id = change_requests.scope_check_id
          and scope_checks.user_id = auth.uid()
          and scope_checks.project_id = change_requests.project_id
      )
    )
  );

create policy "change_requests: delete own"
  on public.change_requests
  for delete
  using (auth.uid() = user_id);

grant select on public.change_requests to authenticated;
revoke insert, update, delete on public.change_requests from public;
revoke insert, update, delete on public.change_requests from anon;
revoke insert, update, delete on public.change_requests from authenticated;

create or replace function public.get_shared_change_request(p_token text)
returns table (
  id uuid,
  title text,
  summary text,
  client_message text,
  estimated_hours_min integer,
  estimated_hours_max integer,
  hourly_rate_snapshot numeric,
  fixed_price numeric,
  estimated_total numeric,
  currency text,
  status text,
  client_response_note text,
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  project_name text,
  client_name text,
  scope_status text,
  risk_level text,
  ai_reason text,
  matched_clauses jsonb,
  matched_clause_ids jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cr.id,
    cr.title,
    cr.summary,
    cr.client_message,
    cr.estimated_hours_min,
    cr.estimated_hours_max,
    cr.hourly_rate_snapshot,
    cr.fixed_price,
    cr.estimated_total,
    cr.currency,
    cr.status,
    cr.client_response_note,
    cr.approved_at,
    cr.rejected_at,
    cr.paid_at,
    cr.created_at,
    cr.updated_at,
    p.name as project_name,
    p.client_name,
    sc.scope_status,
    sc.risk_level,
    sc.ai_reason,
    coalesce(sc.matched_clauses, '[]'::jsonb) as matched_clauses,
    coalesce(sc.matched_clause_ids, '[]'::jsonb) as matched_clause_ids
  from public.change_requests as cr
  join public.projects as p on p.id = cr.project_id
  left join public.scope_checks as sc on sc.id = cr.scope_check_id
  where cr.public_share_token = p_token
  limit 1;
$$;

create or replace function public.respond_to_shared_change_request(
  p_token text,
  p_response text,
  p_note text default null
)
returns table (
  id uuid,
  status text,
  client_response_note text,
  approved_at timestamptz,
  rejected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_response not in ('approved', 'rejected') then
    raise exception 'Invalid response.';
  end if;

  return query
  update public.change_requests as cr
  set
    status = p_response,
    client_response_note = nullif(left(trim(coalesce(p_note, '')), 1000), ''),
    approved_at = case when p_response = 'approved' then now() else cr.approved_at end,
    rejected_at = case when p_response = 'rejected' then now() else cr.rejected_at end,
    updated_at = now()
  where cr.public_share_token = p_token
    and cr.status = 'sent'
  returning
    cr.id,
    cr.status,
    cr.client_response_note,
    cr.approved_at,
    cr.rejected_at;
end;
$$;

revoke execute on function public.get_shared_change_request(text) from public;
revoke execute on function public.respond_to_shared_change_request(text, text, text) from public;
grant execute on function public.get_shared_change_request(text) to anon, authenticated;
grant execute on function public.respond_to_shared_change_request(text, text, text) to anon, authenticated;
