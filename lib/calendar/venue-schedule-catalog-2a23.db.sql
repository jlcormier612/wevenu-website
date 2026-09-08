-- Calendar Slice 2A.2.3 DB cases (run inside begin/rollback after catalog migrations).

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_count integer;
  v_custom uuid;
  v_i integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'cat23-' || v_owner::text || '@example.test',
    crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name)
  values (v_venue, v_owner, 'Custom Catalog Venue');

  -- Case-insensitive label uniqueness vs builtin
  begin
    insert into public.venue_schedule_item_types (
      venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
    ) values (
      v_venue, 'custom', 'consultation_clone', 'consultation', true, true, 'meetings', 200
    );
    raise exception 'custom colliding with builtin label should fail';
  exception
    when unique_violation then
      null;
  end;

  insert into public.venue_schedule_item_types (
    venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
  ) values (
    v_venue, 'custom', 'wedding_planning_meeting', 'Wedding Planning Meeting', true, true, 'meetings', 200
  ) returning id into v_custom;

  begin
    insert into public.venue_schedule_item_types (
      venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
    ) values (
      v_venue, 'custom', 'wedding_planning_meeting_2', 'wedding planning meeting', true, true, 'meetings', 210
    );
    raise exception 'case-insensitive duplicate custom label should fail';
  exception
    when unique_violation then
      null;
  end;

  -- Rename catalog label must not require rewriting calendar_blocks
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule,
    schedule_item_type_id, blocks_availability
  ) values (
    v_venue, 'Smith planning', 'custom', '2099-10-01', '2099-10-01', true, 'none',
    v_custom, true
  );

  update public.venue_schedule_item_types
  set label = 'Planning Session'
  where id = v_custom;

  if not exists (
    select 1 from public.calendar_blocks
    where venue_id = v_venue and title = 'Smith planning' and schedule_item_type_id = v_custom
  ) then
    raise exception 'catalog rename must leave calendar_blocks title untouched';
  end if;

  -- Archive frees the active name for reuse and does not count toward cap
  update public.venue_schedule_item_types
  set archived_at = now(), enabled = false
  where id = v_custom;

  insert into public.venue_schedule_item_types (
    venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
  ) values (
    v_venue, 'custom', 'planning_session_new', 'Planning Session', true, false, 'availability', 220
  );

  -- Cap of 20 active customs
  for v_i in 1..19 loop
    insert into public.venue_schedule_item_types (
      venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
    ) values (
      v_venue, 'custom', 'cap_' || v_i::text, 'Cap Type ' || v_i::text, true, true, 'meetings', 300 + v_i
    );
  end loop;

  select count(*) into v_count
  from public.venue_schedule_item_types
  where venue_id = v_venue and source = 'custom' and archived_at is null;
  if v_count <> 20 then
    raise exception 'expected 20 active customs, got %', v_count;
  end if;

  begin
    insert into public.venue_schedule_item_types (
      venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
    ) values (
      v_venue, 'custom', 'cap_overflow', 'Cap Overflow', true, true, 'meetings', 999
    );
    raise exception '21st active custom should fail';
  exception
    when raise_exception then
      if SQLERRM not like '%20 active custom%' then
        raise;
      end if;
  end;
end $$;
