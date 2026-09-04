-- ============================================================================
-- Portal Task Action Destinations
--
-- get_portal_tasks never selected action_type/action_label from event_tasks,
-- so a coordinator's "Opens" choice on a Client Planning task was silently
-- discarded before it ever reached the couple portal — the couple always
-- fell back to a raw attachment link or a bare "Mark complete." This adds
-- the two columns to the existing payload; no schema change (both columns
-- have existed on event_tasks since 20260628200000_task_action_centers.sql).
-- Otherwise byte-for-byte identical to 20261249000000_portal_task_links_and_undo.sql.
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
      'isRequired',          t.is_required,
      'completedAt',         t.completed_at,
      'autoCompleteTrigger', t.auto_complete_trigger,
      -- Task Destination Audit (2026-09-03): the coordinator's chosen
      -- destination, previously never surfaced to the couple portal at all.
      'actionType',          t.action_type,
      'actionLabel',         t.action_label,
      -- Domain-verified tasks cannot be manually completed by the couple.
      'canComplete',         t.visibility = 'client_owned'
                             and t.status not in ('complete', 'waived', 'blocked')
                             and t.auto_complete_trigger is null
                             and v_planning,
      -- Couple undo: only manual/ack (null trigger) client_owned completions.
      'canUndo',             t.visibility = 'client_owned'
                             and t.status = 'complete'
                             and t.auto_complete_trigger is null
                             and v_planning,
      -- Web links from playbook attachments → event_task_context_links.
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
