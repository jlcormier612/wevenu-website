-- K.7 Phase 2 live occupancy tests. Wrapped by the Node test in a
-- transaction that always rolls back. Requires assert_event_availability.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_ball    uuid := gen_random_uuid();
  v_garden  uuid := gen_random_uuid();
  v_terrace uuid := gen_random_uuid();
  v_foreign uuid := gen_random_uuid();
  v_event_a uuid := gen_random_uuid();
  v_event_b uuid := gen_random_uuid();
  v_event_c uuid := gen_random_uuid();
  v_result  jsonb;
  v_locks   integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'k7-phase2-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name)
  values (v_venue, v_owner, 'K7 Phase2 Occupancy Fixture');

  -- Decision 4: no venue_capacity_rules row → effective_max = 1
  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, null, null, null, null, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'Decision 4: first dated Event on a venue with no rules row must succeed, got %', v_result;
  end if;

  insert into public.events (id, venue_id, name, event_date, status)
  values (v_event_a, v_venue, 'First Booking', '2027-06-12', 'draft');

  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '10:00', '14:00', null, null, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'venue_at_capacity' then
    raise exception 'simple venue must refuse overlapping all-day occupancy, got %', v_result;
  end if;

  -- Sequential same-day windows on a simple venue are allowed
  update public.events
     set start_time = '17:00', end_time = '23:00'
   where id = v_event_a;
  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '10:00', '14:00', null, null, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'simple venue sequential windows must succeed, got %', v_result;
  end if;

  -- Cancelled Events are ignored
  update public.events set status = 'cancelled' where id = v_event_a;
  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, null, null, null, null, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'cancelled Event must restore availability, got %', v_result;
  end if;

  -- Decision 3: multi-day protects the middle day with the same window
  update public.events
     set status = 'draft',
         event_date = '2027-06-12',
         event_end_date = '2027-06-14',
         start_time = '17:00',
         end_time = '23:00'
   where id = v_event_a;
  v_result := public.assert_event_availability(
    v_venue, '2027-06-13', null, null, '18:00', '21:00', null, null, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'venue_at_capacity' then
    raise exception 'Decision 3: overlapping window on a protected middle day must refuse, got %', v_result;
  end if;
  v_result := public.assert_event_availability(
    v_venue, '2027-06-13', null, null, '10:00', '14:00', null, null, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'Decision 3: non-overlapping window on a protected middle day must succeed, got %', v_result;
  end if;

  select count(*)::integer into v_locks
  from pg_locks
  where locktype = 'advisory' and granted and pid = pg_backend_pid();
  if v_locks < 1 then
    raise exception 'assert_event_availability must hold a transaction-scoped advisory lock';
  end if;

  -- Decision 2: simultaneous + zero Event Spaces. Clear the simple-venue Event first.
  delete from public.events where id = v_event_a;
  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events)
  values (v_venue, 2);

  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '17:00', '23:00', null, v_ball, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'no_spaces' then
    raise exception 'Decision 2: zero Event Spaces must refuse, got %', v_result;
  end if;

  -- Decision 1: space required; same-space overlap refuse; different spaces up to cap
  insert into public.venue_spaces (id, venue_id, name, is_active, sort_order)
  values
    (v_ball,    v_venue, 'Ballroom', true, 0),
    (v_garden,  v_venue, 'Garden',   true, 1),
    (v_terrace, v_venue, 'Terrace',  true, 2);

  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '17:00', '23:00', null, null, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'missing_space' then
    raise exception 'Decision 1: missing space_id must refuse, got %', v_result;
  end if;

  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '17:00', '23:00', null, v_foreign, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'invalid_space' then
    raise exception 'Decision 1: foreign space_id must refuse, got %', v_result;
  end if;

  insert into public.events (id, venue_id, name, event_date, space_id, start_time, end_time, status)
  values (v_event_b, v_venue, 'Smith Wedding', '2027-06-12', v_ball, '17:00', '23:00', 'draft');

  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '18:00', '22:00', null, v_ball, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'space_overlap' then
    raise exception 'Decision 1: same-space overlap must refuse, got %', v_result;
  end if;

  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '17:00', '23:00', null, v_garden, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'Decision 1: different-space overlap under cap must succeed, got %', v_result;
  end if;

  insert into public.events (id, venue_id, name, event_date, space_id, start_time, end_time, status)
  values (v_event_c, v_venue, 'Garden Party', '2027-06-12', v_garden, '17:00', '23:00', 'draft');

  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '18:00', '22:00', null, v_terrace, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'venue_at_capacity' then
    raise exception 'Decision 1: third simultaneous Event at max=2 must refuse, got %', v_result;
  end if;

  v_result := public.assert_event_availability(
    v_venue, '2027-06-12', null, null, '17:00', '23:00', null, v_ball, v_event_b
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'exclude_event_id must ignore the Event being edited, got %', v_result;
  end if;

  -- min_turnaround_hours (simple venue)
  delete from public.events where venue_id = v_venue;
  delete from public.venue_capacity_rules where venue_id = v_venue;
  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events, min_turnaround_hours)
  values (v_venue, 1, 12);
  insert into public.events (id, venue_id, name, event_date, start_time, end_time, status)
  values (v_event_a, v_venue, 'Evening', '2099-06-15', '18:00', '22:00', 'draft');

  v_result := public.assert_event_availability(
    v_venue, '2099-06-16', null, null, '10:00', '12:00', null, null, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'exactly 12h after 10 PM must be allowed, got %', v_result;
  end if;
  v_result := public.assert_event_availability(
    v_venue, '2099-06-16', null, null, '09:59', '11:00', null, null, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'event_turnaround' then
    raise exception '11h59m after 10 PM must refuse turnaround, got %', v_result;
  end if;

  update public.events set status = 'cancelled' where id = v_event_a;
  v_result := public.assert_event_availability(
    v_venue, '2099-06-16', null, null, '09:00', '11:00', null, null, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'cancelled Event must not impose turnaround, got %', v_result;
  end if;

  -- multi-day final window
  update public.events
     set status = 'draft', event_date = '2099-06-15', event_end_date = '2099-06-17',
         start_time = '18:00', end_time = '22:00'
   where id = v_event_a;
  v_result := public.assert_event_availability(
    v_venue, '2099-06-18', null, null, '09:00', '11:00', null, null, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'event_turnaround' then
    raise exception 'multi-day turnaround after Wednesday 10 PM must refuse Thursday 9 AM, got %', v_result;
  end if;
  v_result := public.assert_event_availability(
    v_venue, '2099-06-18', null, null, '10:00', '12:00', null, null, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'multi-day turnaround boundary Thursday 10 AM must succeed, got %', v_result;
  end if;

  -- simultaneous: same-space turnaround, different-space allowed
  delete from public.events where venue_id = v_venue;
  update public.venue_capacity_rules
     set max_simultaneous_events = 2, min_turnaround_hours = 12
   where venue_id = v_venue;
  insert into public.events (id, venue_id, name, event_date, space_id, start_time, end_time, status)
  values (v_event_b, v_venue, 'Ballroom night', '2099-06-15', v_ball, '18:00', '22:00', 'draft');
  v_result := public.assert_event_availability(
    v_venue, '2099-06-16', null, null, '09:00', '11:00', null, v_ball, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'event_turnaround' then
    raise exception 'same-space turnaround must refuse, got %', v_result;
  end if;
  v_result := public.assert_event_availability(
    v_venue, '2099-06-16', null, null, '09:00', '11:00', null, v_garden, null
  );
  if v_result->>'ok' is distinct from 'true' then
    raise exception 'different-space Event must not inherit the other space turnaround, got %', v_result;
  end if;

  -- overlapping multi-day occupancy still wins over turnaround
  delete from public.events where venue_id = v_venue;
  update public.venue_capacity_rules
     set max_simultaneous_events = 1, min_turnaround_hours = 12
   where venue_id = v_venue;
  insert into public.events (id, venue_id, name, event_date, event_end_date, start_time, end_time, status)
  values (v_event_a, v_venue, 'Three day', '2099-06-15', '2099-06-17', '10:00', '22:00', 'draft');
  v_result := public.assert_event_availability(
    v_venue, '2099-06-16', '2099-06-18', null, '10:00', '22:00', null, null, null
  );
  if v_result->>'ok' is not distinct from 'true' or v_result->>'code' is distinct from 'venue_at_capacity' then
    raise exception 'overlapping multi-day Events must refuse occupancy, got %', v_result;
  end if;
end $$;
