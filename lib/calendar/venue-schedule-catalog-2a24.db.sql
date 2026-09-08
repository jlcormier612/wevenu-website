-- Calendar 2A.2.4 — custom FK invariant cases (begin/rollback).

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_owner_b uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_venue_b uuid := gen_random_uuid();
  v_custom uuid;
  v_custom_b uuid;
  v_block uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values
    (
      '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
      'cat24-' || v_owner::text || '@example.test',
      crypt('not-a-login', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_owner_b, 'authenticated', 'authenticated',
      'cat24b-' || v_owner_b::text || '@example.test',
      crypt('not-a-login', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );

  insert into public.venues (id, owner_user_id, name) values
    (v_venue, v_owner, 'Custom FK Venue A'),
    (v_venue_b, v_owner_b, 'Custom FK Venue B');

  insert into public.venue_schedule_item_types (
    venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
  ) values (
    v_venue, 'custom', 'planning_a', 'Planning A', true, true, 'meetings', 200
  ) returning id into v_custom;

  insert into public.venue_schedule_item_types (
    venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
  ) values (
    v_venue_b, 'custom', 'planning_b', 'Planning B', true, true, 'meetings', 200
  ) returning id into v_custom_b;

  -- Valid custom + same-venue catalog FK
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule,
    schedule_item_type_id, blocks_availability
  ) values (
    v_venue, 'Valid custom', 'custom', '2099-11-01', '2099-11-01', true, 'none',
    v_custom, true
  ) returning id into v_block;

  -- custom + NULL FK must fail
  begin
    insert into public.calendar_blocks (
      venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule,
      schedule_item_type_id, blocks_availability
    ) values (
      v_venue, 'Null FK custom', 'custom', '2099-11-02', '2099-11-02', true, 'none',
      null, true
    );
    raise exception 'custom with null schedule_item_type_id should fail';
  exception
    when check_violation then
      null;
  end;

  -- custom + wrong-venue catalog FK must fail (same-venue FK)
  begin
    insert into public.calendar_blocks (
      venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule,
      schedule_item_type_id, blocks_availability
    ) values (
      v_venue, 'Cross venue custom', 'custom', '2099-11-03', '2099-11-03', true, 'none',
      v_custom_b, true
    );
    raise exception 'custom with cross-venue schedule_item_type_id should fail';
  exception
    when foreign_key_violation then
      null;
  end;

  -- Non-custom / system rows retain nullable FK
  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule,
    schedule_item_type_id, blocks_availability
  ) values
    (v_venue, 'Placeholder', 'wedding_event_booking', '2099-11-04', '2099-11-04', true, 'none', null, true),
    (v_venue, 'Private', 'private_event', '2099-11-05', '2099-11-05', true, 'none', null, true),
    (v_venue, 'Legacy tour', 'tour', '2099-11-06', '2099-11-06', true, 'none', null, true),
    (v_venue, 'Blocked', 'blocked_time', '2099-11-07', '2099-11-07', true, 'none', null, true);
end $$;
