-- Expose event guest count + assigned Space capacity on the couple floor-plan
-- detail payload so the portal can show trustworthy capacity context without
-- inventing limits. Does not change submit/review or inventory enforcement.

create or replace function public.get_portal_floor_plan(p_token text, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_operational uuid;
  v_couple_selected uuid;
  v_plan public.floor_plans%rowtype;
  v_guest_count integer;
  v_space_id uuid;
  v_space_name text;
  v_space_capacity integer;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('error', 'insufficient_access');
  end if;

  select * into v_plan
  from public.floor_plans fp
  where fp.id = p_floor_plan_id
    and fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.shared_with_couple = true;

  if not found then
    return jsonb_build_object('error', 'not_found_or_not_shared');
  end if;

  select
    e.operational_floor_plan_id,
    e.couple_selected_floor_plan_id,
    e.guest_count,
    e.space_id
  into v_operational, v_couple_selected, v_guest_count, v_space_id
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  v_space_id := coalesce(v_plan.space_id, v_space_id);

  if v_space_id is not null then
    select vs.name, vs.capacity
    into v_space_name, v_space_capacity
    from public.venue_spaces vs
    where vs.id = v_space_id
      and vs.venue_id = v_ids.venue_id;
  end if;

  return jsonb_build_object(
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'spaceId', v_plan.space_id,
      'isOperational', (v_operational is not null and v_plan.id = v_operational),
      'isCoupleSelected', (v_couple_selected is not null and v_plan.id = v_couple_selected),
      'isReady', (v_plan.finalized_at is not null),
      'clientLayoutStatus', coalesce(v_plan.client_layout_status, 'working'),
      'clientSubmittedAt', v_plan.client_submitted_at,
      'clientReviewNote', v_plan.client_review_note,
      'clientReviewedAt', v_plan.client_reviewed_at,
      'coupleMayAddTables', coalesce(v_plan.couple_may_add_tables, true),
      'backgroundImageUrl', v_plan.background_image_url,
      'backgroundImageOpacity', v_plan.background_image_opacity,
      'roomWidthFt', v_plan.room_width_ft,
      'roomDepthFt', v_plan.room_depth_ft,
      'measurementUnit', v_plan.measurement_unit,
      'notes', v_plan.notes
    ),
    'eventGuestCount', v_guest_count,
    'spaceName', v_space_name,
    'spaceCapacity', v_space_capacity,
    'objects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'objectType', o.object_type,
          'label', o.label,
          'capacity', o.capacity,
          'x', o.x,
          'y', o.y,
          'width', o.width,
          'height', o.height,
          'rotation', o.rotation,
          'sortOrder', o.sort_order,
          'color', o.color,
          'notes', o.notes,
          'displayShape', o.display_shape,
          'inventoryItemId', o.inventory_item_id,
          'locked', coalesce(o.locked, false)
        )
        order by o.sort_order, o.created_at
      )
      from public.floor_plan_objects o
      where o.floor_plan_id = v_plan.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_portal_floor_plan(text, uuid) to anon, authenticated;

comment on function public.get_portal_floor_plan(text, uuid) is
  'Couple working floor-plan detail, including event guest count and assigned Space capacity for capacity guidance.';

notify pgrst, 'reload schema';
