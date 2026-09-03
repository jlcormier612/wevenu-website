-- ============================================================================
-- K.7 Phase 3 — transactional Event write enforcement
--
-- Occupancy authority remains public.assert_event_availability (Phase 2).
-- This migration does not change those rules. It composes the assert into
-- the Event write so the advisory lock is never released before INSERT/
-- UPDATE.
--
-- Mechanism:
--   BEFORE INSERT/UPDATE trigger on public.events calls
--   assert_event_availability in the same transaction as the write.
--   Edits lock the union of old and new protected days in ascending date
--   order before asserting, to avoid deadlock.
--
-- Direct table writes, Event create/edit, Book This Lead, Direct Add
-- Client, status restore, and white-glove import all hit this trigger.
-- Do not call assert_event_availability as a standalone PostgREST RPC
-- then INSERT/UPDATE in a later round trip.
-- ============================================================================

create or replace function public.lock_event_occupancy_days(
  p_venue_id uuid,
  p_start date,
  p_end date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_day date;
  v_end date := coalesce(p_end, p_start);
begin
  if p_venue_id is null or p_start is null then
    return;
  end if;
  if v_end < p_start then
    v_end := p_start;
  end if;
  v_day := p_start;
  while v_day <= v_end loop
    perform pg_advisory_xact_lock(hashtext(p_venue_id::text), hashtext(v_day::text));
    v_day := v_day + 1;
  end loop;
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

    v_old_start := OLD.event_date;
    v_old_end := coalesce(OLD.event_end_date, OLD.event_date);
    if v_old_end < v_old_start then
      v_old_end := v_old_start;
    end if;
    v_new_start := NEW.event_date;
    v_new_end := coalesce(NEW.event_end_date, NEW.event_date);
    if v_new_end < v_new_start then
      v_new_end := v_new_start;
    end if;

    -- Union of old and new protected days, ascending, before the assert
    -- (which re-locks the new range). Same lock keys as Phase 2.
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

drop trigger if exists events_enforce_availability_ins on public.events;
create trigger events_enforce_availability_ins
  before insert on public.events
  for each row
  execute function public.events_enforce_availability();

drop trigger if exists events_enforce_availability_upd on public.events;
create trigger events_enforce_availability_upd
  before update of event_date, event_end_date, setup_time, start_time, end_time, teardown_time, space_id, status
  on public.events
  for each row
  when (
       OLD.event_date is distinct from NEW.event_date
    or OLD.event_end_date is distinct from NEW.event_end_date
    or OLD.setup_time is distinct from NEW.setup_time
    or OLD.start_time is distinct from NEW.start_time
    or OLD.end_time is distinct from NEW.end_time
    or OLD.teardown_time is distinct from NEW.teardown_time
    or OLD.space_id is distinct from NEW.space_id
    or OLD.status is distinct from NEW.status
  )
  execute function public.events_enforce_availability();

comment on function public.events_enforce_availability() is
  'K.7 Phase 3: assert occupancy in the same transaction as events INSERT/UPDATE. Locks old+new protected days on edit.';

-- Dated Client create (Direct Add / Book This Lead): Client + Event in one
-- transaction so an occupancy refusal rolls back the Client too.
create or replace function public.create_client_and_event_with_availability(
  payload jsonb,
  p_event jsonb,
  p_venue_id_override uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_client_id uuid;
  v_venue_id uuid;
  v_event_id uuid;
  v_event_date date;
  v_event_end date;
  v_name text;
begin
  v_name := nullif(trim(p_event ->> 'name'), '');
  v_event_date := nullif(p_event ->> 'eventDate', '')::date;
  if v_name is null or v_event_date is null then
    raise exception 'event name and event date are required';
  end if;
  v_event_end := nullif(p_event ->> 'eventEndDate', '')::date;
  if v_event_end is not null and v_event_end = v_event_date then
    v_event_end := null;
  end if;

  v_client_id := public.create_client_atomic(payload, p_venue_id_override);

  select c.venue_id into v_venue_id
  from public.clients c
  where c.id = v_client_id;

  insert into public.events (
    venue_id, client_id, space_id, name, event_type,
    event_date, event_end_date, start_time, end_time, setup_time, teardown_time, guest_count
  ) values (
    v_venue_id,
    v_client_id,
    nullif(trim(p_event ->> 'spaceId'), '')::uuid,
    v_name,
    nullif(p_event ->> 'eventType', ''),
    v_event_date,
    v_event_end,
    nullif(p_event ->> 'startTime', '')::time,
    nullif(p_event ->> 'endTime', '')::time,
    nullif(p_event ->> 'setupTime', '')::time,
    nullif(p_event ->> 'teardownTime', '')::time,
    nullif(regexp_replace(coalesce(p_event ->> 'guestCount', ''), '[^0-9]', '', 'g'), '')::integer
  )
  returning id into v_event_id;

  return jsonb_build_object('ok', true, 'client_id', v_client_id, 'event_id', v_event_id);
end;
$$;

comment on function public.create_client_and_event_with_availability(jsonb, jsonb, uuid) is
  'K.7 Phase 3: create Client + dated Event in one transaction. Occupancy is enforced by events_enforce_availability.';

grant execute on function public.lock_event_occupancy_days(uuid, date, date)
  to authenticated, service_role;
grant execute on function public.create_client_and_event_with_availability(jsonb, jsonb, uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
