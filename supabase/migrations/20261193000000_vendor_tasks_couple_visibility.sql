-- ============================================================================
-- Vendor → couple shared tasks (portal projection of vendor_tasks)
--
-- Vendors opt each event-scoped personal task into couple visibility:
--   private  — couple cannot see (default)
--   visible  — couple can view notes/attachments
--   owned    — couple can view and mark complete
--
-- Do NOT copy into event_tasks. Venue boards do not list these in v1.
-- Only event-scoped rows with an active event_vendor_assignments row
-- are eligible. Portal access is token-gated via security-definer RPCs
-- (same pattern as get_couple_documents); no anon table RLS.
-- ============================================================================


-- ── 1. Columns ────────────────────────────────────────────────────────────────

alter table public.vendor_tasks
  add column if not exists couple_visibility text not null default 'private',
  add column if not exists completed_by text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vendor_tasks_couple_visibility_check'
      and conrelid = 'public.vendor_tasks'::regclass
  ) then
    alter table public.vendor_tasks
      add constraint vendor_tasks_couple_visibility_check
      check (couple_visibility in ('private', 'visible', 'owned'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'vendor_tasks_completed_by_check'
      and conrelid = 'public.vendor_tasks'::regclass
  ) then
    alter table public.vendor_tasks
      add constraint vendor_tasks_completed_by_check
      check (completed_by is null or completed_by in ('couple', 'vendor'));
  end if;
end $$;

comment on column public.vendor_tasks.couple_visibility is
  'private | visible | owned — vendor opt-in share with the couple portal.';
comment on column public.vendor_tasks.completed_by is
  'couple | vendor | null — who last completed the task.';

create index if not exists vendor_tasks_event_couple_visibility
  on public.vendor_tasks (event_id, couple_visibility)
  where event_id is not null and couple_visibility <> 'private';


-- ── 2. get_portal_vendor_tasks ────────────────────────────────────────────────
-- Separate payload from get_portal_tasks (venue event_tasks). Not gated by
-- Client Planning playbook release — these are vendor-owned shares.

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
      'canComplete',
        vt.couple_visibility = 'owned'
        and vt.status = 'pending'
        and v_effective_role in ('full_access', 'planning', 'couple')
        and v_session.access_level not in ('view_only', 'financial'),
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


-- ── 3. complete_portal_vendor_task ────────────────────────────────────────────
-- Couple may complete only when couple_visibility = 'owned'. Notifies vendor.

create or replace function public.complete_portal_vendor_task(
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

  if v_task.status = 'complete' then
    return jsonb_build_object('ok', true, 'alreadyComplete', true);
  end if;

  select eva.id into v_assignment_id
  from public.event_vendor_assignments eva
  where eva.event_id = v_task.event_id
    and eva.vendor_id = v_task.vendor_id
  limit 1;

  if v_assignment_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_assignment');
  end if;

  update public.vendor_tasks
  set
    status = 'complete',
    completed_at = now(),
    completed_by = 'couple'
  where id = v_task.id;

  select coalesce(nullif(trim(business_name), ''), 'Vendor')
  into v_vendor_name
  from public.vendors
  where id = v_task.vendor_id;

  perform public.create_vendor_notification(
    v_task.vendor_id,
    v_task.event_id,
    v_assignment_id,
    'task_completed',
    'Couple completed a task',
    left(v_task.title, 160),
    '/vendor/events/' || v_assignment_id::text || '?tab=tasks&taskId=' || v_task.id::text,
    '✅'
  );

  return jsonb_build_object('ok', true, 'vendorName', v_vendor_name);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.complete_portal_vendor_task(text, uuid) to anon, authenticated;
