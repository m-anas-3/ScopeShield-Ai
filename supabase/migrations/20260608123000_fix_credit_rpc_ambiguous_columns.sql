-- ============================================
-- Fix ambiguous credits_balance references in credit RPCs
-- ============================================

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
