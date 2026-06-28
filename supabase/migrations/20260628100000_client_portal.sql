-- ============================================================================
-- Sprint 42: Client Portal Foundation
--
-- Architecture: capability-scoped token grants access to a couple's workspace.
-- The token is NOT user authentication — it's a narrowly-scoped capability:
-- "view and interact with event {id} as a client"
--
-- This table is intentionally simple for Sprint 42. When client_contacts is
-- built, each contact will get their own row here with their own access_level.
--
-- The four-question access model governs all portal data:
--   Who can see it?      → visibility field + access_level on this table
--   Who can edit it?     → coordinator only for most objects
--   Who can complete it? → couple for client_owned tasks
--   Who gets notified?   → determined per object type, NOT from this table
--
-- Messaging permissions are SEPARATE from portal permissions (Weven lesson).
-- Portal access ≠ message thread access. See message_thread_participants (future).
-- ============================================================================

create table public.client_portal_sessions (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  -- The token goes in the URL: /p/{access_token}
  -- Long-lived — couples bookmark their workspace link
  access_token     text not null unique default encode(gen_random_bytes(32), 'hex'),
  -- Access level determines which sections of the portal are visible.
  -- 'couple' = full planning workspace (tasks, payments, docs, messages in future)
  -- 'planning' = tasks + documents only (no payments, no messages)
  -- 'financial' = invoices and payments only
  -- 'view_only' = read-only across permitted sections, no completions
  access_level     text not null default 'couple'
    check (access_level in ('couple', 'planning', 'financial', 'view_only')),
  -- Human-readable label for when multiple people have portal access
  -- e.g. "Emily & James", "Dad (Jim Carter)", "Sarah (MOH)"
  label            text,
  -- Intent signal: last time this link was used
  last_accessed_at timestamptz,
  -- Null = no expiry (standard for couple links)
  expires_at       timestamptz,
  created_at       timestamptz not null default now()
);

-- RLS: coordinators can manage their venue's portal sessions
alter table public.client_portal_sessions enable row level security;

create policy "venue owner manages portal sessions"
  on public.client_portal_sessions
  for all
  using (exists (
    select 1 from public.venues
    where id = client_portal_sessions.venue_id
      and owner_user_id = auth.uid()
  ));

-- ============================================================================
-- SECURITY DEFINER functions — public portal access without bypassing RLS
--
-- Pattern: validate token → look up data → return exactly what's needed
-- The function runs as the postgres superuser so it can read across RLS,
-- but only returns what the token is scoped to see.
-- ============================================================================

-- get_portal_context: validate token, return venue branding + event summary
-- Called on every portal page load to check token validity and get context.
create or replace function public.get_portal_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.client_portal_sessions%rowtype;
  v_client   public.clients%rowtype;
  v_event   record;
  v_venue    public.venues%rowtype;
begin
  -- Validate token
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());

  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- Track last accessed (intent signal)
  update public.client_portal_sessions
  set last_accessed_at = now()
  where id = v_session.id;

  -- Load client
  select * into v_client
  from public.clients
  where id = v_session.client_id;

  -- Load upcoming event
  select e.id, e.event_date, e.event_type, e.status, e.name as event_name,
         e.guest_count, e.setup_time
  into v_event
  from public.events e
  where e.client_id = v_session.client_id
    and e.venue_id = v_session.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc
  limit 1;

  -- Load venue (for branding)
  select * into v_venue
  from public.venues
  where id = v_session.venue_id;

  return jsonb_build_object(
    'sessionId',    v_session.id,
    'accessLevel',  v_session.access_level,
    'label',        coalesce(v_session.label, v_client.first_name || ' & ' || coalesce(v_client.partner_first_name, '')),
    'client', jsonb_build_object(
      'id',             v_client.id,
      'firstName',      v_client.first_name,
      'lastName',       v_client.last_name,
      'partnerFirstName', v_client.partner_first_name,
      'partnerLastName',  v_client.partner_last_name,
      'eventType',      v_client.event_type
    ),
    'event', case when v_event.id is not null then jsonb_build_object(
      'id',         v_event.id,
      'eventDate',  v_event.event_date,
      'eventType',  v_event.event_type,
      'name',       v_event.event_name,
      'guestCount', v_event.guest_count,
      'setupTime',  v_event.setup_time
    ) else null end,
    'venue', jsonb_build_object(
      'id',          v_venue.id,
      'name',        v_venue.name,
      'website',     v_venue.website
    )
  );
end;
$$;

-- get_portal_tasks: return event tasks visible to this portal session
-- Filters by visibility: client_visible OR client_owned
create or replace function public.get_portal_tasks(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_event   record;
  v_tasks   jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- view_only and planning can see tasks, financial cannot
  if v_session.access_level = 'financial' then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  -- Find the event
  select id, event_date into v_event
  from public.events
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
    and status not in ('cancelled')
  order by event_date asc limit 1;

  if not found then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',          t.id,
      'title',       t.title,
      'description', t.description,
      'category',    t.category,
      'ownerType',   t.owner_type,
      'visibility',  t.visibility,
      'dueDate',     t.due_date,
      'status',      t.status,
      'isRequired',  t.is_required,
      'completedAt', t.completed_at,
      'canComplete',  t.visibility = 'client_owned' and t.status not in ('complete', 'waived', 'blocked')
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

-- complete_portal_task: couple marks a client_owned task complete
-- Guards: must be client_owned, not already complete/blocked
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

-- Grant table access to authenticated coordinators
grant select, insert, update, delete on public.client_portal_sessions to authenticated;

-- Grant anon + authenticated users the ability to call these functions
grant execute on function public.get_portal_context(text) to anon, authenticated;
grant execute on function public.get_portal_tasks(text) to anon, authenticated;
grant execute on function public.complete_portal_task(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
