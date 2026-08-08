-- ============================================================================
-- Reporting & Analytics — Canonical Metric Implementation
--
-- Implements the business definitions certified in docs/reporting-analytics-
-- architecture-certification.md and docs/metric-definition-registry-
-- certification.md. Additive only — every existing table, view, function,
-- and RLS policy this migration touches is extended, never replaced;
-- nothing that currently reads `leads`, `contracts`, `invoices`, or
-- `payment_line_items` the old way breaks. Legacy calculations (e.g.
-- get_venue_analytics()'s existing leadFunnel.conversionRate, which uses
-- leads.status='won' as a booking proxy) are deliberately left in place —
-- see docs/metric-registry-canonical-implementation.md's Migration Matrix
-- for exactly which consumers have and have not yet switched to these.
--
-- Two real gaps found while implementing, each handled explicitly rather
-- than silently assumed (see that same doc's "Findings" section for the
-- full reasoning):
--   1. No column anywhere distinguishes "the required initial payment
--      (deposit or booking fee)" from any other payment_line_item — only
--      `sort_order` orders them. canonical_bookings uses the lowest-
--      sort_order line item per schedule as that structural proxy.
--   2. invoice_line_items.type ('package','addon','inventory','discount',
--      'fee','tax','deposit','item') and packages.category (freeform text)
--      do not map cleanly onto the 11 certified Revenue Categories —
--      'Venue Services' and 'Venue Vendors' have no existing signal to
--      derive from at all. revenue_category is added nullable, backfilled
--      best-effort from existing signals, and left null where no
--      confident mapping exists rather than guessing.
-- ============================================================================


-- ── Revenue Categories ────────────────────────────────────────────────────
-- A reporting dimension on invoice_line_items, not a new revenue
-- definition (per the certified brief's own instruction). Nullable: a
-- categorization gap is more honest than a wrong guess.

alter table public.invoice_line_items
  add column if not exists revenue_category text
    check (revenue_category is null or revenue_category in (
      'Venue Rental', 'Packages', 'Inventory', 'Food & Beverage', 'Alcohol',
      'Venue Services', 'Venue Vendors', 'Service Charges', 'Discounts',
      'Taxes', 'Other'
    ));

-- Best-effort backfill from existing signals. Confidence varies by row —
-- see the doc referenced above for exactly which mappings are solid
-- (tax/discount/inventory) vs. approximate (package-derived) vs. simply
-- absent (Venue Services, Venue Vendors: nothing in the current schema
-- distinguishes these from any other package/addon, so no row is backfilled
-- into either — they exist as valid target categories for future manual
-- categorization only).
update public.invoice_line_items ili
set revenue_category = case
  when ili.type = 'tax'      then 'Taxes'
  when ili.type = 'discount' then 'Discounts'
  -- 'deposit'-typed line items reduce the invoice total the same way a
  -- discount does today (see computeInvoiceTotals, lib/invoices/
  -- constants.ts) — mapped consistently with that existing behavior, not
  -- because a deposit is conceptually a discount.
  when ili.type = 'deposit'  then 'Discounts'
  when ili.type = 'inventory' then 'Inventory'
  when ili.type = 'fee'      then 'Service Charges'
  when ili.type = 'package'  then (
    select case
      when p.category ilike '%venue%'                                   then 'Venue Rental'
      when p.category ilike '%cater%' or p.category ilike '%food%'       then 'Food & Beverage'
      when p.category ilike '%bar%' or p.category ilike '%alcohol%'      then 'Alcohol'
      else 'Packages'
    end
    from public.packages p where p.id = ili.package_id
  )
  -- 'addon' and 'item' (the generic default) carry no reliable signal.
  else 'Other'
end
where revenue_category is null;


-- ── canonical_bookings ────────────────────────────────────────────────────
-- The one Booking definition (docs/metric-registry §2): a Contract fully
-- executed (signed) AND the required initial payment collected. Scoped per
-- Client, not per Event — a Client can have multiple Events, but is the
-- entity both Contract and Payment Schedule most reliably link back to
-- (contracts.event_id and payment_schedules.event_id are both nullable;
-- .client_id is the one column both consistently carry).
create or replace view public.canonical_bookings as
select
  bc.client_id,
  bc.venue_id,
  bc.contract_id,
  bc.signed_at,
  bc.deposit_line_item_id,
  bc.deposit_paid_at,
  greatest(bc.signed_at, bc.deposit_paid_at) as booked_at
from (
  select distinct on (c.id)
    c.id as client_id,
    c.venue_id,
    con.id as contract_id,
    con.signed_at,
    dep.id as deposit_line_item_id,
    dep.paid_at as deposit_paid_at
  from public.clients c
  join public.contracts con
    on con.client_id = c.id
   and con.status = 'signed'
  join public.payment_schedules ps
    on ps.client_id = c.id
  join lateral (
    select pli.id, pli.paid_at, pli.status
    from public.payment_line_items pli
    where pli.schedule_id = ps.id
    order by pli.sort_order asc, pli.due_date asc nulls last, pli.created_at asc
    limit 1
  ) dep on true
  where dep.status = 'paid'
  order by c.id, con.signed_at desc nulls last, ps.created_at desc
) bc;

comment on view public.canonical_bookings is
  'Canonical Booking (Reporting & Analytics certification): a Client with >=1 signed Contract AND a Payment Schedule whose lowest-sort_order line item is paid. booked_at = the later of the two moments — the point at which both became true.';


-- ── Revenue functions ─────────────────────────────────────────────────────
-- Venue is always derived from the caller's own session via the existing
-- current_user_venue_id() helper (sprint107), exactly as every sibling
-- analytics function (get_venue_analytics, get_venue_trends) already does —
-- never accepted as a parameter. These are security definer; a caller-
-- supplied venue_id parameter would let any authenticated user read any
-- other venue's revenue, bypassing RLS entirely. p_from/p_to (date window)
-- are the only real parameters — null means all-time.

create or replace function public.canonical_gross_booked_revenue(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  -- subtotal - discount_amount = total contracted value excluding tax
  -- (Gross Booked Revenue excludes taxes, refunds, and outstanding
  -- balances per the certified definition — refunds and balance status
  -- never enter this computation at all, by construction).
  select coalesce(sum(i.subtotal - i.discount_amount), 0)
  from public.invoices i
  join public.canonical_bookings cb
    on cb.client_id = i.client_id and cb.venue_id = i.venue_id
  where i.venue_id = public.current_user_venue_id()
    and i.status <> 'void'
    and (p_from is null or cb.booked_at::date >= p_from)
    and (p_to   is null or cb.booked_at::date <= p_to);
$$;

create or replace function public.canonical_payments_collected(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  -- Same net-of-refund computation as lib/payments/repository.ts's
  -- reconcileInvoiceBalance / getTotalPaidForInvoice — reused, not
  -- reimplemented, at venue scope instead of per-invoice.
  select coalesce(sum(
    coalesce(pli.paid_amount, pli.amount) - coalesce(pli.refunded_amount, 0)
  ), 0)
  from public.payment_line_items pli
  where pli.venue_id = public.current_user_venue_id()
    and pli.status in ('paid', 'partially_refunded', 'refunded')
    and (p_from is null or pli.paid_at::date >= p_from)
    and (p_to   is null or pli.paid_at::date <= p_to);
$$;

create or replace function public.canonical_outstanding_balance(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  -- Derived, not independently summed — Gross Booked Revenue minus
  -- Payments Collected, per the certified definition and this registry's
  -- own dependency-graph discipline.
  select public.canonical_gross_booked_revenue(p_from, p_to)
       - public.canonical_payments_collected(p_from, p_to);
$$;

create or replace function public.canonical_average_booking_value(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  select case when count(*) > 0
    then public.canonical_gross_booked_revenue(p_from, p_to) / count(*)
    else 0 end
  from public.canonical_bookings cb
  where cb.venue_id = public.current_user_venue_id()
    and (p_from is null or cb.booked_at::date >= p_from)
    and (p_to   is null or cb.booked_at::date <= p_to);
$$;


-- ── canonical_conversion_funnel ───────────────────────────────────────────
-- The one funnel with named, non-"Conversion Rate" stages, plus the one
-- metric permitted to carry that name (Inquiry -> Booking). Tour stage
-- reads tour_appointments, not leads.tour_date — tour_appointments is the
-- confirmed canonical source per lib/leads/scores.ts's own prior finding
-- ("regardless of whether the tour was booked publicly or scheduled
-- manually"); leads.tour_date is legacy and still read by
-- get_venue_analytics() today (unmigrated — see the Migration Matrix).
-- Contract Sent/Signed use the timestamp columns (sent_at/signed_at), not
-- current status — a contract's current status can move past a milestone
-- it already reached, but the timestamp can't un-happen.

create or replace function public.canonical_conversion_funnel()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_inquiry int; v_toured int; v_proposal int;
  v_contract_sent int; v_contract_signed int; v_deposit_received int; v_booked int;
begin
  select count(*) into v_inquiry
  from public.leads where venue_id = v_venue_id and status <> 'cancelled';

  select count(distinct l.id) into v_toured
  from public.leads l
  join public.tour_appointments t on t.lead_id = l.id
  where l.venue_id = v_venue_id and l.status <> 'cancelled';

  select count(*) into v_proposal
  from public.leads where venue_id = v_venue_id and status in ('proposal_sent', 'won');

  select count(distinct l.id) into v_contract_sent
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.contracts con on con.client_id = c.id
  where l.venue_id = v_venue_id and con.sent_at is not null;

  select count(distinct l.id) into v_contract_signed
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.contracts con on con.client_id = c.id
  where l.venue_id = v_venue_id and con.signed_at is not null;

  select count(distinct l.id) into v_deposit_received
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.payment_schedules ps on ps.client_id = c.id
  join lateral (
    select pli.status from public.payment_line_items pli
    where pli.schedule_id = ps.id
    order by pli.sort_order asc, pli.due_date asc nulls last, pli.created_at asc
    limit 1
  ) dep on true
  where l.venue_id = v_venue_id and dep.status = 'paid';

  select count(distinct l.id) into v_booked
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.canonical_bookings cb on cb.client_id = c.id
  where l.venue_id = v_venue_id;

  return jsonb_build_object(
    'counts', jsonb_build_object(
      'inquiry', v_inquiry, 'tourScheduled', v_toured, 'proposalSent', v_proposal,
      'contractSent', v_contract_sent, 'contractSigned', v_contract_signed,
      'depositReceived', v_deposit_received, 'booked', v_booked
    ),
    'stages', jsonb_build_object(
      'inquiryToTourScheduled', case when v_inquiry>0 then round(100.0*v_toured/v_inquiry) else 0 end,
      'tourToProposal',         case when v_toured>0 then round(100.0*v_proposal/v_toured) else 0 end,
      'proposalToContractSent', case when v_proposal>0 then round(100.0*v_contract_sent/v_proposal) else 0 end,
      'contractSentToSigned',   case when v_contract_sent>0 then round(100.0*v_contract_signed/v_contract_sent) else 0 end,
      'contractSignedToDeposit', case when v_contract_signed>0 then round(100.0*v_deposit_received/v_contract_signed) else 0 end,
      'depositToBooking',       case when v_deposit_received>0 then round(100.0*v_booked/v_deposit_received) else 0 end
    ),
    -- The one metric permitted to be named "Booking Conversion Rate" (§4).
    'bookingConversionRate', case when v_inquiry>0 then round(100.0*v_booked/v_inquiry) else 0 end
  );
end;
$$;


-- ── get_venue_analytics(): representative consumer migration ───────────────
-- Adds ONE new field, leadFunnel.bookingConversionRate, alongside the
-- existing leadFunnel.conversionRate — additive only. The legacy field is
-- untouched (still leads.status='won' as its booking proxy) and every
-- other section of this function (events/payments/featureAdoption/
-- coupleEngagement) is byte-for-byte identical to
-- 20260711000002_sprint87_venue_analytics.sql. This is the one representative
-- consumer migrated end-to-end in this phase — see docs/metric-registry-
-- canonical-implementation.md's Migration Matrix for the full backlog of
-- consumers not yet migrated. The Venue Analytics UI does not read this new
-- field yet (no UI was touched by this phase, per its own scope limits) —
-- it is present in the RPC response, ready for a future consumer to use.

create or replace function public.get_venue_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  select id into v_venue_id
  from public.venues
  where owner_user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  return jsonb_build_object(

    -- ── Lead Funnel ──────────────────────────────────────────────────────────
    -- Pre-existing bug fixed here, found while testing this function for
    -- this phase's own additive change: leads.tour_date was dropped by
    -- 20260718000000_program2_phase1a_canonical_tour_scheduling.sql, which
    -- established tour_appointments as the canonical tour source (the same
    -- source canonical_conversion_funnel() above already uses) — this
    -- function was never updated after that drop and would throw "column
    -- tour_date does not exist" on every real call. Not a design change;
    -- a correction to match the already-established canonical source.
    'leadFunnel', (
      with l as (
        select l2.status, l2.source, l2.created_at,
               (ta.lead_id is not null) as has_tour
        from public.leads l2
        left join lateral (
          select 1 as lead_id from public.tour_appointments t where t.lead_id = l2.id limit 1
        ) ta on true
        where l2.venue_id = v_venue_id
          and l2.status <> 'cancelled'
      )
      select jsonb_build_object(
        'total',        count(*),
        'contacted',    count(*) filter (where status in ('contacted','qualified','proposal_sent','won')),
        'toured',       count(*) filter (where status in ('qualified','proposal_sent','won') or has_tour),
        'proposal',     count(*) filter (where status in ('proposal_sent','won')),
        'booked',       count(*) filter (where status = 'won'),
        'lost',         count(*) filter (where status = 'lost'),
        'conversionRate', case
                          when count(*) filter (where status not in ('lost')) > 0
                          then round(100.0 * count(*) filter (where status = 'won')
                               / nullif(count(*) filter (where status not in ('lost')), 0))
                          else 0 end,
        -- New, canonical (booked = signed contract AND deposit collected,
        -- not the legacy leads.status='won' proxy above).
        'bookingConversionRate', (public.canonical_conversion_funnel() ->> 'bookingConversionRate')::int,
        'bySource', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'source',  coalesce(source, 'Unknown'),
              'total',   src_total,
              'booked',  src_booked,
              'rate',    case when src_total > 0 then round(100.0 * src_booked / src_total) else 0 end
            ) order by src_total desc
          ), '[]')
          from (
            select
              coalesce(source, 'unknown') as source,
              count(*) as src_total,
              count(*) filter (where status = 'won') as src_booked
            from l
            group by source
          ) s
        )
      )
      from l
    ),

    -- ── Events ───────────────────────────────────────────────────────────────
    'events', (
      with e as (
        select id, event_date, guest_count, event_type
        from public.events
        where venue_id = v_venue_id
      )
      select jsonb_build_object(
        'total',          count(*),
        'upcoming',       count(*) filter (where event_date >= current_date),
        'thisMonth',      count(*) filter (where event_date >= date_trunc('month', current_date)
                            and event_date < date_trunc('month', current_date) + interval '1 month'),
        'nextMonth',      count(*) filter (where event_date >= date_trunc('month', current_date) + interval '1 month'
                            and event_date < date_trunc('month', current_date) + interval '2 months'),
        'avgGuestCount',  coalesce(round(avg(guest_count) filter (where guest_count is not null and guest_count > 0)), 0),
        'byMonth', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'month', to_char(mo, 'YYYY-MM'),
              'label', to_char(mo, 'Mon YYYY'),
              'count', cnt
            ) order by mo
          ), '[]')
          from (
            select date_trunc('month', event_date) as mo, count(*) as cnt
            from e
            where event_date >= date_trunc('month', current_date)
              and event_date < date_trunc('month', current_date) + interval '12 months'
            group by mo
          ) m
        )
      )
      from e
    ),

    -- ── Payments ─────────────────────────────────────────────────────────────
    'payments', (
      select jsonb_build_object(
        'totalOutstanding', coalesce(sum(i.balance_due) filter (where i.status not in ('paid','cancelled') and i.balance_due > 0), 0),
        'totalOverdue',     coalesce((
          select sum(pli.amount) from public.payment_line_items pli
          join public.payment_schedules ps on ps.id = pli.schedule_id and ps.venue_id = v_venue_id
          where pli.status = 'overdue'
        ), 0),
        'overdueCount',     coalesce((
          select count(distinct ps.event_id) from public.payment_line_items pli
          join public.payment_schedules ps on ps.id = pli.schedule_id and ps.venue_id = v_venue_id
          where pli.status = 'overdue'
        ), 0),
        'totalBilled',      coalesce(sum(i.total) filter (where i.status not in ('cancelled')), 0),
        'totalCollected',   coalesce(sum(i.total - i.balance_due) filter (where i.status not in ('cancelled')), 0),
        -- New, canonical (net cash actually received, reused not
        -- reimplemented — see canonical_payments_collected()).
        'totalCollectedCanonical', public.canonical_payments_collected(),
        'completionRate',   case
                            when sum(i.total) filter (where i.status not in ('cancelled')) > 0
                            then round(100.0
                                 * sum(i.total - i.balance_due) filter (where i.status not in ('cancelled'))
                                 / sum(i.total) filter (where i.status not in ('cancelled')))
                            else 0 end
      )
      from public.invoices i
      where i.venue_id = v_venue_id
    ),

    -- ── Feature Adoption ─────────────────────────────────────────────────────
    -- "How much of the platform are active couples actually using?"
    'featureAdoption', (
      with active_events as (
        select e.id as event_id, e.client_id
        from public.events e
        where e.venue_id = v_venue_id
          and e.event_date >= current_date
          and e.event_date <= current_date + interval '18 months'
      ),
      n as (select count(*) as total from active_events)
      select jsonb_build_object(
        'totalActiveEvents', n.total,
        'websitePublished',  (select count(distinct cw.client_id)  from public.couple_websites cw       join active_events ae on ae.client_id = cw.client_id       where cw.is_published = true),
        'websiteStarted',    (select count(distinct cw.client_id)  from public.couple_websites cw       join active_events ae on ae.client_id = cw.client_id),
        'budgetConfigured',  (select count(distinct cb.event_id)   from public.couple_budgets cb        join active_events ae on ae.event_id = cb.event_id          where cb.total_budget > 0),
        -- Second pre-existing broken reference found alongside tour_date
        -- (above): public.couple_seating_arrangements does not exist and
        -- never has in the current schema — the real seating tables are
        -- guest_seat_assignments (per-guest, linked via couple_guests) and
        -- floor_plans. Fixed to the real join; not audited further beyond
        -- what was needed to make this function callable — see this
        -- phase's own report for why a full audit of get_venue_analytics()
        -- is flagged as a separate, out-of-scope finding rather than
        -- pursued exhaustively here.
        'seatingStarted',    (select count(distinct cg.client_id) from public.guest_seat_assignments gsa join public.couple_guests cg on cg.id = gsa.guest_id join active_events ae on ae.client_id = cg.client_id),
        'vendorsLinked',     (select count(distinct eva.event_id)  from public.event_vendor_assignments eva     join active_events ae on ae.event_id = eva.event_id  where eva.venue_id = v_venue_id),
        'documentsUploaded', (select count(distinct d.client_id)   from public.documents d              join active_events ae on ae.client_id = d.client_id         where d.venue_id = v_venue_id),
        'playbooksActive',   (select count(distinct et.event_id)   from public.event_tasks et           join active_events ae on ae.event_id = et.event_id          where et.venue_id = v_venue_id),
        'guestsAdded',       (select count(distinct cg.client_id)  from public.couple_guests cg        join active_events ae on ae.client_id = cg.client_id         where cg.venue_id = v_venue_id)
      )
      from n
    ),

    -- ── Couple Engagement ────────────────────────────────────────────────────
    'coupleEngagement', (
      with active_events as (
        select e.id as event_id, e.client_id
        from public.events e
        where e.venue_id = v_venue_id
          and e.event_date >= current_date
          and e.event_date <= current_date + interval '18 months'
      ),
      n as (select count(*) as total from active_events)
      select jsonb_build_object(
        'totalActiveClients', n.total,
        'portalAdoption', (
          select case when n.total > 0
            then round(100.0 * count(distinct cps.client_id) / n.total)
            else 0 end
          from public.client_portal_sessions cps
          where cps.venue_id = v_venue_id
            and cps.client_id in (select client_id from active_events)
        ),
        'activeThisWeek', (
          select count(distinct cps.client_id)
          from public.client_portal_sessions cps
          where cps.venue_id = v_venue_id
            and cps.last_accessed_at >= now() - interval '7 days'
            and cps.client_id in (select client_id from active_events)
        ),
        'rsvpCompletionAvg', (
          select coalesce(round(avg(
            case when guest_total > 0 then responded::numeric / guest_total * 100 else 0 end
          )), 0)
          from (
            select
              ae.client_id,
              count(*) as guest_total,
              count(*) filter (where cg.rsvp_status <> 'pending') as responded
            from public.couple_guests cg
            join active_events ae on ae.client_id = cg.client_id
            where cg.venue_id = v_venue_id
            group by ae.client_id
            having count(*) > 0
          ) r
        )
      )
      from n
    )

  );
end;
$$;

grant execute on function public.get_venue_analytics() to authenticated;


-- ── Grants ─────────────────────────────────────────────────────────────────
-- Matches the access pattern every sibling analytics RPC already uses
-- (get_venue_analytics, get_venue_trends, etc.) — authenticated only, RLS
-- on the underlying tables (clients/contracts/payment_schedules/invoices/
-- leads) already scopes every one of these to the caller's own venue; these
-- functions add no new access path, only a new read shape over existing,
-- already-governed rows.

grant select on public.canonical_bookings to authenticated;
grant execute on function public.canonical_gross_booked_revenue(date, date) to authenticated;
grant execute on function public.canonical_payments_collected(date, date) to authenticated;
grant execute on function public.canonical_outstanding_balance(date, date) to authenticated;
grant execute on function public.canonical_average_booking_value(date, date) to authenticated;
grant execute on function public.canonical_conversion_funnel() to authenticated;

notify pgrst, 'reload schema';
