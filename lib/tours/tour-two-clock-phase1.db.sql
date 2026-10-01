-- Phase 1 (D1–D2) focused proofs for tour two-clock schema + occupancy.
-- Wrapped by the Node test in a transaction that always rolls back.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_sched   uuid;
  v_walk    uuid;
  v_done    uuid;
  v_count   integer;
  v_blocked boolean;
  v_origin  text;
  v_sched_at timestamptz;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'tour-two-clock-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, tour_duration_minutes, tour_buffer_minutes, timezone)
  values (v_venue, v_owner, 'Tour Two Clock Phase1', 60, 30, 'UTC');

  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;

  -- 1. scheduled row remains valid (default origin + scheduled_at)
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-07-01 10:00:00+00', 60, 'scheduled', 'Scheduled OK')
  returning id, origin into v_sched, v_origin;
  if v_origin is distinct from 'scheduled' then
    raise exception 'existing-shape insert must default origin=scheduled, got %', v_origin;
  end if;
  if (select scheduled_at from public.tour_appointments where id = v_sched) is null then
    raise exception 'scheduled row must keep scheduled_at';
  end if;

  -- 2. scheduled without scheduled_at rejected
  begin
    insert into public.tour_appointments (
      venue_id, scheduled_at, duration_minutes, status, contact_name, origin
    ) values (
      v_venue, null, 60, 'scheduled', 'Missing schedule', 'scheduled'
    );
    raise exception 'scheduled without scheduled_at must be rejected';
  exception
    when check_violation then null;
    when others then
      if sqlstate = '23514' then null;
      else raise;
      end if;
  end;

  -- 3. walk-in without actual rejected
  begin
    insert into public.tour_appointments (
      venue_id, scheduled_at, duration_minutes, status, contact_name, origin, actual_occurred_at
    ) values (
      v_venue, null, 60, 'completed', 'Walk no actual', 'walk_in', null
    );
    raise exception 'walk-in without actual_occurred_at must be rejected';
  exception
    when check_violation then null;
    when others then
      if sqlstate = '23514' then null;
      else raise;
      end if;
  end;

  -- 4. walk-in with scheduled_at rejected
  begin
    insert into public.tour_appointments (
      venue_id, scheduled_at, duration_minutes, status, contact_name, origin, actual_occurred_at
    ) values (
      v_venue, '2099-07-01 12:00:00+00', 60, 'completed', 'Walk with schedule', 'walk_in',
      '2099-07-01 12:05:00+00'
    );
    raise exception 'walk-in with scheduled_at must be rejected';
  exception
    when check_violation then null;
    when others then
      if sqlstate = '23514' then null;
      else raise;
      end if;
  end;

  -- 5. walk-in completed row accepted
  insert into public.tour_appointments (
    venue_id, scheduled_at, duration_minutes, status, contact_name, origin, actual_occurred_at
  ) values (
    v_venue, null, 60, 'completed', 'Walk OK', 'walk_in', '2099-07-01 10:00:00+00'
  ) returning id into v_walk;

  -- 6. completed / no_show do not occupy
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-07-02 10:00:00+00', 60, 'scheduled', 'Will complete')
  returning id into v_done;
  update public.tour_appointments set status = 'completed' where id = v_done;

  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-07-02 10:00:00+00', 60, 'scheduled', 'After complete');

  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-07-02 14:00:00+00', 60, 'scheduled', 'Will no-show')
  returning id into v_done;
  update public.tour_appointments set status = 'no_show' where id = v_done;
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-07-02 14:00:00+00', 60, 'scheduled', 'After no-show');

  -- 7. walk-in does not occupy (same clock as a live scheduled tour under max=1)
  delete from public.tour_appointments where venue_id = v_venue;
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-07-03 10:00:00+00', 60, 'scheduled', 'Live slot')
  returning id into v_sched;

  insert into public.tour_appointments (
    venue_id, scheduled_at, duration_minutes, status, contact_name, origin, actual_occurred_at
  ) values (
    v_venue, null, 60, 'completed', 'Walk same clock', 'walk_in', '2099-07-03 10:00:00+00'
  );

  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-07-03 10:00:00+00', 60, 'scheduled', 'Second live');
    raise exception 'second live tour must still be capacity-blocked with walk-in present';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-07-03 10:00:00+00'::timestamptz, '2099-07-03 11:00:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'occupancy must still see the live scheduled row';
  end if;

  select count(*)::integer into v_count
  from public.tour_appointments ta
  where ta.venue_id = v_venue
    and ta.status in ('scheduled', 'confirmed')
    and ta.scheduled_at is not null
    and ta.scheduled_at < '2099-07-03 11:00:00+00'::timestamptz
    and ta.scheduled_at + (ta.duration_minutes || ' minutes')::interval > '2099-07-03 10:00:00+00'::timestamptz;
  if v_count <> 1 then
    raise exception 'occupying count must be 1 (walk-in excluded), got %', v_count;
  end if;

  -- 8+9. actual_occurred_at-only and completion must not invoke availability
  -- Proof: remove all windows so any _is_tour_slot_blocked call returns true.
  delete from public.tour_availability_windows where venue_id = v_venue;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-07-03 10:00:00+00'::timestamptz, '2099-07-03 11:00:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'precondition: slot must be blocked after windows removed';
  end if;

  update public.tour_appointments
     set actual_occurred_at = '2099-07-03 10:07:00+00'
   where id = v_sched;
  if (select actual_occurred_at from public.tour_appointments where id = v_sched)
       is distinct from '2099-07-03 10:07:00+00'::timestamptz then
    raise exception 'actual_occurred_at-only update must succeed without availability';
  end if;

  v_sched_at := (select scheduled_at from public.tour_appointments where id = v_sched);
  update public.tour_appointments
     set status = 'completed'
   where id = v_sched;
  if (select status from public.tour_appointments where id = v_sched) is distinct from 'completed' then
    raise exception 'completion must succeed without availability';
  end if;
  if (select scheduled_at from public.tour_appointments where id = v_sched) is distinct from v_sched_at then
    raise exception 'completion must not change scheduled_at';
  end if;

  -- notes / follow_up / origin-only must also succeed with windows gone
  update public.tour_appointments
     set notes = 'phase1 note', follow_up_sent_at = now()
   where id = v_sched;
  -- origin-only on a completed walk-in shape is rejected by clocks; use a fresh walk-in
  insert into public.tour_appointments (
    venue_id, scheduled_at, duration_minutes, status, contact_name, origin, actual_occurred_at, notes
  ) values (
    v_venue, null, 60, 'completed', 'Walk notes', 'walk_in', '2099-07-04 09:00:00+00', 'n1'
  ) returning id into v_walk;
  update public.tour_appointments set notes = 'n2' where id = v_walk;

  -- 10. existing future scheduling / rescheduling capacity behavior remains intact
  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;

  delete from public.tour_appointments where venue_id = v_venue;
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-07-05 10:00:00+00', 60, 'scheduled', 'Cap A')
  returning id into v_sched;
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-07-05 14:00:00+00', 60, 'scheduled', 'Cap B')
  returning id into v_done;

  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-07-05 10:00:00+00', 60, 'scheduled', 'Cap clash');
    raise exception 'overlapping future schedule must still be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  begin
    update public.tour_appointments
       set scheduled_at = '2099-07-05 10:00:00+00'
     where id = v_done;
    raise exception 'conflicting reschedule must still be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;
  if (select scheduled_at from public.tour_appointments where id = v_done)
       is distinct from '2099-07-05 14:00:00+00'::timestamptz then
    raise exception 'failed reschedule must leave original scheduled_at unchanged';
  end if;

  -- Successful non-overlapping reschedule still works
  update public.tour_appointments
     set scheduled_at = '2099-07-05 16:00:00+00'
   where id = v_done;
  if (select scheduled_at from public.tour_appointments where id = v_done)
       is distinct from '2099-07-05 16:00:00+00'::timestamptz then
    raise exception 'non-overlapping reschedule must succeed';
  end if;

  raise notice 'tour_two_clock_phase1_ok';
end;
$$;
