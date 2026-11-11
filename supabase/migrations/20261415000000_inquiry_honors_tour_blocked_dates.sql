-- Public inquiry / event-date availability must honor tour_availability_exceptions
-- (Settings → Availability → Blocked Dates), including annual recurrence.
-- Calendar already projects those rows as Blocked Time; _is_event_date_available
-- previously consulted only calendar_blocks, so Christmas (etc.) stayed selectable.
--
-- Also move covering calendar_blocks + tour-exception checks before any
-- early return true on multi-space hold/occupancy paths.

create or replace function public.tour_availability_exception_covers_date(
  p_venue_id uuid,
  p_date date
)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_venue_id is null or p_date is null then
    return false;
  end if;

  return exists (
    select 1
    from public.tour_availability_exceptions tae
    where tae.venue_id = p_venue_id
      and (
        (
          coalesce(tae.recurrence_rule, 'none') = 'none'
          and tae.start_date <= p_date
          and tae.end_date >= p_date
        )
        or (
          coalesce(tae.recurrence_rule, 'none') = 'annual'
          and public.calendar_block_covers_interval(
            tae.start_date,
            tae.end_date,
            true,
            null,
            null,
            'annual',
            1,
            null,
            null,
            p_date,
            p_date,
            time '00:00',
            time '23:59'
          )
        )
      )
  );
end;
$$;

comment on function public.tour_availability_exception_covers_date(uuid, date) is
  'True when a tour_availability_exceptions row (one-time or annual) closes this venue-local date.';

revoke all on function public.tour_availability_exception_covers_date(uuid, date) from public;
grant execute on function public.tour_availability_exception_covers_date(uuid, date)
  to anon, authenticated, service_role;

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

  -- Authoritative venue closures: Blocked Dates (tour exceptions) and
  -- calendar_blocks that occupy Event availability. Checked before any
  -- occupancy/hold path can return true.
  if public.tour_availability_exception_covers_date(p_venue_id, p_date) then
    return false;
  end if;

  if public.covering_calendar_block_title(
    p_venue_id, p_date, p_date, time '00:00', time '23:59', null
  ) is not null then
    return false;
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
      return false;
    end if;
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

comment on function public._is_event_date_available(uuid, date) is
  'Public/inquiry date authority: tour Blocked Dates (incl. annual), covering calendar_blocks, holds, and event occupancy.';
