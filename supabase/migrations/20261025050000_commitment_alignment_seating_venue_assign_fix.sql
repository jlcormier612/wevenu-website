-- ============================================================================
-- Corrective migration — assign_guest_to_table_as_venue referenced
-- couple_guests.event_id, a column that doesn't exist (couple_guests is
-- scoped by client_id/venue_id, matching every other seating query in
-- this codebase, not event_id). Caught live: every call errored with
-- "column g.event_id does not exist". Fixed to resolve the guest's client
-- via the floor plan's own event, matching _build_seating_json's pattern.
-- ============================================================================

create or replace function public.assign_guest_to_table_as_venue(p_floor_plan_id uuid, p_guest_id uuid, p_table_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid := current_user_venue_id();
  v_client_id uuid;
begin
  if v_venue_id is null then return false; end if;
  if not exists (
    select 1 from public.seating_delegations where floor_plan_id = p_floor_plan_id and venue_id = v_venue_id and revoked_at is null
  ) then
    return false;
  end if;

  select e.client_id into v_client_id
  from public.floor_plans fp join public.events e on e.id = fp.event_id
  where fp.id = p_floor_plan_id and fp.venue_id = v_venue_id;
  if v_client_id is null then return false; end if;

  if not exists (
    select 1 from public.couple_guests g where g.id = p_guest_id and g.client_id = v_client_id and g.venue_id = v_venue_id
  ) then
    return false;
  end if;

  if not exists (
    select 1 from public.floor_plan_objects o
    where o.id = p_table_id and o.floor_plan_id = p_floor_plan_id
      and o.object_type in ('table_round', 'table_rect', 'table_oval')
  ) then
    return false;
  end if;

  insert into public.guest_seat_assignments (guest_id, floor_plan_id, table_object_id)
  values (p_guest_id, p_floor_plan_id, p_table_id)
  on conflict (guest_id, floor_plan_id) do update
    set table_object_id = excluded.table_object_id, assigned_at = now();

  return true;
end;
$$;
