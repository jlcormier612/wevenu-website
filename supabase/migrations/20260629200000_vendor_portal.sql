-- ============================================================================
-- Sprint 58: Vendor Portal Foundation
--
-- "What do I need to do for this event?"
-- The vendor portal answers this one question without requiring emails,
-- spreadsheets, or phone calls.
--
-- Architecture mirrors the client portal (Sprint 42):
--   Capability-scoped token → /v/{access_token}
--   Possession of token = authorized to view this vendor's assignments
--
-- Data sources are ALL EXISTING tables:
--   event_vendor_assignments → which events this vendor is on
--   timeline_entries WHERE 'vendor' = ANY(audiences) → their schedule
--   event_tasks WHERE visibility IN ('vendor_visible','vendor_owned') → their tasks
--   documents → files related to their events
--
-- No new content tables. The visibility architecture already built does the work.
-- ============================================================================

-- ── 1. vendor_portal_sessions ─────────────────────────────────────────────────

create table public.vendor_portal_sessions (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  vendor_id       uuid not null references public.vendors(id) on delete cascade,

  access_token    text not null unique default encode(gen_random_bytes(32), 'hex'),
  access_level    text not null default 'full' check (access_level in (
    'full',       -- can see and complete assigned tasks, upload docs
    'view_only'   -- read-only access, cannot complete tasks or upload
  )),
  label           text,   -- vendor's display name ("ABC Florals")
  last_accessed_at timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.vendor_portal_sessions enable row level security;

create policy "venue owner manages vendor portal sessions"
  on public.vendor_portal_sessions for all
  using (exists (
    select 1 from public.venues
    where id = vendor_portal_sessions.venue_id
      and owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.vendor_portal_sessions to authenticated;

-- ── 2. SECURITY DEFINER: get_vendor_portal_context ───────────────────────────
-- Validates token, returns vendor info + upcoming assigned events

create or replace function public.get_vendor_portal_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.vendor_portal_sessions%rowtype;
  v_vendor  public.vendors%rowtype;
  v_venue   public.venues%rowtype;
  v_events  jsonb;
begin
  select * into v_session
  from public.vendor_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  update public.vendor_portal_sessions
  set last_accessed_at = now() where id = v_session.id;

  select * into v_vendor from public.vendors where id = v_session.vendor_id;
  select * into v_venue  from public.venues  where id = v_session.venue_id;

  -- Upcoming assigned events
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'eventId',       e.id,
      'eventName',     e.name,
      'eventDate',     e.event_date,
      'eventType',     e.event_type,
      'status',        e.status,
      'coupleNames',   c.first_name || coalesce(' & ' || c.partner_first_name, ''),
      'arrivalTime',   eva.notes,   -- arrival time stored in assignment notes for now
      'role',          null         -- future: vendor role field on event_vendor_assignments
    ) order by e.event_date asc
  ), '[]'::jsonb)
  into v_events
  from public.event_vendor_assignments eva
  join public.events e on e.id = eva.event_id
  left join public.clients c on c.id = e.client_id
  where eva.vendor_id = v_session.vendor_id
    and eva.venue_id  = v_session.venue_id
    and e.status not in ('cancelled')
    and e.event_date >= current_date - 30;  -- show recent + upcoming

  return jsonb_build_object(
    'sessionId',   v_session.id,
    'accessLevel', v_session.access_level,
    'vendor', jsonb_build_object(
      'id',          v_vendor.id,
      'name',        v_vendor.name,
      'category',    v_vendor.category,
      'email',       v_vendor.email,
      'phone',       v_vendor.phone
    ),
    'venue', jsonb_build_object(
      'id',   v_venue.id,
      'name', v_venue.name
    ),
    'events', v_events
  );
end;
$$;

-- ── 3. get_vendor_event_timeline ─────────────────────────────────────────────
-- Returns vendor-tagged timeline entries for a specific event

create or replace function public.get_vendor_event_timeline(p_token text, p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.vendor_portal_sessions%rowtype;
  v_entries jsonb;
begin
  select * into v_session from public.vendor_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  -- Verify vendor is assigned to this event
  if not exists (
    select 1 from public.event_vendor_assignments
    where vendor_id = v_session.vendor_id
      and event_id  = p_event_id
      and venue_id  = v_session.venue_id
  ) then
    return jsonb_build_object('error', 'not_assigned');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',          te.id,
      'time',        te.entry_time::text,
      'title',       te.title,
      'description', te.description,
      'audiences',   te.audiences
    ) order by te.entry_time asc nulls last
  ), '[]'::jsonb)
  into v_entries
  from public.timeline_entries te
  where te.event_id = p_event_id
    and te.venue_id = v_session.venue_id
    and 'vendor' = any(te.audiences);

  return jsonb_build_object('entries', v_entries);
end;
$$;

-- ── 4. get_vendor_event_tasks ────────────────────────────────────────────────

create or replace function public.get_vendor_event_tasks(p_token text, p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.vendor_portal_sessions%rowtype;
  v_tasks   jsonb;
begin
  select * into v_session from public.vendor_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  if not exists (
    select 1 from public.event_vendor_assignments
    where vendor_id = v_session.vendor_id and event_id = p_event_id and venue_id = v_session.venue_id
  ) then return jsonb_build_object('error', 'not_assigned'); end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           t.id,
      'title',        t.title,
      'description',  t.description,
      'category',     t.category,
      'visibility',   t.visibility,
      'dueDate',      t.due_date,
      'status',       t.status,
      'isRequired',   t.is_required,
      'completedAt',  t.completed_at,
      'canComplete',  t.visibility = 'vendor_owned'
                      and t.status not in ('complete', 'waived', 'blocked')
                      and v_session.access_level = 'full'
    ) order by t.due_date asc nulls last, t.sort_order
  ), '[]'::jsonb)
  into v_tasks
  from public.event_tasks t
  where t.event_id  = p_event_id
    and t.venue_id  = v_session.venue_id
    and t.visibility in ('vendor_visible', 'vendor_owned')
    and t.status   != 'waived';

  return jsonb_build_object('tasks', v_tasks);
end;
$$;

-- ── 5. complete_vendor_task ──────────────────────────────────────────────────

create or replace function public.complete_vendor_task(p_token text, p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.vendor_portal_sessions%rowtype;
  v_task    public.event_tasks%rowtype;
begin
  select * into v_session from public.vendor_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level = 'view_only' then
    return jsonb_build_object('ok', false, 'error', 'view_only_access');
  end if;

  select * into v_task from public.event_tasks
  where id = p_task_id
    and venue_id  = v_session.venue_id
    and visibility = 'vendor_owned'
    and status not in ('complete', 'waived', 'blocked');
  if not found then return jsonb_build_object('ok', false, 'error', 'task_not_found'); end if;

  -- Verify vendor is assigned to this event
  if not exists (
    select 1 from public.event_vendor_assignments
    where vendor_id = v_session.vendor_id and event_id = v_task.event_id and venue_id = v_session.venue_id
  ) then return jsonb_build_object('ok', false, 'error', 'not_assigned'); end if;

  update public.event_tasks
  set status = 'complete', completed_at = now(), completed_by = 'vendor',
      source_type = 'manual'
  where id = p_task_id;

  -- Unblock dependents
  update public.event_tasks
  set status = 'pending'
  where depends_on_event_task_id = p_task_id and status = 'blocked' and venue_id = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_vendor_portal_context(text) to anon, authenticated;
grant execute on function public.get_vendor_event_timeline(text, uuid) to anon, authenticated;
grant execute on function public.get_vendor_event_tasks(text, uuid) to anon, authenticated;
grant execute on function public.complete_vendor_task(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
