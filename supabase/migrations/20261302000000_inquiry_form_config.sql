-- ============================================================================
-- Public inquiry form configuration — field visibility, event-date mode,
-- custom questions, and server-side availability validation.
-- ============================================================================

-- ---- 1. Venue-level inquiry settings ----------------------------------------

alter table public.venues
  add column if not exists inquiry_event_date_mode text not null default 'request_preferred'
    check (inquiry_event_date_mode in ('choose_available', 'request_preferred'));

alter table public.venues
  add column if not exists inquiry_form_fields jsonb not null default '{
    "phone": "optional",
    "partner": "optional",
    "guest_count": "optional",
    "estimated_budget": "optional",
    "preferred_event_date": "optional",
    "event_details": "optional"
  }'::jsonb;

comment on column public.venues.inquiry_event_date_mode is
  'Public inquiry preferred-event-date behavior: choose_available shows venue calendar availability; request_preferred allows any date without availability UI.';

comment on column public.venues.inquiry_form_fields is
  'Per-field visibility for configurable standard inquiry fields: required | optional | hidden.';

-- ---- 2. Custom inquiry questions --------------------------------------------

create table if not exists public.inquiry_form_questions (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid not null references public.venues (id) on delete cascade,
  question_text  text not null check (char_length(trim(question_text)) > 0),
  question_type  text not null
                   check (question_type in ('short_answer', 'long_answer', 'single_select', 'multiple_select')),
  required       boolean not null default false,
  options        jsonb,
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists inquiry_form_questions_venue_sort
  on public.inquiry_form_questions (venue_id, sort_order, created_at);

create trigger inquiry_form_questions_updated_at
  before update on public.inquiry_form_questions
  for each row execute function public.set_updated_at();

alter table public.inquiry_form_questions enable row level security;

create policy inquiry_form_questions_all on public.inquiry_form_questions
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.inquiry_form_questions to authenticated;

-- ---- 3. Event-date availability (same source of truth as lib/availability) ---

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
  v_rules public.venue_capacity_rules%rowtype;
  v_event_count integer;
begin
  if p_date is null then
    return true;
  end if;

  -- Hard block: any calendar block covering this date.
  if exists (
    select 1 from public.calendar_blocks cb
    where cb.venue_id = p_venue_id
      and cb.start_date <= p_date
      and cb.end_date >= p_date
  ) then
    return false;
  end if;

  select * into v_rules from public.venue_capacity_rules where venue_id = p_venue_id;
  if not found then
    return true;
  end if;

  select count(*)::integer into v_event_count
  from public.events e
  where e.venue_id = p_venue_id
    and e.event_date = p_date
    and e.status not in ('cancelled');

  if v_event_count >= v_rules.max_simultaneous_events then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.get_available_event_dates(
  p_embed_key text,
  p_start     date,
  p_end       date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_mode     text;
  v_dates    date[] := '{}';
  v_cur      date;
begin
  select id, inquiry_event_date_mode
  into v_venue_id, v_mode
  from public.venues
  where embed_key = p_embed_key;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if v_mode <> 'choose_available' then
    return jsonb_build_object('ok', false, 'error', 'availability_not_enabled');
  end if;

  if p_start is null or p_end is null or p_end < p_start then
    return jsonb_build_object('ok', false, 'error', 'invalid_range');
  end if;

  v_cur := p_start;
  while v_cur <= p_end loop
    if public._is_event_date_available(v_venue_id, v_cur) then
      v_dates := array_append(v_dates, v_cur);
    end if;
    v_cur := v_cur + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'dates', to_jsonb(v_dates)
  );
end;
$$;

grant execute on function public.get_available_event_dates(text, date, date) to anon, authenticated;

-- ---- 4. Public form config lookup -------------------------------------------

create or replace function public.get_public_inquiry_form(p_embed_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue public.venues%rowtype;
  v_questions jsonb;
begin
  select * into v_venue from public.venues where embed_key = p_embed_key;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'questionText', q.question_text,
      'questionType', q.question_type,
      'required', q.required,
      'options', coalesce(q.options, '[]'::jsonb),
      'sortOrder', q.sort_order
    ) order by q.sort_order, q.created_at
  ), '[]'::jsonb)
  into v_questions
  from public.inquiry_form_questions q
  where q.venue_id = v_venue.id;

  return jsonb_build_object(
    'ok', true,
    'venue', jsonb_build_object(
      'id', v_venue.id,
      'name', v_venue.name,
      'logoUrl', v_venue.logo_url,
      'primaryColor', coalesce(v_venue.primary_color, '#5D6F5D'),
      'secondaryColor', coalesce(v_venue.secondary_color, '#4F5F4F'),
      'email', v_venue.email,
      'phone', v_venue.phone,
      'addressLine1', v_venue.address_line1,
      'city', v_venue.city,
      'stateRegion', v_venue.state_region
    ),
    'tourSchedulingEnabled', coalesce(v_venue.tour_scheduling_enabled, false),
    'tourEmbedKey', v_venue.tour_embed_key,
    'inquiryEventDateMode', v_venue.inquiry_event_date_mode,
    'inquiryFormFields', v_venue.inquiry_form_fields,
    'customQuestions', v_questions
  );
end;
$$;

grant execute on function public.get_public_inquiry_form(text) to anon, authenticated;

-- Extend embed-key branding lookup with address for confirmations.
create or replace function public.get_venue_by_embed_key(p_key text)
returns table (
  id              uuid,
  name            text,
  logo_url        text,
  primary_color   text,
  secondary_color text,
  email           text,
  phone           text,
  website         text,
  address_line1   text,
  city            text,
  state_region    text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.id,
    v.name,
    v.logo_url,
    v.primary_color,
    v.secondary_color,
    v.email,
    v.phone,
    v.website,
    v.address_line1,
    v.city,
    v.state_region
  from public.venues v
  where v.embed_key = p_key;
$$;

grant execute on function public.get_venue_by_embed_key(text) to anon, authenticated;

-- ---- 5. create_public_lead — required event type + date availability --------

create or replace function public.create_public_lead(
  p_embed_key        text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_partner_first    text,
  p_partner_last     text,
  p_partner_email    text,
  p_event_type       text,
  p_event_date       date,
  p_guest_count      integer,
  p_estimated_budget numeric,
  p_message          text,
  p_source_data      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_mode     text;
  v_fields   jsonb;
  v_result   jsonb;
  v_merged   jsonb;
begin
  select id, inquiry_event_date_mode, inquiry_form_fields
  into v_venue_id, v_mode, v_fields
  from public.venues
  where embed_key = p_embed_key;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid form key.');
  end if;

  if nullif(trim(p_event_type), '') is null then
    return jsonb_build_object('ok', false, 'error', 'event_type_required');
  end if;

  if v_mode = 'choose_available' and p_event_date is not null
     and not public._is_event_date_available(v_venue_id, p_event_date) then
    return jsonb_build_object('ok', false, 'error', 'date_unavailable');
  end if;

  v_merged := coalesce(p_source_data, '{}'::jsonb)
    || jsonb_build_object(
      'submitted_at', now(),
      'inquiry_mode', coalesce(p_source_data ->> 'inquiry_mode', 'request_information')
    );

  v_result := public.ingest_lead(
    v_venue_id,
    'website',
    jsonb_build_object(
      'firstName', p_first_name, 'lastName', p_last_name,
      'email', p_email, 'phone', p_phone,
      'partnerFirstName', p_partner_first, 'partnerLastName', p_partner_last, 'partnerEmail', p_partner_email,
      'eventType', p_event_type, 'eventDate', p_event_date,
      'guestCount', p_guest_count,
      'estimatedBudget', case when p_estimated_budget > 0 then p_estimated_budget else null end,
      'inquiryMessage', p_message,
      'sourceData', v_merged
    )
  );

  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  return jsonb_build_object('ok', true, 'lead_id', v_result ->> 'leadId');
end;
$$;

-- ---- 6. book_tour — required event type + canonical slot-unavailable error ----

drop function if exists public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text);
drop function if exists public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text);

create or replace function public.book_tour(
  p_embed_key      text,
  p_slot_start     timestamptz,
  p_first_name     text,
  p_last_name      text,
  p_partner_name   text,
  p_email          text,
  p_phone          text,
  p_event_type     text,
  p_event_date     text,
  p_guest_count    integer,
  p_notes          text,
  p_qr_campaign_id text default null,
  p_source_data    jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue        public.venues%rowtype;
  v_slot_end     timestamptz;
  v_result       jsonb;
  v_lead_id      uuid;
  v_appt_id      uuid;
  v_event_date   date;
  v_merged       jsonb;
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if nullif(trim(p_event_type), '') is null then
    return jsonb_build_object('ok', false, 'error', 'event_type_required');
  end if;

  if p_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  if public._is_tour_slot_blocked(v_venue.id, p_slot_start, v_slot_end) then
    return jsonb_build_object('ok', false, 'error', 'slot_unavailable');
  end if;

  v_event_date := nullif(trim(p_event_date), '')::date;
  if v_venue.inquiry_event_date_mode = 'choose_available'
     and v_event_date is not null
     and not public._is_event_date_available(v_venue.id, v_event_date) then
    return jsonb_build_object('ok', false, 'error', 'date_unavailable');
  end if;

  v_merged := coalesce(p_source_data, '{}'::jsonb)
    || jsonb_build_object(
      'booked_at', now(),
      'slot', p_slot_start,
      'inquiry_mode', 'schedule_tour'
    );
  if p_qr_campaign_id is not null then
    v_merged := v_merged || jsonb_build_object('qr_campaign_id', p_qr_campaign_id);
  end if;

  v_result := public.ingest_lead(
    v_venue.id,
    'tour_scheduling',
    jsonb_build_object(
      'firstName', p_first_name, 'lastName', p_last_name,
      'partnerFirstName', p_partner_name,
      'email', p_email, 'phone', p_phone,
      'eventType', p_event_type, 'eventDate', p_event_date,
      'guestCount', p_guest_count,
      'inquiryMessage', p_notes,
      'sourceData', v_merged
    )
  );

  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  v_lead_id := (v_result ->> 'leadId')::uuid;

  insert into public.tour_appointments (
    venue_id, lead_id, scheduled_at, duration_minutes, status,
    contact_name, contact_email, contact_phone,
    event_type, event_date, guest_count, notes
  )
  values (
    v_venue.id, v_lead_id, p_slot_start, v_venue.tour_duration_minutes, 'scheduled',
    trim(p_first_name || ' ' || p_last_name), p_email, p_phone,
    p_event_type, p_event_date, p_guest_count, p_notes
  )
  returning id into v_appt_id;

  return jsonb_build_object(
    'ok', true,
    'appointmentId', v_appt_id,
    'leadId', v_lead_id,
    'relationshipId', v_result ->> 'relationshipId',
    'scheduledAt', p_slot_start,
    'venueName', v_venue.name,
    'venueId', v_venue.id,
    'duration', v_venue.tour_duration_minutes,
    'contactName', trim(p_first_name || ' ' || p_last_name),
    'contactEmail', p_email,
    'contactPhone', p_phone,
    'venuePhone', v_venue.phone,
    'addressLine1', v_venue.address_line1,
    'city', v_venue.city,
    'stateRegion', v_venue.state_region
  );
end;
$$;

grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text, jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
