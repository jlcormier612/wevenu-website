-- K.7 Phase 4 live Tour capacity tests. Wrapped by the Node test in a
-- transaction that always rolls back.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_a       uuid;
  v_b       uuid;
  v_c       uuid;
  v_count   integer;
  v_blocked boolean;
  v_slots   jsonb;
  v_day     date;
  v_dow     smallint;
  v_orig    timestamptz;
  v_locks   integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'k7-phase4-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, tour_duration_minutes, tour_buffer_minutes, timezone)
  values (v_venue, v_owner, 'K7 Phase4 Tour Fixture', 60, 30, 'UTC');

  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;

  -- one Tour within capacity succeeds (missing rules row → max 1)
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-06-15 10:00:00+00', 60, 'scheduled', 'One')
  returning id into v_a;

  -- appointment exceeding capacity is rejected
  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-06-15 10:00:00+00', 60, 'scheduled', 'Overlap');
    raise exception 'overlapping Tour at max=1 must be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  -- sequential / non-overlapping Tours succeed; touching endpoints are sequential
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-06-15 11:00:00+00', 60, 'scheduled', 'Sequential')
  returning id into v_b;

  -- overlapping interval interior is rejected
  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-06-15 10:30:00+00', 60, 'scheduled', 'Interior');
    raise exception 'interior overlap must be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  -- cancelled Tour does not consume capacity
  update public.tour_appointments set status = 'cancelled' where id = v_a;
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-06-15 10:00:00+00', 60, 'scheduled', 'After cancel')
  returning id into v_c;

  -- editing an appointment excludes itself
  update public.tour_appointments
     set scheduled_at = '2099-06-15 16:00:00+00'
   where id = v_c;

  -- conflicting reschedule is rejected; failed reschedule leaves original unchanged
  v_orig := (select scheduled_at from public.tour_appointments where id = v_c);
  begin
    update public.tour_appointments
       set scheduled_at = '2099-06-15 11:00:00+00'
     where id = v_c;
    raise exception 'reschedule onto occupied interval must be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;
  if (select scheduled_at from public.tour_appointments where id = v_c) is distinct from v_orig then
    raise exception 'failed reschedule must leave original appointment unchanged';
  end if;

  -- missing/null max_simultaneous_tours follows default 1 (already asserted above).
  -- simultaneous Tours up to an explicit capacity succeed; the next is rejected.
  delete from public.tour_appointments where venue_id = v_venue;
  insert into public.venue_capacity_rules (venue_id, max_simultaneous_tours, max_simultaneous_events)
  values (v_venue, 2, 1);

  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-06-15 10:00:00+00', 60, 'scheduled', 'Sim A');
  insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
  values (v_venue, '2099-06-15 10:00:00+00', 60, 'scheduled', 'Sim B');
  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-06-15 10:00:00+00', 60, 'scheduled', 'Sim C');
    raise exception 'third simultaneous Tour must be rejected at max=2';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  select count(*) into v_count
  from public.tour_appointments
  where venue_id = v_venue and status is distinct from 'cancelled';
  if v_count <> 2 then
    raise exception 'exactly two simultaneous Tours should remain, got %', v_count;
  end if;

  -- exceptions are enforced
  delete from public.tour_appointments where venue_id = v_venue;
  delete from public.events where venue_id = v_venue;
  insert into public.tour_availability_exceptions (venue_id, start_date, end_date, label)
  values (v_venue, '2099-06-15', '2099-06-16', 'Holiday');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 10:00:00+00'::timestamptz, '2099-06-15 11:00:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'exception date must block Tours';
  end if;
  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-06-15 10:00:00+00', 60, 'scheduled', 'On holiday');
    raise exception 'Tour on exception date must be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;
  delete from public.tour_availability_exceptions where venue_id = v_venue;

  -- availability windows + duration are enforced
  delete from public.tour_availability_windows where venue_id = v_venue;
  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  values (v_venue, extract(dow from timestamp '2099-06-15')::smallint, '10:00', '12:00');

  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 13:00:00+00'::timestamptz, '2099-06-15 14:00:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'slot outside the window must be blocked';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-16 10:00:00+00'::timestamptz, '2099-06-16 11:00:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'slot on a day with no window must be blocked';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 11:30:00+00'::timestamptz, '2099-06-15 12:30:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'duration that overruns the window must be blocked';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 10:00:00+00'::timestamptz, '2099-06-15 11:00:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'in-window 60-minute slot must be available';
  end if;

  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-06-15 13:00:00+00', 60, 'scheduled', 'Outside window');
    raise exception 'write outside a window must be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  -- duration + buffer are respected by slot generation (step = duration + buffer)
  v_day := current_date + 14;
  v_dow := extract(dow from v_day)::smallint;
  update public.venues
     set tour_min_notice_hours = 0,
         tour_max_advance_days = 365,
         tour_duration_minutes = 60,
         tour_buffer_minutes = 30
   where id = v_venue;
  delete from public.tour_availability_windows where venue_id = v_venue;
  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  values (v_venue, v_dow, '10:00', '13:00');

  v_slots := public._generate_tour_slots(v_venue, v_day, v_day);
  if jsonb_array_length(coalesce(v_slots -> 'slots', '[]'::jsonb)) <> 2 then
    raise exception 'expected 2 buffered slots in a 10:00-13:00 window, got %', v_slots;
  end if;
  if (v_slots -> 'slots' -> 0 ->> 'time') is distinct from '10:00 AM' then
    raise exception 'first generated slot must be 10:00 AM, got %', v_slots;
  end if;
  if (v_slots -> 'slots' -> 1 ->> 'time') is distinct from '11:30 AM' then
    raise exception 'buffer step must place the second slot at 11:30 AM, got %', v_slots;
  end if;

  -- duration that cannot fit the window yields no slots
  update public.venues set tour_duration_minutes = 90, tour_buffer_minutes = 0 where id = v_venue;
  delete from public.tour_availability_windows where venue_id = v_venue;
  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  values (v_venue, v_dow, '10:00', '11:00');
  v_slots := public._generate_tour_slots(v_venue, v_day, v_day);
  if jsonb_array_length(v_slots -> 'slots') <> 0 then
    raise exception '90-minute duration must not fit a 60-minute window, got %', v_slots;
  end if;

  -- Event operational-window overlap (not date-only Event-day blocking)
  delete from public.tour_appointments where venue_id = v_venue;
  delete from public.events where venue_id = v_venue;
  delete from public.tour_availability_windows where venue_id = v_venue;
  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;

  insert into public.events (venue_id, name, event_date, status, start_time, end_time)
  values (v_venue, 'Evening Event', '2099-06-15', 'confirmed', '18:00', '22:00');

  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 10:00:00+00'::timestamptz, '2099-06-15 11:00:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'daytime Tour must be allowed against an evening Event';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 17:00:00+00'::timestamptz, '2099-06-15 18:00:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'Tour ending at Event start must be allowed (touching)';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 21:30:00+00'::timestamptz, '2099-06-15 22:30:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'Tour overlapping Event start/end must be blocked';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 22:00:00+00'::timestamptz, '2099-06-15 23:00:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'Tour beginning at Event end must be allowed (touching)';
  end if;

  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-06-15 10:00:00+00', 60, 'scheduled', 'Daytime ok');
  exception
    when others then
      raise exception 'write-time daytime Tour against evening Event must succeed: %', sqlerrm;
  end;
  begin
    insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
    values (v_venue, '2099-06-15 21:30:00+00', 60, 'scheduled', 'Overlap Event');
    raise exception 'write-time Tour overlapping Event must be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  delete from public.events where venue_id = v_venue;
  insert into public.events (venue_id, name, event_date, status, start_time, end_time)
  values (v_venue, 'Daytime Event', '2099-06-15', 'confirmed', '10:00', '14:00');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 18:00:00+00'::timestamptz, '2099-06-15 19:00:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'evening Tour must be allowed against a daytime Event';
  end if;

  delete from public.events where venue_id = v_venue;
  insert into public.events (venue_id, name, event_date, status, setup_time, start_time, end_time, teardown_time)
  values (v_venue, 'Setup Event', '2099-06-15', 'confirmed', '16:00', '18:00', '22:00', '23:00');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 16:30:00+00'::timestamptz, '2099-06-15 17:30:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'Tour overlapping Event setup must be blocked';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 23:00:00+00'::timestamptz, '2099-06-15 23:59:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'Tour beginning at Event teardown must be allowed';
  end if;

  delete from public.events where venue_id = v_venue;
  insert into public.events (venue_id, name, event_date, status)
  values (v_venue, 'Untimed Event', '2099-06-15', 'confirmed');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 10:00:00+00'::timestamptz, '2099-06-15 11:00:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'missing Event times must occupy the full day';
  end if;

  delete from public.events where venue_id = v_venue;
  insert into public.events (venue_id, name, event_date, event_end_date, status, start_time, end_time)
  values (v_venue, 'Multi-day Event', '2099-06-15', '2099-06-17', 'confirmed', '18:00', '22:00');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-16 10:00:00+00'::timestamptz, '2099-06-16 11:00:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'morning Tour on a multi-day Event day must be allowed';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-16 21:00:00+00'::timestamptz, '2099-06-16 22:00:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'evening Tour on a multi-day Event day must be blocked';
  end if;

  update public.events set status = 'cancelled' where venue_id = v_venue;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-16 21:00:00+00'::timestamptz, '2099-06-16 22:00:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'cancelled Event must not block Tours';
  end if;

  -- slot generation agrees with write-time (uses _is_tour_slot_blocked)
  delete from public.events where venue_id = v_venue;
  delete from public.tour_appointments where venue_id = v_venue;
  update public.venues
     set tour_duration_minutes = 60, tour_buffer_minutes = 0,
         tour_min_notice_hours = 0, tour_max_advance_days = 365
   where id = v_venue;
  delete from public.tour_availability_windows where venue_id = v_venue;
  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  values (v_venue, v_dow, '00:00', '23:59');
  insert into public.events (venue_id, name, event_date, status, start_time, end_time)
  values (v_venue, 'Evening for slots', v_day, 'confirmed', '18:00', '22:00');
  v_slots := public._generate_tour_slots(v_venue, v_day, v_day);
  if not exists (
    select 1 from jsonb_array_elements(v_slots -> 'slots') s
    where s ->> 'time' = '10:00 AM'
  ) then
    raise exception 'slot generation must still offer a 10:00 AM Tour against an evening Event, got %', v_slots;
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_slots -> 'slots') s
    where s ->> 'time' in ('09:00 PM', '9:00 PM')
  ) then
    raise exception 'slot generation must not offer a 9:00 PM Tour overlapping the Event, got %', v_slots;
  end if;

  delete from public.events where venue_id = v_venue;
  delete from public.tour_appointments where venue_id = v_venue;

  -- Advisory lock key is venue-namespaced and held in this transaction.
  perform public.lock_tour_occupancy_interval(
    v_venue, '2099-07-01 10:00:00+00'::timestamptz, '2099-07-01 11:00:00+00'::timestamptz
  );
  select count(*)::integer into v_locks
  from pg_locks
  where locktype = 'advisory'
    and granted
    and classid = hashtext('tour-avail:' || v_venue::text)
    and objid = hashtext('2099-07-01');
  if v_locks < 1 then
    raise exception 'lock_tour_occupancy_interval must take a namespaced advisory lock';
  end if;

  -- Venue-local Event TIME vs timestamptz Tour (America/New_York, June = EDT)
  update public.venues set timezone = 'America/New_York' where id = v_venue;
  delete from public.events where venue_id = v_venue;
  delete from public.tour_appointments where venue_id = v_venue;
  delete from public.tour_availability_windows where venue_id = v_venue;
  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;
  insert into public.events (venue_id, name, event_date, status, start_time, end_time)
  values (v_venue, 'NY Evening', '2099-06-15', 'confirmed', '18:00', '22:00');
  -- 18:00 NY = 22:00 UTC. A 10:00 UTC Tour is 06:00 NY and must be allowed.
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 10:00:00+00'::timestamptz, '2099-06-15 11:00:00+00'::timestamptz
  );
  if v_blocked then
    raise exception 'UTC 10:00 Tour must not overlap 18:00 America/New_York Event';
  end if;
  -- 22:30 UTC = 18:30 NY, inside the Event.
  v_blocked := public._is_tour_slot_blocked(
    v_venue, '2099-06-15 22:30:00+00'::timestamptz, '2099-06-15 23:30:00+00'::timestamptz
  );
  if not v_blocked then
    raise exception 'UTC 22:30 Tour must overlap 18:00 America/New_York Event';
  end if;

  delete from public.venues where id = v_venue;
  delete from auth.users where id = v_owner;
end;
$$;
