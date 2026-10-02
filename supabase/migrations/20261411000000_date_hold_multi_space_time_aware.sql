-- Date Holds: multi-space resources + time-window conflict (RESOURCE(S)+DATE+WINDOW).
-- Reuses event_operational_window / windowsOverlap semantics.
-- Booked-event space_overlap also considers event_space_assignments.
-- Holds do not invent turnaround; turnaround remains booked-event only.

-- ---------------------------------------------------------------------------
-- date_hold_spaces — resources protected by a hold (empty = whole venue)
-- ---------------------------------------------------------------------------
create table if not exists public.date_hold_spaces (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  hold_id uuid not null references public.date_holds (id) on delete cascade,
  space_id uuid not null references public.venue_spaces (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (hold_id, space_id)
);

create index if not exists date_hold_spaces_hold
  on public.date_hold_spaces (hold_id);
create index if not exists date_hold_spaces_venue_space
  on public.date_hold_spaces (venue_id, space_id);

comment on table public.date_hold_spaces is
  'Physical spaces protected by a date hold. Zero rows = whole-venue hold. date_holds.space_id remains a legacy single-space mirror (null when 0 or >1 spaces).';

alter table public.date_hold_spaces enable row level security;

drop policy if exists date_hold_spaces_all on public.date_hold_spaces;
create policy date_hold_spaces_all on public.date_hold_spaces
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.date_hold_spaces to authenticated;

create or replace function public.date_hold_spaces_enforce_venue()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.date_holds h
    where h.id = new.hold_id and h.venue_id = new.venue_id
  ) then
    raise exception 'date_hold_spaces venue isolation';
  end if;
  if not exists (
    select 1 from public.venue_spaces s
    where s.id = new.space_id and s.venue_id = new.venue_id
  ) then
    raise exception 'date_hold_spaces space must belong to the venue';
  end if;
  return new;
end;
$$;

drop trigger if exists date_hold_spaces_venue on public.date_hold_spaces;
create trigger date_hold_spaces_venue
  before insert or update on public.date_hold_spaces
  for each row execute function public.date_hold_spaces_enforce_venue();

-- Backfill from legacy date_holds.space_id
insert into public.date_hold_spaces (venue_id, hold_id, space_id)
select h.venue_id, h.id, h.space_id
from public.date_holds h
where h.space_id is not null
  and not exists (
    select 1 from public.date_hold_spaces s
    where s.hold_id = h.id and s.space_id = h.space_id
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.event_occupied_space_ids(
  p_event_id uuid,
  p_space_id uuid default null
)
returns uuid[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(array_agg(distinct sid), '{}'::uuid[])
  from (
    select p_space_id as sid where p_space_id is not null
    union
    select a.space_id
    from public.event_space_assignments a
    where p_event_id is not null and a.event_id = p_event_id
  ) s
  where sid is not null;
$$;

create or replace function public.hold_occupied_space_ids(
  p_hold_id uuid,
  p_legacy_space_id uuid default null
)
returns uuid[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(array_agg(distinct sid), '{}'::uuid[])
  from (
    select s.space_id as sid
    from public.date_hold_spaces s
    where s.hold_id = p_hold_id
    union
    select p_legacy_space_id
    where p_legacy_space_id is not null
      and not exists (
        select 1 from public.date_hold_spaces x where x.hold_id = p_hold_id
      )
  ) u
  where sid is not null;
$$;

-- True when hold resources collide with candidate spaces under venue capacity.
-- Empty hold spaces = whole venue. max < 2 → any hold collides.
-- Empty candidate + max ≥ 2 → only whole-venue holds collide (inquiry uses per-space).
create or replace function public.hold_resources_collide(
  p_hold_space_ids uuid[],
  p_candidate_space_ids uuid[],
  p_max_simultaneous integer
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_max integer := coalesce(p_max_simultaneous, 1);
begin
  if v_max < 1 then v_max := 1; end if;
  if coalesce(cardinality(p_hold_space_ids), 0) = 0 then
    return true;
  end if;
  if v_max < 2 then
    return true;
  end if;
  if coalesce(cardinality(p_candidate_space_ids), 0) = 0 then
    return false;
  end if;
  return exists (
    select 1
    from unnest(p_hold_space_ids) h(sid)
    join unnest(p_candidate_space_ids) c(sid) on c.sid = h.sid
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- evaluate_event_availability — space_overlap uses assignment space sets
-- ---------------------------------------------------------------------------
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

    if v_existing.event_date <= v_end
       and coalesce(v_existing.event_end_date, v_existing.event_date) >= v_start
       and v_win_start < v_e_end and v_e_start < v_win_end then
      v_overlap_count := v_overlap_count + 1;
      if v_max >= 2 then
        v_exist_spaces := public.event_occupied_space_ids(v_existing.id, v_existing.space_id);
        if coalesce(cardinality(v_cand_spaces), 0) > 0
           and coalesce(cardinality(v_exist_spaces), 0) > 0
           and exists (
             select 1
             from unnest(v_cand_spaces) c(sid)
             join unnest(v_exist_spaces) x(sid) on x.sid = c.sid
           ) then
          return jsonb_build_object(
            'ok', false, 'code', 'space_overlap',
            'message', 'This space is already booked for "' || coalesce(nullif(trim(v_existing.name), ''), 'another event') || '" at an overlapping time.'
          );
        end if;
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
      v_exist_spaces := public.event_occupied_space_ids(v_existing.id, v_existing.space_id);
      v_apply_turnaround := v_max < 2
        or (
          coalesce(cardinality(v_cand_spaces), 0) > 0
          and coalesce(cardinality(v_exist_spaces), 0) > 0
          and exists (
            select 1
            from unnest(v_cand_spaces) c(sid)
            join unnest(v_exist_spaces) x(sid) on x.sid = c.sid
          )
        );
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

-- ---------------------------------------------------------------------------
-- Public date availability — space/time-aware holds
-- ---------------------------------------------------------------------------
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
  v_hold_blocks boolean;
  v_hold record;
  v_hold_spaces uuid[];
  v_win_start time;
  v_win_end time;
  v_space_blocked boolean;
begin
  if p_date is null then
    return true;
  end if;

  select coalesce(v.hold_blocks_availability, true)
    into v_hold_blocks
  from public.venues v
  where v.id = p_venue_id;
  if v_hold_blocks is null then
    v_hold_blocks := true;
  end if;

  select r.max_simultaneous_events into v_max
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_max is null or v_max < 1 then
    v_max := 1;
  end if;

  if v_hold_blocks then
    if v_max < 2 then
      if exists (
        select 1
        from public.date_holds h
        where h.venue_id = p_venue_id
          and h.hold_date = p_date
          and h.status = 'active'
          and (h.expires_at is null or h.expires_at > now())
      ) then
        -- Any active hold on a single-slot venue closes the inquiry date
        -- (inquiry is all-day; any hold window overlaps 00:00–23:59).
        return false;
      end if;
    else
      -- Simultaneous: available if some active space has no overlapping hold.
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
        v_space_blocked := false;
        for v_hold in
          select h.id, h.space_id, h.start_time, h.end_time
          from public.date_holds h
          where h.venue_id = p_venue_id
            and h.hold_date = p_date
            and h.status = 'active'
            and (h.expires_at is null or h.expires_at > now())
        loop
          v_hold_spaces := public.hold_occupied_space_ids(v_hold.id, v_hold.space_id);
          select w.window_start, w.window_end
            into v_win_start, v_win_end
          from public.event_operational_window(null, v_hold.start_time, v_hold.end_time, null) w;
          -- Inquiry is all-day; any hold window overlaps.
          if public.hold_resources_collide(v_hold_spaces, array[v_space.id], v_max) then
            v_space_blocked := true;
            exit;
          end if;
        end loop;
        if not v_space_blocked then
          v_result := public.evaluate_event_availability(
            p_venue_id, p_date, null, null, null, null, null, v_space.id, null
          );
          if coalesce(v_result->>'ok', '') = 'true' then
            return true;
          end if;
        end if;
      end loop;
      -- Fall through: every space blocked by hold or occupancy → check blocks then false
      if public.covering_calendar_block_title(
        p_venue_id, p_date, p_date, time '00:00', time '23:59', null
      ) is not null then
        return false;
      end if;
      return false;
    end if;
  end if;

  if public.covering_calendar_block_title(
    p_venue_id, p_date, p_date, time '00:00', time '23:59', null
  ) is not null then
    return false;
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

-- ---------------------------------------------------------------------------
-- Booked-event write: hold blocks are space + time aware
-- ---------------------------------------------------------------------------
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
    if not v_occupancy_changed and not v_restoring and not v_becoming_booked then
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

      if not (v_win_start < v_hold_win_end and v_hold_win_start < v_win_end) then
        continue;
      end if;

      v_hold_spaces := public.hold_occupied_space_ids(v_hold.id, v_hold.space_id);
      if public.hold_resources_collide(v_hold_spaces, v_cand_spaces, v_max) then
        raise exception 'This date has a hold. Your availability settings treat holds as unavailable.'
          using errcode = 'P0001',
                hint = 'hold_blocks';
      end if;
    end loop;
  end if;

  return NEW;
end;
$$;

comment on function public.events_enforce_availability() is
  'Booked events enforce occupancy (including event_space_assignments), calendar blocks, and foreign active holds that collide on space set + operational window when hold_blocks_availability is true. Same-owner holds do not block. Rows without booked_at do not occupy.';
