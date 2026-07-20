-- ============================================================================
-- Hosted Experience Platform — Phase 3: guests read the frozen version,
-- not the live draft
--
-- get_wedding_website's guest-resolution now checks status in
-- ('published','archived') instead of is_published = true (equivalent for
-- 'published' alone, but archived sites' URLs now correctly keep
-- resolving too, per the spec). Once resolved, design/content comes from
-- the frozen experience_versions.snapshot at current_version_id — NOT from
-- live couple_websites/experience_sections state — except for the pieces
-- that were never meant to freeze: live_synced sections (Schedule, when
-- the snapshot's own scheduleSync flag was true at publish time; RSVP)
-- read live exactly as before this phase, and the top-level event/couple/
-- rsvpStats/totalViews block was already always-live and stays that way.
--
-- New: p_preview_token, a 5th parameter. When it matches
-- couple_websites.preview_token, resolution bypasses the status/password
-- gate entirely and returns the LIVE draft (current couple_websites/
-- experience_sections state, not a snapshot) — the vision doc's "share a
-- work in progress with a coordinator or family member without
-- publishing" use case, satisfied without a separate route.
--
-- Defensive fallback: if a row is somehow 'published' with no
-- current_version_id (shouldn't happen — update_my_website always sets
-- both atomically — but a guest-facing page should never hard-fail on a
-- data inconsistency), falls back to live draft state rather than
-- returning an error.
--
-- get_my_website also now returns `status` and `hasPendingChanges` (true
-- when the draft has been touched since the currently-live version was
-- published), so the Studio can distinguish "nothing to publish" from
-- "guests are seeing an older version than what's in the editor."
-- ============================================================================

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
    'sectionOrder',       v_site.section_order,
    'sectionsEnabled',    v_site.sections_enabled,
    'scheduleSync',       v_site.schedule_sync,
    'content',            v_site.content,
    'sections',           v_sections
  );
end;
$$;

grant execute on function public.get_my_website(text) to anon, authenticated;

create or replace function public.get_wedding_website(
  p_slug text,
  p_password text default null,
  p_session_id text default null,
  p_page text default 'home',
  p_preview_token text default null
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
    select coalesce(c.key, v_site.theme), coalesce(cs.name, v_site.theme_palette), coalesce(ts.key, v_site.font_pairing)
    into v_theme, v_theme_palette, v_font_pairing
    from (select 1) dummy
    left join public.collections c on c.id = v_site.collection_id
    left join public.color_stories cs on cs.id = v_site.color_story_id
    left join public.typography_styles ts on ts.id = v_site.typography_style_id;
    v_accent_color := v_site.accent_color;
    v_schedule_sync := v_site.schedule_sync;

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

    select coalesce(jsonb_agg(jsonb_build_object(
      'key', s.key, 'title', s.title, 'owner', s.owner, 'syncMode', s."syncMode", 'sortOrder', s."sortOrder"
    ) order by s."sortOrder"), '[]'::jsonb),
    coalesce(jsonb_object_agg(s.key, s.content) filter (where s.content is not null), '{}'::jsonb)
    into v_sections_meta, v_content
    from jsonb_to_recordset(v_version.snapshot -> 'sections')
      as s(key text, title text, owner text, "syncMode" text, "sortOrder" int, content jsonb, visibility text)
    where s.visibility is distinct from 'hidden';
  end if;

  -- Log view (non-critical)
  begin
    insert into public.couple_website_views (venue_id, client_id, website_id, page, session_id)
    values (v_site.venue_id, v_site.client_id, v_site.id, p_page, p_session_id);
  exception when others then null;
  end;

  select count(distinct coalesce(session_id, id::text)) into v_views
  from public.couple_website_views where website_id = v_site.id;

  select * into v_client from public.clients where id = v_site.client_id;
  select e.id, e.name, e.event_date, e.event_type, e.guest_count, e.setup_time
  into v_event
  from public.events e
  where e.client_id = v_site.client_id and e.venue_id = v_site.venue_id
    and e.status not in ('cancelled')
  order by e.event_date asc limit 1;

  select count(*) as total,
         count(*) filter (where rsvp_status = 'attending') as attending,
         count(*) filter (where rsvp_status = 'pending') as pending
  into v_guests
  from public.couple_guests
  where client_id = v_site.client_id and venue_id = v_site.venue_id;

  -- Schedule stays live whenever the (frozen-at-publish, or live-draft)
  -- scheduleSync flag says so — never frozen text, even inside a
  -- published snapshot.
  if v_schedule_sync and v_event.id is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object('time', te.entry_time::text, 'title', te.title, 'description', te.description)
      order by (te.section_id is null)::int, coalesce(ts.sort_order, 0), te.sort_order, te.created_at
    ), '[]'::jsonb)
    into v_schedule
    from public.timeline_entries te
    left join public.timeline_sections ts on ts.id = te.section_id
    where te.event_id = v_event.id and 'guest' = any(te.audiences) and te.entry_time is not null;
  else
    v_schedule := coalesce(v_content->'schedule', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'siteId',         v_site.id,
    'slug',           v_site.slug,
    'status',         v_site.status,
    'isPreview',      v_is_preview,
    'theme',          v_theme,
    'themePalette',   v_theme_palette,
    'fontPairing',    v_font_pairing,
    'sectionOrder',   v_site.section_order,
    'sections',       v_sections_meta,
    'accentColor',    v_accent_color,
    'sectionsEnabled', v_site.sections_enabled,
    'scheduleSync',   v_schedule_sync,
    'content',        jsonb_set(coalesce(v_content, '{}'::jsonb), '{schedule}', v_schedule),
    'totalViews',     v_views,
    'couple', jsonb_build_object(
      'firstName',        v_client.first_name,
      'lastName',         v_client.last_name,
      'partnerFirstName', v_client.partner_first_name,
      'partnerLastName',  v_client.partner_last_name
    ),
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'name', v_event.name, 'eventDate', v_event.event_date,
      'eventType', v_event.event_type, 'guestCount', v_event.guest_count,
      'setupTime', v_event.setup_time
    ) else null end,
    'rsvpStats', jsonb_build_object(
      'total', v_guests.total, 'attending', v_guests.attending, 'pending', v_guests.pending
    )
  );
end;
$$;

grant execute on function public.get_wedding_website(text, text, text, text, text) to anon, authenticated;

drop function if exists public.get_wedding_website(text, text, text, text);

notify pgrst, 'reload schema';
