-- ============================================================================
-- Work Package R2 — funnel stage drill-down (brief §12: "The drill-down must
-- use the same canonical definition as the displayed number. Do not create
-- a second query that merely approximates the stage.").
--
-- Returns one row per lead in the window with a boolean per stage reached —
-- the exact same join conditions canonical_conversion_funnel() already
-- uses (this migration copies them verbatim, does not reinterpret them).
-- The Reporting UI filters this single result set client-side per stage
-- (`.filter(l => l.reachedTour)` etc.) rather than issuing seven separate
-- queries — same source of truth, guaranteed consistent with the aggregate
-- counts because it is the same underlying row set.
-- ============================================================================

create or replace function public.canonical_conversion_funnel_leads(
  p_from date default null, p_to date default null
)
returns table (
  lead_id uuid,
  lead_name text,
  source text,
  created_at timestamptz,
  status text,
  reached_tour boolean,
  reached_proposal boolean,
  reached_contract_sent boolean,
  reached_contract_signed boolean,
  reached_deposit boolean,
  reached_booked boolean
)
language sql stable security definer set search_path = public as $$
  select
    l.id,
    trim(l.first_name || ' ' || l.last_name),
    l.source,
    l.created_at,
    l.status,
    exists(select 1 from public.tour_appointments t where t.lead_id = l.id),
    l.status in ('proposal_sent', 'won'),
    exists(
      select 1 from public.clients c join public.contracts con on con.client_id = c.id
      where c.lead_id = l.id and con.sent_at is not null
    ),
    exists(
      select 1 from public.clients c join public.contracts con on con.client_id = c.id
      where c.lead_id = l.id and con.signed_at is not null
    ),
    exists(
      select 1 from public.clients c
      join public.payment_schedules ps on ps.client_id = c.id
      join lateral (
        select pli.status from public.payment_line_items pli
        where pli.schedule_id = ps.id
        order by pli.sort_order asc, pli.due_date asc nulls last, pli.created_at asc
        limit 1
      ) dep on true
      where c.lead_id = l.id and dep.status = 'paid'
    ),
    exists(
      select 1 from public.clients c join public.canonical_bookings cb on cb.client_id = c.id
      where c.lead_id = l.id
    )
  from public.leads l
  where l.venue_id = public.current_user_venue_id()
    and l.status <> 'cancelled'
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to)
  order by l.created_at desc;
$$;

grant execute on function public.canonical_conversion_funnel_leads(date, date) to authenticated;

notify pgrst, 'reload schema';
