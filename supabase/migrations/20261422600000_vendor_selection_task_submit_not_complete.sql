-- ============================================================================
-- "Choose your vendors" must not auto-complete on couple submit.
--
-- Prior submit_vendor_list marked event_tasks with auto_complete_trigger =
-- 'vendor_selected' complete on every Submit. That treated one list update as
-- the finish line. Product rule: submit advances the workflow (Submitted /
-- Needs review); Complete is only when the venue confirms the vendor team
-- (manual Mark complete on the existing task — no second task system).
--
-- Draft picks (picked_at only) never touched the task. Submit sets
-- progress_state = in_progress, reopens a previously completed task when the
-- couple updates again, and never inserts a duplicate task row.
-- ============================================================================

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
      and not exists (
        select 1 from public.venue_vendor_relationships vvr
        where vvr.venue_id = eva.venue_id
          and vvr.vendor_id = eva.vendor_id
          and vvr.is_required = true
          and vvr.status = 'active'
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

  -- Advance "Choose your vendors" without completing.
  -- progress_state in_progress = Submitted / Needs review (existing enum).
  -- Reopen if a prior submit incorrectly (or intentionally) completed it —
  -- a new list update means outstanding venue work again. Never INSERT a task.
  update public.event_tasks
  set
    progress_state = 'in_progress',
    status = case
      when status = 'complete' then 'pending'
      when status = 'waived' then status
      else status
    end,
    completed_at = case
      when status = 'complete' then null
      else completed_at
    end,
    completed_by = case
      when status = 'complete' then null
      else completed_by
    end,
    updated_at = now()
  where venue_id = v_session_venue_id
    and event_id = v_event_id
    and auto_complete_trigger = 'vendor_selected'
    and status in ('pending', 'blocked', 'overdue', 'complete');

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

-- When venue marks Complete, mirror progress_state for tasks that use it.
-- (Existing completeEventTask / portal paths set status=complete; keep progress
-- aligned so read models that look at progress_state stay coherent.)
create or replace function public._sync_vendor_selected_task_progress_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auto_complete_trigger is distinct from 'vendor_selected' then
    return new;
  end if;
  if new.status = 'complete' and (old.status is distinct from 'complete') then
    new.progress_state := 'complete';
  elsif new.status in ('pending', 'overdue', 'blocked')
    and old.status = 'complete'
  then
    -- Venue reopened (changes requested) — keep submitted signal if any
    -- submission exists; otherwise not_started.
    if exists (
      select 1 from public.vendor_selection_submissions s
      where s.event_id = new.event_id and s.venue_id = new.venue_id
    ) then
      new.progress_state := 'in_progress';
    else
      new.progress_state := 'not_started';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_vendor_selected_task_progress on public.event_tasks;
create trigger sync_vendor_selected_task_progress
  before update of status on public.event_tasks
  for each row
  execute function public._sync_vendor_selected_task_progress_on_complete();

notify pgrst, 'reload schema';
