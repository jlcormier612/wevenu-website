-- ============================================================================
-- QR Lead Capture — tour-booking attribution follow-up (disclosed gap from
-- the original QR Capture build: the inquiry form threads ?qr= into
-- source_data already; tour booking didn't, since book_tour() builds its
-- own source_data internally and had no parameter to carry it through).
--
-- p_qr_campaign_id is optional (default null) so every existing caller of
-- book_tour keeps working unchanged — this is purely additive.
--
-- Found live while building this, not assumed: adding a trailing default
-- parameter via a plain `create or replace function` does NOT replace the
-- existing 11-arg function in place — it silently creates a second,
-- overloaded 12-arg function alongside it, which then risks "function is
-- not unique" errors on any named-parameter RPC call that only supplies
-- the original 11 arguments (ambiguous between the two overloads,
-- since the 12th argument has a default). The old signature must be
-- dropped explicitly first.
-- ============================================================================

drop function if exists public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text);

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
  p_qr_campaign_id text default null
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

  if public._is_tour_slot_blocked(v_venue.id, p_slot_start, v_slot_end) then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
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
      'sourceData', case
        when p_qr_campaign_id is not null
          then jsonb_build_object('booked_at', now(), 'slot', p_slot_start, 'qr_campaign_id', p_qr_campaign_id)
        else jsonb_build_object('booked_at', now(), 'slot', p_slot_start)
      end
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
    'contactPhone', p_phone
  );
end;
$$;

grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
