-- Booked membership is events.booked_at, not the financial canonical_bookings view.
-- Sales-stage "booked" means that same transition. Pre-booking shells stay unbooked.

-- Pipeline column label: "Booking Started" was the old non-booked meaning.
update public.pipeline_stages
set name = 'Booked'
where canonical_stage = 'booked'
  and name ilike 'booking started';

-- Leads in sales_stage booked without a booked event were booking-file shells.
update public.leads l
set
  sales_stage = 'proposal_sent',
  pipeline_stage_id = coalesce((
    select ps.id
    from public.pipeline_stages ps
    join public.pipeline_templates pt on pt.id = ps.pipeline_template_id
    where ps.venue_id = l.venue_id
      and pt.is_active = true
      and ps.canonical_stage = 'proposal'
    order by ps.sort_order asc
    limit 1
  ), l.pipeline_stage_id)
where l.sales_stage = 'booked'
  and not exists (
    select 1
    from public.clients c
    join public.events e on e.client_id = c.id
    where c.lead_id = l.id
      and e.booked_at is not null
  );

-- Leads whose event is booked belong on the booked stage, unless lost.
update public.leads l
set
  sales_stage = 'booked',
  pipeline_stage_id = coalesce((
    select ps.id
    from public.pipeline_stages ps
    join public.pipeline_templates pt on pt.id = ps.pipeline_template_id
    where ps.venue_id = l.venue_id
      and pt.is_active = true
      and ps.canonical_stage = 'booked'
    order by ps.sort_order asc
    limit 1
  ), l.pipeline_stage_id)
where l.sales_stage is distinct from 'booked'
  and l.sales_stage is distinct from 'lost'
  and exists (
    select 1
    from public.clients c
    join public.events e on e.client_id = c.id
    where c.lead_id = l.id
      and e.booked_at is not null
      and e.status <> 'cancelled'
  );

update public.clients c
set status = 'confirmed'
where c.status in ('booking', 'planning', 'complete')
  and exists (
    select 1 from public.events e
    where e.client_id = c.id
      and e.booked_at is not null
      and e.status <> 'cancelled'
  );

create or replace function public.canonical_gross_booked_revenue(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(i.subtotal - i.discount_amount), 0)
  from public.invoices i
  join (
    select distinct on (e.client_id) e.client_id, e.venue_id, e.booked_at
    from public.events e
    where e.booked_at is not null
      and e.status <> 'cancelled'
      and e.client_id is not null
    order by e.client_id, e.booked_at asc
  ) eb on eb.client_id = i.client_id and eb.venue_id = i.venue_id
  join public.clients c on c.id = i.client_id
  where i.venue_id = public.current_user_venue_id()
    and i.status <> 'void'
    and c.exclude_from_business_reporting = false
    and (p_from is null or eb.booked_at::date >= p_from)
    and (p_to   is null or eb.booked_at::date <= p_to);
$$;

create or replace function public.canonical_average_booking_value(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  select case when count(*) > 0
    then public.canonical_gross_booked_revenue(p_from, p_to) / count(*)
    else 0 end
  from (
    select distinct on (e.client_id) e.client_id
    from public.events e
    join public.clients c on c.id = e.client_id
    where e.venue_id = public.current_user_venue_id()
      and e.booked_at is not null
      and e.status <> 'cancelled'
      and e.client_id is not null
      and c.exclude_from_business_reporting = false
      and (p_from is null or e.booked_at::date >= p_from)
      and (p_to   is null or e.booked_at::date <= p_to)
    order by e.client_id, e.booked_at asc
  ) eb;
$$;

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
    and exclude_from_business_reporting = false
    and (p_from is null or created_at::date >= p_from)
    and (p_to   is null or created_at::date <= p_to);

  select count(distinct l.id) into v_toured
  from public.leads l
  join public.tour_appointments t on t.lead_id = l.id
  where l.venue_id = v_venue_id
    and l.exclude_from_business_reporting = false
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to);

  select count(*) into v_proposal
  from public.leads
  where venue_id = v_venue_id and sales_stage in ('proposal_sent', 'booked')
    and exclude_from_business_reporting = false
    and (p_from is null or created_at::date >= p_from)
    and (p_to   is null or created_at::date <= p_to);

  select count(distinct l.id) into v_contract_sent
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.contracts con on con.client_id = c.id
  where l.venue_id = v_venue_id and con.sent_at is not null
    and l.exclude_from_business_reporting = false
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to);

  select count(distinct l.id) into v_contract_signed
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.contracts con on con.client_id = c.id
  where l.venue_id = v_venue_id and con.signed_at is not null
    and l.exclude_from_business_reporting = false
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
    and l.exclude_from_business_reporting = false
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to);

  select count(distinct l.id) into v_booked
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.events e on e.client_id = c.id
    and e.booked_at is not null
    and e.status <> 'cancelled'
  where l.venue_id = v_venue_id
    and l.exclude_from_business_reporting = false
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
      'contractSentToSigned', case when v_contract_sent>0 then round(100.0*v_contract_signed/v_contract_sent) else 0 end,
      'contractSignedToDeposit', case when v_contract_signed>0 then round(100.0*v_deposit_received/v_contract_signed) else 0 end,
      'depositToBooking',       case when v_deposit_received>0 then round(100.0*v_booked/v_deposit_received) else 0 end
    ),
    'bookingConversionRate', case when v_inquiry>0 then round(100.0*v_booked/v_inquiry) else 0 end
  );
end;
$$;

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
    l.acquisition_source,
    l.created_at,
    l.sales_stage,
    exists(select 1 from public.tour_appointments t where t.lead_id = l.id),
    l.sales_stage in ('proposal_sent', 'booked'),
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
      select 1 from public.clients c
      join public.events e on e.client_id = c.id
      where c.lead_id = l.id
        and e.booked_at is not null
        and e.status <> 'cancelled'
    )
  from public.leads l
  where l.venue_id = public.current_user_venue_id()
    and l.exclude_from_business_reporting = false
    and l.sales_stage <> 'lost'
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to)
  order by l.created_at desc;
$$;
