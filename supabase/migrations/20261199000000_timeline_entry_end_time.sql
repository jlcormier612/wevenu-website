-- ============================================================================
-- Timeline entries: optional end_time (start remains entry_time).
-- Portal add/update RPCs gain p_end_time; get_portal_run_of_show returns endTime.
-- ============================================================================

alter table public.timeline_entries
  add column if not exists end_time time;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'timeline_entries_end_after_start'
      and conrelid = 'public.timeline_entries'::regclass
  ) then
    alter table public.timeline_entries
      add constraint timeline_entries_end_after_start
      check (
        end_time is null
        or entry_time is null
        or end_time > entry_time
      );
  end if;
end $$;

-- ── Portal read (include endTime; keep wedding_party gate from 20261197) ────

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

  v_event_id := coalesce(
    v_session.event_id,
    public._current_event_for_client(v_session.client_id, v_session.venue_id)
  );

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
        'endTime',     te.end_time,
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
    and te.venue_id = v_session.venue_id
    and (
      te.owner = 'client'
      or (te.owner = 'venue' and 'wedding_party' = any(te.audiences))
    );

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

-- ── Portal update (+ p_end_time) ────────────────────────────────────────────

drop function if exists public.update_portal_timeline_entry(text, uuid, text, text, text, uuid, integer);

create or replace function public.update_portal_timeline_entry(
  p_token text,
  p_entry_id uuid,
  p_title text,
  p_description text,
  p_entry_time text,
  p_section_id uuid default null,
  p_day_offset integer default 0,
  p_end_time text default null
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
      end_time    = nullif(coalesce(p_end_time, ''), '')::time,
      section_id  = coalesce(p_section_id, section_id),
      day_offset  = v_day_offset
  where id = p_entry_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_portal_timeline_entry(text, uuid, text, text, text, uuid, integer, text) to anon, authenticated;

-- ── Portal add (+ p_end_time) ───────────────────────────────────────────────

drop function if exists public.add_portal_timeline_entry(text, uuid, text, text, text, integer);

create or replace function public.add_portal_timeline_entry(
  p_token text,
  p_section_id uuid,
  p_title text,
  p_description text,
  p_entry_time text,
  p_day_offset integer default 0,
  p_end_time text default null
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
  v_end_time       time;
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
  v_end_time := nullif(coalesce(p_end_time, ''), '')::time;

  select coalesce(max(sort_order), -1) + 1 into v_next_sort
  from public.timeline_entries
  where section_id = p_section_id and venue_id = v_session.venue_id;

  insert into public.timeline_entries (
    venue_id, event_id, section_id, title, description, entry_time, end_time, day_offset,
    audiences, sort_order, owner, lock_state
  ) values (
    v_session.venue_id, v_section.event_id, p_section_id, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''), nullif(p_entry_time, '')::time, v_end_time, v_day_offset,
    '{}', v_next_sort, 'client', 'editable'
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_new_id, 'title', trim(p_title),
      'description', nullif(trim(coalesce(p_description, '')), ''),
      'entryTime', nullif(p_entry_time, '')::time,
      'endTime', v_end_time,
      'dayOffset', v_day_offset,
      'sectionId', p_section_id, 'sortOrder', v_next_sort,
      'owner', 'client', 'lockState', 'editable', 'audiences', '[]'::jsonb,
      'canEdit', true, 'canManageVisibility', true, 'links', '[]'::jsonb, 'attachments', '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.add_portal_timeline_entry(text, uuid, text, text, text, integer, text) to anon, authenticated;
