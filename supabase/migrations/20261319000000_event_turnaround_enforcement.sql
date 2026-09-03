-- ============================================================================
-- Event min_turnaround_hours enforcement
--
-- Occupancy authority remains public.assert_event_availability. This
-- migration extends that function (and the write-path lock range) so
-- turnaround is the same authority as overlap — not a second checker.
--
-- Rule: next operational start >= previous operational end + hours.
-- Exact boundary is allowed. Null / missing / <= 0 hours = no requirement.
-- Simple venue (max 1): venue-wide. Simultaneous (max >= 2): per space.
-- Tours are unchanged. Cancelled Events do not impose turnaround.
-- ============================================================================

create or replace function public.event_turnaround_extra_lock_days(p_venue_id uuid)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_hours numeric;
begin
  select r.min_turnaround_hours into v_hours
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_hours is null or v_hours <= 0 then
    return 0;
  end if;
  return ceil(v_hours / 24.0)::integer;
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
  v_lock_start date;
  v_lock_end   date;
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

  v_lock_start := v_start - v_extra;
  v_lock_end := v_end + v_extra;
  v_day := v_lock_start;
  while v_day <= v_lock_end loop
    perform pg_advisory_xact_lock(hashtext(p_venue_id::text), hashtext(v_day::text));
    v_day := v_day + 1;
  end loop;

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
      and e.event_date <= v_lock_end
      and coalesce(e.event_end_date, e.event_date) >= v_lock_start
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
        and e.event_date <= v_lock_end
        and coalesce(e.event_end_date, e.event_date) >= v_lock_start
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

  return NEW;
end;
$$;

comment on function public.event_turnaround_extra_lock_days(uuid) is
  'Days to add on each side of an Event occupancy lock so turnaround races serialize.';
comment on function public.assert_event_availability(uuid, date, date, time, time, time, time, uuid, uuid) is
  'Assert a dated Event may occupy this venue: operational-window overlap plus min_turnaround_hours. Must run in the same transaction as the events write.';

grant execute on function public.event_turnaround_extra_lock_days(uuid)
  to authenticated, service_role;
grant execute on function public.assert_event_availability(uuid, date, date, time, time, time, time, uuid, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
