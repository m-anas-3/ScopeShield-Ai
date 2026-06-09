-- Ensure webhook events are marked processed only after handler success.
alter table public.stripe_events
  alter column processed_at drop default;
