-- ============================================================================
-- Couple Tasks — Verified Action Completion (Impl 1)
--
-- When event_tasks.auto_complete_trigger is set, the couple must not Mark
-- complete in the portal. Completion is driven by the domain signal that
-- already calls triggerAutoComplete / SQL auto-complete loops.
-- Venue/coordinator complete paths are unchanged.
--
-- Also: couple questionnaire submit now auto-completes matching playbook
-- tasks (questionnaire_submitted) — previously only the venue save path did.
-- ============================================================================

-- ── get_portal_tasks: expose trigger + canComplete policy ───────────────────
create or replace function public.get_portal_tasks(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session        public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_event_id       uuid;
  v_tasks          jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  else
    v_effective_role := v_session.access_level;
  end if;

  if v_effective_role = 'financial' or v_effective_role = 'reminders_only' then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  v_event_id := coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));

  if v_event_id is null then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  if not exists (
    select 1 from public.event_playbook_applications
    where event_id = v_event_id and venue_id = v_session.venue_id
      and kind = 'client' and released_at is not null
  ) then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',                  t.id,
      'title',               t.title,
      'description',         t.description,
      'category',            t.category,
      'ownerType',           t.owner_type,
      'visibility',          t.visibility,
      'dueDate',             t.due_date,
      'daysOffset',          t.days_offset,
      'milestoneName',       t.milestone_name,
      'milestoneKind',       t.milestone_kind,
      'status',              t.status,
      'isRequired',          t.is_required,
      'completedAt',         t.completed_at,
      'autoCompleteTrigger', t.auto_complete_trigger,
      -- Domain-verified tasks cannot be manually completed by the couple.
      'canComplete',         t.visibility = 'client_owned'
                             and t.status not in ('complete', 'waived', 'blocked')
                             and t.auto_complete_trigger is null
                             and v_effective_role in ('full_access', 'planning', 'couple')
    )
    order by t.due_date asc, t.sort_order asc
  )
  into v_tasks
  from public.event_tasks t
  where t.event_id  = v_event_id
    and t.venue_id  = v_session.venue_id
    and t.visibility in ('client_visible', 'client_owned')
    and t.status   != 'waived';

  return jsonb_build_object('tasks', coalesce(v_tasks, '[]'::jsonb));
end;
$$;


-- ── complete_portal_task: refuse when a domain trigger owns completion ──────
create or replace function public.complete_portal_task(p_token text, p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session  public.client_portal_sessions%rowtype;
  v_task     public.event_tasks%rowtype;
  v_event_id uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_session.access_level in ('view_only', 'financial') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  v_event_id := coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));

  if not exists (
    select 1 from public.event_playbook_applications
    where event_id = v_event_id and venue_id = v_session.venue_id
      and kind = 'client' and released_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'task_not_found_or_not_completable');
  end if;

  select * into v_task
  from public.event_tasks
  where id        = p_task_id
    and event_id  = v_event_id
    and venue_id  = v_session.venue_id
    and visibility = 'client_owned'
    and status not in ('complete', 'waived', 'blocked');

  if not found then
    return jsonb_build_object('ok', false, 'error', 'task_not_found_or_not_completable');
  end if;

  if v_task.auto_complete_trigger is not null then
    return jsonb_build_object('ok', false, 'error', 'domain_verified_use_workspace');
  end if;

  update public.event_tasks
  set status       = 'complete',
      completed_at = now(),
      completed_by = 'couple',
      source_type  = 'manual'
  where id = p_task_id;

  update public.event_tasks
  set status = 'pending'
  where depends_on_event_task_id = p_task_id
    and status = 'blocked'
    and venue_id = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;


-- ── Couple questionnaire submit → questionnaire_submitted auto-complete ─────
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
  v_completed_task_id  uuid;
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

  -- Match guest_count / seating / timeline: auto-complete playbook rows whose
  -- trigger is questionnaire_submitted (idempotent — only open statuses).
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

  return jsonb_build_object('ok', true);
end;
$$;

notify pgrst, 'reload schema';
