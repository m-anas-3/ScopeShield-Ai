-- ============================================
-- Remove subscription billing artifacts
-- ============================================

drop function if exists public.admin_apply_subscription_credit_grant(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  timestamptz
);

do $$
begin
  if to_regclass('public.subscription_credit_grants') is not null then
    drop policy if exists "subscription_credit_grants: select own"
      on public.subscription_credit_grants;
  end if;
end;
$$;

drop table if exists public.subscription_credit_grants;

alter table public.profiles
  drop column if exists plan,
  drop column if exists stripe_subscription_id,
  drop column if exists stripe_subscription_price_id,
  drop column if exists subscription_status,
  drop column if exists subscription_current_period_end;

update public.credit_ledger_entries
set
  source = 'purchase',
  metadata = coalesce(metadata, '{}'::jsonb)
    || jsonb_build_object('legacy_source', 'subscription')
where source = 'subscription';

alter table public.credit_ledger_entries
  drop constraint if exists credit_ledger_entries_source_check;

alter table public.credit_ledger_entries
  add constraint credit_ledger_entries_source_check
  check (
    source in (
      'starter',
      'monthly_free',
      'purchase',
      'scope_check',
      'refund'
    )
  );

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

  select p.credits_balance, p.created_at
  into v_balance, v_created_at
  from public.profiles as p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
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

revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from public;
revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from anon;
revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from authenticated;
grant execute on function public.admin_grant_monthly_free_credits(uuid, date) to service_role;
