-- Fix submit_vendor_list after 20261404200000 made eva_event_vendor a
-- PARTIAL unique index (WHERE event_id IS NOT NULL).
--
-- PostgreSQL requires ON CONFLICT to name the same predicate as the partial
-- index. Without it, Submit fails with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
-- which rolls back the whole function — including the selected_at commit —
-- so the venue never sees the couple's submitted list.
--
-- Also populates client_id on the assignment insert (added in 202614042).

create or replace function public.submit_vendor_list(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_venue_id uuid;
  v_event_id  uuid;
  v_snapshot  jsonb;
  v_count     integer;
  v_submission_id uuid;
  v_completed_task_id uuid;
  v_newly_assigned jsonb;
  v_removal_requests jsonb;
  v_celebrated boolean := false;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.venue_id = v_session_venue_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
    and e.status not in ('cancelled', 'complete')
  order by e.event_date limit 1;
  if v_event_id is null then return jsonb_build_object('ok', false, 'error', 'event_not_found'); end if;

  -- Commit shortlist: picked ↔ selected (venue notification trigger keys off selected_at).
  update public.event_vendor_recommendations
  set selected_at = case when picked_at is not null then coalesce(selected_at, now()) else null end
  where event_id = v_event_id and venue_id = v_session_venue_id
    and (picked_at is not null) != (selected_at is not null);

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'recommendationId', evr.id, 'vendorId', vnd.id, 'vendorName', vnd.business_name,
      'category', vnd.category, 'note', evr.note
    ) order by vnd.category, vnd.business_name), '[]'::jsonb),
    count(*)
  into v_snapshot, v_count
  from public.event_vendor_recommendations evr
  join public.vendors vnd on vnd.id = evr.vendor_id
  where evr.event_id = v_event_id and evr.venue_id = v_session_venue_id and evr.selected_at is not null;

  insert into public.vendor_selection_submissions (client_id, venue_id, event_id, snapshot, selected_count)
  values (p_client_id, v_session_venue_id, v_event_id, v_snapshot, v_count)
  returning id into v_submission_id;

  -- Idempotent assignments. Partial unique index eva_event_vendor requires the
  -- matching WHERE predicate on ON CONFLICT (see 20261404200000).
  with inserted as (
    insert into public.event_vendor_assignments (venue_id, event_id, client_id, vendor_id, notes)
    select v_session_venue_id, v_event_id, p_client_id, evr.vendor_id, 'Selected by couple'
    from public.event_vendor_recommendations evr
    where evr.event_id = v_event_id
      and evr.venue_id = v_session_venue_id
      and evr.selected_at is not null
    on conflict (event_id, vendor_id) where event_id is not null do nothing
    returning id, vendor_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', i.id,
    'vendorId', i.vendor_id
  )), '[]'::jsonb)
  into v_newly_assigned
  from inserted i;

  update public.event_vendor_removal_requests r
  set status = 'dismissed', resolved_at = now()
  where r.event_id = v_event_id
    and r.venue_id = v_session_venue_id
    and r.requested_by = 'couple'
    and r.status = 'pending'
    and exists (
      select 1 from public.event_vendor_recommendations evr
      where evr.event_id = r.event_id
        and evr.vendor_id = r.vendor_id
        and evr.selected_at is not null
    );

  with created as (
    select public._upsert_pending_vendor_removal_request(
      eva.venue_id, eva.event_id, eva.vendor_id, eva.id, 'couple', null
    ) as request_id,
    eva.vendor_id,
    eva.id as assignment_id
    from public.event_vendor_assignments eva
    where eva.event_id = v_event_id
      and eva.venue_id = v_session_venue_id
      and not exists (
        select 1 from public.event_vendor_recommendations evr
        where evr.event_id = eva.event_id
          and evr.vendor_id = eva.vendor_id
          and evr.selected_at is not null
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId', c.request_id,
    'vendorId', c.vendor_id,
    'assignmentId', c.assignment_id
  ) order by c.vendor_id), '[]'::jsonb)
  into v_removal_requests
  from created c
  where c.request_id is not null;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session_venue_id and event_id = v_event_id
      and auto_complete_trigger = 'vendor_selected'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_session_venue_id;
  end loop;

  insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
  values (v_session_venue_id, p_client_id, v_event_id, 'vendor_list_submitted', v_submission_id)
  on conflict (client_id, celebration_type) do nothing
  returning true into v_celebrated;

  return jsonb_build_object(
    'ok', true,
    'submissionId', v_submission_id,
    'selectedCount', v_count,
    'newlyAssigned', coalesce(v_newly_assigned, '[]'::jsonb),
    'removalRequests', coalesce(v_removal_requests, '[]'::jsonb),
    'eventId', v_event_id,
    'venueId', v_session_venue_id,
    'celebrated', coalesce(v_celebrated, false)
  );
end;
$$;

notify pgrst, 'reload schema';
