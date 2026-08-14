-- ============================================================================
-- Couple Tasks Impl 4 — Verified Domain Completion Celebrations
--
-- Extend luv_celebrations (preferred existing one-time store) with three
-- Commitment Lifecycle submits that previously auto-completed playbook
-- tasks silently: vendor list submit, seating submit, questionnaire submit.
--
-- Does NOT create a new celebration table.
-- Does NOT celebrate payment_received (over-broad — final_payment_received
-- remains the only payment celebration, unchanged).
-- Does NOT invent insurance / share-timeline / leave-review signals.
-- ============================================================================

-- Widen celebration_type check (Postgres replaces check constraints by name).
alter table public.luv_celebrations
  drop constraint if exists luv_celebrations_celebration_type_check;

alter table public.luv_celebrations
  add constraint luv_celebrations_celebration_type_check
  check (celebration_type in (
    'contract_signed',
    'final_payment_received',
    'guest_list_submitted',
    'timeline_submitted',
    'website_published',
    'vendor_list_submitted',
    'seating_submitted',
    'questionnaire_submitted'
  ));


-- ── submit_vendor_list — one-time Luv celebration on first list submit ──────
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

  with inserted as (
    insert into public.event_vendor_assignments (venue_id, event_id, vendor_id, notes)
    select v_session_venue_id, v_event_id, evr.vendor_id, 'Selected by couple'
    from public.event_vendor_recommendations evr
    where evr.event_id = v_event_id
      and evr.venue_id = v_session_venue_id
      and evr.selected_at is not null
    on conflict (event_id, vendor_id) do nothing
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


-- ── submit_seating_plan — one-time Luv celebration on first seating submit ──
create or replace function public.submit_seating_plan(p_token text, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_snapshot jsonb;
  v_submission_id uuid;
  v_completed_task_id uuid;
  v_celebrated boolean := false;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_ids.access_level in ('financial', 'view_only') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if not exists (
    select 1 from public.floor_plans where id = p_floor_plan_id and event_id = v_ids.event_id and client_access != 'hidden'
  ) then
    return jsonb_build_object('ok', false, 'error', 'floor_plan_not_found');
  end if;

  if exists (select 1 from public.seating_delegations where floor_plan_id = p_floor_plan_id and revoked_at is null) then
    return jsonb_build_object('ok', false, 'error', 'delegated_to_venue');
  end if;

  v_snapshot := public._build_seating_json(v_ids.client_id, v_ids.venue_id, p_floor_plan_id);

  insert into public.seating_submissions (client_id, venue_id, event_id, floor_plan_id, snapshot, guest_count, submitted_by)
  values (v_ids.client_id, v_ids.venue_id, v_ids.event_id, p_floor_plan_id, v_snapshot,
          coalesce((v_snapshot -> 'stats' ->> 'totalAssigned')::integer, 0), 'couple')
  returning id into v_submission_id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_ids.venue_id and event_id = v_ids.event_id
      and auto_complete_trigger = 'seating_submitted'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_ids.venue_id;
  end loop;

  insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
  values (v_ids.venue_id, v_ids.client_id, v_ids.event_id, 'seating_submitted', v_submission_id)
  on conflict (client_id, celebration_type) do nothing
  returning true into v_celebrated;

  return jsonb_build_object(
    'ok', true,
    'submissionId', v_submission_id,
    'celebrated', coalesce(v_celebrated, false)
  );
end;
$$;


-- ── submit_questionnaire_as_couple — one-time celebration on first submit ───
create or replace function public.submit_questionnaire_as_couple(
  p_key                   text,
  p_final_guest_count     integer,
  p_meal_notes            text,
  p_processional_song     text,
  p_recessional_song      text,
  p_first_dance_song      text,
  p_parent_dances         text,
  p_emergency_contact     text,
  p_emergency_phone       text,
  p_special_requests      text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id                 uuid;
  v_thread_id          uuid;
  v_venue_id           uuid;
  v_event_id           uuid;
  v_client_id          uuid;
  v_completed_task_id  uuid;
  v_celebrated         boolean := false;
begin
  update public.event_questionnaires
    set
      final_guest_count       = p_final_guest_count,
      meal_notes              = nullif(p_meal_notes, ''),
      processional_song       = nullif(p_processional_song, ''),
      recessional_song        = nullif(p_recessional_song, ''),
      first_dance_song        = nullif(p_first_dance_song, ''),
      parent_dances           = nullif(p_parent_dances, ''),
      emergency_contact_name  = nullif(p_emergency_contact, ''),
      emergency_contact_phone = nullif(p_emergency_phone, ''),
      special_requests        = nullif(p_special_requests, ''),
      status                  = 'submitted',
      submitted_at            = now()
  where access_key = p_key
    and status in ('sent', 'submitted')
  returning id, thread_id, venue_id, event_id
    into v_id, v_thread_id, v_venue_id, v_event_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'Form not found or not yet accessible.');
  end if;

  if v_venue_id is not null and v_event_id is not null then
    for v_completed_task_id in
      update public.event_tasks
      set status = 'complete', completed_at = now(), completed_by = 'system',
          source_type = 'questionnaire', source_id = v_id
      where venue_id = v_venue_id and event_id = v_event_id
        and auto_complete_trigger = 'questionnaire_submitted'
        and status in ('pending', 'blocked', 'overdue')
      returning id
    loop
      update public.event_tasks
      set status = 'pending'
      where depends_on_event_task_id = v_completed_task_id
        and status = 'blocked' and venue_id = v_venue_id;
    end loop;

    select e.client_id into v_client_id
    from public.events e
    where e.id = v_event_id;

    if v_client_id is not null then
      insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
      values (v_venue_id, v_client_id, v_event_id, 'questionnaire_submitted', v_id)
      on conflict (client_id, celebration_type) do nothing
      returning true into v_celebrated;
    end if;
  end if;

  if v_thread_id is not null and v_venue_id is not null then
    insert into public.messages (
      thread_id, venue_id, direction, body, channel, status, sent_at
    ) values (
      v_thread_id, v_venue_id,
      'system',
      '✓ Final details submitted by the couple.',
      'system', 'received', now()
    );
    update public.message_threads
      set last_message_at = now(),
          message_count   = message_count + 1
    where id = v_thread_id;
  end if;

  return jsonb_build_object('ok', true, 'celebrated', coalesce(v_celebrated, false));
end;
$$;

notify pgrst, 'reload schema';
