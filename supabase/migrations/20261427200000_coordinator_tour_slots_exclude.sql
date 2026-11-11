-- ============================================================================
-- HTC Tours 2D-B2 — coordinator slot picker self-exclusion
--
-- Reschedule availability must exclude the appointment being moved so its
-- current time remains selectable when otherwise valid. Schedule and Settings
-- continue to call without an exclude id (default null).
--
-- Compatibility: PostgreSQL treats (date, date) and (date, date, uuid) as
-- distinct signatures. CREATE OR REPLACE of the three-argument form would
-- leave the two-argument overload in place and risk PostgREST ambiguity.
-- Drop the two-argument form, then create a single three-argument function
-- with a defaulted exclude parameter. Named two-argument RPC bodies still
-- resolve via the default.
-- ============================================================================

drop function if exists public.get_coordinator_tour_slots(date, date);

create or replace function public.get_coordinator_tour_slots(
  p_start_date               date,
  p_end_date                 date,
  p_exclude_appointment_id   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  return public._generate_tour_slots(
    v_venue_id,
    p_start_date,
    p_end_date,
    p_exclude_appointment_id
  );
end;
$$;

comment on function public.get_coordinator_tour_slots(date, date, uuid) is
  'Staff Tour availability for the active venue. Optional p_exclude_appointment_id skips that row in occupancy (reschedule self).';

grant execute on function public.get_coordinator_tour_slots(date, date, uuid)
  to authenticated;

notify pgrst, 'reload schema';
