-- ============================================================================
-- K.7 Phase 4 — Tour capacity enforcement
--
-- Tours are not Events. This migration does not change Event occupancy,
-- max_simultaneous_events, Event Spaces, or the Phase 3 events trigger.
--
-- Capacity authority: venue_capacity_rules.max_simultaneous_tours.
-- Missing rules row / null / non-positive → 1 (column default, UI default,
-- and the same "never unlimited" treatment Events use). Check constraint
-- on the column is >= 1; the missing-row case is the one that used to
-- skip the Tour check entirely.
--
-- Occupancy truth: tour_appointments whose status is distinct from
-- 'cancelled'. completed and no_show still occupy — that is the existing
-- _is_tour_slot_blocked semantics (only cancelled was excluded).
--
-- Overlap: scheduled_at < other_end AND other_start < scheduled_at + duration
-- (interval, not date-only). Touching endpoints do not overlap.
--
-- Closures:
--   - a non-cancelled Event whose operational window (setup/start →
--     end/teardown, Phase 2 event_operational_window) overlaps the Tour
--     interval on a protected Event day. Missing Event times occupy
--     00:00–23:59. Touching endpoints do not overlap. Date-only Event-day
--     blocking is not the rule.
--   - calendar_blocks of type blocked_time / wedding_event_booking / private_event
--   - tour_availability_exceptions covering that date
-- Events do not count toward max_simultaneous_tours. Tours do not count
-- toward Event occupancy.
--
-- Windows: write-time re-check that the slot fits a tour_availability_windows
-- row, using the same UTC wall-clock construction as _generate_tour_slots.
-- Buffer remains a slot-generation step (duration + buffer), not an overlap
-- widening — existing conflict math is duration-only.
--
-- Race safety: BEFORE INSERT/UPDATE trigger locks venue+UTC-day advisory
-- keys, then re-checks. RPCs lock the same keys before their pre-check so
-- the check and the write share one transaction. Slot generation does not
-- take these locks.
-- ============================================================================

create or replace function public._tour_effective_max_simultaneous(p_venue_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max integer;
begin
  select r.max_simultaneous_tours into v_max
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_max is null or v_max < 1 then
    return 1;
  end if;
  return v_max;
end;
$$;

create or replace function public._tour_slot_fits_window(
  p_venue_id   uuid,
  p_slot_start timestamptz,
  p_slot_end   timestamptz
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start_local timestamp;
  v_end_local   timestamp;
begin
  -- Match _generate_tour_slots: window clock is UTC wall time on the
  -- cursor date, not the session TimeZone.
  v_start_local := p_slot_start at time zone 'UTC';
  v_end_local   := p_slot_end at time zone 'UTC';
  if v_start_local::date is distinct from v_end_local::date then
    return false;
  end if;
  return exists (
    select 1
    from public.tour_availability_windows w
    where w.venue_id = p_venue_id
      and w.day_of_week = extract(dow from v_start_local)::smallint
      and v_start_local::time >= w.start_time
      and v_end_local::time <= w.end_time
  );
end;
$$;

create or replace function public._tour_occupancy_utc_days(
  p_start timestamptz,
  p_end   timestamptz
)
returns date[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_first date;
  v_last  date;
  v_end   timestamptz;
begin
  if p_start is null then
    return '{}';
  end if;
  v_end := coalesce(p_end, p_start);
  v_first := (p_start at time zone 'UTC')::date;
  if v_end > p_start then
    v_last := ((v_end - interval '1 microsecond') at time zone 'UTC')::date;
  else
    v_last := v_first;
  end if;
  if v_last < v_first then
    v_last := v_first;
  end if;
  return array(
    select generate_series(v_first, v_last, interval '1 day')::date
  );
end;
$$;

-- Lock UTC dates covered by one or two occupancy intervals, ascending, so
-- reschedule of A→B and B→A cannot deadlock. Keys are namespaced with
-- 'tour-avail:' so they never collide with Event occupancy locks.
create or replace function public.lock_tour_occupancy_interval(
  p_venue_id uuid,
  p_start    timestamptz,
  p_end      timestamptz,
  p_start_2  timestamptz default null,
  p_end_2    timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_day date;
  v_days date[] := '{}';
begin
  if p_venue_id is null or p_start is null then
    return;
  end if;

  v_days := v_days || public._tour_occupancy_utc_days(p_start, p_end);
  if p_start_2 is not null then
    v_days := v_days || public._tour_occupancy_utc_days(p_start_2, p_end_2);
  end if;

  for v_day in
    select distinct d from unnest(v_days) as d order by d
  loop
    perform pg_advisory_xact_lock(
      hashtext('tour-avail:' || p_venue_id::text),
      hashtext(v_day::text)
    );
  end loop;
end;
$$;

create or replace function public._is_tour_slot_blocked(
  p_venue_id                uuid,
  p_slot_start              timestamptz,
  p_slot_end                timestamptz,
  p_exclude_appointment_id  uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocked boolean;
  v_count   integer;
  v_max     integer;
begin
  if not public._tour_slot_fits_window(p_venue_id, p_slot_start, p_slot_end) then
    return true;
  end if;

  v_max := public._tour_effective_max_simultaneous(p_venue_id);
  select count(*)::integer into v_count
  from public.tour_appointments ta
  where ta.venue_id = p_venue_id
    and ta.status is distinct from 'cancelled'
    and (p_exclude_appointment_id is null or ta.id is distinct from p_exclude_appointment_id)
    and ta.scheduled_at < p_slot_end
    and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > p_slot_start;
  if v_count >= v_max then
    return true;
  end if;

  -- Event operational-window overlap (Phase 2 event_operational_window).
  -- Does not consume max_simultaneous_tours.
  select exists(
    select 1
    from public.events e
    cross join lateral public.event_operational_window(
      e.setup_time, e.start_time, e.end_time, e.teardown_time
    ) w
    cross join lateral generate_series(
      e.event_date,
      coalesce(e.event_end_date, e.event_date),
      interval '1 day'
    ) as g(day)
    where e.venue_id = p_venue_id
      and e.status is distinct from 'cancelled'
      and (p_slot_start at time zone 'UTC') < ((g.day)::date + w.window_end)
      and ((g.day)::date + w.window_start) < (p_slot_end at time zone 'UTC')
  ) into v_blocked;
  if v_blocked then return true; end if;

  select exists(
    select 1 from public.calendar_blocks cb
    where cb.venue_id = p_venue_id
      and cb.type in ('blocked_time', 'wedding_event_booking', 'private_event')
      and cb.start_date <= p_slot_start::date
      and cb.end_date   >= p_slot_start::date
  ) into v_blocked;
  if v_blocked then return true; end if;

  select exists(
    select 1 from public.tour_availability_exceptions tae
    where tae.venue_id = p_venue_id
      and tae.start_date <= p_slot_start::date
      and tae.end_date   >= p_slot_start::date
  ) into v_blocked;
  return v_blocked;
end;
$$;

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

drop trigger if exists tour_appointments_enforce_availability_ins on public.tour_appointments;
create trigger tour_appointments_enforce_availability_ins
  before insert on public.tour_appointments
  for each row
  execute function public.tour_appointments_enforce_availability();

drop trigger if exists tour_appointments_enforce_availability_upd on public.tour_appointments;
create trigger tour_appointments_enforce_availability_upd
  before update of scheduled_at, duration_minutes, status
  on public.tour_appointments
  for each row
  when (
       OLD.scheduled_at is distinct from NEW.scheduled_at
    or OLD.duration_minutes is distinct from NEW.duration_minutes
    or OLD.status is distinct from NEW.status
  )
  execute function public.tour_appointments_enforce_availability();

comment on function public._tour_effective_max_simultaneous(uuid) is
  'K.7 Phase 4: max_simultaneous_tours, or 1 when the rules row is missing/non-positive.';
comment on function public.lock_tour_occupancy_interval(uuid, timestamptz, timestamptz, timestamptz, timestamptz) is
  'K.7 Phase 4: transaction-scoped advisory locks for Tour occupancy days, namespaced apart from Events.';
comment on function public.tour_appointments_enforce_availability() is
  'K.7 Phase 4: lock + Tour window/exception/capacity/Event-operational-window check in the same transaction as the write.';

-- ---- Write RPCs: lock before the canonical check, same transaction as INSERT/UPDATE

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

  begin
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

grant execute on function public.book_tour(text, timestamptz, text, text, text, text, text, text, text, integer, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.lock_tour_occupancy_interval(uuid, timestamptz, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public._tour_occupancy_utc_days(timestamptz, timestamptz) to authenticated, service_role;

notify pgrst, 'reload schema';
