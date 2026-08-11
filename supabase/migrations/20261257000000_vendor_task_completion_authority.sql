-- ============================================================================
-- Vendor Task Completion Authority
--
-- Durable enum on vendor_tasks (SoT after backfill). Derived at write time from
-- couple_visibility × action_type using the verified Phase 1 mapping:
--
--   private                         → vendor_confirm
--   visible                         → vendor_confirm
--   owned + action_type IS NULL     → couple_acknowledge
--   owned + share_timeline          → action_verified
--
-- share_timeline remains the ONLY action_verified path.
-- Template items do not store visibility (chosen at apply) — stamp on create/apply.
-- ============================================================================

-- ── 1. Column + backfill + NOT NULL ───────────────────────────────────────────

alter table public.vendor_tasks
  add column if not exists completion_authority text;

comment on column public.vendor_tasks.completion_authority is
  'couple_acknowledge | vendor_confirm | action_verified — who may finalize completion. Stamped at write from visibility×action_type; durable SoT thereafter.';

-- Backfill ONLY from verified mapping (visibility + action_type). No title heuristics.
update public.vendor_tasks
set completion_authority = case
  when couple_visibility = 'owned' and action_type = 'share_timeline' then 'action_verified'
  when couple_visibility = 'owned' then 'couple_acknowledge'
  else 'vendor_confirm'
end
where completion_authority is null;

alter table public.vendor_tasks
  alter column completion_authority set default 'vendor_confirm';

alter table public.vendor_tasks
  alter column completion_authority set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vendor_tasks_completion_authority_check'
      and conrelid = 'public.vendor_tasks'::regclass
  ) then
    alter table public.vendor_tasks
      add constraint vendor_tasks_completion_authority_check
      check (completion_authority in (
        'couple_acknowledge',
        'vendor_confirm',
        'action_verified'
      ));
  end if;
end $$;

create index if not exists vendor_tasks_completion_authority_pending
  on public.vendor_tasks (event_id, completion_authority, status)
  where event_id is not null and status = 'pending';


-- ── 2. get_portal_vendor_tasks — canComplete from durable authority ───────────

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
      'actionType',     vt.action_type,
      'completionAuthority', vt.completion_authority,
      'canComplete',
        vt.completion_authority = 'couple_acknowledge'
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


-- ── 3. complete_portal_vendor_task — couple_acknowledge only ──────────────────
-- Hardens former UI-only share_timeline gap: action_verified cannot Mark complete.

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

  if v_task.completion_authority is distinct from 'couple_acknowledge' then
    if v_task.couple_visibility is distinct from 'owned' then
      return jsonb_build_object('ok', false, 'error', 'not_owned');
    end if;
    return jsonb_build_object('ok', false, 'error', 'verified_action_required');
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
    '/vendor/events/' || v_assignment_id::text || '?tab=tasks&focus=' || v_task.id::text,
    '✅'
  );

  return jsonb_build_object('ok', true, 'vendorName', v_vendor_name);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.complete_portal_vendor_task(text, uuid) to anon, authenticated;


-- ── 4. share_portal_timeline_with_vendor — action_verified only ───────────────

create or replace function public.share_portal_timeline_with_vendor(
  p_token     text,
  p_vendor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids              record;
  v_session          public.client_portal_sessions%rowtype;
  v_effective_role   text;
  v_assignment_id    uuid;
  v_share_id         uuid;
  v_inserted         boolean := false;
  v_completed_ids    uuid[] := '{}';
  v_celebrated       boolean := false;
  v_first_task_id    uuid;
  v_vendor_name      text;
  v_celeb_id         uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null or v_ids.event_id is null or v_ids.venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if p_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_vendor');
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

  select eva.id into v_assignment_id
  from public.event_vendor_assignments eva
  where eva.event_id = v_ids.event_id
    and eva.vendor_id = p_vendor_id
  limit 1;

  if v_assignment_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_assignment');
  end if;

  select coalesce(nullif(trim(business_name), ''), 'Vendor')
  into v_vendor_name
  from public.vendors
  where id = p_vendor_id;

  insert into public.event_vendor_timeline_shares (
    event_id, vendor_id, shared_by_client_id, source
  )
  values (
    v_ids.event_id, p_vendor_id, v_ids.client_id, 'couple_portal'
  )
  on conflict (event_id, vendor_id) do nothing
  returning id into v_share_id;

  if v_share_id is not null then
    v_inserted := true;
  else
    select id into v_share_id
    from public.event_vendor_timeline_shares
    where event_id = v_ids.event_id
      and vendor_id = p_vendor_id;
  end if;

  -- Minimal vendor-readable timing: ensure 'vendors' audience on event entries.
  update public.timeline_entries te
  set audiences = case
    when te.audiences is null then array['vendors']::text[]
    when not (te.audiences @> array['vendors']::text[]) then te.audiences || array['vendors']::text[]
    else te.audiences
  end
  where te.event_id = v_ids.event_id
    and not (coalesce(te.audiences, '{}'::text[]) @> array['vendors']::text[]);

  with completed as (
    update public.vendor_tasks vt
    set
      status = 'complete',
      completed_at = now(),
      completed_by = 'couple'
    where vt.event_id = v_ids.event_id
      and vt.vendor_id = p_vendor_id
      and vt.completion_authority = 'action_verified'
      and vt.status = 'pending'
    returning vt.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]), (array_agg(id))[1]
  into v_completed_ids, v_first_task_id
  from completed;

  -- Celebrate only on first durable share insert (no historical invent on reconcile).
  if v_inserted then
    insert into public.luv_celebrations (
      venue_id, client_id, event_id, celebration_type, entity_id
    )
    values (
      v_ids.venue_id,
      v_ids.client_id,
      v_ids.event_id,
      'timeline_shared_with_vendor',
      coalesce(v_first_task_id, v_share_id)
    )
    on conflict (client_id, celebration_type) do nothing
    returning id into v_celeb_id;

    v_celebrated := (v_celeb_id is not null);
  end if;

  return jsonb_build_object(
    'ok', true,
    'shareId', v_share_id,
    'alreadyShared', not v_inserted,
    'celebrated', v_celebrated,
    'completedTaskIds', to_jsonb(coalesce(v_completed_ids, '{}'::uuid[])),
    'vendorId', p_vendor_id,
    'vendorName', v_vendor_name
  );
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.share_portal_timeline_with_vendor(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
