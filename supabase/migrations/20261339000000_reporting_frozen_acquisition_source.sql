-- ============================================================================
-- Phase 2A follow-up — frozen acquisition source for historical Reporting,
-- stronger write-once enforcement, lifecycle event stamp freeze.
--
-- Reporting RPC bodies follow the sales_stage pipeline when that column
-- exists (production / post-20261310). On older local schemas that still
-- use leads.status, the same acquisition_source swap is applied to the
-- status-based definitions so harnesses can prove the freeze contract.
-- ============================================================================

-- ---- Strengthen leads.acquisition_source freeze ------------------------------
-- Once populated, NEVER change — not via leads.source edits, direct UPDATE,
-- or NULL clear. Do not stamp from operational source on later UPDATEs
-- (create-time stamp is the INSERT trigger only).

create or replace function public.leads_acquisition_source_freeze()
returns trigger
language plpgsql
as $$
begin
  if old.acquisition_source is not null then
    new.acquisition_source := old.acquisition_source;
  end if;
  -- If old was null and new provides a value, allow one-time set
  -- (legacy rows / rare repair). Still never copy from mutable source here.
  return new;
end;
$$;

-- ---- Freeze lifecycle_booking_events.acquisition_source after stamp ---------

create or replace function public.lifecycle_booking_acquisition_source_freeze()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.acquisition_source is not null then
    new.acquisition_source := old.acquisition_source;
  end if;
  return new;
end;
$$;

drop trigger if exists lifecycle_booking_acquisition_source_before_update
  on public.lifecycle_booking_events;
create trigger lifecycle_booking_acquisition_source_before_update
  before update on public.lifecycle_booking_events
  for each row execute function public.lifecycle_booking_acquisition_source_freeze();

-- ---- Reporting RPCs: historical source = acquisition_source -----------------

do $rpc$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'sales_stage'
  ) then
    execute $sales_funnel$
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
language sql stable security definer set search_path = public as $fn$
  select
    l.id,
    trim(l.first_name || ' ' || l.last_name),
    -- Column name remains `source` for API compatibility; value is frozen.
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
      select 1 from public.clients c join public.canonical_bookings cb on cb.client_id = c.id
      where c.lead_id = l.id
    )
  from public.leads l
  where l.venue_id = public.current_user_venue_id()
    and l.sales_stage <> 'lost'
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to)
  order by l.created_at desc;
$fn$;
$sales_funnel$;
  else
    execute $status_funnel$
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
language sql stable security definer set search_path = public as $fn$
  select
    l.id,
    trim(l.first_name || ' ' || l.last_name),
    l.acquisition_source,
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
$fn$;
$status_funnel$;
  end if;
end
$rpc$;

grant execute on function public.canonical_conversion_funnel_leads(date, date) to authenticated;

-- get_venue_analytics leadFunnel.bySource — frozen acquisition_source.
-- sales_stage path matches 20261310100000; status path patches local legacy body.

do $analytics$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'sales_stage'
  ) then
    execute $sales_analytics$
create or replace function public.get_venue_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
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
        select l2.sales_stage, l2.acquisition_source as source, l2.created_at,
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
$fn$;
$sales_analytics$;
  else
    -- Local / pre-sales_stage schema: preserve status funnel math; swap source only.
    execute $status_analytics$
create or replace function public.get_venue_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
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
        select l2.status, l2.acquisition_source as source, l2.created_at,
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
              count(*) filter (where status = 'won') as src_booked
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
$fn$;
$status_analytics$;
  end if;
end
$analytics$;

grant execute on function public.get_venue_analytics() to authenticated;

notify pgrst, 'reload schema';

comment on column public.leads.acquisition_source is
  'Write-once acquisition attribution at lead entry. Historical Reporting MUST use this (or lifecycle_booking_events.acquisition_source), never mutable leads.source. Backfill (20261338): one-time copy from then-current source when null and valid FK to lead_sources; null/empty/invalid stay null (Unknown). Explicit other is backfilled when present as FK but does not count as known coverage. Thereafter frozen.';
