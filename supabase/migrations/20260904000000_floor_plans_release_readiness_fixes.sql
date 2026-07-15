-- ============================================================================
-- Floor Plans — Release Readiness Fixes (docs/floor-plans-release-readiness.md)
--
-- Two release blockers fixed at the SQL layer:
--
--   1. assign_guest_to_table / remove_guest_assignment were missing the
--      access_level check get_seating_data already enforces (a 'financial'
--      -tier portal session was blocked from reading seating data but could
--      still call the write RPCs directly). Both now return false for that
--      tier, matching get_seating_data's own posture exactly.
--
--   2. get_seating_data's "no floor plan shared" response was identical
--      whether a couple had never had access or had previously done real
--      seating work on a plan the venue has since unshared — a couple in
--      the second case had no way to tell "not yet" from "my work is gone."
--      Adds one field, `hadPriorWork`, computed from whether any
--      guest_seat_assignments row already exists for this couple — no data
--      is ever lost by unsharing (confirmed: table_object_id is nullable,
--      rows are never deleted), this only makes that existing truth visible.
-- ============================================================================

create or replace function public.assign_guest_to_table(p_token text, p_guest_id uuid, p_table_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  if v_ids.access_level = 'financial' then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  -- The table must be a real table object on a Floor Plan the venue has
  -- shared for this booking — never an object from someone else's plan,
  -- never a non-table object (a Stage, a Bar).
  if not exists (
    select 1 from public.floor_plan_objects o
    join public.floor_plans fp on fp.id = o.floor_plan_id
    where o.id = p_table_id
      and fp.event_id = v_ids.event_id
      and fp.client_access != 'hidden'
      and o.object_type in ('table_round', 'table_rect', 'table_oval')
  ) then
    return false;
  end if;

  insert into public.guest_seat_assignments (guest_id, table_object_id)
  values (p_guest_id, p_table_id)
  on conflict (guest_id) do update
    set table_object_id = excluded.table_object_id, assigned_at = now();

  return true;
end;
$$;


create or replace function public.remove_guest_assignment(p_token text, p_guest_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  if v_ids.access_level = 'financial' then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  delete from public.guest_seat_assignments where guest_id = p_guest_id;
  return true;
end;
$$;


create or replace function public.get_seating_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids        record;
  v_floor_plan record;
  v_had_prior_work boolean;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('error', 'invalid_token'); end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0));
  end if;

  -- The Floor Plan the venue has prepared and shared. If more than one is
  -- shared, the most recently updated wins — a rare case, and simpler than
  -- asking the couple to disambiguate which room they're seating.
  select fp.id, fp.name, fp.room_width_ft, fp.room_depth_ft,
         fp.background_image_url, fp.background_image_opacity
  into v_floor_plan
  from public.floor_plans fp
  where fp.event_id = v_ids.event_id and fp.client_access != 'hidden'
  order by fp.updated_at desc
  limit 1;

  if v_floor_plan.id is null then
    -- Distinguish "nothing has ever been shared" from "the venue has
    -- unshared (or deleted) a plan this couple already worked in" — no
    -- seating data is ever deleted by unsharing or by a plan's deletion
    -- (guest_seat_assignments.table_object_id is SET NULL, never
    -- cascaded), so this is a read of existing truth, not a new
    -- computation of anything. needsReassignment must be populated here
    -- too, not just hadPriorWork — a guest whose table (or whole plan)
    -- disappeared while no other plan is shared is still a guest who
    -- needs a new table, and the couple should still be able to see that.
    select exists (
      select 1 from public.guest_seat_assignments gsa
      join public.couple_guests g on g.id = gsa.guest_id
      where g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
    ) into v_had_prior_work;

    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
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
        where gsa.table_object_id is null
          and g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
      ), '[]'::jsonb),
      'hadPriorWork', coalesce(v_had_prior_work, false),
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0)
    );
  end if;

  return jsonb_build_object(
    'floorPlan', jsonb_build_object(
      'id', v_floor_plan.id, 'name', v_floor_plan.name,
      'roomWidthFt', v_floor_plan.room_width_ft, 'roomDepthFt', v_floor_plan.room_depth_ft,
      'backgroundImageUrl', v_floor_plan.background_image_url,
      'backgroundImageOpacity', v_floor_plan.background_image_opacity
    ),
    'hadPriorWork', true,
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
          where gsa.table_object_id = o.id
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
      left join public.guest_seat_assignments gsa on gsa.guest_id = g.id
      where g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
        and g.rsvp_status = 'attending'
        and gsa.id is null
    ), '[]'::jsonb),
    -- Guests whose table was deleted out from under them in the Floor Plan
    -- editor — a real assignment still exists, it just points nowhere now.
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
      where gsa.table_object_id is null
        and g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'totalAttending', (
        select count(*) from public.couple_guests
        where client_id = v_ids.client_id and venue_id = v_ids.venue_id and rsvp_status = 'attending'
      ),
      'totalAssigned', (
        select count(*) from public.guest_seat_assignments gsa
        join public.couple_guests g on g.id = gsa.guest_id
        where gsa.table_object_id is not null and g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
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

notify pgrst, 'reload schema';
