-- Reporting integrity: original booking date, inquiry performance date,
-- occupancy for confirmed imports, invoice-dated contracted revenue.
-- Additive. Does not rewrite events.booked_at or fabricate historical dates.

alter table public.events
  add column if not exists original_booked_on date,
  add column if not exists original_booking_provenance text;

alter table public.events
  drop constraint if exists events_original_booking_known;

alter table public.events
  add constraint events_original_booking_known
  check (
    (original_booked_on is null and original_booking_provenance is null)
    or (
      original_booked_on is not null
      and original_booking_provenance in ('source', 'htc')
    )
  );

comment on column public.events.original_booked_on is
  'Original booking calendar date when known. Null means unknown. Never the import timestamp or the event date.';

comment on column public.events.original_booking_provenance is
  'source = supplied by an import file. htc = stamped from a genuine HTC booking. Null with a null date means unknown.';

comment on column public.events.booked_at is
  'Payment-timing and occupancy commitment stamp for HTC bookings. Not the original source booking date.';

alter table public.leads
  alter column inquiry_date drop not null;

comment on column public.leads.inquiry_date is
  'Source inquiry date. Null on a historical import means unknown. Native inserts still default to current_date when omitted.';

alter table public.leads
  add column if not exists performance_inquiry_on date
  generated always as (
    case
      when coalesce(is_historical_import, false) then inquiry_date
      else (created_at at time zone 'utc')::date
    end
  ) stored;

comment on column public.leads.performance_inquiry_on is
  'Inquiry period for reporting. Historical imports use inquiry_date. Native inquiries use the HTC creation date. Null is excluded from date windows.';

create or replace function public.lead_performance_on(
  p_historical boolean,
  p_inquiry date,
  p_created timestamptz
) returns date
language sql
immutable
as $$
  select case
    when coalesce(p_historical, false) then p_inquiry
    else (p_created at time zone 'utc')::date
  end;
$$;

create or replace function public.event_occupies_calendar(
  p_status text,
  p_booked_at date
) returns boolean
language sql
immutable
as $$
  select p_status is distinct from 'cancelled'
    and p_status is distinct from 'complete'
    and (
      p_booked_at is not null
      or p_status in ('confirmed', 'in_progress')
    );
$$;

comment on function public.event_occupies_calendar(text, date) is
  'Confirmed and in-progress events occupy even when the original booking date is unknown. Completed and cancelled events do not. A draft occupies only after booked_at is set.';

create or replace function public.events_stamp_htc_original_booking()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.booked_at is not null
     and NEW.original_booked_on is null
     and NEW.original_booking_provenance is null
     and (TG_OP = 'INSERT' or OLD.booked_at is null) then
    NEW.original_booked_on := NEW.booked_at;
    NEW.original_booking_provenance := 'htc';
  end if;
  return NEW;
end;
$$;

drop trigger if exists events_stamp_htc_original_booking on public.events;
create trigger events_stamp_htc_original_booking
  before insert or update of booked_at on public.events
  for each row
  execute function public.events_stamp_htc_original_booking();

create or replace function public.canonical_gross_booked_revenue(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(i.subtotal - i.discount_amount), 0)
  from public.invoices i
  join public.clients c on c.id = i.client_id
  where i.venue_id = public.current_user_venue_id()
    and i.status <> 'void'
    and c.exclude_from_business_reporting = false
    and (
      (p_from is null and p_to is null)
      or (
        i.issued_at is not null
        and (p_from is null or i.issued_at::date >= p_from)
        and (p_to is null or i.issued_at::date <= p_to)
      )
    );
$$;

create or replace function public.canonical_average_booking_value(
  p_from date default null, p_to date default null
) returns numeric
language sql stable security definer set search_path = public as $$
  select case when count(*) > 0
    then public.canonical_gross_booked_revenue(p_from, p_to) / count(*)
    else 0 end
  from (
    select coalesce(i.event_id::text, i.id::text) as grain
    from public.invoices i
    join public.clients c on c.id = i.client_id
    where i.venue_id = public.current_user_venue_id()
      and i.status <> 'void'
      and c.exclude_from_business_reporting = false
      and (
        (p_from is null and p_to is null)
        or (
          i.issued_at is not null
          and (p_from is null or i.issued_at::date >= p_from)
          and (p_to is null or i.issued_at::date <= p_to)
        )
      )
    group by 1
  ) grains;
$$;

grant execute on function public.lead_performance_on(boolean, date, timestamptz) to authenticated, service_role;
grant execute on function public.event_occupies_calendar(text, date) to anon, authenticated, service_role;


create or replace function public.ingest_lead(
  p_venue_id uuid,
  p_source   text,
  p_input    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email           text := nullif(trim(p_input ->> 'email'), '');
  v_first           text := nullif(trim(p_input ->> 'firstName'), '');
  v_last            text := nullif(trim(p_input ->> 'lastName'), '');
  v_relationship_id uuid;
  v_explicit_rel    uuid := nullif(p_input ->> 'relationshipId', '')::uuid;
  v_force_new       boolean := coalesce((p_input ->> 'createNewRelationship')::boolean, false);
  v_was_existing    boolean := false;
  v_lead_id         uuid;
  v_is_historical   boolean := coalesce((p_input ->> 'isHistoricalImport')::boolean, false);
  v_prior           uuid;
  v_origin          text := lower(nullif(trim(p_input ->> 'inquiryMessageOrigin'), ''));
begin
  if p_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_venue');
  end if;
  if v_first is null or v_last is null then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;
  if p_source is not null and not exists (
    select 1 from public.lead_sources where key = p_source and is_enabled
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;

  if v_origin is null or v_origin not in ('customer', 'venue', 'unknown') then
    v_origin := 'unknown';
  end if;

  if not v_force_new and v_explicit_rel is null then
    if v_email is not null then
      select id into v_prior
      from public.venue_customer_relationships
      where venue_id = p_venue_id
        and lower(email) = lower(v_email)
        and lower(first_name) = lower(v_first)
        and lower(last_name) = lower(v_last)
      order by created_at asc
      limit 1;
    else
      select id into v_prior
      from public.venue_customer_relationships
      where venue_id = p_venue_id and email is null
        and lower(first_name) = lower(v_first)
        and lower(last_name) = lower(v_last)
      order by created_at asc
      limit 1;
    end if;
    v_was_existing := v_prior is not null;
  elsif v_explicit_rel is not null then
    v_was_existing := true;
  end if;

  v_relationship_id := public.resolve_relationship_for_identity(
    p_venue_id, v_email, v_first, v_last, v_explicit_rel, v_force_new
  );

  insert into public.leads (
    venue_id, sales_stage, source, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, end_date, guest_count, estimated_budget,
    inquiry_message, inquiry_message_origin, inquiry_date, source_data,
    relationship_id, intake_confidence, is_historical_import
  ) values (
    p_venue_id, 'new_inquiry', p_source, v_first, v_last,
    v_email, nullif(trim(p_input ->> 'phone'), ''),
    nullif(trim(p_input ->> 'partnerFirstName'), ''),
    nullif(trim(p_input ->> 'partnerLastName'), ''),
    nullif(trim(p_input ->> 'partnerEmail'), ''),
    nullif(p_input ->> 'eventType', ''),
    nullif(p_input ->> 'eventDate', '')::date,
    nullif(p_input ->> 'endDate', '')::date,
    nullif(regexp_replace(coalesce(p_input ->> 'guestCount', ''), '[^0-9]', '', 'g'), '')::integer,
    nullif(regexp_replace(coalesce(p_input ->> 'estimatedBudget', ''), '[^0-9.]', '', 'g'), '')::numeric,
    nullif(trim(p_input ->> 'inquiryMessage'), ''),
    v_origin,
    case
      when v_is_historical then nullif(p_input ->> 'inquiryDate', '')::date
      else coalesce(nullif(p_input ->> 'inquiryDate', '')::date, current_date)
    end,
    coalesce(p_input -> 'sourceData', '{}'::jsonb),
    v_relationship_id,
    nullif(p_input ->> 'confidenceScore', '')::smallint,
    v_is_historical
  )
  returning id into v_lead_id;

  return jsonb_build_object(
    'ok', true,
    'leadId', v_lead_id,
    'relationshipId', v_relationship_id,
    'isReturningRelationship', v_was_existing
  );
end;
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
    and (p_from is null or public.lead_performance_on(is_historical_import, inquiry_date, created_at) >= p_from)
    and (p_to   is null or public.lead_performance_on(is_historical_import, inquiry_date, created_at) <= p_to);

  select count(distinct l.id) into v_toured
  from public.leads l
  join public.tour_appointments t on t.lead_id = l.id
  where l.venue_id = v_venue_id
    and l.exclude_from_business_reporting = false
    and (p_from is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) >= p_from)
    and (p_to   is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) <= p_to);

  select count(*) into v_proposal
  from public.leads
  where venue_id = v_venue_id and sales_stage in ('proposal_sent', 'booked')
    and exclude_from_business_reporting = false
    and (p_from is null or public.lead_performance_on(is_historical_import, inquiry_date, created_at) >= p_from)
    and (p_to   is null or public.lead_performance_on(is_historical_import, inquiry_date, created_at) <= p_to);

  select count(distinct l.id) into v_contract_sent
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.contracts con on con.client_id = c.id
  where l.venue_id = v_venue_id and con.sent_at is not null
    and l.exclude_from_business_reporting = false
    and (p_from is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) >= p_from)
    and (p_to   is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) <= p_to);

  select count(distinct l.id) into v_contract_signed
  from public.leads l
  join public.clients c on c.lead_id = l.id
  join public.contracts con on con.client_id = c.id
  where l.venue_id = v_venue_id and con.signed_at is not null
    and l.exclude_from_business_reporting = false
    and (p_from is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) >= p_from)
    and (p_to   is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) <= p_to);

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
    and (p_from is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) >= p_from)
    and (p_to   is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) <= p_to);

  select count(distinct l.id) into v_booked
  from public.leads l
  where l.venue_id = v_venue_id
    and l.sales_stage = 'booked'
    and l.exclude_from_business_reporting = false
    and (p_from is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) >= p_from)
    and (p_to   is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) <= p_to);

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
    (l.sales_stage = 'booked')
  from public.leads l
  where l.venue_id = public.current_user_venue_id()
    and l.exclude_from_business_reporting = false
    and l.sales_stage <> 'lost'
    and (p_from is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) >= p_from)
    and (p_to   is null or public.lead_performance_on(l.is_historical_import, l.inquiry_date, l.created_at) <= p_to)
  order by l.created_at desc;
$$;

create or replace function public.events_enforce_availability()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
  v_old_start date;
  v_old_end date;
  v_new_start date;
  v_new_end date;
  v_day date;
  v_extra integer;
  v_occupancy_changed boolean;
  v_restoring boolean;
  v_becoming_booked boolean;
  v_prot_start date;
  v_prot_end date;
  v_block_title text;
  v_win_start time;
  v_win_end time;
  v_max integer;
  v_hold record;
  v_hold_spaces uuid[];
  v_hold_win_start time;
  v_hold_win_end time;
  v_cand_spaces uuid[];
  v_same_owner boolean;
  v_force boolean;
begin
  if NEW.status = 'cancelled' then
    return NEW;
  end if;

  if not public.event_occupies_calendar(NEW.status, NEW.booked_at) then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    v_occupancy_changed :=
         OLD.event_date is distinct from NEW.event_date
      or OLD.event_end_date is distinct from NEW.event_end_date
      or OLD.setup_time is distinct from NEW.setup_time
      or OLD.start_time is distinct from NEW.start_time
      or OLD.end_time is distinct from NEW.end_time
      or OLD.teardown_time is distinct from NEW.teardown_time
      or OLD.space_id is distinct from NEW.space_id;
    v_restoring := OLD.status = 'cancelled' and NEW.status is distinct from 'cancelled';
    v_becoming_booked := not public.event_occupies_calendar(OLD.status, OLD.booked_at);
    v_force := coalesce(current_setting('htc.force_event_occupancy', true), '') = '1';
    if not v_occupancy_changed and not v_restoring and not v_becoming_booked and not v_force then
      return NEW;
    end if;

    v_extra := public.event_turnaround_extra_lock_days(NEW.venue_id);
    v_old_start := OLD.event_date - v_extra;
    v_old_end := coalesce(OLD.event_end_date, OLD.event_date) + v_extra;
    if v_old_end < v_old_start then
      v_old_end := v_old_start;
    end if;
    v_new_start := NEW.event_date - v_extra;
    v_new_end := coalesce(NEW.event_end_date, NEW.event_date) + v_extra;
    if v_new_end < v_new_start then
      v_new_end := v_new_start;
    end if;

    for v_day in
      select d from (
        select generate_series(v_old_start, v_old_end, interval '1 day')::date as d
        union
        select generate_series(v_new_start, v_new_end, interval '1 day')
      ) days
      order by d
    loop
      perform pg_advisory_xact_lock(hashtext(NEW.venue_id::text), hashtext(v_day::text));
    end loop;
  end if;

  v_result := public.assert_event_availability(
    NEW.venue_id,
    NEW.event_date,
    NEW.event_end_date,
    NEW.setup_time,
    NEW.start_time,
    NEW.end_time,
    NEW.teardown_time,
    NEW.space_id,
    case when TG_OP = 'UPDATE' then NEW.id else null end
  );

  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception '%', coalesce(v_result->>'message', 'This date is not available.')
      using errcode = 'P0001',
            detail = v_result::text,
            hint = coalesce(v_result->>'code', 'venue_at_capacity');
  end if;

  perform pg_advisory_xact_lock(hashtext(NEW.venue_id::text), hashtext('calendar-blocks'));

  v_prot_start := NEW.event_date;
  v_prot_end := coalesce(NEW.event_end_date, NEW.event_date);
  if v_prot_end < v_prot_start then
    v_prot_end := v_prot_start;
  end if;
  select w.window_start, w.window_end
    into v_win_start, v_win_end
  from public.event_operational_window(
    NEW.setup_time, NEW.start_time, NEW.end_time, NEW.teardown_time
  ) w;
  v_block_title := public.covering_calendar_block_title(
    NEW.venue_id, v_prot_start, v_prot_end, v_win_start, v_win_end, null
  );
  if v_block_title is not null then
    raise exception 'Cannot book this date — the calendar is blocked: "%". Remove the block first.', v_block_title
      using errcode = 'P0001',
            hint = 'calendar_blocked';
  end if;

  select coalesce(r.max_simultaneous_events, 1) into v_max
  from public.venue_capacity_rules r
  where r.venue_id = NEW.venue_id;
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;

  v_cand_spaces := public.event_occupied_space_ids(
    case when TG_OP = 'UPDATE' then NEW.id else null end,
    NEW.space_id
  );

  if exists (
    select 1 from public.venues v
    where v.id = NEW.venue_id
      and coalesce(v.hold_blocks_availability, true)
  ) then
    for v_hold in
      select h.id, h.lead_id, h.space_id, h.hold_date, h.start_time, h.end_time
      from public.date_holds h
      where h.venue_id = NEW.venue_id
        and h.status = 'active'
        and (h.expires_at is null or h.expires_at > now())
        and h.hold_date >= NEW.event_date
        and h.hold_date <= coalesce(NEW.event_end_date, NEW.event_date)
    loop
      v_same_owner := false;
      if v_hold.lead_id is not null and NEW.client_id is not null then
        select exists (
          select 1 from public.clients c
          where c.id = NEW.client_id
            and c.venue_id = NEW.venue_id
            and c.lead_id = v_hold.lead_id
        ) into v_same_owner;
      end if;
      if v_same_owner then
        continue;
      end if;

      select w.window_start, w.window_end
        into v_hold_win_start, v_hold_win_end
      from public.event_operational_window(null, v_hold.start_time, v_hold.end_time, null) w;

      v_hold_spaces := public.hold_occupied_space_ids(v_hold.id, v_hold.space_id);
      if exists (
        select 1
        from public.event_schedule_windows(
          case when TG_OP = 'UPDATE' then NEW.id else null end,
          NEW.space_id,
          NEW.setup_time, NEW.start_time, NEW.end_time, NEW.teardown_time
        ) c
        where c.window_start < v_hold_win_end
          and v_hold_win_start < c.window_end
          and public.hold_resources_collide(
            v_hold_spaces,
            case when c.space_id is null then v_cand_spaces else array[c.space_id] end,
            v_max
          )
      ) then
        raise exception 'This date has a hold. Your availability settings treat holds as unavailable.'
          using errcode = 'P0001',
                hint = 'hold_blocks';
      end if;
    end loop;
  end if;

  return NEW;
end;
$$;

create or replace function public.evaluate_event_availability(
  p_venue_id          uuid,
  p_event_date        date,
  p_event_end_date    date default null,
  p_setup_time        time default null,
  p_start_time        time default null,
  p_end_time          time default null,
  p_teardown_time     time default null,
  p_space_id          uuid default null,
  p_exclude_event_id  uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_start date := p_event_date;
  v_end   date := coalesce(p_event_end_date, p_event_date);
  v_look_start date;
  v_look_end   date;
  v_max   integer;
  v_turnaround numeric;
  v_extra integer := 0;
  v_win_start time;
  v_win_end   time;
  v_e_start   time;
  v_e_end     time;
  v_overlap_count integer := 0;
  v_active_spaces integer;
  v_space_ok boolean;
  v_existing record;
  v_ex_start date;
  v_ex_end   date;
  v_cand_day date;
  v_ex_day   date;
  v_c_start timestamp;
  v_c_end   timestamp;
  v_x_start timestamp;
  v_x_end   timestamp;
  v_gap interval;
  v_earliest timestamp;
  v_label text;
  v_hours_label text;
  v_cand_spaces uuid[];
  v_kind text;
  v_pair record;
  v_time_hit boolean;
  v_space_hit boolean;
begin
  if p_venue_id is null or p_event_date is null then
    raise exception 'venue_id and event_date are required';
  end if;

  if v_end < v_start then
    v_end := v_start;
  end if;

  select w.window_start, w.window_end
    into v_win_start, v_win_end
  from public.event_operational_window(p_setup_time, p_start_time, p_end_time, p_teardown_time) w;

  select r.max_simultaneous_events, r.min_turnaround_hours
    into v_max, v_turnaround
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;
  if v_turnaround is null or v_turnaround <= 0 then
    v_turnaround := 0;
    v_extra := 0;
  else
    v_extra := ceil(v_turnaround / 24.0)::integer;
  end if;

  v_look_start := v_start - v_extra;
  v_look_end := v_end + v_extra;

  v_cand_spaces := public.event_occupied_space_ids(p_exclude_event_id, p_space_id);

  if v_max >= 2 then
    select count(*)::integer into v_active_spaces
    from public.venue_spaces s
    where s.venue_id = p_venue_id and s.is_active = true;

    if v_active_spaces = 0 then
      return jsonb_build_object(
        'ok', false, 'code', 'no_spaces',
        'message', 'Add an Event Space in Availability settings before booking. This venue can host more than one event at the same time.'
      );
    end if;

    if p_space_id is null and coalesce(cardinality(v_cand_spaces), 0) = 0 then
      return jsonb_build_object(
        'ok', false, 'code', 'missing_space',
        'message', 'Assign an Event Space before booking. This venue can host more than one event at the same time.'
      );
    end if;

    if p_space_id is not null then
      select exists(
        select 1 from public.venue_spaces s
        where s.venue_id = p_venue_id and s.id = p_space_id
      ) into v_space_ok;
      if not v_space_ok then
        return jsonb_build_object(
          'ok', false, 'code', 'invalid_space',
          'message', 'That Event Space does not belong to this venue.'
        );
      end if;
    end if;
  end if;

  for v_existing in
    select e.id, e.name, e.space_id, e.event_date, e.event_end_date,
           e.setup_time, e.start_time, e.end_time, e.teardown_time
    from public.events e
    where e.venue_id = p_venue_id
      and e.status is distinct from 'cancelled'
      and public.event_occupies_calendar(e.status, e.booked_at)
      and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
      and e.event_date <= v_look_end
      and coalesce(e.event_end_date, e.event_date) >= v_look_start
  loop
    v_ex_start := v_existing.event_date;
    v_ex_end := coalesce(v_existing.event_end_date, v_existing.event_date);
    if v_ex_end < v_ex_start then
      v_ex_end := v_ex_start;
    end if;

    -- Day-scoped overlap (same calendar day required). Undated candidate
    -- windows expand onto p_event_date..v_end; existing component scheduled_date
    -- windows expand only onto that day.
    v_time_hit := false;
    v_space_hit := false;
    for v_pair in
      select
        c.space_id as c_space, c.window_start as c_start, c.window_end as c_end, c.occ_date as c_occ,
        x.space_id as x_space, x.window_start as x_start, x.window_end as x_end, x.occ_date as x_occ
      from public.event_schedule_windows(
        p_exclude_event_id, p_space_id,
        p_setup_time, p_start_time, p_end_time, p_teardown_time
      ) c
      cross join public.event_schedule_windows(
        v_existing.id, v_existing.space_id,
        v_existing.setup_time, v_existing.start_time,
        v_existing.end_time, v_existing.teardown_time
      ) x
      where c.window_start < x.window_end and x.window_start < c.window_end
    loop
      v_cand_day := v_start;
      while v_cand_day <= v_end loop
        if v_pair.c_occ is not null and v_pair.c_occ is distinct from v_cand_day then
          v_cand_day := v_cand_day + 1;
          continue;
        end if;
        v_ex_day := v_ex_start;
        while v_ex_day <= v_ex_end loop
          if v_pair.x_occ is not null and v_pair.x_occ is distinct from v_ex_day then
            v_ex_day := v_ex_day + 1;
            continue;
          end if;
          if v_cand_day = v_ex_day then
            v_time_hit := true;
            if v_pair.c_space is not null and v_pair.x_space is not null
               and v_pair.c_space = v_pair.x_space then
              v_space_hit := true;
            end if;
          end if;
          v_ex_day := v_ex_day + 1;
        end loop;
        v_cand_day := v_cand_day + 1;
      end loop;
    end loop;

    if v_existing.event_date <= v_end
       and coalesce(v_existing.event_end_date, v_existing.event_date) >= v_start
       and (v_time_hit or v_space_hit) then
      v_overlap_count := v_overlap_count + 1;
      if v_space_hit and v_max >= 2 then
        return jsonb_build_object(
          'ok', false, 'code', 'space_overlap',
          'message', 'This space is already booked for "' || coalesce(nullif(trim(v_existing.name), ''), 'another event') || '" at an overlapping time.'
        );
      end if;
      if v_time_hit and v_max < 2 then
        -- Non-simultaneous venues treat any time overlap as capacity pressure
        -- via v_overlap_count below (and schedule_overlap_kind's 'time' path).
        null;
      end if;
    end if;
  end loop;

  if v_overlap_count >= v_max then
    return jsonb_build_object(
      'ok', false, 'code', 'venue_at_capacity',
      'message', case
        when v_max = 1 then 'This date is already booked for an overlapping event.'
        else 'Maximum simultaneous events (' || v_max::text || ') reached for this time.'
      end
    );
  end if;

  if v_turnaround > 0 then
    v_gap := (v_turnaround::text || ' hours')::interval;
    v_hours_label := trim(trailing '.' from trim(trailing '0' from v_turnaround::text));

    for v_existing in
      select e.id, e.name, e.space_id, e.event_date, e.event_end_date,
             e.setup_time, e.start_time, e.end_time, e.teardown_time
      from public.events e
      where e.venue_id = p_venue_id
        and e.status is distinct from 'cancelled'
        and public.event_occupies_calendar(e.status, e.booked_at)
        and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
        and e.event_date <= v_look_end
        and coalesce(e.event_end_date, e.event_date) >= v_look_start
    loop
      for v_pair in
        select c.window_start as c_start, c.window_end as c_end, c.occ_date as c_occ,
               x.window_start as x_start, x.window_end as x_end, x.occ_date as x_occ
        from public.event_schedule_windows(
          p_exclude_event_id, p_space_id,
          p_setup_time, p_start_time, p_end_time, p_teardown_time
        ) c
        join public.event_schedule_windows(
          v_existing.id, v_existing.space_id,
          v_existing.setup_time, v_existing.start_time,
          v_existing.end_time, v_existing.teardown_time
        ) x on (
          (v_max < 2
            or (c.space_id is not null and x.space_id is not null and c.space_id = x.space_id))
          and (c.occ_date is null or x.occ_date is null or c.occ_date = x.occ_date)
        )
      loop
      v_win_start := v_pair.c_start;
      v_win_end := v_pair.c_end;
      v_e_start := v_pair.x_start;
      v_e_end := v_pair.x_end;

      v_ex_start := v_existing.event_date;
      v_ex_end := coalesce(v_existing.event_end_date, v_existing.event_date);
      if v_ex_end < v_ex_start then
        v_ex_end := v_ex_start;
      end if;

      v_cand_day := v_start;
      while v_cand_day <= v_end loop
        v_ex_day := v_ex_start;
        while v_ex_day <= v_ex_end loop
          if (v_pair.c_occ is not null and v_pair.c_occ is distinct from v_cand_day)
             or (v_pair.x_occ is not null and v_pair.x_occ is distinct from v_ex_day) then
            v_ex_day := v_ex_day + 1;
            continue;
          end if;
          -- Turnaround only compares same-day adjacency / gaps.
          if v_cand_day is distinct from v_ex_day then
            v_ex_day := v_ex_day + 1;
            continue;
          end if;
          v_c_start := v_cand_day + v_win_start;
          v_c_end := v_cand_day + v_win_end;
          v_x_start := v_ex_day + v_e_start;
          v_x_end := v_ex_day + v_e_end;
          if v_c_start < v_x_end and v_x_start < v_c_end then
            null;
          elsif v_x_end <= v_c_start and v_c_start < v_x_end + v_gap then
            v_earliest := v_x_end + v_gap;
            v_label := coalesce(nullif(trim(v_existing.name), ''), 'another event');
            return jsonb_build_object(
              'ok', false, 'code', 'event_turnaround',
              'message', 'This event is too close to "' || v_label || '". A '
                || v_hours_label || '-hour turnaround is required between events. The earliest available start is '
                || trim(to_char(v_earliest, 'FMMonth FMDD at FMHH12:MI AM')) || '.'
            );
          elsif v_c_end <= v_x_start and v_x_start < v_c_end + v_gap then
            v_label := coalesce(nullif(trim(v_existing.name), ''), 'another event');
            return jsonb_build_object(
              'ok', false, 'code', 'event_turnaround',
              'message', 'This event is too close to "' || v_label || '". A '
                || v_hours_label || '-hour turnaround is required between events.'
            );
          end if;
          v_ex_day := v_ex_day + 1;
        end loop;
        v_cand_day := v_cand_day + 1;
      end loop;
      end loop;
    end loop;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public._is_event_date_available(
  p_venue_id uuid,
  p_date     date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_result jsonb;
  v_space record;
  v_hold_blocks boolean;
  v_allow_simul boolean;
  v_hold record;
  v_hold_spaces uuid[];
  v_win_start time;
  v_win_end time;
  v_space_blocked boolean;
  v_tz text;
  v_today date;
  v_rules_max integer;
begin
  if p_date is null then
    return true;
  end if;

  select coalesce(nullif(trim(v.timezone), ''), 'UTC')
    into v_tz
  from public.venues v
  where v.id = p_venue_id;
  if v_tz is null then
    v_tz := 'UTC';
  end if;
  v_today := (timezone(v_tz, now()))::date;
  if p_date < v_today then
    return false;
  end if;

  if public.tour_availability_exception_covers_date(p_venue_id, p_date) then
    return false;
  end if;

  if public.covering_calendar_block_title(
    p_venue_id, p_date, p_date, time '00:00', time '23:59', null
  ) is not null then
    return false;
  end if;

  select coalesce(v.hold_blocks_availability, true),
         coalesce(v.allow_simultaneous_public_availability, false)
    into v_hold_blocks, v_allow_simul
  from public.venues v
  where v.id = p_venue_id;
  if v_hold_blocks is null then
    v_hold_blocks := true;
  end if;
  if v_allow_simul is null then
    v_allow_simul := false;
  end if;

  select r.max_simultaneous_events into v_rules_max
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_rules_max is null or v_rules_max < 1 then
    v_rules_max := 1;
  end if;

  -- Hold branching: without public simultaneous opt-in, treat holds as venue-wide.
  v_max := v_rules_max;
  if not v_allow_simul then
    v_max := 1;
  end if;

  if v_hold_blocks then
    if v_max < 2 then
      if exists (
        select 1
        from public.date_holds h
        where h.venue_id = p_venue_id
          and h.hold_date = p_date
          and h.status = 'active'
          and (h.expires_at is null or h.expires_at > now())
      ) then
        return false;
      end if;
    else
      if not exists (
        select 1 from public.venue_spaces s
        where s.venue_id = p_venue_id and s.is_active = true
      ) then
        return false;
      end if;
      for v_space in
        select s.id from public.venue_spaces s
        where s.venue_id = p_venue_id and s.is_active = true
      loop
        v_space_blocked := false;
        for v_hold in
          select h.id, h.space_id, h.start_time, h.end_time
          from public.date_holds h
          where h.venue_id = p_venue_id
            and h.hold_date = p_date
            and h.status = 'active'
            and (h.expires_at is null or h.expires_at > now())
        loop
          v_hold_spaces := public.hold_occupied_space_ids(v_hold.id, v_hold.space_id);
          select w.window_start, w.window_end
            into v_win_start, v_win_end
          from public.event_operational_window(null, v_hold.start_time, v_hold.end_time, null) w;
          if public.hold_resources_collide(v_hold_spaces, array[v_space.id], v_rules_max) then
            v_space_blocked := true;
            exit;
          end if;
        end loop;
        if not v_space_blocked then
          v_result := public.evaluate_event_availability(
            p_venue_id, p_date, null, null, null, null, null, v_space.id, null
          );
          if coalesce(v_result->>'ok', '') = 'true' then
            return true;
          end if;
        end if;
      end loop;
      return false;
    end if;
  end if;

  -- Explicit opt-in: space-based "any free space keeps the date Available".
  if v_allow_simul and v_rules_max >= 2 then
    if not exists (
      select 1 from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    ) then
      return false;
    end if;
    for v_space in
      select s.id from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    loop
      v_result := public.evaluate_event_availability(
        p_venue_id, p_date, null, null, null, null, null, v_space.id, null
      );
      if coalesce(v_result->>'ok', '') = 'true' then
        return true;
      end if;
    end loop;
    return false;
  end if;

  -- Default public policy (or simple capacity): a booked Event occupying the
  -- calendar date closes it venue-wide. Do not call evaluate with null space
  -- on multi-capacity venues (missing_space).
  if not v_allow_simul then
    if exists (
      select 1
      from public.events e
      where e.venue_id = p_venue_id
        and e.status is distinct from 'cancelled'
        and public.event_occupies_calendar(e.status, e.booked_at)
        and e.event_date <= p_date
        and coalesce(e.event_end_date, e.event_date) >= p_date
    ) then
      return false;
    end if;

    -- No same-day booked Event. Still honor turnaround via per-space evaluate
    -- when the venue has active spaces; otherwise the date is open.
    if not exists (
      select 1 from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    ) then
      return true;
    end if;
    for v_space in
      select s.id from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    loop
      v_result := public.evaluate_event_availability(
        p_venue_id, p_date, null, null, null, null, null, v_space.id, null
      );
      if coalesce(v_result->>'ok', '') = 'true' then
        return true;
      end if;
    end loop;
    return false;
  end if;

  v_result := public.evaluate_event_availability(
    p_venue_id, p_date, null, null, null, null, null, null, null
  );
  return coalesce(v_result->>'ok', '') = 'true';
end;
$$;
