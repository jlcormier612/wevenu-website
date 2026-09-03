-- Realistic cutover E2E. Wrapped in begin/rollback by the Node harness.
-- Counts: 75 clients, 30 future events, 20 past complete events, 12 tours
-- (4 past completed / 8 future), 8 holds, 15 blocked dates, 1 weekly
-- recurring block, 2 spaces, capacity 2, turnaround, 5 vendors, 3 packages.

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_ball uuid := gen_random_uuid();
  v_garden uuid := gen_random_uuid();
  v_i integer;
  v_space uuid;
  v_date date;
  v_end date;
  v_client uuid;
  v_event uuid;
  v_lead uuid;
  v_rel uuid;
  v_vendor uuid;
  v_result jsonb;
  v_tour jsonb;
  v_n integer;
  v_clients integer;
  v_future_events integer;
  v_past_events integer;
  v_tours integer;
  v_past_tours integer;
  v_future_tours integer;
  v_holds integer;
  v_blocks integer;
  v_recurring integer;
  v_spaces integer;
  v_vendors integer;
  v_packages integer;
  v_key_dates integer;
  v_orphans integer;
  v_dup_clients integer;
  v_avail_conflict boolean := false;
  v_avail_other_space boolean := false;
  v_avail_capacity boolean := false;
  v_avail_turnaround boolean := false;
  v_avail_block boolean := false;
  v_avail_recur boolean := false;
  v_avail_open boolean := false;
  v_tour_cap boolean := false;
  v_hist_ok boolean := false;
  v_missing_space boolean := false;
  v_past_no_cap boolean := false;
  v_report jsonb;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'cutover-e2e-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, timezone, tour_duration_minutes, tour_buffer_minutes, tour_scheduling_enabled)
  values (v_venue, v_owner, 'Cutover E2E Venue', 'UTC', 60, 30, true);

  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events, max_simultaneous_tours, min_turnaround_hours)
  values (v_venue, 2, 2, 24);

  insert into public.venue_spaces (id, venue_id, name, is_active, sort_order)
  values (v_ball, v_venue, 'Ballroom', true, 1),
         (v_garden, v_venue, 'Garden', true, 2);

  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time from generate_series(0, 6) as d;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text,
    true
  );

  -- 15 all-day blocked dates + 1 weekly recurring Sunday block
  insert into public.calendar_blocks (
    venue_id, title, type, reason, start_date, end_date, is_all_day, recurrence_rule
  )
  select v_venue, 'Blocked ' || g::text, 'blocked_time', 'other', g, g, true, 'none'
  from generate_series(date '2027-12-01', date '2027-12-15', interval '1 day') as g;

  insert into public.calendar_blocks (
    venue_id, title, type, reason, start_date, end_date, is_all_day,
    start_time, end_time, recurrence_rule, recurrence_interval, recurrence_ends_on
  ) values (
    v_venue, 'Weekly Sunday block', 'blocked_time', 'other',
    '2027-06-06', '2027-06-06', false, '09:00', '17:00', 'weekly', 1, '2027-07-04'
  );

  -- 5 vendors + venue relationships
  for v_i in 1..5 loop
    insert into public.vendors (business_name, category, email)
    values ('Cutover Vendor ' || v_i, 'catering', 'vendor' || v_i || '-' || v_venue::text || '@example.test')
    returning id into v_vendor;
    insert into public.venue_vendor_relationships (venue_id, vendor_id, status, preference_level)
    values (v_venue, v_vendor, 'active', 'recommended');
  end loop;

  insert into public.packages (venue_id, name, description, base_price, category, is_active)
  values
    (v_venue, 'Ceremony Package', 'Representative ceremony offering', 4500, 'Venue', true),
    (v_venue, 'Reception Package', 'Representative reception offering', 8900, 'Venue', true),
    (v_venue, 'Full Weekend', 'Representative weekend offering', 15000, 'Venue', true);

  -- 30 future operational Events (clients 1–30), alternating spaces, unique dates
  for v_i in 1..30 loop
    v_space := case when v_i % 2 = 1 then v_ball else v_garden end;
    v_date := date '2027-09-01' + ((v_i - 1) * 2);
    v_end := case when v_i <= 5 then v_date + 1 else v_date end;
    v_result := public.create_client_and_event_with_availability(
      jsonb_build_object(
        'firstName', 'Future',
        'lastName', 'Client' || lpad(v_i::text, 3, '0'),
        'email', 'cutover-c-' || lpad(v_i::text, 3, '0') || '@example.test',
        'partnerFirstName', 'Pat',
        'isHistoricalImport', true
      ),
      jsonb_build_object(
        'name', 'Future Event ' || lpad(v_i::text, 3, '0'),
        'eventType', 'wedding',
        'eventDate', v_date::text,
        'eventEndDate', v_end::text,
        'startTime', '16:00',
        'endTime', '22:00',
        'setupTime', '14:00',
        'teardownTime', '23:00',
        'guestCount', '120',
        'spaceId', v_space::text
      ),
      v_venue
    );
    if coalesce(v_result->>'ok', '') is distinct from 'true' then
      raise exception 'future client % failed: %', v_i, v_result;
    end if;
    if v_i <= 10 then
      insert into public.client_key_dates (venue_id, client_id, label, date)
      values (v_venue, (v_result->>'client_id')::uuid, 'Tasting', v_date - 30);
    end if;
  end loop;

  -- 20 past Events as reviewed historical records (status complete) — clients 31–50
  for v_i in 31..50 loop
    v_date := date '2024-05-01' + ((v_i - 31) * 3);
    v_result := public.create_client_and_event_with_availability(
      jsonb_build_object(
        'firstName', 'Past',
        'lastName', 'Client' || lpad(v_i::text, 3, '0'),
        'email', 'cutover-c-' || lpad(v_i::text, 3, '0') || '@example.test',
        'isHistoricalImport', true
      ),
      jsonb_build_object(
        'name', 'Past Event ' || lpad(v_i::text, 3, '0'),
        'eventType', 'wedding',
        'eventDate', v_date::text,
        'eventEndDate', v_date::text,
        'startTime', '16:00',
        'endTime', '22:00',
        'setupTime', '14:00',
        'teardownTime', '23:00',
        'guestCount', '80',
        'spaceId', v_ball::text,
        'status', 'complete'
      ),
      v_venue
    );
    if coalesce(v_result->>'ok', '') is distinct from 'true' then
      raise exception 'past client % failed: %', v_i, v_result;
    end if;
  end loop;

  -- 25 CRM-only clients (no dated Event)
  for v_i in 51..75 loop
    v_client := public.create_client_atomic(
      jsonb_build_object(
        'firstName', 'Crm',
        'lastName', 'Client' || lpad(v_i::text, 3, '0'),
        'email', 'cutover-c-' || lpad(v_i::text, 3, '0') || '@example.test',
        'isHistoricalImport', true
      ),
      v_venue
    );
    if v_client is null then
      raise exception 'crm client % failed', v_i;
    end if;
  end loop;

  -- Historical overlap: two complete past Events on the same date (would fail as live)
  begin
    insert into public.events (
      venue_id, name, event_date, start_time, end_time, setup_time, teardown_time,
      space_id, status, client_id
    ) values (
      v_venue, 'Historical overlap A', date '2023-08-12', '16:00', '22:00', '14:00', '23:00',
      v_ball, 'complete', (select id from public.clients where venue_id = v_venue and email = 'cutover-c-051@example.test')
    );
    insert into public.events (
      venue_id, name, event_date, start_time, end_time, setup_time, teardown_time,
      space_id, status, client_id
    ) values (
      v_venue, 'Historical overlap B', date '2023-08-12', '16:00', '22:00', '14:00', '23:00',
      v_ball, 'complete', (select id from public.clients where venue_id = v_venue and email = 'cutover-c-052@example.test')
    );
    v_hist_ok := true;
  exception
    when others then
      raise exception 'historical complete overlap must insert, got %', sqlerrm;
  end;

  -- 12 leads + tours (4 past completed, 8 future scheduled). Extra leads for holds.
  for v_i in 1..20 loop
    insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
    values (v_venue, 'cutover-l-' || lpad(v_i::text, 3, '0') || '@example.test', 'Lead', 'Tour' || lpad(v_i::text, 3, '0'))
    returning id into v_rel;
    insert into public.leads (venue_id, first_name, last_name, email, status, relationship_id)
    values (v_venue, 'Lead', 'Tour' || lpad(v_i::text, 3, '0'),
            'cutover-l-' || lpad(v_i::text, 3, '0') || '@example.test', 'new', v_rel)
    returning id into v_lead;

    if v_i <= 4 then
      v_tour := public.book_tour_for_migration(
        v_venue, v_lead, (date '2024-06-01' + (v_i - 1) + time '10:00')::timestamptz, 'past tour'
      );
      if coalesce(v_tour->>'ok', '') is distinct from 'true' then
        raise exception 'past tour % failed: %', v_i, v_tour;
      end if;
      if coalesce(v_tour->>'status', '') is distinct from 'completed' then
        raise exception 'past tour % must be completed, got %', v_i, v_tour;
      end if;
    elsif v_i <= 12 then
      v_tour := public.book_tour_for_migration(
        v_venue, v_lead, (timestamp '2027-10-01 10:00:00' + ((v_i - 5) * interval '1 day'))::timestamptz, 'future tour'
      );
      if coalesce(v_tour->>'ok', '') is distinct from 'true' then
        raise exception 'future tour % failed: %', v_i, v_tour;
      end if;
      if coalesce(v_tour->>'status', '') is distinct from 'scheduled' then
        raise exception 'future tour % must be scheduled, got %', v_i, v_tour;
      end if;
    elsif v_i <= 20 then
      insert into public.date_holds (venue_id, lead_id, space_id, title, hold_date, status)
      values (
        v_venue, v_lead, v_ball,
        'Hold ' || v_i,
        date '2027-11-01' + (v_i - 13),
        'active'
      );
    end if;
  end loop;

  -- Counts
  select count(*) into v_clients from public.clients where venue_id = v_venue;
  select count(*) into v_future_events from public.events
    where venue_id = v_venue and event_date >= date '2027-01-01' and status is distinct from 'cancelled';
  select count(*) into v_past_events from public.events
    where venue_id = v_venue and event_date < current_date and status = 'complete';
  select count(*) into v_tours from public.tour_appointments where venue_id = v_venue;
  select count(*) into v_past_tours from public.tour_appointments where venue_id = v_venue and status = 'completed';
  select count(*) into v_future_tours from public.tour_appointments where venue_id = v_venue and status in ('scheduled', 'confirmed');
  select count(*) into v_holds from public.date_holds where venue_id = v_venue and status = 'active';
  select count(*) into v_blocks from public.calendar_blocks
    where venue_id = v_venue and recurrence_rule = 'none';
  select count(*) into v_recurring from public.calendar_blocks
    where venue_id = v_venue and recurrence_rule is distinct from 'none';
  select count(*) into v_spaces from public.venue_spaces where venue_id = v_venue and is_active;
  select count(*) into v_vendors from public.venue_vendor_relationships where venue_id = v_venue;
  select count(*) into v_packages from public.packages where venue_id = v_venue;
  select count(*) into v_key_dates from public.client_key_dates where venue_id = v_venue;

  if v_clients <> 75 then raise exception 'clients want 75 got %', v_clients; end if;
  if v_future_events <> 30 then raise exception 'future events want 30 got %', v_future_events; end if;
  if v_past_events < 20 then raise exception 'past complete events want >=20 got %', v_past_events; end if;
  if v_tours <> 12 then raise exception 'tours want 12 got %', v_tours; end if;
  if v_past_tours <> 4 then raise exception 'past tours want 4 got %', v_past_tours; end if;
  if v_future_tours <> 8 then raise exception 'future tours want 8 got %', v_future_tours; end if;
  if v_holds <> 8 then raise exception 'holds want 8 got %', v_holds; end if;
  if v_blocks <> 15 then raise exception 'blocked dates want 15 got %', v_blocks; end if;
  if v_recurring <> 1 then raise exception 'recurring blocks want 1 got %', v_recurring; end if;
  if v_spaces <> 2 then raise exception 'spaces want 2 got %', v_spaces; end if;
  if v_vendors <> 5 then raise exception 'vendors want 5 got %', v_vendors; end if;
  if v_packages <> 3 then raise exception 'packages want 3 got %', v_packages; end if;

  -- Relationships preserved: every client has relationship_id; every dated event has client_id
  select count(*) into v_orphans from public.clients where venue_id = v_venue and relationship_id is null;
  if v_orphans <> 0 then raise exception 'orphan clients without relationship: %', v_orphans; end if;
  select count(*) into v_orphans from public.events where venue_id = v_venue and client_id is null;
  if v_orphans <> 0 then raise exception 'orphan events without client: %', v_orphans; end if;
  select count(*) into v_orphans from public.tour_appointments where venue_id = v_venue and lead_id is null;
  if v_orphans <> 0 then raise exception 'orphan tours without lead: %', v_orphans; end if;

  -- Fidelity sample: first future event times/space/end date
  if not exists (
    select 1 from public.events
     where venue_id = v_venue and name = 'Future Event 001'
       and event_date = date '2027-09-01'
       and event_end_date = date '2027-09-02'
       and start_time = time '16:00' and end_time = time '22:00'
       and setup_time = time '14:00' and teardown_time = time '23:00'
       and space_id = v_ball
  ) then
    raise exception 'event fidelity lost on Future Event 001';
  end if;

  -- Idempotency: same emails do not unique-constrain at the RPC; Migration Center
  -- dedupes. Canonical create would add a second row — count distinct emails = 75.
  select count(distinct lower(email)) into v_dup_clients
    from public.clients where venue_id = v_venue;
  if v_dup_clients <> 75 then raise exception 'distinct client emails want 75 got %', v_dup_clients; end if;

  -- AVAILABILITY: conflict on occupied Ballroom 2027-09-01 16–22
  v_result := public.assert_event_availability(
    v_venue, date '2027-09-01', date '2027-09-02',
    time '14:00', time '16:00', time '22:00', time '23:00', v_ball, null
  );
  if coalesce(v_result->>'ok', '') = 'true' then
    raise exception 'occupied ballroom must refuse, got %', v_result;
  end if;
  v_avail_conflict := true;

  -- Other space same window allowed (capacity 2, turnaround is per-space)
  v_result := public.assert_event_availability(
    v_venue, date '2027-09-01', null,
    time '14:00', time '16:00', time '22:00', time '23:00', v_garden, null
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'other space same day must succeed, got %', v_result;
  end if;
  v_avail_other_space := true;

  -- Fill garden then venue capacity should refuse a third
  insert into public.events (
    venue_id, name, event_date, start_time, end_time, setup_time, teardown_time, space_id, status
  ) values (
    v_venue, 'Probe Garden', date '2027-09-01',
    '16:00', '22:00', '14:00', '23:00', v_garden, 'draft'
  );
  begin
    insert into public.events (
      venue_id, name, event_date, start_time, end_time, space_id, status
    ) values (
      v_venue, 'Probe Third', date '2027-09-01', '16:00', '22:00', v_ball, 'draft'
    );
    raise exception 'third simultaneous event must be refused';
  exception
    when others then
      if sqlerrm not like '%already booked%' and sqlerrm not like '%Maximum simultaneous%' and sqlerrm not like '%space is already booked%' then
        raise;
      end if;
  end;
  v_avail_capacity := true;

  -- Turnaround: next day morning after teardown 23:00 + 24h
  v_result := public.assert_event_availability(
    v_venue, date '2027-09-03', null,
    time '08:00', time '10:00', time '14:00', time '15:00', v_ball, null
  );
  if coalesce(v_result->>'ok', '') = 'true' then
    raise exception 'turnaround must refuse early next-day ballroom, got %', v_result;
  end if;
  v_avail_turnaround := true;

  -- Calendar block 2027-12-01
  begin
    insert into public.events (venue_id, name, event_date, start_time, end_time, space_id, status)
    values (v_venue, 'On blocked date', date '2027-12-01', '16:00', '22:00', v_ball, 'draft');
    raise exception 'blocked date must refuse';
  exception
    when others then
      if sqlerrm not like '%blocked%' and sqlerrm not like '%calendar%' then raise; end if;
  end;
  v_avail_block := true;

  -- Recurring Sunday 2027-06-13 (week after 2027-06-06)
  begin
    insert into public.events (venue_id, name, event_date, start_time, end_time, space_id, status)
    values (v_venue, 'On recurring Sunday', date '2027-06-13', '10:00', '14:00', v_ball, 'draft');
    raise exception 'recurring block occurrence must refuse';
  exception
    when others then
      if sqlerrm not like '%blocked%' and sqlerrm not like '%calendar%' then raise; end if;
  end;
  v_avail_recur := true;

  -- Open date still bookable
  insert into public.events (
    venue_id, name, event_date, start_time, end_time, setup_time, teardown_time, space_id, status
  ) values (
    v_venue, 'Open date booking', date '2028-03-15', '16:00', '22:00', '14:00', '23:00', v_ball, 'draft'
  );
  v_avail_open := true;

  -- Future tour capacity: two at same slot (max 2), third refused
  insert into public.leads (venue_id, first_name, last_name, email, status)
  values (v_venue, 'Cap', 'A', 'cutover-cap-a@example.test', 'new')
  returning id into v_lead;
  v_tour := public.book_tour_for_migration(v_venue, v_lead, timestamptz '2027-08-20 10:00:00+00', null);
  insert into public.leads (venue_id, first_name, last_name, email, status)
  values (v_venue, 'Cap', 'B', 'cutover-cap-b@example.test', 'new')
  returning id into v_lead;
  v_tour := public.book_tour_for_migration(v_venue, v_lead, timestamptz '2027-08-20 10:00:00+00', null);
  insert into public.leads (venue_id, first_name, last_name, email, status)
  values (v_venue, 'Cap', 'C', 'cutover-cap-c@example.test', 'new')
  returning id into v_lead;
  v_tour := public.book_tour_for_migration(v_venue, v_lead, timestamptz '2027-08-20 10:00:00+00', null);
  if coalesce(v_tour->>'ok', '') is not distinct from 'true' then
    raise exception 'third simultaneous future tour must be refused';
  end if;
  v_tour_cap := true;

  -- Completed past tours do not consume a future slot
  insert into public.leads (venue_id, first_name, last_name, email, status)
  values (v_venue, 'PastCap', 'D', 'cutover-pastcap@example.test', 'new')
  returning id into v_lead;
  v_tour := public.book_tour_for_migration(v_venue, v_lead, timestamptz '2027-08-21 10:00:00+00', null);
  if coalesce(v_tour->>'ok', '') is distinct from 'true' then
    raise exception 'future tour after completed past tours must succeed, got %', v_tour;
  end if;
  v_past_no_cap := true;

  -- Missing space on live future Event is refused (no silent invalid Event)
  v_result := public.assert_event_availability(
    v_venue, date '2028-04-01', null, null, time '16:00', time '22:00', null, null, null
  );
  if coalesce(v_result->>'code', '') is distinct from 'missing_space' then
    raise exception 'multi-space venue must require space, got %', v_result;
  end if;
  v_missing_space := true;

  -- Historical complete does not block a future date
  v_result := public.assert_event_availability(
    v_venue, date '2028-05-01', null, time '14:00', time '16:00', time '22:00', time '23:00', v_ball, null
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'future date must remain bookable despite historical records, got %', v_result;
  end if;

  v_report := jsonb_build_object(
    'operational', true,
    'clients', v_clients,
    'futureEvents', v_future_events,
    'pastCompleteEvents', v_past_events,
    'tours', v_tours,
    'pastTours', v_past_tours,
    'futureTours', v_future_tours,
    'holds', v_holds,
    'blockedDates', v_blocks,
    'recurringBlocks', v_recurring,
    'spaces', v_spaces,
    'vendors', v_vendors,
    'packages', v_packages,
    'keyDates', v_key_dates,
    'availability', jsonb_build_object(
      'futureConflictRefused', v_avail_conflict,
      'otherSpaceAllowed', v_avail_other_space,
      'venueCapacityRefused', v_avail_capacity,
      'turnaroundRefused', v_avail_turnaround,
      'calendarBlockRefused', v_avail_block,
      'recurringBlockRefused', v_avail_recur,
      'openDateBookable', v_avail_open,
      'tourCapacityRefused', v_tour_cap,
      'completedToursDoNotConsume', v_past_no_cap,
      'missingSpaceSurfaced', v_missing_space,
      'historicalOverlapAllowed', v_hist_ok
    )
  );
  raise notice 'CUTOVER_E2E_JSON %', v_report;
end;
$$;
