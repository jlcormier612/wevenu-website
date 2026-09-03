-- ============================================================================
-- Recurring calendar_blocks coverage
--
-- Calendar display already expands recurrence_rule via lib/calendar/recurrence.ts.
-- Availability still treated a series as only its first start_date/end_date span,
-- so "Every Sunday 9:00–5:00" could show on the calendar while an Event on a
-- later Sunday was accepted.
--
-- This migration adds one covering evaluator used by:
--   - events_enforce_availability (any covering type; after occupancy)
--   - _is_event_date_available (full-day 00:00–23:59, any type)
--   - _is_tour_slot_blocked (closing types only, venue-local slot clock)
--
-- Recurrence math matches expandOccurrenceStarts: calendar-date arithmetic on
-- venue-local date columns, not UTC wall-clock. Timed blocks overlap the
-- Event/Tour operational window (touching endpoints do not overlap).
--
-- Race: Event writes take occupancy-day locks first (unchanged), then a
-- venue-wide calendar-blocks advisory lock before covering evaluation.
-- calendar_blocks writes lock occupancy days for the first span and any finite
-- series bound, then the same calendar-blocks lock, so a committed recurring
-- block cannot be raced past by an Event covering check.
-- ============================================================================

create or replace function public._calendar_add_months(p_date date, p_months integer)
returns date
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v_y int := extract(year from p_date)::int;
  v_m int := extract(month from p_date)::int - 1;
  v_d int := extract(day from p_date)::int;
  v_ty int;
  v_tm int;
  v_last int;
begin
  v_ty := v_y + floor((v_m + p_months)::numeric / 12)::int;
  v_tm := ((v_m + p_months) % 12 + 12) % 12;
  v_last := extract(day from (make_date(v_ty, v_tm + 1, 1) + interval '1 month' - interval '1 day'))::int;
  return make_date(v_ty, v_tm + 1, least(v_d, v_last));
end;
$$;

create or replace function public._calendar_occurrence_starts(
  p_start_date date,
  p_end_date date,
  p_rule text,
  p_interval integer,
  p_ends_on date,
  p_count integer,
  p_window_start date,
  p_window_end date
)
returns setof date
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v_duration int := greatest(0, coalesce(p_end_date, p_start_date) - p_start_date);
  v_interval int := greatest(1, coalesce(p_interval, 1));
  v_rule text := coalesce(p_rule, 'none');
  v_cursor date := p_start_date;
  v_emitted int := 0;
  i int;
begin
  if p_start_date is null or p_window_start is null or p_window_end is null then
    return;
  end if;

  if v_rule = 'none' then
    if p_start_date <= p_window_end
       and (p_start_date + v_duration) >= p_window_start then
      return next p_start_date;
    end if;
    return;
  end if;

  for i in 1..10000 loop
    if p_ends_on is not null and v_cursor > p_ends_on then
      exit;
    end if;
    if p_count is not null and p_count > 0 and v_emitted >= p_count then
      exit;
    end if;
    if v_cursor > p_window_end then
      exit;
    end if;

    if (v_cursor + v_duration) >= p_window_start then
      return next v_cursor;
    end if;
    v_emitted := v_emitted + 1;

    if v_rule = 'daily' then
      v_cursor := v_cursor + v_interval;
    elsif v_rule = 'weekly' then
      v_cursor := v_cursor + (7 * v_interval);
    elsif v_rule = 'monthly' then
      v_cursor := public._calendar_add_months(v_cursor, v_interval);
    elsif v_rule = 'annual' then
      v_cursor := public._calendar_add_months(v_cursor, 12 * v_interval);
    else
      exit;
    end if;
  end loop;
end;
$$;

create or replace function public._calendar_block_clock_window(
  p_is_all_day boolean,
  p_start_time time,
  p_end_time time
)
returns table(window_start time, window_end time)
language sql
immutable
parallel safe
as $$
  select
    case
      when coalesce(p_is_all_day, true) or p_start_time is null or p_end_time is null
        then time '00:00'
      else p_start_time
    end,
    case
      when coalesce(p_is_all_day, true) or p_start_time is null or p_end_time is null
        then time '23:59'
      else p_end_time
    end;
$$;

create or replace function public.calendar_block_covers_interval(
  p_start_date date,
  p_end_date date,
  p_is_all_day boolean,
  p_start_time time,
  p_end_time time,
  p_recurrence_rule text,
  p_recurrence_interval integer,
  p_recurrence_ends_on date,
  p_recurrence_count integer,
  p_range_start date,
  p_range_end date,
  p_window_start time,
  p_window_end time
)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v_block_start time;
  v_block_end time;
begin
  if p_start_date is null or p_range_start is null or p_range_end is null then
    return false;
  end if;

  select w.window_start, w.window_end
    into v_block_start, v_block_end
  from public._calendar_block_clock_window(p_is_all_day, p_start_time, p_end_time) w;

  if not (p_window_start < v_block_end and v_block_start < p_window_end) then
    return false;
  end if;

  return exists (
    select 1
    from public._calendar_occurrence_starts(
      p_start_date,
      coalesce(p_end_date, p_start_date),
      p_recurrence_rule,
      p_recurrence_interval,
      p_recurrence_ends_on,
      p_recurrence_count,
      p_range_start,
      p_range_end
    )
  );
end;
$$;

create or replace function public.covering_calendar_block_title(
  p_venue_id uuid,
  p_range_start date,
  p_range_end date,
  p_window_start time,
  p_window_end time,
  p_types text[] default null
)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_title text;
begin
  select cb.title into v_title
  from public.calendar_blocks cb
  where cb.venue_id = p_venue_id
    and cb.start_date <= p_range_end
    and (
      (
        coalesce(cb.recurrence_rule, 'none') = 'none'
        and cb.end_date >= p_range_start
      )
      or (
        coalesce(cb.recurrence_rule, 'none') is distinct from 'none'
        and (
          cb.recurrence_ends_on is null
          or (cb.recurrence_ends_on + (cb.end_date - cb.start_date)) >= p_range_start
        )
      )
    )
    and (p_types is null or cb.type = any (p_types))
    and public.calendar_block_covers_interval(
      cb.start_date,
      cb.end_date,
      cb.is_all_day,
      cb.start_time,
      cb.end_time,
      cb.recurrence_rule,
      cb.recurrence_interval,
      cb.recurrence_ends_on,
      cb.recurrence_count,
      p_range_start,
      p_range_end,
      p_window_start,
      p_window_end
    )
  order by cb.start_date, cb.title
  limit 1;
  return v_title;
end;
$$;

create or replace function public.calendar_block_lock_end_date(
  p_start_date date,
  p_end_date date,
  p_rule text,
  p_interval integer,
  p_ends_on date,
  p_count integer
)
returns date
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  v_duration int := greatest(0, coalesce(p_end_date, p_start_date) - p_start_date);
  v_interval int := greatest(1, coalesce(p_interval, 1));
  v_rule text := coalesce(p_rule, 'none');
  v_cursor date := p_start_date;
  v_last date := coalesce(p_end_date, p_start_date);
  v_emitted int := 0;
  i int;
begin
  if p_start_date is null then
    return p_end_date;
  end if;
  if v_rule = 'none' then
    return coalesce(p_end_date, p_start_date);
  end if;
  if p_ends_on is null and (p_count is null or p_count < 1) then
    return coalesce(p_end_date, p_start_date);
  end if;

  for i in 1..10000 loop
    if p_ends_on is not null and v_cursor > p_ends_on then
      exit;
    end if;
    if p_count is not null and p_count > 0 and v_emitted >= p_count then
      exit;
    end if;
    v_last := v_cursor + v_duration;
    v_emitted := v_emitted + 1;
    if v_rule = 'daily' then
      v_cursor := v_cursor + v_interval;
    elsif v_rule = 'weekly' then
      v_cursor := v_cursor + (7 * v_interval);
    elsif v_rule = 'monthly' then
      v_cursor := public._calendar_add_months(v_cursor, v_interval);
    elsif v_rule = 'annual' then
      v_cursor := public._calendar_add_months(v_cursor, 12 * v_interval);
    else
      exit;
    end if;
  end loop;
  return v_last;
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

  if public.covering_calendar_block_title(
    p_venue_id, p_date, p_date, time '00:00', time '23:59', null
  ) is not null then
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
  v_win_start time;
  v_win_end time;
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

  return NEW;
end;
$$;

create or replace function public.calendar_blocks_lock_event_days()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lock_end date;
  v_old_lock_end date;
begin
  v_lock_end := public.calendar_block_lock_end_date(
    NEW.start_date,
    NEW.end_date,
    NEW.recurrence_rule,
    NEW.recurrence_interval,
    NEW.recurrence_ends_on,
    NEW.recurrence_count
  );
  perform public.lock_event_occupancy_days(NEW.venue_id, NEW.start_date, v_lock_end);
  if TG_OP = 'UPDATE' then
    v_old_lock_end := public.calendar_block_lock_end_date(
      OLD.start_date,
      OLD.end_date,
      OLD.recurrence_rule,
      OLD.recurrence_interval,
      OLD.recurrence_ends_on,
      OLD.recurrence_count
    );
    perform public.lock_event_occupancy_days(OLD.venue_id, OLD.start_date, v_old_lock_end);
  end if;
  perform pg_advisory_xact_lock(hashtext(NEW.venue_id::text), hashtext('calendar-blocks'));
  if TG_OP = 'UPDATE' and OLD.venue_id is distinct from NEW.venue_id then
    perform pg_advisory_xact_lock(hashtext(OLD.venue_id::text), hashtext('calendar-blocks'));
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
  before update of start_date, end_date, venue_id, recurrence_rule, recurrence_interval,
    recurrence_ends_on, recurrence_count, is_all_day, start_time, end_time
  on public.calendar_blocks
  for each row
  execute function public.calendar_blocks_lock_event_days();

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

comment on function public.covering_calendar_block_title(uuid, date, date, time, time, text[]) is
  'First calendar_blocks title covering a venue-local date range + clock window, including recurrence. p_types null = any type (Events); otherwise filter (Tours).';
comment on function public.calendar_block_covers_interval(date, date, boolean, time, time, text, integer, date, integer, date, date, time, time) is
  'Whether one calendar_blocks row covers a venue-local interval. Recurrence matches expandOccurrenceStarts.';

grant execute on function public.covering_calendar_block_title(uuid, date, date, time, time, text[])
  to authenticated, service_role;
grant execute on function public.calendar_block_covers_interval(date, date, boolean, time, time, text, integer, date, integer, date, date, time, time)
  to authenticated, service_role;
grant execute on function public._calendar_occurrence_starts(date, date, text, integer, date, integer, date, date)
  to authenticated, service_role;

notify pgrst, 'reload schema';
