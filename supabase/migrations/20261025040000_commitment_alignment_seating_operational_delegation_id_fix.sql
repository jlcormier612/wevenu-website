-- ============================================================================
-- Corrective migration — get_operational_seating_plan's delegated branch
-- returned isDelegated/delegatedAt/delegatedNote but never the delegation's
-- own id, leaving the venue's "revoke" action (which the couple can also
-- do, per Delegation being revocable by either party) with nothing to call
-- revoke_seating_delegation_as_venue(p_delegation_id) with.
-- ============================================================================

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
begin
  if v_venue_id is null then return jsonb_build_object('error', 'not_authorized'); end if;

  select client_id into v_client_id from public.events where id = p_event_id and venue_id = v_venue_id;
  if v_client_id is null then return jsonb_build_object('error', 'event_not_found'); end if;

  if not exists (select 1 from public.floor_plans where id = p_floor_plan_id and event_id = p_event_id) then
    return jsonb_build_object('error', 'floor_plan_not_found');
  end if;

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = p_floor_plan_id and revoked_at is null;

  if v_delegation.id is not null then
    return public._build_seating_json(v_client_id, v_venue_id, p_floor_plan_id)
      || jsonb_build_object('isDelegated', true, 'delegationId', v_delegation.id,
                             'delegatedAt', v_delegation.granted_at, 'delegatedNote', v_delegation.note);
  end if;

  select * into v_latest from public.seating_submissions
  where floor_plan_id = p_floor_plan_id
  order by created_at desc limit 1;

  if v_latest.id is null then
    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb, 'needsReassignment', '[]'::jsonb,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0),
      'isDelegated', false, 'notYetSubmitted', true
    );
  end if;

  return v_latest.snapshot || jsonb_build_object(
    'isDelegated', false, 'notYetSubmitted', false,
    'submittedAt', v_latest.created_at, 'submittedBy', v_latest.submitted_by
  );
end;
$$;
