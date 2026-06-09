-- ============================================
-- Harden credit refunds
-- Refunds must be initiated by trusted server code, not user-facing RPC access.
-- ============================================

revoke execute on function public.refund_credits(integer) from public;
revoke execute on function public.refund_credits(integer) from anon;
revoke execute on function public.refund_credits(integer) from authenticated;

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

  return v_balance;
end;
$$;

revoke execute on function public.admin_refund_credits(uuid, integer) from public;
revoke execute on function public.admin_refund_credits(uuid, integer) from anon;
revoke execute on function public.admin_refund_credits(uuid, integer) from authenticated;
grant execute on function public.admin_refund_credits(uuid, integer) to service_role;
