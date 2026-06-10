-- ============================================
-- Monthly free credits
-- ============================================

-- Keep starter credits explicit for every new profile creation path.
alter table public.profiles
  alter column credits_balance set default 30;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, credits_balance)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    30
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create table if not exists public.monthly_credit_grants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  grant_month date not null,
  credits_granted integer not null check (credits_granted > 0),
  created_at timestamptz not null default now(),
  constraint monthly_credit_grants_month_start
    check (extract(day from grant_month) = 1),
  constraint monthly_credit_grants_user_month_unique
    unique (user_id, grant_month)
);

alter table public.monthly_credit_grants enable row level security;

drop policy if exists "monthly_credit_grants: select own"
  on public.monthly_credit_grants;
create policy "monthly_credit_grants: select own"
  on public.monthly_credit_grants
  for select
  using (auth.uid() = user_id);

create or replace function public.admin_grant_monthly_free_credits(
  p_user_id uuid,
  p_grant_month date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant_month date;
  v_grant_id uuid;
  v_plan text;
  v_balance integer;
  v_created_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  v_grant_month := coalesce(
    p_grant_month,
    date_trunc('month', timezone('utc', now()))::date
  );

  if v_grant_month is null or extract(day from v_grant_month) <> 1 then
    raise exception 'Grant month must be the first day of a calendar month';
  end if;

  select p.plan, p.credits_balance, p.created_at
  into v_plan, v_balance, v_created_at
  from public.profiles as p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_plan <> 'free' then
    return v_balance;
  end if;

  -- The 30 starter credits cover the signup month.
  if v_created_at >= (v_grant_month::timestamp at time zone 'utc') then
    return v_balance;
  end if;

  insert into public.monthly_credit_grants (
    user_id,
    grant_month,
    credits_granted
  )
  values (
    p_user_id,
    v_grant_month,
    10
  )
  on conflict (user_id, grant_month) do nothing
  returning id into v_grant_id;

  if v_grant_id is not null then
    update public.profiles as p
    set credits_balance = p.credits_balance + 10
    where p.id = p_user_id
    returning p.credits_balance into v_balance;
  end if;

  return v_balance;
end;
$$;

revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from public;
revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from anon;
revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from authenticated;
grant execute on function public.admin_grant_monthly_free_credits(uuid, date) to service_role;
