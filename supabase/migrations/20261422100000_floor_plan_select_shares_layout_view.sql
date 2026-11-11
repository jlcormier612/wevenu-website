-- After couple selects an offered layout, share that event working plan for
-- layout view (shared_with_couple = true) so the portal is not a dead end.
-- Seating remains venue-explicit (client_access stays hidden until Share for
-- Seating). Does not mutate Library templates. Does not lock the plan.

create or replace function public.select_portal_floor_plan_offer(
  p_token text,
  p_offer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_offer public.event_floor_plan_offers%rowtype;
  v_template public.floor_plan_templates%rowtype;
  v_plan_id uuid;
  v_plan_name text;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('error', 'insufficient_access');
  end if;

  select * into v_offer
  from public.event_floor_plan_offers o
  where o.id = p_offer_id
    and o.event_id = v_ids.event_id
    and o.venue_id = v_ids.venue_id
    and o.is_offered = true;

  if not found then
    return jsonb_build_object('error', 'not_found_or_not_offered');
  end if;

  select * into v_template
  from public.floor_plan_templates t
  where t.id = v_offer.floor_plan_template_id
    and t.venue_id = v_ids.venue_id
    and t.is_archived = false;

  if not found then
    return jsonb_build_object('error', 'template_unavailable');
  end if;

  -- Reuse existing event clone for this template when present.
  select fp.id into v_plan_id
  from public.floor_plans fp
  where fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.source_template_id = v_template.id
  order by fp.created_at asc
  limit 1;

  if v_plan_id is null then
    v_plan_name := coalesce(nullif(trim(v_offer.couple_label), ''), v_template.name);

    insert into public.floor_plans (
      venue_id, event_id, name, space_id,
      background_image_url, background_image_opacity,
      room_width_ft, room_depth_ft, measurement_unit,
      source_template_id,
      shared_with_couple,
      client_access
    ) values (
      v_ids.venue_id, v_ids.event_id, v_plan_name, v_template.space_id,
      v_template.background_image_url, v_template.background_image_opacity,
      v_template.room_width_ft, v_template.room_depth_ft, v_template.measurement_unit,
      v_template.id,
      true,
      'hidden'
    )
    returning id into v_plan_id;

    insert into public.floor_plan_objects (
      venue_id, floor_plan_id, object_type, label, capacity,
      x, y, width, height, rotation, sort_order,
      inventory_item_id, color, notes, locked, display_shape
    )
    select
      v_ids.venue_id, v_plan_id, tobj.object_type, tobj.label, tobj.capacity,
      tobj.x, tobj.y, tobj.width, tobj.height, tobj.rotation, tobj.sort_order,
      tobj.inventory_item_id, tobj.color, tobj.notes, tobj.locked, tobj.display_shape
    from public.floor_plan_template_objects tobj
    where tobj.template_id = v_template.id
    order by tobj.sort_order, tobj.created_at;
  end if;

  -- Selected working plan is always visible as layout view (not seating).
  update public.floor_plans
  set shared_with_couple = true
  where id = v_plan_id
    and venue_id = v_ids.venue_id
    and event_id = v_ids.event_id;

  update public.events
  set
    couple_selected_floor_plan_id = v_plan_id,
    operational_floor_plan_id = v_plan_id
  where id = v_ids.event_id
    and venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'ok', true,
    'floorPlanId', v_plan_id,
    'templateId', v_template.id,
    'offerId', v_offer.id
  );
end;
$$;

comment on function public.select_portal_floor_plan_offer(text, uuid) is
  'Portal: couple selects an offered layout; clones/reuses event plan, sets couple_selected + operational, and shares layout view (shared_with_couple). Seating (client_access) stays venue-explicit. Does not mutate Library templates.';

-- Surface Ready + couple-selected on portal list for clear status.
create or replace function public.get_portal_floor_plans(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_operational uuid;
  v_couple_selected uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('floorPlans', '[]'::jsonb, 'operationalFloorPlanId', null, 'coupleSelectedFloorPlanId', null);
  end if;

  select e.operational_floor_plan_id, e.couple_selected_floor_plan_id
  into v_operational, v_couple_selected
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'operationalFloorPlanId', v_operational,
    'coupleSelectedFloorPlanId', v_couple_selected,
    'floorPlans', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', fp.id,
          'name', fp.name,
          'isOperational', (v_operational is not null and fp.id = v_operational),
          'isCoupleSelected', (v_couple_selected is not null and fp.id = v_couple_selected),
          'isReady', (fp.finalized_at is not null),
          'spaceId', fp.space_id,
          'createdAt', fp.created_at
        )
        order by fp.created_at asc
      )
      from public.floor_plans fp
      where fp.event_id = v_ids.event_id
        and fp.venue_id = v_ids.venue_id
        and fp.shared_with_couple = true
    ), '[]'::jsonb)
  );
end;
$$;

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

  select e.operational_floor_plan_id, e.couple_selected_floor_plan_id
  into v_operational, v_couple_selected
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'spaceId', v_plan.space_id,
      'isOperational', (v_operational is not null and v_plan.id = v_operational),
      'isCoupleSelected', (v_couple_selected is not null and v_plan.id = v_couple_selected),
      'isReady', (v_plan.finalized_at is not null),
      'backgroundImageUrl', v_plan.background_image_url,
      'backgroundImageOpacity', v_plan.background_image_opacity,
      'roomWidthFt', v_plan.room_width_ft,
      'roomDepthFt', v_plan.room_depth_ft,
      'measurementUnit', v_plan.measurement_unit,
      'notes', v_plan.notes
    ),
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
          'locked', o.locked
        )
        order by o.sort_order, o.created_at
      )
      from public.floor_plan_objects o
      where o.floor_plan_id = v_plan.id
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
