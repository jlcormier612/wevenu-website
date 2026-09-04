-- ============================================================================
-- book_tour: enforce venue accepted event types (mirror create_public_lead).
-- Preserves advisory locks + lead/appointment subtransaction from
-- 20261322000000_tour_booking_atomicity.sql. Depends on normalize_event_type
-- from 20261330000000_canonical_event_types.sql.
-- ============================================================================

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
  v_type         text;
  v_accepted     text[];
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  v_type := public.normalize_event_type(p_event_type);
  if v_type is null then
    return jsonb_build_object('ok', false, 'error', 'event_type_required');
  end if;

  v_accepted := v_venue.accepted_inquiry_event_types;
  if v_accepted is null or array_length(v_accepted, 1) is null then
    v_accepted := array['wedding','corporate','social_event','birthday','other']::text[];
  end if;
  if not (v_type = any (v_accepted)) then
    return jsonb_build_object('ok', false, 'error', 'event_type_not_accepted');
  end if;

  if p_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  perform public.lock_tour_occupancy_interval(v_venue.id, p_slot_start, v_slot_end);
  perform pg_advisory_xact_lock(hashtext(v_venue.id::text), hashtext('calendar-blocks'));

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

  -- Lead + appointment share one subtransaction. A trigger refusal on the
  -- appointment rolls back ingest_lead as well — no orphan Lead.
  begin
    v_result := public.ingest_lead(
      v_venue.id,
      'tour_scheduling',
      jsonb_build_object(
        'firstName', p_first_name, 'lastName', p_last_name,
        'partnerFirstName', p_partner_name,
        'email', p_email, 'phone', p_phone,
        'eventType', v_type, 'eventDate', p_event_date,
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
      v_type, p_event_date, p_guest_count, p_notes
    )
    returning id into v_appt_id;
  exception
    when raise_exception then
      if sqlerrm ilike '%no longer available%' then
        return jsonb_build_object('ok', false, 'error', 'slot_unavailable');
      end if;
      raise;
  end;

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

grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
