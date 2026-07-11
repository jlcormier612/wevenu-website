-- ============================================================================
-- Client Timeline — connect the existing Booking Timeline to the Client
-- Portal. No new Timeline is created: the couple reads and (for items
-- explicitly marked editable) writes the same timeline_entries rows the
-- coordinator sees in the Booking Timeline tab.
--
-- get_portal_run_of_show already existed (Sprint 80) but returned every
-- entry with no visibility filter at all — a real gap against "Venue Only
-- items must never appear." This migration fixes that and extends the
-- function with sections, links, attachments, and per-item edit capability,
-- following the exact effective-role resolution and gating pattern already
-- established by get_portal_tasks (financial/reminders_only/view_only
-- sessions can view but not edit).
-- ============================================================================

alter table public.timeline_entries
  add column client_editable boolean not null default false;

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
        -- view_only / financial / reminders_only sessions can see but not edit
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

  -- Only sections that actually have a client-visible entry — an empty
  -- section header would just be noise the couple can't explain.
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', s.id, 'name', s.name, 'sortOrder', s.sort_order)
      order by s.sort_order
    ),
    '[]'::jsonb
  )
  into v_sections
  from public.timeline_sections s
  where s.event_id = v_event_id
    and s.venue_id = v_session.venue_id
    and exists (
      select 1 from public.timeline_entries te2
      where te2.section_id = s.id and 'couple' = any(te2.audiences)
    );

  return jsonb_build_object('entries', v_entries, 'sections', v_sections);
end;
$$;

grant execute on function public.get_portal_run_of_show(text) to anon, authenticated;

-- ── The couple edits an editable item in place — same row, no copy ─────────
create or replace function public.update_portal_timeline_entry(
  p_token text, p_entry_id uuid, p_title text, p_description text, p_entry_time text
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

  if not v_entry.client_editable or not ('couple' = any(v_entry.audiences)) then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'title_required');
  end if;

  update public.timeline_entries
  set title       = trim(p_title),
      description = nullif(trim(coalesce(p_description, '')), ''),
      entry_time  = nullif(p_entry_time, '')::time
  where id = p_entry_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_portal_timeline_entry(text, uuid, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
