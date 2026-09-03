-- Direct Add Client+Event transactional refusal.
-- Uses the coordinator/authenticated path: JWT claims for the venue owner
-- (same signals PostgREST sets). Does not SET ROLE service_role — that is a
-- different GRANT surface than the in-app Direct Add RPC, and we do not
-- widen production grants just to make a harness pass.
-- p_venue_id_override is still passed (as the app does) and is ignored unless
-- auth.role() is service_role; venue resolution is current_user_venue_id().

do $$
declare
  v_owner    uuid := gen_random_uuid();
  v_venue    uuid := gen_random_uuid();
  v_result   jsonb;
  v_client_n integer;
  v_event_n  integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'k7-direct-owner-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name)
  values (v_venue, v_owner, 'K7 Direct Add Transactional Fixture');

  insert into public.venue_capacity_rules (venue_id, max_simultaneous_events)
  values (v_venue, 1);

  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Occupier', '2028-04-01', '10:00', '14:00', 'draft');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text,
    true
  );

  begin
    v_result := public.create_client_and_event_with_availability(
      jsonb_build_object(
        'firstName', 'Direct', 'lastName', 'Reject',
        'email', 'k7-direct-reject-' || v_owner::text || '@example.test'
      ),
      jsonb_build_object(
        'name', 'Conflict Event',
        'eventDate', '2028-04-01',
        'startTime', '11:00',
        'endTime', '13:00'
      ),
      v_venue
    );
    raise exception 'overlapping Direct Add must be rejected, got %', v_result;
  exception
    when others then
      if sqlerrm not like '%already booked%' and sqlerrm not like '%Maximum simultaneous%' then
        raise;
      end if;
  end;

  select count(*) into v_client_n
  from public.clients
  where venue_id = v_venue
    and email = 'k7-direct-reject-' || v_owner::text || '@example.test';
  if v_client_n <> 0 then
    raise exception 'rejected Direct Add must not leave a Client, found %', v_client_n;
  end if;

  select count(*) into v_event_n
  from public.events
  where venue_id = v_venue and name = 'Conflict Event';
  if v_event_n <> 0 then
    raise exception 'rejected Direct Add must not leave an Event, found %', v_event_n;
  end if;

  v_result := public.create_client_and_event_with_availability(
    jsonb_build_object(
      'firstName', 'Direct', 'lastName', 'Ok',
      'email', 'k7-direct-ok-' || v_owner::text || '@example.test'
    ),
    jsonb_build_object(
      'name', 'Open Day Event',
      'eventDate', '2028-04-02',
      'startTime', '10:00',
      'endTime', '14:00'
    ),
    v_venue
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'Direct Add on an open date must succeed, got %', v_result;
  end if;

  delete from public.venues where id = v_venue;
  delete from auth.users where id = v_owner;
end;
$$;
