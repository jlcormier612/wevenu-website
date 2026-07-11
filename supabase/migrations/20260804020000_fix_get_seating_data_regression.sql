-- ============================================================================
-- Fix: get_seating_data() regressed at some point after its original
-- implementation (20260703130000_sprint74_seating.sql) — the version
-- currently live is missing `unassignedGuests` and `stats` entirely, and
-- `tables[].guests` only returns {id, seatNumber} instead of full guest
-- detail. The frontend (components/portal/seating-section.tsx) has always
-- expected the complete shape, so every real load crashes with "Cannot read
-- properties of undefined (reading 'length')" the moment it touches
-- data.unassignedGuests or data.stats.
--
-- Root cause of the regression: couple_guests used to have a `full_name`
-- column and a `plus_one_of` guest-linking FK (both referenced by the
-- original RPC above); the table has since been refactored to
-- `first_name`/`last_name` and a `plus_one`/`plus_one_name` boolean+text
-- pair instead of a real linkable plus-one row. Whoever added the
-- access_level check (20260717200000_tr_g4_portal_access_level_enforcement.sql)
-- appears to have patched the function without the (by-then-broken)
-- unassignedGuests/stats blocks, rather than fixing them — so this restores
-- them using the current column names. `plusOneOf` is set to null
-- throughout: there is no real guest-to-guest link left for a plus-one to
-- reference (a plus-one is just a name + boolean on the primary guest's own
-- row), so a plus-one cannot currently be represented as its own seatable
-- guest. That's a real, separate gap, not fixed here.
-- ============================================================================

create or replace function public.get_seating_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ids    record;
  v_arr_id uuid;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.event_id is null then return null; end if;
  if v_ids.access_level = 'financial' then return jsonb_build_object('arrangement', null, 'tables', '[]'::jsonb); end if;

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
              'guestId',             gsa.guest_id,
              'name',                trim(cg.first_name || ' ' || coalesce(cg.last_name, '')),
              'mealChoice',          cg.meal_choice,
              'dietaryRestrictions', cg.dietary_restrictions,
              'isChild',             cg.is_child,
              'householdId',         cg.household_id,
              'plusOneOf',           null,
              'seatNumber',          gsa.seat_number
            ) order by gsa.seat_number nulls last)
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
        'id',                  cg.id,
        'name',                trim(cg.first_name || ' ' || coalesce(cg.last_name, '')),
        'mealChoice',          cg.meal_choice,
        'dietaryRestrictions', cg.dietary_restrictions,
        'isChild',             cg.is_child,
        'householdId',         cg.household_id,
        'plusOneOf',           null
      ) order by cg.sort_order, cg.first_name, cg.last_name)
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
$function$;

notify pgrst, 'reload schema';
