-- Hosted Experience Platform — RPC updates for the four independent
-- dimensions (2026-07-24). Additive only: every existing field this returns
-- today keeps returning exactly what it did before; new fields are added
-- alongside. A site with no photo_style_id/custom colors/collection with no
-- layout_config set simply gets null/{} for the new fields, and the
-- TypeScript renderer's own fallback defaults (unchanged, still the exact
-- values these functions used to hardcode) take over — this is what makes
-- existing published sites safe to leave exactly as they are.

create or replace function public.get_my_website(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site    public.couple_websites%rowtype;
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
    'sections',           v_sections
  );
end;
$$;

create or replace function public.get_wedding_website(
  p_slug text, p_password text default null, p_session_id text default null,
  p_page text default 'home', p_preview_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site    public.couple_websites%rowtype;
  v_version public.experience_versions%rowtype;
  v_event   record;
  v_client  public.clients%rowtype;
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
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'eventDate', v_event.event_date, 'eventType', v_event.event_type,
      'name', v_event.name, 'guestCount', v_event.guest_count
    ) else null end,
    'rsvpStats', jsonb_build_object('attending', v_guests.attending, 'total', v_guests.total),
    'totalViews', coalesce(v_views, 0)
  );
end;
$$;

-- Inserting new optional parameters before the existing trailing p_action
-- parameter makes this a distinct overload to Postgres, not a same-signature
-- replace — drop the old 18-arg signature explicitly so exactly one
-- update_my_website exists (otherwise PostgREST/Supabase RPC calls that
-- only pass the shared subset of named params risk an ambiguous-overload
-- error). Safe on a fresh `db reset --local` replay: this DROP simply
-- no-ops if the old signature was never created (IF EXISTS).
drop function if exists public.update_my_website(
  text, text, boolean, text, boolean, text, text, text, text, text[],
  text, jsonb, text[], boolean, uuid, uuid, uuid, text
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
  p_action text default null
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
  if p_color_story_id is not null then
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
