-- Disposable booking-confirmation cases. The Node test wraps this in
-- begin/rollback. Nothing here is committed.

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_barn uuid := gen_random_uuid();
  v_garden uuid := gen_random_uuid();
  v_rel uuid;
  v_lead uuid;
  v_client uuid;
  v_hold uuid;
  v_event uuid;
  v_result jsonb;
  v_status text;
  v_booked date;
  v_space uuid;
  v_date date;
  v_start time;
  v_end time;
  v_assign uuid[];
  v_failed boolean;
begin
  alter table public.event_tasks add column if not exists client_id uuid;
  alter table public.event_playbook_applications add column if not exists client_id uuid;
  alter table public.timeline_sections add column if not exists client_id uuid;
  alter table public.timeline_entries add column if not exists client_id uuid;
  alter table public.floor_plans add column if not exists client_id uuid;
  alter table public.event_orders add column if not exists client_id uuid;
  alter table public.event_vendor_assignments add column if not exists client_id uuid;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'occ-' || v_owner::text || '@example.test', crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, timezone, space_operating_mode)
  values (v_venue, v_owner, 'Occupancy Confirm Venue', 'UTC', 'multi');

  insert into public.venue_staff (
    venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active, invite_token
  ) values (
    v_venue, v_owner, 'Owner', 'occ-' || v_owner::text || '@example.test',
    'owner', true, now(), true, null
  );

  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events, max_simultaneous_tours, min_turnaround_hours)
  values (v_venue, 3, 1, 0)
  on conflict (venue_id) do update set max_simultaneous_events = 3, min_turnaround_hours = 0;

  insert into public.venue_spaces (id, venue_id, name, is_active, permitted_uses, sort_order)
  values
    (v_barn, v_venue, 'Barn', true, array['reception','ceremony']::text[], 0),
    (v_garden, v_venue, 'Garden', true, array['reception','ceremony']::text[], 1);

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text,
    true
  );

  -- TEST 6 — missing space is rejected and the hold stays active.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'occ-missing@example.test', 'Missing', 'Space')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Missing', 'Space', 'occ-missing@example.test', 'new', 'new_inquiry', v_rel, date '2099-05-01')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Missing', 'Space', 'occ-missing@example.test', 'confirmed', date '2099-05-01', v_rel)
  returning id into v_client;
  insert into public.date_holds (venue_id, lead_id, title, hold_date, status)
  values (v_venue, v_lead, 'Whole venue', date '2099-05-01', 'active')
  returning id into v_hold;

  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-05-01',
      'eventEndDate', null,
      'startTime', null,
      'endTime', null,
      'spaceId', null,
      'assignments', '[]'::jsonb
    )
  );
  if coalesce(v_result->>'ok', '') <> 'false' then
    raise exception 'missing space was accepted: %', v_result;
  end if;
  select status into v_status from public.date_holds where id = v_hold;
  if v_status is distinct from 'active' then
    raise exception 'missing-space booking consumed the hold';
  end if;
  if exists (select 1 from public.events e where e.client_id = v_client and e.booked_at is not null) then
    raise exception 'missing-space booking set booked_at';
  end if;
  select sales_stage into v_status from public.leads where id = v_lead;
  if v_status is distinct from 'new_inquiry' then
    raise exception 'missing-space booking moved the pipeline';
  end if;

  -- TEST 1 — whole-venue hold, confirm Barn and times.
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-05-01',
      'startTime', '14:00',
      'endTime', '18:00',
      'spaceId', v_barn,
      'assignments', jsonb_build_array(jsonb_build_object(
        'useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn
      ))
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'barn booking failed: %', v_result;
  end if;
  v_event := (v_result->>'event_id')::uuid;
  select event_date, start_time, end_time, space_id, booked_at
    into v_date, v_start, v_end, v_space, v_booked
  from public.events where id = v_event;
  if v_date is distinct from date '2099-05-01' or v_space is distinct from v_barn
     or v_start is distinct from time '14:00' or v_end is distinct from time '18:00'
     or v_booked is null then
    raise exception 'barn event occupancy mismatch';
  end if;
  select array_agg(space_id) into v_assign from public.event_space_assignments where event_id = v_event;
  if not (v_barn = any (v_assign)) then
    raise exception 'barn assignment missing';
  end if;
  select status into v_status from public.date_holds where id = v_hold;
  if v_status is distinct from 'converted' then
    raise exception 'whole-venue hold was not converted';
  end if;
  select sales_stage into v_status from public.leads where id = v_lead;
  if v_status is distinct from 'booked' then
    raise exception 'pipeline was not booked';
  end if;

  -- Second conflicting Barn booking is rejected. Its hold stays active.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'occ-conflict@example.test', 'Conflict', 'Two')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Conflict', 'Two', 'occ-conflict@example.test', 'new', 'new_inquiry', v_rel, date '2099-05-01')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Conflict', 'Two', 'occ-conflict@example.test', 'confirmed', date '2099-05-01', v_rel)
  returning id into v_client;
  insert into public.date_holds (venue_id, lead_id, title, hold_date, status, space_id)
  values (v_venue, v_lead, 'Barn hold', date '2099-05-01', 'active', v_barn)
  returning id into v_hold;
  v_failed := false;
  begin
    v_result := public.book_relationship(
      p_venue_id := v_venue,
      p_client_id := v_client,
      p_confirmed_occupancy := jsonb_build_object(
        'eventDate', '2099-05-01', 'startTime', '15:00', 'endTime', '17:00',
        'spaceId', v_barn,
        'assignments', jsonb_build_array(jsonb_build_object(
          'useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn
        ))
      )
    );
    if coalesce(v_result->>'ok', '') = 'true' then
      raise exception 'conflicting barn booking succeeded';
    end if;
  exception when others then
    v_failed := true;
  end;
  if not v_failed and coalesce(v_result->>'ok', '') <> 'false' then
    raise exception 'conflict did not fail';
  end if;
  select status into v_status from public.date_holds where id = v_hold;
  if v_status is distinct from 'active' then
    raise exception 'failed booking consumed the hold';
  end if;
  select sales_stage into v_status from public.leads where id = v_lead;
  if v_status is distinct from 'new_inquiry' then
    raise exception 'failed booking moved the pipeline';
  end if;

  -- TEST 4 — adjacent times are allowed; overlap is not.
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-05-01', 'startTime', '18:00', 'endTime', '20:00',
      'spaceId', v_barn,
      'assignments', jsonb_build_array(jsonb_build_object(
        'useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn
      ))
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'adjacent barn booking failed: %', v_result;
  end if;

  -- TEST 2 — Barn hold, book Garden.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'occ-garden@example.test', 'Garden', 'Guest')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Garden', 'Guest', 'occ-garden@example.test', 'new', 'new_inquiry', v_rel, date '2099-06-01')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Garden', 'Guest', 'occ-garden@example.test', 'confirmed', date '2099-06-01', v_rel)
  returning id into v_client;
  insert into public.date_holds (venue_id, lead_id, title, hold_date, status, space_id)
  values (v_venue, v_lead, 'Barn hold', date '2099-06-01', 'active', v_barn)
  returning id into v_hold;
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-06-01', 'startTime', '12:00', 'endTime', '16:00',
      'spaceId', v_garden,
      'assignments', jsonb_build_array(jsonb_build_object(
        'useKey', 'ceremony', 'useLabel', 'Ceremony', 'spaceId', v_garden
      ))
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'garden booking failed: %', v_result;
  end if;
  v_event := (v_result->>'event_id')::uuid;
  select space_id into v_space from public.events where id = v_event;
  if v_space is distinct from v_garden then
    raise exception 'event space is not Garden';
  end if;
  if exists (
    select 1 from public.event_space_assignments a
    where a.event_id = v_event and a.space_id = v_barn
  ) then
    raise exception 'barn remained the event occupancy';
  end if;
  select status into v_status from public.date_holds where id = v_hold;
  if v_status is distinct from 'converted' then
    raise exception 'overlapping barn hold was not converted with the booking';
  end if;

  -- TEST 3 — hold on date A, book date B. No occupancy on A.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'occ-date@example.test', 'Date', 'Change')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Date', 'Change', 'occ-date@example.test', 'new', 'new_inquiry', v_rel, date '2099-07-01')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Date', 'Change', 'occ-date@example.test', 'confirmed', date '2099-07-01', v_rel)
  returning id into v_client;
  insert into public.date_holds (venue_id, lead_id, title, hold_date, status)
  values (v_venue, v_lead, 'Date A', date '2099-07-01', 'active')
  returning id into v_hold;
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-07-02', 'startTime', '10:00', 'endTime', '12:00',
      'spaceId', v_garden,
      'assignments', jsonb_build_array(jsonb_build_object(
        'useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_garden
      ))
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'date change booking failed: %', v_result;
  end if;
  v_event := (v_result->>'event_id')::uuid;
  select event_date into v_date from public.events where id = v_event;
  if v_date is distinct from date '2099-07-02' then
    raise exception 'event did not use date B';
  end if;
  if exists (
    select 1 from public.events e
    where e.venue_id = v_venue and e.event_date = date '2099-07-01' and e.booked_at is not null
      and e.client_id = v_client
  ) then
    raise exception 'stale occupancy on date A';
  end if;
  select status into v_status from public.date_holds where id = v_hold;
  if v_status is distinct from 'active' then
    raise exception 'non-overlapping date A hold was converted';
  end if;

  -- TEST 5 — two spaces persisted; a later conflict on one of them is rejected.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'occ-multi@example.test', 'Multi', 'Space')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Multi', 'Space', 'occ-multi@example.test', 'new', 'new_inquiry', v_rel, date '2099-08-01')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Multi', 'Space', 'occ-multi@example.test', 'confirmed', date '2099-08-01', v_rel)
  returning id into v_client;
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-08-01', 'startTime', '11:00', 'endTime', '15:00',
      'spaceId', v_barn,
      'assignments', jsonb_build_array(
        jsonb_build_object('useKey', 'ceremony', 'useLabel', 'Ceremony', 'spaceId', v_garden),
        jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn)
      )
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'multi-space booking failed: %', v_result;
  end if;
  v_event := (v_result->>'event_id')::uuid;
  if (
    select count(distinct space_id) from public.event_space_assignments where event_id = v_event
  ) is distinct from 2 then
    raise exception 'multi-space assignments were not both stored';
  end if;

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'occ-multi2@example.test', 'Multi', 'Conflict')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id)
  values (v_venue, 'Multi', 'Conflict', 'occ-multi2@example.test', 'new', 'new_inquiry', v_rel)
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, relationship_id)
  values (v_venue, v_lead, 'Multi', 'Conflict', 'occ-multi2@example.test', 'confirmed', v_rel)
  returning id into v_client;
  v_failed := false;
  begin
    v_result := public.book_relationship(
      p_venue_id := v_venue,
      p_client_id := v_client,
      p_confirmed_occupancy := jsonb_build_object(
        'eventDate', '2099-08-01', 'startTime', '12:00', 'endTime', '14:00',
        'spaceId', v_garden,
        'assignments', jsonb_build_array(jsonb_build_object(
          'useKey', 'ceremony', 'useLabel', 'Ceremony', 'spaceId', v_garden
        ))
      )
    );
    if coalesce(v_result->>'ok', '') = 'true' then
      raise exception 'garden overlap with multi-space booking succeeded';
    end if;
  exception when others then
    v_failed := true;
  end;
  if not v_failed and coalesce(v_result->>'ok', '') <> 'false' then
    raise exception 'multi-space conflict did not fail';
  end if;
end $$;
