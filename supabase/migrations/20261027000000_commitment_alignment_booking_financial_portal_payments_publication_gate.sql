-- ============================================================================
-- Commitment Alignment Sprint, Item 4 (Booking Financial) — Part A
-- docs/commitment-lifecycle-architecture.md §6: the Publication axis is
-- "internal workspace visibility -> operational submission -> audience
-- publication", three independent layers. get_portal_payments never
-- enforced the third layer at all: a Draft Invoice's payment schedule and
-- its terms were visible to the couple (the Published Audience) before the
-- venue ever sent it. Gate on the linked Invoice's status — a schedule
-- with no linked invoice at all isn't held back by anything and stays
-- visible, matching today's behavior for that case.
-- ============================================================================

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
      from public.payment_schedules ps
      left join public.invoices inv on inv.id = ps.invoice_id
      where ps.client_id = v_session.client_id
        and ps.venue_id  = v_session.venue_id
        and (ps.invoice_id is null or inv.status != 'draft')
    )
  );
end;
$$;
