-- Cache of the last confirmed QuickBooks Payment net-retained amount after
-- refund reconciliation (paid_amount − refunded_amount). Source of truth
-- remains the payment_line_items ledger plus a GET of the remote Payment;
-- this column only skips a no-op Intuit round-trip when unchanged.

alter table public.payment_line_items
  add column if not exists quickbooks_refund_net_synced numeric;

comment on column public.payment_line_items.quickbooks_refund_net_synced is
  'Last confirmed QuickBooks Payment applied amount after refund reconcile (paid − refunded). Cache only.';
