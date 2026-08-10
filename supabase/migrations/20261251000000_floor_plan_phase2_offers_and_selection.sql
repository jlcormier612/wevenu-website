-- ============================================================================
-- Floor Plan Phase 2 — offered layouts + couple selection
--
-- Contract:
-- * Offers point ONLY at venue-owned floor_plan_templates.
-- * Selection clones (or reuses) an event floor_plans row; never mutates templates.
-- * Selection does NOT set shared_with_couple (Phase 1 Share stays venue-explicit).
-- * Selection does NOT set operational_floor_plan_id.
-- * Withdrawing an offer removes it from the chooser only — selection + clone remain.
-- ============================================================================

-- ── 1. Provenance: which template produced this event plan ───────────────────
alter table public.floor_plans
  add column if not exists source_template_id uuid
    references public.floor_plan_templates (id) on delete set null;

create index if not exists floor_plans_source_template
  on public.floor_plans (event_id, source_template_id)
  where source_template_id is not null;

comment on column public.floor_plans.source_template_id is
  'Phase 2: template this event plan was cloned from (applyTemplate / couple selection). Snapshot provenance only — not a live link.';

-- ── 2. Couple selection pointer (separate from operational) ─────────────────
alter table public.events
  add column if not exists couple_selected_floor_plan_id uuid
    references public.floor_plans (id) on delete set null;

create index if not exists events_couple_selected_floor_plan
  on public.events (couple_selected_floor_plan_id)
  where couple_selected_floor_plan_id is not null;

comment on column public.events.couple_selected_floor_plan_id is
  'Phase 2: durable couple-selected event floor plan. Independent of operational_floor_plan_id and shared_with_couple.';

create or replace function public.validate_couple_selected_floor_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.couple_selected_floor_plan_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.floor_plans fp
    where fp.id = new.couple_selected_floor_plan_id
      and fp.event_id = new.id
      and fp.venue_id = new.venue_id
  ) then
    raise exception 'couple_selected_floor_plan_id must reference a floor plan on the same event';
  end if;
  return new;
end;
$$;

drop trigger if exists events_couple_selected_floor_plan_validate on public.events;
create trigger events_couple_selected_floor_plan_validate
  before insert or update of couple_selected_floor_plan_id on public.events
  for each row execute function public.validate_couple_selected_floor_plan();

-- ── 3. Event-scoped offers of venue templates ───────────────────────────────
create table if not exists public.event_floor_plan_offers (
  id                     uuid primary key default gen_random_uuid(),
  venue_id               uuid not null references public.venues (id) on delete cascade,
  event_id               uuid not null references public.events (id) on delete cascade,
  floor_plan_template_id uuid not null references public.floor_plan_templates (id) on delete cascade,
  sort_order             integer not null default 0,
  is_offered             boolean not null default true,
  couple_label           text,
  couple_blurb           text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (event_id, floor_plan_template_id)
);

create index if not exists event_floor_plan_offers_event
  on public.event_floor_plan_offers (event_id, sort_order)
  where is_offered = true;

create index if not exists event_floor_plan_offers_venue
  on public.event_floor_plan_offers (venue_id);

create trigger event_floor_plan_offers_updated_at
  before update on public.event_floor_plan_offers
  for each row execute function public.set_updated_at();

comment on table public.event_floor_plan_offers is
  'Phase 2: venue-approved layouts offered to the couple for THIS event. Points at templates only.';

-- Offer integrity: template and event must share venue_id.
create or replace function public.validate_event_floor_plan_offer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_venue uuid;
  v_template_venue uuid;
  v_archived boolean;
begin
  select venue_id into v_event_venue from public.events where id = new.event_id;
  if v_event_venue is null then
    raise exception 'event_floor_plan_offers: event not found';
  end if;
  if v_event_venue <> new.venue_id then
    raise exception 'event_floor_plan_offers: venue_id must match event.venue_id';
  end if;

  select venue_id, is_archived into v_template_venue, v_archived
  from public.floor_plan_templates where id = new.floor_plan_template_id;
  if v_template_venue is null then
    raise exception 'event_floor_plan_offers: template not found';
  end if;
  if v_template_venue <> new.venue_id then
    raise exception 'event_floor_plan_offers: template must belong to the same venue';
  end if;
  if v_archived and new.is_offered then
    raise exception 'event_floor_plan_offers: cannot offer an archived template';
  end if;

  return new;
end;
$$;

drop trigger if exists event_floor_plan_offers_validate on public.event_floor_plan_offers;
create trigger event_floor_plan_offers_validate
  before insert or update on public.event_floor_plan_offers
  for each row execute function public.validate_event_floor_plan_offer();

alter table public.event_floor_plan_offers enable row level security;

create policy event_floor_plan_offers_all on public.event_floor_plan_offers
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_floor_plan_offers to authenticated;

-- ── 4. Portal: list offered layouts (chooser; only is_offered) ──────────────
create or replace function public.get_portal_floor_plan_offers(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_selected uuid;
  v_selected_template uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object(
      'offers', '[]'::jsonb,
      'coupleSelectedFloorPlanId', null,
      'coupleSelectedTemplateId', null
    );
  end if;

  select e.couple_selected_floor_plan_id into v_selected
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_selected is not null then
    select fp.source_template_id into v_selected_template
    from public.floor_plans fp
    where fp.id = v_selected
      and fp.event_id = v_ids.event_id
      and fp.venue_id = v_ids.venue_id;
  end if;

  return jsonb_build_object(
    'coupleSelectedFloorPlanId', v_selected,
    'coupleSelectedTemplateId', v_selected_template,
    'offers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'offerId', o.id,
          'templateId', t.id,
          'name', coalesce(nullif(trim(o.couple_label), ''), t.name),
          'blurb', o.couple_blurb,
          'spaceId', t.space_id,
          'sortOrder', o.sort_order,
          'objectCount', (
            select count(*)::int from public.floor_plan_template_objects tobj
            where tobj.template_id = t.id
          ),
          'isCurrentSelection', (
            v_selected_template is not null and t.id = v_selected_template
          ),
          'roomWidthFt', t.room_width_ft,
          'roomDepthFt', t.room_depth_ft
        )
        order by o.sort_order asc, o.created_at asc
      )
      from public.event_floor_plan_offers o
      join public.floor_plan_templates t
        on t.id = o.floor_plan_template_id
       and t.venue_id = o.venue_id
      where o.event_id = v_ids.event_id
        and o.venue_id = v_ids.venue_id
        and o.is_offered = true
        and t.is_archived = false
    ), '[]'::jsonb)
  );
end;
$$;

-- ── 5. Portal: preview an offered template (read-only master snapshot) ──────
create or replace function public.get_portal_floor_plan_offer_preview(
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
  v_selected uuid;
  v_selected_template uuid;
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

  select e.couple_selected_floor_plan_id into v_selected
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_selected is not null then
    select fp.source_template_id into v_selected_template
    from public.floor_plans fp
    where fp.id = v_selected and fp.event_id = v_ids.event_id;
  end if;

  return jsonb_build_object(
    'offer', jsonb_build_object(
      'offerId', v_offer.id,
      'templateId', v_template.id,
      'name', coalesce(nullif(trim(v_offer.couple_label), ''), v_template.name),
      'blurb', v_offer.couple_blurb,
      'isCurrentSelection', (v_selected_template is not null and v_template.id = v_selected_template)
    ),
    'plan', jsonb_build_object(
      'id', v_template.id,
      'name', coalesce(nullif(trim(v_offer.couple_label), ''), v_template.name),
      'spaceId', v_template.space_id,
      'backgroundImageUrl', v_template.background_image_url,
      'backgroundImageOpacity', v_template.background_image_opacity,
      'roomWidthFt', v_template.room_width_ft,
      'roomDepthFt', v_template.room_depth_ft,
      'measurementUnit', v_template.measurement_unit
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
      from public.floor_plan_template_objects o
      where o.template_id = v_template.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ── 6. Portal: select an offered layout (clone-or-reuse; no share/op) ───────
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
      false,
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

  update public.events
  set couple_selected_floor_plan_id = v_plan_id
  where id = v_ids.event_id
    and venue_id = v_ids.venue_id;

  -- Intentionally do NOT touch shared_with_couple or operational_floor_plan_id.

  return jsonb_build_object(
    'ok', true,
    'floorPlanId', v_plan_id,
    'templateId', v_template.id,
    'offerId', v_offer.id
  );
end;
$$;

grant execute on function public.get_portal_floor_plan_offers(text) to anon, authenticated;
grant execute on function public.get_portal_floor_plan_offer_preview(text, uuid) to anon, authenticated;
grant execute on function public.select_portal_floor_plan_offer(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
