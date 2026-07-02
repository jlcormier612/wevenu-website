-- ============================================================================
-- Sprint 65: Memory Journal + Living Activity Feed
--
-- couple_journal_entries — couple-owned (no venue_id, not cascade-deleted on
-- venue termination). Partners capture moments from their journey: venue tours,
-- dress shopping, milestone celebrations. The raw material of the keepsake.
--
-- get_journal_entries     — read all entries for a portal session
-- add_journal_entry       — create an entry
-- delete_journal_entry    — remove an entry (couple only)
-- get_recent_activity     — 7-day summary across media, guests, todos, journal
-- ============================================================================

-- ── 1. Table ─────────────────────────────────────────────────────────────────

create table public.couple_journal_entries (
  id          uuid        primary key default gen_random_uuid(),
  client_id   uuid        not null references public.clients(id) on delete cascade,

  entry_date  date        not null default current_date,
  title       text        check (char_length(coalesce(trim(title), '')) <= 120),
  body        text        not null
                          check (char_length(trim(body)) > 0
                             and char_length(trim(body)) <= 500),

  milestone   text        check (milestone in (
    'venue_tour', 'engagement_party', 'dress_shopping', 'venue_signed',
    'save_the_dates', 'vendor_booked', 'bridal_shower', 'bachelorette',
    'rehearsal', 'wedding_day', 'other'
  )),

  -- Optional photo; set null if the media record is later deleted
  media_id    uuid        references public.client_media(id) on delete set null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Couple-owned: no venue SELECT policy — venue cannot see journal entries
alter table public.couple_journal_entries enable row level security;

create index cje_client_date on public.couple_journal_entries (client_id, entry_date desc);

-- ── 2. get_journal_entries ───────────────────────────────────────────────────

create or replace function public.get_journal_entries(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',        j.id,
          'entryDate', j.entry_date,
          'title',     j.title,
          'body',      j.body,
          'milestone', j.milestone,
          'mediaId',   j.media_id,
          'mediaUrl',  (select file_url from public.client_media where id = j.media_id limit 1),
          'createdAt', j.created_at
        ) order by j.entry_date desc, j.created_at desc
      )
      from public.couple_journal_entries j
      where j.client_id = v_session.client_id
    ), '[]'::jsonb)
  );
end;
$$;

-- ── 3. add_journal_entry ─────────────────────────────────────────────────────

create or replace function public.add_journal_entry(
  p_token     text,
  p_date      date,
  p_title     text        default '',
  p_body      text        default '',
  p_milestone text        default null,
  p_media_id  uuid        default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_id      uuid;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if trim(coalesce(p_body, '')) = '' or char_length(trim(p_body)) > 500 then
    return jsonb_build_object('ok', false, 'error', 'body_invalid');
  end if;

  insert into public.couple_journal_entries
    (client_id, entry_date, title, body, milestone, media_id)
  values (
    v_session.client_id,
    coalesce(p_date, current_date),
    nullif(trim(coalesce(p_title, '')), ''),
    trim(p_body),
    p_milestone,
    p_media_id
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'entryId', v_id);
end;
$$;

-- ── 4. delete_journal_entry ──────────────────────────────────────────────────

create or replace function public.delete_journal_entry(
  p_token    text,
  p_entry_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  delete from public.couple_journal_entries
  where id = p_entry_id
    and client_id = v_session.client_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── 5. get_recent_activity ───────────────────────────────────────────────────
-- 7-day rolling window across photos, guests, todos, and journal entries.
-- Returns up to ~8 activity events plus a totalThisWeek count.

create or replace function public.get_recent_activity(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session      public.client_portal_sessions%rowtype;
  v_since        timestamptz;
  v_photo_agg    jsonb;
  v_guest_count  bigint;
  v_guest_at     timestamptz;
  v_todo_agg     jsonb;
  v_journal_agg  jsonb;
  v_events       jsonb;
  v_total        bigint;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  v_since := now() - interval '7 days';

  -- Recent photos (up to 3)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'type',       'photo_uploaded',
      'emoji',      case m.category
                      when 'engagement'   then '📸'
                      when 'florals'      then '🌸'
                      when 'fashion'      then '👗'
                      when 'cake'         then '🎂'
                      when 'decor'        then '✨'
                      when 'photography'  then '📷'
                      when 'colors'       then '🎨'
                      when 'stationery'   then '💌'
                      when 'memory'       then '💗'
                      else '📸'
                    end,
      'label',      case m.category
                      when 'engagement' then 'Added an engagement photo'
                      when 'memory'     then 'Captured a memory'
                      else 'Saved ' || initcap(m.category) || ' inspiration'
                    end,
      'occurredAt', m.created_at
    ) order by m.created_at desc
  ), '[]'::jsonb)
  into v_photo_agg
  from (
    select * from public.client_media
    where client_id = v_session.client_id
      and venue_id  = v_session.venue_id
      and created_at >= v_since
    order by created_at desc
    limit 3
  ) m;

  -- Guest additions: aggregate into one line
  select count(*), max(created_at)
  into v_guest_count, v_guest_at
  from public.couple_guests
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
    and created_at >= v_since;

  -- Completed todos (up to 2)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'type',       'todo_completed',
      'emoji',      '✅',
      'label',      'Checked off "' || t.title || '"',
      'occurredAt', t.completed_at
    ) order by t.completed_at desc
  ), '[]'::jsonb)
  into v_todo_agg
  from (
    select * from public.couple_todos
    where client_id = v_session.client_id
      and completed_at >= v_since
      and completed_at is not null
    order by completed_at desc
    limit 2
  ) t;

  -- Journal entries this week (up to 2)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'type',       'journal_entry',
      'emoji',      '📖',
      'label',      case when j.title is not null
                      then 'Wrote about "' || j.title || '"'
                      else 'Added a moment to your journal'
                    end,
      'occurredAt', j.created_at
    ) order by j.created_at desc
  ), '[]'::jsonb)
  into v_journal_agg
  from (
    select * from public.couple_journal_entries
    where client_id = v_session.client_id
      and created_at >= v_since
    order by created_at desc
    limit 2
  ) j;

  -- Combine all streams
  v_events := v_photo_agg || v_todo_agg || v_journal_agg;
  if coalesce(v_guest_count, 0) > 0 then
    v_events := v_events || jsonb_build_array(jsonb_build_object(
      'type',       'guest_added',
      'emoji',      '👥',
      'label',      'Added ' || v_guest_count::text || ' guest' ||
                    case when v_guest_count = 1 then '' else 's' end ||
                    ' to your list',
      'occurredAt', v_guest_at
    ));
  end if;

  -- Total actions this week (for the "quiet week" check)
  select count(*) into v_total from (
    select id from public.client_media
      where client_id = v_session.client_id
        and venue_id  = v_session.venue_id
        and created_at >= v_since
    union all
    select id from public.couple_guests
      where client_id = v_session.client_id
        and venue_id  = v_session.venue_id
        and created_at >= v_since
    union all
    select id from public.couple_todos
      where client_id = v_session.client_id
        and completed_at >= v_since
        and completed_at is not null
    union all
    select id from public.couple_journal_entries
      where client_id = v_session.client_id
        and created_at >= v_since
  ) t;

  return jsonb_build_object(
    'activity',      v_events,
    'totalThisWeek', coalesce(v_total, 0)
  );
end;
$$;

notify pgrst, 'reload schema';
