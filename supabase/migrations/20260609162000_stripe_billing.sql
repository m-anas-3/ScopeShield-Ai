-- ============================================
-- Stripe billing, credit packs, and subscription credit grants
-- ============================================

alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_subscription_price_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_current_period_end timestamptz;

create table if not exists public.credit_purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  stripe_price_id text not null,
  credits_added integer not null check (credits_added > 0),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  currency text,
  status text not null default 'paid'
    check (status in ('paid', 'refunded', 'failed')),
  created_at timestamptz default now()
);

create unique index if not exists credit_purchases_payment_intent_unique
  on public.credit_purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table if not exists public.subscription_credit_grants (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text not null,
  stripe_price_id text not null,
  plan text not null check (plan in ('pro', 'agency')),
  credits_granted integer not null check (credits_granted > 0),
  period_end timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  livemode boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz default now()
);

alter table public.credit_purchases enable row level security;
alter table public.subscription_credit_grants enable row level security;
alter table public.stripe_events enable row level security;

drop policy if exists "credit_purchases: select own" on public.credit_purchases;
create policy "credit_purchases: select own"
  on public.credit_purchases
  for select
  using (auth.uid() = user_id);

drop policy if exists "subscription_credit_grants: select own"
  on public.subscription_credit_grants;
create policy "subscription_credit_grants: select own"
  on public.subscription_credit_grants
  for select
  using (auth.uid() = user_id);

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
      credits_balance = greatest(p.credits_balance, p_credits),
      credits_reset_at = coalesce(p_period_end, p.credits_reset_at),
      stripe_subscription_id = p_subscription_id,
      stripe_subscription_price_id = p_price_id,
      subscription_status = 'active',
      subscription_current_period_end = p_period_end
    where p.id = p_user_id
    returning p.credits_balance into v_balance;
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

revoke execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) from public;
revoke execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) from anon;
revoke execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) from authenticated;
grant execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) to service_role;

revoke execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) from public;
revoke execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) from anon;
revoke execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) from authenticated;
grant execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) to service_role;
