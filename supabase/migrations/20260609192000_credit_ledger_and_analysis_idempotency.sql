-- ============================================
-- Credit ledger, analysis idempotency, and launch indexes
-- ============================================

create table if not exists public.credit_ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  direction text not null check (direction in ('credit', 'debit')),
  source text not null check (
    source in (
      'starter',
      'monthly_free',
      'purchase',
      'subscription',
      'scope_check',
      'refund'
    )
  ),
  credits integer not null check (credits > 0),
  balance_after integer not null check (balance_after >= 0),
  idempotency_key text,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists credit_ledger_entries_idempotency_key_unique
  on public.credit_ledger_entries (idempotency_key)
  where idempotency_key is not null;

create index if not exists credit_ledger_entries_user_created_idx
  on public.credit_ledger_entries (user_id, created_at desc);

alter table public.credit_ledger_entries enable row level security;

drop policy if exists "credit_ledger_entries: select own"
  on public.credit_ledger_entries;
create policy "credit_ledger_entries: select own"
  on public.credit_ledger_entries
  for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.credit_ledger_entries from public;
revoke insert, update, delete on public.credit_ledger_entries from anon;
revoke insert, update, delete on public.credit_ledger_entries from authenticated;

insert into public.credit_ledger_entries (
  user_id,
  direction,
  source,
  credits,
  balance_after,
  idempotency_key,
  reference_type,
  reference_id
)
select
  p.id,
  'credit',
  'starter',
  30,
  greatest(p.credits_balance, 0),
  'starter:' || p.id::text,
  'profile',
  p.id::text
from public.profiles as p
on conflict do nothing;

create table if not exists public.analysis_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  scope_check_id uuid references public.scope_checks on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_requests_user_key_unique
    unique (user_id, idempotency_key)
);

create index if not exists analysis_requests_user_created_idx
  on public.analysis_requests (user_id, created_at desc);

alter table public.analysis_requests enable row level security;

drop policy if exists "analysis_requests: select own"
  on public.analysis_requests;
create policy "analysis_requests: select own"
  on public.analysis_requests
  for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.analysis_requests from public;
revoke insert, update, delete on public.analysis_requests from anon;
revoke insert, update, delete on public.analysis_requests from authenticated;

create index if not exists projects_user_created_idx
  on public.projects (user_id, created_at desc);

create index if not exists scope_checks_user_created_idx
  on public.scope_checks (user_id, created_at desc);

create index if not exists usage_logs_user_created_idx
  on public.usage_logs (user_id, created_at desc);

create index if not exists credit_purchases_user_created_idx
  on public.credit_purchases (user_id, created_at desc);

create index if not exists subscription_credit_grants_user_created_idx
  on public.subscription_credit_grants (user_id, created_at desc);

create index if not exists monthly_credit_grants_user_created_idx
  on public.monthly_credit_grants (user_id, created_at desc);

-- Starter credits are now also recorded in the ledger for new profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  insert into public.profiles (id, full_name, avatar_url, credits_balance)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    30
  )
  on conflict (id) do nothing
  returning id into v_profile_id;

  if v_profile_id is not null then
    insert into public.credit_ledger_entries (
      user_id,
      direction,
      source,
      credits,
      balance_after,
      idempotency_key,
      reference_type,
      reference_id
    )
    values (
      new.id,
      'credit',
      'starter',
      30,
      30,
      'starter:' || new.id::text,
      'auth_user',
      new.id::text
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

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
    insert into public.credit_ledger_entries (
      user_id,
      direction,
      source,
      credits,
      balance_after,
      reference_type
    )
    values (
      v_user_id,
      'debit',
      'scope_check',
      p_credits,
      v_balance,
      'analysis'
    );

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

create or replace function public.admin_refund_credits(
  p_user_id uuid,
  p_credits integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if p_credits is null or p_credits <= 0 then
    raise exception 'Invalid credit amount';
  end if;

  update public.profiles as p
  set credits_balance = p.credits_balance + p_credits
  where p.id = p_user_id
  returning p.credits_balance into v_balance;

  if v_balance is null then
    raise exception 'Profile not found';
  end if;

  insert into public.credit_ledger_entries (
    user_id,
    direction,
    source,
    credits,
    balance_after,
    reference_type
  )
  values (
    p_user_id,
    'credit',
    'refund',
    p_credits,
    v_balance,
    'analysis'
  );

  return v_balance;
end;
$$;

create or replace function public.admin_apply_credit_purchase(
  p_user_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_price_id text,
  p_credits integer,
  p_amount_cents integer,
  p_currency text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_balance integer;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if p_checkout_session_id is null or length(trim(p_checkout_session_id)) = 0 then
    raise exception 'Checkout session id is required';
  end if;

  if p_price_id is null or length(trim(p_price_id)) = 0 then
    raise exception 'Price id is required';
  end if;

  if p_credits is null or p_credits <= 0 then
    raise exception 'Invalid credit amount';
  end if;

  insert into public.credit_purchases (
    user_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_price_id,
    credits_added,
    amount_cents,
    currency,
    status
  )
  values (
    p_user_id,
    p_checkout_session_id,
    p_payment_intent_id,
    p_price_id,
    p_credits,
    p_amount_cents,
    lower(p_currency),
    'paid'
  )
  on conflict (stripe_checkout_session_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is not null then
    update public.profiles as p
    set credits_balance = p.credits_balance + p_credits
    where p.id = p_user_id
    returning p.credits_balance into v_balance;

    insert into public.credit_ledger_entries (
      user_id,
      direction,
      source,
      credits,
      balance_after,
      idempotency_key,
      reference_type,
      reference_id,
      metadata
    )
    values (
      p_user_id,
      'credit',
      'purchase',
      p_credits,
      v_balance,
      'stripe_checkout_session:' || p_checkout_session_id,
      'stripe_checkout_session',
      p_checkout_session_id,
      jsonb_build_object(
        'stripe_price_id', p_price_id,
        'stripe_payment_intent_id', p_payment_intent_id,
        'amount_cents', p_amount_cents,
        'currency', lower(p_currency)
      )
    )
    on conflict do nothing;
  else
    select p.credits_balance
    into v_balance
    from public.profiles as p
    where p.id = p_user_id;
  end if;

  if v_balance is null then
    raise exception 'Profile not found';
  end if;

  return v_balance;
end;
$$;

create or replace function public.admin_apply_subscription_credit_grant(
  p_user_id uuid,
  p_invoice_id text,
  p_subscription_id text,
  p_price_id text,
  p_plan text,
  p_credits integer,
  p_period_end timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant_id uuid;
  v_balance integer;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  if p_invoice_id is null or length(trim(p_invoice_id)) = 0 then
    raise exception 'Invoice id is required';
  end if;

  if p_subscription_id is null or length(trim(p_subscription_id)) = 0 then
    raise exception 'Subscription id is required';
  end if;

  if p_price_id is null or length(trim(p_price_id)) = 0 then
    raise exception 'Price id is required';
  end if;

  if p_plan not in ('pro', 'agency') then
    raise exception 'Invalid plan';
  end if;

  if p_credits is null or p_credits <= 0 then
    raise exception 'Invalid credit amount';
  end if;

  insert into public.subscription_credit_grants (
    user_id,
    stripe_invoice_id,
    stripe_subscription_id,
    stripe_price_id,
    plan,
    credits_granted,
    period_end
  )
  values (
    p_user_id,
    p_invoice_id,
    p_subscription_id,
    p_price_id,
    p_plan,
    p_credits,
    p_period_end
  )
  on conflict (stripe_invoice_id) do nothing
  returning id into v_grant_id;

  if v_grant_id is not null then
    update public.profiles as p
    set
      plan = p_plan,
      credits_balance = p.credits_balance + p_credits,
      credits_reset_at = coalesce(p_period_end, p.credits_reset_at),
      stripe_subscription_id = p_subscription_id,
      stripe_subscription_price_id = p_price_id,
      subscription_status = 'active',
      subscription_current_period_end = p_period_end
    where p.id = p_user_id
    returning p.credits_balance into v_balance;

    insert into public.credit_ledger_entries (
      user_id,
      direction,
      source,
      credits,
      balance_after,
      idempotency_key,
      reference_type,
      reference_id,
      metadata
    )
    values (
      p_user_id,
      'credit',
      'subscription',
      p_credits,
      v_balance,
      'stripe_invoice:' || p_invoice_id,
      'stripe_invoice',
      p_invoice_id,
      jsonb_build_object(
        'stripe_subscription_id', p_subscription_id,
        'stripe_price_id', p_price_id,
        'plan', p_plan
      )
    )
    on conflict do nothing;
  else
    select p.credits_balance
    into v_balance
    from public.profiles as p
    where p.id = p_user_id;
  end if;

  if v_balance is null then
    raise exception 'Profile not found';
  end if;

  return v_balance;
end;
$$;

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

    insert into public.credit_ledger_entries (
      user_id,
      direction,
      source,
      credits,
      balance_after,
      idempotency_key,
      reference_type,
      reference_id
    )
    values (
      p_user_id,
      'credit',
      'monthly_free',
      10,
      v_balance,
      'monthly_free:' || p_user_id::text || ':' || v_grant_month::text,
      'grant_month',
      v_grant_month::text
    )
    on conflict do nothing;
  end if;

  return v_balance;
end;
$$;

revoke execute on function public.consume_credits(integer) from public;
revoke execute on function public.consume_credits(integer) from anon;
grant execute on function public.consume_credits(integer) to authenticated;

revoke execute on function public.admin_refund_credits(uuid, integer) from public;
revoke execute on function public.admin_refund_credits(uuid, integer) from anon;
revoke execute on function public.admin_refund_credits(uuid, integer) from authenticated;
grant execute on function public.admin_refund_credits(uuid, integer) to service_role;

revoke execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) from public;
revoke execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) from anon;
revoke execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) from authenticated;
grant execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) to service_role;

revoke execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) from public;
revoke execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) from anon;
revoke execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) from authenticated;
grant execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) to service_role;

revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from public;
revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from anon;
revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from authenticated;
grant execute on function public.admin_grant_monthly_free_credits(uuid, date) to service_role;
