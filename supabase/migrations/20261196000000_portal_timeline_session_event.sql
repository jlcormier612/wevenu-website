-- ============================================================================
-- Fix couple portal Timeline resolving the wrong event.
--
-- get_portal_context (and seating RPCs) pin to
--   coalesce(session.event_id, _current_event_for_client(...)).
-- The day_offset migration (20261194) rewrote get_portal_run_of_show /
-- submit_timeline to "first event by event_date", ignoring the session's
-- pinned event_id. Couples then saw multi-day headers for the booked
-- wedding while entries/sections loaded from an earlier event (often
-- empty) — day headers with no items.
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

  -- Same resolution as get_portal_context / _resolve_portal_event_id —
  -- never "earliest event by date" on its own (ignores the session pin).
  v_event_id := coalesce(
    v_session.event_id,
    public._current_event_for_client(v_session.client_id, v_session.venue_id)
  );

  if v_event_id is null then
    return jsonb_build_object('entries', '[]'::jsonb, 'sections', '[]'::jsonb, 'lastSubmittedAt', null, 'hasUnpublishedChanges', false);
  end if;

  -- Venue live framework + couple's own draft — always-live, never gated
  -- by submission. Audience tags (wedding_party / guests / vendors) publish
  -- outward; they do not hide venue framework items from the couple.
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

-- Submit snapshot to the same session-pinned event as the live portal view.
create or replace function public.submit_timeline(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session           public.client_portal_sessions%rowtype;
  v_event_id          uuid;
  v_snapshot          jsonb;
  v_count             integer;
  v_submission_id     uuid;
  v_completed_task_id uuid;
  v_celebrated        boolean := false;
begin
  select * into v_session
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session.id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.venue_id = v_session.venue_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  v_event_id := coalesce(
    v_session.event_id,
    public._current_event_for_client(v_session.client_id, v_session.venue_id)
  );
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
  where te.event_id = v_event_id and te.venue_id = v_session.venue_id and te.owner = 'client';

  insert into public.timeline_submissions (client_id, venue_id, event_id, snapshot, entry_count)
  values (p_client_id, v_session.venue_id, v_event_id, v_snapshot, v_count)
  returning id into v_submission_id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session.venue_id and event_id = v_event_id
      and auto_complete_trigger = 'timeline_submitted'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_session.venue_id;
  end loop;

  insert into public.luv_celebrations (venue_id, client_id, event_id, celebration_type, entity_id)
  values (v_session.venue_id, p_client_id, v_event_id, 'timeline_submitted', v_submission_id)
  on conflict (client_id, celebration_type) do nothing
  returning true into v_celebrated;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id, 'entryCount', v_count, 'submittedAt', now(), 'celebrated', coalesce(v_celebrated, false));
end $$;

grant execute on function public.submit_timeline(text, uuid) to anon, authenticated;
