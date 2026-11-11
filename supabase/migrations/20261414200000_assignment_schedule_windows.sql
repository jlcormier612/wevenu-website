-- Per-use schedule windows on event_space_assignments.
-- Null start/end keeps the event operational window (existing rows).
-- Occupancy, foreign holds, and calendar chips use a space's own window when both times are set.

alter table public.event_space_assignments
  add column if not exists start_time time,
  add column if not exists end_time time;

alter table public.event_space_assignments
  drop constraint if exists event_space_assignments_window_pair;

alter table public.event_space_assignments
  add constraint event_space_assignments_window_pair
  check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  );

comment on column public.event_space_assignments.start_time is
  'When set with end_time, this use occupies only this window. Null uses the event operational window.';

create or replace function public.event_schedule_windows(
  p_event_id uuid,
  p_fallback_space_id uuid,
  p_setup time,
  p_start time,
  p_end time,
  p_teardown time
)
returns table(space_id uuid, window_start time, window_end time)
language sql
stable
security invoker
set search_path = public
as $$
  with assigned as (
    select
      a.space_id,
      w.window_start,
      w.window_end
    from public.event_space_assignments a
    cross join lateral public.event_operational_window(
      case when a.start_time is null and a.end_time is null then p_setup else null end,
      coalesce(a.start_time, p_start),
      coalesce(a.end_time, p_end),
      case when a.start_time is null and a.end_time is null then p_teardown else null end
    ) w
    where p_event_id is not null
      and a.event_id = p_event_id
  )
  select assigned.space_id, assigned.window_start, assigned.window_end from assigned
  union all
  select sid, w.window_start, w.window_end
  from public.event_operational_window(p_setup, p_start, p_end, p_teardown) w
  cross join lateral unnest(public.event_occupied_space_ids(p_event_id, p_fallback_space_id)) as sid
  where not exists (select 1 from assigned)
  union all
  select null::uuid, w.window_start, w.window_end
  from public.event_operational_window(p_setup, p_start, p_end, p_teardown) w
  where not exists (select 1 from assigned)
    and coalesce(cardinality(public.event_occupied_space_ids(p_event_id, p_fallback_space_id)), 0) = 0;
$$;

create or replace function public.schedule_overlap_kind(
  p_left_event uuid,
  p_left_space uuid,
  p_left_setup time,
  p_left_start time,
  p_left_end time,
  p_left_teardown time,
  p_right_event uuid,
  p_right_space uuid,
  p_right_setup time,
  p_right_start time,
  p_right_end time,
  p_right_teardown time,
  p_max integer
) returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_time boolean := false;
  v_space boolean := false;
begin
  select
    coalesce(bool_or(c.window_start < x.window_end and x.window_start < c.window_end), false),
    coalesce(bool_or(
      c.window_start < x.window_end and x.window_start < c.window_end
      and c.space_id is not null
      and x.space_id is not null
      and c.space_id = x.space_id
    ), false)
  into v_time, v_space
  from public.event_schedule_windows(
    p_left_event, p_left_space, p_left_setup, p_left_start, p_left_end, p_left_teardown
  ) c
  cross join public.event_schedule_windows(
    p_right_event, p_right_space, p_right_setup, p_right_start, p_right_end, p_right_teardown
  ) x;

  if v_space and coalesce(p_max, 1) >= 2 then
    return 'space';
  end if;
  if v_time then
    return 'time';
  end if;
  return 'none';
end;
$$;

revoke all on function public.event_schedule_windows(uuid, uuid, time, time, time, time) from public;
revoke all on function public.schedule_overlap_kind(uuid, uuid, time, time, time, time, uuid, uuid, time, time, time, time, integer) from public;
grant execute on function public.event_schedule_windows(uuid, uuid, time, time, time, time) to authenticated, service_role;
grant execute on function public.schedule_overlap_kind(uuid, uuid, time, time, time, time, uuid, uuid, time, time, time, time, integer) to authenticated, service_role;

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
  v_cand_spaces uuid[];
  v_exist_spaces uuid[];
  v_kind text;
  v_pair record;
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
    select w.window_start, w.window_end
      into v_e_start, v_e_end
    from public.event_operational_window(
      v_existing.setup_time, v_existing.start_time,
      v_existing.end_time, v_existing.teardown_time
    ) w;

    v_kind := public.schedule_overlap_kind(
      p_exclude_event_id, p_space_id, p_setup_time, p_start_time, p_end_time, p_teardown_time,
      v_existing.id, v_existing.space_id, v_existing.setup_time, v_existing.start_time, v_existing.end_time, v_existing.teardown_time,
      v_max
    );

    if v_existing.event_date <= v_end
       and coalesce(v_existing.event_end_date, v_existing.event_date) >= v_start
       and v_kind <> 'none' then
      v_overlap_count := v_overlap_count + 1;
      if v_kind = 'space' then
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
        and e.booked_at is not null
        and (p_exclude_event_id is null or e.id <> p_exclude_event_id)
        and e.event_date <= v_look_end
        and coalesce(e.event_end_date, e.event_date) >= v_look_start
    loop
      for v_pair in
        select c.window_start as c_start, c.window_end as c_end,
               x.window_start as x_start, x.window_end as x_end
        from public.event_schedule_windows(
          p_exclude_event_id, p_space_id,
          p_setup_time, p_start_time, p_end_time, p_teardown_time
        ) c
        join public.event_schedule_windows(
          v_existing.id, v_existing.space_id,
          v_existing.setup_time, v_existing.start_time,
          v_existing.end_time, v_existing.teardown_time
        ) x on (
          v_max < 2
          or (c.space_id is not null and x.space_id is not null and c.space_id = x.space_id)
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
  v_becoming_booked boolean;
  v_prot_start date;
  v_prot_end date;
  v_block_title text;
  v_win_start time;
  v_win_end time;
  v_max integer;
  v_hold record;
  v_hold_spaces uuid[];
  v_hold_win_start time;
  v_hold_win_end time;
  v_cand_spaces uuid[];
  v_same_owner boolean;
  v_force boolean;
begin
  if NEW.status = 'cancelled' then
    return NEW;
  end if;

  if TG_OP = 'INSERT'
     and NEW.status = 'complete'
     and NEW.event_date < (timezone('utc', now()))::date then
    return NEW;
  end if;

  if NEW.booked_at is null then
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
    v_becoming_booked := OLD.booked_at is null;
    v_force := coalesce(current_setting('htc.force_event_occupancy', true), '') = '1';
    if not v_occupancy_changed and not v_restoring and not v_becoming_booked and not v_force then
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

  select coalesce(r.max_simultaneous_events, 1) into v_max
  from public.venue_capacity_rules r
  where r.venue_id = NEW.venue_id;
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;

  v_cand_spaces := public.event_occupied_space_ids(
    case when TG_OP = 'UPDATE' then NEW.id else null end,
    NEW.space_id
  );

  if exists (
    select 1 from public.venues v
    where v.id = NEW.venue_id
      and coalesce(v.hold_blocks_availability, true)
  ) then
    for v_hold in
      select h.id, h.lead_id, h.space_id, h.hold_date, h.start_time, h.end_time
      from public.date_holds h
      where h.venue_id = NEW.venue_id
        and h.status = 'active'
        and (h.expires_at is null or h.expires_at > now())
        and h.hold_date >= NEW.event_date
        and h.hold_date <= coalesce(NEW.event_end_date, NEW.event_date)
    loop
      v_same_owner := false;
      if v_hold.lead_id is not null and NEW.client_id is not null then
        select exists (
          select 1 from public.clients c
          where c.id = NEW.client_id
            and c.venue_id = NEW.venue_id
            and c.lead_id = v_hold.lead_id
        ) into v_same_owner;
      end if;
      if v_same_owner then
        continue;
      end if;

      select w.window_start, w.window_end
        into v_hold_win_start, v_hold_win_end
      from public.event_operational_window(null, v_hold.start_time, v_hold.end_time, null) w;

      v_hold_spaces := public.hold_occupied_space_ids(v_hold.id, v_hold.space_id);
      if exists (
        select 1
        from public.event_schedule_windows(
          case when TG_OP = 'UPDATE' then NEW.id else null end,
          NEW.space_id,
          NEW.setup_time, NEW.start_time, NEW.end_time, NEW.teardown_time
        ) c
        where c.window_start < v_hold_win_end
          and v_hold_win_start < c.window_end
          and public.hold_resources_collide(
            v_hold_spaces,
            case when c.space_id is null then v_cand_spaces else array[c.space_id] end,
            v_max
          )
      ) then
        raise exception 'This date has a hold. Your availability settings treat holds as unavailable.'
          using errcode = 'P0001',
                hint = 'hold_blocks';
      end if;
    end loop;
  end if;

  return NEW;
end;
$$;

create or replace function public.book_relationship(
  p_venue_id uuid,
  p_client_id uuid,
  p_space_id uuid default null,
  p_pipeline_stage_id uuid default null,
  p_name text default null,
  p_event_type text default null,
  p_event_date date default null,
  p_event_end_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_setup_time time default null,
  p_teardown_time time default null,
  p_guest_count integer default null,
  p_lifecycle_origin text default null,
  p_confirmed_occupancy jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_lead_id uuid;
  v_previous_stage text;
  v_event_id uuid;
  v_existing_booked_at date;
  v_existing_date date;
  v_event_date date;
  v_event_end date;
  v_name text;
  v_primary text;
  v_partner text;
  v_newly boolean := false;
  v_origin text;
  v_booked_on date;
  v_hold_end date;
  v_relationship_id uuid;
  v_source text;
  v_confirmed boolean := false;
  v_conf_start time;
  v_conf_end time;
  v_primary_space uuid;
  v_space_ids uuid[];
  v_max_sim integer;
begin
  if auth.role() is distinct from 'service_role' and not exists (
    select 1 from public.venue_users vu
    where vu.venue_id = p_venue_id and vu.user_id = auth.uid() and vu.is_active
  ) then
    return jsonb_build_object('ok', false, 'message', 'Not allowed.');
  end if;

  perform set_config('htc.authorize_booked_stage', 'on', true);

  select * into v_client
  from public.clients
  where id = p_client_id and venue_id = p_venue_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Client not found.');
  end if;

  v_lead_id := v_client.lead_id;
  if v_lead_id is not null then
    select sales_stage into v_previous_stage
    from public.leads
    where id = v_lead_id and venue_id = p_venue_id
    for update;
  end if;

  select e.id, e.booked_at, e.event_date
    into v_event_id, v_existing_booked_at, v_existing_date
  from public.events e
  where e.venue_id = p_venue_id
    and e.client_id = p_client_id
    and e.status <> 'cancelled'
  order by (e.booked_at is null), e.created_at
  limit 1
  for update;

  v_event_date := coalesce(p_event_date, v_client.event_date);
  v_confirmed := p_confirmed_occupancy is not null;
  if v_confirmed then
    begin
      v_event_date := nullif(btrim(p_confirmed_occupancy->>'eventDate'), '')::date;
      v_event_end := nullif(btrim(p_confirmed_occupancy->>'eventEndDate'), '')::date;
      v_conf_start := nullif(btrim(p_confirmed_occupancy->>'startTime'), '')::time;
      v_conf_end := nullif(btrim(p_confirmed_occupancy->>'endTime'), '')::time;
      select coalesce(array_agg(distinct sid), '{}'::uuid[])
        into v_space_ids
      from (
        select nullif(btrim(p_confirmed_occupancy->>'spaceId'), '')::uuid as sid
        union
        select nullif(btrim(a.value->>'spaceId'), '')::uuid
        from jsonb_array_elements(coalesce(p_confirmed_occupancy->'assignments', '[]'::jsonb)) a(value)
      ) s
      where sid is not null;
      v_primary_space := nullif(btrim(p_confirmed_occupancy->>'spaceId'), '')::uuid;
    exception when others then
      return jsonb_build_object('ok', false, 'message', 'Enter a valid date, time, and space.');
    end;
    if v_event_date is null then
      return jsonb_build_object('ok', false, 'message', 'A date is required before booking this relationship.');
    end if;
    if v_event_end is not null and v_event_end < v_event_date then
      return jsonb_build_object('ok', false, 'message', 'The end date cannot be before the event date.');
    end if;
    if v_event_end is not distinct from v_event_date then
      v_event_end := null;
    end if;
    select coalesce(r.max_simultaneous_events, 1) into v_max_sim
    from public.venue_capacity_rules r
    where r.venue_id = p_venue_id;
    if v_max_sim is null or v_max_sim < 1 then
      v_max_sim := 1;
    end if;
    if v_max_sim >= 2 and coalesce(cardinality(v_space_ids), 0) = 0 then
      return jsonb_build_object(
        'ok', false,
        'message', 'Assign an Event Space before booking. This venue can host more than one event at the same time.'
      );
    end if;
    if coalesce(cardinality(v_space_ids), 0) > 0 and exists (
      select 1 from unnest(v_space_ids) u(sid)
      where not exists (
        select 1 from public.venue_spaces s
        where s.id = u.sid and s.venue_id = p_venue_id and s.is_active
      )
    ) then
      return jsonb_build_object('ok', false, 'message', 'That Event Space does not belong to this venue.');
    end if;
    if v_primary_space is null and coalesce(cardinality(v_space_ids), 0) > 0 then
      v_primary_space := v_space_ids[1];
    end if;
  end if;

  if v_event_id is not null and v_existing_booked_at is not null
     and (
       (not v_confirmed and p_event_date is not null and p_event_date is distinct from v_existing_date)
       or (v_confirmed and v_event_date is distinct from v_existing_date)
     ) then
    return jsonb_build_object(
      'ok', false,
      'message', 'This relationship is already Booked.'
    );
  end if;

  -- A brand-new event needs a date. Restoring a cancelled event can keep its own date.
  if v_event_id is not null and v_existing_booked_at is null and v_event_date is null then
    return jsonb_build_object('ok', false, 'message', 'Add a preferred date before booking this relationship.');
  end if;

  v_primary := trim(both ' ' from concat_ws(' ', v_client.first_name, v_client.last_name));
  v_partner := trim(both ' ' from concat_ws(' ', nullif(v_client.partner_first_name, ''), nullif(v_client.partner_last_name, '')));
  v_name := case
    when p_name is not null and length(trim(p_name)) > 0 then trim(p_name)
    when v_partner <> '' then v_primary || ' & ' || v_partner
    else v_primary
  end;
  if v_name is null or v_name = '' then
    v_name := 'Event';
  end if;
  if not v_confirmed then
    v_event_end := coalesce(p_event_end_date, v_client.end_date);
    if v_event_end is not distinct from v_event_date then
      v_event_end := null;
    end if;
  end if;
  v_booked_on := (timezone(public._venue_scheduling_timezone(p_venue_id), now()))::date;
  v_origin := coalesce(
    p_lifecycle_origin,
    case when v_lead_id is not null then 'pipeline' else 'direct' end
  );

  if v_event_id is not null and v_existing_booked_at is not null then
    v_newly := false;
    -- Already Booked: consume any leftover active holds on the Event date only.
    if v_lead_id is not null and v_existing_date is not null then
      update public.date_holds
        set status = 'converted'
      where venue_id = p_venue_id
        and lead_id = v_lead_id
        and status = 'active'
        and hold_date = v_existing_date;
    end if;
  elsif v_event_id is not null and v_existing_booked_at is null then
    -- Consume own overlapping holds before stamping booked_at (occupancy trigger).
    if v_lead_id is not null and v_event_date is not null then
      v_hold_end := coalesce(v_event_end, v_event_date);
      update public.date_holds
        set status = 'converted'
      where venue_id = p_venue_id
        and lead_id = v_lead_id
        and status = 'active'
        and (
          (hold_date >= v_event_date and hold_date <= v_hold_end)
          or (
            p_confirmed_occupancy is not null
            and hold_date in (
              select d::date
              from jsonb_array_elements_text(coalesce(p_confirmed_occupancy->'sourceHoldDates', '[]'::jsonb)) d
              where d ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            )
          )
        );
    end if;
    update public.events
      set status = 'confirmed',
          booked_at = case when v_confirmed then null else v_booked_on end,
          name = v_name,
          event_type = coalesce(nullif(p_event_type, ''), v_client.event_type),
          event_date = v_event_date,
          event_end_date = v_event_end,
          start_time = case when v_confirmed then v_conf_start else coalesce(p_start_time, v_client.ceremony_time, start_time) end,
          end_time = case when v_confirmed then v_conf_end else coalesce(p_end_time, v_client.reception_time, end_time) end,
          setup_time = coalesce(p_setup_time, setup_time),
          teardown_time = coalesce(p_teardown_time, teardown_time),
          guest_count = coalesce(p_guest_count, v_client.guest_count),
          space_id = case when v_confirmed then v_primary_space else coalesce(p_space_id, space_id) end,
          booking_celebration_pending = true
    where id = v_event_id and venue_id = p_venue_id;
    v_newly := true;
  else
    select e.id into v_event_id
    from public.events e
    where e.venue_id = p_venue_id
      and e.client_id = p_client_id
      and e.status = 'cancelled'
      and e.booked_at is not null
    order by e.created_at desc
    limit 1
    for update;

    if v_event_id is not null then
      if v_event_date is null then
        select event_date into v_event_date from public.events where id = v_event_id;
      end if;
      if v_lead_id is not null and v_event_date is not null then
        v_hold_end := coalesce(v_event_end, v_event_date);
        update public.date_holds
          set status = 'converted'
        where venue_id = p_venue_id
          and lead_id = v_lead_id
          and status = 'active'
          and (
            (hold_date >= v_event_date and hold_date <= v_hold_end)
            or (
              p_confirmed_occupancy is not null
              and hold_date in (
                select d::date
                from jsonb_array_elements_text(coalesce(p_confirmed_occupancy->'sourceHoldDates', '[]'::jsonb)) d
                where d ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              )
            )
          );
      end if;
      update public.events
        set status = case when v_confirmed then status else 'confirmed' end,
            name = coalesce(nullif(trim(p_name), ''), name),
            event_type = coalesce(nullif(p_event_type, ''), event_type),
            event_date = case when v_confirmed then v_event_date else coalesce(p_event_date, event_date) end,
            event_end_date = case when v_confirmed then v_event_end else coalesce(p_event_end_date, event_end_date) end,
            start_time = case when v_confirmed then v_conf_start else coalesce(p_start_time, start_time) end,
            end_time = case when v_confirmed then v_conf_end else coalesce(p_end_time, end_time) end,
            setup_time = coalesce(p_setup_time, setup_time),
            teardown_time = coalesce(p_teardown_time, teardown_time),
            guest_count = coalesce(p_guest_count, guest_count),
            space_id = case when v_confirmed then v_primary_space else coalesce(p_space_id, space_id) end
      where id = v_event_id and venue_id = p_venue_id;
      v_newly := false;
    else
      if v_event_date is null then
        return jsonb_build_object('ok', false, 'message', 'Add a preferred date before booking this relationship.');
      end if;
      if v_lead_id is not null then
        v_hold_end := coalesce(v_event_end, v_event_date);
        update public.date_holds
          set status = 'converted'
        where venue_id = p_venue_id
          and lead_id = v_lead_id
          and status = 'active'
          and (
            (hold_date >= v_event_date and hold_date <= v_hold_end)
            or (
              p_confirmed_occupancy is not null
              and hold_date in (
                select d::date
                from jsonb_array_elements_text(coalesce(p_confirmed_occupancy->'sourceHoldDates', '[]'::jsonb)) d
                where d ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              )
            )
          );
      end if;
      insert into public.events (
        venue_id, client_id, space_id, status, name, event_type,
        event_date, event_end_date, start_time, end_time, setup_time, teardown_time,
        guest_count, booked_at, booking_celebration_pending
      ) values (
        p_venue_id, p_client_id,
        case when v_confirmed then v_primary_space else p_space_id end,
        'confirmed', v_name,
        coalesce(nullif(p_event_type, ''), v_client.event_type),
        v_event_date, v_event_end,
        case when v_confirmed then v_conf_start else coalesce(p_start_time, v_client.ceremony_time) end,
        case when v_confirmed then v_conf_end else coalesce(p_end_time, v_client.reception_time) end,
        p_setup_time, p_teardown_time,
        coalesce(p_guest_count, v_client.guest_count),
        case when v_confirmed then null else v_booked_on end,
        true
      )
      returning id into v_event_id;
      v_newly := true;
    end if;
  end if;

  -- Confirmed occupancy: assignments exist before booked_at so the
  -- occupancy trigger sees the final space set. Failure rolls the hold
  -- conversion back with the rest of this function.
  -- Already-booked rows are not rewritten.
  if v_confirmed and v_existing_booked_at is null then
    delete from public.event_space_assignments
    where event_id = v_event_id and venue_id = p_venue_id;

    insert into public.event_space_assignments (
      venue_id, event_id, use_key, use_label, space_id, sort_order, start_time, end_time
    )
    select
      p_venue_id,
      v_event_id,
      btrim(a.use_key),
      coalesce(nullif(btrim(a.use_label), ''), initcap(replace(btrim(a.use_key), '_', ' '))),
      a.space_id,
      a.ord::smallint,
      a.start_time,
      a.end_time
    from (
      select distinct on (btrim(x.value->>'useKey'))
        btrim(x.value->>'useKey') as use_key,
        x.value->>'useLabel' as use_label,
        nullif(btrim(x.value->>'spaceId'), '')::uuid as space_id,
        x.ord,
        nullif(btrim(x.value->>'startTime'), '')::time as start_time,
        nullif(btrim(x.value->>'endTime'), '')::time as end_time
      from jsonb_array_elements(coalesce(p_confirmed_occupancy->'assignments', '[]'::jsonb))
        with ordinality as x(value, ord)
      where nullif(btrim(x.value->>'useKey'), '') is not null
        and nullif(btrim(x.value->>'spaceId'), '') is not null
      order by btrim(x.value->>'useKey'), x.ord
    ) a
    join public.venue_spaces s
      on s.id = a.space_id and s.venue_id = p_venue_id and s.is_active;

    if not exists (
      select 1 from public.event_space_assignments z where z.event_id = v_event_id
    ) and v_primary_space is not null then
      insert into public.event_space_assignments (
        venue_id, event_id, use_key, use_label, space_id, sort_order
      ) values (
        p_venue_id, v_event_id, 'event_space', 'Event space', v_primary_space, 0
      );
    end if;

    update public.events
      set status = 'confirmed',
          booked_at = coalesce(booked_at, v_booked_on),
          event_date = v_event_date,
          event_end_date = v_event_end,
          start_time = v_conf_start,
          end_time = v_conf_end,
          space_id = v_primary_space
    where id = v_event_id and venue_id = p_venue_id;
  end if;

  update public.clients
    set status = 'confirmed',
        lifecycle_booked_at = coalesce(lifecycle_booked_at, now()),
        lifecycle_booking_origin = coalesce(lifecycle_booking_origin, v_origin)
  where id = p_client_id and venue_id = p_venue_id;
  if not found then
    raise exception 'Client not found.';
  end if;

  if v_lead_id is null then
    v_relationship_id := v_client.relationship_id;
    if v_relationship_id is null then
      v_relationship_id := public.find_or_create_relationship(
        p_venue_id,
        v_client.email,
        v_client.first_name,
        v_client.last_name
      );
    end if;

    select l.id into v_lead_id
    from public.leads l
    where l.venue_id = p_venue_id
      and l.relationship_id = v_relationship_id
    order by l.created_at
    limit 1
    for update;

    if v_lead_id is null then
      v_source := null;
      if exists (
        select 1 from public.lead_sources s
        where s.key = 'other' and s.is_enabled
      ) then
        v_source := 'other';
      end if;

      insert into public.leads (
        venue_id, sales_stage, source, first_name, last_name, email, phone,
        partner_first_name, partner_last_name, partner_email,
        event_type, event_date, end_date, guest_count,
        inquiry_date, relationship_id, first_booked_at
      ) values (
        p_venue_id,
        'booked',
        v_source,
        v_client.first_name,
        v_client.last_name,
        v_client.email,
        v_client.phone,
        v_client.partner_first_name,
        v_client.partner_last_name,
        v_client.partner_email,
        coalesce(nullif(p_event_type, ''), v_client.event_type),
        v_event_date,
        v_event_end,
        coalesce(p_guest_count, v_client.guest_count),
        v_booked_on,
        v_relationship_id,
        now()
      )
      returning id into v_lead_id;
    end if;

    update public.clients
      set lead_id = v_lead_id,
          relationship_id = coalesce(relationship_id, v_relationship_id)
    where id = p_client_id and venue_id = p_venue_id;
  end if;

  update public.leads
    set sales_stage = 'booked',
        pipeline_stage_id = coalesce(p_pipeline_stage_id, pipeline_stage_id),
        lost_reason = null,
        lost_reason_detail = null,
        lost_at = null,
        first_booked_at = coalesce(first_booked_at, now())
  where id = v_lead_id and venue_id = p_venue_id;
  if not found then
    raise exception 'Lead not found for this client.';
  end if;

  -- Attach existing preparation. Do not insert a second copy.
  update public.event_tasks
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.event_playbook_applications a
    set event_id = v_event_id
  where a.venue_id = p_venue_id and a.client_id = p_client_id and a.event_id is null
    and not exists (
      select 1 from public.event_playbook_applications x
      where x.event_id = v_event_id and x.kind = a.kind
    );

  update public.timeline_sections
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.timeline_entries
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.floor_plans
    set event_id = v_event_id
  where venue_id = p_venue_id and client_id = p_client_id and event_id is null;

  update public.event_orders o
    set event_id = v_event_id
  where o.venue_id = p_venue_id and o.client_id = p_client_id and event_id is null
    and not exists (
      select 1 from public.event_orders x where x.event_id = v_event_id
    );

  update public.event_vendor_assignments a
    set event_id = v_event_id
  where a.venue_id = p_venue_id and a.client_id = p_client_id and a.event_id is null
    and not exists (
      select 1 from public.event_vendor_assignments x
      where x.event_id = v_event_id and x.vendor_id = a.vendor_id
    );

  -- Required vendors (venue_vendor_relationships.is_required) → event assignments.
  -- Venue-level rule, not Setup Profile requiredVendorIds. Idempotent. Not a Booked gate.
  if v_newly then
    insert into public.event_vendor_assignments (
      venue_id, event_id, client_id, vendor_id, notes
    )
    select
      p_venue_id,
      v_event_id,
      p_client_id,
      vvr.vendor_id,
      'Required by venue'
    from public.venue_vendor_relationships vvr
    where vvr.venue_id = p_venue_id
      and vvr.is_required = true
      and vvr.status = 'active'
      and not exists (
        select 1 from public.event_vendor_assignments x
        where x.event_id = v_event_id and x.vendor_id = vvr.vendor_id
      );
  end if;

  -- Seed booked-event space authority from historical lead preferences.
  -- Same transaction. Never rewrite lead_event_space_preferences.
  -- Inactive / disallowed / missing spaces are skipped; booking still succeeds.
  if v_newly and v_lead_id is not null and not v_confirmed then
    insert into public.event_space_assignments (
      venue_id, event_id, use_key, use_label, space_id, sort_order
    )
    select
      p_venue_id,
      v_event_id,
      p.use_key,
      case p.use_key
        when 'ceremony' then 'Ceremony'
        when 'reception' then 'Reception'
        when 'cocktail_hour' then 'Cocktail Hour'
        when 'getting_ready' then 'Getting Ready'
        when 'rehearsal_dinner' then 'Rehearsal Dinner'
        else initcap(replace(p.use_key, '_', ' '))
      end,
      p.space_id,
      case p.use_key
        when 'reception' then 0
        when 'ceremony' then 1
        else 10
      end
    from public.lead_event_space_preferences p
    join public.venue_spaces s
      on s.id = p.space_id
     and s.venue_id = p_venue_id
    where p.lead_id = v_lead_id
      and p.venue_id = p_venue_id
      and p.preference_kind = 'venue_space'
      and (
        coalesce(
          (select e.event_type from public.events e where e.id = v_event_id),
          p_event_type,
          ''
        ) in (
          'wedding', 'elopement', 'engagement_party', 'rehearsal_dinner', 'reception'
        )
        or p.use_key not in (
          'ceremony', 'reception', 'getting_ready', 'rehearsal_dinner'
        )
      )
      and p.space_id is not null
      and s.is_active
      and (
        coalesce(cardinality(s.permitted_uses), 0) = 0
        or p.use_key = any (s.permitted_uses)
      )
      and not exists (
        select 1 from public.event_space_assignments a
        where a.event_id = v_event_id and a.use_key = p.use_key
      );

    update public.events e
      set external_ceremony_location = coalesce(
            nullif(trim(e.external_ceremony_location), ''),
            (
              select nullif(trim(p.external_location), '')
              from public.lead_event_space_preferences p
              where p.lead_id = v_lead_id
                and p.venue_id = p_venue_id
                and p.use_key = 'ceremony'
                and p.preference_kind = 'external'
              limit 1
            )
          ),
          external_reception_location = coalesce(
            nullif(trim(e.external_reception_location), ''),
            (
              select nullif(trim(p.external_location), '')
              from public.lead_event_space_preferences p
              where p.lead_id = v_lead_id
                and p.venue_id = p_venue_id
                and p.use_key = 'reception'
                and p.preference_kind = 'external'
              limit 1
            )
          )
    where e.id = v_event_id and e.venue_id = p_venue_id;

    update public.events e
      set space_id = coalesce(
        (select a.space_id from public.event_space_assignments a
          where a.event_id = e.id and a.use_key = 'reception' limit 1),
        (select a.space_id from public.event_space_assignments a
          where a.event_id = e.id and a.use_key = 'ceremony' limit 1),
        (select a.space_id from public.event_space_assignments a
          where a.event_id = e.id order by a.sort_order, a.created_at limit 1)
      )
    where e.id = v_event_id
      and e.venue_id = p_venue_id
      and e.space_id is null
      and exists (
        select 1 from public.event_space_assignments a where a.event_id = e.id
      );
  end if;

  return jsonb_build_object(
    'ok', true,
    'newly_booked', v_newly,
    'event_id', v_event_id,
    'client_id', p_client_id,
    'lead_id', v_lead_id,
    'previous_sales_stage', v_previous_stage
  );
end;
$$;


revoke all on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text, jsonb) from public;
grant execute on function public.book_relationship(uuid, uuid, uuid, uuid, text, text, date, date, time, time, time, time, integer, text, jsonb) to authenticated, service_role;


create or replace function public.replace_event_space_assignments(
  p_venue_id uuid,
  p_event_id uuid,
  p_primary_space_id uuid,
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if auth.role() is distinct from 'service_role' and not exists (
    select 1 from public.venue_users vu
    where vu.venue_id = p_venue_id and vu.user_id = auth.uid() and vu.is_active
  ) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  select e.id into v_event_id
  from public.events e
  where e.id = p_event_id and e.venue_id = p_venue_id
  for update;
  if v_event_id is null then
    raise exception 'Event not found.';
  end if;

  delete from public.event_space_assignments
  where event_id = p_event_id and venue_id = p_venue_id;

  insert into public.event_space_assignments (
    venue_id, event_id, use_key, use_label, space_id, sort_order, start_time, end_time
  )
  select
    p_venue_id,
    p_event_id,
    btrim(a.use_key),
    coalesce(nullif(btrim(a.use_label), ''), initcap(replace(btrim(a.use_key), '_', ' '))),
    a.space_id,
    a.sort_order::smallint,
    a.start_time,
    a.end_time
  from (
    select
      x.value->>'useKey' as use_key,
      x.value->>'useLabel' as use_label,
      nullif(btrim(x.value->>'spaceId'), '')::uuid as space_id,
      coalesce((x.value->>'sortOrder')::integer, (x.ord - 1)::integer) as sort_order,
      nullif(btrim(x.value->>'startTime'), '')::time as start_time,
      nullif(btrim(x.value->>'endTime'), '')::time as end_time
    from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) with ordinality as x(value, ord)
  ) a
  join public.venue_spaces s
    on s.id = a.space_id and s.venue_id = p_venue_id and s.is_active
  where nullif(btrim(a.use_key), '') is not null
    and a.space_id is not null;

  perform set_config('htc.force_event_occupancy', '1', true);
  update public.events
    set space_id = p_primary_space_id
  where id = p_event_id and venue_id = p_venue_id;
  perform set_config('htc.force_event_occupancy', '', true);
end;
$$;
