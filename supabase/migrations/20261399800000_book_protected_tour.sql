-- ============================================================================
-- Tour Protection — atomic booking after Stripe success.
--
-- Does NOT ingest a second lead. Does NOT add payment columns to
-- tour_appointments. Reuses lock_tour_occupancy_interval + calendar-blocks
-- advisory lock from 202613180 / 202613220. Race: exactly one appointment
-- may win the slot; the loser becomes paid_unbooked.
--
-- Also hardens public book_tour so a client cannot skip protection by calling
-- the RPC directly when the venue requires eligible protection.
-- Staff book_tour_for_lead is unchanged.
-- ============================================================================

create or replace function public.book_protected_tour(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req          public.tour_protection_requests%rowtype;
  v_venue        public.venues%rowtype;
  v_slot_end     timestamptz;
  v_appt_id      uuid;
  v_lead         public.leads%rowtype;
begin
  if p_request_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_request');
  end if;

  select * into v_req
  from public.tour_protection_requests
  where id = p_request_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Idempotent redelivery: already booked.
  if v_req.status = 'completed' and v_req.appointment_id is not null then
    select * into v_venue from public.venues where id = v_req.venue_id;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'status', 'completed',
      'appointmentId', v_req.appointment_id,
      'leadId', v_req.lead_id,
      'scheduledAt', v_req.slot_start,
      'venueId', v_req.venue_id,
      'venueName', v_venue.name,
      'duration', v_venue.tour_duration_minutes,
      'contactName', v_req.contact_name,
      'contactEmail', v_req.contact_email,
      'contactPhone', v_req.contact_phone
    );
  end if;

  if v_req.status = 'paid_unbooked' then
    return jsonb_build_object(
      'ok', false,
      'idempotent', true,
      'error', 'slot_unavailable',
      'status', 'paid_unbooked',
      'leadId', v_req.lead_id,
      'venueId', v_req.venue_id
    );
  end if;

  if v_req.status not in ('pending', 'checkout_open') then
    return jsonb_build_object('ok', false, 'error', 'invalid_state', 'status', v_req.status);
  end if;

  select * into v_venue from public.venues where id = v_req.venue_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_venue');
  end if;

  select * into v_lead from public.leads where id = v_req.lead_id and venue_id = v_req.venue_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'lead_not_found');
  end if;

  v_slot_end := v_req.slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  perform public.lock_tour_occupancy_interval(v_venue.id, v_req.slot_start, v_slot_end);
  perform pg_advisory_xact_lock(hashtext(v_venue.id::text), hashtext('calendar-blocks'));

  if public._is_tour_slot_blocked(v_venue.id, v_req.slot_start, v_slot_end) then
    update public.tour_protection_requests
      set status = 'paid_unbooked',
          completed_at = now()
      where id = v_req.id
        and status in ('pending', 'checkout_open')
        and appointment_id is null;
    return jsonb_build_object(
      'ok', false,
      'error', 'slot_unavailable',
      'status', 'paid_unbooked',
      'leadId', v_req.lead_id,
      'venueId', v_req.venue_id
    );
  end if;

  begin
    insert into public.tour_appointments (
      venue_id, lead_id, scheduled_at, duration_minutes, status,
      contact_name, contact_email, contact_phone,
      event_type, event_date, guest_count, notes,
      protection_request_id
    )
    values (
      v_venue.id, v_req.lead_id, v_req.slot_start, v_venue.tour_duration_minutes, 'scheduled',
      v_req.contact_name, v_req.contact_email, v_req.contact_phone,
      v_req.event_type, v_req.event_date, v_req.guest_count, v_req.notes,
      v_req.id
    )
    returning id into v_appt_id;

    update public.tour_protection_requests
      set status = 'completed',
          appointment_id = v_appt_id,
          completed_at = now()
      where id = v_req.id
        and status in ('pending', 'checkout_open')
        and appointment_id is null;
  exception
    when raise_exception then
      if sqlerrm ilike '%no longer available%' then
        update public.tour_protection_requests
          set status = 'paid_unbooked',
              completed_at = now()
          where id = v_req.id
            and status in ('pending', 'checkout_open')
            and appointment_id is null;
        return jsonb_build_object(
          'ok', false,
          'error', 'slot_unavailable',
          'status', 'paid_unbooked',
          'leadId', v_req.lead_id,
          'venueId', v_req.venue_id
        );
      end if;
      raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'status', 'completed',
    'appointmentId', v_appt_id,
    'leadId', v_req.lead_id,
    'relationshipId', v_lead.relationship_id,
    'scheduledAt', v_req.slot_start,
    'venueId', v_venue.id,
    'venueName', v_venue.name,
    'duration', v_venue.tour_duration_minutes,
    'contactName', v_req.contact_name,
    'contactEmail', v_req.contact_email,
    'contactPhone', v_req.contact_phone,
    'venuePhone', v_venue.phone,
    'addressLine1', v_venue.address_line1,
    'city', v_venue.city,
    'stateRegion', v_venue.state_region
  );
end;
$$;

comment on function public.book_protected_tour(uuid) is
  'Webhook-authoritative protected tour booking. Reuses occupancy + calendar-blocks locks. Idempotent. Losing racer becomes paid_unbooked.';

-- Service role only. Anon/authenticated must not complete protection themselves.
revoke all on function public.book_protected_tour(uuid) from public, anon, authenticated;
grant execute on function public.book_protected_tour(uuid) to service_role;

-- Public book_tour refuses when eligible protection is required so the client
-- cannot skip Stripe. Staff book_tour_for_lead is intentionally unchanged.
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

  if v_venue.tour_protection_mode in ('setup', 'fee')
     and v_venue.stripe_account_id is not null
     and coalesce(v_venue.stripe_charges_enabled, false) = true
     and (
       v_venue.tour_protection_mode = 'setup'
       or (v_venue.tour_protection_mode = 'fee' and v_venue.tour_protection_fee_cents > 0)
     )
  then
    return jsonb_build_object('ok', false, 'error', 'protection_required');
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

grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text, jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
