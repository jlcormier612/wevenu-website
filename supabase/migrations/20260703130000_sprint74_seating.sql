-- ============================================================================
-- Sprint 74 — Seating & Floor Plans
-- Powered by Sprint 73 RSVP data. No duplicate entry — attending status,
-- households, meal choices, and dietary restrictions flow directly in.
-- ============================================================================

-- Seating arrangement (one per event, auto-created on first access) ----------
create table public.couple_seating_arrangements (
  id            uuid    primary key default gen_random_uuid(),
  event_id      uuid    not null references public.events(id) on delete cascade,
  name          text    not null default 'Reception Seating',
  canvas_width  integer not null default 1200,
  canvas_height integer not null default 800,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(event_id)
);

-- Tables within a floor plan -------------------------------------------------
create table public.seating_tables (
  id             uuid    primary key default gen_random_uuid(),
  arrangement_id uuid    not null references public.couple_seating_arrangements(id) on delete cascade,
  table_type     text    not null default 'round'
                   check (table_type in ('round','rectangular','head','sweetheart','cocktail')),
  name           text    not null,
  capacity       integer not null default 8 check (capacity between 1 and 100),
  position_x     numeric not null default 100,
  position_y     numeric not null default 100,
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Guest-to-table assignments -------------------------------------------------
create table public.guest_seat_assignments (
  id          uuid    primary key default gen_random_uuid(),
  table_id    uuid    not null references public.seating_tables(id) on delete cascade,
  guest_id    uuid    not null references public.couple_guests(id) on delete cascade,
  seat_number integer,
  assigned_at timestamptz not null default now(),
  unique(guest_id)  -- each guest sits at exactly one table
);

create index on public.seating_tables(arrangement_id);
create index on public.guest_seat_assignments(table_id);
create index on public.guest_seat_assignments(guest_id);

-- RLS ------------------------------------------------------------------------
alter table public.couple_seating_arrangements enable row level security;
alter table public.seating_tables              enable row level security;
alter table public.guest_seat_assignments      enable row level security;

create policy "venue_rw_seating_arrangements" on public.couple_seating_arrangements
  for all using (
    event_id in (
      select e.id from public.events e
      join public.venue_users vu on vu.venue_id = e.venue_id
      where vu.user_id = auth.uid() and vu.is_active
    )
  );

create policy "venue_rw_seating_tables" on public.seating_tables
  for all using (
    arrangement_id in (
      select csa.id from public.couple_seating_arrangements csa
      join public.events e on csa.event_id = e.id
      join public.venue_users vu on vu.venue_id = e.venue_id
      where vu.user_id = auth.uid() and vu.is_active
    )
  );

create policy "venue_rw_seat_assignments" on public.guest_seat_assignments
  for all using (
    table_id in (
      select st.id from public.seating_tables st
      join public.couple_seating_arrangements csa on st.arrangement_id = csa.id
      join public.events e on csa.event_id = e.id
      join public.venue_users vu on vu.venue_id = e.venue_id
      where vu.user_id = auth.uid() and vu.is_active
    )
  );

-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- get_seating_data -----------------------------------------------------------
create or replace function public.get_seating_data(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids    record;
  v_arr_id uuid;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.event_id is null then return null; end if;

  -- Auto-create arrangement on first access
  insert into couple_seating_arrangements(event_id)
  values (v_ids.event_id)
  on conflict (event_id) do nothing;

  select id into v_arr_id
  from couple_seating_arrangements where event_id = v_ids.event_id;

  return jsonb_build_object(
    'arrangement', (
      select jsonb_build_object(
        'id', id, 'name', name,
        'canvasWidth', canvas_width, 'canvasHeight', canvas_height
      )
      from couple_seating_arrangements where id = v_arr_id
    ),
    'tables', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',           st.id,
          'tableType',    st.table_type,
          'name',         st.name,
          'capacity',     st.capacity,
          'positionX',    st.position_x,
          'positionY',    st.position_y,
          'displayOrder', st.display_order,
          'guests', coalesce((
            select jsonb_agg(jsonb_build_object(
              'guestId',            gsa.guest_id,
              'name',               cg.full_name,
              'mealChoice',         cg.meal_choice,
              'dietaryRestrictions',cg.dietary_restrictions,
              'isChild',            cg.is_child,
              'householdId',        cg.household_id,
              'plusOneOf',          cg.plus_one_of
            ) order by cg.full_name)
            from guest_seat_assignments gsa
            join couple_guests cg on gsa.guest_id = cg.id
            where gsa.table_id = st.id
          ), '[]'::jsonb)
        ) order by st.display_order, st.created_at
      )
      from seating_tables st where st.arrangement_id = v_arr_id
    ), '[]'::jsonb),
    'unassignedGuests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                 cg.id,
        'name',               cg.full_name,
        'mealChoice',         cg.meal_choice,
        'dietaryRestrictions',cg.dietary_restrictions,
        'isChild',            cg.is_child,
        'householdId',        cg.household_id,
        'plusOneOf',          cg.plus_one_of
      ) order by cg.full_name)
      from couple_guests cg
      where cg.client_id = v_ids.client_id
        and cg.rsvp_status = 'attending'
        and not exists (
          select 1 from guest_seat_assignments gsa
          join seating_tables st on gsa.table_id = st.id
          where gsa.guest_id = cg.id and st.arrangement_id = v_arr_id
        )
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'totalAttending', (
        select count(*) from couple_guests
        where client_id = v_ids.client_id and rsvp_status = 'attending'
      ),
      'totalAssigned', (
        select count(*) from guest_seat_assignments gsa
        join seating_tables st on gsa.table_id = st.id
        where st.arrangement_id = v_arr_id
      ),
      'tableCount', (select count(*) from seating_tables where arrangement_id = v_arr_id),
      'totalCapacity', (select coalesce(sum(capacity),0) from seating_tables where arrangement_id = v_arr_id)
    )
  );
end;
$$;

-- upsert_seating_table -------------------------------------------------------
create or replace function public.upsert_seating_table(
  p_token         text,
  p_table_id      uuid     default null,
  p_table_type    text     default 'round',
  p_name          text     default null,
  p_capacity      integer  default 8,
  p_position_x    numeric  default 100,
  p_position_y    numeric  default 100,
  p_display_order integer  default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_ids    record;
  v_arr_id uuid;
  v_count  integer;
  v_out_id uuid;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.event_id is null then return null; end if;

  insert into couple_seating_arrangements(event_id) values (v_ids.event_id)
  on conflict (event_id) do nothing;
  select id into v_arr_id from couple_seating_arrangements where event_id = v_ids.event_id;

  if p_name is null then
    select count(*) + 1 into v_count from seating_tables where arrangement_id = v_arr_id;
    p_name := case p_table_type
      when 'head'       then 'Head Table'
      when 'sweetheart' then 'Sweetheart Table'
      when 'cocktail'   then 'Cocktail ' || v_count
      else 'Table ' || v_count
    end;
  end if;

  if p_table_id is not null then
    update seating_tables set
      table_type    = p_table_type,
      name          = p_name,
      capacity      = p_capacity,
      position_x    = p_position_x,
      position_y    = p_position_y,
      display_order = p_display_order,
      updated_at    = now()
    where id = p_table_id and arrangement_id = v_arr_id
    returning id into v_out_id;
  end if;

  if v_out_id is null then
    insert into seating_tables(
      arrangement_id, table_type, name, capacity, position_x, position_y, display_order
    ) values (
      v_arr_id, p_table_type, p_name, p_capacity, p_position_x, p_position_y, p_display_order
    ) returning id into v_out_id;
  end if;

  return v_out_id;
end;
$$;

-- delete_seating_table -------------------------------------------------------
create or replace function public.delete_seating_table(p_token text, p_table_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ids    record;
  v_arr_id uuid;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  select id into v_arr_id from couple_seating_arrangements where event_id = v_ids.event_id;
  delete from seating_tables where id = p_table_id and arrangement_id = v_arr_id;
  return found;
end;
$$;

-- assign_guest_to_table ------------------------------------------------------
create or replace function public.assign_guest_to_table(
  p_token    text,
  p_guest_id uuid,
  p_table_id uuid
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ids    record;
  v_arr_id uuid;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  select id into v_arr_id from couple_seating_arrangements where event_id = v_ids.event_id;

  if not exists (select 1 from couple_guests where id = p_guest_id and client_id = v_ids.client_id) then
    return false;
  end if;
  if not exists (select 1 from seating_tables where id = p_table_id and arrangement_id = v_arr_id) then
    return false;
  end if;

  insert into guest_seat_assignments(table_id, guest_id)
  values (p_table_id, p_guest_id)
  on conflict (guest_id) do update set
    table_id    = excluded.table_id,
    assigned_at = now();

  return true;
end;
$$;

-- remove_guest_assignment ----------------------------------------------------
create or replace function public.remove_guest_assignment(p_token text, p_guest_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null then return false; end if;
  if not exists (select 1 from couple_guests where id = p_guest_id and client_id = v_ids.client_id) then
    return false;
  end if;
  delete from guest_seat_assignments where guest_id = p_guest_id;
  return found;
end;
$$;

-- get_seating_suggestions: household groupings for auto-assign client logic --
create or replace function public.get_seating_suggestions(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null then return null; end if;

  return jsonb_build_object(
    'households', coalesce((
      select jsonb_agg(jsonb_build_object(
        'householdKey', h.household_key,
        'guestIds',     h.guest_ids,
        'names',        h.names,
        'size',         h.size
      ))
      from (
        select
          coalesce(household_id::text, id::text)             as household_key,
          array_agg(id::text
            order by (plus_one_of is null) desc, is_child, full_name) as guest_ids,
          array_agg(full_name
            order by (plus_one_of is null) desc, is_child, full_name) as names,
          count(*)::int                                       as size
        from couple_guests
        where client_id = v_ids.client_id and rsvp_status = 'attending'
        group by coalesce(household_id::text, id::text)
        order by count(*) desc
      ) h
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
