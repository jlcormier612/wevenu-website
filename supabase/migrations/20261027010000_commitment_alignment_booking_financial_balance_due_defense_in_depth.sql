-- ============================================================================
-- Commitment Alignment Sprint, Item 4 (Booking Financial) — Part D
-- balance_due currently has two independent app-level writers —
-- reconcileInvoiceBalance (lib/payments/repository.ts) after a payment is
-- recorded, and recomputeInvoiceTotals (lib/invoices/repository.ts) after a
-- line-item CRUD — both computing the identical formula
-- (total - sum of net-collected payment_line_items) by convention, not by
-- a shared source. Three docs (booking-financial-architecture-phase1-
-- implementation.md, domain-model.md, architecture-audit.md) claim "exactly
-- one writer," which is stale. Rather than pick one TS writer to remove
-- (out of scope for this sprint), this closes the gap the other direction:
-- balance_due becomes DB-enforced, so no current or future write path —
-- app-level or otherwise — can leave it out of sync with total and the
-- actual collected/refunded payment_line_items.
-- ============================================================================

-- ---- Shared formula, single source of truth for "how much has actually
-- been collected, net of refunds" for an invoice — the same computation
-- getTotalPaidForInvoice/reconcileInvoiceBalance already duplicate in TS.
create or replace function public._compute_invoice_total_paid(p_invoice_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(
    coalesce(pli.paid_amount, pli.amount) - coalesce(pli.refunded_amount, 0)
  ), 0)
  from public.payment_line_items pli
  join public.payment_schedules ps on ps.id = pli.schedule_id
  where ps.invoice_id = p_invoice_id
    and pli.status in ('paid', 'partially_refunded', 'refunded');
$$;

-- ---- Whenever an invoice's own total column changes (by any writer,
-- present or future), keep balance_due in lockstep in the same statement —
-- covers the invoice_line_items -> recomputeInvoiceTotals path structurally,
-- without duplicating that function's subtotal/discount/tax formula here.
create or replace function public._trg_invoices_sync_balance_due()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.balance_due := greatest(0, new.total - public._compute_invoice_total_paid(new.id));
  return new;
end;
$$;

drop trigger if exists trg_invoices_sync_balance_due on public.invoices;
create trigger trg_invoices_sync_balance_due
  before insert or update of total on public.invoices
  for each row
  execute function public._trg_invoices_sync_balance_due();

-- ---- Whenever a payment_line_item is recorded, edited, refunded, or
-- deleted, resync the linked invoice's balance_due — covers the
-- payment-side path structurally (any current or future write to this
-- table, not just reconcileInvoiceBalance's own call sites).
create or replace function public._trg_payment_line_items_sync_balance_due()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_invoice_id uuid;
begin
  select ps.invoice_id into v_invoice_id
  from public.payment_schedules ps
  where ps.id = coalesce(new.schedule_id, old.schedule_id);

  if v_invoice_id is not null then
    update public.invoices
    set balance_due = greatest(0, total - public._compute_invoice_total_paid(v_invoice_id))
    where id = v_invoice_id;
  end if;

  -- An update that moves a line item to a different schedule (not a real
  -- flow today, but not structurally impossible) — resync the old invoice too.
  if tg_op = 'UPDATE' and old.schedule_id is distinct from new.schedule_id then
    select ps.invoice_id into v_invoice_id
    from public.payment_schedules ps
    where ps.id = old.schedule_id;

    if v_invoice_id is not null then
      update public.invoices
      set balance_due = greatest(0, total - public._compute_invoice_total_paid(v_invoice_id))
      where id = v_invoice_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_payment_line_items_sync_balance_due on public.payment_line_items;
create trigger trg_payment_line_items_sync_balance_due
  after insert or update or delete on public.payment_line_items
  for each row
  execute function public._trg_payment_line_items_sync_balance_due();
