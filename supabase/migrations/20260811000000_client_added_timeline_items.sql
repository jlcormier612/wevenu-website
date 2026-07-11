-- ============================================================================
-- Client Timeline — client-added items
--
-- The venue designates which sections a couple may add items to
-- (timeline_sections.client_can_add). A client-created item is a normal
-- timeline_entries row — no separate storage, same table the coordinator's
-- Booking Timeline already reads and writes. It inherits the section's
-- visibility to the client (audiences = {couple}, the only visibility a
-- section being shown to the couple at all implies) and is created
-- client_editable so the couple can fix their own entry — the venue can
-- still edit, move, or delete it at any time, same as any other item.
-- ============================================================================

alter table public.timeline_sections
  add column client_can_add boolean not null default false;

create or replace function public.get_portal_run_of_show(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  select id into v_event_id
  from public.events
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
  order by event_date asc
  limit 1;

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

grant execute on function public.get_portal_run_of_show(text) to anon, authenticated;

-- ── The couple adds a new item to a section the venue opted in ─────────────
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

  -- Must be this couple's own event, and the section must have opted in
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
    audiences, sort_order, client_editable
  ) values (
    v_session.venue_id, v_section.event_id, p_section_id, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''), nullif(p_entry_time, '')::time,
    '{couple}', v_next_sort, true
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_new_id, 'title', trim(p_title),
      'description', nullif(trim(coalesce(p_description, '')), ''),
      'entryTime', nullif(p_entry_time, '')::time,
      'sectionId', p_section_id, 'sortOrder', v_next_sort,
      'canEdit', true, 'links', '[]'::jsonb, 'attachments', '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.add_portal_timeline_entry(text, uuid, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
