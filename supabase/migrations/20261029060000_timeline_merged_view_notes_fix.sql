-- ============================================================================
-- Corrective migration — get_event_timeline_merged's venue-owned block
-- omitted `notes` (the venue-internal annotation field), which the
-- coordinator editor's entry form has always exposed. Client-submitted
-- items correctly have no notes field (never had one). Found before any
-- report or live validation.
-- ============================================================================

create or replace function public.get_event_timeline_merged(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id      uuid;
  v_snapshot      jsonb;
  v_submitted_at  timestamptz;
begin
  select venue_id into v_venue_id from public.events where id = p_event_id;
  if v_venue_id is null or v_venue_id is distinct from public.current_user_venue_id() then
    return jsonb_build_object('error', 'not_found');
  end if;

  select snapshot, created_at into v_snapshot, v_submitted_at
  from public.timeline_submissions
  where event_id = p_event_id and venue_id = v_venue_id
  order by created_at desc limit 1;

  return jsonb_build_object(
    'lastSubmittedAt', v_submitted_at,
    'entries',
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', te.id, 'title', te.title, 'description', te.description, 'notes', te.notes,
            'entryTime', te.entry_time, 'sectionId', te.section_id, 'sortOrder', te.sort_order,
            'owner', te.owner, 'lockState', te.lock_state, 'audiences', te.audiences,
            'status', te.status, 'assignedToStaffId', te.assigned_to_staff_id, 'assignedToName', vs.full_name,
            'createdAt', te.created_at, 'updatedAt', te.updated_at
          ) order by te.entry_time asc nulls last, te.sort_order, te.created_at
        ), '[]'::jsonb)
        from public.timeline_entries te
        left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
        where te.event_id = p_event_id and te.venue_id = v_venue_id and te.owner = 'venue'
      )
      ||
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', (item->>'id')::uuid, 'title', item->>'title', 'description', item->>'description', 'notes', null,
            'entryTime', item->>'entryTime', 'sectionId', nullif(item->>'sectionId', ''), 'sortOrder', (item->>'sortOrder')::int,
            'owner', 'client', 'lockState', 'editable',
            'audiences', coalesce(item->'audiences', '[]'::jsonb),
            'status', coalesce(te.status, 'not_started'),
            'assignedToStaffId', te.assigned_to_staff_id, 'assignedToName', vs.full_name,
            'createdAt', te.created_at, 'updatedAt', te.updated_at
          ) order by (item->>'entryTime') asc nulls last, (item->>'sortOrder')::int
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(v_snapshot, '[]'::jsonb)) item
        left join public.timeline_entries te on te.id = (item->>'id')::uuid
        left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
      )
  );
end;
$$;
