-- K.7 Phase 3 live write-enforcement tests. Wrapped in begin/rollback.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_ball    uuid := gen_random_uuid();
  v_garden  uuid := gen_random_uuid();
  v_terrace uuid := gen_random_uuid();
  v_event_a uuid;
  v_event_b uuid;
  v_event_c uuid;
  v_count integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'k7-phase3-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name)
  values (v_venue, v_owner, 'K7 Phase3 Write Fixture');

  -- CREATE: missing capacity-rule row behaves as max=1
  insert into public.events (venue_id, name, event_date, status)
  values (v_venue, 'First', '2027-07-12', 'draft')
  returning id into v_event_a;

  begin
    insert into public.events (venue_id, name, event_date, start_time, end_time, status)
    values (v_venue, 'Overlap', '2027-07-12', '10:00', '14:00', 'draft');
    raise exception 'CREATE simple overlapping Event must be rejected';
  exception
    when others then
      if sqlerrm not like '%already booked%' then raise; end if;
  end;

  -- sequential same-day allowed
  update public.events set start_time = '17:00', end_time = '23:00' where id = v_event_a;
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Morning', '2027-07-12', '10:00', '14:00', 'draft')
  returning id into v_event_b;

  -- cancelled Event ignored
  update public.events set status = 'cancelled' where id = v_event_a;
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Evening after cancel', '2027-07-12', '17:00', '23:00', 'draft')
  returning id into v_event_c;

  -- failed edit leaves original unchanged (move evening onto morning)
  begin
    update public.events
       set start_time = '10:00', end_time = '14:00'
     where id = v_event_c;
    raise exception 'EDIT time-into-conflict must be rejected';
  exception
    when others then
      if sqlerrm not like '%already booked%' then raise; end if;
  end;
  if (select start_time::text from public.events where id = v_event_c) not like '17:00%' then
    raise exception 'failed edit must leave original Event unchanged';
  end if;

  -- self-exclusion: edit own occupancy succeeds
  update public.events
     set start_time = '18:00', end_time = '22:00'
   where id = v_event_c;

  -- clean occupying rows except we need a known state for simultaneous tests
  delete from public.events where venue_id = v_venue;
  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events)
  values (v_venue, 2);

  -- zero Event Spaces rejected
  begin
    insert into public.events (venue_id, name, event_date, space_id, status)
    values (v_venue, 'No spaces', '2027-08-01', v_ball, 'draft');
    raise exception 'CREATE zero Event Spaces must be rejected';
  exception
    when others then
      if sqlerrm not like '%Event Space%' then raise; end if;
  end;

  insert into public.venue_spaces (id, venue_id, name, is_active, sort_order)
  values
    (v_ball, v_venue, 'Ballroom', true, 0),
    (v_garden, v_venue, 'Garden', true, 1),
    (v_terrace, v_venue, 'Terrace', true, 2);

  -- missing space rejected
  begin
    insert into public.events (venue_id, name, event_date, status)
    values (v_venue, 'No space', '2027-08-01', 'draft');
    raise exception 'CREATE missing space must be rejected';
  exception
    when others then
      if sqlerrm not like '%Assign an Event Space%' then raise; end if;
  end;

  insert into public.events (venue_id, name, event_date, space_id, start_time, end_time, status)
  values (v_venue, 'Smith Wedding', '2027-08-01', v_ball, '17:00', '23:00', 'draft')
  returning id into v_event_a;

  -- same-space overlap rejected
  begin
    insert into public.events (venue_id, name, event_date, space_id, start_time, end_time, status)
    values (v_venue, 'Same space', '2027-08-01', v_ball, '18:00', '22:00', 'draft');
    raise exception 'CREATE same-space overlap must be rejected';
  exception
    when others then
      if sqlerrm not like '%already booked%' then raise; end if;
  end;

  -- different-space overlap allowed within cap
  insert into public.events (venue_id, name, event_date, space_id, start_time, end_time, status)
  values (v_venue, 'Garden Party', '2027-08-01', v_garden, '17:00', '23:00', 'draft')
  returning id into v_event_b;

  -- capacity exceeded
  begin
    insert into public.events (venue_id, name, event_date, space_id, start_time, end_time, status)
    values (v_venue, 'Third', '2027-08-01', v_terrace, '18:00', '22:00', 'draft');
    raise exception 'CREATE capacity exceeded must be rejected';
  exception
    when others then
      if sqlerrm not like '%Maximum simultaneous%' then raise; end if;
  end;

  -- EDIT: changing space into conflict
  begin
    update public.events set space_id = v_ball where id = v_event_b;
    raise exception 'EDIT space-into-conflict must be rejected';
  exception
    when others then
      if sqlerrm not like '%already booked%' then raise; end if;
  end;
  if (select space_id from public.events where id = v_event_b) is distinct from v_garden then
    raise exception 'failed space edit must leave original Event unchanged';
  end if;

  -- EDIT: changing date into conflict (multi-day occupy)
  update public.events
     set event_date = '2027-08-10', event_end_date = '2027-08-12', start_time = '17:00', end_time = '23:00'
   where id = v_event_a;
  begin
    update public.events set event_date = '2027-08-11', space_id = v_ball, start_time = '18:00', end_time = '21:00'
     where id = v_event_b;
    raise exception 'EDIT date-into-conflict must be rejected';
  exception
    when others then
      if sqlerrm not like '%already booked%' then raise; end if;
  end;

  -- EDIT without changing occupancy (name only) succeeds — trigger WHEN skips
  update public.events set name = 'Smith Wedding (updated)' where id = v_event_a;

  -- Booking-equivalent write: same trigger as create_client_and_event_with_availability
  insert into public.events (venue_id, name, event_date, space_id, status)
  values (v_venue, 'Ada Lovelace — wedding', '2027-09-20', v_ball, 'draft');

  begin
    insert into public.events (venue_id, name, event_date, space_id, status)
    values (v_venue, 'Grace Hopper — wedding', '2027-09-20', v_ball, 'draft');
    raise exception 'conflicting booking must not succeed';
  exception
    when others then
      if sqlerrm not like '%already booked%' then raise; end if;
  end;
  select count(*) into v_count from public.events
   where venue_id = v_venue and name = 'Grace Hopper — wedding';
  if v_count <> 0 then
    raise exception 'conflicting booking must create no Event';
  end if;

  -- write-path turnaround
  delete from public.events where venue_id = v_venue;
  update public.venue_capacity_rules
     set max_simultaneous_events = 1, min_turnaround_hours = 12
   where venue_id = v_venue;
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Night', '2099-06-15', '18:00', '22:00', 'draft');
  begin
    insert into public.events (venue_id, name, event_date, start_time, end_time, status)
    values (v_venue, 'Too soon', '2099-06-16', '09:00', '11:00', 'draft');
    raise exception 'CREATE inside turnaround must be rejected';
  exception
    when others then
      if sqlerrm not like '%turnaround%' then raise; end if;
  end;
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'After gap', '2099-06-16', '10:00', '12:00', 'draft')
  returning id into v_event_c;

  -- restore-cancelled: un-cancel into a turnaround gap is refused
  update public.events set status = 'cancelled' where id = v_event_c;
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Noon block', '2099-06-16', '12:00', '14:00', 'draft');
  begin
    update public.events set status = 'draft' where id = v_event_c;
    raise exception 'restore-cancelled into a turnaround gap must be rejected';
  exception
    when others then
      if sqlerrm not like '%turnaround%' then raise; end if;
  end;
  if (select status from public.events where id = v_event_c) is distinct from 'cancelled' then
    raise exception 'failed restore must leave the Event cancelled';
  end if;

  -- Calendar blocks are Event write constraints (any covering type), not occupancy.
  delete from public.events where venue_id = v_venue;
  delete from public.venue_capacity_rules where venue_id = v_venue;
  insert into public.calendar_blocks (venue_id, title, type, start_date, end_date)
  values (v_venue, 'Staff day', 'personal_appointment', '2099-08-01', '2099-08-01');
  begin
    insert into public.events (venue_id, name, event_date, status)
    values (v_venue, 'Blocked day Event', '2099-08-01', 'draft');
    raise exception 'Event insert covering a calendar_blocks row must be rejected';
  exception
    when others then
      if sqlerrm not like '%calendar is blocked%' then raise; end if;
  end;
  insert into public.events (venue_id, name, event_date, status)
  values (v_venue, 'Open day Event', '2099-08-02', 'draft');
end $$;
