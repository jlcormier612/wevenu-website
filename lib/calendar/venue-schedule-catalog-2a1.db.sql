-- Calendar Slice 2A.1 DB cases (run inside begin/rollback).

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_owner2 uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_block uuid;
  v_title text;
  v_count integer;
  v_cat uuid;
  v_other_cat uuid;
  v_false_block uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values
    (
      '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
      'cat-' || v_owner::text || '@example.test',
      crypt('not-a-login', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', v_owner2, 'authenticated', 'authenticated',
      'cat-' || v_owner2::text || '@example.test',
      crypt('not-a-login', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );

  insert into public.venues (id, owner_user_id, name)
  values (v_venue, v_owner, 'Catalog Venue'), (v_other, v_owner2, 'Other Venue');

  select count(*) into v_count
  from public.venue_schedule_item_types
  where venue_id = v_venue and source = 'builtin';
  if v_count <> 8 then
    raise exception 'expected 8 builtins, got %', v_count;
  end if;

  if exists (
    select 1 from public.venue_schedule_item_types
    where venue_id = v_venue and builtin_key in ('tour', 'wedding_event_booking', 'private_event')
  ) then
    raise exception 'tour/placeholders must not be catalog rows';
  end if;

  if not exists (
    select 1 from public.venue_schedule_item_types
    where venue_id = v_venue and builtin_key = 'tasting' and enabled = false and blocks_availability = true
  ) then
    raise exception 'tasting must seed disabled with blocks_availability true';
  end if;

  perform public.seed_venue_schedule_item_types(v_venue);
  select count(*) into v_count
  from public.venue_schedule_item_types
  where venue_id = v_venue and source = 'builtin';
  if v_count <> 8 then
    raise exception 're-seed duplicated builtins: %', v_count;
  end if;

  select id into v_cat
  from public.venue_schedule_item_types
  where venue_id = v_venue and builtin_key = 'blocked_time';

  insert into public.calendar_blocks (
    id, venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule, blocks_availability, schedule_item_type_id
  ) values (
    gen_random_uuid(), v_venue, 'Protect day', 'blocked_time', '2099-09-01', '2099-09-01', true, 'none', true, v_cat
  ) returning id into v_block;

  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule
  ) values (
    v_venue, 'Legacy shape', 'consultation', '2099-09-02', '2099-09-02', true, 'none'
  );

  if exists (
    select 1 from public.calendar_blocks
    where id = v_block and blocks_availability is distinct from true
  ) then
    raise exception 'protecting block must have blocks_availability true';
  end if;

  v_title := public.covering_calendar_block_title(
    v_venue, '2099-09-01', '2099-09-01', time '00:00', time '23:59', null
  );
  if v_title is distinct from 'Protect day' then
    raise exception 'blocking snapshot should cover Event: %', v_title;
  end if;

  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule, blocks_availability
  ) values (
    v_venue, 'Non occupying', 'consultation', '2099-09-03', '2099-09-03', true, 'none', false
  ) returning id into v_false_block;

  v_title := public.covering_calendar_block_title(
    v_venue, '2099-09-03', '2099-09-03', time '00:00', time '23:59', null
  );
  if v_title is not null then
    raise exception 'blocks_availability=false must not cover Event: %', v_title;
  end if;

  v_title := public.covering_calendar_block_title(
    v_venue, '2099-09-01', '2099-09-01', time '00:00', time '23:59',
    array['blocked_time', 'wedding_event_booking', 'private_event']::text[]
  );
  if v_title is distinct from 'Protect day' then
    raise exception 'tour closing types must still find blocked_time: %', v_title;
  end if;

  select id into v_other_cat
  from public.venue_schedule_item_types
  where venue_id = v_other and builtin_key = 'consultation';

  begin
    insert into public.calendar_blocks (
      venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule, schedule_item_type_id, blocks_availability
    ) values (
      v_venue, 'Cross venue', 'consultation', '2099-09-04', '2099-09-04', true, 'none', v_other_cat, true
    );
    raise exception 'cross-venue schedule_item_type_id should have failed';
  exception
    when foreign_key_violation then
      null;
  end;

  begin
    insert into public.calendar_blocks (
      venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule, blocks_availability
    ) values (
      v_venue, 'Bad', 'menu_tasting', '2099-09-05', '2099-09-05', true, 'none', true
    );
    raise exception 'free-form type should fail check';
  exception
    when check_violation then
      null;
  end;

  insert into public.venue_schedule_item_types (
    venue_id, source, custom_key, label, enabled, blocks_availability, group_key, sort_order
  ) values (
    v_venue, 'custom', 'menu_tasting', 'Menu Tasting', true, true, 'meetings', 100
  ) returning id into v_cat;

  insert into public.calendar_blocks (
    venue_id, title, type, start_date, end_date, is_all_day, recurrence_rule, schedule_item_type_id, blocks_availability
  ) values (
    v_venue, 'Smith tasting', 'custom', '2099-09-06', '2099-09-06', true, 'none', v_cat, true
  );

  begin
    update public.venue_schedule_item_types
    set enabled = false
    where venue_id = v_venue and builtin_key = 'blocked_time';
    raise exception 'blocked_time disable should fail';
  exception
    when check_violation then
      null;
  end;

  begin
    delete from public.venue_schedule_item_types
    where venue_id = v_venue and builtin_key = 'other';
    raise exception 'builtin delete should fail';
  exception
    when raise_exception then
      null;
  end;
end $$;
