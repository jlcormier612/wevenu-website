-- Spaces + Booking-E1: one catalog, preference ≠ assignment, seed inside
-- book_relationship, inactive/disallowed skip, rollback, venue isolation.
-- Wrapped by the Node test in a transaction that always rolls back.

do $$
declare
  v_owner    uuid := gen_random_uuid();
  v_other    uuid := gen_random_uuid();
  v_venue    uuid := gen_random_uuid();
  v_venue_b  uuid := gen_random_uuid();
  v_garden   uuid := gen_random_uuid();
  v_barn     uuid := gen_random_uuid();
  v_inactive uuid := gen_random_uuid();
  v_disallow uuid := gen_random_uuid();
  v_rec_only uuid := gen_random_uuid();
  v_rel      uuid;
  v_lead     uuid;
  v_client   uuid;
  v_event    uuid;
  v_result   jsonb;
  v_count    integer;
  v_kind     text;
  v_space    uuid;
  v_ext_c    text;
  v_ext_r    text;
  v_stage    text;
begin
  -- Planning-attach columns exist in production book_relationship. Local
  -- availability DBs may predate them; add only inside this rolled-back test.
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
  ) values
    ('00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
     'spaces-owner-' || v_owner::text || '@example.test', crypt('not-a-login', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_other, 'authenticated', 'authenticated',
     'spaces-other-' || v_other::text || '@example.test', crypt('not-a-login', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into public.venues (id, owner_user_id, name, timezone, space_operating_mode)
  values
    (v_venue, v_owner, 'Spaces Multi Venue', 'UTC', 'multi'),
    (v_venue_b, v_other, 'Spaces Other Venue', 'UTC', 'single');

  insert into public.venue_staff (
    venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active, invite_token
  ) values
    (v_venue, v_owner, 'Owner', 'spaces-owner-' || v_owner::text || '@example.test',
     'owner', true, now(), true, null),
    (v_venue_b, v_other, 'Other', 'spaces-other-' || v_other::text || '@example.test',
     'owner', true, now(), true, null);

  insert into public.venue_spaces (id, venue_id, name, is_active, permitted_uses, sort_order)
  values
    (v_garden, v_venue, 'Garden', true, array['ceremony']::text[], 0),
    (v_barn, v_venue, 'Barn', true, array['reception']::text[], 1),
    (v_inactive, v_venue, 'Old Lawn', false, array['ceremony']::text[], 2),
    (v_disallow, v_venue, 'Kitchen', true, array['dining']::text[], 3),
    (v_rec_only, v_venue_b, 'Hall', true, array['reception']::text[], 0);

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'spaces-a@example.test', 'Ada', 'Lovelace')
  returning id into v_rel;

  insert into public.leads (
    venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date
  ) values (
    v_venue, 'Ada', 'Lovelace', 'spaces-a@example.test', 'new', 'new_inquiry', v_rel, date '2099-09-01'
  ) returning id into v_lead;

  insert into public.clients (
    venue_id, lead_id, first_name, last_name, email, status, event_date
  ) values (
    v_venue, v_lead, 'Ada', 'Lovelace', 'spaces-a@example.test', 'confirmed', date '2099-09-01'
  ) returning id into v_client;

  -- Shape: cocktail_hour is not a release preference use_key
  begin
    insert into public.lead_event_space_preferences (
      venue_id, lead_id, use_key, preference_kind
    ) values (v_venue, v_lead, 'cocktail_hour', 'undecided');
    raise exception 'cocktail_hour preference must be rejected';
  exception
    when check_violation then null;
    when others then
      if sqlerrm not like '%use_key%' then raise; end if;
  end;

  -- Venue isolation: space from venue B cannot attach to venue A preference
  begin
    insert into public.lead_event_space_preferences (
      venue_id, lead_id, use_key, preference_kind, space_id
    ) values (v_venue, v_lead, 'ceremony', 'venue_space', v_rec_only);
    raise exception 'foreign-venue space must be rejected';
  exception
    when others then
      if sqlerrm not like '%must belong to the venue%' and sqlerrm not like '%lead_event_space_preferences%' then
        raise;
      end if;
  end;

  insert into public.lead_event_space_preferences (
    venue_id, lead_id, use_key, preference_kind, space_id, external_location
  ) values
    (v_venue, v_lead, 'ceremony', 'venue_space', v_garden, null),
    (v_venue, v_lead, 'reception', 'venue_space', v_barn, null);

  select count(*)::integer into v_count
  from public.event_space_assignments
  where venue_id = v_venue;
  if v_count <> 0 then
    raise exception 'preference must not create assignments before booking, count=%', v_count;
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text,
    true
  );

  v_result := public.book_relationship(
    v_venue, v_client, null, null, null, null, date '2099-09-01'
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'venue_space booking must succeed: %', v_result;
  end if;
  v_event := (v_result->>'event_id')::uuid;

  select count(*)::integer into v_count
  from public.event_space_assignments
  where event_id = v_event and use_key = 'ceremony' and space_id = v_garden;
  if v_count <> 1 then
    raise exception 'ceremony assignment must be seeded';
  end if;
  select count(*)::integer into v_count
  from public.event_space_assignments
  where event_id = v_event and use_key = 'reception' and space_id = v_barn;
  if v_count <> 1 then
    raise exception 'reception assignment must be seeded';
  end if;

  select preference_kind, space_id into v_kind, v_space
  from public.lead_event_space_preferences
  where lead_id = v_lead and use_key = 'ceremony';
  if v_kind is distinct from 'venue_space' or v_space is distinct from v_garden then
    raise exception 'booking must not rewrite lead preferences';
  end if;

  -- Second book must not rewrite post-book authority / prefs
  update public.event_space_assignments
    set space_id = v_barn
  where event_id = v_event and use_key = 'ceremony';

  v_result := public.book_relationship(v_venue, v_client);
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'already-booked reentry must succeed: %', v_result;
  end if;
  select space_id into v_space
  from public.event_space_assignments
  where event_id = v_event and use_key = 'ceremony';
  if v_space is distinct from v_barn then
    raise exception 'second book must not rewrite post-book assignment';
  end if;

  -- External + undecided on a fresh lead
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'spaces-b@example.test', 'Bea', 'External')
  returning id into v_rel;
  insert into public.leads (
    venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date
  ) values (
    v_venue, 'Bea', 'External', 'spaces-b@example.test', 'new', 'new_inquiry', v_rel, date '2099-09-08'
  ) returning id into v_lead;
  insert into public.clients (
    venue_id, lead_id, first_name, last_name, email, status, event_date
  ) values (
    v_venue, v_lead, 'Bea', 'External', 'spaces-b@example.test', 'confirmed', date '2099-09-08'
  ) returning id into v_client;
  insert into public.lead_event_space_preferences (
    venue_id, lead_id, use_key, preference_kind, space_id, external_location
  ) values
    (v_venue, v_lead, 'ceremony', 'external', null, 'City Hall'),
    (v_venue, v_lead, 'reception', 'undecided', null, null);

  v_result := public.book_relationship(
    v_venue, v_client, null, null, null, null, date '2099-09-08'
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'external/undecided booking must succeed: %', v_result;
  end if;
  v_event := (v_result->>'event_id')::uuid;
  select external_ceremony_location, external_reception_location
    into v_ext_c, v_ext_r
  from public.events where id = v_event;
  if v_ext_c is distinct from 'City Hall' then
    raise exception 'external ceremony must copy, got %', v_ext_c;
  end if;
  if v_ext_r is not null then
    raise exception 'undecided reception must seed nothing, got %', v_ext_r;
  end if;
  select count(*)::integer into v_count
  from public.event_space_assignments where event_id = v_event;
  if v_count <> 0 then
    raise exception 'external/undecided must not create assignments, count=%', v_count;
  end if;
  select preference_kind into v_kind
  from public.lead_event_space_preferences
  where lead_id = v_lead and use_key = 'ceremony';
  if v_kind is distinct from 'external' then
    raise exception 'external preference must remain historical';
  end if;

  -- Inactive + disallowed skip; booking still succeeds
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'spaces-c@example.test', 'Cara', 'Skip')
  returning id into v_rel;
  insert into public.leads (
    venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date
  ) values (
    v_venue, 'Cara', 'Skip', 'spaces-c@example.test', 'new', 'new_inquiry', v_rel, date '2099-09-15'
  ) returning id into v_lead;
  insert into public.clients (
    venue_id, lead_id, first_name, last_name, email, status, event_date
  ) values (
    v_venue, v_lead, 'Cara', 'Skip', 'spaces-c@example.test', 'confirmed', date '2099-09-15'
  ) returning id into v_client;
  insert into public.lead_event_space_preferences (
    venue_id, lead_id, use_key, preference_kind, space_id
  ) values
    (v_venue, v_lead, 'ceremony', 'venue_space', v_inactive),
    (v_venue, v_lead, 'reception', 'venue_space', v_disallow);

  v_result := public.book_relationship(
    v_venue, v_client, null, null, null, null, date '2099-09-15'
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'inactive/disallowed booking must succeed: %', v_result;
  end if;
  v_event := (v_result->>'event_id')::uuid;
  select count(*)::integer into v_count
  from public.event_space_assignments where event_id = v_event;
  if v_count <> 0 then
    raise exception 'inactive/disallowed prefs must skip seeding, count=%', v_count;
  end if;
  select sales_stage into v_stage from public.leads where id = v_lead;
  if v_stage is distinct from 'booked' then
    raise exception 'skipped prefs must still book the lead';
  end if;

  -- Rollback: if seeding fails, no partial booking remains
  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'spaces-d@example.test', 'Dee', 'Rollback')
  returning id into v_rel;
  insert into public.leads (
    venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date
  ) values (
    v_venue, 'Dee', 'Rollback', 'spaces-d@example.test', 'new', 'new_inquiry', v_rel, date '2099-09-22'
  ) returning id into v_lead;
  insert into public.clients (
    venue_id, lead_id, first_name, last_name, email, status, event_date
  ) values (
    v_venue, v_lead, 'Dee', 'Rollback', 'spaces-d@example.test', 'confirmed', date '2099-09-22'
  ) returning id into v_client;
  insert into public.lead_event_space_preferences (
    venue_id, lead_id, use_key, preference_kind, space_id
  ) values (v_venue, v_lead, 'ceremony', 'venue_space', v_garden);

  create temp table if not exists _space_seed_fail (venue_id uuid primary key);
  insert into _space_seed_fail (venue_id) values (v_venue)
  on conflict do nothing;

  create or replace function public._htc_space_seed_fail()
  returns trigger language plpgsql as $t$
  begin
    if exists (select 1 from _space_seed_fail f where f.venue_id = new.venue_id) then
      raise exception 'seed_fail';
    end if;
    return new;
  end;
  $t$;

  create trigger space_seed_fail
    before insert on public.event_space_assignments
    for each row execute function public._htc_space_seed_fail();

  begin
    v_result := public.book_relationship(
      v_venue, v_client, null, null, null, null, date '2099-09-22'
    );
    raise exception 'seeding failure must roll back booking, got %', v_result;
  exception
    when others then
      if sqlerrm not like '%seed_fail%' then raise; end if;
  end;

  drop trigger space_seed_fail on public.event_space_assignments;
  delete from _space_seed_fail where venue_id = v_venue;

  if exists (select 1 from public.events e join public.clients c on c.id = e.client_id where c.id = v_client) then
    raise exception 'rolled-back booking must not leave an event';
  end if;
  select sales_stage into v_stage from public.leads where id = v_lead;
  if v_stage is not distinct from 'booked' then
    raise exception 'rolled-back booking must not leave the lead booked';
  end if;
  if not exists (
    select 1 from public.lead_event_space_preferences
    where lead_id = v_lead and use_key = 'ceremony' and preference_kind = 'venue_space'
  ) then
    raise exception 'rollback must leave historical preference intact';
  end if;

  raise notice 'spaces_booking_e1_ok';
end;
$$;
