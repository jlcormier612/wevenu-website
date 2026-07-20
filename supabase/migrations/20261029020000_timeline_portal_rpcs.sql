-- ============================================================================
-- Timeline Implementation — Portal RPCs on the new Owner/Lock State/
-- Visibility model.
--
-- The couple's own view is always live (their own current draft, plus the
-- venue's live structural framework) — never gated by their own submission
-- state, per your Q1 answer: "why would their own live workspace wait on
-- itself?" canEdit is now owner='client' (lock_state never blocks a
-- cross-party edit that was never allowed anyway — venue items were never
-- portal-editable, lock_state only ever governed same-owner self-edit).
--
-- Visibility follows Ownership (your correction, 2026-07-17): a session can
-- only set audiences on entries it owns. add_portal_timeline_entry forces
-- owner='client'; set_portal_timeline_entry_visibility rejects any entry
-- where owner != 'client'.
-- ============================================================================

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

  -- Every item relevant to the couple's own view: their own live draft
  -- (any owner='client' row) plus the venue's live structural framework
  -- (owner='venue') — both always current, never gated by submission.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',          te.id,
        'title',       te.title,
        'description', te.description,
        'entryTime',   te.entry_time,
        'sectionId',   te.section_id,
        'sortOrder',   te.sort_order,
        'owner',       te.owner,
        'lockState',   te.lock_state,
        'audiences',   te.audiences,
        -- view_only / financial / reminders_only sessions can see but not edit
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
      order by te.entry_time asc nulls last, te.sort_order, te.created_at
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

  -- Timeline Status: has the couple's live draft diverged from the latest
  -- thing the venue was actually sent? Compared by count (catches
  -- adds/deletes) and by whether any client-owned row changed after the
  -- last submission (catches edits) — the same "drift since commit"
  -- heuristic already used elsewhere on this platform (Event Order revision
  -- counting), not a full content diff.
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

-- ── The couple edits their own item in place — same row, no copy ───────────
-- Signature gained p_section_id — drop the old 5-arg overload explicitly,
-- since CREATE OR REPLACE with a changed parameter list creates a second
-- overload rather than replacing the first.
drop function if exists public.update_portal_timeline_entry(text, uuid, text, text, text);

create or replace function public.update_portal_timeline_entry(
  p_token text, p_entry_id uuid, p_title text, p_description text, p_entry_time text, p_section_id uuid default null
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

  -- Ownership, not lock_state, gates a cross-party edit — a venue item was
  -- never portal-editable in the first place. lock_state only ever governs
  -- an owner's own self-edit (coordinator side).
  if v_entry.owner != 'client' then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'title_required');
  end if;

  update public.timeline_entries
  set title       = trim(p_title),
      description = nullif(trim(coalesce(p_description, '')), ''),
      entry_time  = nullif(p_entry_time, '')::time,
      section_id  = coalesce(p_section_id, section_id)
  where id = p_entry_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_portal_timeline_entry(text, uuid, text, text, text, uuid) to anon, authenticated;

-- ── The couple adds a new item to a section the venue opted in ─────────────
-- Always owner='client', always audiences={} (private — nothing published
-- until the couple deliberately sets Visibility on it themselves).
create or replace function public.add_portal_timeline_entry(
  p_token text, p_section_id uuid, p_title text, p_description text, p_entry_time text
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

  select coalesce(max(sort_order), -1) + 1 into v_next_sort
  from public.timeline_entries
  where section_id = p_section_id and venue_id = v_session.venue_id;

  insert into public.timeline_entries (
    venue_id, event_id, section_id, title, description, entry_time,
    audiences, sort_order, owner, lock_state
  ) values (
    v_session.venue_id, v_section.event_id, p_section_id, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''), nullif(p_entry_time, '')::time,
    '{}', v_next_sort, 'client', 'editable'
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_new_id, 'title', trim(p_title),
      'description', nullif(trim(coalesce(p_description, '')), ''),
      'entryTime', nullif(p_entry_time, '')::time,
      'sectionId', p_section_id, 'sortOrder', v_next_sort,
      'owner', 'client', 'lockState', 'editable', 'audiences', '[]'::jsonb,
      'canEdit', true, 'canManageVisibility', true, 'links', '[]'::jsonb, 'attachments', '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.add_portal_timeline_entry(text, uuid, text, text, text) to anon, authenticated;

-- ── The couple deletes their own not-yet-relied-upon draft item ────────────
-- No delete path existed at all before — private draft work without
-- delete was incomplete.
create or replace function public.delete_portal_timeline_entry(p_token text, p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session        public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_entry          public.timeline_entries%rowtype;
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

  if v_entry.id is null or v_entry.owner != 'client' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = v_entry.event_id and e.client_id = v_session.client_id and e.venue_id = v_session.venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  delete from public.timeline_entries where id = p_entry_id;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.delete_portal_timeline_entry(text, uuid) to anon, authenticated;

-- ── The couple sets Visibility on an item they own — Visibility follows
--    Ownership (2026-07-17): rejected outright for any item owned by the
--    other party, independent of Submission (§6 layers 2 and 3 stay
--    genuinely independent — this never touches timeline_submissions). ──
create or replace function public.set_portal_timeline_entry_visibility(p_token text, p_entry_id uuid, p_audiences text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session        public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_entry          public.timeline_entries%rowtype;
  v_clean          text[];
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

  -- Visibility follows Ownership — a session may only publish/hide its
  -- own party's items, even though Visibility is otherwise independent
  -- of Submission.
  if v_entry.owner != 'client' then
    return jsonb_build_object('ok', false, 'error', 'not_your_item');
  end if;

  -- The client can only ever set the audience tags meaningful to them —
  -- 'venue' visibility is implicit (a venue-owned item's own concern) and
  -- is never a client-settable tag on their own items.
  select array_agg(distinct a) into v_clean
  from unnest(p_audiences) as a
  where a in ('wedding_party', 'guests', 'vendors');

  update public.timeline_entries
  set audiences = coalesce(v_clean, '{}')
  where id = p_entry_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_portal_timeline_entry_visibility(text, uuid, text[]) to anon, authenticated;

notify pgrst, 'reload schema';
