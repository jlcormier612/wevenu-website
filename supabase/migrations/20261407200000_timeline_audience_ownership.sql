-- Timeline audience ownership correction
-- Venue-owned items: share with client + vendors only (couple portal gated by client).
-- Client-owned items: share with venue + vendors + guests + wedding_party (any combo).
-- Preserves wedding_party in the audience vocabulary and adds a wedding-party projection RPC.
-- No destructive schema change to the audiences check constraint.

-- ── Legacy default correction (data only; vocabulary unchanged) ──────────────
-- Venue-owned rows historically defaulted to {venue}. "venue" is no longer a
-- venue-owned share target. Map exact {venue} → {client} so the structural
-- framework the couple plans inside stays visible (matches the new default).
-- Does NOT touch wedding_party values (none expected; left intact if present).
update public.timeline_entries
set audiences = '{client}'
where owner = 'venue'
  and audiences = '{venue}';

update public.timeline_template_items
set audiences = '{client}'
where audiences = '{venue}';

-- ── Couple portal: venue framework visible only when shared with Client ──────
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

  -- Couple live view:
  --   • their own draft (owner='client') — always, including private (audiences={})
  --   • venue framework only when the venue shared with Client
  -- Wedding Party / Guests / Vendors tags do not gate couple↔venue mutual
  -- visibility; those are external publishing decisions.
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
      or (te.owner = 'venue' and 'client' = any(te.audiences))
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

-- ── Client visibility: Venue + Vendors + Guests + Wedding Party ─────────────
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
  v_rejected       text[];
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
    return jsonb_build_object('ok', false, 'error', 'not_your_item');
  end if;

  -- Fail closed on any disallowed audience (e.g. 'client' on a client-owned item).
  select coalesce(array_agg(distinct a), '{}') into v_rejected
  from unnest(coalesce(p_audiences, '{}'::text[])) as a
  where a is not null and a not in ('venue', 'vendors', 'guests', 'wedding_party');

  if cardinality(v_rejected) > 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_audiences', 'rejected', to_jsonb(v_rejected));
  end if;

  select coalesce(array_agg(distinct a), '{}') into v_clean
  from unnest(coalesce(p_audiences, '{}'::text[])) as a
  where a in ('venue', 'vendors', 'guests', 'wedding_party');

  update public.timeline_entries
  set audiences = coalesce(v_clean, '{}')
  where id = p_entry_id;

  return jsonb_build_object('ok', true, 'audiences', to_jsonb(coalesce(v_clean, '{}'::text[])));
end;
$$;

grant execute on function public.set_portal_timeline_entry_visibility(text, uuid, text[]) to anon, authenticated;

-- ── Wedding Party projection (receiving surface) ────────────────────────────
-- Mirrors get_guest_timeline: portal-token auth, filters on wedding_party.
-- Does not collapse guests and wedding_party.
create or replace function public.get_wedding_party_timeline(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_event_id uuid;
  v_entries jsonb;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  v_event_id := coalesce(
    v_session.event_id,
    public._current_event_for_client(v_session.client_id, v_session.venue_id)
  );

  if v_event_id is null then
    return jsonb_build_object('entries', '[]'::jsonb, 'count', 0);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', te.id,
      'time', te.entry_time::text,
      'title', te.title,
      'description', te.description,
      'owner', te.owner,
      'audiences', te.audiences
    )
    order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
  ), '[]'::jsonb)
  into v_entries
  from public.timeline_entries te
  where te.event_id = v_event_id
    and te.venue_id = v_session.venue_id
    and 'wedding_party' = any(te.audiences);

  return jsonb_build_object(
    'entries', v_entries,
    'count', jsonb_array_length(v_entries)
  );
end;
$$;

grant execute on function public.get_wedding_party_timeline(text) to anon, authenticated;

notify pgrst, 'reload schema';
