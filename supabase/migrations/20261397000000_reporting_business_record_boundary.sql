-- ============================================================================
-- Customer-facing Reporting boundary.
--
-- Internal verification / E2E / release-readiness records stay in the CRM
-- so automated tests keep working. They are classified once (column +
-- trigger) and excluded from business reporting queries and dashboard
-- snapshot metrics. This is not a UI name filter.
--
-- Classifier lives here and in lib/reporting/internal-verification.ts —
-- keep the two in sync. Do not match ordinary customer names.
-- ============================================================================

alter table public.leads
  add column if not exists exclude_from_business_reporting boolean not null default false;

alter table public.clients
  add column if not exists exclude_from_business_reporting boolean not null default false;

alter table public.events
  add column if not exists exclude_from_business_reporting boolean not null default false;

comment on column public.leads.exclude_from_business_reporting is
  'True when this lead is an internal verification/E2E fixture. Hidden from customer-facing Reporting; remains in CRM.';
comment on column public.clients.exclude_from_business_reporting is
  'True when this client is an internal verification/E2E fixture. Hidden from customer-facing Reporting; remains in CRM.';
comment on column public.events.exclude_from_business_reporting is
  'True when this event is an internal verification/E2E fixture. Hidden from customer-facing Reporting; remains in CRM.';

create or replace function public.is_internal_verification_identity(
  p_first text,
  p_last text,
  p_partner_first text,
  p_partner_last text,
  p_email text,
  p_partner_email text,
  p_extra text default null
) returns boolean
language plpgsql
immutable
as $$
declare
  v_email text;
  v_blob text;
  v_compact text;
begin
  foreach v_email in array array[
    lower(trim(coalesce(p_email, ''))),
    lower(trim(coalesce(p_partner_email, '')))
  ]
  loop
    if v_email = '' then continue; end if;
    if v_email like '%@example.com'
      or v_email like '%zz-cleanup%'
      or v_email like '%zz-relprobe%'
      or v_email like '%zz-fin-probe%'
      or v_email like 'patha.%'
      or v_email like 'pathb.%'
      or v_email like '%phase7.%'
      or v_email like '%commercial-spine%'
      or v_email like '%e2etest%'
      or v_email like '%e2eclient%'
      or v_email like '%e2efullclient%'
      or v_email like '%e2enoemail%'
      or v_email like '%closeout.e2e%'
      or v_email like '%live.offer%'
      or v_email like '%live.contract%'
      or v_email like '%htc.invoice.smoke%'
      or v_email like '%portal-e2e%'
    then
      return true;
    end if;
  end loop;

  v_blob := lower(trim(concat_ws(' ',
    nullif(trim(coalesce(p_first, '')), ''),
    nullif(trim(coalesce(p_last, '')), ''),
    nullif(trim(coalesce(p_partner_first, '')), ''),
    nullif(trim(coalesce(p_partner_last, '')), ''),
    nullif(trim(coalesce(p_extra, '')), '')
  )));
  if v_blob = '' then
    return false;
  end if;
  v_compact := regexp_replace(v_blob, '[\s_-]+', '', 'g');

  if v_compact like '%zzcleanup%'
    or v_blob ~ 'patha[[:space:]]+live'
    or v_blob ~ 'pathb[[:space:]]+live'
    or v_blob ~ 'pathb[[:space:]]+closeout'
    or v_blob ~ 'patha[[:space:]]+closeout'
    or v_blob ~ 'phase[[:space:]]*7'
    or v_compact like '%spinee2e%'
    or v_compact like '%spinespace%'
    or v_compact like '%e2etest%'
    or v_compact like '%e2eclient%'
    or v_compact like '%e2efull%'
    or v_compact like '%e2enoemail%'
    or v_blob ~ '\ye2e\y'
    or v_blob ~ 'sandbox[[:space:]]+watch[[:space:]]+fixture'
    or v_compact like '%liveoffer%'
    or v_compact like '%livecontract%'
    or v_compact like '%closeoute2e%'
    or v_compact like '%blockaverify%'
    or v_blob like '%block_a_verify%'
    or v_blob like '%release_readiness%'
  then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.stamp_lead_business_reporting_flag()
returns trigger
language plpgsql
as $$
declare
  v_flag boolean;
begin
  v_flag := public.is_internal_verification_identity(
    NEW.first_name, NEW.last_name, NEW.partner_first_name, NEW.partner_last_name,
    NEW.email, NEW.partner_email, null
  );
  NEW.exclude_from_business_reporting := coalesce(NEW.exclude_from_business_reporting, false) or v_flag;
  return NEW;
end;
$$;

create or replace function public.stamp_client_business_reporting_flag()
returns trigger
language plpgsql
as $$
declare
  v_from_lead boolean := false;
  v_flag boolean;
begin
  if NEW.lead_id is not null then
    select exclude_from_business_reporting into v_from_lead
    from public.leads
    where id = NEW.lead_id;
  end if;
  v_flag := public.is_internal_verification_identity(
    NEW.first_name, NEW.last_name, NEW.partner_first_name, NEW.partner_last_name,
    NEW.email, NEW.partner_email, null
  );
  NEW.exclude_from_business_reporting :=
    coalesce(NEW.exclude_from_business_reporting, false)
    or coalesce(v_from_lead, false)
    or v_flag;
  return NEW;
end;
$$;

create or replace function public.stamp_event_business_reporting_flag()
returns trigger
language plpgsql
as $$
declare
  v_from_client boolean := false;
  v_flag boolean;
begin
  if NEW.client_id is not null then
    select exclude_from_business_reporting into v_from_client
    from public.clients
    where id = NEW.client_id;
  end if;
  v_flag := public.is_internal_verification_identity(
    null, null, null, null, null, null, NEW.name
  );
  NEW.exclude_from_business_reporting :=
    coalesce(NEW.exclude_from_business_reporting, false)
    or coalesce(v_from_client, false)
    or v_flag;
  return NEW;
end;
$$;

drop trigger if exists trg_stamp_lead_business_reporting on public.leads;
create trigger trg_stamp_lead_business_reporting
  before insert or update of first_name, last_name, partner_first_name, partner_last_name, email, partner_email, exclude_from_business_reporting
  on public.leads
  for each row execute function public.stamp_lead_business_reporting_flag();

drop trigger if exists trg_stamp_client_business_reporting on public.clients;
create trigger trg_stamp_client_business_reporting
  before insert or update of first_name, last_name, partner_first_name, partner_last_name, email, partner_email, lead_id, exclude_from_business_reporting
  on public.clients
  for each row execute function public.stamp_client_business_reporting_flag();

drop trigger if exists trg_stamp_event_business_reporting on public.events;
create trigger trg_stamp_event_business_reporting
  before insert or update of name, client_id, exclude_from_business_reporting
  on public.events
  for each row execute function public.stamp_event_business_reporting_flag();

update public.leads
set exclude_from_business_reporting = true
where public.is_internal_verification_identity(
  first_name, last_name, partner_first_name, partner_last_name, email, partner_email, null
);

update public.clients
set exclude_from_business_reporting = true
where public.is_internal_verification_identity(
  first_name, last_name, partner_first_name, partner_last_name, email, partner_email, null
)
or coalesce((select l.exclude_from_business_reporting from public.leads l where l.id = clients.lead_id), false);

update public.events
set exclude_from_business_reporting = true
where public.is_internal_verification_identity(null, null, null, null, null, null, name)
or coalesce((select c.exclude_from_business_reporting from public.clients c where c.id = events.client_id), false);

-- ---- Reporting RPCs honor the flag ------------------------------------------

create or replace function public.canonical_gross_booked_revenue(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(i.subtotal - i.discount_amount), 0)
  from public.invoices i
  join public.canonical_bookings cb
    on cb.client_id = i.client_id and cb.venue_id = i.venue_id
  join public.clients c on c.id = i.client_id
  where i.venue_id = public.current_user_venue_id()
    and i.status <> 'void'
    and c.exclude_from_business_reporting = false
    and (p_from is null or cb.booked_at::date >= p_from)
    and (p_to   is null or cb.booked_at::date <= p_to);
$$;

create or replace function public.canonical_payments_collected(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    coalesce(pli.paid_amount, pli.amount) - coalesce(pli.refunded_amount, 0)
  ), 0)
  from public.payment_line_items pli
  left join public.payment_schedules ps on ps.id = pli.schedule_id
  left join public.clients c on c.id = ps.client_id
  where pli.venue_id = public.current_user_venue_id()
    and pli.status in ('paid', 'partially_refunded', 'refunded')
    and coalesce(c.exclude_from_business_reporting, false) = false
    and (p_from is null or pli.paid_at::date >= p_from)
    and (p_to   is null or pli.paid_at::date <= p_to);
$$;

create or replace function public.canonical_outstanding_balance(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
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
  join public.clients c on c.id = cb.client_id
  where cb.venue_id = public.current_user_venue_id()
    and c.exclude_from_business_reporting = false
    and (p_from is null or cb.booked_at::date >= p_from)
    and (p_to   is null or cb.booked_at::date <= p_to);
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
  join public.canonical_bookings cb on cb.client_id = c.id
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
      select 1 from public.clients c join public.canonical_bookings cb on cb.client_id = c.id
      where c.lead_id = l.id
    )
  from public.leads l
  where l.venue_id = public.current_user_venue_id()
    and l.exclude_from_business_reporting = false
    and l.sales_stage <> 'lost'
    and (p_from is null or l.created_at::date >= p_from)
    and (p_to   is null or l.created_at::date <= p_to)
  order by l.created_at desc;
$$;

create or replace function public.canonical_lifecycle_bookings_in_period(
  p_from date default null,
  p_to date default null
)
returns table (
  event_id uuid,
  venue_id uuid,
  lead_id uuid,
  client_id uuid,
  origin text,
  occurred_at timestamptz,
  actor_user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.venue_id,
    e.lead_id,
    e.client_id,
    e.origin,
    e.occurred_at,
    e.actor_user_id
  from public.lifecycle_booking_events e
  left join public.leads l on l.id = e.lead_id
  left join public.clients c on c.id = e.client_id
  where e.venue_id = public.current_user_venue_id()
    and e.event_kind = 'first_booked'
    and e.occurred_at is not null
    and coalesce(l.exclude_from_business_reporting, false) = false
    and coalesce(c.exclude_from_business_reporting, false) = false
    and (p_from is null or e.occurred_at::date >= p_from)
    and (p_to is null or e.occurred_at::date <= p_to)
  order by e.occurred_at desc;
$$;


-- Luv stale-lead insight uses the same business-record boundary as Reporting.
-- sales_stage is lifecycle truth; status is the retired alias.
create or replace function generate_venue_recommendations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id          uuid;
  v_stale_leads       int;
  v_pipeline_score    int;
  v_insight_id        uuid;
  v_insight_evidence  jsonb;
  v_monthly_avgs      jsonb;
  v_next_month_num    int;
  v_next_month_name   text;
  v_overall_avg       numeric;
  v_next_month_avg    numeric;
  v_next_ratio        numeric;
  v_pacing_ratio      numeric;
  v_days_elapsed      text;
  v_recs_generated    int := 0;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  -- ── 1. Lead Follow-Up ─────────────────────────────────────────────────────

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'lead_followup'
      and dismissed_at > now() - interval '7 days'
  ) then
    select count(*)::int into v_stale_leads
    from leads
    where venue_id = v_venue_id
      and coalesce(exclude_from_business_reporting, false) = false
      and coalesce(sales_stage, status) not in ('won', 'lost', 'cancelled', 'booked')
      and (last_contacted_at is null or last_contacted_at < current_date - 7);

    if v_stale_leads >= 2 then
      select coalesce(
        (dimensions -> 'pipelineActivity' ->> 'score')::int, 70
      ) into v_pipeline_score
      from venue_health_scores where venue_id = v_venue_id;

      insert into luv_recommendations
        (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
      values (
        v_venue_id,
        'lead_followup',
        v_stale_leads::text || ' active lead' ||
          (case when v_stale_leads <> 1 then 's haven''t' else ' hasn''t' end) ||
          ' been contacted in 7+ days',
        'These leads may cool off without a nudge. A short follow-up keeps the relationship warm and your pipeline moving.',
        case when coalesce(v_pipeline_score, 70) < 50 then 80 else 65 end,
        '[{"label":"Draft follow-up messages \u2728","target":"follow_up_messages","type":"generate"},{"label":"Review inquiries \u2192","target":"/leads?attention=stale_contact","type":"navigate"}]'::jsonb,
        jsonb_build_object(
          'staleLeadCount', v_stale_leads,
          'evidenceBullets', jsonb_build_array(
            v_stale_leads::text || ' active ' ||
              case when v_stale_leads = 1 then 'inquiry hasn''t' else 'inquiries haven''t' end ||
              ' been contacted in 7+ days',
            case when coalesce(v_pipeline_score, 70) < 50
              then 'Pipeline activity is running below healthy levels — outreach is especially important now'
              else 'Regular follow-up is one of the strongest drivers of inquiry conversion'
            end
          )
        ),
        null, null,
        now() + interval '3 days'
      )
      on conflict (venue_id, type) do update
        set title        = excluded.title,
            body         = excluded.body,
            priority     = excluded.priority,
            ctas         = excluded.ctas,
            metadata     = excluded.metadata,
            dismissed_at = null,
            completed_at = null,
            expires_at   = excluded.expires_at;

      v_recs_generated := v_recs_generated + 1;
    else
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = 'lead_followup'
        and dismissed_at is null
        and completed_at is null;
    end if;
  end if;

  -- ── 2. Inquiry Reactivation ────────────────────────────────────────────────

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'inquiry_reactivation'
      and dismissed_at > now() - interval '7 days'
  ) then
    select id, evidence into v_insight_id, v_insight_evidence
    from luv_insights
    where venue_id = v_venue_id
      and type = 'inquiry_pacing'
      and is_actionable = true
      and confidence in ('medium', 'high')
    limit 1;

    if v_insight_id is not null then
      v_pacing_ratio := coalesce((v_insight_evidence ->> 'pacingRatio')::numeric, 0.75);
      v_days_elapsed := coalesce(v_insight_evidence ->> 'daysElapsed', 'Several');

      insert into luv_recommendations
        (venue_id, insight_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
      values (
        v_venue_id,
        v_insight_id,
        'inquiry_reactivation',
        'Your inquiry volume is below average this month',
        'This is a good moment to strengthen your presence — revisit your packages, refresh your listings, or reach out to warm leads who haven''t responded yet.',
        70,
        '[{"label":"Create seasonal promotion \u2728","target":"seasonal_promo","type":"generate"},{"label":"View pipeline \u2192","target":"/leads","type":"navigate"},{"label":"Open Packages \u2192","target":"/library/packages","type":"navigate"}]'::jsonb,
        jsonb_build_object(
          'insightId', v_insight_id,
          'evidenceBullets', jsonb_build_array(
            'Inquiry volume is ' ||
              round((1 - v_pacing_ratio) * 100)::text ||
              '% below your monthly average',
            v_days_elapsed || ' days into the month — pacing is behind historical baseline',
            'Venues that increase visibility during slower periods often recover within 2–3 weeks'
          )
        ),
        null, null,
        now() + interval '14 days'
      )
      on conflict (venue_id, type) do update
        set insight_id   = excluded.insight_id,
            title        = excluded.title,
            body         = excluded.body,
            ctas         = excluded.ctas,
            metadata     = excluded.metadata,
            dismissed_at = null,
            completed_at = null,
            expires_at   = excluded.expires_at;

      v_recs_generated := v_recs_generated + 1;
    else
      delete from luv_recommendations
      where venue_id = v_venue_id
        and type = 'inquiry_reactivation'
        and dismissed_at is null
        and completed_at is null;
    end if;
  end if;

  -- ── 3. Seasonal Inventory Prep ─────────────────────────────────────────────

  if not exists (
    select 1 from luv_recommendations
    where venue_id = v_venue_id
      and type = 'seasonal_prep'
      and dismissed_at > now() - interval '14 days'
  ) then
    select value into v_monthly_avgs
    from luv_memories
    where venue_id = v_venue_id and key = 'monthly_inquiry_averages';

    if v_monthly_avgs is not null and jsonb_array_length(v_monthly_avgs) >= 6 then
      v_next_month_num := (extract(month from now())::int % 12) + 1;

      select
        avg((elem ->> 'avg')::numeric),
        max(case when (elem ->> 'month')::int = v_next_month_num
              then (elem ->> 'avg')::numeric end)
      into v_overall_avg, v_next_month_avg
      from jsonb_array_elements(v_monthly_avgs) as elem;

      if v_overall_avg > 0 and v_next_month_avg is not null then
        v_next_ratio := v_next_month_avg / v_overall_avg;

        if v_next_ratio >= 1.35 then
          v_next_month_name := trim(to_char(
            date_trunc('month', now()) + interval '1 month', 'Month'
          ));

          insert into luv_recommendations
            (venue_id, type, title, body, priority, ctas, metadata, dismissed_at, completed_at, expires_at)
          values (
            v_venue_id,
            'seasonal_prep',
            v_next_month_name || ' is historically one of your peak months — it''s coming up soon',
            'Based on past years, ' || v_next_month_name ||
              ' brings well above your average inquiry volume. Opening availability early and refreshing your packages now could help you capture more bookings.',
            60,
            '[{"label":"Prepare availability plan \u2728","target":"availability_plan","type":"generate"},{"label":"View calendar \u2192","target":"/calendar","type":"navigate"},{"label":"Manage availability \u2192","target":"/settings/availability","type":"navigate"}]'::jsonb,
            jsonb_build_object(
              'nextMonthNum',  v_next_month_num,
              'nextMonthName', v_next_month_name,
              'nextRatio',     round(v_next_ratio, 2),
              'evidenceBullets', jsonb_build_array(
                v_next_month_name || ' historically brings ' ||
                  round((v_next_ratio - 1) * 100)::text ||
                  '% more inquiries than your monthly average',
                'Based on ' || jsonb_array_length(v_monthly_avgs)::text || ' months of historical inquiry data',
                'Venues that prepare 3–4 weeks early capture more bookings during peak months'
              )
            ),
            null, null,
            now() + interval '21 days'
          )
          on conflict (venue_id, type) do update
            set title        = excluded.title,
                body         = excluded.body,
                ctas         = excluded.ctas,
                metadata     = excluded.metadata,
                dismissed_at = null,
                completed_at = null,
                expires_at   = excluded.expires_at;

          v_recs_generated := v_recs_generated + 1;
        else
          delete from luv_recommendations
          where venue_id = v_venue_id
            and type = 'seasonal_prep'
            and dismissed_at is null
            and completed_at is null;
        end if;
      end if;
    end if;
  end if;

  -- Keep already-stored lead_followup CTAs aligned with the filter destination.
  update luv_recommendations
  set ctas = (
    select jsonb_agg(
      case
        when elem->>'type' = 'navigate' and elem->>'target' = '/leads'
          then jsonb_set(elem, '{target}', '"/leads?attention=stale_contact"')
        else elem
      end
    )
    from jsonb_array_elements(ctas) as elem
  )
  where type = 'lead_followup';

  return jsonb_build_object('ok', true, 'generated', v_recs_generated);
end;
$$;


grant execute on function public.is_internal_verification_identity(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.canonical_gross_booked_revenue(date, date) to authenticated;
grant execute on function public.canonical_payments_collected(date, date) to authenticated;
grant execute on function public.canonical_outstanding_balance(date, date) to authenticated;
grant execute on function public.canonical_average_booking_value(date, date) to authenticated;
grant execute on function public.canonical_conversion_funnel(date, date) to authenticated;
grant execute on function public.canonical_conversion_funnel_leads(date, date) to authenticated;
grant execute on function public.canonical_lifecycle_bookings_in_period(date, date) to authenticated;

notify pgrst, 'reload schema';
