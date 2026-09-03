-- One canonical book_tour signature. A leftover 12-arg overload (pre-source_data)
-- makes 11-argument calls ambiguous and can leave callers hitting the old body.
drop function if exists public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text);

-- book_tour reads venues.inquiry_event_date_mode (added in 20261309). Local
-- incremental availability tests may not have applied that migration.
alter table public.venues
  add column if not exists inquiry_event_date_mode text not null default 'request_preferred';

-- ============================================================================
-- Tour booking atomicity + calendar-block serialization
--
-- book_tour() previously called ingest_lead(), then caught a trigger refusal
-- on tour_appointments INSERT and returned {ok:false} without rolling back the
-- Lead. A concurrent calendar_blocks write could pass the pre-check and fail
-- only at INSERT — leaving an orphan Lead.
--
-- Fix:
--   1. Wrap ingest_lead + appointment INSERT in one PL/pgSQL subtransaction
--      so a "no longer available" refusal rolls back the Lead too.
--   2. Take the venue-wide calendar-blocks advisory lock (same key Events and
--      calendar_blocks writes already use) before evaluating covering blocks,
--      so a concurrent closing block cannot race past the Tour check.
-- ============================================================================

-- Serialize Tour writes with calendar_blocks / Event covering evaluation.
create or replace function public.tour_appointments_enforce_availability()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_end timestamptz;
  v_old_end timestamptz;
  v_occupancy_changed boolean;
  v_restoring boolean;
begin
  if NEW.status = 'cancelled' then
    return NEW;
  end if;

  v_new_end := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval;

  if TG_OP = 'UPDATE' then
    v_occupancy_changed :=
         OLD.scheduled_at is distinct from NEW.scheduled_at
      or OLD.duration_minutes is distinct from NEW.duration_minutes;
    v_restoring := OLD.status = 'cancelled' and NEW.status is distinct from 'cancelled';
    if not v_occupancy_changed and not v_restoring then
      return NEW;
    end if;

    v_old_end := OLD.scheduled_at + (OLD.duration_minutes || ' minutes')::interval;
    perform public.lock_tour_occupancy_interval(
      NEW.venue_id,
      NEW.scheduled_at, v_new_end,
      OLD.scheduled_at, v_old_end
    );
  else
    perform public.lock_tour_occupancy_interval(
      NEW.venue_id,
      NEW.scheduled_at, v_new_end
    );
  end if;

  -- Same venue-wide key as events_enforce_availability / calendar_blocks writes.
  perform pg_advisory_xact_lock(hashtext(NEW.venue_id::text), hashtext('calendar-blocks'));

  if public._is_tour_slot_blocked(
    NEW.venue_id,
    NEW.scheduled_at,
    v_new_end,
    NEW.id
  ) then
    raise exception 'This tour time is no longer available.'
      using errcode = 'P0001',
            hint = 'tour_at_capacity';
  end if;

  return NEW;
end;
$$;

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

create or replace function public.book_tour_for_lead(
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
  v_venue_id  uuid := public.current_user_venue_id();
  v_venue     public.venues%rowtype;
  v_lead      public.leads%rowtype;
  v_slot_end  timestamptz;
  v_appt_id   uuid;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_venue from public.venues where id = v_venue_id;
  select * into v_lead from public.leads where id = p_lead_id and venue_id = v_venue_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'lead_not_found');
  end if;

  if p_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  perform public.lock_tour_occupancy_interval(v_venue_id, p_slot_start, v_slot_end);
  perform pg_advisory_xact_lock(hashtext(v_venue_id::text), hashtext('calendar-blocks'));

  if public._is_tour_slot_blocked(v_venue_id, p_slot_start, v_slot_end) then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  begin
    insert into public.tour_appointments (
      venue_id, lead_id, scheduled_at, duration_minutes, status,
      contact_name, contact_email, contact_phone,
      event_type, event_date, guest_count, notes
    )
    values (
      v_venue_id, p_lead_id, p_slot_start, v_venue.tour_duration_minutes, 'scheduled',
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
    'venueId', v_venue_id,
    'duration', v_venue.tour_duration_minutes,
    'contactName', trim(v_lead.first_name || ' ' || v_lead.last_name),
    'contactEmail', v_lead.email,
    'contactPhone', v_lead.phone
  );
end;
$$;

create or replace function public.reschedule_tour(
  p_appointment_id  uuid,
  p_new_slot_start  timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id   uuid := public.current_user_venue_id();
  v_venue      public.venues%rowtype;
  v_appt       public.tour_appointments%rowtype;
  v_slot_end   timestamptz;
  v_old_end    timestamptz;
  v_old_start  timestamptz;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_appt from public.tour_appointments where id = p_appointment_id and venue_id = v_venue_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_appt.status in ('cancelled', 'completed', 'no_show') then
    return jsonb_build_object('ok', false, 'error', 'not_reschedulable');
  end if;

  select * into v_venue from public.venues where id = v_venue_id;

  if p_new_slot_start < now() + (v_venue.tour_min_notice_hours || ' hours')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_soon');
  end if;
  if p_new_slot_start > now() + (v_venue.tour_max_advance_days || ' days')::interval then
    return jsonb_build_object('ok', false, 'error', 'slot_too_far');
  end if;

  v_slot_end := p_new_slot_start + (v_appt.duration_minutes || ' minutes')::interval;
  v_old_end := v_appt.scheduled_at + (v_appt.duration_minutes || ' minutes')::interval;

  perform public.lock_tour_occupancy_interval(
    v_venue_id,
    p_new_slot_start, v_slot_end,
    v_appt.scheduled_at, v_old_end
  );
  perform pg_advisory_xact_lock(hashtext(v_venue_id::text), hashtext('calendar-blocks'));

  if public._is_tour_slot_blocked(v_venue_id, p_new_slot_start, v_slot_end, p_appointment_id) then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end if;

  v_old_start := v_appt.scheduled_at;

  begin
    update public.tour_appointments
      set scheduled_at = p_new_slot_start, status = 'scheduled', confirmed_at = null, updated_at = now()
      where id = p_appointment_id;
  exception
    when raise_exception then
      if sqlerrm ilike '%no longer available%' then
        return jsonb_build_object('ok', false, 'error', 'slot_taken');
      end if;
      raise;
  end;

  return jsonb_build_object(
    'ok', true, 'appointmentId', p_appointment_id, 'leadId', v_appt.lead_id,
    'oldScheduledAt', v_old_start, 'scheduledAt', p_new_slot_start,
    'venueName', v_venue.name, 'venueId', v_venue_id, 'duration', v_appt.duration_minutes,
    'contactName', v_appt.contact_name, 'contactEmail', v_appt.contact_email, 'contactPhone', v_appt.contact_phone
  );
end;
$$;

comment on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text, jsonb) is
  'Public Tour booking. Lead + appointment are atomic; calendar-blocks lock serializes covering evaluation.';
comment on function public.tour_appointments_enforce_availability() is
  'Lock Tour occupancy + calendar-blocks, then re-check capacity/Event window/closing blocks before write.';

grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text, jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
