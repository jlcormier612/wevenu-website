-- Unattributed email intake is not a known marketing source.
-- Reports roll email_parsed_generic into unknown / Not recorded.
-- One audited correction may move that unknown acquisition to a verified
-- marketplace key. Known sources stay frozen. Ordinary source edits do not.

create or replace function public.reporting_acquisition_key(raw text)
returns text
language sql
immutable
as $$
  select case
    when raw is null or btrim(raw) = '' then 'unknown'
    when raw in ('other', 'unknown', 'email_parsed_generic') then 'unknown'
    when raw = 'tour_scheduling' then 'website'
    else raw
  end
$$;

create or replace function public.leads_acquisition_source_freeze()
returns trigger
language plpgsql
as $$
begin
  if old.acquisition_source is not null
     and old.acquisition_source is distinct from 'email_parsed_generic' then
    new.acquisition_source := old.acquisition_source;
  elsif old.acquisition_source = 'email_parsed_generic'
        and (
          current_setting('htc.allow_unknown_acquisition_correction', true) is distinct from '1'
          or new.acquisition_source not in ('the_knot', 'wedding_wire', 'zola', 'here_comes_the_guide')
        ) then
    new.acquisition_source := old.acquisition_source;
  end if;
  return new;
end;
$$;

create or replace function public.lifecycle_booking_acquisition_source_freeze()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and old.acquisition_source is not null
     and old.acquisition_source is distinct from 'email_parsed_generic' then
    new.acquisition_source := old.acquisition_source;
  elsif tg_op = 'UPDATE'
        and old.acquisition_source = 'email_parsed_generic'
        and (
          current_setting('htc.allow_unknown_acquisition_correction', true) is distinct from '1'
          or new.acquisition_source not in ('the_knot', 'wedding_wire', 'zola', 'here_comes_the_guide')
        ) then
    new.acquisition_source := old.acquisition_source;
  end if;
  return new;
end;
$$;

create or replace function public.correct_unknown_lead_acquisition(
  p_lead_id uuid,
  p_marketplace_key text,
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_from text;
  v_bookings_updated int := 0;
  v_bookings_preserved int := 0;
begin
  if p_marketplace_key not in ('the_knot', 'wedding_wire', 'zola', 'here_comes_the_guide') then
    return jsonb_build_object('ok', false, 'error', 'unsupported_source');
  end if;
  if p_evidence is null
     or coalesce(p_evidence->>'trusted', '') is distinct from 'true'
     or coalesce(p_evidence->>'evidence_id', '') = '' then
    return jsonb_build_object('ok', false, 'error', 'untrusted_evidence');
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_from := v_lead.acquisition_source;

  if v_from = p_marketplace_key then
    return jsonb_build_object('ok', true, 'idempotent', true, 'acquisition_source', v_from);
  end if;

  if v_from is not null and v_from is distinct from 'email_parsed_generic' then
    return jsonb_build_object('ok', false, 'error', 'known_source_preserved', 'acquisition_source', v_from);
  end if;

  if v_lead.source is not null
     and v_lead.source not in ('email_parsed_generic', p_marketplace_key) then
    return jsonb_build_object('ok', false, 'error', 'operational_source_conflict', 'source', v_lead.source);
  end if;

  perform set_config('htc.allow_unknown_acquisition_correction', '1', true);

  update public.leads
  set acquisition_source = p_marketplace_key,
      source = p_marketplace_key,
      source_data = coalesce(source_data, '{}'::jsonb) || jsonb_build_object(
        'acquisition_correction', jsonb_build_object(
          'from', coalesce(v_from, 'email_parsed_generic'),
          'to', p_marketplace_key,
          'at', now(),
          'evidence', p_evidence
        )
      )
  where id = p_lead_id;

  update public.lifecycle_booking_events
  set acquisition_source = p_marketplace_key
  where lead_id = p_lead_id
    and (acquisition_source is null or acquisition_source = 'email_parsed_generic');
  get diagnostics v_bookings_updated = row_count;

  select count(*) into v_bookings_preserved
  from public.lifecycle_booking_events
  where lead_id = p_lead_id
    and acquisition_source is not null
    and acquisition_source is distinct from p_marketplace_key
    and acquisition_source is distinct from 'email_parsed_generic';

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'previous', v_from,
    'acquisition_source', p_marketplace_key,
    'bookings_updated', v_bookings_updated,
    'bookings_preserved', v_bookings_preserved
  );
end;
$$;

revoke all on function public.correct_unknown_lead_acquisition(uuid, text, jsonb) from public;
revoke all on function public.correct_unknown_lead_acquisition(uuid, text, jsonb) from anon;
revoke all on function public.correct_unknown_lead_acquisition(uuid, text, jsonb) from authenticated;
grant execute on function public.correct_unknown_lead_acquisition(uuid, text, jsonb) to service_role;

comment on function public.correct_unknown_lead_acquisition(uuid, text, jsonb) is
  'One transition from unknown or email_parsed_generic acquisition to a verified marketplace key. Requires trusted evidence. Does not overwrite a known source. Service role only.';

create or replace function public.get_venue_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_venue_id uuid;
begin
  v_venue_id := public.current_user_venue_id();
  if v_venue_id is null then return jsonb_build_object('error', 'not_found'); end if;

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
              public.reporting_acquisition_key(source) as source,
              count(*) as src_total,
              count(*) filter (where sales_stage = 'booked') as src_booked
            from l
            group by 1
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
