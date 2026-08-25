-- ============================================================================
-- Seating: surface text-only, un-converted plus-ones
--
-- A guest recorded with a typed plus-one name (couple_guests.plus_one_name)
-- who has not yet been "converted" into their own couple_guests row
-- (assign_plus_one / convert_plus_one_placeholder, see
-- 20260827000000_guest_details_phase3.sql) has no guest record of their
-- own — they are invisible to _build_seating_json entirely, so they occupy
-- zero seats with no warning to the coordinator or the couple. This adds
-- plusOneName to the three guest-JSON blocks (tables[].guests,
-- unassignedGuests, needsReassignment) so the UI can warn wherever a
-- primary guest is rendered. plus_one_name is nulled by
-- convert_plus_one_placeholder once the real row exists (see that
-- function), so "plusOneName is not null" alone is already a reliable
-- "not yet converted" signal — no extra join needed.
-- ============================================================================
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
            'plusOneOfGuestId',  g.plus_one_of_guest_id,
            'plusOneName',       g.plus_one_name
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
        'plusOneOfGuestId',  g.plus_one_of_guest_id,
        'plusOneName',       g.plus_one_name
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
        'plusOneOfGuestId',  g.plus_one_of_guest_id,
        'plusOneName',       g.plus_one_name
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
      ),
      'unconvertedPlusOnes', (
        select count(*) from public.couple_guests
        where client_id = p_client_id and venue_id = p_venue_id
          and rsvp_status = 'attending' and plus_one_name is not null
      )
    )
  );
end;
$$;
