-- Timeline P1b: venue working vs released schedules (append-only snapshots).
-- Couple portal venue items read the active release, not live working rows.
-- Couple-owned drafts/submissions remain separate (timeline_submissions unchanged).
-- Cutover: events that already exposed venue items via client audience get one
-- initial release of those items (idempotent).

-- ── Schema ───────────────────────────────────────────────────────────────────

create table if not exists public.venue_timeline_releases (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  released_at timestamptz not null default now(),
  snapshot jsonb not null,
  entry_count integer not null default 0,
  held_out jsonb not null default '[]'::jsonb,
  source text not null default 'release'
    check (source in ('release', 'cutover')),
  idempotency_key text,
  working_fingerprint text,
  created_at timestamptz not null default now(),
  constraint venue_timeline_releases_event_idempotency_unique
    unique (event_id, idempotency_key)
);

create index if not exists venue_timeline_releases_event_released
  on public.venue_timeline_releases (event_id, released_at desc);

alter table public.venue_timeline_releases enable row level security;

drop policy if exists venue_timeline_releases_venue_select on public.venue_timeline_releases;
create policy venue_timeline_releases_venue_select
  on public.venue_timeline_releases for select
  using (venue_id = public.current_user_venue_id());

grant select on public.venue_timeline_releases to authenticated;

alter table public.events
  add column if not exists active_venue_timeline_release_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_active_venue_timeline_release_id_fkey'
  ) then
    alter table public.events
      add constraint events_active_venue_timeline_release_id_fkey
      foreign key (active_venue_timeline_release_id)
      references public.venue_timeline_releases(id)
      on delete set null;
  end if;
end $$;

create index if not exists events_active_venue_timeline_release_id_idx
  on public.events (active_venue_timeline_release_id)
  where active_venue_timeline_release_id is not null;

comment on table public.venue_timeline_releases is
  'Immutable venue→couple timeline releases. Portal reads active pointer only.';
comment on column public.events.active_venue_timeline_release_id is
  'Last successful venue timeline release shown to the couple. Null = none yet.';

-- ── Snapshot builder for one venue-owned working row ─────────────────────────

create or replace function public._venue_timeline_entry_release_json(
  p_entry_id uuid,
  p_venue_id uuid
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', te.id,
    'title', te.title,
    'description', te.description,
    'entryTime', te.entry_time,
    'endTime', te.end_time,
    'dayOffset', coalesce(te.day_offset, 0),
    'sectionId', te.section_id,
    'sortOrder', te.sort_order,
    'owner', te.owner,
    'lockState', te.lock_state,
    'audiences', to_jsonb(te.audiences),
    'timingDayIntent', te.timing_day_intent,
    'timingDayAnchor', te.timing_day_anchor,
    'timingRelativeDayOffset', te.timing_relative_day_offset,
    'timingFixedDate', te.timing_fixed_date,
    'timingClockIntent', te.timing_clock_intent,
    'timingRelativeMinutes', te.timing_relative_minutes,
    'timingAttention', te.timing_attention,
    'updatedAt', te.updated_at,
    'links', (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'id', l.id, 'url', l.url, 'label', l.label
        ) order by l.sort_order, l.created_at),
        '[]'::jsonb
      )
      from public.timeline_entry_links l
      where l.timeline_entry_id = te.id and l.venue_id = p_venue_id
    ),
    'attachments', (
      select coalesce(
        jsonb_agg(jsonb_build_object(
          'id', a.id,
          'name', coalesce(d.name, d.file_name),
          'url', d.storage_url
        ) order by a.sort_order, a.created_at),
        '[]'::jsonb
      )
      from public.timeline_entry_attachments a
      join public.documents d on d.id = a.document_id
      where a.timeline_entry_id = te.id and a.venue_id = p_venue_id
    )
  )
  from public.timeline_entries te
  where te.id = p_entry_id and te.venue_id = p_venue_id;
$$;

-- ── Classification helpers ───────────────────────────────────────────────────

create or replace function public._timeline_entry_is_unresolved(p_attention text)
returns boolean
language sql
immutable
as $$
  select p_attention in ('unknown_intent', 'missing_event_end', 'invalid_event_end');
$$;

create or replace function public._timeline_fixed_outside_pad(
  p_event_date date,
  p_fixed_date date
)
returns boolean
language sql
immutable
as $$
  select p_event_date is not null
    and p_fixed_date is not null
    and (
      p_fixed_date < (p_event_date - 14)
      or p_fixed_date > (p_event_date + 14)
    );
$$;

create or replace function public._venue_timeline_working_fingerprint(
  p_venue_id uuid,
  p_event_id uuid
)
returns text
language sql
stable
set search_path = public
as $$
  select md5(coalesce(string_agg(
    te.id::text || '|' ||
    coalesce(te.updated_at::text, '') || '|' ||
    coalesce(te.day_offset::text, '') || '|' ||
    coalesce(te.entry_time::text, '') || '|' ||
    coalesce(te.title, '') || '|' ||
    coalesce(te.timing_attention, '') || '|' ||
    coalesce(te.timing_fixed_date::text, ''),
    ',' order by te.id
  ), ''))
  from public.timeline_entries te
  where te.venue_id = p_venue_id
    and te.event_id = p_event_id
    and te.owner = 'venue';
$$;

-- ── Preview (read-only) ──────────────────────────────────────────────────────

create or replace function public.preview_venue_timeline_release(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_event record;
  v_last jsonb := '[]'::jsonb;
  v_last_ids uuid[] := array[]::uuid[];
  v_will_share jsonb := '[]'::jsonb;
  v_held_out jsonb := '[]'::jsonb;
  v_blocks jsonb := '[]'::jsonb;
  v_soft jsonb := '[]'::jsonb;
  v_entry record;
  v_unresolved boolean;
  v_in_last boolean;
  v_fp text;
  v_released_at timestamptz;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id, e.venue_id, e.event_date, e.event_end_date, e.active_venue_timeline_release_id
  into v_event
  from public.events e
  where e.id = p_event_id and e.venue_id = v_venue_id;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  if v_event.active_venue_timeline_release_id is not null then
    select r.snapshot, r.released_at into v_last, v_released_at
    from public.venue_timeline_releases r
    where r.id = v_event.active_venue_timeline_release_id
      and r.venue_id = v_venue_id
      and r.event_id = p_event_id;
    select coalesce(array_agg((item->>'id')::uuid), array[]::uuid[])
    into v_last_ids
    from jsonb_array_elements(coalesce(v_last, '[]'::jsonb)) item;
  end if;

  for v_entry in
    select te.*
    from public.timeline_entries te
    where te.venue_id = v_venue_id
      and te.event_id = p_event_id
      and te.owner = 'venue'
    order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
  loop
    v_unresolved := public._timeline_entry_is_unresolved(v_entry.timing_attention);
    v_in_last := v_entry.id = any(v_last_ids);

    if v_unresolved and v_in_last then
      v_blocks := v_blocks || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id,
        'title', v_entry.title,
        'reason', 'previously_released_unresolved',
        'attention', v_entry.timing_attention
      ));
    elsif v_unresolved and not v_in_last then
      v_held_out := v_held_out || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id,
        'title', v_entry.title,
        'reason', 'never_released_unresolved',
        'attention', v_entry.timing_attention
      ));
    else
      v_will_share := v_will_share || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id,
        'title', v_entry.title,
        'dayOffset', coalesce(v_entry.day_offset, 0),
        'entryTime', v_entry.entry_time,
        'attention', v_entry.timing_attention
      ));
    end if;

    if v_entry.timing_day_intent = 'fixed'
      and public._timeline_fixed_outside_pad(v_event.event_date, v_entry.timing_fixed_date)
    then
      v_soft := v_soft || jsonb_build_array(jsonb_build_object(
        'id', v_entry.id,
        'title', v_entry.title,
        'reason', 'fixed_outside_planning_pad',
        'fixedDate', v_entry.timing_fixed_date
      ));
    end if;
  end loop;

  v_fp := public._venue_timeline_working_fingerprint(v_venue_id, p_event_id);

  return jsonb_build_object(
    'ok', true,
    'eventId', p_event_id,
    'willShare', v_will_share,
    'heldOut', v_held_out,
    'blocksRelease', v_blocks,
    'softWarnings', v_soft,
    'canRelease', jsonb_array_length(v_blocks) = 0 and jsonb_array_length(v_will_share) > 0,
    'lastReleasedAt', v_released_at,
    'workingFingerprint', v_fp,
    'hasPriorRelease', v_event.active_venue_timeline_release_id is not null
  );
end;
$$;

grant execute on function public.preview_venue_timeline_release(uuid) to authenticated;

-- ── Confirm (atomic) ─────────────────────────────────────────────────────────

create or replace function public.confirm_venue_timeline_release(
  p_event_id uuid,
  p_acknowledged_hold_out_ids uuid[],
  p_working_fingerprint text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
  v_event record;
  v_preview jsonb;
  v_held jsonb;
  v_blocks jsonb;
  v_will jsonb;
  v_ack uuid[] := coalesce(p_acknowledged_hold_out_ids, array[]::uuid[]);
  v_expected_hold uuid[];
  v_id uuid;
  v_snapshot jsonb := '[]'::jsonb;
  v_held_meta jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_release_id uuid;
  v_fp text;
  v_entry record;
  v_existing uuid;
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  -- Serialize concurrent release attempts for this event first.
  select e.id, e.venue_id, e.event_date, e.event_end_date, e.active_venue_timeline_release_id
  into v_event
  from public.events e
  where e.id = p_event_id and e.venue_id = v_venue_id
  for update;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select r.id into v_existing
    from public.venue_timeline_releases r
    where r.event_id = p_event_id
      and r.venue_id = v_venue_id
      and r.idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return jsonb_build_object(
        'ok', true,
        'releaseId', v_existing,
        'idempotentReplay', true
      );
    end if;
  end if;

  v_fp := public._venue_timeline_working_fingerprint(v_venue_id, p_event_id);
  if p_working_fingerprint is null or p_working_fingerprint is distinct from v_fp then
    return jsonb_build_object(
      'ok', false,
      'error', 'stale_preview',
      'message', 'The working timeline changed since you reviewed the preview. Review again before sharing.'
    );
  end if;

  v_preview := public.preview_venue_timeline_release(p_event_id);
  if coalesce(v_preview->>'ok', 'false') <> 'true' then
    return v_preview;
  end if;

  v_blocks := coalesce(v_preview->'blocksRelease', '[]'::jsonb);
  v_held := coalesce(v_preview->'heldOut', '[]'::jsonb);
  v_will := coalesce(v_preview->'willShare', '[]'::jsonb);

  if jsonb_array_length(v_blocks) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'blocks_release',
      'blocksRelease', v_blocks,
      'message', 'Fix or replace items already on the shared timeline before sharing again.'
    );
  end if;

  if jsonb_array_length(v_will) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'nothing_to_share',
      'message', 'Add resolved timeline items before sharing with the couple.'
    );
  end if;

  select coalesce(array_agg((h->>'id')::uuid), array[]::uuid[])
  into v_expected_hold
  from jsonb_array_elements(v_held) h;

  -- Disclosure: acknowledged set must match server hold-outs exactly (order-insensitive).
  if exists (
    select 1
    from unnest(v_expected_hold) x
    where not (x = any(v_ack))
  ) or exists (
    select 1
    from unnest(v_ack) x
    where not (x = any(v_expected_hold))
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'hold_out_ack_required',
      'heldOut', v_held,
      'message', 'Confirm the items that will not be shared yet before continuing.'
    );
  end if;

  v_held_meta := v_held;

  for v_entry in
    select te.*
    from public.timeline_entries te
    where te.venue_id = v_venue_id
      and te.event_id = p_event_id
      and te.owner = 'venue'
      and te.id in (
        select (w->>'id')::uuid from jsonb_array_elements(v_will) w
      )
    order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
  loop
    v_snapshot := v_snapshot || jsonb_build_array(
      public._venue_timeline_entry_release_json(v_entry.id, v_venue_id)
    );
    v_count := v_count + 1;
  end loop;

  begin
    insert into public.venue_timeline_releases (
      venue_id, event_id, snapshot, entry_count, held_out, source,
      idempotency_key, working_fingerprint
    ) values (
      v_venue_id, p_event_id, v_snapshot, v_count, v_held_meta, 'release',
      nullif(trim(coalesce(p_idempotency_key, '')), ''), v_fp
    )
    returning id into v_release_id;
  exception
    when unique_violation then
      -- Concurrent retry with the same idempotency key: return the winner.
      if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
        select r.id into v_existing
        from public.venue_timeline_releases r
        where r.event_id = p_event_id
          and r.venue_id = v_venue_id
          and r.idempotency_key = p_idempotency_key;
        if v_existing is not null then
          return jsonb_build_object(
            'ok', true,
            'releaseId', v_existing,
            'idempotentReplay', true
          );
        end if;
      end if;
      return jsonb_build_object(
        'ok', false,
        'error', 'release_conflict',
        'message', 'Sharing didn''t finish. The couple still has the previous shared timeline.'
      );
  end;

  update public.events
  set active_venue_timeline_release_id = v_release_id
  where id = p_event_id and venue_id = v_venue_id;

  return jsonb_build_object(
    'ok', true,
    'releaseId', v_release_id,
    'entryCount', v_count,
    'heldOutCount', jsonb_array_length(v_held_meta),
    'releasedAt', now(),
    'idempotentReplay', false
  );
end;
$$;

grant execute on function public.confirm_venue_timeline_release(uuid, uuid[], text, text) to authenticated;

-- ── Portal: venue items from active release snapshot ─────────────────────────

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
  v_release_id       uuid;
  v_snapshot         jsonb := '[]'::jsonb;
  v_client_entries   jsonb := '[]'::jsonb;
  v_venue_entries    jsonb := '[]'::jsonb;
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

  -- Couple-owned live draft (unchanged).
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
  into v_client_entries
  from public.timeline_entries te
  where te.event_id = v_event_id
    and te.venue_id = v_session.venue_id
    and te.owner = 'client';

  -- Venue framework: last successful release only (not live working rows).
  select e.active_venue_timeline_release_id into v_release_id
  from public.events e
  where e.id = v_event_id and e.venue_id = v_session.venue_id;

  if v_release_id is not null then
    select coalesce(r.snapshot, '[]'::jsonb) into v_snapshot
    from public.venue_timeline_releases r
    where r.id = v_release_id
      and r.event_id = v_event_id
      and r.venue_id = v_session.venue_id;

    select coalesce(
      jsonb_agg(
        (elem || jsonb_build_object(
          'canEdit', false,
          'canManageVisibility', false,
          'owner', 'venue'
        ))
        order by (elem->>'dayOffset')::int nulls last,
                 elem->>'entryTime' nulls last,
                 (elem->>'sortOrder')::int nulls last
      ),
      '[]'::jsonb
    )
    into v_venue_entries
    from jsonb_array_elements(v_snapshot) as elem;
  end if;

  select coalesce(
    (
      select jsonb_agg(x order by (x->>'dayOffset')::int nulls last, x->>'entryTime' asc nulls last, (x->>'sortOrder')::int nulls last)
      from (
        select jsonb_array_elements(coalesce(v_venue_entries, '[]'::jsonb)) as x
        union all
        select jsonb_array_elements(coalesce(v_client_entries, '[]'::jsonb)) as x
      ) u
    ),
    '[]'::jsonb
  )
  into v_entries;

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
    'entries', coalesce(v_entries, '[]'::jsonb),
    'sections', v_sections,
    'lastSubmittedAt', v_last_submitted,
    'hasUnpublishedChanges', v_has_unpublished,
    'activeVenueTimelineReleaseId', v_release_id
  );
end;
$$;

grant execute on function public.get_portal_run_of_show(text) to anon, authenticated;

-- ── Idempotent cutover for previously live-shared venue items ────────────────

do $$
declare
  v_event record;
  v_snapshot jsonb;
  v_count integer;
  v_release_id uuid;
  v_entry record;
begin
  for v_event in
    select e.id as event_id, e.venue_id
    from public.events e
    where e.active_venue_timeline_release_id is null
      and exists (
        select 1 from public.timeline_entries te
        where te.event_id = e.id
          and te.venue_id = e.venue_id
          and te.owner = 'venue'
          and 'client' = any(te.audiences)
      )
      and not exists (
        select 1 from public.venue_timeline_releases r
        where r.event_id = e.id and r.source = 'cutover'
      )
  loop
    v_snapshot := '[]'::jsonb;
    v_count := 0;
    for v_entry in
      select te.*
      from public.timeline_entries te
      where te.event_id = v_event.event_id
        and te.venue_id = v_event.venue_id
        and te.owner = 'venue'
        and 'client' = any(te.audiences)
      order by te.day_offset, te.entry_time asc nulls last, te.sort_order, te.created_at
    loop
      v_snapshot := v_snapshot || jsonb_build_array(
        public._venue_timeline_entry_release_json(v_entry.id, v_event.venue_id)
      );
      v_count := v_count + 1;
    end loop;

    if v_count = 0 then
      continue;
    end if;

    insert into public.venue_timeline_releases (
      venue_id, event_id, snapshot, entry_count, held_out, source, idempotency_key
    ) values (
      v_event.venue_id, v_event.event_id, v_snapshot, v_count, '[]'::jsonb, 'cutover',
      'cutover:' || v_event.event_id::text
    )
    on conflict (event_id, idempotency_key) do nothing
    returning id into v_release_id;

    if v_release_id is null then
      select r.id into v_release_id
      from public.venue_timeline_releases r
      where r.event_id = v_event.event_id
        and r.idempotency_key = 'cutover:' || v_event.event_id::text;
    end if;

    if v_release_id is not null then
      update public.events
      set active_venue_timeline_release_id = v_release_id
      where id = v_event.event_id
        and venue_id = v_event.venue_id
        and active_venue_timeline_release_id is null;
    end if;
  end loop;
end $$;
