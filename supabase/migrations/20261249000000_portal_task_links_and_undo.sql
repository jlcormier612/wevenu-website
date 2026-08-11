-- ============================================================================
-- Portal Tasks — outbound context links + couple undo for manual/ack tasks
--
-- A / C: Expose web links from event_task_context_links (playbook attachments
--        copied at apply) so Leave a review / Choose your package (and any
--        null-trigger client_owned row with a link) can open a venue-configured URL.
-- D: Couples may reopen completed manual/ack tasks (auto_complete_trigger IS NULL).
--    Domain-verified / trigger-backed completions stay irreversible from the portal.
-- ============================================================================

-- ── get_portal_tasks: links + canUndo ───────────────────────────────────────
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

-- ── undo_portal_task: reopen manual/ack completions only ────────────────────
create or replace function public.undo_portal_task(p_token text, p_task_id uuid)
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
    return jsonb_build_object('ok', false, 'error', 'task_not_found_or_not_undoable');
  end if;

  select * into v_task
  from public.event_tasks
  where id         = p_task_id
    and event_id   = v_event_id
    and venue_id   = v_session.venue_id
    and visibility = 'client_owned'
    and status     = 'complete';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'task_not_found_or_not_undoable');
  end if;

  -- Verified / trigger-backed completions cannot be undone by the couple.
  if v_task.auto_complete_trigger is not null then
    return jsonb_build_object('ok', false, 'error', 'domain_verified_cannot_undo');
  end if;

  -- Match venue reopen: status → pending, clear completed_at.
  update public.event_tasks
  set status       = 'pending',
      completed_at = null,
      completed_by = null,
      source_type  = null,
      source_id    = null,
      updated_at   = now()
  where id = p_task_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_portal_tasks(text) to anon, authenticated;
grant execute on function public.undo_portal_task(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
