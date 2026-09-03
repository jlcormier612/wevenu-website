-- Tour booking atomicity + recurring calendar_blocks write-path cases.
-- Wrapped by the Node test in a transaction that always rolls back.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_embed   text := replace(gen_random_uuid()::text, '-', '');
  v_email   text := 'k7-atomic-' || v_owner::text || '@example.test';
  v_result  jsonb;
  v_lead_n  integer;
  v_appt_n  integer;
  v_slot    timestamptz;
  v_ok_slot timestamptz;
  v_lead_id uuid;
  v_appt_id uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'k7-atomic-owner-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (
    id, owner_user_id, name, timezone,
    tour_scheduling_enabled, tour_embed_key,
    tour_duration_minutes, tour_buffer_minutes,
    tour_min_notice_hours, tour_max_advance_days
  ) values (
    v_venue, v_owner, 'K7 Tour Atomicity Fixture', 'America/New_York',
    true, v_embed,
    60, 0,
    0, 4000
  );

  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;

  -- Slots must sit inside tour_max_advance_days. Anchor on a Sunday ~8 weeks out.
  -- date_trunc('week') is Monday in Postgres.
  v_ok_slot := (
    ((date_trunc('week', (timezone('America/New_York', now())::date + 56)::timestamp)
      + interval '6 days')::date::text || ' 10:00:00')::timestamp
    at time zone 'America/New_York'
  );

  -- ── Successful path: Lead + appointment both exist and are linked ──
  v_slot := v_ok_slot;
  v_result := public.book_tour(
    v_embed::text, v_slot,
    'Atomic'::text, 'Success'::text, ''::text, v_email, ''::text,
    'wedding'::text, ''::text, null::integer, 'ok path'::text
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'successful book_tour must return ok, got %', v_result;
  end if;
  v_lead_id := (v_result->>'leadId')::uuid;
  v_appt_id := (v_result->>'appointmentId')::uuid;
  if v_lead_id is null or v_appt_id is null then
    raise exception 'successful book_tour must return leadId and appointmentId';
  end if;
  if not exists (
    select 1 from public.tour_appointments
    where id = v_appt_id and lead_id = v_lead_id and venue_id = v_venue
  ) then
    raise exception 'appointment must reference the created Lead';
  end if;
  select count(*) into v_lead_n from public.leads where venue_id = v_venue and email = v_email;
  if v_lead_n <> 1 then
    raise exception 'successful path must create exactly one Lead, got %', v_lead_n;
  end if;

  -- ── Atomicity: appointment refusal after ingest must not leave a Lead ──
  -- Install a session-local force-fail trigger so the pre-check still passes
  -- (slot is open) but the INSERT raises the same refusal the availability
  -- trigger uses. Outer BEGIN/ROLLBACK from the harness drops this DDL.
  execute $ddl$
    create function pg_temp.force_tour_insert_fail()
    returns trigger
    language plpgsql
    as $t$
    begin
      if NEW.notes = '__force_fail_after_ingest__' then
        raise exception 'This tour time is no longer available.'
          using errcode = 'P0001', hint = 'tour_at_capacity';
      end if;
      return NEW;
    end;
    $t$
  $ddl$;
  execute $ddl$
    create trigger force_tour_insert_fail
      before insert on public.tour_appointments
      for each row
      execute function pg_temp.force_tour_insert_fail()
  $ddl$;

  v_ok_slot := v_ok_slot + interval '1 day'; -- Monday after the success Sunday
  v_result := public.book_tour(
    v_embed::text, v_ok_slot,
    'Atomic'::text, 'Orphan'::text, ''::text, 'k7-orphan-' || v_owner::text || '@example.test', ''::text,
    'wedding'::text, ''::text, null::integer, '__force_fail_after_ingest__'::text
  );
  if coalesce(v_result->>'ok', 'true') is distinct from 'false'
     or v_result->>'error' is distinct from 'slot_unavailable' then
    raise exception 'forced insert failure must return slot_unavailable, got %', v_result;
  end if;
  select count(*) into v_lead_n
  from public.leads
  where venue_id = v_venue
    and email = 'k7-orphan-' || v_owner::text || '@example.test';
  if v_lead_n <> 0 then
    raise exception 'failed book_tour must leave no orphan Lead, found %', v_lead_n;
  end if;
  select count(*) into v_appt_n
  from public.tour_appointments
  where venue_id = v_venue and notes = '__force_fail_after_ingest__';
  if v_appt_n <> 0 then
    raise exception 'failed book_tour must leave no appointment, found %', v_appt_n;
  end if;

  execute 'drop trigger if exists force_tour_insert_fail on public.tour_appointments';

  -- ── Recurring weekly closing block: write path rejects / allows correctly ──
  -- Every Sunday 09:00–17:00 America/New_York, starting the Sunday after the
  -- force-fail Monday (v_ok_slot is that Monday 10:00).
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, start_time, end_time,
    recurrence_rule, recurrence_interval
  ) values (
    v_venue, 'Every Sunday 9-5', 'blocked_time',
    (v_ok_slot + interval '6 days')::date,
    (v_ok_slot + interval '6 days')::date,
    false, '09:00', '17:00', 'weekly', 1
  );

  -- The following Sunday morning, inside the recurring occurrence — rejected.
  v_slot := v_ok_slot + interval '13 days'; -- next Sunday 10:00 venue-local
  v_result := public.book_tour(
    v_embed::text, v_slot,
    'Recur'::text, 'Blocked'::text, ''::text, 'k7-recur-block-' || v_owner::text || '@example.test', ''::text,
    'wedding'::text, ''::text, null::integer, 'inside recurring Sunday'::text
  );
  if coalesce(v_result->>'ok', 'true') is distinct from 'false'
     or v_result->>'error' is distinct from 'slot_unavailable' then
    raise exception 'Tour inside recurring weekly block must be rejected, got %', v_result;
  end if;
  select count(*) into v_lead_n
  from public.leads
  where venue_id = v_venue
    and email = 'k7-recur-block-' || v_owner::text || '@example.test';
  if v_lead_n <> 0 then
    raise exception 'rejected recurring-block Tour must leave no Lead, found %', v_lead_n;
  end if;

  -- Same Sunday evening after 17:00 — outside the block — allowed.
  v_slot := (v_ok_slot + interval '13 days') + interval '8 hours'; -- 18:00
  v_result := public.book_tour(
    v_embed::text, v_slot,
    'Recur'::text, 'Open'::text, ''::text, 'k7-recur-open-' || v_owner::text || '@example.test', ''::text,
    'wedding'::text, ''::text, null::integer, 'evening after Sunday block'::text
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'Tour outside recurring weekly block must succeed, got %', v_result;
  end if;

  -- Monday (non-occurrence) morning — allowed.
  v_slot := v_ok_slot + interval '14 days';
  v_result := public.book_tour(
    v_embed::text, v_slot,
    'Recur'::text, 'Monday'::text, ''::text, 'k7-recur-mon-' || v_owner::text || '@example.test', ''::text,
    'wedding'::text, ''::text, null::integer, 'Monday outside series'::text
  );
  if coalesce(v_result->>'ok', '') is distinct from 'true' then
    raise exception 'Monday Tour against Sunday-only series must succeed, got %', v_result;
  end if;

  -- Direct write path (trigger) also refuses a later Sunday occurrence.
  begin
    insert into public.tour_appointments (
      venue_id, scheduled_at, duration_minutes, status, contact_name
    ) values (
      v_venue,
      v_ok_slot + interval '20 days' + interval '1 hour',
      60, 'scheduled', 'Direct Sunday'
    );
    raise exception 'direct Tour insert on recurring Sunday must be rejected';
  exception
    when others then
      if sqlerrm not like '%no longer available%' then raise; end if;
  end;

  delete from public.venues where id = v_venue;
  delete from auth.users where id = v_owner;
end;
$$;
