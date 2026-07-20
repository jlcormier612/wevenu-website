-- ============================================================================
-- Corrective migration — get_seating_data returned isDelegated/delegatedNote
-- but never the delegation's own id, leaving the couple's "Revoke" action
-- with nothing to call revoke_seating_delegation(p_delegation_id) with.
-- ============================================================================

create or replace function public.get_seating_data(p_token text, p_floor_plan_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids        record;
  v_floor_plan_id uuid;
  v_result     jsonb;
  v_delegation record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('error', 'invalid_token'); end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false, 'isDelegated', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0));
  end if;

  if p_floor_plan_id is not null then
    select fp.id into v_floor_plan_id from public.floor_plans fp
    where fp.id = p_floor_plan_id and fp.event_id = v_ids.event_id and fp.client_access != 'hidden';
  else
    select fp.id into v_floor_plan_id from public.floor_plans fp
    where fp.event_id = v_ids.event_id and fp.client_access != 'hidden'
    order by fp.updated_at desc limit 1;
  end if;

  if v_floor_plan_id is null then
    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false, 'isDelegated', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0)
    );
  end if;

  v_result := public._build_seating_json(v_ids.client_id, v_ids.venue_id, v_floor_plan_id);

  select * into v_delegation from public.seating_delegations
  where floor_plan_id = v_floor_plan_id and revoked_at is null;

  return v_result || jsonb_build_object(
    'hadPriorWork', true,
    'isDelegated', v_delegation.id is not null,
    'delegationId', v_delegation.id,
    'delegatedNote', v_delegation.note
  );
end;
$$;
