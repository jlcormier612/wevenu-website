-- Floor plan RLS Phase 1 — live permission matrix.
-- Runs as postgres for fixture setup, then SET LOCAL ROLE authenticated
-- so permissive venue policies + RESTRICTIVE role gates both apply
-- (same effective surface PostgREST uses for authenticated members).
-- Wrapped in begin/rollback by the Node harness.

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_coord uuid := gen_random_uuid();
  v_mgr   uuid := gen_random_uuid();
  v_venue uuid := gen_random_uuid();
  v_event uuid := gen_random_uuid();
  v_plan  uuid := gen_random_uuid();
  v_plan2 uuid := gen_random_uuid();
  v_obj   uuid := gen_random_uuid();
  v_tmpl  uuid := gen_random_uuid();
  v_tmpl2 uuid := gen_random_uuid();
  v_tobj  uuid := gen_random_uuid();
  v_offer uuid := gen_random_uuid();
  v_n integer;
  v_id uuid;
  v_err text;
begin
  -- ── Fixture users ──────────────────────────────────────────────────────────
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
     'fp-rls-owner-' || v_owner::text || '@example.test', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_staff, 'authenticated', 'authenticated',
     'fp-rls-staff-' || v_staff::text || '@example.test', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_coord, 'authenticated', 'authenticated',
     'fp-rls-coord-' || v_coord::text || '@example.test', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_mgr, 'authenticated', 'authenticated',
     'fp-rls-mgr-' || v_mgr::text || '@example.test', crypt('x', gen_salt('bf')),
     now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into public.venues (id, owner_user_id, name)
  values (v_venue, v_owner, 'Floor Plan RLS Fixture Venue');

  insert into public.venue_staff (
    venue_id, user_id, full_name, email, role, is_owner, accepted_at, is_active, invite_token
  ) values
    (v_venue, v_owner, 'Owner', 'fp-rls-owner-' || v_owner::text || '@example.test',
     'owner', true, now(), true, null),
    (v_venue, v_staff, 'Staff', 'fp-rls-staff-' || v_staff::text || '@example.test',
     'staff', false, now(), true, null),
    (v_venue, v_coord, 'Coordinator', 'fp-rls-coord-' || v_coord::text || '@example.test',
     'coordinator', false, now(), true, null),
    (v_venue, v_mgr, 'Manager', 'fp-rls-mgr-' || v_mgr::text || '@example.test',
     'manager', false, now(), true, null);

  insert into public.events (id, venue_id, name, event_date, status)
  values (v_event, v_venue, 'RLS Floor Plan Event', '2031-06-15', 'draft');

  insert into public.floor_plans (id, venue_id, event_id, name)
  values (v_plan, v_venue, v_event, 'Operational Plan');

  insert into public.floor_plan_objects (id, venue_id, floor_plan_id, object_type, label, x, y)
  values (v_obj, v_venue, v_plan, 'table_round', 'Table 1', 100, 100);

  insert into public.floor_plan_templates (id, venue_id, name)
  values (v_tmpl, v_venue, 'Ballroom Master');

  insert into public.floor_plan_template_objects (id, venue_id, template_id, object_type, label, x, y)
  values (v_tobj, v_venue, v_tmpl, 'table_round', 'T1', 120, 120);

  insert into public.event_floor_plan_offers (
    id, venue_id, event_id, floor_plan_template_id, sort_order, is_offered
  ) values (v_offer, v_venue, v_event, v_tmpl, 0, true);

  -- ── Helper: act as authenticated member ────────────────────────────────────
  -- (inlined via repeated set_config + set local role authenticated)

  -- ═══════════════════════════════════════════════════════════════════════════
  -- STAFF
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_staff::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_staff::text, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  if public.current_user_role() is distinct from 'staff' then
    raise exception 'staff jwt must resolve current_user_role=staff, got %', public.current_user_role();
  end if;
  if public.current_user_venue_id() is distinct from v_venue then
    raise exception 'staff jwt must resolve venue';
  end if;

  -- SELECT allowed
  select count(*) into v_n from public.floor_plans where venue_id = v_venue;
  if v_n < 1 then raise exception 'staff must SELECT floor_plans'; end if;
  select count(*) into v_n from public.floor_plan_objects where venue_id = v_venue;
  if v_n < 1 then raise exception 'staff must SELECT floor_plan_objects'; end if;
  select count(*) into v_n from public.floor_plan_templates where venue_id = v_venue;
  if v_n < 1 then raise exception 'staff must SELECT floor_plan_templates'; end if;
  select count(*) into v_n from public.floor_plan_template_objects where venue_id = v_venue;
  if v_n < 1 then raise exception 'staff must SELECT floor_plan_template_objects'; end if;
  select count(*) into v_n from public.event_floor_plan_offers where venue_id = v_venue;
  if v_n < 1 then raise exception 'staff must SELECT event_floor_plan_offers'; end if;

  -- INSERT floor_plans denied
  begin
    insert into public.floor_plans (venue_id, event_id, name)
    values (v_venue, v_event, 'Staff should not create');
    raise exception 'staff INSERT floor_plans must be denied';
  exception when insufficient_privilege or check_violation or others then
    if sqlerrm like 'staff INSERT floor_plans must be denied' then raise; end if;
    -- RLS / privilege denial expected
  end;

  -- UPDATE floor_plans denied (0 rows or error)
  begin
    update public.floor_plans set name = 'Staff rename' where id = v_plan;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'staff UPDATE floor_plans must affect 0 rows, got %', v_n; end if;
  exception when insufficient_privilege or others then
    if sqlerrm like 'staff UPDATE floor_plans%' then raise; end if;
  end;

  -- INSERT objects denied
  begin
    insert into public.floor_plan_objects (venue_id, floor_plan_id, object_type, label)
    values (v_venue, v_plan, 'table_round', 'Staff table');
    raise exception 'staff INSERT floor_plan_objects must be denied';
  exception when insufficient_privilege or check_violation or others then
    if sqlerrm like 'staff INSERT floor_plan_objects must be denied' then raise; end if;
  end;

  -- UPDATE objects denied
  begin
    update public.floor_plan_objects set label = 'Staff edit' where id = v_obj;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'staff UPDATE floor_plan_objects must affect 0 rows, got %', v_n; end if;
  exception when insufficient_privilege or others then
    if sqlerrm like 'staff UPDATE floor_plan_objects%' then raise; end if;
  end;

  -- INSERT templates denied
  begin
    insert into public.floor_plan_templates (venue_id, name) values (v_venue, 'Staff template');
    raise exception 'staff INSERT floor_plan_templates must be denied';
  exception when insufficient_privilege or check_violation or others then
    if sqlerrm like 'staff INSERT floor_plan_templates must be denied' then raise; end if;
  end;

  -- UPDATE templates denied
  begin
    update public.floor_plan_templates set name = 'Staff tmpl' where id = v_tmpl;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'staff UPDATE floor_plan_templates must affect 0 rows, got %', v_n; end if;
  exception when insufficient_privilege or others then
    if sqlerrm like 'staff UPDATE floor_plan_templates%' then raise; end if;
  end;

  -- INSERT template objects denied
  begin
    insert into public.floor_plan_template_objects (venue_id, template_id, object_type, label)
    values (v_venue, v_tmpl, 'table_round', 'Staff tobj');
    raise exception 'staff INSERT floor_plan_template_objects must be denied';
  exception when insufficient_privilege or check_violation or others then
    if sqlerrm like 'staff INSERT floor_plan_template_objects must be denied' then raise; end if;
  end;

  -- UPDATE template objects denied
  begin
    update public.floor_plan_template_objects set label = 'Staff tobj edit' where id = v_tobj;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'staff UPDATE template objects must affect 0 rows, got %', v_n; end if;
  exception when insufficient_privilege or others then
    if sqlerrm like 'staff UPDATE template objects%' then raise; end if;
  end;

  -- Offer mutate denied
  begin
    update public.event_floor_plan_offers set couple_label = 'Nope' where id = v_offer;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'staff UPDATE offers must affect 0 rows, got %', v_n; end if;
  exception when insufficient_privilege or others then
    if sqlerrm like 'staff UPDATE offers%' then raise; end if;
  end;

  begin
    delete from public.event_floor_plan_offers where id = v_offer;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'staff DELETE offers must affect 0 rows, got %', v_n; end if;
  exception when insufficient_privilege or others then
    if sqlerrm like 'staff DELETE offers%' then raise; end if;
  end;

  begin
    insert into public.event_floor_plan_offers (venue_id, event_id, floor_plan_template_id, sort_order)
    values (v_venue, v_event, v_tmpl, 9);
    raise exception 'staff INSERT offers must be denied';
  exception when insufficient_privilege or check_violation or others then
    if sqlerrm like 'staff INSERT offers must be denied' then raise; end if;
  end;

  reset role;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- COORDINATOR
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_coord::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_coord::text, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  if public.current_user_role() is distinct from 'coordinator' then
    raise exception 'coordinator jwt must resolve role=coordinator, got %', public.current_user_role();
  end if;

  -- Create plan
  insert into public.floor_plans (id, venue_id, event_id, name)
  values (v_plan2, v_venue, v_event, 'Coordinator Plan')
  returning id into v_id;
  if v_id is distinct from v_plan2 then raise exception 'coordinator create plan failed'; end if;

  -- Edit plan
  update public.floor_plans set name = 'Coordinator Plan Edited' where id = v_plan2;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'coordinator UPDATE plan must succeed'; end if;

  -- Create/edit objects
  insert into public.floor_plan_objects (venue_id, floor_plan_id, object_type, label, x, y)
  values (v_venue, v_plan2, 'table_rect', 'Coord Table', 200, 200)
  returning id into v_id;

  update public.floor_plan_objects set label = 'Coord Table Edited' where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'coordinator UPDATE object must succeed'; end if;

  -- DELETE object within plan allowed
  delete from public.floor_plan_objects where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'coordinator DELETE object must succeed'; end if;

  -- Also delete the seed object on the original plan
  delete from public.floor_plan_objects where id = v_obj;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'coordinator DELETE existing object must succeed'; end if;

  -- Create/edit template + template object
  insert into public.floor_plan_templates (id, venue_id, name)
  values (v_tmpl2, v_venue, 'Coordinator Template');
  update public.floor_plan_templates set name = 'Coordinator Template Edited' where id = v_tmpl2;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'coordinator UPDATE template must succeed'; end if;

  insert into public.floor_plan_template_objects (venue_id, template_id, object_type, label)
  values (v_venue, v_tmpl2, 'bar', 'Coord Bar')
  returning id into v_id;
  delete from public.floor_plan_template_objects where id = v_id;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'coordinator DELETE template object must succeed'; end if;

  -- Offer edit allowed
  update public.event_floor_plan_offers set couple_label = 'Layout A' where id = v_offer;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'coordinator UPDATE offer must succeed'; end if;

  -- Cannot DELETE floor-plan row
  delete from public.floor_plans where id = v_plan2;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'coordinator DELETE floor_plans row must be denied (0 rows), got %', v_n; end if;

  -- Cannot DELETE template row
  delete from public.floor_plan_templates where id = v_tmpl2;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'coordinator DELETE template row must be denied (0 rows), got %', v_n; end if;

  reset role;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- MANAGER — can delete plan/template rows
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_mgr::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_mgr::text, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  if public.current_user_role() is distinct from 'manager' then
    raise exception 'manager jwt must resolve role=manager, got %', public.current_user_role();
  end if;

  delete from public.floor_plans where id = v_plan2;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'manager DELETE floor_plans row must succeed'; end if;

  delete from public.floor_plan_templates where id = v_tmpl2;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'manager DELETE template row must succeed'; end if;

  reset role;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- OWNER — can delete remaining plan/template (seed rows)
  -- ═══════════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_owner::text, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;

  if public.current_user_role() is distinct from 'owner' then
    raise exception 'owner jwt must resolve role=owner, got %', public.current_user_role();
  end if;

  -- recreate a disposable plan to delete as owner
  insert into public.floor_plans (id, venue_id, event_id, name)
  values (v_plan2, v_venue, v_event, 'Owner delete me');
  delete from public.floor_plans where id = v_plan2;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'owner DELETE floor_plans row must succeed'; end if;

  insert into public.floor_plan_templates (id, venue_id, name)
  values (v_tmpl2, v_venue, 'Owner delete tmpl');
  delete from public.floor_plan_templates where id = v_tmpl2;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'owner DELETE template row must succeed'; end if;

  reset role;

  raise notice 'FLOOR_PLAN_RLS_OK staff_select_deny_write coordinator_edit_object_delete_no_row_delete manager_owner_row_delete';
end;
$$;
