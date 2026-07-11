-- ============================================================================
-- Planning Templates — Draft / Release workflow for Client Planning
--
-- Approved 2026-07-10 (docs/planning-templates-apply-release-workflow.md).
-- Applying and releasing a Client Planning checklist are two different
-- actions: applying generates real tasks the coordinator can review and
-- adjust privately; releasing is the deliberate second step that makes the
-- checklist visible to the couple. Venue Planning has no draft state — it's
-- internal by definition and stays active the instant it's applied, exactly
-- like today.
--
-- released_at is the one column that answers "is this active" for both
-- kinds, kept kind-agnostic on purpose: Venue Planning gets released_at set
-- to applied_at at apply-time (from the application layer,
-- lib/playbooks/repository.ts), so every downstream check is a single
-- `released_at is not null` regardless of kind.
-- ============================================================================

alter table public.event_playbook_applications add column released_at timestamptz;

-- Backfill: every application that existed before this feature shipped was
-- already fully, unconditionally visible under the old always-on behavior
-- (see the correction in docs/planning-templates-apply-release-workflow.md —
-- get_portal_tasks already showed Client Planning tasks to the couple with
-- no gate at all). Preserve that for existing events; only *new* Client
-- Planning applications start in Draft going forward.
update public.event_playbook_applications set released_at = applied_at where released_at is null;

-- ── get_portal_tasks: Client Planning tasks stay hidden from the couple ────
-- until the venue explicitly releases the checklist. Venue Planning tasks
-- never reach this function at all — their visibility values
-- (coordinator_only/vendor_visible/vendor_owned) already exclude them from
-- the filter below, so only Client Planning needs the release check.
create or replace function public.get_portal_tasks(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session       public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_event         record;
  v_tasks         jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- Effective role: contact's portal_role overrides session access_level
  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  else
    v_effective_role := v_session.access_level;
  end if;

  -- Financial-only contacts cannot see planning tasks
  if v_effective_role = 'financial' or v_effective_role = 'reminders_only' then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select id, event_date into v_event
  from public.events
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
    and status not in ('cancelled')
  order by event_date asc limit 1;

  if not found then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  -- Draft → Release gate: no released Client Planning application for this
  -- event means nothing is visible yet, regardless of how many tasks exist.
  if not exists (
    select 1 from public.event_playbook_applications
    where event_id = v_event.id and venue_id = v_session.venue_id
      and kind = 'client' and released_at is not null
  ) then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',            t.id,
      'title',         t.title,
      'description',   t.description,
      'category',      t.category,
      'ownerType',     t.owner_type,
      'visibility',    t.visibility,
      'dueDate',       t.due_date,
      'daysOffset',    t.days_offset,
      'milestoneName', t.milestone_name,
      'milestoneKind', t.milestone_kind,
      'status',        t.status,
      'isRequired',    t.is_required,
      'completedAt',   t.completed_at,
      -- view_only contacts can see but not complete tasks
      'canComplete',   t.visibility = 'client_owned'
                       and t.status not in ('complete', 'waived', 'blocked')
                       and v_effective_role in ('full_access', 'planning', 'couple')
    )
    order by t.due_date asc, t.sort_order asc
  )
  into v_tasks
  from public.event_tasks t
  where t.event_id  = v_event.id
    and t.venue_id  = v_session.venue_id
    and t.visibility in ('client_visible', 'client_owned')
    and t.status   != 'waived';

  return jsonb_build_object('tasks', coalesce(v_tasks, '[]'::jsonb));
end;
$$;

-- ── complete_portal_task: same release gate, defense in depth ──────────────
-- A Draft-state task is already excluded from get_portal_tasks so the couple
-- portal has no UI to trigger this — this closes the same gap at the RPC
-- layer directly, in case it's ever called without going through the list.
create or replace function public.complete_portal_task(p_token text, p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_task    public.event_tasks%rowtype;
  v_event   record;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  -- view_only and financial cannot complete tasks
  if v_session.access_level in ('view_only', 'financial') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  -- Find task, validate ownership
  select e.id as event_id into v_event
  from public.events e
  where e.client_id = v_session.client_id
    and e.venue_id  = v_session.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc limit 1;

  if not exists (
    select 1 from public.event_playbook_applications
    where event_id = v_event.event_id and venue_id = v_session.venue_id
      and kind = 'client' and released_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'task_not_found_or_not_completable');
  end if;

  select * into v_task
  from public.event_tasks
  where id        = p_task_id
    and event_id  = v_event.event_id
    and venue_id  = v_session.venue_id
    and visibility = 'client_owned'
    and status not in ('complete', 'waived', 'blocked');

  if not found then
    return jsonb_build_object('ok', false, 'error', 'task_not_found_or_not_completable');
  end if;

  -- Complete the task
  update public.event_tasks
  set status       = 'complete',
      completed_at = now(),
      completed_by = 'couple',
      source_type  = 'manual'
  where id = p_task_id;

  -- Unblock dependents
  update public.event_tasks
  set status = 'pending'
  where depends_on_event_task_id = p_task_id
    and status = 'blocked'
    and venue_id = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_portal_tasks(text) to anon, authenticated;
grant execute on function public.complete_portal_task(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
