-- ============================================================================
-- Invoice balance_due must count partially_paid installments as money received.
--
-- Root cause (Nicole/Colby Sandbox invoice INV-2026-3B9F4B):
--   _compute_invoice_total_paid only summed paid / partially_refunded / refunded.
--   Recording $7,164.06 against a $9,164.06 installment sets status=partially_paid.
--   The payment_line_items trigger then rewrote balance_due = total − 0 = full total,
--   even though paid_amount and the TS reconcile formula correctly retained $7,164.06.
--
-- Align the DB helper with lib/payments/invoice-balance.ts:
--   net retained = paid | partially_paid | partially_refunded | refunded
--                  (coalesce(paid_amount, amount) − refunded_amount)
--   cancelled plan commitments are subtracted once (same as computeInvoiceBalanceDue)
--   balance_due = greatest(0, total − cancelled − net_paid)
-- ============================================================================

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
    and pli.status in ('paid', 'partially_paid', 'partially_refunded', 'refunded');
$$;

create or replace function public._compute_invoice_cancelled_plan_amount(p_invoice_id uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(sum(pli.amount), 0)
  from public.payment_line_items pli
  join public.payment_schedules ps on ps.id = pli.schedule_id
  where ps.invoice_id = p_invoice_id
    and pli.status = 'cancelled';
$$;

create or replace function public._compute_invoice_balance_due(p_invoice_id uuid, p_total numeric)
returns numeric
language sql
stable
set search_path = public
as $$
  select greatest(
    0,
    coalesce(p_total, 0)
      - public._compute_invoice_cancelled_plan_amount(p_invoice_id)
      - public._compute_invoice_total_paid(p_invoice_id)
  );
$$;

create or replace function public._trg_invoices_sync_balance_due()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.balance_due := public._compute_invoice_balance_due(new.id, new.total);
  return new;
end;
$$;

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
    update public.invoices i
    set balance_due = public._compute_invoice_balance_due(i.id, i.total)
    where i.id = v_invoice_id;
  end if;

  if tg_op = 'UPDATE' and old.schedule_id is distinct from new.schedule_id then
    select ps.invoice_id into v_invoice_id
    from public.payment_schedules ps
    where ps.id = old.schedule_id;

    if v_invoice_id is not null then
      update public.invoices i
      set balance_due = public._compute_invoice_balance_due(i.id, i.total)
      where i.id = v_invoice_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- Heal any invoices left with a stale full-total balance after partial payments.
update public.invoices i
set balance_due = public._compute_invoice_balance_due(i.id, i.total)
where exists (
  select 1
  from public.payment_schedules ps
  where ps.invoice_id = i.id
);
