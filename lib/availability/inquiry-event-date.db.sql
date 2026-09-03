-- Inquiry choose_available live tests. Date-level occupancy via
-- _is_event_date_available / evaluate_event_availability. Wrapped in
-- begin/rollback by the Node test.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_ball    uuid := gen_random_uuid();
  v_garden  uuid := gen_random_uuid();
  v_event   uuid;
  v_ok      boolean;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'k7-inquiry-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name)
  values (v_venue, v_owner, 'K7 Inquiry Occupancy Fixture');

  -- missing rules → max 1
  v_ok := public._is_event_date_available(v_venue, '2027-08-12');
  if not v_ok then
    raise exception 'empty simple venue date must be available';
  end if;

  insert into public.events (id, venue_id, name, event_date, start_time, end_time, status)
  values (gen_random_uuid(), v_venue, 'Evening', '2027-08-12', '17:00', '23:00', 'draft')
  returning id into v_event;

  v_ok := public._is_event_date_available(v_venue, '2027-08-12');
  if v_ok then
    raise exception 'simple venue with an occupying Event must be unavailable for inquiry';
  end if;

  -- cancelled Event restores inquiry availability
  update public.events set status = 'cancelled' where id = v_event;
  v_ok := public._is_event_date_available(v_venue, '2027-08-12');
  if not v_ok then
    raise exception 'cancelled Event must not close the inquiry date';
  end if;

  delete from public.events where venue_id = v_venue;

  -- multi-day occupancy
  insert into public.events (venue_id, name, event_date, event_end_date, status)
  values (v_venue, 'Three day', '2027-08-12', '2027-08-14', 'draft');
  v_ok := public._is_event_date_available(v_venue, '2027-08-13');
  if v_ok then
    raise exception 'middle day of a multi-day Event must be unavailable';
  end if;
  v_ok := public._is_event_date_available(v_venue, '2027-08-15');
  if not v_ok then
    raise exception 'day after a multi-day Event must be available without turnaround';
  end if;

  delete from public.events where venue_id = v_venue;
  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events, min_turnaround_hours)
  values (v_venue, 1, 12);
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Late', '2027-08-20', '18:00', '22:00', 'draft');
  v_ok := public._is_event_date_available(v_venue, '2027-08-21');
  if v_ok then
    raise exception 'full-day inquiry the next morning must respect Event turnaround';
  end if;

  delete from public.events where venue_id = v_venue;
  delete from public.venue_capacity_rules where venue_id = v_venue;

  -- simultaneous: Event Space occupancy, available if another space is free
  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events)
  values (v_venue, 2);
  insert into public.venue_spaces (id, venue_id, name, is_active, sort_order)
  values (v_ball, v_venue, 'Ballroom', true, 1),
         (v_garden, v_venue, 'Garden', true, 2);
  insert into public.events (venue_id, name, event_date, space_id, status)
  values (v_venue, 'Ballroom booking', '2027-08-22', v_ball, 'draft');
  v_ok := public._is_event_date_available(v_venue, '2027-08-22');
  if not v_ok then
    raise exception 'simultaneous venue with a free Event Space must stay available';
  end if;
  insert into public.events (venue_id, name, event_date, space_id, status)
  values (v_venue, 'Garden booking', '2027-08-22', v_garden, 'draft');
  v_ok := public._is_event_date_available(v_venue, '2027-08-22');
  if v_ok then
    raise exception 'simultaneous venue with every active space occupied must be unavailable';
  end if;

  -- covering calendar_blocks close the inquiry date
  insert into public.calendar_blocks (venue_id, title, type, start_date, end_date)
  values (v_venue, 'Holiday', 'blocked_time', '2027-08-30', '2027-08-30');
  v_ok := public._is_event_date_available(v_venue, '2027-08-30');
  if v_ok then
    raise exception 'covering calendar_blocks must close the inquiry date';
  end if;

  -- evaluate (no lock) agrees with a full-day occupancy refusal
  if (public.evaluate_event_availability(
    v_venue, '2027-08-22', null, null, null, null, null, v_ball, null
  )->>'ok') = 'true' then
    raise exception 'evaluate must refuse a full-day Event in an occupied space';
  end if;

  delete from public.venues where id = v_venue;
  delete from auth.users where id = v_owner;
end;
$$;
