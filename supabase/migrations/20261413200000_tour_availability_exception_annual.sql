-- Tour Blocked Dates — annual recurrence (rule-based, not materialised per year).
-- Reuses calendar_block_covers_interval / _calendar_occurrence_starts for date math.

alter table public.tour_availability_exceptions
  add column if not exists recurrence_rule text not null default 'none';

alter table public.tour_availability_exceptions
  drop constraint if exists tour_availability_exceptions_recurrence_rule_check;

alter table public.tour_availability_exceptions
  add constraint tour_availability_exceptions_recurrence_rule_check
  check (recurrence_rule in ('none', 'annual'));

comment on column public.tour_availability_exceptions.recurrence_rule is
  'none = one-time range on start_date..end_date; annual = same month/day span every year (rule-based).';

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
  v_local_date date;
begin
  if not public._tour_slot_fits_window(p_venue_id, p_slot_start, p_slot_end) then
    return true;
  end if;

  v_max := public._tour_effective_max_simultaneous(p_venue_id);
  select count(*)::integer into v_count
  from public.tour_appointments ta
  where ta.venue_id = p_venue_id
    and ta.status in ('scheduled', 'confirmed')
    and ta.scheduled_at is not null
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

  v_local_date := v_local_start::date;
  select exists(
    select 1 from public.tour_availability_exceptions tae
    where tae.venue_id = p_venue_id
      and (
        (
          coalesce(tae.recurrence_rule, 'none') = 'none'
          and tae.start_date <= v_local_date
          and tae.end_date   >= v_local_date
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
            v_local_date,
            v_local_date,
            time '00:00',
            time '23:59'
          )
        )
      )
  ) into v_blocked;
  return v_blocked;
end;
$$;

comment on function public._is_tour_slot_blocked(uuid, timestamptz, timestamptz, uuid) is
  'Tour slot blocked by window fit, occupancy, booked events (unless allowed), closing calendar blocks, and tour_availability_exceptions (one-time or annual).';

create or replace function public.get_coordinator_tour_availability()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  return jsonb_build_object(
    'ok', true,
    'windows', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', w.id,
          'dayOfWeek', w.day_of_week,
          'startTime', substring(w.start_time::text, 1, 5),
          'endTime', substring(w.end_time::text, 1, 5),
          'sortOrder', w.sort_order
        )
        order by w.day_of_week, w.sort_order, w.start_time
      ), '[]'::jsonb)
      from public.tour_availability_windows w
      where w.venue_id = v_venue_id
    ),
    'exceptions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'startDate', e.start_date,
          'endDate', e.end_date,
          'label', e.label,
          'recurrenceRule', coalesce(e.recurrence_rule, 'none')
        )
        order by e.start_date
      ), '[]'::jsonb)
      from public.tour_availability_exceptions e
      where e.venue_id = v_venue_id
    )
  );
end;
$$;

revoke all on function public.get_coordinator_tour_availability() from public, anon;
grant execute on function public.get_coordinator_tour_availability() to authenticated;
