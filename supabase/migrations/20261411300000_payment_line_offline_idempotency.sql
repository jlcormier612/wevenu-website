-- Offline payment recording idempotency key.
-- Identical retries (double-click / network retry) for the same installment
-- must not create a second financial movement.

alter table public.payment_line_items
  add column if not exists offline_idempotency_key text;

comment on column public.payment_line_items.offline_idempotency_key is
  'Last client idempotency key that successfully recorded an offline payment against this installment.';
