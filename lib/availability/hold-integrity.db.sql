-- Disposable hold-integrity cases. The Node test wraps this in begin/rollback.

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_barn uuid := gen_random_uuid();
  v_garden uuid := gen_random_uuid();
  v_patio uuid := gen_random_uuid();
  v_rel uuid;
  v_lead uuid;
  v_other_lead uuid;
  v_client uuid;
  v_hold uuid;
  v_other_hold uuid;
  v_converted uuid;
  v_elapsed uuid;
  v_event uuid;
  v_other_event uuid;
  v_result jsonb;
  v_status text;
  v_booked date;
  v_spaces uuid[];
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
    'hold-' || v_owner::text || '@example.test', crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, timezone, space_operating_mode)
  values (v_venue, v_owner, 'Hold Integrity Venue', 'UTC', 'multi');

  insert into public.venue_staff (
    venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active, invite_token
  ) values (
    v_venue, v_owner, 'Owner', 'hold-' || v_owner::text || '@example.test',
    'owner', true, now(), true, null
  );

  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events, max_simultaneous_tours, min_turnaround_hours)
  values (v_venue, 2, 1, 0)
  on conflict (venue_id) do update set max_simultaneous_events = 2, min_turnaround_hours = 0;

  insert into public.venue_spaces (id, venue_id, name, is_active, permitted_uses, sort_order)
  values
    (v_barn, v_venue, 'Barn', true, array['reception','ceremony']::text[], 0),
    (v_garden, v_venue, 'Garden', true, array['reception','ceremony']::text[], 1),
    (v_patio, v_venue, 'Patio', true, array['reception','ceremony']::text[], 2);

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text,
    true
  );

  -- Lost releases this lead's protecting hold only.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'hold-lost@example.test', 'Lost', 'Lead')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Lost', 'Lead', 'hold-lost@example.test', 'new', 'new_inquiry', v_rel, date '2099-09-01')
  returning id into v_lead;

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'hold-other@example.test', 'Other', 'Lead')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id)
  values (v_venue, 'Other', 'Lead', 'hold-other@example.test', 'new', 'new_inquiry', v_rel)
  returning id into v_other_lead;

  insert into public.date_holds (venue_id, lead_id, space_id, title, hold_date, status)
  values (v_venue, v_lead, v_barn, 'Protecting', date '2099-09-01', 'active')
  returning id into v_hold;
  insert into public.date_hold_spaces (venue_id, hold_id, space_id)
  values (v_venue, v_hold, v_barn);

  insert into public.date_holds (venue_id, lead_id, space_id, title, hold_date, status)
  values (v_venue, v_other_lead, v_barn, 'Other lead', date '2099-09-01', 'active')
  returning id into v_other_hold;

  insert into public.date_holds (venue_id, lead_id, title, hold_date, status)
  values (v_venue, v_lead, 'Already converted', date '2099-09-02', 'converted')
  returning id into v_converted;

  insert into public.date_holds (venue_id, lead_id, title, hold_date, status, expires_at)
  values (v_venue, v_lead, 'Already elapsed', date '2099-09-03', 'active', now() - interval '2 days')
  returning id into v_elapsed;

  update public.leads
    set sales_stage = 'lost', lost_reason = 'other', lost_at = now()
  where id = v_lead;

  select status into v_status from public.date_holds where id = v_hold;
  if v_status is distinct from 'released' then
    raise exception 'lost did not release the protecting hold: %', v_status;
  end if;
  select status into v_status from public.date_holds where id = v_other_hold;
  if v_status is distinct from 'active' then
    raise exception 'lost released another lead hold: %', v_status;
  end if;
  select status into v_status from public.date_holds where id = v_converted;
  if v_status is distinct from 'converted' then
    raise exception 'lost changed a converted hold: %', v_status;
  end if;
  select status into v_status from public.date_holds where id = v_elapsed;
  if v_status is distinct from 'expired' then
    raise exception 'lost did not expire an elapsed hold: %', v_status;
  end if;

  -- New hold can be inserted on the released date.
  insert into public.date_holds (venue_id, lead_id, space_id, title, hold_date, status)
  values (v_venue, v_other_lead, v_garden, 'After lost', date '2099-09-01', 'active');

  -- Elapsed active hold becomes expired and does not block a new row.
  insert into public.date_holds (venue_id, lead_id, space_id, title, hold_date, status, expires_at)
  values (v_venue, v_other_lead, v_barn, 'Elapsed blocker', date '2099-09-10', 'active', now() - interval '1 hour')
  returning id into v_elapsed;
  perform public.expire_elapsed_date_holds(v_venue);
  select status into v_status from public.date_holds where id = v_elapsed;
  if v_status is distinct from 'expired' then
    raise exception 'expire_elapsed left status %', v_status;
  end if;
  insert into public.date_holds (venue_id, lead_id, space_id, title, hold_date, status)
  values (v_venue, v_other_lead, v_barn, 'After expire', date '2099-09-10', 'active');

  -- Cancelled booked relationship releases a leftover active hold.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'hold-cancel@example.test', 'Cancel', 'Lead')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Cancel', 'Lead', 'hold-cancel@example.test', 'new', 'new_inquiry', v_rel, date '2099-08-01')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Cancel', 'Lead', 'hold-cancel@example.test', 'confirmed', date '2099-08-01', v_rel)
  returning id into v_client;

  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-08-01',
      'startTime', '14:00',
      'endTime', '18:00',
      'spaceId', v_barn,
      'assignments', jsonb_build_array(
        jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn)
      )
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'cancel fixture booking failed: %', v_result;
  end if;
  select e.id, e.booked_at into v_event, v_booked
  from public.events e
  where e.client_id = v_client and e.booked_at is not null
  limit 1;

  insert into public.date_holds (venue_id, lead_id, space_id, title, hold_date, status)
  values (v_venue, v_lead, v_patio, 'Leftover', date '2099-08-20', 'active')
  returning id into v_hold;

  v_result := public.cancel_booked_event_relationship(v_venue, v_event);
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'cancel failed: %', v_result;
  end if;
  select status into v_status from public.date_holds where id = v_hold;
  if v_status is distinct from 'released' then
    raise exception 'cancel did not release leftover hold: %', v_status;
  end if;
  select sales_stage into v_status from public.leads where id = v_lead;
  if v_status is distinct from 'cancelled' then
    raise exception 'cancel did not set cancelled sales_stage: %', v_status;
  end if;
  select e.status, e.booked_at into v_status, v_booked from public.events e where e.id = v_event;
  if v_status is distinct from 'cancelled' or v_booked is null then
    raise exception 'cancel changed booked history incorrectly: % %', v_status, v_booked;
  end if;

  -- Conflicting secondary assignment is rejected and rolled back.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'hold-a@example.test', 'Event', 'A')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Event', 'A', 'hold-a@example.test', 'new', 'new_inquiry', v_rel, date '2099-07-01')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Event', 'A', 'hold-a@example.test', 'confirmed', date '2099-07-01', v_rel)
  returning id into v_client;
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-07-01',
      'startTime', '14:00',
      'endTime', '18:00',
      'spaceId', v_barn,
      'assignments', jsonb_build_array(
        jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn)
      )
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'event A booking failed: %', v_result;
  end if;
  select e.id into v_event from public.events e where e.client_id = v_client and e.booked_at is not null limit 1;

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'hold-b@example.test', 'Event', 'B')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Event', 'B', 'hold-b@example.test', 'new', 'new_inquiry', v_rel, date '2099-07-01')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Event', 'B', 'hold-b@example.test', 'confirmed', date '2099-07-01', v_rel)
  returning id into v_client;
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-07-01',
      'startTime', '14:00',
      'endTime', '18:00',
      'spaceId', v_garden,
      'assignments', jsonb_build_array(
        jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_garden)
      )
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'event B booking failed: %', v_result;
  end if;

  v_failed := false;
  begin
    perform public.replace_event_space_assignments(
      v_venue,
      v_event,
      v_barn,
      jsonb_build_array(
        jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn, 'sortOrder', 0),
        jsonb_build_object('useKey', 'ceremony', 'useLabel', 'Ceremony', 'spaceId', v_garden, 'sortOrder', 1)
      )
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'secondary garden assignment was accepted';
  end if;
  select coalesce(array_agg(a.space_id order by a.sort_order), '{}') into v_spaces
  from public.event_space_assignments a
  where a.event_id = v_event;
  if v_spaces is distinct from array[v_barn] then
    raise exception 'rejected assignment replace did not roll back: %', v_spaces;
  end if;

  perform public.replace_event_space_assignments(
    v_venue,
    v_event,
    v_barn,
    jsonb_build_array(
      jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn, 'sortOrder', 0),
      jsonb_build_object('useKey', 'ceremony', 'useLabel', 'Ceremony', 'spaceId', v_patio, 'sortOrder', 1)
    )
  );
  select coalesce(array_agg(a.space_id order by a.sort_order), '{}') into v_spaces
  from public.event_space_assignments a
  where a.event_id = v_event;
  if not (v_barn = any(v_spaces) and v_patio = any(v_spaces) and not (v_garden = any(v_spaces))) then
    raise exception 'valid patio assignment did not persist: %', v_spaces;
  end if;

  -- Adjacent times on the same space remain allowed.
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'hold-adj@example.test', 'Adj', 'Later')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Adj', 'Later', 'hold-adj@example.test', 'new', 'new_inquiry', v_rel, date '2099-07-02')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Adj', 'Later', 'hold-adj@example.test', 'confirmed', date '2099-07-02', v_rel)
  returning id into v_client;
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-07-02',
      'startTime', '10:00',
      'endTime', '12:00',
      'spaceId', v_barn,
      'assignments', jsonb_build_array(
        jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn)
      )
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'adjacent first booking failed: %', v_result;
  end if;
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'hold-adj2@example.test', 'Adj', 'Next')
  returning id into v_rel;
  insert into public.leads (venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date)
  values (v_venue, 'Adj', 'Next', 'hold-adj2@example.test', 'new', 'new_inquiry', v_rel, date '2099-07-02')
  returning id into v_lead;
  insert into public.clients (venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id)
  values (v_venue, v_lead, 'Adj', 'Next', 'hold-adj2@example.test', 'confirmed', date '2099-07-02', v_rel)
  returning id into v_client;
  v_result := public.book_relationship(
    p_venue_id := v_venue,
    p_client_id := v_client,
    p_confirmed_occupancy := jsonb_build_object(
      'eventDate', '2099-07-02',
      'startTime', '12:00',
      'endTime', '14:00',
      'spaceId', v_barn,
      'assignments', jsonb_build_array(
        jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn)
      )
    )
  );
  if coalesce(v_result->>'ok', '') <> 'true' then
    raise exception 'adjacent booking was rejected: %', v_result;
  end if;

  -- Removing the secondary space succeeds.
  select e.id into v_other_event from public.events e
  where e.client_id = v_client and e.booked_at is not null limit 1;
  perform public.replace_event_space_assignments(
    v_venue,
    v_event,
    v_barn,
    jsonb_build_array(
      jsonb_build_object('useKey', 'reception', 'useLabel', 'Reception', 'spaceId', v_barn, 'sortOrder', 0)
    )
  );
  select count(*) into v_status from public.event_space_assignments a where a.event_id = v_event;
  if v_status::integer is distinct from 1 then
    raise exception 'secondary removal left % assignments', v_status;
  end if;
end;
$$;
