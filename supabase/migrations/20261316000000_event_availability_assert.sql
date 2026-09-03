-- ============================================================================
-- K.7 Phase 2 — race-safe Event occupancy assert
--
-- Occupancy truth is public.events (status <> 'cancelled'). This function
-- does not insert rows, does not set events.status, does not emit
-- Booking.Confirmed, and does not read calendar_blocks, date_holds, or tours.
--
-- Race safety: pg_advisory_xact_lock is taken on (venue, each protected
-- calendar day) BEFORE reading events. Locks are transaction-scoped.
-- Callers MUST invoke this function in the same Postgres transaction as the
-- events INSERT/UPDATE. A separate PostgREST round trip releases the lock
-- before the write — Phase 3 will compose this into the write RPCs.
--
-- Decisions (locked):
--   4. Missing venue_capacity_rules → effective_max = 1, never unlimited.
--   1. effective_max >= 2 → space_id required; same-space overlap refuses;
--      different spaces allowed up to the cap.
--   2. effective_max >= 2 and zero active Event Spaces → refuse.
--   3. Protect event_date .. coalesce(event_end_date, event_date), same
--      operational window on each day.
-- ============================================================================

create or replace function public.event_operational_window(
  p_setup_time    time,
  p_start_time    time,
  p_end_time      time,
  p_teardown_time time
)
returns table(window_start time, window_end time)
language sql
immutable
parallel safe
as $$
  select
    coalesce(p_setup_time, p_start_time, time '00:00'),
    coalesce(p_teardown_time, p_end_time, time '23:59');
$$;

create or replace function public.assert_event_availability(
  p_venue_id          uuid,
  p_event_date        date,
  p_event_end_date    date default null,
  p_setup_time        time default null,
  p_start_time        time default null,
  p_end_time          time default null,
  p_teardown_time     time default null,
  p_space_id          uuid default null,
  p_exclude_event_id  uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_start date := p_event_date;
  v_end   date := coalesce(p_event_end_date, p_event_date);
  v_day   date;
  v_max   integer;
  v_win_start time;
  v_win_end   time;
  v_e_start   time;
  v_e_end     time;
  v_overlap_count integer := 0;
  v_active_spaces integer;
  v_space_ok boolean;
  v_existing record;
begin
  if p_venue_id is null or p_event_date is null then
    raise exception 'venue_id and event_date are required';
  end if;

  if v_end < v_start then
    v_end := v_start;
  end if;

  -- Serialize occupancy checks per venue-day, in date order, to avoid deadlock.
  v_day := v_start;
  while v_day <= v_end loop
    perform pg_advisory_xact_lock(hashtext(p_venue_id::text), hashtext(v_day::text));
    v_day := v_day + 1;
  end loop;

  select w.window_start, w.window_end
    into v_win_start, v_win_end
  from public.event_operational_window(p_setup_time, p_start_time, p_end_time, p_teardown_time) w;

  select r.max_simultaneous_events into v_max
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  -- Decision 4: missing row (or a non-positive value) is never unlimited.
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;

  if v_max >= 2 then
    select count(*)::integer into v_active_spaces
    from public.venue_spaces s
    where s.venue_id = p_venue_id and s.is_active = true;

    if v_active_spaces = 0 then
      return jsonb_build_object(
        'ok', false, 'code', 'no_spaces',
        'message', 'Add an Event Space in Availability settings before booking. This venue can host more than one event at the same time.'
      );
    end if;

    if p_space_id is null then
      return jsonb_build_object(
        'ok', false, 'code', 'missing_space',
        'message', 'Assign an Event Space before booking. This venue can host more than one event at the same time.'
      );
    end if;

    select exists(
      select 1 from public.venue_spaces s
      where s.venue_id = p_venue_id and s.id = p_space_id
    ) into v_space_ok;
    if not v_space_ok then
      return jsonb_build_object(
        'ok', false, 'code', 'invalid_space',
        'message', 'That Event Space does not belong to this venue.'
      );
    end if;
  end if;

  for v_existing in
    select e.id, e.name, e.space_id, e.event_date, e.event_end_date,
           e.setup_time, e.start_time, e.end_time, e.teardown_time
    from public.events e
    where e.venue_id = p_venue_id
      and e.status is distinct from 'cancelled'
      and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
      and e.event_date <= v_end
      and coalesce(e.event_end_date, e.event_date) >= v_start
  loop
    select w.window_start, w.window_end
      into v_e_start, v_e_end
    from public.event_operational_window(
      v_existing.setup_time, v_existing.start_time,
      v_existing.end_time, v_existing.teardown_time
    ) w;

    if v_win_start < v_e_end and v_e_start < v_win_end then
      v_overlap_count := v_overlap_count + 1;
      if v_max >= 2 and p_space_id is not null
         and v_existing.space_id is not null
         and v_existing.space_id = p_space_id then
        return jsonb_build_object(
          'ok', false, 'code', 'space_overlap',
          'message', 'This space is already booked for "' || coalesce(nullif(trim(v_existing.name), ''), 'another event') || '" at an overlapping time.'
        );
      end if;
    end if;
  end loop;

  if v_overlap_count >= v_max then
    return jsonb_build_object(
      'ok', false, 'code', 'venue_at_capacity',
      'message', case
        when v_max = 1 then 'This date is already booked for an overlapping event.'
        else 'Maximum simultaneous events (' || v_max::text || ') reached for this time.'
      end
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.assert_event_availability(uuid, date, date, time, time, time, time, uuid, uuid) is
  'K.7 Phase 2: assert a dated Event may occupy this venue. Takes per-day advisory locks, then checks operational-window overlap. Must run in the same transaction as the events write.';

grant execute on function public.event_operational_window(time, time, time, time)
  to authenticated, service_role;
grant execute on function public.assert_event_availability(uuid, date, date, time, time, time, time, uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
