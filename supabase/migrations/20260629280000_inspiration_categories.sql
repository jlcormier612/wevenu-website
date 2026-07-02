-- ============================================================================
-- Sprint 64: Inspiration Board Categories
--
-- Expands client_media.category to support fine-grained inspiration
-- sub-categories. Instead of a generic 'inspiration' bucket, couples now
-- save photos to: florals, fashion, cake, decor, photography, colors, or
-- stationery. The generic 'inspiration' remains as a catch-all.
--
-- Also updates get_couple_profile to return inspiration photos grouped by
-- their category so the UI can render filtered tabs without extra queries.
-- ============================================================================

-- ── 1. Expand the category check constraint ───────────────────────────────────

alter table public.client_media
  drop constraint if exists client_media_category_check;

alter table public.client_media
  add constraint client_media_category_check check (category in (
    -- Engagement
    'engagement',
    -- Inspiration sub-categories
    'inspiration',   -- generic / untagged
    'florals',
    'fashion',       -- dress, suit, accessories
    'cake',
    'decor',
    'photography',   -- style, posing, lighting inspiration
    'colors',        -- color palettes, swatches
    'stationery',    -- invitations, save the dates, signage
    -- Journey
    'memory',
    'gallery',       -- formal wedding website gallery
    'venue_visit',
    'other'
  ));

-- ── 2. Update get_couple_profile to return inspiration by sub-category ────────

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

    -- All inspiration photos (any sub-category) — client filters in JS
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
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
