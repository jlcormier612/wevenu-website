-- ============================================================================
-- Studio Canonical State Pass — color_story_id needs an explicit "clear"
--
-- update_my_website's existing "only touch what was sent" pattern —
-- `if p_color_story_id is not null then update ... end if` — is correct for
-- every OTHER field, where the app simply never sends a field it didn't
-- change. But color_story_id has a real third state to express: "this was
-- a curated Color Story, and the couple just edited an individual color
-- role, so it no longer is one." That has to reach the database as an
-- explicit NULL, and the existing IS NOT NULL guard silently swallows a
-- NULL p_color_story_id as "no change" — so a couple's curated selection
-- kept reporting its old curated name everywhere even after they'd
-- genuinely changed to a custom palette. p_clear_custom_colors already
-- solved the identical problem for the six color columns; this is the same
-- fix for color_story_id specifically.
-- ============================================================================

drop function if exists public.update_my_website(
  text, text, boolean, text, boolean, text, text, text, text, text[],
  text, jsonb, text[], boolean, uuid, uuid, uuid, uuid,
  text, text, text, text, text, text, boolean, text
);

create or replace function public.update_my_website(
  p_token text, p_slug text default null, p_is_published boolean default null,
  p_password text default null, p_clear_password boolean default false,
  p_theme text default null, p_theme_palette text default null, p_accent_color text default null,
  p_font_pairing text default null, p_section_order text[] default null,
  p_content_key text default null, p_content_value jsonb default null,
  p_sections_enabled text[] default null, p_schedule_sync boolean default null,
  p_collection_id uuid default null, p_color_story_id uuid default null,
  p_typography_style_id uuid default null, p_photo_style_id uuid default null,
  p_color_primary text default null, p_color_secondary text default null,
  p_color_accent text default null, p_color_neutral text default null,
  p_color_background text default null, p_color_text text default null,
  p_clear_custom_colors boolean default false,
  p_action text default null,
  p_clear_color_story_id boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site_id uuid;
  v_next_version int;
  v_snapshot jsonb;
  v_new_version_id uuid;
  v_celebrated boolean := false;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  insert into public.couple_websites (venue_id, client_id, slug)
  values (v_session.venue_id, v_session.client_id,
          coalesce(p_slug, 'wedding-' || left(gen_random_uuid()::text, 8)))
  on conflict (client_id) do update set updated_at = now()
  returning id into v_site_id;

  if p_slug is not null then
    update public.couple_websites set slug = p_slug, updated_at = now() where id = v_site_id;
  end if;
  if p_clear_password then
    update public.couple_websites set password = null, updated_at = now() where id = v_site_id;
  elsif p_password is not null then
    update public.couple_websites set password = p_password, updated_at = now() where id = v_site_id;
  end if;
  if p_theme is not null then
    update public.couple_websites set theme = p_theme, updated_at = now() where id = v_site_id;
  end if;
  if p_theme_palette is not null then
    update public.couple_websites set theme_palette = p_theme_palette, updated_at = now() where id = v_site_id;
  end if;
  if p_accent_color is not null then
    update public.couple_websites set accent_color = p_accent_color, updated_at = now() where id = v_site_id;
  end if;
  if p_font_pairing is not null then
    update public.couple_websites set font_pairing = p_font_pairing, updated_at = now() where id = v_site_id;
  end if;
  if p_section_order is not null then
    update public.couple_websites set section_order = p_section_order, updated_at = now() where id = v_site_id;
  end if;
  if p_content_key is not null and p_content_value is not null then
    update public.couple_websites
    set content = jsonb_set(content, array[p_content_key], p_content_value), updated_at = now()
    where id = v_site_id;
  end if;
  if p_sections_enabled is not null then
    update public.couple_websites set sections_enabled = p_sections_enabled, updated_at = now() where id = v_site_id;
  end if;
  if p_schedule_sync is not null then
    update public.couple_websites set schedule_sync = p_schedule_sync, updated_at = now() where id = v_site_id;
  end if;
  if p_collection_id is not null then
    update public.couple_websites set collection_id = p_collection_id, updated_at = now() where id = v_site_id;
  end if;
  -- p_clear_color_story_id is the new explicit-clear path (see file header);
  -- p_color_story_id is-not-null keeps working exactly as before for an
  -- actual curated pick.
  if p_clear_color_story_id then
    update public.couple_websites set color_story_id = null, updated_at = now() where id = v_site_id;
  elsif p_color_story_id is not null then
    update public.couple_websites set color_story_id = p_color_story_id, updated_at = now() where id = v_site_id;
  end if;
  if p_typography_style_id is not null then
    update public.couple_websites set typography_style_id = p_typography_style_id, updated_at = now() where id = v_site_id;
  end if;
  if p_photo_style_id is not null then
    update public.couple_websites set photo_style_id = p_photo_style_id, updated_at = now() where id = v_site_id;
  end if;
  -- Custom color picker (Part 2) — each provided value is written
  -- independently, same "only touch what was sent" pattern as every other
  -- field above. p_clear_custom_colors resets all six back to null in one
  -- shot (couple explicitly reverting to their Color Story's own tokens).
  if p_clear_custom_colors then
    update public.couple_websites set
      color_primary = null, color_secondary = null, color_accent = null,
      color_neutral = null, color_background = null, color_text = null,
      updated_at = now()
    where id = v_site_id;
  else
    if p_color_primary is not null then update public.couple_websites set color_primary = p_color_primary, updated_at = now() where id = v_site_id; end if;
    if p_color_secondary is not null then update public.couple_websites set color_secondary = p_color_secondary, updated_at = now() where id = v_site_id; end if;
    if p_color_accent is not null then update public.couple_websites set color_accent = p_color_accent, updated_at = now() where id = v_site_id; end if;
    if p_color_neutral is not null then update public.couple_websites set color_neutral = p_color_neutral, updated_at = now() where id = v_site_id; end if;
    if p_color_background is not null then update public.couple_websites set color_background = p_color_background, updated_at = now() where id = v_site_id; end if;
    if p_color_text is not null then update public.couple_websites set color_text = p_color_text, updated_at = now() where id = v_site_id; end if;
  end if;

  insert into public.experience_sections
    (experience_id, section_key, title, owner, sync_mode, sort_order)
  select v_site_id, s.section_key, s.title, s.owner, s.default_sync_mode, s.sort_order
  from (values
    ('home',         'Home & Welcome',   'guided',           'one_time_copy', 0),
    ('story',        'Your Story',       'guided',           'one_time_copy', 1),
    ('event',        'Event Details',    'couple_authored',  'manual',        2),
    ('gallery',      'Photo Gallery',    'couple_authored',  'manual',        3),
    ('schedule',     'Day-of Schedule',  'live_synced',       'live',          4),
    ('travel',       'Travel & Hotels',  'couple_authored',  'manual',        5),
    ('dress_code',   'Dress Code',       'couple_authored',  'manual',        6),
    ('bridal_party', 'Wedding Party',    'couple_authored',  'manual',        7),
    ('things_to_do', 'Things To Do',     'couple_authored',  'manual',        8),
    ('music',        'Music',            'couple_authored',  'manual',        9),
    ('registry',     'Registry',         'couple_authored',  'manual',       10),
    ('faq',          'FAQ',              'couple_authored',  'manual',       11),
    ('rsvp',         'RSVP',             'live_synced',       'live',         12)
  ) as s(section_key, title, owner, default_sync_mode, sort_order)
  on conflict (experience_id, section_key) do nothing;

  if p_content_key is not null and p_content_value is not null then
    update public.experience_sections
    set content = p_content_value, updated_at = now()
    where experience_id = v_site_id and section_key = p_content_key;
  end if;
  if p_schedule_sync is not null then
    update public.experience_sections
    set sync_mode = case when p_schedule_sync then 'live' else 'manual' end,
        data_source = case when p_schedule_sync then 'timeline_entries' else null end,
        updated_at = now()
    where experience_id = v_site_id and section_key = 'schedule';
  end if;
  if p_section_order is not null then
    update public.experience_sections es
    set sort_order = ord.i, updated_at = now()
    from unnest(p_section_order) with ordinality as ord(section_key, i)
    where es.experience_id = v_site_id and es.section_key = ord.section_key;
  end if;

  -- Publishing: a commitment, not a save. Every explicit publish (first
  -- time, or a re-publish while already published) writes a new frozen
  -- snapshot and repoints current_version_id at it.
  if p_is_published is true then
    select coalesce(max(version_number), 0) + 1 into v_next_version
    from public.experience_versions where experience_id = v_site_id;

    select jsonb_build_object(
      'slug', w.slug,
      'collectionId', w.collection_id, 'colorStoryId', w.color_story_id, 'typographyStyleId', w.typography_style_id,
      'photoStyleId', w.photo_style_id,
      'colorPrimary', w.color_primary, 'colorSecondary', w.color_secondary, 'colorAccent', w.color_accent,
      'colorNeutral', w.color_neutral, 'colorBackground', w.color_background, 'colorText', w.color_text,
      'theme', coalesce(c.key, w.theme), 'themePalette', coalesce(cs.name, w.theme_palette), 'fontPairing', coalesce(ts.key, w.font_pairing),
      'accentColor', w.accent_color, 'scheduleSync', w.schedule_sync,
      'sections', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'key', es.section_key, 'title', es.title, 'owner', es.owner, 'syncMode', es.sync_mode,
          'sortOrder', es.sort_order, 'visibility', es.visibility,
          'content', case when es.sync_mode = 'live' then null else es.content end
        ) order by es.sort_order), '[]'::jsonb)
        from public.experience_sections es where es.experience_id = w.id
      )
    )
    into v_snapshot
    from public.couple_websites w
    left join public.collections c on c.id = w.collection_id
    left join public.color_stories cs on cs.id = w.color_story_id
    left join public.typography_styles ts on ts.id = w.typography_style_id
    where w.id = v_site_id;

    insert into public.experience_versions (experience_id, version_number, snapshot)
    values (v_site_id, v_next_version, v_snapshot)
    returning id into v_new_version_id;

    update public.couple_websites
    set status = 'published', current_version_id = v_new_version_id, updated_at = now()
    where id = v_site_id;

    insert into public.luv_celebrations (venue_id, client_id, celebration_type, entity_id)
    values (v_session.venue_id, v_session.client_id, 'website_published', v_site_id)
    on conflict (client_id, celebration_type) do nothing
    returning true into v_celebrated;
  elsif p_is_published is false then
    update public.couple_websites set status = 'draft', updated_at = now() where id = v_site_id;
  end if;

  if p_action = 'archive' then
    update public.couple_websites set status = 'archived', updated_at = now() where id = v_site_id;
  elsif p_action = 'unarchive' then
    update public.couple_websites set status = 'published', updated_at = now() where id = v_site_id;
  end if;

  return jsonb_build_object('ok', true, 'siteId', v_site_id, 'celebrated', coalesce(v_celebrated, false));
end;
$$;

notify pgrst, 'reload schema';
