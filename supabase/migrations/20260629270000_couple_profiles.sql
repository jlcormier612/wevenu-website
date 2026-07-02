-- ============================================================================
-- Sprint 63: Couple Profiles + Media Storage
--
-- Two additions:
--   1. couple_profiles — wedding hashtag, our story, hero/couple photo FKs
--   2. Storage bucket for client media uploads
--
-- The couple owns this data entirely. The venue has no read access to
-- private profile content — only to what the couple explicitly shares.
-- ============================================================================

-- ── 1. Storage bucket ────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-media',
  'client-media',
  true,                  -- public URLs, privacy enforced at DB layer
  10485760,              -- 10 MB per file
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- ── 2. couple_profiles ───────────────────────────────────────────────────────

create table public.couple_profiles (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  client_id       uuid not null unique references public.clients(id) on delete cascade,

  -- Personal narrative
  wedding_hashtag text check (char_length(coalesce(trim(wedding_hashtag), '')) <= 80),
  our_story       text check (char_length(coalesce(trim(our_story), '')) <= 500),

  -- Featured photos (soft FKs — client_media may not exist yet)
  hero_photo_id   uuid,  -- the engagement photo used as hero background
  couple_photo_id uuid,  -- profile avatar

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Venue has no read access to the couple's personal profile
alter table public.couple_profiles enable row level security;

-- No RLS policy for venue — couple_profiles is entirely couple-owned

create index cp_client on public.couple_profiles (client_id);

-- ── SECURITY DEFINER functions ────────────────────────────────────────────────

-- get_couple_profile: returns profile + categorised media
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
        and m.category  = 'inspiration'
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
    ), '[]'::jsonb)
  );
end;
$$;

-- save_couple_profile: upsert wedding hashtag + our story
create or replace function public.save_couple_profile(
  p_token           text,
  p_wedding_hashtag text,
  p_our_story       text
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
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  insert into public.couple_profiles (venue_id, client_id, wedding_hashtag, our_story)
  values (
    v_session.venue_id, v_session.client_id,
    nullif(trim(coalesce(p_wedding_hashtag, '')), ''),
    nullif(trim(coalesce(p_our_story, '')), '')
  )
  on conflict (client_id) do update
    set wedding_hashtag = nullif(trim(coalesce(p_wedding_hashtag, '')), ''),
        our_story       = nullif(trim(coalesce(p_our_story, '')), ''),
        updated_at      = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- set_hero_photo: couple chooses which engagement photo goes behind the hero
create or replace function public.set_hero_photo(p_token text, p_media_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  -- Verify the photo belongs to this couple
  if not exists (
    select 1 from public.client_media
    where id = p_media_id
      and client_id = v_session.client_id
      and venue_id  = v_session.venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'media_not_found');
  end if;

  insert into public.couple_profiles (venue_id, client_id, hero_photo_id)
  values (v_session.venue_id, v_session.client_id, p_media_id)
  on conflict (client_id) do update
    set hero_photo_id = p_media_id,
        updated_at    = now();

  return jsonb_build_object('ok', true);
end;
$$;

-- set_couple_photo: profile avatar
create or replace function public.set_couple_photo(p_token text, p_media_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (
    select 1 from public.client_media
    where id = p_media_id and client_id = v_session.client_id and venue_id = v_session.venue_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'media_not_found');
  end if;

  insert into public.couple_profiles (venue_id, client_id, couple_photo_id)
  values (v_session.venue_id, v_session.client_id, p_media_id)
  on conflict (client_id) do update
    set couple_photo_id = p_media_id,
        updated_at      = now();

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_couple_profile(text)           to anon, authenticated;
grant execute on function public.save_couple_profile(text, text, text) to anon, authenticated;
grant execute on function public.set_hero_photo(text, uuid)         to anon, authenticated;
grant execute on function public.set_couple_photo(text, uuid)       to anon, authenticated;

notify pgrst, 'reload schema';
