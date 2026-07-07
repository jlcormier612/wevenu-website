-- ============================================================================
-- TR-M3 — No refund/void capability exists anywhere
-- Resolves docs/trust-risk-register.md TR-M3: there was no way to record a
-- real-world refund in Wevenu at all. Adds refund tracking to
-- payment_line_items; the app layer (lib/payments/repository.ts) computes
-- the new status and reconciles the invoice balance.
-- ============================================================================

alter table public.payment_line_items
  add column refunded_amount numeric(12,2) not null default 0,
  add column refunded_at timestamptz,
  add column refund_reason text;

alter table public.payment_line_items drop constraint payment_line_items_status_check;

alter table public.payment_line_items add constraint payment_line_items_status_check
  check (status = any (array['pending', 'overdue', 'paid', 'cancelled', 'partially_refunded', 'refunded']));
