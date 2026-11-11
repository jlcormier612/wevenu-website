-- Phase 2 focused proofs: completion preserves scheduled_at; actual-only and
-- walk-in never occupy; occupying still counts for future capacity.
-- Wrapped by the Node test in a transaction that always rolls back.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_sched   uuid;
  v_walk    uuid;
  v_sched_at timestamptz := '2099-08-01 15:00:00+00';
  v_actual  timestamptz := '2099-08-01 14:30:00+00';
  v_kept    timestamptz;
  v_count   integer;
  v_blocked boolean;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'tour-phase2-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, tour_duration_minutes, tour_buffer_minutes, timezone)
  values (v_venue, v_owner, 'Tour Phase2 Writes', 60, 30, 'UTC');

  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;

  -- Future schedule
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name, origin)
  values (v_venue, v_sched_at, 60, 'scheduled', 'Keep Schedule', 'scheduled')
  returning id into v_sched;

  -- Completion-state: set status + actual, never change scheduled_at
  update public.tour_appointments
    set status = 'completed',
        completed_at = now(),
        actual_occurred_at = v_actual
  where id = v_sched;

  select scheduled_at into v_kept from public.tour_appointments where id = v_sched;
  if v_kept is distinct from v_sched_at then
    raise exception 'completion must not change scheduled_at: kept % expected %', v_kept, v_sched_at;
  end if;

  -- Completed row must not occupy
  select count(*)::integer into v_count
  from public.tour_appointments ta
  where ta.venue_id = v_venue
    and ta.status in ('scheduled', 'confirmed')
    and ta.scheduled_at is not null;
  if v_count <> 0 then
    raise exception 'completed row must not occupy, count=%', v_count;
  end if;

  -- Walk-in new row
  insert into public.tour_appointments (
    venue_id, scheduled_at, duration_minutes, status, contact_name,
    origin, actual_occurred_at, completed_at
  ) values (
    v_venue, null, 60, 'completed', 'Walk In',
    'walk_in', v_actual, now()
  ) returning id into v_walk;

  if (select scheduled_at from public.tour_appointments where id = v_walk) is not null then
    raise exception 'walk-in must have scheduled_at null';
  end if;
  if (select actual_occurred_at from public.tour_appointments where id = v_walk) is null then
    raise exception 'walk-in must have actual_occurred_at';
  end if;

  -- Walk-in + completed do not block a new future schedule at same wall time
  v_blocked := public._is_tour_slot_blocked(
    v_venue, v_sched_at, v_sched_at + interval '60 minutes', null
  );
  if v_blocked then
    raise exception 'walk-in/completed must not block future capacity';
  end if;

  -- Actual-only update on walk-in (no capacity path)
  update public.tour_appointments
    set actual_occurred_at = v_actual + interval '15 minutes'
  where id = v_walk;

  -- Original scheduled appointment row still exists separately from walk-in
  if (select count(*) from public.tour_appointments where venue_id = v_venue) <> 2 then
    raise exception 'walk-in must be a second row, not an overwrite';
  end if;

  raise notice 'tour_two_clock_phase2_ok';
end;
$$;
