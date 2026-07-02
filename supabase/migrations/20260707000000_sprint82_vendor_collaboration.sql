-- ============================================================================
-- Sprint 82: Vendor Collaboration Portal
--
-- "Vendors are still mostly outside the system. This sprint brings them in."
--
-- Changes:
--   1. event_vendor_assignments — add setup_location, load_in_notes, expose check-in fields
--   2. documents — add shared_with_vendors flag
--   3. get_vendor_portal_context — updated to return assignment details + check-in status
--   4. vendor_self_checkin — vendor marks themselves arrived / setup complete
--   5. get_vendor_event_documents — returns documents shared with vendors
-- ============================================================================

-- ── 1. event_vendor_assignments — new collaboration columns ──────────────────

alter table public.event_vendor_assignments
  add column if not exists setup_location text,
  add column if not exists load_in_notes  text;

-- ── 2. documents — vendor sharing flag ───────────────────────────────────────

alter table public.documents
  add column if not exists shared_with_vendors boolean not null default false;

-- ── 3. get_vendor_portal_context — updated ───────────────────────────────────
-- Now returns assignment_id, arrival_time (proper column), check-in timestamps,
-- setup_location, and load_in_notes so the portal can show full arrival context.

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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'eventId',        e.id,
      'eventName',      e.name,
      'eventDate',      e.event_date,
      'eventType',      e.event_type,
      'status',         e.status,
      'coupleNames',    c.first_name || coalesce(' & ' || c.partner_first_name, ''),
      'assignmentId',   eva.id,
      'arrivalTime',    eva.arrival_time::text,
      'setupLocation',  eva.setup_location,
      'loadInNotes',    eva.load_in_notes,
      'checkedInAt',    eva.checked_in_at,
      'setupCompleteAt', eva.setup_complete_at,
      'role',           null
    ) order by e.event_date asc
  ), '[]'::jsonb)
  into v_events
  from public.event_vendor_assignments eva
  join public.events e on e.id = eva.event_id
  left join public.clients c on c.id = e.client_id
  where eva.vendor_id = v_session.vendor_id
    and eva.venue_id  = v_session.venue_id
    and e.status not in ('cancelled')
    and e.event_date >= current_date - 30;

  return jsonb_build_object(
    'sessionId',   v_session.id,
    'accessLevel', v_session.access_level,
    'vendor', jsonb_build_object(
      'id',       v_vendor.id,
      'name',     v_vendor.name,
      'category', v_vendor.category,
      'email',    v_vendor.email,
      'phone',    v_vendor.phone
    ),
    'venue', jsonb_build_object(
      'id',   v_venue.id,
      'name', v_venue.name
    ),
    'events', v_events
  );
end;
$$;

-- ── 4. vendor_self_checkin ────────────────────────────────────────────────────
-- Vendor marks themselves arrived or setup complete from the portal.
-- p_field: 'checked_in' | 'setup_complete'

create or replace function public.vendor_self_checkin(
  p_token    text,
  p_event_id uuid,
  p_field    text   -- 'checked_in' or 'setup_complete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session    public.vendor_portal_sessions%rowtype;
  v_assignment public.event_vendor_assignments%rowtype;
begin
  if p_field not in ('checked_in', 'setup_complete') then
    return jsonb_build_object('ok', false, 'error', 'invalid_field');
  end if;

  select * into v_session from public.vendor_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if v_session.access_level = 'view_only' then
    return jsonb_build_object('ok', false, 'error', 'view_only_access');
  end if;

  select * into v_assignment from public.event_vendor_assignments
  where vendor_id = v_session.vendor_id
    and event_id  = p_event_id
    and venue_id  = v_session.venue_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_assigned'); end if;

  if p_field = 'checked_in' then
    update public.event_vendor_assignments
    set checked_in_at = case when checked_in_at is null then now() else null end
    where id = v_assignment.id;
  else
    update public.event_vendor_assignments
    set setup_complete_at = case when setup_complete_at is null then now() else null end
    where id = v_assignment.id;
  end if;

  -- Re-fetch to return current state
  select * into v_assignment from public.event_vendor_assignments where id = v_assignment.id;

  return jsonb_build_object(
    'ok',              true,
    'checkedInAt',     v_assignment.checked_in_at,
    'setupCompleteAt', v_assignment.setup_complete_at
  );
end;
$$;

-- ── 5. get_vendor_event_documents ────────────────────────────────────────────
-- Returns documents marked shared_with_vendors=true for a given event.

create or replace function public.get_vendor_event_documents(
  p_token    text,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.vendor_portal_sessions%rowtype;
  v_docs    jsonb;
begin
  select * into v_session from public.vendor_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  if not exists (
    select 1 from public.event_vendor_assignments
    where vendor_id = v_session.vendor_id
      and event_id  = p_event_id
      and venue_id  = v_session.venue_id
  ) then return jsonb_build_object('error', 'not_assigned'); end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',         d.id,
      'name',       d.name,
      'category',   d.category,
      'storageUrl', d.storage_url,
      'mimeType',   d.mime_type,
      'notes',      d.notes
    ) order by d.category, d.name
  ), '[]'::jsonb)
  into v_docs
  from public.documents d
  where d.event_id          = p_event_id
    and d.venue_id           = v_session.venue_id
    and d.shared_with_vendors = true;

  return jsonb_build_object('documents', v_docs);
end;
$$;

grant execute on function public.vendor_self_checkin(text, uuid, text) to anon, authenticated;
grant execute on function public.get_vendor_event_documents(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
