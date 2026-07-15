-- ============================================================================
-- Timeline / Wedding Day Ops — cross-tenant authorization fix
-- (docs/timeline-release-readiness.md, Release Blocker #1)
--
-- get_wedding_day_ops, update_timeline_entry_status, and toggle_vendor_checkin
-- are all SECURITY DEFINER, owned by postgres (rolbypassrls = true) — they
-- run with full RLS bypass regardless of the correctly-configured policies
-- already on timeline_entries/event_vendor_assignments/events. None of the
-- three checked that the calling coordinator's own venue
-- (current_user_venue_id(), the same helper this codebase's own RLS
-- policies already use) matched the venue that owns the target row —
-- confirmed live, a genuine cross-tenant read/write gap: any authenticated
-- coordinator at any venue could read or write any OTHER venue's wedding-day
-- data (timeline, vendor contacts, guest dietary/health info) by supplying
-- a UUID they don't own.
--
-- Every couple/guest-facing portal RPC touching these same tables
-- (update_portal_timeline_entry, add_portal_timeline_entry,
-- get_guest_timeline, get_journey_timeline) already does this correctly —
-- this fix brings the three coordinator-facing RPCs up to the same bar,
-- using the exact same current_user_venue_id() check the table-level RLS
-- policies already enforce for every other write path.
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

  -- Not found and "not yours" return the identical response — never
  -- confirm to an unauthorized caller that a given event id even exists.
  if v_venue_id is null or v_venue_id is distinct from public.current_user_venue_id() then
    return jsonb_build_object('error', 'not_found');
  end if;

  return jsonb_build_object(

    'timeline', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',          te.id,
          'title',       te.title,
          'description', te.description,
          'entryTime',   te.entry_time,
          'sortOrder',   te.sort_order,
          'status',      te.status
        ) order by te.entry_time asc nulls last, te.sort_order, te.created_at
      ), '[]'::jsonb)
      from public.timeline_entries te
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
          'completedAt', et.completed_at
        ) order by et.sort_order, et.due_date
      ), '[]'::jsonb)
      from public.event_tasks et
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

create or replace function public.update_timeline_entry_status(p_entry_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_status not in ('not_started', 'in_progress', 'complete') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.timeline_entries
  set status = p_status, updated_at = now()
  where id = p_entry_id
    and venue_id = public.current_user_venue_id();

  if not found then
    raise exception 'timeline entry not found or not permitted';
  end if;
end;
$function$;

create or replace function public.toggle_vendor_checkin(p_assignment_id uuid, p_field text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row public.event_vendor_assignments%rowtype;
begin
  select * into v_row from public.event_vendor_assignments
  where id = p_assignment_id
    and venue_id = public.current_user_venue_id();
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  if p_field = 'checked_in' then
    update public.event_vendor_assignments
    set checked_in_at = case when checked_in_at is null then now() else null end
    where id = p_assignment_id;
  elsif p_field = 'setup_complete' then
    update public.event_vendor_assignments
    set setup_complete_at = case when setup_complete_at is null then now() else null end
    where id = p_assignment_id;
  else
    return jsonb_build_object('error', 'invalid_field');
  end if;

  return jsonb_build_object('ok', true);
end;
$function$;

notify pgrst, 'reload schema';
