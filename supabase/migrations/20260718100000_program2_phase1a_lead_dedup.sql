-- ============================================================================
-- Program 2, Phase 1a — Canonical Lead lifecycle across entry points
--
-- create_public_lead() (inquiry form) and book_tour() (public tour widget)
-- each unconditionally inserted a new leads row with zero lookup against
-- existing leads — the same person contacting the venue through both
-- channels became two disconnected Lead records, each with independent
-- notes/tasks/scores. find_lead_by_email() is the shared match, used by
-- both RPCs: match by email within the same venue (the reliable signal),
-- attach the new interaction to the existing lead, and only create a new
-- one when no match exists.
-- ============================================================================

create or replace function public.find_lead_by_email(p_venue_id uuid, p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.leads
  where venue_id = p_venue_id
    and email is not null
    and lower(email) = lower(nullif(trim(p_email), ''))
  order by created_at asc
  limit 1
$$;

grant execute on function public.find_lead_by_email(uuid, text) to anon, authenticated;

-- ---- create_public_lead: match-or-create instead of unconditional insert ----

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
  v_venue_id   uuid;
  v_lead_id    uuid;
  v_ref        text;
  v_is_new     boolean;
begin
  -- Validate embed_key → venue_id
  select id into v_venue_id
  from public.venues
  where embed_key = p_embed_key;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid form key.');
  end if;

  -- Program 2 Phase 1a: match an existing lead by email first, regardless
  -- of entry point, rather than always creating a new record.
  if nullif(trim(p_email), '') is not null then
    v_lead_id := public.find_lead_by_email(v_venue_id, p_email);
  end if;
  v_is_new := v_lead_id is null;

  if v_is_new then
    insert into public.leads (
      venue_id, status, source, first_name, last_name,
      email, phone, partner_first_name, partner_last_name, partner_email,
      event_type, event_date, guest_count, estimated_budget,
      inquiry_message, inquiry_date, source_data
    ) values (
      v_venue_id, 'new', 'website_form', p_first_name, p_last_name,
      p_email, p_phone, nullif(p_partner_first, ''), nullif(p_partner_last, ''), nullif(p_partner_email, ''),
      nullif(p_event_type, ''), p_event_date, p_guest_count,
      case when p_estimated_budget > 0 then p_estimated_budget else null end,
      nullif(p_message, ''), now(),
      p_source_data || jsonb_build_object('submitted_at', now())
    )
    returning id into v_lead_id;
  end if;

  -- Reference code: first 8 chars of the lead ID (uppercase) for confirmation display
  v_ref := upper(left(replace(v_lead_id::text, '-', ''), 8));

  -- Activity log entry — always recorded, worded differently for a
  -- returning contact so the coordinator sees the full interaction history
  -- on one lead rather than two disconnected records.
  insert into public.lead_activities (
    venue_id, lead_id, type, title, description
  ) values (
    v_venue_id, v_lead_id,
    'inquiry_received',
    case when v_is_new then 'Inquiry received via website form' else 'New inquiry from returning contact (website form)' end,
    'Submitted by ' || p_first_name || ' ' || p_last_name ||
    case when p_email != '' then ' (' || p_email || ')' else '' end
  );

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'reference_code', v_ref
  );
end;
$$;

-- ---- book_tour: match-or-create for the lead, always create the appointment

create or replace function public.book_tour(
  p_embed_key    text,
  p_slot_start   timestamptz,
  p_first_name   text,
  p_last_name    text,
  p_partner_name text,
  p_email        text,
  p_phone        text,
  p_event_type   text,
  p_event_date   text,
  p_guest_count  integer,
  p_notes        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue        public.venues%rowtype;
  v_slot_end     timestamptz;
  v_has_conflict boolean;
  v_lead_id      uuid;
  v_appt_id      uuid;
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if p_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  -- ── Race-condition guard 1: tour appointment overlap ────────────────────────
  select exists(
    select 1 from public.tour_appointments ta
    where ta.venue_id = v_venue.id
      and ta.status not in ('cancelled')
      and ta.scheduled_at < v_slot_end
      and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > p_slot_start
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  -- ── Race-condition guard 2: calendar block ───────────────────────────────────
  -- Must be checked last-moment in case a block was added between get_tour_slots
  -- and the actual booking request.
  select exists(
    select 1 from public.calendar_blocks cb
    where cb.venue_id  = v_venue.id
      and cb.start_date <= p_slot_start::date
      and cb.end_date   >= p_slot_start::date
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'date_blocked');
  end if;

  -- ── Race-condition guard 3: event on this date ───────────────────────────────
  select exists(
    select 1 from public.events e
    where e.venue_id   = v_venue.id
      and e.event_date = p_slot_start::date
      and e.status not in ('cancelled')
  ) into v_has_conflict;

  if v_has_conflict then
    return jsonb_build_object('ok', false, 'error', 'date_booked');
  end if;

  -- Program 2 Phase 1a: match an existing lead by email first, regardless
  -- of entry point, rather than always creating a new record.
  if nullif(trim(p_email), '') is not null then
    v_lead_id := public.find_lead_by_email(v_venue.id, p_email);
  end if;

  if v_lead_id is null then
    insert into public.leads (
      venue_id, first_name, last_name, partner_first_name,
      email, phone, event_type, event_date, guest_count,
      status, source, source_data
    )
    values (
      v_venue.id, p_first_name, p_last_name, nullif(p_partner_name, ''),
      p_email, nullif(p_phone, ''), nullif(p_event_type, ''),
      nullif(p_event_date, '')::date, p_guest_count,
      'new', 'tour_scheduling', jsonb_build_object('booked_at', now(), 'slot', p_slot_start)
    )
    returning id into v_lead_id;
  else
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (
      v_venue.id, v_lead_id, 'tour_scheduled', 'Tour booked (returning contact)',
      'Booked a tour through the public widget as an existing lead.'
    );
  end if;

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
    'ok',            true,
    'leadId',        v_lead_id,
    'appointmentId', v_appt_id,
    'scheduledAt',   p_slot_start,
    'venueName',     v_venue.name,
    'duration',      v_venue.tour_duration_minutes
  );
end;
$$;

grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text) to anon, authenticated;
