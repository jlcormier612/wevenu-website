-- ============================================================================
-- Timeline Implementation — the one merged venue-facing view.
--
-- Per your Q1/Q3 answers: the venue's own live entries, unioned with the
-- LATEST SUBMITTED snapshot of the client's entries (frozen content, but
-- live status/assignment — day-of execution tracking was never part of
-- the commitment being submitted). Both the planning-stage coordinator
-- editor and Wedding Day Ops read this exact same function, per your Q3
-- answer ("Wedding Day Operations should execute against the latest
-- committed timeline submitted by the client, not against a live
-- planning draft") — one merge, not two separately-maintained ones.
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
      -- Venue's own items — full live read, always current, always editable
      -- by the venue (subject to their own lock_state).
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', te.id, 'title', te.title, 'description', te.description,
            'entryTime', te.entry_time, 'sectionId', te.section_id, 'sortOrder', te.sort_order,
            'owner', te.owner, 'lockState', te.lock_state, 'audiences', te.audiences,
            'status', te.status, 'assignedToStaffId', te.assigned_to_staff_id, 'assignedToName', vs.full_name
          )
        ), '[]'::jsonb)
        from public.timeline_entries te
        left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
        where te.event_id = p_event_id and te.venue_id = v_venue_id and te.owner = 'venue'
      )
      ||
      -- Client's latest SUBMITTED snapshot — frozen title/time/description,
      -- since anything past that point is unsubmitted private work the
      -- venue was never sent. status/assignedToStaffId are joined back
      -- from the still-live row where it exists (day-of execution
      -- tracking was never part of the submitted commitment itself) and
      -- gracefully degrade to not_started/unassigned if that row is gone.
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', (item->>'id')::uuid, 'title', item->>'title', 'description', item->>'description',
            'entryTime', item->>'entryTime', 'sectionId', nullif(item->>'sectionId', ''), 'sortOrder', (item->>'sortOrder')::int,
            'owner', 'client', 'lockState', 'editable',
            'audiences', coalesce(item->'audiences', '[]'::jsonb),
            'status', coalesce(te.status, 'not_started'),
            'assignedToStaffId', te.assigned_to_staff_id, 'assignedToName', vs.full_name
          )
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(v_snapshot, '[]'::jsonb)) item
        left join public.timeline_entries te on te.id = (item->>'id')::uuid
        left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
      )
  );
end;
$$;

grant execute on function public.get_event_timeline_merged(uuid) to authenticated;

-- ── get_wedding_day_ops — 'timeline' block now delegates to the merged
--    view above instead of its own raw live read (same shape as before:
--    id/title/description/entryTime/sortOrder/status/assignedTo*) ────────
create or replace function public.get_wedding_day_ops(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_venue_id   uuid;
  v_client_id  uuid;
  v_merged     jsonb;
begin
  select venue_id, client_id into v_venue_id, v_client_id
  from public.events
  where id = p_event_id;

  if v_venue_id is null or v_venue_id is distinct from public.current_user_venue_id() then
    return jsonb_build_object('error', 'not_found');
  end if;

  v_merged := public.get_event_timeline_merged(p_event_id);

  return jsonb_build_object(

    'timeline', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',                e->>'id',
          'title',             e->>'title',
          'description',       e->>'description',
          'entryTime',         e->>'entryTime',
          'sortOrder',         (e->>'sortOrder')::int,
          'status',            e->>'status',
          'assignedToStaffId', e->>'assignedToStaffId',
          'assignedToName',    e->>'assignedToName'
        ) order by (e->>'entryTime') asc nulls last, (e->>'sortOrder')::int
      ), '[]'::jsonb)
      from jsonb_array_elements(coalesce(v_merged->'entries', '[]'::jsonb)) e
    ),

    'vendors', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'assignmentId',    eva.id,
          'vendorId',        v.id,
          'vendorName',      v.business_name,
          'category',        v.category,
          'contactName',     v.contact_name,
          'phone',           v.phone,
          'arrivalTime',     eva.arrival_time,
          'notes',           eva.notes,
          'checkedInAt',     eva.checked_in_at,
          'setupCompleteAt', eva.setup_complete_at
        ) order by v.category, v.business_name
      ), '[]'::jsonb)
      from public.event_vendor_assignments eva
      join public.vendors v on v.id = eva.vendor_id
      where eva.event_id = p_event_id
        and eva.venue_id = v_venue_id
    ),

    'tasks', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',          et.id,
          'title',       et.title,
          'description', et.description,
          'ownerType',   et.owner_type,
          'status',      et.status,
          'completedAt', et.completed_at,
          'assignedToStaffId', et.assigned_to_staff_id,
          'assignedToName',    vs.full_name
        ) order by et.sort_order, et.due_date
      ), '[]'::jsonb)
      from public.event_tasks et
      left join public.venue_staff vs on vs.id = et.assigned_to_staff_id
      where et.event_id = p_event_id
        and et.venue_id = v_venue_id
        and et.milestone_kind = 'event_day'
        and et.status  != 'waived'
    ),

    'contacts', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',           cc.id,
          'firstName',    cc.first_name,
          'lastName',     cc.last_name,
          'phone',        cc.phone,
          'email',        cc.email,
          'relationship', cc.relationship,
          'roleLabel',    cc.role_label
        ) order by
          case cc.relationship
            when 'partner'        then 1
            when 'planner'        then 2
            when 'maid_of_honor'  then 3
            when 'best_man'       then 4
            when 'parent'         then 5
            else 6
          end
      ), '[]'::jsonb)
      from public.client_contacts cc
      where cc.client_id = v_client_id
        and cc.venue_id  = v_venue_id
        and (cc.is_emergency_contact = true or cc.relationship in ('partner','planner','maid_of_honor','best_man'))
        and (cc.phone is not null or cc.email is not null)
    ),

    'dietary', (
      select coalesce(jsonb_agg(
        jsonb_build_object('choice', meal_choice, 'restriction', tag, 'count', cnt)
      ), '[]'::jsonb)
      from (
        select meal_choice, tag, count(*) as cnt
        from (
          select cg.meal_choice, unnest(cg.dietary_tags) as tag
          from public.couple_guests cg
          where cg.client_id  = v_client_id
            and cg.venue_id   = v_venue_id
            and cg.rsvp_status = 'attending'
            and cardinality(cg.dietary_tags) > 0
        ) expanded
        group by meal_choice, tag
      ) grouped
    )
  );
end;
$function$;
