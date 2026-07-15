-- ============================================================================
-- Wedding Day Ops — surface staff assignment
-- (docs/wedding-day-release-readiness.md, Release Blocker #3)
--
-- timeline_entries.assigned_to_staff_id and event_tasks.assigned_to_staff_id
-- are both real, populated fields (Timeline's own staff picker is fully
-- built) — but get_wedding_day_ops never selected them, so the one page a
-- coordinator uses to run the actual wedding day could show what and when,
-- never who. Adds assignedToStaffId/assignedToName to both the timeline and
-- tasks blocks — read-only, no write path changes, no new tables.
-- ============================================================================

create or replace function public.get_wedding_day_ops(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_venue_id   uuid;
  v_client_id  uuid;
begin
  select venue_id, client_id into v_venue_id, v_client_id
  from public.events
  where id = p_event_id;

  if v_venue_id is null or v_venue_id is distinct from public.current_user_venue_id() then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object(

    'timeline', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',              te.id,
          'title',           te.title,
          'description',     te.description,
          'entryTime',       te.entry_time,
          'sortOrder',       te.sort_order,
          'status',          te.status,
          'assignedToStaffId', te.assigned_to_staff_id,
          'assignedToName',    vs.full_name
        ) order by te.entry_time asc nulls last, te.sort_order, te.created_at
      ), '[]'::jsonb)
      from public.timeline_entries te
      left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
      where te.event_id = p_event_id
        and te.venue_id = v_venue_id
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

notify pgrst, 'reload schema';
