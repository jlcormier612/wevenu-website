-- ============================================================================
-- Floor Plan Phase 1 — couple layout view (share ≠ seating) + operational SoR
--
-- 1) floor_plans.shared_with_couple — durable "Share Floor Plan" (layout view).
--    Distinct from client_access ("Share for Seating").
-- 2) events.operational_floor_plan_id — venue-controlled SoR pointer
--    ("What floor plan is this event actually using?"). Never inferred.
-- 3) Portal RPCs: list + detail (all floor_plan_objects) for shared plans only.
-- ============================================================================

-- ── 1. Share Floor Plan (couple layout view) ────────────────────────────────
alter table public.floor_plans
  add column if not exists shared_with_couple boolean not null default false;

comment on column public.floor_plans.shared_with_couple is
  'Phase 1: venue Share Floor Plan — couple may view the full layout. Independent of client_access (Enable Seating).';

-- ── 2. Operational plan SoR pointer ─────────────────────────────────────────
alter table public.events
  add column if not exists operational_floor_plan_id uuid
    references public.floor_plans(id) on delete set null;

create index if not exists events_operational_floor_plan
  on public.events (operational_floor_plan_id)
  where operational_floor_plan_id is not null;

comment on column public.events.operational_floor_plan_id is
  'Phase 1: durable venue-controlled operational floor plan for this event. Not inferred from activity.';

-- Integrity: operational plan must belong to the same event.
create or replace function public.validate_operational_floor_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.operational_floor_plan_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.floor_plans fp
    where fp.id = new.operational_floor_plan_id
      and fp.event_id = new.id
      and fp.venue_id = new.venue_id
  ) then
    raise exception 'operational_floor_plan_id must reference a floor plan on the same event';
  end if;
  return new;
end;
$$;

drop trigger if exists events_operational_floor_plan_validate on public.events;
create trigger events_operational_floor_plan_validate
  before insert or update of operational_floor_plan_id on public.events
  for each row execute function public.validate_operational_floor_plan();

-- ── 3. Portal list — shared layout plans for the couple's event ─────────────
create or replace function public.get_portal_floor_plans(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_operational uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('floorPlans', '[]'::jsonb, 'operationalFloorPlanId', null);
  end if;

  select e.operational_floor_plan_id into v_operational
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'operationalFloorPlanId', v_operational,
    'floorPlans', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', fp.id,
          'name', fp.name,
          'isOperational', (v_operational is not null and fp.id = v_operational),
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

-- ── 4. Portal detail — full plan + all objects (view-only) ───────────────────
create or replace function public.get_portal_floor_plan(p_token text, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_operational uuid;
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

  select e.operational_floor_plan_id into v_operational
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'spaceId', v_plan.space_id,
      'isOperational', (v_operational is not null and v_plan.id = v_operational),
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
          'inventoryItemId', o.inventory_item_id
        )
        order by o.sort_order, o.created_at
      )
      from public.floor_plan_objects o
      where o.floor_plan_id = v_plan.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_portal_floor_plans(text) to anon, authenticated;
grant execute on function public.get_portal_floor_plan(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
