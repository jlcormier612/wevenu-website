-- Floor Plans complete workflow (product correction, not a rebuild).
--
-- 1) Couple offer selection establishes the working layout (share + operational).
--    No Approve / Decline / Defer ceremony for ordinary selection.
-- 2) After a physical arrangement is approved, selecting another offer proposes
--    a replacement — operational stays until venue accepts.
-- 3) Approved arrangements are snapshotted (revision history).
-- 4) Mark Ready locks staff physical object edits; Make Changes reopens.
-- 5) Seating RPCs unchanged; assignment rows never rewritten by selection.

-- ── A. Preference / selection status vocabulary ─────────────────────────────
alter table public.events drop constraint if exists events_couple_preference_status_check;
alter table public.events
  add constraint events_couple_preference_status_check
  check (
    couple_preference_status is null
    or couple_preference_status in (
      'applied',
      'proposed_replacement',
      'pending',
      'approved',
      'declined',
      'deferred',
      'withdrawn',
      'superseded'
    )
  );

comment on column public.events.couple_preference_status is
  'Layout selection status: applied (working established) | proposed_replacement (post-approval switch pending venue) | legacy pending/approved/declined/deferred/withdrawn/superseded.';

-- Migrate leftover pending selections that already match operational → applied.
update public.events
set couple_preference_status = 'applied'
where couple_preference_status = 'pending'
  and couple_selected_floor_plan_id is not null
  and couple_selected_floor_plan_id = operational_floor_plan_id;

-- Setup-level preference status (wedding packages) — same vocabulary.
alter table public.event_floor_plan_setups drop constraint if exists event_floor_plan_setups_preference_status_check;
alter table public.event_floor_plan_setups
  add constraint event_floor_plan_setups_preference_status_check
  check (
    couple_preference_status is null
    or couple_preference_status in (
      'applied',
      'proposed_replacement',
      'pending',
      'approved',
      'declined',
      'deferred',
      'withdrawn',
      'superseded'
    )
  );

-- ── B. Approved arrangement revisions (minimal snapshot store) ──────────────
create table if not exists public.floor_plan_layout_revisions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  floor_plan_id uuid not null references public.floor_plans(id) on delete cascade,
  revision_number integer not null,
  status text not null default 'approved'
    check (status in ('approved', 'superseded')),
  objects_snapshot jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  unique (floor_plan_id, revision_number)
);

create index if not exists floor_plan_layout_revisions_plan_status_idx
  on public.floor_plan_layout_revisions (floor_plan_id, status);

create index if not exists floor_plan_layout_revisions_event_idx
  on public.floor_plan_layout_revisions (event_id);

comment on table public.floor_plan_layout_revisions is
  'Snapshots of approved physical arrangements. Live objects may diverge after reopen; approved rows preserve what was approved.';

alter table public.floor_plan_layout_revisions enable row level security;

drop policy if exists floor_plan_layout_revisions_select on public.floor_plan_layout_revisions;
create policy floor_plan_layout_revisions_select on public.floor_plan_layout_revisions
  for select using (venue_id = public.current_venue_id());

drop policy if exists floor_plan_layout_revisions_insert on public.floor_plan_layout_revisions;
create policy floor_plan_layout_revisions_insert on public.floor_plan_layout_revisions
  for insert with check (
    venue_id = public.current_venue_id()
    and public.current_user_role() = any (array['owner', 'manager', 'coordinator'])
  );

drop policy if exists floor_plan_layout_revisions_update on public.floor_plan_layout_revisions;
create policy floor_plan_layout_revisions_update on public.floor_plan_layout_revisions
  for update using (
    venue_id = public.current_venue_id()
    and public.current_user_role() = any (array['owner', 'manager', 'coordinator'])
  )
  with check (
    venue_id = public.current_venue_id()
    and public.current_user_role() = any (array['owner', 'manager', 'coordinator'])
  );

-- ── C. select_portal_floor_plan_offer — selection establishes working plan ───
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
  v_event record;
  v_op_status text;
  v_has_approved_rev boolean := false;
  v_current_seats int := 0;
  v_selected_seats int := 0;
  v_seating_case text := 'A';
  v_seating_in_use uuid;
  v_mode text;
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

  -- Reuse earliest clone for this template, or create one.
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

  select
    e.operational_floor_plan_id,
    e.couple_selected_floor_plan_id,
    e.couple_preference_status,
    e.seating_in_use_floor_plan_id,
    e.couple_approved_floor_plan_id
  into v_event
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_event.operational_floor_plan_id is not null then
    select coalesce(fp.client_layout_status, 'working') into v_op_status
    from public.floor_plans fp
    where fp.id = v_event.operational_floor_plan_id
      and fp.event_id = v_ids.event_id;

    select exists (
      select 1 from public.floor_plan_layout_revisions r
      where r.floor_plan_id = v_event.operational_floor_plan_id
        and r.status = 'approved'
    ) into v_has_approved_rev;
  else
    v_op_status := null;
  end if;

  -- Post furniture-approval: different offer → proposed replacement only.
  if v_event.operational_floor_plan_id is not null
     and v_event.operational_floor_plan_id is distinct from v_plan_id
     and (
       coalesce(v_op_status, 'working') = 'approved'
       or v_has_approved_rev
     ) then
    update public.events
    set
      couple_selected_floor_plan_id = v_plan_id,
      couple_preference_status = 'proposed_replacement'
    where id = v_ids.event_id
      and venue_id = v_ids.venue_id;

    -- Ensure the proposed clone is visible so the couple can preview it.
    update public.floor_plans
    set shared_with_couple = true
    where id = v_plan_id
      and venue_id = v_ids.venue_id
      and event_id = v_ids.event_id;

    return jsonb_build_object(
      'ok', true,
      'mode', 'proposed_replacement',
      'floorPlanId', v_plan_id,
      'templateId', v_template.id,
      'offerId', v_offer.id,
      'preferenceStatus', 'proposed_replacement',
      'operationalFloorPlanId', v_event.operational_floor_plan_id,
      'autoAssigned', false
    );
  end if;

  -- Seat counts for Case B/C (never rewrite assignment rows).
  if v_event.operational_floor_plan_id is not null then
    select count(*)::int into v_current_seats
    from public.guest_seat_assignments g
    where g.floor_plan_id = v_event.operational_floor_plan_id;
  end if;

  select count(*)::int into v_selected_seats
  from public.guest_seat_assignments g
  where g.floor_plan_id = v_plan_id;

  if v_event.operational_floor_plan_id is null
     or v_event.operational_floor_plan_id = v_plan_id then
    v_seating_case := 'A';
  elsif v_current_seats > 0 and v_selected_seats > 0 then
    v_seating_case := 'C';
  elsif v_current_seats > 0 and v_selected_seats = 0 then
    v_seating_case := 'B';
  else
    v_seating_case := 'A';
  end if;

  v_seating_in_use := v_event.seating_in_use_floor_plan_id;
  if v_seating_case in ('B', 'C') then
    -- Never silently retarget seating-in-use. Keep current pointer; if unset while
    -- the prior working plan has seats, anchor it there so seats remain findable.
    if v_seating_in_use is null and v_event.operational_floor_plan_id is not null then
      v_seating_in_use := v_event.operational_floor_plan_id;
    end if;
  elsif v_seating_in_use is null and v_selected_seats > 0 then
    v_seating_in_use := v_plan_id;
  end if;

  -- Share selected plan, then set working pointer.
  update public.floor_plans
  set shared_with_couple = true
  where id = v_plan_id
    and venue_id = v_ids.venue_id
    and event_id = v_ids.event_id;

  update public.events
  set
    couple_selected_floor_plan_id = v_plan_id,
    couple_preference_status = 'applied',
    operational_floor_plan_id = v_plan_id,
    seating_in_use_floor_plan_id = v_seating_in_use
  where id = v_ids.event_id
    and venue_id = v_ids.venue_id;

  v_mode := 'establish_working';

  return jsonb_build_object(
    'ok', true,
    'mode', v_mode,
    'floorPlanId', v_plan_id,
    'templateId', v_template.id,
    'offerId', v_offer.id,
    'preferenceStatus', 'applied',
    'operationalFloorPlanId', v_plan_id,
    'seatingInUseFloorPlanId', v_seating_in_use,
    'seatingCase', v_seating_case,
    'needsSeatingResolution', (v_seating_case in ('B', 'C')),
    'autoAssigned', false
  );
end;
$$;

comment on function public.select_portal_floor_plan_offer(text, uuid) is
  'Couple selects an offered layout: establishes working plan + share (applied). After furniture approval, a different offer becomes proposed_replacement without replacing operational. Never rewrites guest_seat_assignments. Case B/C leave seating-in-use for deliberate resolution.';

grant execute on function public.select_portal_floor_plan_offer(text, uuid) to anon, authenticated;

-- ── D. Staff physical edits blocked while Ready (finalized_at) ──────────────
-- Application layer also enforces; this trigger is the DB backstop for objects.
create or replace function public.floor_plan_objects_ready_lock()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_finalized timestamptz;
  v_status text;
  v_plan_id uuid;
begin
  v_plan_id := coalesce(new.floor_plan_id, old.floor_plan_id);
  select fp.finalized_at, coalesce(fp.client_layout_status, 'working')
    into v_finalized, v_status
  from public.floor_plans fp
  where fp.id = v_plan_id;

  if v_finalized is not null then
    raise exception 'Physical layout is Ready. Use Make Changes before editing furniture.';
  end if;

  -- Approved arrangements: live objects must not be silently overwritten.
  -- Venue must reopen (changes_requested) before editing.
  if v_status = 'approved' and tg_op in ('INSERT', 'UPDATE', 'DELETE') then
    -- Allow updates that only touch updated_at via no-op paths? Block all.
    raise exception 'This arrangement is approved. Reopen physical editing before changing furniture.';
  end if;

  if v_status = 'submitted' and tg_op in ('INSERT', 'UPDATE', 'DELETE') then
    -- Couple is locked via portal RPCs; staff may still adjust while reviewing.
    -- Spec: venue reviews submission — staff edits during review are allowed.
    null;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists floor_plan_objects_ready_lock_trg on public.floor_plan_objects;
create trigger floor_plan_objects_ready_lock_trg
  before insert or update or delete on public.floor_plan_objects
  for each row execute function public.floor_plan_objects_ready_lock();

-- ── E. Portal list/detail expose effective seating access (client_access) ────
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
  v_pref_status text;
  v_approved uuid;
  v_seating_in_use uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object(
      'floorPlans', '[]'::jsonb,
      'operationalFloorPlanId', null,
      'coupleSelectedFloorPlanId', null,
      'couplePreferenceStatus', null,
      'coupleApprovedFloorPlanId', null,
      'seatingInUseFloorPlanId', null
    );
  end if;

  select
    e.operational_floor_plan_id,
    e.couple_selected_floor_plan_id,
    e.couple_preference_status,
    e.couple_approved_floor_plan_id,
    e.seating_in_use_floor_plan_id
  into v_operational, v_couple_selected, v_pref_status, v_approved, v_seating_in_use
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_couple_selected is not null and v_pref_status is null then
    v_pref_status := 'applied';
  end if;

  return jsonb_build_object(
    'operationalFloorPlanId', v_operational,
    'coupleSelectedFloorPlanId', v_couple_selected,
    'couplePreferenceStatus', v_pref_status,
    'coupleApprovedFloorPlanId', v_approved,
    'seatingInUseFloorPlanId', v_seating_in_use,
    'floorPlans', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', fp.id,
          'name', fp.name,
          'isOperational', (v_operational is not null and fp.id = v_operational),
          'isCoupleSelected', (v_couple_selected is not null and fp.id = v_couple_selected),
          'isCoupleApproved', (v_approved is not null and fp.id = v_approved),
          'isSeatingInUse', (v_seating_in_use is not null and fp.id = v_seating_in_use),
          'seatingAccess', fp.client_access,
          'seatingEnabled', (coalesce(fp.client_access, 'hidden') = 'view'),
          'isReady', (fp.finalized_at is not null),
          'clientLayoutStatus', coalesce(fp.client_layout_status, 'working'),
          'clientSubmittedAt', fp.client_submitted_at,
          'clientReviewNote', fp.client_review_note,
          'clientReviewedAt', fp.client_reviewed_at,
          'coupleMayAddTables', coalesce(fp.couple_may_add_tables, true),
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

grant execute on function public.get_portal_floor_plans(text) to anon, authenticated;

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
  v_pref_status text;
  v_approved uuid;
  v_seating_in_use uuid;
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
    e.couple_preference_status,
    e.couple_approved_floor_plan_id,
    e.seating_in_use_floor_plan_id,
    e.guest_count,
    e.space_id
  into v_operational, v_couple_selected, v_pref_status, v_approved, v_seating_in_use, v_guest_count, v_space_id
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_couple_selected is not null and v_pref_status is null then
    v_pref_status := 'applied';
  end if;

  v_space_id := coalesce(v_plan.space_id, v_space_id);

  if v_space_id is not null then
    select vs.name, vs.capacity
    into v_space_name, v_space_capacity
    from public.venue_spaces vs
    where vs.id = v_space_id
      and vs.venue_id = v_ids.venue_id;
  end if;

  return jsonb_build_object(
    'couplePreferenceStatus', v_pref_status,
    'coupleApprovedFloorPlanId', v_approved,
    'seatingInUseFloorPlanId', v_seating_in_use,
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'spaceId', v_plan.space_id,
      'isOperational', (v_operational is not null and v_plan.id = v_operational),
      'isCoupleSelected', (v_couple_selected is not null and v_plan.id = v_couple_selected),
      'isCoupleApproved', (v_approved is not null and v_plan.id = v_approved),
      'isSeatingInUse', (v_seating_in_use is not null and v_plan.id = v_seating_in_use),
      'seatingAccess', v_plan.client_access,
      'seatingEnabled', (coalesce(v_plan.client_access, 'hidden') = 'view'),
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
        and o.venue_id = v_ids.venue_id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_portal_floor_plan(text, uuid) to anon, authenticated;

-- ── F. Setup-scoped selection establishes working layout (no preference Approve) ─
create or replace function public.select_portal_setup_floor_plan_preference(
  p_token text,
  p_setup_id uuid,
  p_floor_plan_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_setup public.event_floor_plan_setups%rowtype;
  v_plan public.floor_plans%rowtype;
  v_op_status text;
  v_has_approved_rev boolean := false;
  v_current_seats int := 0;
  v_selected_seats int := 0;
  v_seating_case text := 'A';
  v_seating_in_use uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select * into v_setup
  from public.event_floor_plan_setups s
  where s.id = p_setup_id
    and s.event_id = v_ids.event_id
    and s.venue_id = v_ids.venue_id;
  if v_setup.id is null then
    return jsonb_build_object('error', 'setup_not_found');
  end if;

  if not exists (
    select 1 from public.event_floor_plan_setup_members m
    where m.setup_id = p_setup_id
      and m.floor_plan_id = p_floor_plan_id
      and m.venue_id = v_ids.venue_id
  ) then
    return jsonb_build_object('error', 'not_a_member_of_setup');
  end if;

  select * into v_plan
  from public.floor_plans fp
  where fp.id = p_floor_plan_id
    and fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.shared_with_couple = true;
  if v_plan.id is null then
    return jsonb_build_object('error', 'not_shared_or_not_found');
  end if;

  if v_setup.operational_floor_plan_id is not null then
    select coalesce(fp.client_layout_status, 'working') into v_op_status
    from public.floor_plans fp
    where fp.id = v_setup.operational_floor_plan_id;

    select exists (
      select 1 from public.floor_plan_layout_revisions r
      where r.floor_plan_id = v_setup.operational_floor_plan_id
        and r.status = 'approved'
    ) into v_has_approved_rev;
  end if;

  -- After furniture approval on this setup's working plan: proposed replacement only.
  if v_setup.operational_floor_plan_id is not null
     and v_setup.operational_floor_plan_id is distinct from p_floor_plan_id
     and (
       coalesce(v_op_status, 'working') = 'approved'
       or v_has_approved_rev
     ) then
    update public.event_floor_plan_setups
    set
      couple_selected_floor_plan_id = p_floor_plan_id,
      couple_preference_status = 'proposed_replacement',
      updated_at = now()
    where id = p_setup_id
      and venue_id = v_ids.venue_id;

    return jsonb_build_object(
      'ok', true,
      'mode', 'proposed_replacement',
      'setupId', p_setup_id,
      'floorPlanId', p_floor_plan_id,
      'couplePreferenceStatus', 'proposed_replacement',
      'operationalFloorPlanId', v_setup.operational_floor_plan_id
    );
  end if;

  if v_setup.operational_floor_plan_id is not null then
    select count(*)::int into v_current_seats
    from public.guest_seat_assignments g
    where g.floor_plan_id = v_setup.operational_floor_plan_id;
  end if;
  select count(*)::int into v_selected_seats
  from public.guest_seat_assignments g
  where g.floor_plan_id = p_floor_plan_id;

  if v_setup.operational_floor_plan_id is null
     or v_setup.operational_floor_plan_id = p_floor_plan_id then
    v_seating_case := 'A';
  elsif v_current_seats > 0 and v_selected_seats > 0 then
    v_seating_case := 'C';
  elsif v_current_seats > 0 and v_selected_seats = 0 then
    v_seating_case := 'B';
  else
    v_seating_case := 'A';
  end if;

  v_seating_in_use := v_setup.seating_in_use_floor_plan_id;
  if v_seating_case in ('B', 'C') then
    if v_seating_in_use is null and v_setup.operational_floor_plan_id is not null then
      v_seating_in_use := v_setup.operational_floor_plan_id;
    end if;
  elsif v_seating_in_use is null and v_selected_seats > 0 then
    v_seating_in_use := p_floor_plan_id;
  end if;

  update public.event_floor_plan_setups
  set
    couple_selected_floor_plan_id = p_floor_plan_id,
    couple_preference_status = 'applied',
    operational_floor_plan_id = p_floor_plan_id,
    seating_in_use_floor_plan_id = v_seating_in_use,
    updated_at = now()
  where id = p_setup_id
    and venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'ok', true,
    'mode', 'establish_working',
    'setupId', p_setup_id,
    'floorPlanId', p_floor_plan_id,
    'couplePreferenceStatus', 'applied',
    'operationalFloorPlanId', p_floor_plan_id,
    'seatingInUseFloorPlanId', v_seating_in_use,
    'seatingCase', v_seating_case,
    'needsSeatingResolution', (v_seating_case in ('B', 'C'))
  );
end;
$$;

comment on function public.select_portal_setup_floor_plan_preference(text, uuid, uuid) is
  'Setup-scoped couple selection establishes that setup working layout (applied). After furniture approval, a different member becomes proposed_replacement. Never rewrites guest_seat_assignments or other setups.';

grant execute on function public.select_portal_setup_floor_plan_preference(text, uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
