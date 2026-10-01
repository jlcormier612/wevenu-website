-- Phase 1 (Tour / Space / Smart-Field contract D1–D2):
-- Two-clock tour_appointments schema + occupancy/trigger scope.
--
-- D1: actual_occurred_at, origin, nullable scheduled_at, tour_appointment_clocks,
--     walk-in calendar index. No backfill of actual_occurred_at.
-- D2: occupying tours require scheduled_at IS NOT NULL; availability trigger
--     runs only for occupying future scheduled/confirmed writes.

-- ---------------------------------------------------------------------------
-- D1. Schema
-- ---------------------------------------------------------------------------

alter table public.tour_appointments
  add column if not exists actual_occurred_at timestamptz,
  add column if not exists origin text not null default 'scheduled';

alter table public.tour_appointments
  drop constraint if exists tour_appointments_origin_check;

alter table public.tour_appointments
  add constraint tour_appointments_origin_check
  check (origin in ('scheduled', 'walk_in'));

-- Existing rows keep scheduled_at; only walk-ins may omit it going forward.
alter table public.tour_appointments
  alter column scheduled_at drop not null;

alter table public.tour_appointments
  drop constraint if exists tour_appointment_clocks;

alter table public.tour_appointments
  add constraint tour_appointment_clocks check (
    (origin = 'scheduled' and scheduled_at is not null)
    or
    (
      origin = 'walk_in'
      and scheduled_at is null
      and actual_occurred_at is not null
      and status = 'completed'
    )
  );

comment on column public.tour_appointments.actual_occurred_at is
  'When the tour actually occurred (historical clock). Never overwrites scheduled_at. Null until known; not backfilled for existing rows.';
comment on column public.tour_appointments.origin is
  'scheduled = appointment on the calendar; walk_in = occurred without a prior schedule. Default scheduled for existing rows.';
comment on constraint tour_appointment_clocks on public.tour_appointments is
  'scheduled rows require scheduled_at; walk-ins require null scheduled_at, non-null actual_occurred_at, and status completed.';

-- Existing (venue_id, scheduled_at) indexes remain untouched.
create index if not exists tour_appointments_venue_walk_in_occurred
  on public.tour_appointments (venue_id, actual_occurred_at)
  where origin = 'walk_in' and scheduled_at is null;

-- ---------------------------------------------------------------------------
-- D2. Occupancy query — latest body from 202614043 + scheduled_at IS NOT NULL
-- ---------------------------------------------------------------------------

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
  'Tour slot blocked by window fit, live scheduled/confirmed occupancy with non-null scheduled_at, a booked event when the venue does not allow tours during booked events, closing calendar blocks, and exceptions. Completed/no-show/cancelled/walk-in rows do not consume capacity.';

-- ---------------------------------------------------------------------------
-- D2. Availability trigger — occupying future scheduled rows only
-- ---------------------------------------------------------------------------

create or replace function public.tour_appointments_enforce_availability()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_end timestamptz;
  v_old_end timestamptz;
  v_clock_changed boolean;
  v_entered_occupying boolean;
begin
  -- Walk-ins and any null-schedule row never occupy and never re-check.
  if NEW.scheduled_at is null then
    return NEW;
  end if;

  -- Only occupying statuses are checked. Completion / no-show / cancel skip.
  if NEW.status is distinct from 'scheduled' and NEW.status is distinct from 'confirmed' then
    return NEW;
  end if;

  v_new_end := NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval;

  if TG_OP = 'UPDATE' then
    v_clock_changed :=
         OLD.scheduled_at is distinct from NEW.scheduled_at
      or OLD.duration_minutes is distinct from NEW.duration_minutes;
    -- Status moved into occupying (e.g. cancelled → scheduled/confirmed).
    v_entered_occupying :=
         OLD.status is distinct from NEW.status
     and OLD.status is distinct from 'scheduled'
     and OLD.status is distinct from 'confirmed';
    -- Occupying + clocks unchanged (e.g. scheduled → confirmed) → no re-check.
    if not v_clock_changed and not v_entered_occupying then
      return NEW;
    end if;

    v_old_end := case
      when OLD.scheduled_at is null then null
      else OLD.scheduled_at + (OLD.duration_minutes || ' minutes')::interval
    end;
    perform public.lock_tour_occupancy_interval(
      NEW.venue_id,
      NEW.scheduled_at, v_new_end,
      OLD.scheduled_at, v_old_end
    );
  else
    perform public.lock_tour_occupancy_interval(
      NEW.venue_id,
      NEW.scheduled_at, v_new_end
    );
  end if;

  -- Same venue-wide key as events_enforce_availability / calendar_blocks writes.
  perform pg_advisory_xact_lock(hashtext(NEW.venue_id::text), hashtext('calendar-blocks'));

  if public._is_tour_slot_blocked(
    NEW.venue_id,
    NEW.scheduled_at,
    v_new_end,
    NEW.id
  ) then
    raise exception 'This tour time is no longer available.'
      using errcode = 'P0001',
            hint = 'tour_at_capacity';
  end if;

  return NEW;
end;
$$;

comment on function public.tour_appointments_enforce_availability() is
  'Lock + Tour window/exception/capacity/Event-operational-window check only for occupying scheduled/confirmed rows with non-null scheduled_at. Skips walk-ins, completion/no-show/cancel, and clock-unchanged status-only updates.';

drop trigger if exists tour_appointments_enforce_availability_ins on public.tour_appointments;
create trigger tour_appointments_enforce_availability_ins
  before insert on public.tour_appointments
  for each row
  when (
    NEW.status in ('scheduled', 'confirmed')
    and NEW.scheduled_at is not null
  )
  execute function public.tour_appointments_enforce_availability();

drop trigger if exists tour_appointments_enforce_availability_upd on public.tour_appointments;
create trigger tour_appointments_enforce_availability_upd
  before update of scheduled_at, duration_minutes, status
  on public.tour_appointments
  for each row
  when (
    NEW.status in ('scheduled', 'confirmed')
    and NEW.scheduled_at is not null
    and (
         OLD.scheduled_at is distinct from NEW.scheduled_at
      or OLD.duration_minutes is distinct from NEW.duration_minutes
      or OLD.status is distinct from NEW.status
    )
  )
  execute function public.tour_appointments_enforce_availability();

notify pgrst, 'reload schema';
