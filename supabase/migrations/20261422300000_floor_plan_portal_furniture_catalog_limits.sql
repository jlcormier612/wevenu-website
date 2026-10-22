-- Floor plan portal gap closure: catalog-driven couple adds, inventory quantity
-- limits (server-enforced), room-boundary move checks, safe remove with seating
-- assignment guard. Seating remains guest-to-table (no per-chair assignment).

-- Safety cap when venue inventory quantity_available is unset (0 = not configured).
-- This is a system anti-abuse ceiling, not invented venue stock.
create or replace function public._portal_floor_plan_type_safety_cap()
returns int
language sql
immutable
as $$ select 40 $$;

-- Map inventory shape → seatable floor-plan object_type + defaults.
create or replace function public._portal_inventory_to_table_meta(p_shape text)
returns table (
  object_type text,
  display_shape text,
  default_width numeric,
  default_height numeric,
  default_capacity int
)
language sql
immutable
as $$
  select *
  from (values
    ('round',       'table_round', 'round',       72::numeric, 72::numeric, 8),
    ('cocktail',    'table_round', 'cocktail',    30::numeric, 30::numeric, 2),
    ('oval',        'table_oval',  'oval',        130::numeric, 70::numeric, 10),
    ('rectangular', 'table_rect',  'rectangular', 120::numeric, 60::numeric, 8),
    ('square',      'table_rect',  'square',      60::numeric, 60::numeric, 8)
  ) as v(shape, object_type, display_shape, default_width, default_height, default_capacity)
  where v.shape = lower(coalesce(p_shape, ''));
$$;

-- ── catalog for couple Add furniture ─────────────────────────────────────────
create or replace function public.get_portal_floor_plan_furniture_catalog(
  p_token text,
  p_floor_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_plan public.floor_plans%rowtype;
  v_items jsonb;
  v_plan_types jsonb;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level in ('financial', 'view_only') then
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

  -- Inventory catalog: floor-plan-eligible seating tables (not chairs/fixtures).
  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.name), '[]'::jsonb)
  into v_items
  from (
    select
      i.id as "inventoryItemId",
      coalesce(nullif(trim(i.printable_name), ''), i.name) as name,
      i.shape,
      i.width,
      i.length,
      i.height,
      i.color,
      i.quantity_available as "quantityAvailable",
      (
        select count(*)::int
        from public.floor_plan_objects o
        join public.floor_plans fp on fp.id = o.floor_plan_id
        where o.venue_id = v_ids.venue_id
          and fp.event_id = v_ids.event_id
          and o.inventory_item_id = i.id
      ) as "quantityUsed",
      case
        when i.quantity_available > 0 then
          greatest(0, i.quantity_available - (
            select count(*)::int
            from public.floor_plan_objects o
            join public.floor_plans fp on fp.id = o.floor_plan_id
            where o.venue_id = v_ids.venue_id
              and fp.event_id = v_ids.event_id
              and o.inventory_item_id = i.id
          ))
        else 0
      end as remaining,
      (i.quantity_available > 0) as "quantityConfigured",
      (
        i.quantity_available > 0
        and i.quantity_available > (
          select count(*)::int
          from public.floor_plan_objects o
          join public.floor_plans fp on fp.id = o.floor_plan_id
          where o.venue_id = v_ids.venue_id
            and fp.event_id = v_ids.event_id
            and o.inventory_item_id = i.id
        )
        and coalesce(v_plan.couple_may_add_tables, true)
        and v_plan.finalized_at is null
      ) as addable,
      case
        when not coalesce(v_plan.couple_may_add_tables, true) then 'add_not_permitted'
        when v_plan.finalized_at is not null then 'plan_ready'
        when i.quantity_available <= 0 then 'quantity_not_configured'
        when i.quantity_available <= (
          select count(*)::int
          from public.floor_plan_objects o
          join public.floor_plans fp on fp.id = o.floor_plan_id
          where o.venue_id = v_ids.venue_id
            and fp.event_id = v_ids.event_id
            and o.inventory_item_id = i.id
        ) then 'quantity_exceeded'
        else null
      end as "unavailableReason",
      m.object_type as "objectType",
      m.display_shape as "displayShape",
      coalesce(i.width, m.default_width) as "placeWidth",
      coalesce(i.length, m.default_height) as "placeHeight",
      coalesce(
        (
          select o.capacity
          from public.floor_plan_objects o
          where o.floor_plan_id = v_plan.id
            and o.inventory_item_id = i.id
            and o.capacity is not null
          order by o.sort_order
          limit 1
        ),
        m.default_capacity
      ) as capacity,
      c.name as "categoryName"
    from public.inventory_items i
    left join public.inventory_categories c
      on c.id = i.category_id and c.venue_id = i.venue_id
    join lateral public._portal_inventory_to_table_meta(i.shape) m on true
    where i.venue_id = v_ids.venue_id
      and i.is_archived = false
      and i.available_for_floor_plans = true
      and (
        lower(coalesce(c.name, '')) = 'tables'
        or (
          lower(coalesce(i.shape, '')) in ('round', 'oval', 'rectangular', 'cocktail')
          and coalesce(i.width, m.default_width) >= 24
          and coalesce(i.length, m.default_height) >= 24
        )
      )
  ) x;

  -- Plan-native seatable types (template furniture without inventory linkage).
  -- Finite safety cap only — not claimed as venue stock.
  select coalesce(jsonb_agg(row_to_json(y)::jsonb order by y."objectType"), '[]'::jsonb)
  into v_plan_types
  from (
    select
      o.object_type as "objectType",
      max(o.display_shape) as "displayShape",
      max(o.width) as "placeWidth",
      max(o.height) as "placeHeight",
      max(o.capacity) as capacity,
      count(*)::int as "quantityUsed",
      public._portal_floor_plan_type_safety_cap() as "quantityAvailable",
      greatest(0, public._portal_floor_plan_type_safety_cap() - count(*)::int) as remaining,
      true as "quantityConfigured",
      (
        coalesce(v_plan.couple_may_add_tables, true)
        and v_plan.finalized_at is null
        and count(*) < public._portal_floor_plan_type_safety_cap()
      ) as addable,
      case
        when not coalesce(v_plan.couple_may_add_tables, true) then 'add_not_permitted'
        when v_plan.finalized_at is not null then 'plan_ready'
        when count(*) >= public._portal_floor_plan_type_safety_cap() then 'quantity_exceeded'
        else null
      end as "unavailableReason",
      ('Add another ' || replace(o.object_type, '_', ' ')) as name
    from public.floor_plan_objects o
    where o.floor_plan_id = v_plan.id
      and o.object_type in ('table_round', 'table_rect', 'table_oval')
      and o.inventory_item_id is null
    group by o.object_type
  ) y;

  return jsonb_build_object(
    'planId', v_plan.id,
    'coupleMayAddTables', coalesce(v_plan.couple_may_add_tables, true),
    'isReady', (v_plan.finalized_at is not null),
    'roomWidthFt', v_plan.room_width_ft,
    'roomDepthFt', v_plan.room_depth_ft,
    'measurementUnit', v_plan.measurement_unit,
    'inventoryItems', v_items,
    'planTableTypes', v_plan_types,
    'coordinateModel', jsonb_build_object(
      'unit', 'inch',
      'note', 'Canvas coordinates are inches. When roomWidthFt/roomDepthFt are set, room bounds = feet × 12.'
    )
  );
end;
$$;

grant execute on function public.get_portal_floor_plan_furniture_catalog(text, uuid)
  to anon, authenticated;

comment on function public.get_portal_floor_plan_furniture_catalog(text, uuid) is
  'Portal: venue furniture catalog + remaining quantities for couple table adds on a shared working plan.';

-- ── couple add: inventory-first with quantity enforcement ────────────────────
-- Drop prior 5-arg overload so quantity limits cannot be bypassed via the old body.
drop function if exists public.add_portal_floor_plan_table(text, uuid, text, numeric, numeric);

create or replace function public.add_portal_floor_plan_table(
  p_token text,
  p_floor_plan_id uuid,
  p_object_type text default null,
  p_x numeric default 200,
  p_y numeric default 200,
  p_inventory_item_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_plan public.floor_plans%rowtype;
  v_item public.inventory_items%rowtype;
  v_obj_id uuid;
  v_type text;
  v_w numeric;
  v_h numeric;
  v_cap int;
  v_label text;
  v_sort int;
  v_display text;
  v_color text;
  v_used int;
  v_room_w numeric;
  v_room_h numeric;
  v_meta record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if v_ids.access_level in ('financial', 'view_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  select * into v_plan
  from public.floor_plans fp
  where fp.id = p_floor_plan_id
    and fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.shared_with_couple = true
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_shared');
  end if;
  if v_plan.finalized_at is not null then
    return jsonb_build_object('ok', false, 'error', 'plan_ready');
  end if;
  if not coalesce(v_plan.couple_may_add_tables, true) then
    return jsonb_build_object('ok', false, 'error', 'add_not_permitted');
  end if;

  v_room_w := coalesce(v_plan.room_width_ft, 0) * 12;
  v_room_h := coalesce(v_plan.room_depth_ft, 0) * 12;

  if p_inventory_item_id is not null then
    -- Lock inventory row for concurrent quantity enforcement.
    select * into v_item
    from public.inventory_items i
    where i.id = p_inventory_item_id
      and i.venue_id = v_ids.venue_id
      and i.is_archived = false
      and i.available_for_floor_plans = true
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'error', 'inventory_not_found');
    end if;

    select * into v_meta from public._portal_inventory_to_table_meta(v_item.shape);
    if not found then
      return jsonb_build_object('ok', false, 'error', 'type_not_permitted');
    end if;

    -- Reject chair-sized / non-table catalog misuse.
    if coalesce(v_item.width, v_meta.default_width) < 24
       or coalesce(v_item.length, v_meta.default_height) < 24 then
      if not exists (
        select 1 from public.inventory_categories c
        where c.id = v_item.category_id and lower(c.name) = 'tables'
      ) then
        return jsonb_build_object('ok', false, 'error', 'type_not_permitted');
      end if;
    end if;

    if v_item.quantity_available <= 0 then
      return jsonb_build_object('ok', false, 'error', 'quantity_not_configured');
    end if;

    select count(*)::int into v_used
    from public.floor_plan_objects o
    join public.floor_plans fp on fp.id = o.floor_plan_id
    where o.venue_id = v_ids.venue_id
      and fp.event_id = v_ids.event_id
      and o.inventory_item_id = v_item.id;

    if v_used >= v_item.quantity_available then
      return jsonb_build_object('ok', false, 'error', 'quantity_exceeded');
    end if;

    v_type := v_meta.object_type;
    v_display := v_meta.display_shape;
    v_w := coalesce(v_item.width, v_meta.default_width);
    v_h := coalesce(v_item.length, v_meta.default_height);
    v_cap := coalesce(
      (
        select o.capacity from public.floor_plan_objects o
        where o.floor_plan_id = v_plan.id and o.inventory_item_id = v_item.id and o.capacity is not null
        order by o.sort_order limit 1
      ),
      v_meta.default_capacity
    );
    v_label := coalesce(nullif(trim(v_item.printable_name), ''), v_item.name);
    v_color := v_item.color;

  else
    -- Legacy / plan-type path: only seatable table_* types, finite safety cap.
    v_type := coalesce(nullif(trim(p_object_type), ''), 'table_round');
    if v_type not in ('table_round', 'table_rect', 'table_oval') then
      return jsonb_build_object('ok', false, 'error', 'type_not_permitted');
    end if;

    select count(*)::int into v_used
    from public.floor_plan_objects o
    where o.floor_plan_id = v_plan.id
      and o.object_type = v_type
      and o.inventory_item_id is null;

    if v_used >= public._portal_floor_plan_type_safety_cap() then
      return jsonb_build_object('ok', false, 'error', 'quantity_exceeded');
    end if;

    v_label := 'Table';
    v_color := null;
    select o.width, o.height, o.capacity, o.display_shape
      into v_w, v_h, v_cap, v_display
    from public.floor_plan_objects o
    where o.floor_plan_id = v_plan.id
      and o.object_type = v_type
      and o.inventory_item_id is null
    order by o.sort_order
    limit 1;

    if v_w is null then
      if v_type = 'table_rect' then
        v_w := 72; v_h := 30; v_cap := 8; v_display := 'rectangular';
      elsif v_type = 'table_oval' then
        v_w := 72; v_h := 48; v_cap := 8; v_display := 'oval';
      else
        v_w := 60; v_h := 60; v_cap := 8; v_display := 'round';
      end if;
    else
      v_h := coalesce(v_h, 60);
      v_cap := coalesce(v_cap, 8);
      v_display := coalesce(v_display, case v_type
        when 'table_round' then 'round'
        when 'table_rect' then 'rectangular'
        when 'table_oval' then 'oval'
        else null end);
    end if;
  end if;

  -- Keep new placement inside room when room dims are configured.
  if v_room_w > 0 and v_room_h > 0 then
    if coalesce(p_x, 200) < (v_w / 2) or coalesce(p_y, 200) < (v_h / 2)
       or coalesce(p_x, 200) > (v_room_w - v_w / 2)
       or coalesce(p_y, 200) > (v_room_h - v_h / 2) then
      return jsonb_build_object('ok', false, 'error', 'outside_room');
    end if;
  elsif coalesce(p_x, 200) < -500 or coalesce(p_y, 200) < -500
     or coalesce(p_x, 200) > 20000 or coalesce(p_y, 200) > 20000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_coordinates');
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort
  from public.floor_plan_objects where floor_plan_id = v_plan.id;

  insert into public.floor_plan_objects (
    venue_id, floor_plan_id, object_type, label, capacity,
    x, y, width, height, rotation, sort_order, locked, display_shape,
    inventory_item_id, color
  ) values (
    v_ids.venue_id, v_plan.id, v_type, v_label, v_cap,
    coalesce(p_x, 200), coalesce(p_y, 200), v_w, v_h, 0, v_sort, false, v_display,
    p_inventory_item_id, v_color
  )
  returning id into v_obj_id;

  return jsonb_build_object(
    'ok', true,
    'objectId', v_obj_id,
    'objectType', v_type,
    'inventoryItemId', p_inventory_item_id,
    'capacity', v_cap,
    'width', v_w,
    'height', v_h,
    'label', v_label
  );
end;
$$;

grant execute on function public.add_portal_floor_plan_table(text, uuid, text, numeric, numeric, uuid)
  to anon, authenticated;

-- ── move: room boundary when configured ──────────────────────────────────────
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
  v_room_w numeric;
  v_room_h numeric;
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

  v_room_w := coalesce(v_plan.room_width_ft, 0) * 12;
  v_room_h := coalesce(v_plan.room_depth_ft, 0) * 12;
  if v_room_w > 0 and v_room_h > 0 then
    if p_x < (coalesce(v_obj.width, 0) / 2)
       or p_y < (coalesce(v_obj.height, 0) / 2)
       or p_x > (v_room_w - coalesce(v_obj.width, 0) / 2)
       or p_y > (v_room_h - coalesce(v_obj.height, 0) / 2) then
      return jsonb_build_object('ok', false, 'error', 'outside_room');
    end if;
  end if;

  update public.floor_plan_objects
  set x = p_x, y = p_y, updated_at = now()
  where id = v_obj.id and venue_id = v_ids.venue_id;

  return jsonb_build_object('ok', true, 'objectId', v_obj.id, 'x', p_x, 'y', p_y);
end;
$$;

grant execute on function public.move_portal_floor_plan_object(text, uuid, numeric, numeric)
  to anon, authenticated;

-- ── remove unlocked couple-added / unlocked table; block if seated guests ────
create or replace function public.remove_portal_floor_plan_object(
  p_token text,
  p_object_id uuid,
  p_confirm_unassign boolean default false
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
  v_assigned int;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if v_ids.access_level in ('financial', 'view_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
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
  if v_obj.object_type not in ('table_round', 'table_rect', 'table_oval') then
    return jsonb_build_object('ok', false, 'error', 'type_not_removable');
  end if;

  select count(*)::int into v_assigned
  from public.guest_seat_assignments gsa
  where gsa.floor_plan_id = v_plan.id
    and gsa.table_object_id = v_obj.id;

  if v_assigned > 0 and not coalesce(p_confirm_unassign, false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'has_assignments',
      'assignedCount', v_assigned
    );
  end if;

  if v_assigned > 0 then
    delete from public.guest_seat_assignments
    where floor_plan_id = v_plan.id and table_object_id = v_obj.id;
  end if;

  delete from public.floor_plan_objects
  where id = v_obj.id and venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'ok', true,
    'objectId', v_obj.id,
    'unassignedCount', v_assigned
  );
end;
$$;

grant execute on function public.remove_portal_floor_plan_object(text, uuid, boolean)
  to anon, authenticated;

notify pgrst, 'reload schema';
