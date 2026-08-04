-- Coastal Premium Art-Direction Proof Pass (2026-08-03)
--
-- 1. Extend get_wedding_website + get_my_website with a `venue` object
--    (name/heroImageUrl/story) by joining the venues table the wedding
--    website's own RPCs never joined before. Same read-only columns and
--    join pattern get_portal_context already uses for the couple portal —
--    no new table, no new column, no duplicate image storage.
-- 2. Seed collections.layout_config.sectionRoles for Coastal only — a
--    closed-vocabulary per-section canvas/scale map used for whole-page
--    color and visual-weight choreography. No other Collection is touched.

create or replace function public.get_wedding_website(
  p_slug text, p_password text default null::text, p_session_id text default null::text,
  p_page text default 'home'::text, p_preview_token text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_site    public.couple_websites%rowtype;
  v_version public.experience_versions%rowtype;
  v_event   record;
  v_client  public.clients%rowtype;
  v_venue   public.venues%rowtype;
  v_guests  record;
  v_views   bigint;
  v_schedule jsonb;
  v_theme        text;
  v_theme_palette text;
  v_font_pairing text;
  v_accent_color text;
  v_schedule_sync boolean;
  v_sections_meta jsonb;
  v_content jsonb;
  v_is_preview boolean := false;
  v_layout_config jsonb;
  v_color_tokens jsonb;
  v_typography_tokens jsonb;
  v_photo_style_tokens jsonb;
begin
  select * into v_site from public.couple_websites where slug = p_slug;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if p_preview_token is not null and v_site.preview_token::text = p_preview_token then
    v_is_preview := true;
  elsif v_site.status not in ('published', 'archived') then
    return jsonb_build_object('error', 'not_found');
  end if;

  if not v_is_preview and v_site.password is not null then
    if p_password is null or v_site.password != p_password then
      return jsonb_build_object('requires_password', true);
    end if;
  end if;

  if not v_is_preview then
    select * into v_version from public.experience_versions where id = v_site.current_version_id;
  end if;

  if v_is_preview or not found then
    -- Live draft: preview link, or a defensive fallback for a published
    -- row with no snapshot (should not happen, never hard-fail a guest page).
    select coalesce(c.key, v_site.theme), coalesce(cs.name, v_site.theme_palette), coalesce(ts.key, v_site.font_pairing),
           c.layout_config, cs.tokens, ts.tokens
    into v_theme, v_theme_palette, v_font_pairing, v_layout_config, v_color_tokens, v_typography_tokens
    from (select 1) dummy
    left join public.collections c on c.id = v_site.collection_id
    left join public.color_stories cs on cs.id = v_site.color_story_id
    left join public.typography_styles ts on ts.id = v_site.typography_style_id;
    v_accent_color := v_site.accent_color;
    v_schedule_sync := v_site.schedule_sync;

    select ps.tokens into v_photo_style_tokens from public.photo_styles ps where ps.id = v_site.photo_style_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'key', es.section_key, 'title', es.title, 'owner', es.owner, 'syncMode', es.sync_mode, 'sortOrder', es.sort_order
    ) order by es.sort_order), '[]'::jsonb),
    coalesce(jsonb_object_agg(es.section_key, es.content) filter (where es.content is not null), '{}'::jsonb)
    into v_sections_meta, v_content
    from public.experience_sections es
    where es.experience_id = v_site.id and es.visibility <> 'hidden';
  else
    v_theme         := v_version.snapshot ->> 'theme';
    v_theme_palette := v_version.snapshot ->> 'themePalette';
    v_font_pairing  := v_version.snapshot ->> 'fontPairing';
    v_accent_color  := v_version.snapshot ->> 'accentColor';
    v_schedule_sync := (v_version.snapshot ->> 'scheduleSync')::boolean;
    v_layout_config := (select c.layout_config from public.collections c where c.id = v_site.collection_id);
    v_color_tokens  := (select cs.tokens from public.color_stories cs where cs.id = v_site.color_story_id);
    v_typography_tokens := (select ts.tokens from public.typography_styles ts where ts.id = v_site.typography_style_id);
    v_photo_style_tokens := (select ps.tokens from public.photo_styles ps where ps.id = v_site.photo_style_id);

    select coalesce(jsonb_agg(jsonb_build_object(
      'key', s.key, 'title', s.title, 'owner', s.owner, 'syncMode', s."syncMode", 'sortOrder', s."sortOrder"
    ) order by s."sortOrder"), '[]'::jsonb),
    coalesce(jsonb_object_agg(s.key, s.content) filter (where s.content is not null), '{}'::jsonb)
    into v_sections_meta, v_content
    from jsonb_to_recordset(v_version.snapshot -> 'sections')
      as s(key text, title text, owner text, "syncMode" text, "sortOrder" int, content jsonb, visibility text)
    where s.visibility is distinct from 'hidden';
  end if;

  -- Guest count / attendance context (unchanged)
  select coalesce(count(*) filter (where rsvp_status = 'attending'), 0) as attending,
         coalesce(count(*), 0) as total
  into v_guests
  from public.couple_guests where client_id = v_site.client_id;

  select e.id, e.event_date, e.event_type, e.name, e.guest_count into v_event
  from public.events e where e.client_id = v_site.client_id and e.venue_id = v_site.venue_id
  order by e.event_date limit 1;

  select c.* into v_client from public.clients c where c.id = v_site.client_id;

  select v.* into v_venue from public.venues v where v.id = v_site.venue_id;

  select count(*) into v_views from public.couple_website_views where website_id = v_site.id;

  return jsonb_build_object(
    'siteId', v_site.id, 'slug', v_site.slug, 'status', v_site.status, 'isPreview', v_is_preview,
    'requires_password', false,
    'theme', v_theme, 'themePalette', v_theme_palette, 'fontPairing', v_font_pairing,
    'accentColor', v_accent_color, 'scheduleSync', v_schedule_sync,
    'layoutConfig', coalesce(v_layout_config, '{}'::jsonb),
    'colorTokens', v_color_tokens,
    'typographyTokens', v_typography_tokens,
    'photoStyleTokens', v_photo_style_tokens,
    'colorPrimary', v_site.color_primary, 'colorSecondary', v_site.color_secondary,
    'colorAccent', v_site.color_accent, 'colorNeutral', v_site.color_neutral,
    'colorBackground', v_site.color_background, 'colorText', v_site.color_text,
    'sectionOrder', v_site.section_order,
    'sections', v_sections_meta,
    'content', v_content,
    'couple', jsonb_build_object(
      'firstName', v_client.first_name, 'lastName', v_client.last_name,
      'partnerFirstName', v_client.partner_first_name, 'partnerLastName', v_client.partner_last_name
    ),
    'venue', case when v_venue.id is not null then jsonb_build_object(
      'name', v_venue.name, 'heroImageUrl', v_venue.hero_image_url, 'story', v_venue.story
    ) else null end,
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'eventDate', v_event.event_date, 'eventType', v_event.event_type,
      'name', v_event.name, 'guestCount', v_event.guest_count
    ) else null end,
    'rsvpStats', jsonb_build_object('attending', v_guests.attending, 'total', v_guests.total),
    'totalViews', coalesce(v_views, 0)
  );
end;
$function$;

create or replace function public.get_my_website(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site    public.couple_websites%rowtype;
  v_venue   public.venues%rowtype;
  v_theme        text;
  v_theme_palette text;
  v_font_pairing text;
  v_sections     jsonb;
  v_current_published_at timestamptz;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select * into v_site
  from public.couple_websites
  where client_id = v_session.client_id and venue_id = v_session.venue_id;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  select coalesce(c.key, v_site.theme), coalesce(cs.name, v_site.theme_palette), coalesce(ts.key, v_site.font_pairing)
  into v_theme, v_theme_palette, v_font_pairing
  from (select 1) dummy
  left join public.collections c on c.id = v_site.collection_id
  left join public.color_stories cs on cs.id = v_site.color_story_id
  left join public.typography_styles ts on ts.id = v_site.typography_style_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', es.section_key, 'title', es.title, 'visibility', es.visibility,
    'owner', es.owner, 'syncMode', es.sync_mode, 'dataSource', es.data_source,
    'lastSyncedAt', es.last_synced_at, 'displayRules', es.display_rules,
    'animation', es.animation, 'sortOrder', es.sort_order, 'content', es.content
  ) order by es.sort_order), '[]'::jsonb)
  into v_sections
  from public.experience_sections es
  where es.experience_id = v_site.id;

  select ev.published_at into v_current_published_at
  from public.experience_versions ev where ev.id = v_site.current_version_id;

  select v.* into v_venue from public.venues v where v.id = v_site.venue_id;

  return jsonb_build_object(
    'exists',             true,
    'id',                 v_site.id,
    'slug',               v_site.slug,
    'status',              v_site.status,
    'isPublished',        v_site.is_published,
    'hasPendingChanges',  v_site.status = 'published' and v_current_published_at is not null and v_site.updated_at > v_current_published_at,
    'previewToken',       v_site.preview_token,
    'hasPassword',        v_site.password is not null,
    'theme',              v_theme,
    'themePalette',       v_theme_palette,
    'accentColor',        v_site.accent_color,
    'fontPairing',        v_font_pairing,
    'collectionId',       v_site.collection_id,
    'colorStoryId',       v_site.color_story_id,
    'typographyStyleId',  v_site.typography_style_id,
    'photoStyleId',       v_site.photo_style_id,
    'colorPrimary',       v_site.color_primary,
    'colorSecondary',     v_site.color_secondary,
    'colorAccent',        v_site.color_accent,
    'colorNeutral',       v_site.color_neutral,
    'colorBackground',    v_site.color_background,
    'colorText',          v_site.color_text,
    'sectionOrder',       v_site.section_order,
    'scheduleSync',       v_site.schedule_sync,
    'content',            v_site.content,
    'sections',           v_sections,
    'venue', case when v_venue.id is not null then jsonb_build_object(
      'name', v_venue.name, 'heroImageUrl', v_venue.hero_image_url, 'story', v_venue.story
    ) else null end
  );
end;
$function$;

-- Coastal-only whole-page canvas/scale choreography. Closed vocabulary:
-- canvas: light | soft | strong | photographic | neutral
-- scale:  feature | standard | interlude
update public.collections
set layout_config = layout_config || jsonb_build_object(
  'sectionRoles', jsonb_build_object(
    'hero',         jsonb_build_object('canvas', 'photographic', 'scale', 'feature'),
    'story',        jsonb_build_object('canvas', 'light',        'scale', 'standard'),
    'event',        jsonb_build_object('canvas', 'strong',       'scale', 'feature'),
    'gallery',      jsonb_build_object('canvas', 'photographic', 'scale', 'feature'),
    'schedule',     jsonb_build_object('canvas', 'soft',         'scale', 'standard'),
    'travel',       jsonb_build_object('canvas', 'light',        'scale', 'standard'),
    'dress_code',   jsonb_build_object('canvas', 'neutral',      'scale', 'interlude'),
    'bridal_party', jsonb_build_object('canvas', 'light',        'scale', 'interlude'),
    'things_to_do', jsonb_build_object('canvas', 'soft',         'scale', 'interlude'),
    'music',        jsonb_build_object('canvas', 'neutral',      'scale', 'interlude'),
    'registry',     jsonb_build_object('canvas', 'neutral',      'scale', 'interlude'),
    'faq',          jsonb_build_object('canvas', 'neutral',      'scale', 'interlude'),
    'rsvp',         jsonb_build_object('canvas', 'strong',       'scale', 'feature')
  )
)
where key = 'coastal';
