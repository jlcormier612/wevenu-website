-- ============================================================================
-- Remap reporting RPCs from leads.status → leads.sales_stage.
-- Preserves return shapes from 20261257000000.
-- Depends on 20261309000000_authoritative_sales_pipeline.sql.
-- Written only — not applied in this pass.
-- ============================================================================

create or replace function public.canonical_conversion_funnel(
  p_from date default null, p_to date default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_inquiry int; v_toured int; v_proposal int;
  v_contract_sent int; v_contract_signed int; v_deposit_received int; v_booked int;
begin
  select count(*) into v_inquiry
  from public.leads
  where venue_id = v_venue_id
    and (p_from is null or created_at::date >= p_from)
    and (p_to   is null or created_at::date <= p_to);

  select count(distinct l.id) into v_toured
  from public.leads l
  join public.tour_appointments t on t.lead_id = l.id
  where l.venue_id = v_venue_id
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to);

  select count(*) into v_proposal
  from public.leads
  where venue_id = v_venue_id and sales_stage in ('proposal_sent', 'booked')
    and (p_from is null or created_at::date >= p_from)
    and (p_to   is null or created_at::date <= p_to);

  select count(distinct l.id) into v_contract_sent
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.contracts con on con.client_id = c.id
  where l.venue_id = v_venue_id and con.sent_at is not null
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to);

  select count(distinct l.id) into v_contract_signed
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.contracts con on con.client_id = c.id
  where l.venue_id = v_venue_id and con.signed_at is not null
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to);

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
  where l.venue_id = v_venue_id and dep.status = 'paid'
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to);

  select count(distinct l.id) into v_booked
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.canonical_bookings cb on cb.client_id = c.id
  where l.venue_id = v_venue_id
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to);

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
    'bookingConversionRate', case when v_inquiry>0 then round(100.0*v_booked/v_inquiry) else 0 end
  );
end;
$$;

grant execute on function public.canonical_conversion_funnel(date, date) to authenticated;

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

    'leadFunnel', (
      with l as (
        select l2.sales_stage, l2.source, l2.created_at,
               (ta.lead_id is not null) as has_tour
        from public.leads l2
        left join lateral (
          select 1 as lead_id from public.tour_appointments t where t.lead_id = l2.id limit 1
        ) ta on true
        where l2.venue_id = v_venue_id
                )
      select jsonb_build_object(
        'total',        count(*),
        'contacted',    count(*) filter (where sales_stage in ('outreach_sent','enrolled_in_sequence','tour_scheduled','proposal_sent','booked')),
        'toured',       count(*) filter (where sales_stage in ('tour_scheduled','proposal_sent','booked') or has_tour),
        'proposal',     count(*) filter (where sales_stage in ('proposal_sent','booked')),
        'booked',       count(*) filter (where sales_stage = 'booked'),
        'lost',         count(*) filter (where sales_stage = 'lost'),
        'conversionRate', case
                          when count(*) filter (where sales_stage is distinct from 'lost') > 0
                          then round(100.0 * count(*) filter (where sales_stage = 'booked')
                               / nullif(count(*) filter (where sales_stage is distinct from 'lost'), 0))
                          else 0 end,
        'bookingConversionRate', (public.canonical_conversion_funnel(null, null) ->> 'bookingConversionRate')::int,
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
              count(*) filter (where sales_stage = 'booked') as src_booked
            from l
            group by source
          ) s
        )
      )
      from l
    ),

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
        'seatingStarted',    (select count(distinct cg.client_id) from public.guest_seat_assignments gsa join public.couple_guests cg on cg.id = gsa.guest_id join active_events ae on ae.client_id = cg.client_id),
        'vendorsLinked',     (select count(distinct eva.event_id)  from public.event_vendor_assignments eva     join active_events ae on ae.event_id = eva.event_id  where eva.venue_id = v_venue_id),
        'documentsUploaded', (select count(distinct d.client_id)   from public.documents d              join active_events ae on ae.client_id = d.client_id         where d.venue_id = v_venue_id),
        'playbooksActive',   (select count(distinct et.event_id)   from public.event_tasks et           join active_events ae on ae.event_id = et.event_id          where et.venue_id = v_venue_id),
        'guestsAdded',       (select count(distinct cg.client_id)  from public.couple_guests cg        join active_events ae on ae.client_id = cg.client_id         where cg.venue_id = v_venue_id)
      )
      from n
    ),

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

notify pgrst, 'reload schema';
