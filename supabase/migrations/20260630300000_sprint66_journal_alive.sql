-- ============================================================================
-- Sprint 66: The Journal Comes Alive
--
-- 1. source column on couple_journal_entries ('manual' | 'auto')
-- 2. create_auto_memory() — internal helper called by triggers
-- 3. Trigger: first engagement photo → auto-memory
-- 4. Trigger: guest list crosses 50 → auto-memory
-- 5. Trigger: hero photo set for the first time → auto-memory
-- 6. Updated get_couple_profile — returns latestJournalEntry
-- 7. Updated get_journal_entries — returns source field
-- 8. Updated get_recent_activity — returns source in journal events
-- ============================================================================

-- ── 1. source column ─────────────────────────────────────────────────────────

alter table public.couple_journal_entries
  add column source text not null default 'manual'
    check (source in ('manual', 'auto'));

-- ── 2. create_auto_memory — internal, not token-gated ────────────────────────
-- Called only from trusted triggers/functions. p_client_id is taken directly
-- from the triggering row, so no user-supplied token is needed.

create or replace function public.create_auto_memory(
  p_client_id uuid,
  p_date      date,
  p_title     text,
  p_body      text,
  p_milestone text  default null,
  p_media_id  uuid  default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.couple_journal_entries
    (client_id, entry_date, title, body, source, milestone, media_id)
  values
    (p_client_id, p_date, p_title, p_body, 'auto', p_milestone, p_media_id);
end;
$$;

-- ── 3. Trigger: first engagement photo ───────────────────────────────────────

create or replace function public.trg_fn_first_engagement_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  if new.category = 'engagement' then
    select count(*) into v_count
    from public.client_media
    where client_id = new.client_id
      and category  = 'engagement';

    if v_count = 1 then
      perform public.create_auto_memory(
        new.client_id,
        current_date,
        'First engagement photo',
        'Your first engagement photo is here. This is the beginning of your visual story.',
        null,
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_first_engagement_photo
  after insert on public.client_media
  for each row execute function public.trg_fn_first_engagement_photo();

-- ── 4. Trigger: guest list crosses 50 ────────────────────────────────────────

create or replace function public.trg_fn_guest_milestone_50()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.couple_guests
  where client_id = new.client_id
    and venue_id  = new.venue_id;

  if v_count = 50 then
    perform public.create_auto_memory(
      new.client_id,
      current_date,
      '50 guests',
      '50 people are coming to your wedding. Your celebration is really taking shape.',
      null,
      null
    );
  end if;
  return new;
end;
$$;

create trigger trg_guest_milestone_50
  after insert on public.couple_guests
  for each row execute function public.trg_fn_guest_milestone_50();

-- ── 5. Trigger: hero photo set for the first time ────────────────────────────

create or replace function public.trg_fn_hero_photo_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.hero_photo_id is null and new.hero_photo_id is not null then
    perform public.create_auto_memory(
      new.client_id,
      current_date,
      'This portal is yours',
      'You set your first hero photo and made this space feel like home. ✦',
      null,
      new.hero_photo_id
    );
  end if;
  return new;
end;
$$;

create trigger trg_hero_photo_set
  after update on public.couple_profiles
  for each row execute function public.trg_fn_hero_photo_set();

-- ── 6. Updated get_couple_profile — adds latestJournalEntry ──────────────────

create or replace function public.get_couple_profile(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_profile public.couple_profiles%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select * into v_profile from public.couple_profiles
  where client_id = v_session.client_id;

  return jsonb_build_object(
    'profile', case when v_profile.id is not null then jsonb_build_object(
      'weddingHashtag',  v_profile.wedding_hashtag,
      'ourStory',        v_profile.our_story,
      'heroPhotoId',     v_profile.hero_photo_id,
      'heroPhotoUrl',    (select file_url from public.client_media where id = v_profile.hero_photo_id limit 1),
      'couplePhotoId',   v_profile.couple_photo_id,
      'couplePhotoUrl',  (select file_url from public.client_media where id = v_profile.couple_photo_id limit 1)
    ) else null end,

    'engagementPhotos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'fileUrl', m.file_url, 'mediaType', m.media_type,
        'category', m.category, 'visibility', m.visibility,
        'caption', m.caption, 'createdAt', m.created_at
      ) order by m.created_at desc)
      from public.client_media m
      where m.client_id = v_session.client_id
        and m.venue_id  = v_session.venue_id
        and m.category  = 'engagement'
    ), '[]'::jsonb),

    'inspirationPhotos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'fileUrl', m.file_url, 'mediaType', m.media_type,
        'category', m.category, 'visibility', m.visibility,
        'caption', m.caption, 'createdAt', m.created_at
      ) order by m.created_at desc)
      from public.client_media m
      where m.client_id = v_session.client_id
        and m.venue_id  = v_session.venue_id
        and m.category in (
          'inspiration', 'florals', 'fashion', 'cake',
          'decor', 'photography', 'colors', 'stationery'
        )
    ), '[]'::jsonb),

    'memoryPhotos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'fileUrl', m.file_url, 'mediaType', m.media_type,
        'category', m.category, 'visibility', m.visibility,
        'caption', m.caption, 'createdAt', m.created_at
      ) order by m.created_at desc)
      from public.client_media m
      where m.client_id = v_session.client_id
        and m.venue_id  = v_session.venue_id
        and m.category  = 'memory'
      limit 20
    ), '[]'::jsonb),

    -- Most recent journal entry for the Overview memory strip
    'latestJournalEntry', (
      select jsonb_build_object(
        'id',        j.id,
        'entryDate', j.entry_date,
        'title',     j.title,
        'body',      j.body,
        'milestone', j.milestone,
        'source',    j.source,
        'mediaId',   j.media_id,
        'mediaUrl',  (select file_url from public.client_media where id = j.media_id limit 1),
        'createdAt', j.created_at
      )
      from public.couple_journal_entries j
      where j.client_id = v_session.client_id
      order by j.entry_date desc, j.created_at desc
      limit 1
    )
  );
end;
$$;

-- ── 7. Updated get_journal_entries — includes source ─────────────────────────

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
          'source',    j.source,
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

-- ── 8. Updated get_recent_activity — source in journal events ────────────────

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
      'occurredAt', m.created_at,
      'source',     'manual'
    ) order by m.created_at desc
  ), '[]'::jsonb)
  into v_photo_agg
  from (
    select * from public.client_media
    where client_id = v_session.client_id
      and venue_id  = v_session.venue_id
      and created_at >= v_since
    order by created_at desc limit 3
  ) m;

  select count(*), max(created_at)
  into v_guest_count, v_guest_at
  from public.couple_guests
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
    and created_at >= v_since;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'type',       'todo_completed',
      'emoji',      '✅',
      'label',      'Checked off "' || t.title || '"',
      'occurredAt', t.completed_at,
      'source',     'manual'
    ) order by t.completed_at desc
  ), '[]'::jsonb)
  into v_todo_agg
  from (
    select * from public.couple_todos
    where client_id  = v_session.client_id
      and completed_at >= v_since
      and completed_at is not null
    order by completed_at desc limit 2
  ) t;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'type',       'journal_entry',
      'emoji',      case when j.source = 'auto' then '✦' else '📖' end,
      'label',      case
                      when j.source = 'auto' then j.title
                      when j.title  is not null then 'Wrote about "' || j.title || '"'
                      else 'Added a moment to your journal'
                    end,
      'occurredAt', j.created_at,
      'source',     j.source
    ) order by j.created_at desc
  ), '[]'::jsonb)
  into v_journal_agg
  from (
    select * from public.couple_journal_entries
    where client_id = v_session.client_id
      and created_at >= v_since
    order by created_at desc limit 2
  ) j;

  v_events := v_photo_agg || v_todo_agg || v_journal_agg;
  if coalesce(v_guest_count, 0) > 0 then
    v_events := v_events || jsonb_build_array(jsonb_build_object(
      'type',       'guest_added',
      'emoji',      '👥',
      'label',      'Added ' || v_guest_count::text || ' guest' ||
                    case when v_guest_count = 1 then '' else 's' end || ' to your list',
      'occurredAt', v_guest_at,
      'source',     'manual'
    ));
  end if;

  select count(*) into v_total from (
    select id from public.client_media
      where client_id = v_session.client_id and venue_id = v_session.venue_id
        and created_at >= v_since
    union all
    select id from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
        and created_at >= v_since
    union all
    select id from public.couple_todos
      where client_id = v_session.client_id
        and completed_at >= v_since and completed_at is not null
    union all
    select id from public.couple_journal_entries
      where client_id = v_session.client_id and created_at >= v_since
  ) t;

  return jsonb_build_object(
    'activity',      v_events,
    'totalThisWeek', coalesce(v_total, 0)
  );
end;
$$;

notify pgrst, 'reload schema';
