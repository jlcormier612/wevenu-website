-- Combined Relationship Save: follow-up persists first; conflicting future
-- tour insert is rejected; follow-up remains; no conflicting tour row.
-- Mirrors lib/leads/repository.ts updateRelationshipFields ordering:
--   1) UPDATE leads follow-up fields (standalone, committed independently)
--   2) INSERT occupying tour (capacity-checked)
-- Wrapped by the Node test in a transaction that always rolls back.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_rel     uuid;
  v_lead    uuid;
  v_occup   uuid;
  v_count   integer;
  v_follow  date;
  v_action  text;
  v_sched   timestamptz := '2099-06-15 10:00:00+00';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'follow-up-first-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, tour_duration_minutes, tour_buffer_minutes, timezone)
  values (v_venue, v_owner, 'Follow-up First Venue', 60, 30, 'UTC');

  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (v_venue, 'clockd-follow@example.test', 'Clock', 'D')
  returning id into v_rel;

  insert into public.leads (venue_id, first_name, last_name, email, status, relationship_id)
  values (v_venue, 'Clock', 'D', 'clockd-follow@example.test', 'new', v_rel)
  returning id into v_lead;

  insert into public.tour_appointments (
    venue_id, scheduled_at, duration_minutes, status, contact_name, origin
  ) values (
    v_venue, v_sched, 60, 'scheduled', 'Occupier', 'scheduled'
  ) returning id into v_occup;

  -- Step 1 of the combined Save: persist follow-up independently.
  update public.leads
    set follow_up_date = date '2026-10-16',
        next_action_text = 'Send lookbook',
        last_contacted_at = date '2026-09-30'
  where id = v_lead and venue_id = v_venue;

  -- Step 2: future tour at the occupied slot must be rejected.
  begin
    insert into public.tour_appointments (
      venue_id, lead_id, scheduled_at, duration_minutes, status, contact_name, origin
    ) values (
      v_venue, v_lead, v_sched, 60, 'scheduled', 'Clock D', 'scheduled'
    );
    raise exception 'conflicting future tour must be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  select follow_up_date, next_action_text
    into v_follow, v_action
  from public.leads
  where id = v_lead;

  if v_follow is distinct from date '2026-10-16' then
    raise exception 'follow-up date must remain 2026-10-16, got %', v_follow;
  end if;
  if v_action is distinct from 'Send lookbook' then
    raise exception 'next_action_text must remain, got %', v_action;
  end if;

  select count(*)::integer into v_count
  from public.tour_appointments
  where venue_id = v_venue;

  if v_count <> 1 then
    raise exception 'conflicting tour must not be created, count=%', v_count;
  end if;

  if not exists (
    select 1 from public.tour_appointments where id = v_occup and scheduled_at = v_sched
  ) then
    raise exception 'occupying tour row must be unchanged';
  end if;

  if exists (
    select 1 from public.tour_appointments where lead_id = v_lead
  ) then
    raise exception 'lead must have zero tour rows after conflict';
  end if;

  raise notice 'relationship_follow_up_first_ok';
end;
$$;
