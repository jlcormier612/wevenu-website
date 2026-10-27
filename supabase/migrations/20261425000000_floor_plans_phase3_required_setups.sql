-- ============================================================================
-- Floor Plans Phase 3 — required setups + setup-scoped alternatives
--
-- Contract (v1.5 / C9):
-- * Required setups coexist as parts of one wedding plan.
-- * Alternatives are competing options within one setup only.
-- * Setup identity is explicit (venue-named) — never inferred from layout/room/template names.
-- * Zero setups ⇒ legacy Phase 1/2 event-level path remains source of truth.
-- * Detach removes membership only; never deletes layouts or seating.
-- * Preference select on a setup is preference-only (pending); does not set share/operational/seating.
-- ============================================================================

-- ── 1. Required setups ──────────────────────────────────────────────────────
create table if not exists public.event_floor_plan_setups (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  couple_selected_floor_plan_id uuid references public.floor_plans (id) on delete set null,
  couple_preference_status text,
  couple_approved_floor_plan_id uuid references public.floor_plans (id) on delete set null,
  operational_floor_plan_id uuid references public.floor_plans (id) on delete set null,
  seating_in_use_floor_plan_id uuid references public.floor_plans (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_floor_plan_setups_name_nonempty check (length(trim(name)) > 0),
  constraint event_floor_plan_setups_preference_status_check check (
    couple_preference_status is null
    or couple_preference_status in (
      'pending', 'approved', 'declined', 'deferred', 'withdrawn', 'superseded'
    )
  )
);

create index if not exists event_floor_plan_setups_event
  on public.event_floor_plan_setups (event_id, sort_order);

create index if not exists event_floor_plan_setups_venue
  on public.event_floor_plan_setups (venue_id);

create trigger event_floor_plan_setups_updated_at
  before update on public.event_floor_plan_setups
  for each row execute function public.set_updated_at();

comment on table public.event_floor_plan_setups is
  'Phase 3: explicit required setups for an event (e.g. Ceremony, Reception). Name is venue-authored; never inferred.';

-- Venue / event integrity + preference pointers must be same-event members.
create or replace function public.validate_event_floor_plan_setup()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_venue uuid;
begin
  select venue_id into v_event_venue from public.events where id = new.event_id;
  if v_event_venue is null then
    raise exception 'event_floor_plan_setups: event not found';
  end if;
  if v_event_venue <> new.venue_id then
    raise exception 'event_floor_plan_setups: venue_id must match event.venue_id';
  end if;

  if new.couple_selected_floor_plan_id is not null then
    if not exists (
      select 1 from public.floor_plans fp
      where fp.id = new.couple_selected_floor_plan_id
        and fp.event_id = new.event_id
        and fp.venue_id = new.venue_id
    ) then
      raise exception 'couple_selected_floor_plan_id must reference a floor plan on the same event';
    end if;
  end if;
  if new.couple_approved_floor_plan_id is not null then
    if not exists (
      select 1 from public.floor_plans fp
      where fp.id = new.couple_approved_floor_plan_id
        and fp.event_id = new.event_id
        and fp.venue_id = new.venue_id
    ) then
      raise exception 'couple_approved_floor_plan_id must reference a floor plan on the same event';
    end if;
  end if;
  if new.operational_floor_plan_id is not null then
    if not exists (
      select 1 from public.floor_plans fp
      where fp.id = new.operational_floor_plan_id
        and fp.event_id = new.event_id
        and fp.venue_id = new.venue_id
    ) then
      raise exception 'operational_floor_plan_id must reference a floor plan on the same event';
    end if;
  end if;
  if new.seating_in_use_floor_plan_id is not null then
    if not exists (
      select 1 from public.floor_plans fp
      where fp.id = new.seating_in_use_floor_plan_id
        and fp.event_id = new.event_id
        and fp.venue_id = new.venue_id
    ) then
      raise exception 'seating_in_use_floor_plan_id must reference a floor plan on the same event';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists event_floor_plan_setups_validate on public.event_floor_plan_setups;
create trigger event_floor_plan_setups_validate
  before insert or update on public.event_floor_plan_setups
  for each row execute function public.validate_event_floor_plan_setup();

alter table public.event_floor_plan_setups enable row level security;

drop policy if exists event_floor_plan_setups_all on public.event_floor_plan_setups;
create policy event_floor_plan_setups_all on public.event_floor_plan_setups
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_floor_plan_setups to authenticated;

-- ── 2. Setup members (layout associations / alternatives) ───────────────────
create table if not exists public.event_floor_plan_setup_members (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  setup_id uuid not null references public.event_floor_plan_setups (id) on delete cascade,
  floor_plan_id uuid not null references public.floor_plans (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (setup_id, floor_plan_id),
  unique (floor_plan_id)
);

create index if not exists event_floor_plan_setup_members_setup
  on public.event_floor_plan_setup_members (setup_id, sort_order);

create trigger event_floor_plan_setup_members_updated_at
  before update on public.event_floor_plan_setup_members
  for each row execute function public.set_updated_at();

comment on table public.event_floor_plan_setup_members is
  'Phase 3: layouts belonging to one required setup. Unique(floor_plan_id) ⇒ a layout belongs to at most one setup. Detach deletes this row only.';

create or replace function public.validate_event_floor_plan_setup_member()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_setup record;
  v_plan record;
begin
  select s.venue_id, s.event_id into v_setup
  from public.event_floor_plan_setups s
  where s.id = new.setup_id;
  if v_setup.event_id is null then
    raise exception 'event_floor_plan_setup_members: setup not found';
  end if;
  if v_setup.venue_id <> new.venue_id then
    raise exception 'event_floor_plan_setup_members: venue_id must match setup.venue_id';
  end if;

  select fp.venue_id, fp.event_id into v_plan
  from public.floor_plans fp
  where fp.id = new.floor_plan_id;
  if v_plan.event_id is null then
    raise exception 'event_floor_plan_setup_members: floor plan not found';
  end if;
  if v_plan.venue_id <> new.venue_id or v_plan.event_id <> v_setup.event_id then
    raise exception 'event_floor_plan_setup_members: floor plan must belong to the same event and venue';
  end if;

  return new;
end;
$$;

drop trigger if exists event_floor_plan_setup_members_validate on public.event_floor_plan_setup_members;
create trigger event_floor_plan_setup_members_validate
  before insert or update on public.event_floor_plan_setup_members
  for each row execute function public.validate_event_floor_plan_setup_member();

alter table public.event_floor_plan_setup_members enable row level security;

drop policy if exists event_floor_plan_setup_members_all on public.event_floor_plan_setup_members;
create policy event_floor_plan_setup_members_all on public.event_floor_plan_setup_members
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_floor_plan_setup_members to authenticated;

-- ── 3. Portal: package view of required setups ──────────────────────────────
create or replace function public.get_portal_floor_plan_setups(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('setups', '[]'::jsonb, 'hasSetups', false);
  end if;

  return jsonb_build_object(
    'hasSetups', exists (
      select 1 from public.event_floor_plan_setups s
      where s.event_id = v_ids.event_id and s.venue_id = v_ids.venue_id
    ),
    'setups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'setupId', s.id,
          'name', s.name,
          'sortOrder', s.sort_order,
          'coupleSelectedFloorPlanId', s.couple_selected_floor_plan_id,
          'couplePreferenceStatus', s.couple_preference_status,
          'coupleApprovedFloorPlanId', s.couple_approved_floor_plan_id,
          'operationalFloorPlanId', s.operational_floor_plan_id,
          'layouts', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'floorPlanId', fp.id,
                'name', fp.name,
                'sortOrder', m.sort_order,
                'sharedWithCouple', fp.shared_with_couple,
                'isPreference', s.couple_selected_floor_plan_id = fp.id,
                'isApproved', s.couple_approved_floor_plan_id = fp.id,
                'isWorking', s.operational_floor_plan_id = fp.id
              )
              order by m.sort_order asc, m.created_at asc
            )
            from public.event_floor_plan_setup_members m
            join public.floor_plans fp
              on fp.id = m.floor_plan_id
             and fp.venue_id = m.venue_id
            where m.setup_id = s.id
              and m.venue_id = s.venue_id
              and fp.shared_with_couple = true
          ), '[]'::jsonb)
        )
        order by s.sort_order asc, s.created_at asc
      )
      from public.event_floor_plan_setups s
      where s.event_id = v_ids.event_id
        and s.venue_id = v_ids.venue_id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.get_portal_floor_plan_setups(text) is
  'Phase 3: couple package view — required setups with shared layouts nested under each setup.';

grant execute on function public.get_portal_floor_plan_setups(text) to anon, authenticated;

-- ── 4. Portal: preference within one setup only ─────────────────────────────
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

  -- Preference only for this setup. Does not touch other setups or event-level
  -- operational / share / seating columns.
  update public.event_floor_plan_setups
  set
    couple_selected_floor_plan_id = p_floor_plan_id,
    couple_preference_status = case
      when couple_approved_floor_plan_id is not null
        and couple_approved_floor_plan_id is distinct from p_floor_plan_id
        then 'superseded'
      else 'pending'
    end,
    updated_at = now()
  where id = p_setup_id
    and venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'ok', true,
    'setupId', p_setup_id,
    'floorPlanId', p_floor_plan_id,
    'couplePreferenceStatus', (
      select couple_preference_status from public.event_floor_plan_setups where id = p_setup_id
    )
  );
end;
$$;

comment on function public.select_portal_setup_floor_plan_preference(text, uuid, uuid) is
  'Phase 3: couple preference within one setup only. Does not set operational, share, or seating. Does not mutate other setups.';

grant execute on function public.select_portal_setup_floor_plan_preference(text, uuid, uuid) to anon, authenticated;

-- No destructive backfill: existing events keep zero setups and Phase 1/2 event-level SoT.
