-- Date-scope event occupancy overlap for undated candidates.
--
-- Bug: schedule_overlap_kind treated occ_date IS NULL as matching every day,
-- so a Friday Bridge inquiry collided with a Saturday Bridge ceremony on a
-- multi-day booked event. TS datedIntervalsOverlap already requires the same
-- calendar day; align evaluate_event_availability with that rule.
--
-- Public choose_available semantics are unchanged: a simultaneous venue stays
-- Available when at least one active space can accept a full-day event.

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
  v_cand_spaces uuid[];
  v_kind text;
  v_pair record;
  v_time_hit boolean;
  v_space_hit boolean;
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

  v_cand_spaces := public.event_occupied_space_ids(p_exclude_event_id, p_space_id);

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

    if p_space_id is null and coalesce(cardinality(v_cand_spaces), 0) = 0 then
      return jsonb_build_object(
        'ok', false, 'code', 'missing_space',
        'message', 'Assign an Event Space before booking. This venue can host more than one event at the same time.'
      );
    end if;

    if p_space_id is not null then
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
  end if;

  for v_existing in
    select e.id, e.name, e.space_id, e.event_date, e.event_end_date,
           e.setup_time, e.start_time, e.end_time, e.teardown_time
    from public.events e
    where e.venue_id = p_venue_id
      and e.status is distinct from 'cancelled'
      and e.booked_at is not null
      and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
      and e.event_date <= v_look_end
      and coalesce(e.event_end_date, e.event_date) >= v_look_start
  loop
    v_ex_start := v_existing.event_date;
    v_ex_end := coalesce(v_existing.event_end_date, v_existing.event_date);
    if v_ex_end < v_ex_start then
      v_ex_end := v_ex_start;
    end if;

    -- Day-scoped overlap (same calendar day required). Undated candidate
    -- windows expand onto p_event_date..v_end; existing component scheduled_date
    -- windows expand only onto that day.
    v_time_hit := false;
    v_space_hit := false;
    for v_pair in
      select
        c.space_id as c_space, c.window_start as c_start, c.window_end as c_end, c.occ_date as c_occ,
        x.space_id as x_space, x.window_start as x_start, x.window_end as x_end, x.occ_date as x_occ
      from public.event_schedule_windows(
        p_exclude_event_id, p_space_id,
        p_setup_time, p_start_time, p_end_time, p_teardown_time
      ) c
      cross join public.event_schedule_windows(
        v_existing.id, v_existing.space_id,
        v_existing.setup_time, v_existing.start_time,
        v_existing.end_time, v_existing.teardown_time
      ) x
      where c.window_start < x.window_end and x.window_start < c.window_end
    loop
      v_cand_day := v_start;
      while v_cand_day <= v_end loop
        if v_pair.c_occ is not null and v_pair.c_occ is distinct from v_cand_day then
          v_cand_day := v_cand_day + 1;
          continue;
        end if;
        v_ex_day := v_ex_start;
        while v_ex_day <= v_ex_end loop
          if v_pair.x_occ is not null and v_pair.x_occ is distinct from v_ex_day then
            v_ex_day := v_ex_day + 1;
            continue;
          end if;
          if v_cand_day = v_ex_day then
            v_time_hit := true;
            if v_pair.c_space is not null and v_pair.x_space is not null
               and v_pair.c_space = v_pair.x_space then
              v_space_hit := true;
            end if;
          end if;
          v_ex_day := v_ex_day + 1;
        end loop;
        v_cand_day := v_cand_day + 1;
      end loop;
    end loop;

    if v_existing.event_date <= v_end
       and coalesce(v_existing.event_end_date, v_existing.event_date) >= v_start
       and (v_time_hit or v_space_hit) then
      v_overlap_count := v_overlap_count + 1;
      if v_space_hit and v_max >= 2 then
        return jsonb_build_object(
          'ok', false, 'code', 'space_overlap',
          'message', 'This space is already booked for "' || coalesce(nullif(trim(v_existing.name), ''), 'another event') || '" at an overlapping time.'
        );
      end if;
      if v_time_hit and v_max < 2 then
        -- Non-simultaneous venues treat any time overlap as capacity pressure
        -- via v_overlap_count below (and schedule_overlap_kind's 'time' path).
        null;
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
        and e.booked_at is not null
        and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
        and e.event_date <= v_look_end
        and coalesce(e.event_end_date, e.event_date) >= v_look_start
    loop
      for v_pair in
        select c.window_start as c_start, c.window_end as c_end, c.occ_date as c_occ,
               x.window_start as x_start, x.window_end as x_end, x.occ_date as x_occ
        from public.event_schedule_windows(
          p_exclude_event_id, p_space_id,
          p_setup_time, p_start_time, p_end_time, p_teardown_time
        ) c
        join public.event_schedule_windows(
          v_existing.id, v_existing.space_id,
          v_existing.setup_time, v_existing.start_time,
          v_existing.end_time, v_existing.teardown_time
        ) x on (
          (v_max < 2
            or (c.space_id is not null and x.space_id is not null and c.space_id = x.space_id))
          and (c.occ_date is null or x.occ_date is null or c.occ_date = x.occ_date)
        )
      loop
      v_win_start := v_pair.c_start;
      v_win_end := v_pair.c_end;
      v_e_start := v_pair.x_start;
      v_e_end := v_pair.x_end;

      v_ex_start := v_existing.event_date;
      v_ex_end := coalesce(v_existing.event_end_date, v_existing.event_date);
      if v_ex_end < v_ex_start then
        v_ex_end := v_ex_start;
      end if;

      v_cand_day := v_start;
      while v_cand_day <= v_end loop
        v_ex_day := v_ex_start;
        while v_ex_day <= v_ex_end loop
          if (v_pair.c_occ is not null and v_pair.c_occ is distinct from v_cand_day)
             or (v_pair.x_occ is not null and v_pair.x_occ is distinct from v_ex_day) then
            v_ex_day := v_ex_day + 1;
            continue;
          end if;
          -- Turnaround only compares same-day adjacency / gaps.
          if v_cand_day is distinct from v_ex_day then
            v_ex_day := v_ex_day + 1;
            continue;
          end if;
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
    end loop;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.evaluate_event_availability(uuid, date, date, time, time, time, time, uuid, uuid) is
  'Canonical event occupancy. Multi-day component scheduled_date windows collide only on the same calendar day as the candidate.';
