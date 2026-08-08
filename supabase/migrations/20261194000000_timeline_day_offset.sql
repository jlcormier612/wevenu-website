-- ============================================================================
-- Multi-day timeline support — one timeline per event, entries can land on
-- calendar days relative to events.event_date via day_offset (0-based).
-- When event_end_date > event_date the UI segments by day; single-day stays
-- section-first with day_offset defaulting to 0.
-- ============================================================================

alter table public.timeline_entries
  add column if not exists day_offset integer not null default 0;

alter table public.timeline_entries
  drop constraint if exists timeline_entries_day_offset_nonneg;

alter table public.timeline_entries
  add constraint timeline_entries_day_offset_nonneg check (day_offset >= 0);

update public.timeline_entries set day_offset = 0 where day_offset is null;

drop index if exists public.timeline_entries_event;
create index timeline_entries_event
  on public.timeline_entries (event_id, day_offset, entry_time asc nulls last, sort_order, created_at);

-- Soft-clamp helper: 0 .. (event_end_date - event_date), or 0 when single-day.
create or replace function public.timeline_clamp_day_offset(p_event_id uuid, p_day_offset integer)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select greatest(
    0,
    least(
      coalesce(p_day_offset, 0),
      greatest(
        0,
        coalesce(
          (
            select (e.event_end_date - e.event_date)
            from public.events e
            where e.id = p_event_id
              and e.event_end_date is not null
              and e.event_end_date > e.event_date
          ),
          0
        )
      )
    )
  );
$$;

grant execute on function public.timeline_clamp_day_offset(uuid, integer) to authenticated, anon;

-- ── Venue merged read ───────────────────────────────────────────────────────

create or replace function public.get_event_timeline_merged(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue_id      uuid;
  v_snapshot      jsonb;
  v_submitted_at  timestamptz;
begin
  select venue_id into v_venue_id from public.events where id = p_event_id;
  if v_venue_id is null or v_venue_id is distinct from public.current_user_venue_id() then
    return jsonb_build_object('error', 'not_found');
  end if;

  select snapshot, created_at into v_snapshot, v_submitted_at
  from public.timeline_submissions
  where event_id = p_event_id and venue_id = v_venue_id
  order by created_at desc limit 1;

  return jsonb_build_object(
    'lastSubmittedAt', v_submitted_at,
    'entries',
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', te.id, 'title', te.title, 'description', te.description, 'notes', te.notes,
            'entryTime', te.entry_time, 'dayOffset', te.day_offset,
            'sectionId', te.section_id, 'sortOrder', te.sort_order,
            'owner', te.owner, 'lockState', te.lock_state, 'audiences', te.audiences,
            'status', te.status, 'assignedToStaffId', te.assigned_to_staff_id, 'assignedToName', vs.full_name,
            'createdAt', te.created_at, 'updatedAt', te.updated_at
          ) order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
        ), '[]'::jsonb)
        from public.timeline_entries te
        left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
        where te.event_id = p_event_id and te.venue_id = v_venue_id and te.owner = 'venue'
      )
      ||
      (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', (item->>'id')::uuid, 'title', item->>'title', 'description', item->>'description', 'notes', null,
            'entryTime', item->>'entryTime',
            'dayOffset', coalesce((item->>'dayOffset')::int, 0),
            'sectionId', nullif(item->>'sectionId', ''), 'sortOrder', (item->>'sortOrder')::int,
            'owner', 'client', 'lockState', 'editable',
            'audiences', coalesce(item->'audiences', '[]'::jsonb),
            'status', coalesce(te.status, 'not_started'),
            'assignedToStaffId', te.assigned_to_staff_id, 'assignedToName', vs.full_name,
            'createdAt', te.created_at, 'updatedAt', te.updated_at
          ) order by coalesce((item->>'dayOffset')::int, 0), (item->>'entryTime') asc nulls last, (item->>'sortOrder')::int
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(v_snapshot, '[]'::jsonb)) item
        left join public.timeline_entries te on te.id = (item->>'id')::uuid
        left join public.venue_staff vs on vs.id = te.assigned_to_staff_id
      )
  );
end;
$$;

-- ── Couple portal read ──────────────────────────────────────────────────────

create or replace function public.get_portal_run_of_show(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session          public.client_portal_sessions%rowtype;
  v_effective_role   text;
  v_event_id         uuid;
  v_entries          jsonb;
  v_sections         jsonb;
  v_last_submitted   timestamptz;
  v_submitted_count  integer;
  v_live_count       integer;
  v_has_unpublished  boolean;
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

  select id into v_event_id
  from public.events
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
  order by event_date asc
  limit 1;

  if v_event_id is null then
    return jsonb_build_object('entries', '[]'::jsonb, 'sections', '[]'::jsonb, 'lastSubmittedAt', null, 'hasUnpublishedChanges', false);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          te.id,
        'title',       te.title,
        'description', te.description,
        'entryTime',   te.entry_time,
        'dayOffset',   te.day_offset,
        'sectionId',   te.section_id,
        'sortOrder',   te.sort_order,
        'owner',       te.owner,
        'lockState',   te.lock_state,
        'audiences',   te.audiences,
        'canEdit',       te.owner = 'client' and v_effective_role in ('full_access', 'planning', 'couple'),
        'canManageVisibility', te.owner = 'client' and v_effective_role in ('full_access', 'planning', 'couple'),
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
      order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
    ),
    '[]'::jsonb
  )
  into v_entries
  from public.timeline_entries te
  where te.event_id = v_event_id
    and te.venue_id = v_session.venue_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id, 'name', s.name, 'sortOrder', s.sort_order,
        'clientCanAdd', s.client_can_add and v_effective_role in ('full_access', 'planning', 'couple')
      )
      order by s.sort_order
    ),
    '[]'::jsonb
  )
  into v_sections
  from public.timeline_sections s
  where s.event_id = v_event_id
    and s.venue_id = v_session.venue_id;

  select created_at, entry_count into v_last_submitted, v_submitted_count
  from public.timeline_submissions
  where event_id = v_event_id and venue_id = v_session.venue_id
  order by created_at desc limit 1;

  select count(*) into v_live_count
  from public.timeline_entries
  where event_id = v_event_id and venue_id = v_session.venue_id and owner = 'client';

  if v_last_submitted is null then
    v_has_unpublished := v_live_count > 0;
  else
    v_has_unpublished := v_live_count != coalesce(v_submitted_count, 0)
      or exists (
        select 1 from public.timeline_entries
        where event_id = v_event_id and venue_id = v_session.venue_id
          and owner = 'client' and updated_at > v_last_submitted
      );
  end if;

  return jsonb_build_object(
    'entries', v_entries, 'sections', v_sections,
    'lastSubmittedAt', v_last_submitted, 'hasUnpublishedChanges', v_has_unpublished
  );
end;
$$;

grant execute on function public.get_portal_run_of_show(text) to anon, authenticated;

-- ── Couple portal update (adds day_offset) ──────────────────────────────────

drop function if exists public.update_portal_timeline_entry(text, uuid, text, text, text);
drop function if exists public.update_portal_timeline_entry(text, uuid, text, text, text, uuid);

create or replace function public.update_portal_timeline_entry(
  p_token text,
  p_entry_id uuid,
  p_title text,
  p_description text,
  p_entry_time text,
  p_section_id uuid default null,
  p_day_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session        public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_entry          public.timeline_entries%rowtype;
  v_day_offset     integer;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  else
    v_effective_role := v_session.access_level;
  end if;

  if v_effective_role not in ('full_access', 'planning', 'couple') then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

  select * into v_entry
  from public.timeline_entries
  where id = p_entry_id and venue_id = v_session.venue_id;

  if v_entry.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = v_entry.event_id and e.client_id = v_session.client_id and e.venue_id = v_session.venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_entry.owner != 'client' then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'title_required');
  end if;

  v_day_offset := public.timeline_clamp_day_offset(v_entry.event_id, p_day_offset);

  update public.timeline_entries
  set title       = trim(p_title),
      description = nullif(trim(coalesce(p_description, '')), ''),
      entry_time  = nullif(p_entry_time, '')::time,
      section_id  = coalesce(p_section_id, section_id),
      day_offset  = v_day_offset
  where id = p_entry_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_portal_timeline_entry(text, uuid, text, text, text, uuid, integer) to anon, authenticated;

-- ── Couple portal add (adds day_offset) ─────────────────────────────────────

drop function if exists public.add_portal_timeline_entry(text, uuid, text, text, text);

create or replace function public.add_portal_timeline_entry(
  p_token text,
  p_section_id uuid,
  p_title text,
  p_description text,
  p_entry_time text,
  p_day_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session        public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_section        public.timeline_sections%rowtype;
  v_next_sort      smallint;
  v_new_id         uuid;
  v_day_offset     integer;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  else
    v_effective_role := v_session.access_level;
  end if;

  if v_effective_role not in ('full_access', 'planning', 'couple') then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

  select * into v_section
  from public.timeline_sections
  where id = p_section_id and venue_id = v_session.venue_id;

  if v_section.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = v_section.event_id and e.client_id = v_session.client_id and e.venue_id = v_session.venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not v_section.client_can_add then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'title_required');
  end if;

  v_day_offset := public.timeline_clamp_day_offset(v_section.event_id, p_day_offset);

  select coalesce(max(sort_order), -1) + 1 into v_next_sort
  from public.timeline_entries
  where section_id = p_section_id and venue_id = v_session.venue_id;

  insert into public.timeline_entries (
    venue_id, event_id, section_id, title, description, entry_time, day_offset,
    audiences, sort_order, owner, lock_state
  ) values (
    v_session.venue_id, v_section.event_id, p_section_id, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''), nullif(p_entry_time, '')::time, v_day_offset,
    '{}', v_next_sort, 'client', 'editable'
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_new_id, 'title', trim(p_title),
      'description', nullif(trim(coalesce(p_description, '')), ''),
      'entryTime', nullif(p_entry_time, '')::time,
      'dayOffset', v_day_offset,
      'sectionId', p_section_id, 'sortOrder', v_next_sort,
      'owner', 'client', 'lockState', 'editable', 'audiences', '[]'::jsonb,
      'canEdit', true, 'canManageVisibility', true, 'links', '[]'::jsonb, 'attachments', '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.add_portal_timeline_entry(text, uuid, text, text, text, integer) to anon, authenticated;

-- ── Submit snapshot includes dayOffset ──────────────────────────────────────

create or replace function public.submit_timeline(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_venue_id  uuid;
  v_event_id          uuid;
  v_snapshot          jsonb;
  v_count             integer;
  v_submission_id     uuid;
  v_completed_task_id uuid;
  v_celebrated        boolean := false;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.venue_id = v_session_venue_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
  order by e.event_date asc limit 1;
  if v_event_id is null then return jsonb_build_object('ok', false, 'error', 'event_not_found'); end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', te.id, 'title', te.title, 'description', te.description,
      'entryTime', te.entry_time, 'dayOffset', te.day_offset,
      'sectionId', te.section_id,
      'sortOrder', te.sort_order, 'audiences', te.audiences
    ) order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at), '[]'::jsonb),
    count(*)
  into v_snapshot, v_count
  from public.timeline_entries te
  where te.event_id = v_event_id and te.venue_id = v_session_venue_id and te.owner = 'client';

  insert into public.timeline_submissions (client_id, venue_id, event_id, snapshot, entry_count)
  values (p_client_id, v_session_venue_id, v_event_id, v_snapshot, v_count)
  returning id into v_submission_id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session_venue_id and event_id = v_event_id
      and auto_complete_trigger = 'timeline_submitted'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_session_venue_id;
  end loop;

  insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
  values (v_session_venue_id, p_client_id, v_event_id, 'timeline_submitted', v_submission_id)
  on conflict (client_id, celebration_type) do nothing
  returning true into v_celebrated;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id, 'entryCount', v_count, 'submittedAt', now(), 'celebrated', coalesce(v_celebrated, false));
end $$;

grant execute on function public.submit_timeline(text, uuid) to anon, authenticated;

-- ── Vendor event detail + cross-event timeline ──────────────────────────────

create or replace function public.get_vendor_event_detail(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_event_id  uuid;
  v_client_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return null;
  end if;

  if not exists (
    select 1 from public.event_vendor_assignments
    where id = p_assignment_id and vendor_id = v_vendor_id
  ) then
    return null;
  end if;

  select e.id into v_event_id
  from public.event_vendor_assignments eva
  join public.events e on e.id = eva.event_id
  where eva.id = p_assignment_id;

  select client_id into v_client_id from public.events where id = v_event_id;

  return jsonb_build_object(
    'assignment', (
      select jsonb_build_object(
        'id', eva.id, 'event_id', eva.event_id,
        'arrival_time', eva.arrival_time, 'setup_location', eva.setup_location,
        'load_in_notes', eva.load_in_notes, 'internal_notes', eva.internal_notes,
        'notes', eva.notes, 'checked_in_at', eva.checked_in_at,
        'setup_complete_at', eva.setup_complete_at,
        'share_couple_email', eva.share_couple_email, 'share_couple_phone', eva.share_couple_phone,
        'agreed_fee', eva.agreed_fee, 'payment_status', eva.payment_status
      )
      from public.event_vendor_assignments eva where eva.id = p_assignment_id
    ),
    'event', (
      select jsonb_build_object(
        'id', e.id, 'name', e.name,
        'event_date', e.event_date, 'event_end_date', e.event_end_date,
        'event_type', e.event_type,
        'venue_id', e.venue_id, 'venue_name', v.name
      )
      from public.events e
      join public.venues v on v.id = e.venue_id
      where e.id = v_event_id
    ),
    'client', (
      select jsonb_build_object(
        'first_name', c.first_name, 'last_name', c.last_name,
        'partner_first_name', c.partner_first_name, 'partner_last_name', c.partner_last_name,
        'email', c.email, 'phone', c.phone
      )
      from public.clients c where c.id = v_client_id
    ),
    'timeline', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'entry_time', t.entry_time, 'day_offset', t.day_offset,
          'title', t.title, 'description', t.description, 'audiences', t.audiences
        ) order by t.day_offset, t.entry_time nulls last, t.sort_order)
        from public.timeline_entries t
        where t.event_id = v_event_id and t.audiences @> array['vendors']
      ),
      '[]'::jsonb
    ),
    'event_tasks', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', et.id, 'title', et.title, 'description', et.description,
          'category', et.category, 'visibility', et.visibility,
          'due_date', et.due_date,
          'days_offset', et.days_offset,
          'due_date_locked', et.due_date_locked,
          'status', et.status, 'is_required', et.is_required, 'completed_at', et.completed_at
        ))
        from public.event_tasks et
        where et.event_id = v_event_id and et.visibility in ('vendor_visible', 'vendor_owned')
      ),
      '[]'::jsonb
    ),
    'documents', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'name', d.name, 'category', d.category,
          'storage_url', d.storage_url, 'mime_type', d.mime_type, 'notes', d.notes,
          'created_at', d.created_at
        ) order by d.created_at desc)
        from public.documents d
        where d.event_id = v_event_id and d.shared_with_vendors = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_event_detail(uuid) to authenticated;

create or replace function public.get_vendor_timeline()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'assignmentId', ev.id, 'eventId', ev.event_id, 'eventName', e.name,
          'eventDate', e.event_date, 'eventEndDate', e.event_end_date,
          'venueName', v.name,
          'entries', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
                'id', t.id, 'time', t.entry_time, 'dayOffset', t.day_offset,
                'title', t.title, 'description', t.description
              ) order by t.day_offset, t.entry_time nulls last, t.sort_order)
              from public.timeline_entries t
              where t.event_id = ev.event_id and t.audiences @> array['vendors']
            ),
            '[]'::jsonb
          )
        ) order by e.event_date nulls last)
        from public.event_vendor_assignments ev
        join public.events e on e.id = ev.event_id
        join public.venues v on v.id = e.venue_id
        where ev.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_timeline() to authenticated;

notify pgrst, 'reload schema';
