-- Fix: when allow_simultaneous_public_availability is false, do not call
-- evaluate_event_availability with a null space_id on multi-capacity venues
-- (that returns missing_space and closed every inquiry date). Instead refuse
-- the date when any booked Event occupies it, and use per-space evaluate only
-- for turnaround / empty-day checks.

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
  v_allow_simul boolean;
  v_hold record;
  v_hold_spaces uuid[];
  v_win_start time;
  v_win_end time;
  v_space_blocked boolean;
  v_tz text;
  v_today date;
  v_rules_max integer;
begin
  if p_date is null then
    return true;
  end if;

  select coalesce(nullif(trim(v.timezone), ''), 'UTC')
    into v_tz
  from public.venues v
  where v.id = p_venue_id;
  if v_tz is null then
    v_tz := 'UTC';
  end if;
  v_today := (timezone(v_tz, now()))::date;
  if p_date < v_today then
    return false;
  end if;

  if public.tour_availability_exception_covers_date(p_venue_id, p_date) then
    return false;
  end if;

  if public.covering_calendar_block_title(
    p_venue_id, p_date, p_date, time '00:00', time '23:59', null
  ) is not null then
    return false;
  end if;

  select coalesce(v.hold_blocks_availability, true),
         coalesce(v.allow_simultaneous_public_availability, false)
    into v_hold_blocks, v_allow_simul
  from public.venues v
  where v.id = p_venue_id;
  if v_hold_blocks is null then
    v_hold_blocks := true;
  end if;
  if v_allow_simul is null then
    v_allow_simul := false;
  end if;

  select r.max_simultaneous_events into v_rules_max
  from public.venue_capacity_rules r
  where r.venue_id = p_venue_id;
  if v_rules_max is null or v_rules_max < 1 then
    v_rules_max := 1;
  end if;

  -- Hold branching: without public simultaneous opt-in, treat holds as venue-wide.
  v_max := v_rules_max;
  if not v_allow_simul then
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
        return false;
      end if;
    else
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
          if public.hold_resources_collide(v_hold_spaces, array[v_space.id], v_rules_max) then
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
      return false;
    end if;
  end if;

  -- Explicit opt-in: space-based "any free space keeps the date Available".
  if v_allow_simul and v_rules_max >= 2 then
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

  -- Default public policy (or simple capacity): a booked Event occupying the
  -- calendar date closes it venue-wide. Do not call evaluate with null space
  -- on multi-capacity venues (missing_space).
  if not v_allow_simul then
    if exists (
      select 1
      from public.events e
      where e.venue_id = p_venue_id
        and e.status is distinct from 'cancelled'
        and e.booked_at is not null
        and e.event_date <= p_date
        and coalesce(e.event_end_date, e.event_date) >= p_date
    ) then
      return false;
    end if;

    -- No same-day booked Event. Still honor turnaround via per-space evaluate
    -- when the venue has active spaces; otherwise the date is open.
    if not exists (
      select 1 from public.venue_spaces s
      where s.venue_id = p_venue_id and s.is_active = true
    ) then
      return true;
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

comment on function public._is_event_date_available(uuid, date) is
  'True when the venue can take an Event on p_date (venue-local today or later). Past dates always false. Honors tour blocked dates, covering calendar blocks, holds (when venue opts in), and event occupancy. Without venues.allow_simultaneous_public_availability, any booked Event occupying the date closes it venue-wide for public inquiry.';

notify pgrst, 'reload schema';
