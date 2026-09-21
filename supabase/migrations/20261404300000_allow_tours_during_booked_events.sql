-- Venue setting: may a tour overlap a booked event?
--
-- Default false preserves the previous behavior: a booked event's
-- operational window blocks a tour. True skips only that check.
-- Tour windows, exceptions, simultaneous tour capacity, tour scheduling
-- on/off, and calendar blockers are unchanged.
-- This does not change Booked Event concurrency or the event availability trigger.

alter table public.venues
  add column if not exists allow_tours_during_booked_events boolean not null default false;

comment on column public.venues.allow_tours_during_booked_events is
  'When true, a tour may be scheduled during a booked event. When false, that overlap is refused. Default keeps the previous behavior for every existing venue.';

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
  v_allow_during_events boolean;
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

  select coalesce(v.allow_tours_during_booked_events, false)
    into v_allow_during_events
  from public.venues v
  where v.id = p_venue_id;

  -- Booked-event overlap uses the same operational window as before.
  -- The venue setting skips only this check.
  if not coalesce(v_allow_during_events, false) then
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
  end if;

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
  'Tour slot blocked by window fit, live tour capacity, a booked event when the venue does not allow tours during booked events, closing calendar blocks, and exceptions. The venue setting does not disable the other checks.';
