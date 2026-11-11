-- Invoice status: partially_paid when some (not all) payment has been received.
-- Paid remains reserved for balance_due = 0.

alter table public.invoices
  drop constraint if exists invoices_status_check;

alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'sent', 'partially_paid', 'paid', 'void'));
