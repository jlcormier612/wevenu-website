-- Floor plan collaboration completion:
-- 1) Selection / sole-offer assignment shares layout AND enables seating (client_access=view).
-- 2) ensure_portal_floor_plan_assignment auto-assigns when exactly one eligible offer.
-- 3) Couples may move unlocked objects on the shared working plan (server-enforced).
-- 4) Ready (finalized_at) blocks couple object moves.
-- Does not mutate Library templates. Does not invent layouts when zero offers.

alter table public.floor_plans
  add column if not exists couple_may_add_tables boolean not null default true;

comment on column public.floor_plans.couple_may_add_tables is
  'When true, the couple may add table objects on the shared working plan. Venue-controlled.';

-- ── select: share layout + seating ───────────────────────────────────────────
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
      'view'
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

  update public.floor_plans
  set
    shared_with_couple = true,
    client_access = 'view'
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
    'offerId', v_offer.id,
    'autoAssigned', false
  );
end;
$$;

comment on function public.select_portal_floor_plan_offer(text, uuid) is
  'Portal: select offered layout; clones/reuses event plan; sets couple_selected + operational; shares layout view and enables seating (client_access=view).';

-- ── sole-offer auto-assign + heal share/seating on existing selection ────────
create or replace function public.ensure_portal_floor_plan_assignment(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_selected uuid;
  v_offer_id uuid;
  v_offer_count int;
  v_result jsonb;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('error', 'insufficient_access');
  end if;

  select e.couple_selected_floor_plan_id into v_selected
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_selected is not null then
    update public.floor_plans
    set shared_with_couple = true, client_access = 'view'
    where id = v_selected
      and venue_id = v_ids.venue_id
      and event_id = v_ids.event_id;
    return jsonb_build_object(
      'ok', true,
      'floorPlanId', v_selected,
      'autoAssigned', false,
      'reason', 'already_selected'
    );
  end if;

  select count(*)::int into v_offer_count
  from public.event_floor_plan_offers o
  join public.floor_plan_templates t on t.id = o.floor_plan_template_id
  where o.event_id = v_ids.event_id
    and o.venue_id = v_ids.venue_id
    and o.is_offered = true
    and t.is_archived = false;

  if v_offer_count = 0 then
    return jsonb_build_object('ok', true, 'floorPlanId', null, 'autoAssigned', false, 'reason', 'no_offers');
  end if;

  if v_offer_count > 1 then
    return jsonb_build_object('ok', true, 'floorPlanId', null, 'autoAssigned', false, 'reason', 'needs_selection');
  end if;

  select o.id into v_offer_id
  from public.event_floor_plan_offers o
  join public.floor_plan_templates t on t.id = o.floor_plan_template_id
  where o.event_id = v_ids.event_id
    and o.venue_id = v_ids.venue_id
    and o.is_offered = true
    and t.is_archived = false
  order by o.sort_order asc, o.created_at asc
  limit 1;

  v_result := public.select_portal_floor_plan_offer(p_token, v_offer_id);
  if (v_result ? 'error') then
    return v_result;
  end if;

  return jsonb_build_object(
    'ok', true,
    'floorPlanId', v_result->>'floorPlanId',
    'offerId', v_offer_id,
    'autoAssigned', true,
    'reason', 'sole_offer'
  );
end;
$$;

grant execute on function public.ensure_portal_floor_plan_assignment(text) to anon, authenticated;

comment on function public.ensure_portal_floor_plan_assignment(text) is
  'Portal: if exactly one eligible offered layout and none selected, auto-assign (select). Always heals share+seating on an existing selection.';

-- ── couple move unlocked object ──────────────────────────────────────────────
create or replace function public.move_portal_floor_plan_object(
  p_token text,
  p_object_id uuid,
  p_x numeric,
  p_y numeric
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_obj public.floor_plan_objects%rowtype;
  v_plan public.floor_plans%rowtype;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if v_ids.access_level in ('financial', 'view_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;
  if p_x is null or p_y is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_coordinates');
  end if;
  -- Reasonable canvas bounds (inches); reject absurd values.
  if p_x < -500 or p_y < -500 or p_x > 20000 or p_y > 20000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_coordinates');
  end if;

  select * into v_obj
  from public.floor_plan_objects o
  where o.id = p_object_id and o.venue_id = v_ids.venue_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into v_plan
  from public.floor_plans fp
  where fp.id = v_obj.floor_plan_id
    and fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.shared_with_couple = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_shared');
  end if;

  if v_plan.finalized_at is not null then
    return jsonb_build_object('ok', false, 'error', 'plan_ready');
  end if;

  if coalesce(v_obj.locked, false) then
    return jsonb_build_object('ok', false, 'error', 'object_locked');
  end if;

  update public.floor_plan_objects
  set x = p_x, y = p_y, updated_at = now()
  where id = v_obj.id and venue_id = v_ids.venue_id;

  return jsonb_build_object('ok', true, 'objectId', v_obj.id, 'x', p_x, 'y', p_y);
end;
$$;

grant execute on function public.move_portal_floor_plan_object(text, uuid, numeric, numeric)
  to anon, authenticated;

-- ── couple add permitted table ───────────────────────────────────────────────
create or replace function public.add_portal_floor_plan_table(
  p_token text,
  p_floor_plan_id uuid,
  p_object_type text default 'table_round',
  p_x numeric default 200,
  p_y numeric default 200
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_plan public.floor_plans%rowtype;
  v_obj_id uuid;
  v_type text;
  v_w numeric;
  v_h numeric;
  v_cap int;
  v_label text;
  v_sort int;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if v_ids.access_level in ('financial', 'view_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  v_type := coalesce(nullif(trim(p_object_type), ''), 'table_round');
  if v_type not in ('table_round', 'table_rect', 'table_oval') then
    return jsonb_build_object('ok', false, 'error', 'type_not_permitted');
  end if;

  select * into v_plan
  from public.floor_plans fp
  where fp.id = p_floor_plan_id
    and fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.shared_with_couple = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_shared');
  end if;
  if v_plan.finalized_at is not null then
    return jsonb_build_object('ok', false, 'error', 'plan_ready');
  end if;
  if not coalesce(v_plan.couple_may_add_tables, true) then
    return jsonb_build_object('ok', false, 'error', 'add_not_permitted');
  end if;

  if v_type = 'table_rect' then
    v_w := 72; v_h := 30; v_cap := 8; v_label := 'Table';
  elsif v_type = 'table_oval' then
    v_w := 72; v_h := 48; v_cap := 8; v_label := 'Table';
  else
    v_w := 60; v_h := 60; v_cap := 8; v_label := 'Table';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.floor_plan_objects where floor_plan_id = v_plan.id;

  insert into public.floor_plan_objects (
    venue_id, floor_plan_id, object_type, label, capacity,
    x, y, width, height, rotation, sort_order, locked, display_shape
  ) values (
    v_ids.venue_id, v_plan.id, v_type, v_label, v_cap,
    coalesce(p_x, 200), coalesce(p_y, 200), v_w, v_h, 0, v_sort, false,
    case v_type
      when 'table_round' then 'round'
      when 'table_rect' then 'rectangular'
      when 'table_oval' then 'oval'
      else null
    end
  )
  returning id into v_obj_id;

  return jsonb_build_object('ok', true, 'objectId', v_obj_id, 'objectType', v_type);
end;
$$;

grant execute on function public.add_portal_floor_plan_table(text, uuid, text, numeric, numeric)
  to anon, authenticated;

-- Expose locked + coupleMayAddTables on portal plan detail (additive).
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
      'coupleMayAddTables', coalesce(v_plan.couple_may_add_tables, true),
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

notify pgrst, 'reload schema';
