-- ============================================================================
-- Hosted Experience Platform — Phase 2: read-side catalog derivation +
-- sections array
--
-- Same signatures as today for both functions (get_my_website(text),
-- get_wedding_website(text,text,text,text)) — safe CREATE OR REPLACE, no
-- overload risk, since the parameter lists are unchanged.
--
-- Catalog derivation: when collection_id/color_story_id/typography_style_id
-- are set on a row, the output theme/themePalette/fontPairing fields are
-- now derived from the joined catalog (collections.key, color_stories.name,
-- typography_styles.key) instead of the raw legacy string columns — making
-- the FK genuinely authoritative for any row that uses it. Falls back to
-- the legacy string columns when a given FK is null, so rows that haven't
-- been migrated onto the catalog yet (or that predate Phase 1) keep
-- rendering exactly as before. The renderer's resolveTheme() is untouched —
-- its input contract (theme/themePalette/fontPairing strings) is unchanged;
-- only where those strings come from has changed.
--
-- sections: both functions now also return an ordered, visibility-filtered
-- sections array sourced from experience_sections, so the renderer can
-- move off the sectionOrder/DEFAULT_ORDER fallback pattern for ordering
-- and visibility, per docs/hosted-experience-platform-architecture-spec.md
-- §3/§12 Phase 2. get_wedding_website excludes sections with
-- visibility = 'hidden' and does not return other guests' or the couple's
-- internal content for password_required sections unless the gate has
-- already been passed (mirrors the existing password-gate check already
-- in this function).
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

  return jsonb_build_object(
    'exists',             true,
    'id',                 v_site.id,
    'slug',               v_site.slug,
    'isPublished',        v_site.is_published,
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
  p_page text default 'home'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site    public.couple_websites%rowtype;
  v_event   record;
  v_client  public.clients%rowtype;
  v_guests  record;
  v_views   bigint;
  v_schedule jsonb;
  v_theme        text;
  v_theme_palette text;
  v_font_pairing text;
  v_sections     jsonb;
begin
  select * into v_site
  from public.couple_websites
  where slug = p_slug and is_published = true;

  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if v_site.password is not null then
    if p_password is null or v_site.password != p_password then
      return jsonb_build_object('requires_password', true);
    end if;
  end if;

  -- Log view (non-critical)
  begin
    insert into public.couple_website_views (venue_id, client_id, website_id, page, session_id)
    values (v_site.venue_id, v_site.client_id, v_site.id, p_page, p_session_id);
  exception when others then null;
  end;

  -- Approximate unique visitors
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

  if v_site.schedule_sync and v_event.id is not null then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'time',        te.entry_time::text,
        'title',       te.title,
        'description', te.description
      )
      order by (te.section_id is null)::int, coalesce(ts.sort_order, 0), te.sort_order, te.created_at
    ), '[]'::jsonb)
    into v_schedule
    from public.timeline_entries te
    left join public.timeline_sections ts on ts.id = te.section_id
    where te.event_id = v_event.id
      and 'guest' = any(te.audiences)
      and te.entry_time is not null;
  else
    v_schedule := coalesce(v_site.content->'schedule', '[]'::jsonb);
  end if;

  select coalesce(c.key, v_site.theme), coalesce(cs.name, v_site.theme_palette), coalesce(tys.key, v_site.font_pairing)
  into v_theme, v_theme_palette, v_font_pairing
  from (select 1) dummy
  left join public.collections c on c.id = v_site.collection_id
  left join public.color_stories cs on cs.id = v_site.color_story_id
  left join public.typography_styles tys on tys.id = v_site.typography_style_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', es.section_key, 'title', es.title, 'owner', es.owner,
    'syncMode', es.sync_mode, 'sortOrder', es.sort_order
  ) order by es.sort_order), '[]'::jsonb)
  into v_sections
  from public.experience_sections es
  where es.experience_id = v_site.id and es.visibility <> 'hidden';

  return jsonb_build_object(
    'siteId',         v_site.id,
    'slug',           v_site.slug,
    'theme',          v_theme,
    'themePalette',   v_theme_palette,
    'fontPairing',    v_font_pairing,
    'sectionOrder',   v_site.section_order,
    'sections',       v_sections,
    'accentColor',    v_site.accent_color,
    'sectionsEnabled', v_site.sections_enabled,
    'scheduleSync',   v_site.schedule_sync,
    'content',        jsonb_set(
                        coalesce(v_site.content, '{}'::jsonb),
                        '{schedule}',
                        v_schedule
                      ),
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

grant execute on function public.get_wedding_website(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
