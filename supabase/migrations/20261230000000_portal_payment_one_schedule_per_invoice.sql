-- ============================================================================
-- Couple portal payment obligation reconciliation
--
-- Booking Financial Architecture Decision 5: one Payment Plan per Invoice.
-- Duplicate schedules linked to the same invoice inflated Home remaining
-- balance (summing every schedule) and duplicated First/Second Installment
-- rows via buildUnifiedTaskList, while Payments UI silently showed
-- schedules[0] only.
--
-- 1) Remove unpaid duplicate schedules sharing an invoice (keep newest).
-- 2) get_portal_payments returns at most one schedule per invoice_id.
-- ============================================================================

-- ── 1. Clean duplicate schedules (safe: no paid/processing collections) ─────
with ranked as (
  select
    ps.id,
    ps.invoice_id,
    row_number() over (
      partition by ps.invoice_id
      order by ps.created_at desc, ps.id desc
    ) as rn
  from public.payment_schedules ps
  where ps.invoice_id is not null
),
dupes as (
  select r.id
  from ranked r
  where r.rn > 1
    and not exists (
      select 1
      from public.payment_line_items pli
      where pli.schedule_id = r.id
        and pli.status in (
          'paid', 'processing', 'partially_refunded', 'refunded', 'refund_pending'
        )
    )
)
delete from public.payment_schedules ps
where ps.id in (select id from dupes);

-- ── 2. Portal RPC: one schedule per invoice (newest wins) ───────────────────
create or replace function public.get_portal_payments(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_session.access_level = 'planning' then
    return jsonb_build_object('schedules', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'schedules', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',          ps.id,
            'title',       ps.title,
            'totalAmount', ps.total_amount,
            'currency',    ps.currency,
            'notes',       ps.notes,
            'invoiceId',   ps.invoice_id,
            'createdAt',   ps.created_at,
            'lineItems', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id',            pli.id,
                    'label',         pli.label,
                    'amount',        pli.amount,
                    'dueDate',       pli.due_date,
                    'status',        pli.status,
                    'paidAt',        pli.paid_at,
                    'paidAmount',    pli.paid_amount,
                    'paymentMethod', pli.payment_method,
                    'notes',         pli.notes,
                    'sortOrder',     pli.sort_order
                  )
                  order by pli.sort_order, pli.due_date nulls last
                ),
                '[]'::jsonb
              )
              from public.payment_line_items pli
              where pli.schedule_id = ps.id
                and pli.venue_id    = v_session.venue_id
                and pli.status     != 'cancelled'
            )
          )
          order by ps.created_at desc
        ),
        '[]'::jsonb
      )
      from (
        -- One plan per invoice; grandfathered null-invoice rows stay distinct
        -- (keyed by their own id via coalesce).
        select distinct on (coalesce(ps0.invoice_id, ps0.id))
          ps0.*
        from public.payment_schedules ps0
        left join public.invoices inv on inv.id = ps0.invoice_id
        where ps0.client_id = v_session.client_id
          and ps0.venue_id  = v_session.venue_id
          and (ps0.invoice_id is null or inv.status != 'draft')
        order by coalesce(ps0.invoice_id, ps0.id), ps0.created_at desc, ps0.id desc
      ) ps
    )
  );
end;
$$;

grant execute on function public.get_portal_payments(text) to anon, authenticated;
