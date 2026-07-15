-- ============================================================================
-- Seating — Release Completion (docs/seating-release-readiness.md)
--
-- PART A — root-cause fix, platform-wide (not Seating-specific):
--
--   Every portal-token-scoped RPC that needs "the event this session is for"
--   independently re-derived it on every call via the same fragile heuristic:
--   the client/venue's earliest non-cancelled event, by date. A session's
--   target event was never stored anywhere — only ever recomputed live.
--
--   The defect: this recomputation is not stable over time. A client with
--   exactly one event resolves correctly. The moment a second, earlier-dated
--   event is added for the same client (e.g. an engagement party booked
--   after the wedding was already booked), every *already-issued* portal
--   link for that client silently starts resolving to the new event instead
--   — confirmed empirically: guest/table data leaked across events for the
--   same client in a live transactional test.
--
--   Seven functions independently duplicated this exact pattern:
--   `_resolve_portal_ids` (13 downstream callers: Seating, RSVP questions,
--   Documents, Requests, venue info), `_resolve_portal_event_id` (declared,
--   currently uncalled), `get_portal_context` (the session's own entry
--   point), `complete_portal_task`, `get_guest_timeline`, `get_portal_tasks`,
--   `get_website_suggestions`, and `get_portal_run_of_show` (Timeline).
--   `update_portal_timeline_entry`/`add_portal_timeline_entry` were checked
--   and are NOT affected — they resolve via an already-known entry/section's
--   own `event_id`, never by re-deriving "the" event for a session.
--   `get_rsvp_context` (per-guest RSVP token), `get_wedding_website` (public
--   slug), `search_global` (coordinator-side), and `_trigger_rsvp_notification`
--   (a DB trigger) contain the same-shaped query for a structurally
--   different reason (no portal session/token involved at all) and are
--   deliberately left untouched — fixing them is a different problem with a
--   different risk surface, not "a client portal session resolves to the
--   correct booking."
--
--   The fix: `client_portal_sessions` gains a real, stable `event_id`,
--   snapshotted once (at session creation, via trigger — zero app-layer
--   change needed, `createPortalSession()` doesn't need to know about
--   events) and backfilled for every session that already exists today, so
--   no already-issued link is retroactively vulnerable either. Every one of
--   the seven functions above now prefers that stored value, falling back
--   to the same live lookup only for the (should-never-happen-post-backfill)
--   case where it's still null. One root cause, fixed once, inherited by
--   every current and future caller automatically.
--
-- PART B — Seating-specific fixes:
--   1. assign_guest_to_table/remove_guest_assignment did not block
--      access_level = 'view_only', only 'financial' — a read-only session
--      could write seating data. Now blocks both.
--   2. A guest who declines after being seated stayed shown as seated
--      (tables[].guests, stats.totalAssigned never filtered rsvp_status),
--      while stats.totalAttending did — breaking the "Assigned ≤ Attending"
--      invariant. Both now exclude declined guests, matching the filter
--      unassignedGuests already had. The guest_seat_assignments row itself
--      is never deleted (same guarantee as every other Seating edge case
--      already fixed this program) — an un-declined guest reappears at
--      their old table automatically.
--   3. Vendor-meal guests (is_vendor_meal = true) are auto-set to
--      rsvp_status = 'attending' by add_couple_guest, so they were counted
--      in totalAttending/totalAssigned alongside real wedding guests,
--      corrupting the "X of Y guests seated" figure shown to the couple,
--      the coordinator (via computeSeatingReadiness), and staff. They still
--      need real seats and still appear in tables[]/unassignedGuests/
--      needsReassignment — only the headcount-vs-capacity stat changes.
-- ============================================================================

-- ---- PART A ------------------------------------------------------------------

create or replace function public._current_event_for_client(p_client_id uuid, p_venue_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = p_venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc nulls last
  limit 1;
$$;

alter table public.client_portal_sessions
  add column if not exists event_id uuid references public.events(id) on delete set null;

-- Pin every already-issued session to whatever it resolves to today, so none
-- of them become newly vulnerable the next time an earlier-dated event is
-- added for the same client.
update public.client_portal_sessions
set event_id = public._current_event_for_client(client_id, venue_id)
where event_id is null;

create or replace function public._set_portal_session_event_id()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.event_id is null then
    new.event_id := public._current_event_for_client(new.client_id, new.venue_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_portal_session_event_id on public.client_portal_sessions;
create trigger trg_set_portal_session_event_id
  before insert on public.client_portal_sessions
  for each row execute function public._set_portal_session_event_id();


create or replace function public._resolve_portal_ids(p_token text)
returns table(event_id uuid, client_id uuid, venue_id uuid, access_level text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select
    coalesce(cps.event_id, public._current_event_for_client(cps.client_id, cps.venue_id)) as event_id,
    cps.client_id, cps.venue_id, cps.access_level
  from public.client_portal_sessions cps
  where cps.access_token = p_token
    and (cps.expires_at is null or cps.expires_at > now());
end;
$$;


create or replace function public._resolve_portal_event_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return null; end if;
  return coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));
end;
$$;


create or replace function public.get_portal_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session   public.client_portal_sessions%rowtype;
  v_client    public.clients%rowtype;
  v_event     record;
  v_venue     public.venues%rowtype;
  v_contact   public.client_contacts%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  update public.client_portal_sessions set last_accessed_at = now() where id = v_session.id;
  select * into v_client from public.clients where id = v_session.client_id;
  select e.id, e.event_date, e.event_type, e.status, e.name as event_name, e.guest_count, e.setup_time
  into v_event
  from public.events e
  where e.id = coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));
  select * into v_venue from public.venues where id = v_session.venue_id;
  -- Resolve contact if session is contact-specific
  if v_session.contact_id is not null then
    select * into v_contact from public.client_contacts where id = v_session.contact_id;
  end if;

  return jsonb_build_object(
    'sessionId',   v_session.id,
    'accessLevel', coalesce(v_contact.portal_role, v_session.access_level),
    'label',       coalesce(
      v_session.label,
      case when v_contact.id is not null
        then coalesce(v_contact.role_label, v_contact.first_name)
        else v_client.first_name || ' & ' || coalesce(v_client.partner_first_name, '')
      end
    ),
    'client', jsonb_build_object(
      'id', v_client.id, 'firstName', v_client.first_name, 'lastName', v_client.last_name,
      'partnerFirstName', v_client.partner_first_name, 'partnerLastName', v_client.partner_last_name,
      'eventType', v_client.event_type
    ),
    'contact', case when v_contact.id is not null then jsonb_build_object(
      'id', v_contact.id, 'firstName', v_contact.first_name, 'lastName', v_contact.last_name,
      'roleLabel', v_contact.role_label, 'portalRole', v_contact.portal_role
    ) else null end,
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'eventDate', v_event.event_date, 'eventType', v_event.event_type,
      'name', v_event.event_name, 'guestCount', v_event.guest_count, 'setupTime', v_event.setup_time
    ) else null end,
    'venue', jsonb_build_object('id', v_venue.id, 'name', v_venue.name, 'website', v_venue.website)
  );
end;
$$;


create or replace function public.complete_portal_task(p_token text, p_task_id uuid)
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

  -- view_only and financial cannot complete tasks
  if v_session.access_level in ('view_only', 'financial') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  v_event_id := coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));

  if not exists (
    select 1 from public.event_playbook_applications
    where event_id = v_event_id and venue_id = v_session.venue_id
      and kind = 'client' and released_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'task_not_found_or_not_completable');
  end if;

  select * into v_task
  from public.event_tasks
  where id        = p_task_id
    and event_id  = v_event_id
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


create or replace function public.get_guest_timeline(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session  public.client_portal_sessions%rowtype;
  v_event_id uuid;
  v_entries  jsonb;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  v_event_id := coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));

  if v_event_id is null then return jsonb_build_object('entries', '[]'::jsonb, 'count', 0); end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('time', te.entry_time::text, 'title', te.title, 'description', te.description)
    order by (te.section_id is null)::int, coalesce(ts.sort_order, 0), te.sort_order, te.created_at
  ), '[]'::jsonb)
  into v_entries
  from public.timeline_entries te
  left join public.timeline_sections ts on ts.id = te.section_id
  where te.event_id = v_event_id
    and 'guest' = any(te.audiences)
    and te.entry_time is not null;

  return jsonb_build_object(
    'entries', v_entries,
    'count', jsonb_array_length(v_entries)
  );
end;
$$;


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

  v_event_id := coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));

  if v_event_id is null then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  -- Draft → Release gate: no released Client Planning application for this
  -- event means nothing is visible yet, regardless of how many tasks exist.
  if not exists (
    select 1 from public.event_playbook_applications
    where event_id = v_event_id and venue_id = v_session.venue_id
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
  where t.event_id  = v_event_id
    and t.venue_id  = v_session.venue_id
    and t.visibility in ('client_visible', 'client_owned')
    and t.status   != 'waived';

  return jsonb_build_object('tasks', coalesce(v_tasks, '[]'::jsonb));
end;
$$;


create or replace function public.get_website_suggestions(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session  public.client_portal_sessions%rowtype;
  v_client   public.clients%rowtype;
  v_profile  public.couple_profiles%rowtype;
  v_event    record;
  v_venue    public.venues%rowtype;
  v_photos   jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then return null; end if;

  -- Couple names
  select * into v_client from public.clients where id = v_session.client_id;

  -- Personal profile (our_story, hashtag)
  select * into v_profile
  from public.couple_profiles
  where client_id = v_session.client_id;

  -- Primary event for this session (stable — see PART A above)
  select e.id, e.name, e.event_date, e.event_type
  into v_event
  from public.events e
  where e.id = coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));

  -- Venue
  select * into v_venue from public.venues where id = v_session.venue_id;

  -- Engagement photos (up to 12, ordered oldest-first so the earliest = most
  -- likely intended hero; couple can pick any)
  select coalesce(jsonb_agg(
    jsonb_build_object('url', cm.file_url, 'id', cm.id)
    order by cm.created_at asc
  ), '[]'::jsonb)
  into v_photos
  from public.client_media cm
  where cm.client_id  = v_session.client_id
    and cm.media_type = 'image'
    and cm.category   = 'engagement';

  return jsonb_build_object(
    -- "Emily & James" — used as default website headline
    'coupleNames', case
      when v_client.first_name is not null and v_client.partner_first_name is not null
        then v_client.first_name || ' & ' || v_client.partner_first_name
      when v_client.first_name is not null
        then v_client.first_name
      else null
    end,

    -- Story text from couple profile
    'story', case
      when v_profile.our_story is not null and trim(v_profile.our_story) != ''
        then jsonb_build_object('text', v_profile.our_story)
      else null
    end,

    -- Hashtag
    'hashtag', v_profile.wedding_hashtag,

    -- Event details
    'event', case when v_event.event_date is not null then jsonb_build_object(
      'name',      v_event.name,
      'eventDate', v_event.event_date,
      'eventType', v_event.event_type
    ) else null end,

    -- Venue details
    'venue', jsonb_build_object(
      'name',    v_venue.name,
      'address', trim(concat_ws(', ',
                   v_venue.address_line1,
                   v_venue.address_line2
                 )),
      'city',    v_venue.city,
      'state',   v_venue.state_region,
      'website', v_venue.website
    ),

    -- Engagement photos — first entry is the suggested cover photo
    'engagementPhotos', v_photos
  );
end;
$$;


create or replace function public.get_portal_run_of_show(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session        public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_event_id       uuid;
  v_entries        jsonb;
  v_sections       jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
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

  v_event_id := coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));

  if v_event_id is null then
    return jsonb_build_object('entries', '[]'::jsonb, 'sections', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          te.id,
        'title',       te.title,
        'description', te.description,
        'entryTime',   te.entry_time,
        'sectionId',   te.section_id,
        'sortOrder',   te.sort_order,
        'canEdit',     te.client_editable and v_effective_role in ('full_access', 'planning', 'couple'),
        'links', (
          select coalesce(
            jsonb_agg(jsonb_build_object('id', l.id, 'url', l.url, 'label', l.label) order by l.sort_order, l.created_at),
            '[]'::jsonb
          )
          from public.timeline_entry_links l
          where l.timeline_entry_id = te.id and l.venue_id = v_session.venue_id
        ),
        'attachments', (
          select coalesce(
            jsonb_agg(jsonb_build_object('id', a.id, 'name', coalesce(d.name, d.file_name), 'url', d.storage_url) order by a.sort_order, a.created_at),
            '[]'::jsonb
          )
          from public.timeline_entry_attachments a
          join public.documents d on d.id = a.document_id
          where a.timeline_entry_id = te.id and a.venue_id = v_session.venue_id
        )
      )
      order by te.entry_time asc nulls last, te.sort_order, te.created_at
    ),
    '[]'::jsonb
  )
  into v_entries
  from public.timeline_entries te
  where te.event_id = v_event_id
    and te.venue_id = v_session.venue_id
    and 'couple' = any(te.audiences);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id, 'name', s.name, 'sortOrder', s.sort_order,
        -- Only meaningful for a session that can actually mutate anything —
        -- same gate as canEdit above.
        'clientCanAdd', s.client_can_add and v_effective_role in ('full_access', 'planning', 'couple')
      )
      order by s.sort_order
    ),
    '[]'::jsonb
  )
  into v_sections
  from public.timeline_sections s
  where s.event_id = v_event_id
    and s.venue_id = v_session.venue_id
    and (
      -- Has at least one item already visible to the couple...
      exists (
        select 1 from public.timeline_entries te2
        where te2.section_id = s.id and 'couple' = any(te2.audiences)
      )
      -- ...or is addable by this session even if still empty, so a brand-new
      -- "Reception" section the venue opened up for the couple to fill in
      -- isn't invisible until the venue seeds it with a first item.
      or (s.client_can_add and v_effective_role in ('full_access', 'planning', 'couple'))
    );

  return jsonb_build_object('entries', v_entries, 'sections', v_sections);
end;
$$;


-- ---- PART B ------------------------------------------------------------------

create or replace function public.assign_guest_to_table(p_token text, p_guest_id uuid, p_table_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  if v_ids.access_level in ('financial', 'view_only') then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  if not exists (
    select 1 from public.floor_plan_objects o
    join public.floor_plans fp on fp.id = o.floor_plan_id
    where o.id = p_table_id
      and fp.event_id = v_ids.event_id
      and fp.client_access != 'hidden'
      and o.object_type in ('table_round', 'table_rect', 'table_oval')
  ) then
    return false;
  end if;

  insert into public.guest_seat_assignments (guest_id, table_object_id)
  values (p_guest_id, p_table_id)
  on conflict (guest_id) do update
    set table_object_id = excluded.table_object_id, assigned_at = now();

  return true;
end;
$$;


create or replace function public.remove_guest_assignment(p_token text, p_guest_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return false; end if;
  if v_ids.access_level in ('financial', 'view_only') then return false; end if;

  if not exists (
    select 1 from public.couple_guests
    where id = p_guest_id and client_id = v_ids.client_id and venue_id = v_ids.venue_id
  ) then
    return false;
  end if;

  delete from public.guest_seat_assignments where guest_id = p_guest_id;
  return true;
end;
$$;


create or replace function public.get_seating_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids        record;
  v_floor_plan record;
  v_had_prior_work boolean;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then return jsonb_build_object('error', 'invalid_token'); end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', '[]'::jsonb, 'hadPriorWork', false,
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0));
  end if;

  select fp.id, fp.name, fp.room_width_ft, fp.room_depth_ft,
         fp.background_image_url, fp.background_image_opacity
  into v_floor_plan
  from public.floor_plans fp
  where fp.event_id = v_ids.event_id and fp.client_access != 'hidden'
  order by fp.updated_at desc
  limit 1;

  if v_floor_plan.id is null then
    select exists (
      select 1 from public.guest_seat_assignments gsa
      join public.couple_guests g on g.id = gsa.guest_id
      where g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
    ) into v_had_prior_work;

    return jsonb_build_object(
      'floorPlan', null, 'tables', '[]'::jsonb, 'unassignedGuests', '[]'::jsonb,
      'needsReassignment', coalesce((
        select jsonb_agg(jsonb_build_object(
          'guestId',           g.id,
          'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
          'mealChoice',        g.meal_choice,
          'dietaryTags',       to_jsonb(g.dietary_tags),
          'accessibilityTags', to_jsonb(g.accessibility_tags),
          'isChild',           g.is_child,
          'isVendorMeal',      g.is_vendor_meal,
          'isWeddingParty',    g.is_wedding_party,
          'householdId',       g.household_id,
          'householdName',     h.name,
          'plusOneOfGuestId',  g.plus_one_of_guest_id
        ) order by g.first_name)
        from public.guest_seat_assignments gsa
        join public.couple_guests g on g.id = gsa.guest_id
        left join public.couple_households h on h.id = g.household_id
        where gsa.table_object_id is null
          and g.rsvp_status != 'declined'
          and g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
      ), '[]'::jsonb),
      'hadPriorWork', coalesce(v_had_prior_work, false),
      'stats', jsonb_build_object('totalAttending', 0, 'totalAssigned', 0, 'tableCount', 0, 'totalCapacity', 0)
    );
  end if;

  return jsonb_build_object(
    'floorPlan', jsonb_build_object(
      'id', v_floor_plan.id, 'name', v_floor_plan.name,
      'roomWidthFt', v_floor_plan.room_width_ft, 'roomDepthFt', v_floor_plan.room_depth_ft,
      'backgroundImageUrl', v_floor_plan.background_image_url,
      'backgroundImageOpacity', v_floor_plan.background_image_opacity
    ),
    'hadPriorWork', true,
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label', o.label, 'capacity', o.capacity,
        'x', o.x, 'y', o.y, 'width', o.width, 'height', o.height, 'rotation', o.rotation,
        'displayShape', o.display_shape,
        'guests', coalesce((
          select jsonb_agg(jsonb_build_object(
            'guestId',           g.id,
            'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
            'mealChoice',        g.meal_choice,
            'dietaryTags',       to_jsonb(g.dietary_tags),
            'accessibilityTags', to_jsonb(g.accessibility_tags),
            'isChild',           g.is_child,
            'isVendorMeal',      g.is_vendor_meal,
            'isWeddingParty',    g.is_wedding_party,
            'householdId',       g.household_id,
            'householdName',     h.name,
            'plusOneOfGuestId',  g.plus_one_of_guest_id
          ) order by g.first_name)
          from public.guest_seat_assignments gsa
          join public.couple_guests g on g.id = gsa.guest_id
          left join public.couple_households h on h.id = g.household_id
          where gsa.table_object_id = o.id
            and g.rsvp_status != 'declined'
        ), '[]'::jsonb)
      ) order by o.sort_order, o.label)
      from public.floor_plan_objects o
      where o.floor_plan_id = v_floor_plan.id
        and o.object_type in ('table_round', 'table_rect', 'table_oval')
    ), '[]'::jsonb),
    'unassignedGuests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guestId',           g.id,
        'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
        'mealChoice',        g.meal_choice,
        'dietaryTags',       to_jsonb(g.dietary_tags),
        'accessibilityTags', to_jsonb(g.accessibility_tags),
        'isChild',           g.is_child,
        'isVendorMeal',      g.is_vendor_meal,
        'isWeddingParty',    g.is_wedding_party,
        'householdId',       g.household_id,
        'householdName',     h.name,
        'plusOneOfGuestId',  g.plus_one_of_guest_id
      ) order by g.first_name)
      from public.couple_guests g
      left join public.couple_households h on h.id = g.household_id
      left join public.guest_seat_assignments gsa on gsa.guest_id = g.id
      where g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
        and g.rsvp_status = 'attending'
        and gsa.id is null
    ), '[]'::jsonb),
    'needsReassignment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guestId',           g.id,
        'name',              trim(g.first_name || ' ' || coalesce(g.last_name, '')),
        'mealChoice',        g.meal_choice,
        'dietaryTags',       to_jsonb(g.dietary_tags),
        'accessibilityTags', to_jsonb(g.accessibility_tags),
        'isChild',           g.is_child,
        'isVendorMeal',      g.is_vendor_meal,
        'isWeddingParty',    g.is_wedding_party,
        'householdId',       g.household_id,
        'householdName',     h.name,
        'plusOneOfGuestId',  g.plus_one_of_guest_id
      ) order by g.first_name)
      from public.guest_seat_assignments gsa
      join public.couple_guests g on g.id = gsa.guest_id
      left join public.couple_households h on h.id = g.household_id
      where gsa.table_object_id is null
        and g.rsvp_status != 'declined'
        and g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      -- Both totals exclude vendor-meal rows (catering/DJ/etc. auto-marked
      -- 'attending' by add_couple_guest so they can be seated, but never
      -- real wedding guests) and declined guests, so "X of Y seated" always
      -- means real, still-attending wedding guests and Assigned ≤ Attending
      -- always holds.
      'totalAttending', (
        select count(*) from public.couple_guests
        where client_id = v_ids.client_id and venue_id = v_ids.venue_id
          and rsvp_status = 'attending' and not is_vendor_meal
      ),
      'totalAssigned', (
        select count(*) from public.guest_seat_assignments gsa
        join public.couple_guests g on g.id = gsa.guest_id
        where gsa.table_object_id is not null and g.client_id = v_ids.client_id and g.venue_id = v_ids.venue_id
          and g.rsvp_status = 'attending' and not g.is_vendor_meal
      ),
      'tableCount', (
        select count(*) from public.floor_plan_objects
        where floor_plan_id = v_floor_plan.id and object_type in ('table_round', 'table_rect', 'table_oval')
      ),
      'totalCapacity', (
        select coalesce(sum(capacity), 0) from public.floor_plan_objects
        where floor_plan_id = v_floor_plan.id and object_type in ('table_round', 'table_rect', 'table_oval')
      )
    )
  );
end;
$$;

notify pgrst, 'reload schema';

-- ---- PART C — incidental fix, discovered while verifying Documents as instructed --

-- get_couple_documents referenced invoices.total_amount, a column that does
-- not exist (the real column is `total`) — every call to this RPC errored,
-- meaning the portal's Documents tab has been completely broken for any
-- couple with a shared invoice, unrelated to Parts A/B above (this function
-- never called _resolve_portal_ids's old buggy inline logic — it already
-- delegated correctly; the bug is a stale column reference from a prior
-- invoices schema). Fixed as a one-line correction since it was found while
-- verifying Documents per this task's own instruction to check "any other
-- portal capability" — not expanded further.
create or replace function public.get_couple_documents(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null then return null; end if;

  return jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(doc order by (doc->>'createdAt') desc)
      from (
        -- Signed contracts shared by venue
        select jsonb_build_object(
          'id',          c.id,
          'docType',     'contract',
          'name',        coalesce(nullif(trim(c.title),''), 'Venue Contract'),
          'status',      c.status,
          'signedAt',    c.signed_at,
          'amount',      null,
          'fileUrl',     null,
          'uploadedBy',  'venue',
          'createdAt',   c.created_at
        )
        from contracts c
        where c.client_id = v_ids.client_id
          and c.is_couple_visible = true

        union all

        -- Invoices shared by venue
        select jsonb_build_object(
          'id',         i.id,
          'docType',    'invoice',
          'name',       'Invoice ' || coalesce(i.invoice_number::text, '#'),
          'status',     i.status,
          'signedAt',   null,
          'amount',     i.total,
          'fileUrl',    null,
          'uploadedBy', 'venue',
          'createdAt',  i.created_at
        )
        from invoices i
        where i.client_id = v_ids.client_id
          and i.is_couple_visible = true

        union all

        -- Couple-uploaded or venue-shared documents
        select jsonb_build_object(
          'id',              cd.id,
          'docType',         coalesce(cd.source_type, 'upload'),
          'name',            cd.name,
          'status',          null,
          'signedAt',        null,
          'amount',          null,
          'fileUrl',         cd.file_url,
          'fileSize',        cd.file_size,
          'mimeType',        cd.mime_type,
          'uploadedBy',      cd.uploaded_by,
          'shareWithVenue',  cd.share_with_venue,
          'createdAt',       cd.created_at
        )
        from couple_documents cd
        where cd.client_id = v_ids.client_id
      ) docs(doc)
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
