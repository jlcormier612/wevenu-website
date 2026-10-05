-- Public tour attach to an existing Lead (embed-key venue, not session).
-- Occupancy matches book_tour_for_lead. Does not call ingest_lead.

create or replace function public.book_public_tour_for_lead(
  p_embed_key   text,
  p_lead_id     uuid,
  p_slot_start  timestamptz,
  p_notes       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue     public.venues%rowtype;
  v_lead      public.leads%rowtype;
  v_slot_end  timestamptz;
  v_appt_id   uuid;
begin
  select * into v_venue
  from public.venues
  where tour_embed_key = p_embed_key
    and tour_scheduling_enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  select * into v_lead
  from public.leads
  where id = p_lead_id
    and venue_id = v_venue.id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'lead_not_found');
  end if;

  if lower(coalesce(v_lead.sales_stage, '')) in ('booked', 'lost', 'won', 'cancelled') then
    return jsonb_build_object('ok', false, 'error', 'lead_not_open');
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
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  begin
    insert into public.tour_appointments (
      venue_id, lead_id, scheduled_at, duration_minutes, status,
      contact_name, contact_email, contact_phone,
      event_type, event_date, guest_count, notes
    )
    values (
      v_venue.id, p_lead_id, p_slot_start, v_venue.tour_duration_minutes, 'scheduled',
      trim(v_lead.first_name || ' ' || v_lead.last_name), v_lead.email, v_lead.phone,
      v_lead.event_type, v_lead.event_date::text, v_lead.guest_count, p_notes
    )
    returning id into v_appt_id;
  exception
    when raise_exception then
      if sqlerrm ilike '%no longer available%' then
        return jsonb_build_object('ok', false, 'error', 'slot_taken');
      end if;
      raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'appointmentId', v_appt_id,
    'leadId', p_lead_id,
    'relationshipId', v_lead.relationship_id,
    'scheduledAt', p_slot_start,
    'venueName', v_venue.name,
    'venueId', v_venue.id,
    'duration', v_venue.tour_duration_minutes,
    'contactName', trim(v_lead.first_name || ' ' || v_lead.last_name),
    'contactEmail', v_lead.email,
    'contactPhone', v_lead.phone,
    'venuePhone', v_venue.phone,
    'addressLine1', v_venue.address_line1,
    'city', v_venue.city,
    'stateRegion', v_venue.state_region
  );
end;
$$;

revoke all on function public.book_public_tour_for_lead(text, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.book_public_tour_for_lead(text, uuid, timestamptz, text) to service_role;

notify pgrst, 'reload schema';
