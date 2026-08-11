-- ============================================================================
-- Vendor Task Completion Authority — Phase 2
-- Dual-state vendor_confirm: couple acknowledgement ≠ vendor confirmation
--
-- Intermediate durable signal: couple_acknowledged_at
-- Operational completion remains status=complete (vendor only for this lane).
--
-- Does NOT change couple_acknowledge or action_verified (share_timeline) lanes.
-- ============================================================================

-- ── 1. Intermediate acknowledgement column ───────────────────────────────────

alter table public.vendor_tasks
  add column if not exists couple_acknowledged_at timestamptz;

comment on column public.vendor_tasks.couple_acknowledged_at is
  'Phase 2 vendor_confirm only: when the couple acknowledged (not final). status stays pending until vendor confirms.';

create index if not exists vendor_tasks_awaiting_vendor_confirm
  on public.vendor_tasks (vendor_id, event_id)
  where completion_authority = 'vendor_confirm'
    and status = 'pending'
    and couple_acknowledged_at is not null;


-- ── 2. get_portal_vendor_tasks — expose ack + canAcknowledge ─────────────────

create or replace function public.get_portal_vendor_tasks(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids            record;
  v_effective_role text;
  v_session        public.client_portal_sessions%rowtype;
  v_tasks          jsonb;
  v_can_act        boolean;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null or v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());

  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  v_effective_role := v_session.access_level;
  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  end if;

  if v_effective_role in ('financial', 'reminders_only') then
    return jsonb_build_object('vendorTasks', '[]'::jsonb);
  end if;

  v_can_act :=
    v_effective_role in ('full_access', 'planning', 'couple')
    and v_session.access_level not in ('view_only', 'financial');

  select coalesce(jsonb_agg(row_json order by
    case when row_json->>'status' = 'pending' then 0 else 1 end,
    coalesce(row_json->>'dueDate', '9999-12-31'),
    row_json->>'title'
  ), '[]'::jsonb)
  into v_tasks
  from (
    select jsonb_build_object(
      'id',             vt.id,
      'title',          vt.title,
      'notes',          vt.notes,
      'dueDate',        vt.due_date,
      'status',         vt.status,
      'coupleVisibility', vt.couple_visibility,
      'completedAt',    vt.completed_at,
      'completedBy',    vt.completed_by,
      'vendorId',       vt.vendor_id,
      'vendorName',     coalesce(nullif(trim(vnd.business_name), ''), 'Vendor'),
      'actionType',     vt.action_type,
      'completionAuthority', vt.completion_authority,
      'coupleAcknowledgedAt', vt.couple_acknowledged_at,
      'canComplete',
        vt.completion_authority = 'couple_acknowledge'
        and vt.status = 'pending'
        and v_can_act,
      'canAcknowledge',
        vt.completion_authority = 'vendor_confirm'
        and vt.couple_visibility = 'owned'
        and vt.status = 'pending'
        and vt.couple_acknowledged_at is null
        and v_can_act,
      'attachments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',         a.id,
          'name',       a.name,
          'storageUrl', a.storage_url,
          'mimeType',   a.mime_type
        ) order by a.sort_order, a.created_at)
        from public.vendor_task_attachments a
        where a.vendor_task_id = vt.id
      ), '[]'::jsonb)
    ) as row_json
    from public.vendor_tasks vt
    join public.vendors vnd on vnd.id = vt.vendor_id
    where vt.event_id = v_ids.event_id
      and vt.couple_visibility in ('visible', 'owned')
      and exists (
        select 1
        from public.event_vendor_assignments eva
        where eva.event_id = vt.event_id
          and eva.vendor_id = vt.vendor_id
      )
  ) shared;

  return jsonb_build_object('vendorTasks', v_tasks);
end;
$$;

grant execute on function public.get_portal_vendor_tasks(text) to anon, authenticated;


-- ── 3. acknowledge_portal_vendor_task ─────────────────────────────────────────
-- Couple acknowledgement for vendor_confirm only. NEVER sets status=complete.

create or replace function public.acknowledge_portal_vendor_task(
  p_token   text,
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids            record;
  v_session        public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_task           public.vendor_tasks%rowtype;
  v_assignment_id  uuid;
  v_vendor_name    text;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null or v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

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

  v_effective_role := v_session.access_level;
  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  end if;

  if v_effective_role not in ('full_access', 'planning', 'couple') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  select * into v_task
  from public.vendor_tasks
  where id = p_task_id
    and event_id = v_ids.event_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_task.couple_visibility is distinct from 'owned' then
    return jsonb_build_object('ok', false, 'error', 'not_owned');
  end if;

  if v_task.completion_authority is distinct from 'vendor_confirm' then
    return jsonb_build_object('ok', false, 'error', 'not_vendor_confirm');
  end if;

  if v_task.status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  select eva.id into v_assignment_id
  from public.event_vendor_assignments eva
  where eva.event_id = v_task.event_id
    and eva.vendor_id = v_task.vendor_id
  limit 1;

  if v_assignment_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_assignment');
  end if;

  -- Idempotent: already acknowledged
  if v_task.couple_acknowledged_at is not null then
    select coalesce(nullif(trim(business_name), ''), 'Vendor')
    into v_vendor_name
    from public.vendors
    where id = v_task.vendor_id;
    return jsonb_build_object(
      'ok', true,
      'alreadyAcknowledged', true,
      'vendorName', v_vendor_name
    );
  end if;

  update public.vendor_tasks
  set couple_acknowledged_at = now()
  where id = v_task.id
    and status = 'pending'
    and couple_acknowledged_at is null;

  select coalesce(nullif(trim(business_name), ''), 'Vendor')
  into v_vendor_name
  from public.vendors
  where id = v_task.vendor_id;

  perform public.create_vendor_notification(
    v_task.vendor_id,
    v_task.event_id,
    v_assignment_id,
    'task_acknowledged',
    'Couple says this task is done',
    left(
      'Waiting for your confirmation: ' || coalesce(v_task.title, 'Task'),
      200
    ),
    '/vendor/events/' || v_assignment_id::text || '?tab=tasks&focus=' || v_task.id::text,
    '📩'
  );

  return jsonb_build_object('ok', true, 'vendorName', v_vendor_name);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.acknowledge_portal_vendor_task(text, uuid)
  to anon, authenticated;


-- ── 4. confirm_vendor_task — vendor finalizes after couple ack ────────────────
-- SECURITY DEFINER; validates vendor membership + ownership + ack gate.

create or replace function public.confirm_vendor_task(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_task      public.vendor_tasks%rowtype;
begin
  v_vendor_id := public.current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_vendor');
  end if;

  select * into v_task
  from public.vendor_tasks
  where id = p_task_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_task.vendor_id is distinct from v_vendor_id then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if v_task.completion_authority is distinct from 'vendor_confirm' then
    return jsonb_build_object('ok', false, 'error', 'not_vendor_confirm');
  end if;

  -- Owned couple-facing confirm lane requires acknowledgement first.
  if v_task.couple_visibility = 'owned' then
    if v_task.couple_acknowledged_at is null then
      return jsonb_build_object('ok', false, 'error', 'ack_required');
    end if;
  end if;

  if v_task.status = 'complete' then
    return jsonb_build_object('ok', true, 'alreadyComplete', true);
  end if;

  if v_task.status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  if v_task.event_id is not null then
    if not exists (
      select 1
      from public.event_vendor_assignments eva
      where eva.event_id = v_task.event_id
        and eva.vendor_id = v_vendor_id
    ) then
      return jsonb_build_object('ok', false, 'error', 'no_assignment');
    end if;
  end if;

  update public.vendor_tasks
  set
    status = 'complete',
    completed_at = now(),
    completed_by = 'vendor'
  where id = v_task.id;

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.confirm_vendor_task(uuid) to authenticated;

notify pgrst, 'reload schema';
