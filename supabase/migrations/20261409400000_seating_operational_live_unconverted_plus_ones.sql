-- Seating D3: Event Day Seating must surface live unconverted named plus-ones.
--
-- get_operational_seating_plan returns the latest submitted snapshot when the
-- venue is not actively assisting. That snapshot is immutable for seating
-- layout. Overlay the live guest-list count of attending guests who still
-- have a typed plus_one_name so day-of operators see the same caveat Couple
-- and Assist already show — without making those +1s seatable or mutating
-- assignment integrity.

create or replace function public.get_operational_seating_plan(p_event_id uuid, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id uuid := current_user_venue_id();
  v_client_id uuid;
  v_delegation record;
  v_latest record;
  v_result jsonb;
  v_unconverted int;
begin
  if v_venue_id is null or not public.seating_role_can_view() then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  select client_id into v_client_id from public.events where id = p_event_id and venue_id = v_venue_id;
  if v_client_id is null then return jsonb_build_object('error', 'event_not_found'); end if;

  if not exists (
    select 1 from public.floor_plans where id = p_floor_plan_id and event_id = p_event_id and venue_id = v_venue_id
  ) then
    return jsonb_build_object('error', 'floor_plan_not_found');
  end if;

  select count(*)::int into v_unconverted
  from public.couple_guests g
  where g.client_id = v_client_id
    and g.venue_id = v_venue_id
    and g.rsvp_status = 'attending'
    and g.plus_one_name is not null;

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = p_floor_plan_id and revoked_at is null;

  if v_delegation.id is not null then
    return public._build_seating_json(v_client_id, v_venue_id, p_floor_plan_id)
      || jsonb_build_object(
        'isDelegated', true,
        'delegationId', v_delegation.id,
        'delegatedAt', v_delegation.granted_at,
        'delegatedNote', v_delegation.note
      );
  end if;

  select * into v_latest from public.seating_submissions
  where floor_plan_id = p_floor_plan_id
  order by created_at desc limit 1;

  if v_latest.id is null then
    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb, 'needsReassignment', '[]'::jsonb,
      'stats', jsonb_build_object(
        'totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0,
        'unconvertedPlusOnes', v_unconverted
      ),
      'isDelegated', false, 'notYetSubmitted', true
    );
  end if;

  v_result := v_latest.snapshot || jsonb_build_object(
    'isDelegated', false, 'notYetSubmitted', false,
    'submittedAt', v_latest.created_at, 'submittedBy', v_latest.submitted_by
  );

  -- Live operational caveat only — does not rewrite seating layout/assignments.
  if v_result ? 'stats' then
    v_result := jsonb_set(v_result, '{stats,unconvertedPlusOnes}', to_jsonb(v_unconverted), true);
  else
    v_result := v_result || jsonb_build_object(
      'stats', jsonb_build_object('unconvertedPlusOnes', v_unconverted)
    );
  end if;

  return v_result;
end;
$$;

grant execute on function public.get_operational_seating_plan(uuid, uuid) to authenticated;
