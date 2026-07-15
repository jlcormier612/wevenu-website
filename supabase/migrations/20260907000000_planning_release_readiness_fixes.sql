-- ============================================================================
-- Planning — Release Readiness Fixes (docs/planning-release-readiness.md)
--
-- PART A — get_wedding_day_ops: fix schema drift that broke the entire
-- Wedding Day command center, not just Planning tasks.
--
-- Four independent bugs, all confirmed by executing the function directly
-- against real dev data:
--   1. et.phase — dropped in 20260722000000_planning_playbook_milestones.sql
--      when Planning migrated to milestone_name/milestone_kind. The RPC was
--      never updated. Fixed to milestone_kind = 'event_day', the direct
--      successor concept for "this task happens on the wedding day itself."
--   2. v.name — vendors has no such column; the real column is
--      business_name. Confirmed via \d vendors.
--   3. cg.event_id — couple_guests has no event_id column at all; guests
--      are client-scoped, not event-scoped (confirmed elsewhere this
--      program, e.g. Seating's own guest queries). Fixed to the already-
--      resolved v_client_id.
--   4. cg.dietary_restriction — does not exist. The legacy singular
--      dietary_restrictions column exists but has zero populated rows in
--      real data (confirmed: 0 vs 4 for dietary_tags) — every guest's real
--      dietary info lives in dietary_tags (text[]) today. Fixed to unnest
--      dietary_tags so multi-tag guests (e.g. vegetarian + gluten_free)
--      are correctly counted per tag, matching how Seating already reads
--      this same column.
--   5. A fifth, genuinely pre-existing bug, reached only once 1-4 stopped
--      throwing first: the dietary block nested count(*) directly inside
--      jsonb_agg(jsonb_build_object(...)) — Postgres rejects nested
--      aggregates outright. Fixed by grouping in its own subquery first,
--      then aggregating the already-grouped rows.
--
-- Any one of these would have thrown before returning anything — the
-- function's single jsonb_build_object call plans all subqueries together,
-- so the Wedding Day dashboard (timeline, vendor check-in, tasks, contacts,
-- dietary — everything the page shows) failed to load at all, for every
-- real event, until all four were fixed.
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

  if v_venue_id is null then
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

    -- Wedding-day tasks — milestone_kind = 'event_day' is the current
    -- equivalent of the dropped phase = 'wedding_day' column.
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

    -- Guest dietary summary — couple_guests has no event_id (client-scoped,
    -- not event-scoped); real dietary data lives in dietary_tags (a guest
    -- may carry more than one), unnested so each tag is counted separately,
    -- matching how Seating already reads this same column.
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
