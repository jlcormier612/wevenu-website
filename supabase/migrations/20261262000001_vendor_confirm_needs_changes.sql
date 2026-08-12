-- ============================================================================
-- Vendor-confirm Needs Changes v1 + ack presentation hygiene
--
-- - Durable return: vendor_return_note + returned_at
-- - return_vendor_task: clears couple_acknowledged_at, never completes
-- - Couple re-ack clears return fields
-- - Portal projects return fields
-- - couple_notifications gains task_needs_changes
-- - Ack vendor notification copy never says final "completed"
-- ============================================================================

-- ── 1. Columns ────────────────────────────────────────────────────────────────

alter table public.vendor_tasks
  add column if not exists vendor_return_note text;

alter table public.vendor_tasks
  add column if not exists returned_at timestamptz;

comment on column public.vendor_tasks.vendor_return_note is
  'Needs-changes v1: last vendor return reason (cleared when couple re-acks).';

comment on column public.vendor_tasks.returned_at is
  'Needs-changes v1: when the vendor last returned the task for changes.';

-- ── 2. Couple notification type ───────────────────────────────────────────────

alter table public.couple_notifications
  drop constraint if exists couple_notifications_type_check;

alter table public.couple_notifications
  add constraint couple_notifications_type_check
  check (type in ('new_message', 'task_needs_changes'));

-- Allow task_needs_changes through the create helper (was new_message-only).
create or replace function public.create_couple_notification(
  p_client_id       uuid,
  p_type            text,
  p_title           text,
  p_body            text,
  p_link            text,
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client_id is null then
    return;
  end if;

  if p_type is distinct from 'new_message'
     and p_type is distinct from 'task_needs_changes' then
    return;
  end if;

  if exists (
    select 1
    from public.couple_notifications n
    where n.client_id = p_client_id
      and n.type = p_type
      and coalesce(n.link, '') = coalesce(p_link, '')
      and coalesce(n.conversation_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_conversation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and n.created_at > now() - interval '2 minutes'
  ) then
    return;
  end if;

  insert into public.couple_notifications (
    client_id, type, title, body, link, conversation_id
  ) values (
    p_client_id, p_type, p_title, p_body, p_link, p_conversation_id
  );
exception when others then
  null;
end;
$$;

grant execute on function public.create_couple_notification(uuid, text, text, text, text, uuid)
  to anon, authenticated, service_role;

-- ── 3. Portal vendor task projection (get_portal_data vendorTasks fragment) ───
-- Patch via replace of acknowledge + new return RPC; portal JSON lives in
-- get_portal_data. Update that function's vendorTasks object fields.

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

  -- Ack is not completion. Clear any prior return note when couple re-submits.
  update public.vendor_tasks
  set
    couple_acknowledged_at = now(),
    vendor_return_note = null,
    returned_at = null
  where id = v_task.id
    and status = 'pending'
    and couple_acknowledged_at is null;

  select coalesce(nullif(trim(business_name), ''), 'Vendor')
  into v_vendor_name
  from public.vendors
  where id = v_task.vendor_id;

  -- Never use task_completed — acknowledgement is not final completion.
  perform public.create_vendor_notification(
    v_task.vendor_id,
    v_task.event_id,
    v_assignment_id,
    'task_acknowledged',
    'Couple says they''ve completed a task',
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


-- ── 4. return_vendor_task ─────────────────────────────────────────────────────

create or replace function public.return_vendor_task(
  p_task_id uuid,
  p_note    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id   uuid;
  v_task        public.vendor_tasks%rowtype;
  v_client_id   uuid;
  v_note        text;
  v_vendor_name text;
begin
  v_vendor_id := public.current_user_vendor_id();
  if v_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_vendor');
  end if;

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is null then
    return jsonb_build_object('ok', false, 'error', 'note_required');
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

  if v_task.couple_visibility is distinct from 'owned' then
    return jsonb_build_object('ok', false, 'error', 'not_owned');
  end if;

  if v_task.status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;

  if v_task.couple_acknowledged_at is null then
    return jsonb_build_object('ok', false, 'error', 'ack_required');
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
    couple_acknowledged_at = null,
    vendor_return_note = left(v_note, 2000),
    returned_at = now()
  where id = v_task.id;

  select e.client_id into v_client_id
  from public.events e
  where e.id = v_task.event_id;

  select coalesce(nullif(trim(business_name), ''), 'Your vendor')
  into v_vendor_name
  from public.vendors
  where id = v_vendor_id;

  if v_client_id is not null then
    perform public.create_couple_notification(
      v_client_id,
      'task_needs_changes',
      'Your vendor needs changes',
      left(
        v_vendor_name || ' needs changes on: ' || coalesce(v_task.title, 'a task')
          || E'\n\n' || v_note,
        500
      ),
      '/#tasks',
      null
    );
  end if;

  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.return_vendor_task(uuid, text)
  to authenticated;


-- ── 5. get_portal_vendor_tasks — project return fields ─────────────────────────

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
      'vendorReturnNote', vt.vendor_return_note,
      'returnedAt',     vt.returned_at,
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
