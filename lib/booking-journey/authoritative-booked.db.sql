-- Live DB cases for authoritative Booked enforcement.
-- Wrapped by the Node test in a transaction that always rolls back.

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_rel uuid;
  v_lead uuid;
  v_client uuid;
  v_event uuid;
  v_direct uuid;
  v_direct_lead uuid;
  v_result jsonb;
  v_denied boolean := false;
  v_stage text;
  v_client_status text;
  v_event_status text;
  v_booked_at date;
begin
  alter table public.leads drop constraint if exists leads_sales_stage_check;
  alter table public.leads add constraint leads_sales_stage_check
    check (sales_stage in (
      'new_inquiry', 'outreach_sent', 'enrolled_in_sequence', 'tour_scheduled',
      'proposal_sent', 'booked', 'lost', 'cancelled'
    ));

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
    'booked-auth-' || v_owner::text || '@example.test', crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, timezone, space_operating_mode)
  values (v_venue, v_owner, 'Booked Auth Venue', 'UTC', 'single');

  insert into public.venue_staff (
    venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active, invite_token
  ) values (
    v_venue, v_owner, 'Owner', 'booked-auth-' || v_owner::text || '@example.test',
    'owner', true, now(), true, null
  );

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'booked-auth@example.test', 'Auth', 'Lead')
  returning id into v_rel;

  insert into public.leads (
    venue_id, first_name, last_name, email, status, sales_stage, relationship_id, event_date
  ) values (
    v_venue, 'Auth', 'Lead', 'booked-auth@example.test', 'new', 'new_inquiry', v_rel, date '2028-06-01'
  ) returning id into v_lead;

  begin
    update public.leads set sales_stage = 'booked' where id = v_lead;
  exception when others then
    if sqlerrm like '%book_relationship%' then
      v_denied := true;
    else
      raise;
    end if;
  end;
  if not v_denied then
    raise exception 'unauthorized booked update did not fail';
  end if;

  v_denied := false;
  begin
    insert into public.leads (
      venue_id, first_name, last_name, email, status, sales_stage, event_date
    ) values (
      v_venue, 'Rogue', 'Booked', 'rogue-booked@example.test', 'new', 'booked', date '2028-08-01'
    );
  exception when others then
    if sqlerrm like '%book_relationship%' then
      v_denied := true;
    else
      raise;
    end if;
  end;
  if not v_denied then
    raise exception 'unauthorized booked insert did not fail';
  end if;

  insert into public.clients (
    venue_id, lead_id, first_name, last_name, email, status, event_date, relationship_id
  ) values (
    v_venue, v_lead, 'Auth', 'Lead', 'booked-auth@example.test', 'confirmed', date '2028-06-01', v_rel
  ) returning id into v_client;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text,
    true
  );

  v_result := public.book_relationship(
    v_venue, v_client, null, null, null, 'wedding', date '2028-06-01'
  );
  if coalesce(v_result ->> 'ok', '') is distinct from 'true' then
    raise exception 'lead-linked book_relationship failed: %', v_result;
  end if;
  if (v_result ->> 'lead_id')::uuid is distinct from v_lead then
    raise exception 'lead-linked booking created a duplicate lead';
  end if;
  select sales_stage into v_stage from public.leads where id = v_lead;
  if v_stage is distinct from 'booked' then
    raise exception 'lead-linked booking did not set sales_stage booked';
  end if;

  insert into public.clients (
    venue_id, first_name, last_name, email, status, event_date
  ) values (
    v_venue, 'Direct', 'Client', 'booked-direct@example.test', 'confirmed', date '2028-07-01'
  ) returning id into v_direct;

  v_result := public.book_relationship(
    v_venue, v_direct, null, null, 'Direct Client Event', 'wedding', date '2028-07-01'
  );
  if coalesce(v_result ->> 'ok', '') is distinct from 'true' then
    raise exception 'direct-client book_relationship failed: %', v_result;
  end if;
  v_direct_lead := (v_result ->> 'lead_id')::uuid;
  if v_direct_lead is null then
    raise exception 'direct-client booking did not create a pipeline lead';
  end if;
  if not exists (
    select 1 from public.clients c
    where c.id = v_direct and c.lead_id = v_direct_lead and c.venue_id = v_venue
  ) then
    raise exception 'direct-client was not associated to the created lead';
  end if;
  select sales_stage into v_stage from public.leads where id = v_direct_lead;
  if v_stage is distinct from 'booked' then
    raise exception 'direct-client lead is not booked';
  end if;
  if not exists (
    select 1 from public.events e
    where e.client_id = v_direct and e.venue_id = v_venue and e.booked_at is not null
  ) then
    raise exception 'direct-client event was not booked';
  end if;

  select e.id into v_event
  from public.events e
  where e.client_id = v_client and e.venue_id = v_venue
  limit 1;

  v_result := public.cancel_booked_event_relationship(v_venue, v_event);
  if coalesce(v_result ->> 'ok', '') is distinct from 'true' then
    raise exception 'cancel RPC failed: %', v_result;
  end if;
  select l.sales_stage, c.status, e.status, e.booked_at
    into v_stage, v_client_status, v_event_status, v_booked_at
  from public.events e
  join public.clients c on c.id = e.client_id
  join public.leads l on l.id = c.lead_id
  where e.id = v_event;
  if v_stage is distinct from 'cancelled'
     or v_client_status is distinct from 'cancelled'
     or v_event_status is distinct from 'cancelled'
     or v_booked_at is null then
    raise exception 'cancel was not atomic or cleared booked_at: % % % %',
      v_stage, v_client_status, v_event_status, v_booked_at;
  end if;

  raise notice 'authoritative_booked_ok';
end;
$$;
