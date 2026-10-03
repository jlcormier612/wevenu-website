-- Installment-level partial payment: money received against a line without
-- marking the full installment Paid. Invoice-level partially_paid is separate
-- (20261411100000).

alter table public.payment_line_items
  drop constraint if exists payment_line_items_status_check;

alter table public.payment_line_items
  add constraint payment_line_items_status_check
  check (status = any (array[
    'pending',
    'processing',
    'overdue',
    'partially_paid',
    'paid',
    'cancelled',
    'partially_refunded',
    'refunded'
  ]));
