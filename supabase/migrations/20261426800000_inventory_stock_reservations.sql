-- Stock reservations across events (step 6).
-- A couple-approved Event Order reserves its inventory for the event's time.
-- The venue chooses whether events on the same day can share stock:
-- 'same_day' (never) or 'by_time' (when times don't overlap, plus a turnaround
-- gap). Warnings only for the venue; the couple's add-table limit for items
-- not on their order uses the stock left at that time. Stock 0 = not tracked.

alter table public.venues
  add column if not exists inventory_sharing_mode text not null default 'same_day',
  add column if not exists inventory_turnaround_minutes integer not null default 180;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'venues_inventory_sharing_mode_check') then
    alter table public.venues add constraint venues_inventory_sharing_mode_check
      check (inventory_sharing_mode in ('same_day', 'by_time'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'venues_inventory_turnaround_minutes_check') then
    alter table public.venues add constraint venues_inventory_turnaround_minutes_check
      check (inventory_turnaround_minutes between 0 and 1440);
  end if;
end $$;

comment on column public.venues.inventory_sharing_mode is
  'same_day: events on the same day never share stock. by_time: they share when their times (setup to teardown) don''t overlap, with inventory_turnaround_minutes between.';
comment on column public.venues.inventory_turnaround_minutes is
  'by_time only: minutes needed between events before stock can be reused.';

-- ── The span an event holds stock (missing times = whole day) ──────────────
create or replace function public._inventory_stock_window(
  p_mode text, p_date date, p_end_date date, p_t1 time, p_t2 time
)
returns table (starts_at timestamp, ends_at timestamp)
language sql
immutable
set search_path to 'public'
as $$
  select
    case when p_mode = 'by_time' then p_date + coalesce(p_t1, time '00:00') else p_date::timestamp end,
    case
      when p_mode = 'by_time' and p_t2 is not null then
        coalesce(p_end_date, p_date) + p_t2
        + case when coalesce(p_end_date, p_date) = p_date and p_t1 is not null and p_t2 <= p_t1
            then interval '1 day' else interval '0' end
      else (coalesce(p_end_date, p_date) + 1)::timestamp
    end;
$$;

revoke all on function public._inventory_stock_window(text, date, date, time, time) from public, anon, authenticated;

-- ── Approved quantity of an item at other events that can't share stock ────
create or replace function public._inventory_reserved_elsewhere(
  p_venue_id uuid, p_event_id uuid, p_inventory_item_id uuid
)
returns integer
language sql
stable
set search_path to 'public'
as $$
  with s as (
    select
      coalesce(v.inventory_sharing_mode, 'same_day') as mode,
      case when v.inventory_sharing_mode = 'by_time'
        then make_interval(mins => greatest(coalesce(v.inventory_turnaround_minutes, 0), 0))
        else interval '0' end as gap
    from public.venues v
    where v.id = p_venue_id
  ),
  t as (
    select w.starts_at, w.ends_at
    from public.events e
    cross join s
    cross join lateral public._inventory_stock_window(
      s.mode, e.event_date, e.event_end_date,
      coalesce(e.setup_time, e.start_time), coalesce(e.teardown_time, e.end_time)) w
    where e.id = p_event_id and e.venue_id = p_venue_id
  )
  select coalesce(sum(l.quantity), 0)::int
  from s
  cross join t
  cross join public.events o
  join public.event_orders eo
    on eo.event_id = o.id and eo.venue_id = p_venue_id and eo.client_agreed_at is not null
  join public.event_order_lines l
    on l.event_order_id = eo.id and l.venue_id = p_venue_id
  left join public.offerings f
    on f.id = l.offering_id and f.venue_id = p_venue_id
  cross join lateral public._inventory_stock_window(
    s.mode, o.event_date, o.event_end_date,
    coalesce(o.setup_time, o.start_time), coalesce(o.teardown_time, o.end_time)) ow
  where o.venue_id = p_venue_id
    and o.id <> p_event_id
    and o.status in ('confirmed', 'complete')
    and coalesce(l.inventory_item_id, f.inventory_item_id) = p_inventory_item_id
    and t.starts_at < ow.ends_at + s.gap
    and ow.starts_at < t.ends_at + s.gap;
$$;

revoke all on function public._inventory_reserved_elsewhere(uuid, uuid, uuid) from public, anon, authenticated;

comment on function public._inventory_reserved_elsewhere(uuid, uuid, uuid) is
  'Internal: couple-approved Event Order quantity of an item at other booked events that can''t share stock with this event (venue sharing setting). Mirrors lib/inventory/reservations.ts.';

-- ── Portal furniture catalog: Event Order cap first, then stock left at that time ──
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
  v_open boolean;
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

  v_open := coalesce(v_plan.couple_may_add_tables, true)
    and v_plan.finalized_at is null
    and coalesce(v_plan.client_layout_status, 'working') in ('working', 'changes_requested');

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
      lim.cap as "quantityAvailable",
      used.n as "quantityUsed",
      greatest(0, lim.cap - used.n) as remaining,
      (lim.cap > 0) as "quantityConfigured",
      q.order_qty as "orderQuantity",
      case when q.order_qty > 0 then 'event_order'
           when i.quantity_available > 0 then 'stock'
           else null end as "limitSource",
      (v_open and lim.cap > 0 and used.n < lim.cap) as addable,
      case
        when not coalesce(v_plan.couple_may_add_tables, true) then 'add_not_permitted'
        when v_plan.finalized_at is not null then 'plan_ready'
        when coalesce(v_plan.client_layout_status, 'working') in ('submitted', 'approved') then 'awaiting_review'
        when lim.cap <= 0 and i.quantity_available > 0 then 'quantity_exceeded'
        when lim.cap <= 0 then 'quantity_not_configured'
        when used.n >= lim.cap then
          case when q.order_qty > 0 then 'order_limit_reached' else 'quantity_exceeded' end
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
    cross join lateral (
      select public._event_order_item_quantity(v_ids.venue_id, v_ids.event_id, i.id) as order_qty
    ) q
    cross join lateral (
      select case when q.order_qty > 0 then q.order_qty
        else greatest(i.quantity_available - public._inventory_reserved_elsewhere(v_ids.venue_id, v_ids.event_id, i.id), 0) end as cap
    ) lim
    cross join lateral (
      select count(*)::int as n
      from public.floor_plan_objects o
      where o.floor_plan_id = v_plan.id
        and o.inventory_item_id = i.id
    ) used
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
        v_open
        and count(*) < public._portal_floor_plan_type_safety_cap()
      ) as addable,
      case
        when not coalesce(v_plan.couple_may_add_tables, true) then 'add_not_permitted'
        when v_plan.finalized_at is not null then 'plan_ready'
        when coalesce(v_plan.client_layout_status, 'working') in ('submitted', 'approved') then 'awaiting_review'
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
    'clientLayoutStatus', coalesce(v_plan.client_layout_status, 'working'),
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
  'Portal: venue furniture catalog for couple table adds. Limit = Event Order quantity when the item is on the order, else venue stock minus what approved events at the same time reserve; counted on this layout only.';

-- ── Portal add table: same limit rule, enforced server-side ────────────────
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
  v_order int;
  v_limit int;
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
  if coalesce(v_plan.client_layout_status, 'working') in ('submitted', 'approved') then
    return jsonb_build_object('ok', false, 'error',
      case when coalesce(v_plan.client_layout_status, 'working') = 'approved'
        then 'plan_approved' else 'awaiting_review' end);
  end if;
  if not coalesce(v_plan.couple_may_add_tables, true) then
    return jsonb_build_object('ok', false, 'error', 'add_not_permitted');
  end if;

  v_room_w := coalesce(v_plan.room_width_ft, 0) * 12;
  v_room_h := coalesce(v_plan.room_depth_ft, 0) * 12;

  if p_inventory_item_id is not null then
    select * into v_item
    from public.inventory_items i
    where i.id = p_inventory_item_id
      and i.venue_id = v_ids.venue_id
      and i.is_archived = false
      and i.available_for_floor_plans = true;

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

    -- Limit: Event Order quantity when the item is on the order, else stock left
    -- after approved events that can't share it.
    -- Counted on this layout only (the plan row is locked above).
    v_order := public._event_order_item_quantity(v_ids.venue_id, v_ids.event_id, v_item.id);
    v_limit := case when v_order > 0 then v_order
      else greatest(v_item.quantity_available - public._inventory_reserved_elsewhere(v_ids.venue_id, v_ids.event_id, v_item.id), 0) end;

    if v_limit <= 0 then
      return jsonb_build_object('ok', false, 'error',
        case when v_item.quantity_available > 0 then 'quantity_exceeded' else 'quantity_not_configured' end);
    end if;

    select count(*)::int into v_used
    from public.floor_plan_objects o
    where o.floor_plan_id = v_plan.id
      and o.inventory_item_id = v_item.id;

    if v_used >= v_limit then
      return jsonb_build_object('ok', false, 'error',
        case when v_order > 0 then 'order_limit_reached' else 'quantity_exceeded' end);
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

notify pgrst, 'reload schema';
