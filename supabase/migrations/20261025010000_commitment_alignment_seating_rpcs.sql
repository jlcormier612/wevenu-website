-- ============================================================================
-- Commitment Alignment Sprint — Seating Delegation & Submission (RPCs)
--
-- docs/commitment-lifecycle-architecture.md §7/§9. Per direct instruction:
--
--   - The couple always works in their private planning workspace (the
--     live guest_seat_assignments rows for a plan) until they Submit.
--   - Submitting creates an immutable, self-contained snapshot in
--     seating_submissions — the venue's committed operational plan for
--     that floor plan. Never mutated; a resubmission is a new row.
--   - The venue's default read (get_operational_seating_plan) is the
--     latest submission — never the live draft — unless the couple has
--     explicitly delegated that specific floor plan, in which case the
--     venue reads and writes the SAME live rows the couple would, exactly
--     as the couple's own canvas already does (one renderer, one data
--     model, different auth context — not two seating experiences).
--   - Delegation is per floor_plan_id (Ceremony and Reception are
--     independent Commitment Lifecycles), explicit, revocable by either
--     party, and at most one active grant per plan at a time.
--   - Task completion is a side effect of a real Submit, never a separate
--     manual toggle (same pattern as guest_count_finalized).
-- ============================================================================

-- ── _build_seating_json — shared JSON shape, used by both the live read
--    (couple, or venue-while-delegated) and stored verbatim as a
--    submission's snapshot, so "the venue's committed plan" and "a live
--    plan" are always render-compatible with the same UI. ──────────────────
create or replace function public._build_seating_json(p_client_id uuid, p_venue_id uuid, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_floor_plan record;
begin
  select fp.id, fp.name, fp.room_width_ft, fp.room_depth_ft,
         fp.background_image_url, fp.background_image_opacity
  into v_floor_plan
  from public.floor_plans fp
  where fp.id = p_floor_plan_id and fp.event_id in (
    select id from public.events where client_id = p_client_id and venue_id = p_venue_id
  );

  if v_floor_plan.id is null then
    return jsonb_build_object('error', 'floor_plan_not_found');
  end if;

  return jsonb_build_object(
    'floorPlan', jsonb_build_object(
      'id', v_floor_plan.id, 'name', v_floor_plan.name,
      'roomWidthFt', v_floor_plan.room_width_ft, 'roomDepthFt', v_floor_plan.room_depth_ft,
      'backgroundImageUrl', v_floor_plan.background_image_url,
      'backgroundImageOpacity', v_floor_plan.background_image_opacity
    ),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label', o.label, 'capacity', o.capacity,
        'x', o.x, 'y', o.y, 'width', o.width, 'height', o.height, 'rotation', o.rotation,
        'displayShape', o.display_shape,
        'guests', coalesce((
          select jsonb_agg(jsonb_build_object(
            'guestId',           g.id,
            'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
            'mealChoice',        g.meal_choice,
            'dietaryTags',       to_jsonb(g.dietary_tags),
            'accessibilityTags', to_jsonb(g.accessibility_tags),
            'isChild',           g.is_child,
            'isVendorMeal',      g.is_vendor_meal,
            'isWeddingParty',    g.is_wedding_party,
            'householdId',       g.household_id,
            'householdName',     h.name,
            'plusOneOfGuestId',  g.plus_one_of_guest_id
          ) order by g.first_name)
          from public.guest_seat_assignments gsa
          join public.couple_guests g on g.id = gsa.guest_id
          left join public.couple_households h on h.id = g.household_id
          where gsa.table_object_id = o.id and gsa.floor_plan_id = p_floor_plan_id
            and g.rsvp_status != 'declined'
        ), '[]'::jsonb)
      ) order by o.sort_order, o.label)
      from public.floor_plan_objects o
      where o.floor_plan_id = v_floor_plan.id
        and o.object_type in ('table_round', 'table_rect', 'table_oval')
    ), '[]'::jsonb),
    'unassignedGuests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guestId',           g.id,
        'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
        'mealChoice',        g.meal_choice,
        'dietaryTags',       to_jsonb(g.dietary_tags),
        'accessibilityTags', to_jsonb(g.accessibility_tags),
        'isChild',           g.is_child,
        'isVendorMeal',      g.is_vendor_meal,
        'isWeddingParty',    g.is_wedding_party,
        'householdId',       g.household_id,
        'householdName',     h.name,
        'plusOneOfGuestId',  g.plus_one_of_guest_id
      ) order by g.first_name)
      from public.couple_guests g
      left join public.couple_households h on h.id = g.household_id
      left join public.guest_seat_assignments gsa
        on gsa.guest_id = g.id and gsa.floor_plan_id = p_floor_plan_id
      where g.client_id = p_client_id and g.venue_id = p_venue_id
        and g.rsvp_status = 'attending'
        and gsa.id is null
    ), '[]'::jsonb),
    'needsReassignment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guestId',           g.id,
        'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
        'mealChoice',        g.meal_choice,
        'dietaryTags',       to_jsonb(g.dietary_tags),
        'accessibilityTags', to_jsonb(g.accessibility_tags),
        'isChild',           g.is_child,
        'isVendorMeal',      g.is_vendor_meal,
        'isWeddingParty',    g.is_wedding_party,
        'householdId',       g.household_id,
        'householdName',     h.name,
        'plusOneOfGuestId',  g.plus_one_of_guest_id
      ) order by g.first_name)
      from public.guest_seat_assignments gsa
      join public.couple_guests g on g.id = gsa.guest_id
      left join public.couple_households h on h.id = g.household_id
      where gsa.table_object_id is null and gsa.floor_plan_id = p_floor_plan_id
        and g.rsvp_status != 'declined'
        and g.client_id = p_client_id and g.venue_id = p_venue_id
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'totalAttending', (
        select count(*) from public.couple_guests
        where client_id = p_client_id and venue_id = p_venue_id
          and rsvp_status = 'attending' and not is_vendor_meal
      ),
      'totalAssigned', (
        select count(*) from public.guest_seat_assignments gsa
        join public.couple_guests g on g.id = gsa.guest_id
        where gsa.table_object_id is not null and gsa.floor_plan_id = p_floor_plan_id
          and g.client_id = p_client_id and g.venue_id = p_venue_id
          and g.rsvp_status = 'attending' and not g.is_vendor_meal
      ),
      'tableCount', (
        select count(*) from public.floor_plan_objects
        where floor_plan_id = v_floor_plan.id and object_type in ('table_round', 'table_rect', 'table_oval')
      ),
      'totalCapacity', (
        select coalesce(sum(capacity), 0) from public.floor_plan_objects
        where floor_plan_id = v_floor_plan.id and object_type in ('table_round', 'table_rect', 'table_oval')
      )
    )
  );
end;
$$;

-- ── get_seating_floor_plans — the couple's plan picker ───────────────────────
create or replace function public.get_seating_floor_plans(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', fp.id, 'name', fp.name,
      'isDelegated', exists (
        select 1 from public.seating_delegations d
        where d.floor_plan_id = fp.id and d.revoked_at is null
      ),
      'lastSubmission', (
        select jsonb_build_object('count', s.guest_count, 'submittedAt', s.created_at, 'submittedBy', s.submitted_by)
        from public.seating_submissions s
        where s.floor_plan_id = fp.id
        order by s.created_at desc limit 1
      )
    ) order by fp.created_at)
    from public.floor_plans fp
    where fp.event_id = v_ids.event_id and fp.client_access != 'hidden'
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.get_seating_floor_plans(text) to anon, authenticated;

-- ── get_seating_data — extended with an optional p_floor_plan_id ────────────
-- Backward compatible: null preserves the exact prior auto-resolve
-- behavior (most-recently-updated non-hidden plan). Always the couple's
-- own live draft, whether or not it's currently delegated — visible to
-- both parties per the Delegation principle; the delegated flag lets the
-- UI show the "your venue is managing this" banner and read-only state.
create or replace function public.get_seating_data(p_token text, p_floor_plan_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids        record;
  v_floor_plan_id uuid;
  v_result     jsonb;
  v_delegation record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('error', 'invalid_token'); end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false, 'isDelegated', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0));
  end if;

  if p_floor_plan_id is not null then
    select fp.id into v_floor_plan_id from public.floor_plans fp
    where fp.id = p_floor_plan_id and fp.event_id = v_ids.event_id and fp.client_access != 'hidden';
  else
    select fp.id into v_floor_plan_id from public.floor_plans fp
    where fp.event_id = v_ids.event_id and fp.client_access != 'hidden'
    order by fp.updated_at desc limit 1;
  end if;

  if v_floor_plan_id is null then
    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false, 'isDelegated', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0)
    );
  end if;

  v_result := public._build_seating_json(v_ids.client_id, v_ids.venue_id, v_floor_plan_id);

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = v_floor_plan_id and revoked_at is null;

  return v_result || jsonb_build_object(
    'hadPriorWork', true,
    'isDelegated', v_delegation.id is not null,
    'delegatedNote', v_delegation.note
  );
end;
$$;

grant execute on function public.get_seating_data(text, uuid) to anon, authenticated;

-- ── assign_guest_to_table / remove_guest_assignment — extended, reject
--    while the plan is delegated (the couple isn't the current editor) ────
create or replace function public.assign_guest_to_table(p_token text, p_guest_id uuid, p_table_id uuid, p_floor_plan_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_floor_plan_id uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  if v_ids.access_level in ('financial', 'view_only') then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  select fp.id into v_floor_plan_id
  from public.floor_plan_objects o
  join public.floor_plans fp on fp.id = o.floor_plan_id
  where o.id = p_table_id
    and fp.event_id = v_ids.event_id
    and fp.client_access != 'hidden'
    and (p_floor_plan_id is null or fp.id = p_floor_plan_id)
    and o.object_type in ('table_round', 'table_rect', 'table_oval');

  if v_floor_plan_id is null then return false; end if;

  if exists (select 1 from public.seating_delegations where floor_plan_id = v_floor_plan_id and revoked_at is null) then
    return false;
  end if;

  insert into public.guest_seat_assignments (guest_id, floor_plan_id, table_object_id)
  values (p_guest_id, v_floor_plan_id, p_table_id)
  on conflict (guest_id, floor_plan_id) do update
    set table_object_id = excluded.table_object_id, assigned_at = now();

  return true;
end;
$$;

create or replace function public.remove_guest_assignment(p_token text, p_guest_id uuid, p_floor_plan_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  if v_ids.access_level in ('financial', 'view_only') then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  if p_floor_plan_id is not null and exists (
    select 1 from public.seating_delegations where floor_plan_id = p_floor_plan_id and revoked_at is null
  ) then
    return false;
  end if;

  if p_floor_plan_id is not null then
    delete from public.guest_seat_assignments where guest_id = p_guest_id and floor_plan_id = p_floor_plan_id;
  else
    delete from public.guest_seat_assignments where guest_id = p_guest_id;
  end if;
  return true;
end;
$$;

-- ── submit_seating_plan — the couple's Commitment Lifecycle Submit event ────
create or replace function public.submit_seating_plan(p_token text, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_snapshot jsonb;
  v_submission_id uuid;
  v_completed_task_id uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_ids.access_level in ('financial', 'view_only') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if not exists (
    select 1 from public.floor_plans where id = p_floor_plan_id and event_id = v_ids.event_id and client_access != 'hidden'
  ) then
    return jsonb_build_object('ok', false, 'error', 'floor_plan_not_found');
  end if;

  if exists (select 1 from public.seating_delegations where floor_plan_id = p_floor_plan_id and revoked_at is null) then
    return jsonb_build_object('ok', false, 'error', 'delegated_to_venue');
  end if;

  v_snapshot := public._build_seating_json(v_ids.client_id, v_ids.venue_id, p_floor_plan_id);

  insert into public.seating_submissions (client_id, venue_id, event_id, floor_plan_id, snapshot, guest_count, submitted_by)
  values (v_ids.client_id, v_ids.venue_id, v_ids.event_id, p_floor_plan_id, v_snapshot,
          coalesce((v_snapshot -> 'stats' ->> 'totalAssigned')::integer, 0), 'couple')
  returning id into v_submission_id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_ids.venue_id and event_id = v_ids.event_id
      and auto_complete_trigger = 'seating_submitted'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_ids.venue_id;
  end loop;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id);
end;
$$;

grant execute on function public.submit_seating_plan(text, uuid) to anon, authenticated;

-- ── grant_seating_delegation / revoke_seating_delegation — couple side ──────
create or replace function public.grant_seating_delegation(p_token text, p_floor_plan_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_existing uuid;
  v_new_id uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_ids.access_level in ('financial', 'view_only') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if not exists (
    select 1 from public.floor_plans where id = p_floor_plan_id and event_id = v_ids.event_id and client_access != 'hidden'
  ) then
    return jsonb_build_object('ok', false, 'error', 'floor_plan_not_found');
  end if;

  select id into v_existing from public.seating_delegations
  where floor_plan_id = p_floor_plan_id and revoked_at is null;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'delegationId', v_existing, 'alreadyActive', true);
  end if;

  insert into public.seating_delegations (client_id, venue_id, event_id, floor_plan_id, note)
  values (v_ids.client_id, v_ids.venue_id, v_ids.event_id, p_floor_plan_id, nullif(trim(p_note), ''))
  returning id into v_new_id;

  return jsonb_build_object('ok', true, 'delegationId', v_new_id, 'alreadyActive', false);
end;
$$;

grant execute on function public.grant_seating_delegation(text, uuid, text) to anon, authenticated;

create or replace function public.revoke_seating_delegation(p_token text, p_delegation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  update public.seating_delegations
  set revoked_at = now(), revoked_by = 'couple'
  where id = p_delegation_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id and revoked_at is null;

  return jsonb_build_object('ok', found);
end;
$$;

grant execute on function public.revoke_seating_delegation(text, uuid) to anon, authenticated;

-- ── Venue-side: operational read, delegated write, delegated submit,
--    and revoke — all authenticated via current_user_venue_id(), never a
--    borrowed portal token. ───────────────────────────────────────────────
create or replace function public.get_operational_seating_plan(p_event_id uuid, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid := current_user_venue_id();
  v_client_id uuid;
  v_delegation record;
  v_latest record;
begin
  if v_venue_id is null then return jsonb_build_object('error', 'not_authorized'); end if;

  select client_id into v_client_id from public.events where id = p_event_id and venue_id = v_venue_id;
  if v_client_id is null then return jsonb_build_object('error', 'event_not_found'); end if;

  if not exists (select 1 from public.floor_plans where id = p_floor_plan_id and event_id = p_event_id) then
    return jsonb_build_object('error', 'floor_plan_not_found');
  end if;

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = p_floor_plan_id and revoked_at is null;

  if v_delegation.id is not null then
    return public._build_seating_json(v_client_id, v_venue_id, p_floor_plan_id)
      || jsonb_build_object('isDelegated', true, 'delegatedAt', v_delegation.granted_at, 'delegatedNote', v_delegation.note);
  end if;

  select * into v_latest from public.seating_submissions
  where floor_plan_id = p_floor_plan_id
  order by created_at desc limit 1;

  if v_latest.id is null then
    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb, 'needsReassignment', '[]'::jsonb,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0),
      'isDelegated', false, 'notYetSubmitted', true
    );
  end if;

  return v_latest.snapshot || jsonb_build_object(
    'isDelegated', false, 'notYetSubmitted', false,
    'submittedAt', v_latest.created_at, 'submittedBy', v_latest.submitted_by
  );
end;
$$;

grant execute on function public.get_operational_seating_plan(uuid, uuid) to authenticated;

create or replace function public.assign_guest_to_table_as_venue(p_floor_plan_id uuid, p_guest_id uuid, p_table_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_venue_id uuid := current_user_venue_id();
begin
  if v_venue_id is null then return false; end if;
  if not exists (
    select 1 from public.seating_delegations where floor_plan_id = p_floor_plan_id and venue_id = v_venue_id and revoked_at is null
  ) then
    return false;
  end if;

  if not exists (
    select 1 from public.couple_guests g join public.floor_plans fp on fp.event_id = g.event_id
    where g.id = p_guest_id and fp.id = p_floor_plan_id and fp.venue_id = v_venue_id
  ) then
    return false;
  end if;

  if not exists (
    select 1 from public.floor_plan_objects o
    where o.id = p_table_id and o.floor_plan_id = p_floor_plan_id
      and o.object_type in ('table_round', 'table_rect', 'table_oval')
  ) then
    return false;
  end if;

  insert into public.guest_seat_assignments (guest_id, floor_plan_id, table_object_id)
  values (p_guest_id, p_floor_plan_id, p_table_id)
  on conflict (guest_id, floor_plan_id) do update
    set table_object_id = excluded.table_object_id, assigned_at = now();

  return true;
end;
$$;

grant execute on function public.assign_guest_to_table_as_venue(uuid, uuid, uuid) to authenticated;

create or replace function public.remove_guest_assignment_as_venue(p_floor_plan_id uuid, p_guest_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_venue_id uuid := current_user_venue_id();
begin
  if v_venue_id is null then return false; end if;
  if not exists (
    select 1 from public.seating_delegations where floor_plan_id = p_floor_plan_id and venue_id = v_venue_id and revoked_at is null
  ) then
    return false;
  end if;

  delete from public.guest_seat_assignments where guest_id = p_guest_id and floor_plan_id = p_floor_plan_id;
  return true;
end;
$$;

grant execute on function public.remove_guest_assignment_as_venue(uuid, uuid) to authenticated;

create or replace function public.submit_seating_plan_as_venue(p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid := current_user_venue_id();
  v_delegation record;
  v_client_id uuid;
  v_event_id uuid;
  v_snapshot jsonb;
  v_submission_id uuid;
  v_completed_task_id uuid;
begin
  if v_venue_id is null then return jsonb_build_object('ok', false, 'error', 'not_authorized'); end if;

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = p_floor_plan_id and venue_id = v_venue_id and revoked_at is null;
  if v_delegation.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_delegated');
  end if;

  v_client_id := v_delegation.client_id;
  v_event_id := v_delegation.event_id;

  v_snapshot := public._build_seating_json(v_client_id, v_venue_id, p_floor_plan_id);

  insert into public.seating_submissions (client_id, venue_id, event_id, floor_plan_id, snapshot, guest_count, submitted_by)
  values (v_client_id, v_venue_id, v_event_id, p_floor_plan_id, v_snapshot,
          coalesce((v_snapshot -> 'stats' ->> 'totalAssigned')::integer, 0), 'venue')
  returning id into v_submission_id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_venue_id and event_id = v_event_id
      and auto_complete_trigger = 'seating_submitted'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_venue_id;
  end loop;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id);
end;
$$;

grant execute on function public.submit_seating_plan_as_venue(uuid) to authenticated;

create or replace function public.revoke_seating_delegation_as_venue(p_delegation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_venue_id uuid := current_user_venue_id();
begin
  if v_venue_id is null then return jsonb_build_object('ok', false, 'error', 'not_authorized'); end if;

  update public.seating_delegations
  set revoked_at = now(), revoked_by = 'venue'
  where id = p_delegation_id and venue_id = v_venue_id and revoked_at is null;

  return jsonb_build_object('ok', found);
end;
$$;

grant execute on function public.revoke_seating_delegation_as_venue(uuid) to authenticated;

notify pgrst, 'reload schema';
