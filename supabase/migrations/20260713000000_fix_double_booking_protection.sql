-- ============================================================================
-- Fix: Double-booking protection — calendar blocks must be enforced everywhere
--
-- Problem: calendar_blocks were advisory only.
--   1. get_tour_slots did not check calendar_blocks → blocked dates appeared
--      available in the public tour booking flow.
--   2. book_tour race-condition guard did not check calendar_blocks.
--
-- Fix: Both functions now treat calendar_blocks as hard exclusions.
--   A venue's administrative block on a date means ZERO public availability.
-- ============================================================================

-- ── get_tour_slots (rewritten with calendar block guard) ─────────────────────

create or replace function public.get_tour_slots(
  p_embed_key  text,
  p_start_date date,
  p_end_date   date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue        public.venues%rowtype;
  v_slots        jsonb := '[]'::jsonb;
  v_cursor_date  date;
  v_dow          smallint;
  v_bh           record;
  v_slot_start   timestamptz;
  v_slot_end     timestamptz;
  v_has_conflict boolean;
  v_now          timestamptz := now();
  v_min_start    timestamptz;
  v_max_start    timestamptz;
  v_step         interval;
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('error', 'invalid_key');
  end if;

  v_min_start := v_now + (v_venue.tour_min_notice_hours || ' hours')::interval;
  v_max_start := v_now + (v_venue.tour_max_advance_days || ' days')::interval;
  v_step      := ((v_venue.tour_duration_minutes + v_venue.tour_buffer_minutes) || ' minutes')::interval;

  if p_start_date::timestamptz < v_min_start then
    v_cursor_date := v_min_start::date;
  else
    v_cursor_date := p_start_date;
  end if;

  while v_cursor_date <= p_end_date
    and v_cursor_date::timestamptz <= v_max_start
  loop

    -- ── Hard guard: skip any date covered by a calendar block ────────────────
    select exists(
      select 1 from public.calendar_blocks cb
      where cb.venue_id  = v_venue.id
        and cb.start_date <= v_cursor_date
        and cb.end_date   >= v_cursor_date
    ) into v_has_conflict;

    if v_has_conflict then
      v_cursor_date := v_cursor_date + 1;
      continue;
    end if;

    -- ── Hard guard: skip if a non-cancelled event is already on this date ────
    select exists(
      select 1 from public.events e
      where e.venue_id   = v_venue.id
        and e.event_date = v_cursor_date
        and e.status not in ('cancelled')
    ) into v_has_conflict;

    if v_has_conflict then
      v_cursor_date := v_cursor_date + 1;
      continue;
    end if;

    v_dow := extract(dow from v_cursor_date)::smallint;

    select * into v_bh
    from public.venue_business_hours
    where venue_id   = v_venue.id
      and day_of_week = v_dow
      and is_open     = true;

    if found then
      v_slot_start := (v_cursor_date::text || ' ' || v_bh.open_time::text || ' UTC')::timestamptz;

      while v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval
              <= (v_cursor_date::text || ' ' || v_bh.close_time::text || ' UTC')::timestamptz
      loop
        v_slot_end := v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

        if v_slot_start >= v_min_start and v_slot_start <= v_max_start then
          -- Check conflict: tour appointment overlap
          select exists(
            select 1 from public.tour_appointments ta
            where ta.venue_id = v_venue.id
              and ta.status not in ('cancelled')
              and ta.scheduled_at < v_slot_end
              and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > v_slot_start
          ) into v_has_conflict;

          if not v_has_conflict then
            v_slots := v_slots || jsonb_build_object(
              'start', v_slot_start,
              'end',   v_slot_end,
              'date',  v_cursor_date,
              'time',  to_char(v_slot_start at time zone 'UTC', 'HH12:MI AM')
            );
          end if;
        end if;

        v_slot_start := v_slot_start + v_step;
      end loop;
    end if;

    v_cursor_date := v_cursor_date + 1;
  end loop;

  return jsonb_build_object(
    'slots', v_slots,
    'venue', jsonb_build_object(
      'name',        v_venue.name,
      'headline',    v_venue.tour_page_headline,
      'description', v_venue.tour_page_description,
      'duration',    v_venue.tour_duration_minutes
    )
  );
end;
$$;

-- ── book_tour (rewritten with calendar block guard in race-condition check) ──

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

  -- All guards passed — create lead + appointment
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

-- Grants are unchanged — anon + authenticated can call both
grant execute on function public.get_tour_slots(text, date, date) to anon, authenticated;
grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text) to anon, authenticated;

notify pgrst, 'reload schema';
