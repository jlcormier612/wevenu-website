-- Recurring calendar_blocks coverage live tests. Wrapped by the Node test
-- in a transaction that always rolls back.

do $$
declare
  v_owner   uuid := gen_random_uuid();
  v_venue   uuid := gen_random_uuid();
  v_event   uuid;
  v_title   text;
  v_ok      boolean;
  v_blocked boolean;
  v_slot    timestamptz;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'k7-recur-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, timezone)
  values (v_venue, v_owner, 'K7 Recurring Blocks Fixture', 'America/New_York');

  insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
  select v_venue, d, '00:00'::time, '23:59'::time
  from generate_series(0, 6) as d;

  -- Every Sunday 9:00–17:00, starting 2099-06-14 (Sunday).
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, start_time, end_time,
    recurrence_rule, recurrence_interval
  ) values (
    v_venue, 'Every Sunday 9-5', 'blocked_time', '2099-06-14', '2099-06-14',
    false, '09:00', '17:00', 'weekly', 1
  );

  -- matching later Sunday occurrence blocks Event create
  begin
    insert into public.events (venue_id, name, event_date, start_time, end_time, status)
    values (v_venue, 'Sunday brunch', '2099-06-21', '10:00', '12:00', 'draft');
    raise exception 'matching weekly Sunday occurrence must block Event create';
  exception
    when others then
      if sqlerrm not like '%calendar is blocked%' then raise; end if;
  end;

  -- non-matching weekday is allowed
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Monday event', '2099-06-15', '10:00', '12:00', 'draft')
  returning id into v_event;

  -- recurrence start boundary: first Sunday is blocked; the Sunday before is not
  begin
    insert into public.events (venue_id, name, event_date, start_time, end_time, status)
    values (v_venue, 'First Sunday', '2099-06-14', '10:00', '12:00', 'draft');
    raise exception 'recurrence start Sunday must block';
  exception
    when others then
      if sqlerrm not like '%calendar is blocked%' then raise; end if;
  end;
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Week before', '2099-06-07', '10:00', '12:00', 'draft');

  -- touching 17:00 start is allowed; 16:00–18:00 on a later Sunday overlaps the block
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Evening Sunday', '2099-06-21', '17:00', '22:00', 'draft');
  begin
    insert into public.events (venue_id, name, event_date, start_time, end_time, status)
    values (v_venue, 'Overlap Sunday', '2099-06-28', '16:00', '18:00', 'draft');
    raise exception 'overlapping Sunday window must block';
  exception
    when others then
      if sqlerrm not like '%calendar is blocked%' then raise; end if;
  end;

  -- multi-day Event hitting a later Sunday (isolated from earlier occupancy)
  begin
    insert into public.events (venue_id, name, event_date, event_end_date, status)
    values (v_venue, 'Weekend takeover', '2099-07-10', '2099-07-13', 'draft');
    raise exception 'multi-day Event covering a Sunday occurrence must block';
  exception
    when others then
      if sqlerrm not like '%calendar is blocked%' then raise; end if;
  end;
  insert into public.events (venue_id, name, event_date, event_end_date, start_time, end_time, status)
  values (v_venue, 'Evening weekend', '2099-07-10', '2099-07-13', '18:00', '22:00', 'draft');

  -- edit/reschedule onto a covered Sunday is refused; row stays on Monday
  begin
    update public.events set event_date = '2099-06-28', start_time = '10:00', end_time = '12:00'
    where id = v_event;
    raise exception 'reschedule onto a recurring Sunday must be rejected';
  exception
    when others then
      if sqlerrm not like '%calendar is blocked%' then raise; end if;
  end;
  if (select event_date from public.events where id = v_event) is distinct from '2099-06-15' then
    raise exception 'failed reschedule must leave the Event on Monday';
  end if;

  -- cancelled Event on a covered Sunday is allowed; restore is refused
  insert into public.events (venue_id, name, event_date, start_time, end_time, status)
  values (v_venue, 'Cancelled Sunday', '2099-06-28', '10:00', '12:00', 'cancelled')
  returning id into v_event;
  begin
    update public.events set status = 'draft' where id = v_event;
    raise exception 'restore onto a recurring Sunday must be rejected';
  exception
    when others then
      if sqlerrm not like '%calendar is blocked%' then raise; end if;
  end;
  if (select status from public.events where id = v_event) is distinct from 'cancelled' then
    raise exception 'failed restore must leave the Event cancelled';
  end if;

  -- inquiry date-only: Sunday closed, Monday open (aside from occupancy)
  v_ok := public._is_event_date_available(v_venue, '2099-06-21');
  if v_ok then
    raise exception 'inquiry must close a Sunday covered by a timed recurring block';
  end if;
  v_ok := public._is_event_date_available(v_venue, '2099-06-29');
  if not v_ok then
    raise exception 'inquiry weekday after a Sunday-only series must stay available';
  end if;

  -- Tour closing type on Sunday morning is blocked; evening is not;
  -- consultation is not a Tour closing type.
  v_slot := ('2099-06-21 10:00:00'::timestamp at time zone 'America/New_York');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, v_slot, v_slot + interval '60 minutes'
  );
  if not v_blocked then
    raise exception 'Tour overlapping Sunday 9-5 must be blocked';
  end if;
  v_slot := ('2099-06-28 18:00:00'::timestamp at time zone 'America/New_York');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, v_slot, v_slot + interval '60 minutes'
  );
  if v_blocked then
    raise exception 'evening Tour after Sunday 9-5 must be allowed';
  end if;

  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, start_time, end_time,
    recurrence_rule, recurrence_interval
  ) values (
    v_venue, 'Weekly consultation', 'consultation', '2099-06-14', '2099-06-14',
    false, '09:00', '17:00', 'weekly', 1
  );
  -- 2099-07-06 is a Monday; the weekly consultation series must not close Tours.
  v_slot := ('2099-07-06 10:00:00'::timestamp at time zone 'America/New_York');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, v_slot, v_slot + interval '60 minutes'
  );
  if v_blocked then
    raise exception 'consultation calendar block must not close Tours';
  end if;

  -- venue-local timezone: all-day Sunday series vs a Tour whose UTC date is Monday
  delete from public.calendar_blocks where venue_id = v_venue;
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule, recurrence_interval
  ) values (
    v_venue, 'All-day Sunday', 'blocked_time', '2099-06-14', '2099-06-14',
    true, 'weekly', 1
  );
  v_slot := ('2099-06-14 20:30:00'::timestamp at time zone 'America/New_York');
  -- 20:30 NY Sunday = 00:30 UTC Monday
  if (v_slot at time zone 'UTC')::date is not distinct from '2099-06-14' then
    raise exception 'timezone fixture must cross the UTC date';
  end if;
  v_blocked := public._is_tour_slot_blocked(
    v_venue, v_slot, v_slot + interval '60 minutes'
  );
  if not v_blocked then
    raise exception 'all-day Sunday series must cover a Tour still on Sunday in venue-local time';
  end if;

  -- ends_on inclusive last start; the following Sunday is open
  delete from public.calendar_blocks where venue_id = v_venue;
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, start_time, end_time,
    recurrence_rule, recurrence_interval, recurrence_ends_on
  ) values (
    v_venue, 'Two Sundays', 'blocked_time', '2099-06-14', '2099-06-14',
    false, '09:00', '17:00', 'weekly', 1, '2099-06-21'
  );
  v_title := public.covering_calendar_block_title(
    v_venue, '2099-06-21', '2099-06-21', '10:00', '12:00', null
  );
  if v_title is distinct from 'Two Sundays' then
    raise exception 'ends_on Sunday must still cover';
  end if;
  v_title := public.covering_calendar_block_title(
    v_venue, '2099-06-28', '2099-06-28', '10:00', '12:00', null
  );
  if v_title is not null then
    raise exception 'Sunday after ends_on must not cover';
  end if;

  -- count=2
  delete from public.calendar_blocks where venue_id = v_venue;
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, start_time, end_time,
    recurrence_rule, recurrence_interval, recurrence_count
  ) values (
    v_venue, 'Count two', 'blocked_time', '2099-06-14', '2099-06-14',
    false, '09:00', '17:00', 'weekly', 1, 2
  );
  if public.covering_calendar_block_title(
    v_venue, '2099-06-21', '2099-06-21', '10:00', '12:00', null
  ) is null then
    raise exception 'second weekly occurrence (count=2) must cover';
  end if;
  if public.covering_calendar_block_title(
    v_venue, '2099-06-28', '2099-06-28', '10:00', '12:00', null
  ) is not null then
    raise exception 'third weekly occurrence (count=2) must not cover';
  end if;

  -- monthly clamp Jan 31 → Feb 28
  delete from public.calendar_blocks where venue_id = v_venue;
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day,
    recurrence_rule, recurrence_interval, recurrence_count
  ) values (
    v_venue, 'Month-end', 'blocked_time', '2099-01-31', '2099-01-31',
    true, 'monthly', 1, 3
  );
  if public.covering_calendar_block_title(
    v_venue, '2099-02-28', '2099-02-28', '00:00', '23:59', null
  ) is null then
    raise exception 'monthly Jan 31 must clamp to Feb 28';
  end if;
  if public.covering_calendar_block_title(
    v_venue, '2099-02-27', '2099-02-27', '00:00', '23:59', null
  ) is not null then
    raise exception 'monthly clamp must not cover Feb 27';
  end if;

  -- Direct Add / Book This Lead write path is the events trigger (already covered).
  -- covering_calendar_block_title is the same function inquiry and Event writes use.

  -- Event any-type policy: a recurring personal_appointment still blocks Events,
  -- but is not a Tour closing type.
  delete from public.calendar_blocks where venue_id = v_venue;
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day,
    recurrence_rule, recurrence_interval
  ) values (
    v_venue, 'Friday appointment', 'personal_appointment', '2099-06-18', '2099-06-18',
    true, 'weekly', 1
  );
  begin
    insert into public.events (venue_id, name, event_date, status)
    values (v_venue, 'Friday Event', '2099-07-02', 'draft');
    raise exception 'recurring personal_appointment must block Events';
  exception
    when others then
      if sqlerrm not like '%calendar is blocked%' then raise; end if;
  end;
  v_slot := ('2099-07-02 10:00:00'::timestamp at time zone 'America/New_York');
  v_blocked := public._is_tour_slot_blocked(
    v_venue, v_slot, v_slot + interval '60 minutes'
  );
  if v_blocked then
    raise exception 'personal_appointment must not close Tours';
  end if;

  delete from public.venues where id = v_venue;
  delete from auth.users where id = v_owner;
end;
$$;
