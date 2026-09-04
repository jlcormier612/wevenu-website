-- ============================================================================
-- Bring My Existing Business — foundational cutover
--
-- Availability is never silently bypassed.
-- Past Events may land as existing Event status 'complete' after an explicit
-- human review ("Import as historical record — will not affect future
-- availability"). Live/future Events still run full occupancy + blocks.
--
-- Past Tours land as existing status 'completed' and are excluded from live
-- tour occupancy. Future Tours still enforce capacity and calendar blocks.
-- ============================================================================

-- Idempotent vocabulary assertion: always the full current entity set so
-- local/db-test re-application of this foundational cutover file never
-- narrows the check after later migrations (guest_list, timeline_entry,
-- floor_plan, …) have expanded it.
do $$
begin
  if to_regclass('public.migration_records') is null then
    return;
  end if;
  alter table public.migration_records
    drop constraint if exists migration_records_target_entity_type_check;
  alter table public.migration_records
    add constraint migration_records_target_entity_type_check
    check (target_entity_type in (
      'client', 'lead', 'vendor', 'event', 'payment', 'document',
      'calendar_block', 'date_hold', 'tour', 'package', 'key_date',
      'active_commitment',
      'guest_list',
      'event_vendor_assignment',
      'timeline_entry',
      'floor_plan'
    ));
end;
$$;

-- Latest events_enforce_availability (20261321) + explicit historical INSERT skip.
-- Historical = status 'complete' AND event_date in the past. Live writes never
-- insert as complete. Occupancy UPDATE still enforces.
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
  v_prot_start date;
  v_prot_end date;
  v_block_title text;
  v_win_start time;
  v_win_end time;
begin
  if NEW.status = 'cancelled' then
    return NEW;
  end if;

  if TG_OP = 'INSERT'
     and NEW.status = 'complete'
     and NEW.event_date < (timezone('utc', now()))::date then
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
    if not v_occupancy_changed and not v_restoring then
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

  return NEW;
end;
$$;

comment on function public.events_enforce_availability() is
  'Occupancy + covering calendar blocks on Event INSERT/UPDATE. INSERT of status=complete with a past event_date is the reviewed historical-record path and does not occupy live availability. Future Events always enforce.';

create or replace function public.create_client_and_event_with_availability(
  payload jsonb,
  p_event jsonb,
  p_venue_id_override uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_client_id uuid;
  v_venue_id uuid;
  v_event_id uuid;
  v_event_date date;
  v_event_end date;
  v_name text;
  v_status text := 'draft';
begin
  v_name := nullif(trim(p_event ->> 'name'), '');
  v_event_date := nullif(p_event ->> 'eventDate', '')::date;
  if v_name is null or v_event_date is null then
    raise exception 'event name and event date are required';
  end if;
  v_event_end := nullif(p_event ->> 'eventEndDate', '')::date;
  if v_event_end is not null and v_event_end = v_event_date then
    v_event_end := null;
  end if;

  -- Only the explicit reviewed historical outcome stamps complete, and only
  -- for past dates. Future Events cannot use this to skip enforcement.
  if coalesce(p_event ->> 'status', '') = 'complete'
     and v_event_date < (timezone('utc', now()))::date then
    v_status := 'complete';
  end if;

  v_client_id := public.create_client_atomic(payload, p_venue_id_override);

  select c.venue_id into v_venue_id
  from public.clients c
  where c.id = v_client_id;

  insert into public.events (
    venue_id, client_id, space_id, name, event_type,
    event_date, event_end_date, start_time, end_time, setup_time, teardown_time, guest_count,
    status
  ) values (
    v_venue_id,
    v_client_id,
    nullif(trim(p_event ->> 'spaceId'), '')::uuid,
    v_name,
    nullif(p_event ->> 'eventType', ''),
    v_event_date,
    v_event_end,
    nullif(p_event ->> 'startTime', '')::time,
    nullif(p_event ->> 'endTime', '')::time,
    nullif(p_event ->> 'setupTime', '')::time,
    nullif(p_event ->> 'teardownTime', '')::time,
    nullif(regexp_replace(coalesce(p_event ->> 'guestCount', ''), '[^0-9]', '', 'g'), '')::integer,
    v_status
  )
  returning id into v_event_id;

  return jsonb_build_object('ok', true, 'client_id', v_client_id, 'event_id', v_event_id);
end;
$$;

comment on function public.create_client_and_event_with_availability(jsonb, jsonb, uuid) is
  'Client + dated Event in one transaction. p_event.status=complete is honored only for past dates (reviewed historical record).';

-- Completed/no-show Tours do not consume live/future tour capacity.
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
  v_tz      text;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  if not public._tour_slot_fits_window(p_venue_id, p_slot_start, p_slot_end) then
    return true;
  end if;

  v_max := public._tour_effective_max_simultaneous(p_venue_id);
  select count(*)::integer into v_count
  from public.tour_appointments ta
  where ta.venue_id = p_venue_id
    and ta.status in ('scheduled', 'confirmed')
    and (p_exclude_appointment_id is null or ta.id is distinct from p_exclude_appointment_id)
    and ta.scheduled_at < p_slot_end
    and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > p_slot_start;
  if v_count >= v_max then
    return true;
  end if;

  v_tz := public._venue_scheduling_timezone(p_venue_id);
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
      and e.status is distinct from 'complete'
      and p_slot_start < ((g.day)::date + w.window_end) at time zone v_tz
      and ((g.day)::date + w.window_start) at time zone v_tz < p_slot_end
  ) into v_blocked;
  if v_blocked then return true; end if;

  v_local_start := p_slot_start at time zone v_tz;
  v_local_end := p_slot_end at time zone v_tz;
  if public.covering_calendar_block_title(
    p_venue_id,
    v_local_start::date,
    v_local_start::date,
    v_local_start::time,
    v_local_end::time,
    array['blocked_time', 'wedding_event_booking', 'private_event']::text[]
  ) is not null then
    return true;
  end if;

  select exists(
    select 1 from public.tour_availability_exceptions tae
    where tae.venue_id = p_venue_id
      and tae.start_date <= (p_slot_start at time zone v_tz)::date
      and tae.end_date   >= (p_slot_start at time zone v_tz)::date
  ) into v_blocked;
  return v_blocked;
end;
$$;

comment on function public._is_tour_slot_blocked(uuid, timestamptz, timestamptz, uuid) is
  'Tour slot blocked: window fit, live scheduled/confirmed occupancy, non-complete Events, closing calendar blocks, exceptions. Completed/no-show/cancelled Tours do not consume capacity.';

-- Latest tour trigger (20261322) + INSERT skip for completed/no_show (historical).
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

  if TG_OP = 'INSERT' and NEW.status in ('completed', 'no_show') then
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

create or replace function public.book_tour_for_migration(
  p_venue_id    uuid,
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
  v_venue_id  uuid;
  v_venue     public.venues%rowtype;
  v_lead      public.leads%rowtype;
  v_slot_end  timestamptz;
  v_appt_id   uuid;
  v_status    text := 'scheduled';
begin
  if auth.role() = 'service_role' then
    v_venue_id := p_venue_id;
  else
    v_venue_id := public.current_user_venue_id();
    if v_venue_id is null or v_venue_id is distinct from p_venue_id then
      return jsonb_build_object('ok', false, 'error', 'unauthorized');
    end if;
  end if;

  select * into v_venue from public.venues where id = v_venue_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_lead from public.leads where id = p_lead_id and venue_id = v_venue_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'lead_not_found');
  end if;

  if p_slot_start < now() then
    v_status := 'completed';
  end if;

  v_slot_end := p_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

  if v_status = 'scheduled' then
    perform public.lock_tour_occupancy_interval(v_venue_id, p_slot_start, v_slot_end);
    perform pg_advisory_xact_lock(hashtext(v_venue_id::text), hashtext('calendar-blocks'));
    if public._is_tour_slot_blocked(v_venue_id, p_slot_start, v_slot_end) then
      return jsonb_build_object('ok', false, 'error', 'slot_taken');
    end if;
  end if;

  begin
    insert into public.tour_appointments (
      venue_id, lead_id, scheduled_at, duration_minutes, status,
      contact_name, contact_email, contact_phone,
      event_type, event_date, guest_count, notes,
      completed_at
    )
    values (
      v_venue_id, p_lead_id, p_slot_start, v_venue.tour_duration_minutes, v_status,
      trim(v_lead.first_name || ' ' || v_lead.last_name), v_lead.email, v_lead.phone,
      v_lead.event_type, v_lead.event_date::text, v_lead.guest_count, p_notes,
      case when v_status = 'completed' then p_slot_start else null end
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
    'status', v_status
  );
end;
$$;

comment on function public.book_tour_for_migration(uuid, uuid, timestamptz, text) is
  'Cutover tours: past slots insert as completed (no live capacity). Future slots still enforce capacity and calendar blocks. Notice/advance windows are not applied.';

grant execute on function public.book_tour_for_migration(uuid, uuid, timestamptz, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';
