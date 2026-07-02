-- Sprint 79: Portal Payments — couple-facing financial view.
--
-- Exposes payment schedules and line items through the existing portal token system.
-- Read-only; couples cannot mark payments paid through the portal (future Stripe sprint).

-- ── get_portal_payments ───────────────────────────────────────────────────────
--
-- Returns all payment schedules for the session's client, with non-cancelled
-- line items nested. Ordered schedule desc (most recent first), items by sort_order.

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
      from public.payment_schedules ps
      where ps.client_id = v_session.client_id
        and ps.venue_id  = v_session.venue_id
    )
  );
end;
$$;

grant execute on function public.get_portal_payments(text) to anon, authenticated;
