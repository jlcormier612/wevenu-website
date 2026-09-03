-- ============================================================================
-- Availability correction pass
--
-- 1. evaluate_event_availability: occupancy rules without write locks so
--    inquiry date checks reuse the same authority as Event writes.
-- 2. assert_event_availability locks, then calls evaluate.
-- 3. _is_event_date_available uses evaluate (date-only Event = full day)
--    plus the existing calendar_blocks covering-date check.
-- 4. Event writes re-check covering calendar_blocks after occupancy locks.
--    calendar_blocks writes take the same occupancy day locks so a committed
--    block cannot be raced past by an Event insert.
-- 5. Event→Tour / weekly windows / slot generation use venues.timezone
--    (venue-local wall-clock), matching Relationship Tours and Calendar.
-- ============================================================================

create or replace function public.evaluate_event_availability(
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
stable
security invoker
set search_path = public
as $$
declare
  v_start date := p_event_date;
  v_end   date := coalesce(p_event_end_date, p_event_date);
  v_look_start date;
  v_look_end   date;
  v_max   integer;
  v_turnaround numeric;
  v_extra integer := 0;
  v_win_start time;
  v_win_end   time;
  v_e_start   time;
  v_e_end     time;
  v_overlap_count integer := 0;
  v_active_spaces integer;
  v_space_ok boolean;
  v_existing record;
  v_ex_start date;
  v_ex_end   date;
  v_cand_day date;
  v_ex_day   date;
  v_c_start timestamp;
  v_c_end   timestamp;
  v_x_start timestamp;
  v_x_end   timestamp;
  v_gap interval;
  v_earliest timestamp;
  v_label text;
  v_hours_label text;
  v_apply_turnaround boolean;
begin
  if p_venue_id is null or p_event_date is null then
    raise exception 'venue_id and event_date are required';
  end if;

  if v_end < v_start then
    v_end := v_start;
  end if;

  select w.window_start, w.window_end
    into v_win_start, v_win_end
  from public.event_operational_window(p_setup_time, p_start_time, p_end_time, p_teardown_time) w;

  select r.max_simultaneous_events, r.min_turnaround_hours
    into v_max, v_turnaround
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;
  if v_turnaround is null or v_turnaround <= 0 then
    v_turnaround := 0;
    v_extra := 0;
  else
    v_extra := ceil(v_turnaround / 24.0)::integer;
  end if;

  v_look_start := v_start - v_extra;
  v_look_end := v_end + v_extra;

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

    -- Inactive spaces remain assignable while at least one space is active
    -- (an Event already on an inactivated space must still be editable).
    -- Zero active spaces is no_spaces above.
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
      and e.event_date <= v_look_end
      and coalesce(e.event_end_date, e.event_date) >= v_look_start
  loop
    select w.window_start, w.window_end
      into v_e_start, v_e_end
    from public.event_operational_window(
      v_existing.setup_time, v_existing.start_time,
      v_existing.end_time, v_existing.teardown_time
    ) w;

    if v_existing.event_date <= v_end
       and coalesce(v_existing.event_end_date, v_existing.event_date) >= v_start
       and v_win_start < v_e_end and v_e_start < v_win_end then
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

  if v_turnaround > 0 then
    v_gap := (v_turnaround::text || ' hours')::interval;
    v_hours_label := trim(trailing '.' from trim(trailing '0' from v_turnaround::text));

    for v_existing in
      select e.id, e.name, e.space_id, e.event_date, e.event_end_date,
             e.setup_time, e.start_time, e.end_time, e.teardown_time
      from public.events e
      where e.venue_id = p_venue_id
        and e.status is distinct from 'cancelled'
        and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
        and e.event_date <= v_look_end
        and coalesce(e.event_end_date, e.event_date) >= v_look_start
    loop
      v_apply_turnaround := v_max < 2
        or (p_space_id is not null and v_existing.space_id is not distinct from p_space_id);
      if not v_apply_turnaround then
        continue;
      end if;

      select w.window_start, w.window_end
        into v_e_start, v_e_end
      from public.event_operational_window(
        v_existing.setup_time, v_existing.start_time,
        v_existing.end_time, v_existing.teardown_time
      ) w;

      v_ex_start := v_existing.event_date;
      v_ex_end := coalesce(v_existing.event_end_date, v_existing.event_date);
      if v_ex_end < v_ex_start then
        v_ex_end := v_ex_start;
      end if;

      v_cand_day := v_start;
      while v_cand_day <= v_end loop
        v_ex_day := v_ex_start;
        while v_ex_day <= v_ex_end loop
          v_c_start := v_cand_day + v_win_start;
          v_c_end := v_cand_day + v_win_end;
          v_x_start := v_ex_day + v_e_start;
          v_x_end := v_ex_day + v_e_end;
          if v_c_start < v_x_end and v_x_start < v_c_end then
            null;
          elsif v_x_end <= v_c_start and v_c_start < v_x_end + v_gap then
            v_earliest := v_x_end + v_gap;
            v_label := coalesce(nullif(trim(v_existing.name), ''), 'another event');
            return jsonb_build_object(
              'ok', false, 'code', 'event_turnaround',
              'message', 'This event is too close to "' || v_label || '". A '
                || v_hours_label || '-hour turnaround is required between events. The earliest available start is '
                || trim(to_char(v_earliest, 'FMMonth FMDD at FMHH12:MI AM')) || '.'
            );
          elsif v_c_end <= v_x_start and v_x_start < v_c_end + v_gap then
            v_label := coalesce(nullif(trim(v_existing.name), ''), 'another event');
            return jsonb_build_object(
              'ok', false, 'code', 'event_turnaround',
              'message', 'This event is too close to "' || v_label || '". A '
                || v_hours_label || '-hour turnaround is required between events.'
            );
          end if;
          v_ex_day := v_ex_day + 1;
        end loop;
        v_cand_day := v_cand_day + 1;
      end loop;
    end loop;
  end if;

  return jsonb_build_object('ok', true);
end;
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
  v_extra integer;
begin
  if p_venue_id is null or p_event_date is null then
    raise exception 'venue_id and event_date are required';
  end if;
  if v_end < v_start then
    v_end := v_start;
  end if;

  v_extra := public.event_turnaround_extra_lock_days(p_venue_id);
  v_day := v_start - v_extra;
  while v_day <= v_end + v_extra loop
    perform pg_advisory_xact_lock(hashtext(p_venue_id::text), hashtext(v_day::text));
    v_day := v_day + 1;
  end loop;

  return public.evaluate_event_availability(
    p_venue_id, p_event_date, p_event_end_date,
    p_setup_time, p_start_time, p_end_time, p_teardown_time,
    p_space_id, p_exclude_event_id
  );
end;
$$;

create or replace function public._is_event_date_available(
  p_venue_id uuid,
  p_date     date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_result jsonb;
  v_space record;
begin
  if p_date is null then
    return true;
  end if;

  if exists (
    select 1 from public.calendar_blocks cb
    where cb.venue_id = p_venue_id
      and cb.start_date <= p_date
      and cb.end_date >= p_date
  ) then
    return false;
  end if;

  select r.max_simultaneous_events into v_max
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;

  if v_max >= 2 then
    if not exists (
      select 1 from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    ) then
      return false;
    end if;
    for v_space in
      select s.id from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    loop
      v_result := public.evaluate_event_availability(
        p_venue_id, p_date, null, null, null, null, null, v_space.id, null
      );
      if coalesce(v_result->>'ok', '') = 'true' then
        return true;
      end if;
    end loop;
    return false;
  end if;

  v_result := public.evaluate_event_availability(
    p_venue_id, p_date, null, null, null, null, null, null, null
  );
  return coalesce(v_result->>'ok', '') = 'true';
end;
$$;

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
begin
  if NEW.status = 'cancelled' then
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
        select generate_series(v_new_start, v_new_end, interval '1 day')::date
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

  v_prot_start := NEW.event_date;
  v_prot_end := coalesce(NEW.event_end_date, NEW.event_date);
  if v_prot_end < v_prot_start then
    v_prot_end := v_prot_start;
  end if;
  select cb.title into v_block_title
  from public.calendar_blocks cb
  where cb.venue_id = NEW.venue_id
    and cb.start_date <= v_prot_end
    and cb.end_date >= v_prot_start
  order by cb.start_date
  limit 1;
  if v_block_title is not null then
    raise exception 'Cannot book this date — the calendar is blocked: "%". Remove the block first.', v_block_title
      using errcode = 'P0001',
            hint = 'calendar_blocked';
  end if;

  return NEW;
end;
$$;

create or replace function public.calendar_blocks_lock_event_days()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.lock_event_occupancy_days(NEW.venue_id, NEW.start_date, NEW.end_date);
  if TG_OP = 'UPDATE' then
    perform public.lock_event_occupancy_days(OLD.venue_id, OLD.start_date, OLD.end_date);
  end if;
  return NEW;
end;
$$;

drop trigger if exists calendar_blocks_lock_event_days_ins on public.calendar_blocks;
create trigger calendar_blocks_lock_event_days_ins
  before insert on public.calendar_blocks
  for each row
  execute function public.calendar_blocks_lock_event_days();

drop trigger if exists calendar_blocks_lock_event_days_upd on public.calendar_blocks;
create trigger calendar_blocks_lock_event_days_upd
  before update of start_date, end_date, venue_id
  on public.calendar_blocks
  for each row
  execute function public.calendar_blocks_lock_event_days();

create or replace function public._venue_scheduling_timezone(p_venue_id uuid)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_tz text;
begin
  select v.timezone into v_tz from public.venues v where v.id = p_venue_id;
  if v_tz is null or btrim(v_tz) = '' then
    return 'America/New_York';
  end if;
  return v_tz;
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
  v_tz          text;
  v_start_local timestamp;
  v_end_local   timestamp;
begin
  v_tz := public._venue_scheduling_timezone(p_venue_id);
  v_start_local := p_slot_start at time zone v_tz;
  v_end_local   := p_slot_end at time zone v_tz;
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
      and p_slot_start < ((g.day)::date + w.window_end) at time zone v_tz
      and ((g.day)::date + w.window_start) at time zone v_tz < p_slot_end
  ) into v_blocked;
  if v_blocked then return true; end if;

  select exists(
    select 1 from public.calendar_blocks cb
    where cb.venue_id = p_venue_id
      and cb.type in ('blocked_time', 'wedding_event_booking', 'private_event')
      and cb.start_date <= (p_slot_start at time zone v_tz)::date
      and cb.end_date   >= (p_slot_start at time zone v_tz)::date
  ) into v_blocked;
  if v_blocked then return true; end if;

  select exists(
    select 1 from public.tour_availability_exceptions tae
    where tae.venue_id = p_venue_id
      and tae.start_date <= (p_slot_start at time zone v_tz)::date
      and tae.end_date   >= (p_slot_start at time zone v_tz)::date
  ) into v_blocked;
  return v_blocked;
end;
$$;

create or replace function public._generate_tour_slots(
  p_venue_id                 uuid,
  p_start_date               date,
  p_end_date                 date,
  p_exclude_appointment_id   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue        public.venues%rowtype;
  v_tz           text;
  v_slots        jsonb := '[]'::jsonb;
  v_cursor_date  date;
  v_dow          smallint;
  v_window       record;
  v_slot_start   timestamptz;
  v_slot_end     timestamptz;
  v_window_end   timestamptz;
  v_now          timestamptz := now();
  v_min_start    timestamptz;
  v_max_start    timestamptz;
  v_step         interval;
begin
  select * into v_venue from public.venues where id = p_venue_id;
  if not found then
    return jsonb_build_object('error', 'invalid_venue');
  end if;

  v_tz := public._venue_scheduling_timezone(p_venue_id);
  v_min_start := v_now + (v_venue.tour_min_notice_hours || ' hours')::interval;
  v_max_start := v_now + (v_venue.tour_max_advance_days || ' days')::interval;
  v_step      := ((v_venue.tour_duration_minutes + v_venue.tour_buffer_minutes) || ' minutes')::interval;

  if (p_start_date::timestamp at time zone v_tz) < v_min_start then
    v_cursor_date := (v_min_start at time zone v_tz)::date;
  else
    v_cursor_date := p_start_date;
  end if;

  while v_cursor_date <= p_end_date
    and (v_cursor_date::timestamp at time zone v_tz) <= v_max_start
  loop
    v_dow := extract(dow from v_cursor_date)::smallint;

    for v_window in
      select start_time, end_time
      from public.tour_availability_windows
      where venue_id = p_venue_id
        and day_of_week = v_dow
      order by sort_order, start_time
    loop
      v_slot_start := (v_cursor_date + v_window.start_time) at time zone v_tz;
      v_window_end := (v_cursor_date + v_window.end_time) at time zone v_tz;

      while v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval
              <= v_window_end
      loop
        v_slot_end := v_slot_start + (v_venue.tour_duration_minutes || ' minutes')::interval;

        if v_slot_start >= v_min_start and v_slot_start <= v_max_start
           and not public._is_tour_slot_blocked(p_venue_id, v_slot_start, v_slot_end, p_exclude_appointment_id)
        then
          v_slots := v_slots || jsonb_build_object(
            'start', v_slot_start,
            'end',   v_slot_end,
            'date',  v_cursor_date,
            'time',  to_char(v_slot_start at time zone v_tz, 'HH12:MI AM')
          );
        end if;

        v_slot_start := v_slot_start + v_step;
      end loop;
    end loop;

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

comment on function public.evaluate_event_availability(uuid, date, date, time, time, time, time, uuid, uuid) is
  'Occupancy rules without advisory locks. assert_event_availability locks then calls this. Inquiry date checks call this so they cannot disagree with Event writes.';
comment on function public._is_event_date_available(uuid, date) is
  'Inquiry choose_available: covering calendar_blocks plus date-only Event occupancy (full-day window). Does not create an Event.';
comment on function public._venue_scheduling_timezone(uuid) is
  'IANA timezone for venue-local Event TIME and Tour windows. Default America/New_York.';

grant execute on function public.evaluate_event_availability(uuid, date, date, time, time, time, time, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.assert_event_availability(uuid, date, date, time, time, time, time, uuid, uuid)
  to authenticated, service_role;
grant execute on function public._venue_scheduling_timezone(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
