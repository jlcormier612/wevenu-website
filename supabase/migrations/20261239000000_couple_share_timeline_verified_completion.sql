-- ============================================================================
-- Couple Tasks Impl 6 — Verified Share Timeline Completion
--
-- Durable couple→vendor timeline share (per event + vendor). Completes only
-- pending owned vendor_tasks with action_type = 'share_timeline' for that
-- vendor. One-shot Luv type timeline_shared_with_vendor (same (client_id,
-- celebration_type) uniqueness as other couple milestones).
-- ============================================================================

-- ── 1. Typed couple action on vendor tasks / template items ──────────────────

alter table public.vendor_tasks
  add column if not exists action_type text;

alter table public.vendor_task_template_items
  add column if not exists action_type text;

comment on column public.vendor_tasks.action_type is
  'Optional couple-portal action; share_timeline = verified share with this vendor. Never inferred from title.';
comment on column public.vendor_task_template_items.action_type is
  'Copied onto vendor_tasks.action_type when the template item is applied.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vendor_tasks_action_type_check'
      and conrelid = 'public.vendor_tasks'::regclass
  ) then
    alter table public.vendor_tasks
      add constraint vendor_tasks_action_type_check
      check (action_type is null or action_type in ('share_timeline'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'vendor_task_template_items_action_type_check'
      and conrelid = 'public.vendor_task_template_items'::regclass
  ) then
    alter table public.vendor_task_template_items
      add constraint vendor_task_template_items_action_type_check
      check (action_type is null or action_type in ('share_timeline'));
  end if;
end $$;

-- ── 2. Durable share record (first share wins; re-share idempotent) ───────────

create table if not exists public.event_vendor_timeline_shares (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.events(id) on delete cascade,
  vendor_id            uuid not null references public.vendors(id) on delete cascade,
  shared_at            timestamptz not null default now(),
  shared_by_client_id  uuid references public.clients(id) on delete set null,
  source               text not null default 'couple_portal',
  unique (event_id, vendor_id)
);

create index if not exists event_vendor_timeline_shares_event
  on public.event_vendor_timeline_shares (event_id);

create index if not exists event_vendor_timeline_shares_vendor
  on public.event_vendor_timeline_shares (vendor_id);

comment on table public.event_vendor_timeline_shares is
  'Couple successfully shared the event timeline with a specific assigned vendor.';

alter table public.event_vendor_timeline_shares enable row level security;

drop policy if exists event_vendor_timeline_shares_venue_select on public.event_vendor_timeline_shares;
create policy event_vendor_timeline_shares_venue_select
  on public.event_vendor_timeline_shares for select
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.venue_id = public.current_user_venue_id()
    )
  );

grant select on public.event_vendor_timeline_shares to authenticated;
grant select, insert, update on public.event_vendor_timeline_shares to service_role;

-- ── 3. Luv celebration type ───────────────────────────────────────────────────

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
    'questionnaire_submitted',
    'insurance_uploaded',
    'timeline_shared_with_vendor'
  ));

-- ── 4. Portal projection includes actionType; block Mark-complete for share ───

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
      'canComplete',
        vt.couple_visibility = 'owned'
        and vt.status = 'pending'
        and coalesce(vt.action_type, '') is distinct from 'share_timeline'
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

-- ── 5. Dedicated share RPC — only durable success completes tasks ─────────────

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
      and vt.couple_visibility = 'owned'
      and vt.action_type = 'share_timeline'
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
