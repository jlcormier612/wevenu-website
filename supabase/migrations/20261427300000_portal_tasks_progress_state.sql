-- ============================================================================
-- Expose event_tasks.progress_state on get_portal_tasks.
--
-- Vendor selection (and questionnaire) submit sets progress_state = in_progress
-- without completing the task (venue still confirms). The couple portal needs
-- that signal so Home "Your Next Steps" can demote submitted/waiting rows
-- without marking the task complete.
-- ============================================================================

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
  v_planning       boolean;
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

  v_planning := v_effective_role in ('full_access', 'planning', 'couple');

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
      'progressState',       t.progress_state,
      'isRequired',          t.is_required,
      'completedAt',         t.completed_at,
      'autoCompleteTrigger', t.auto_complete_trigger,
      'actionType',          t.action_type,
      'actionLabel',         t.action_label,
      'canComplete',         t.visibility = 'client_owned'
                             and t.status not in ('complete', 'waived', 'blocked')
                             and t.auto_complete_trigger is null
                             and v_planning,
      'canUndo',             t.visibility = 'client_owned'
                             and t.status = 'complete'
                             and t.auto_complete_trigger is null
                             and v_planning,
      'links', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',    cl.id,
            'url',   cl.link_url,
            'label', cl.link_label
          )
          order by cl.created_at asc
        )
        from public.event_task_context_links cl
        where cl.event_task_id = t.id
          and cl.link_url is not null
          and cl.link_url <> ''
      ), '[]'::jsonb)
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

comment on function public.get_portal_tasks(text) is
  'Couple portal tasks payload; includes progressState so submitted/waiting rows can leave Next Steps without auto-complete.';
