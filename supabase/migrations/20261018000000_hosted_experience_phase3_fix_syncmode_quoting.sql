-- ============================================================================
-- Hosted Experience Platform — Phase 3 correction to 20261017000000
--
-- get_wedding_website's snapshot-reading branch referenced the
-- jsonb_to_recordset column aliases "syncMode"/"sortOrder" unquoted
-- (s.syncMode, s.sortOrder), which Postgres folds to lowercase
-- (s.syncmode, s.sortorder) — not matching the quoted camelCase aliases
-- declared in the column list, since those must match the JSON key's
-- actual case exactly. Caught live: publishing and then loading the
-- public page failed with "column s.syncmode does not exist" — a
-- function-body error only surfacing at call time, not at CREATE FUNCTION
-- time, the same general class of issue the Stabilization pass's
-- headline bug was. Same signature, safe CREATE OR REPLACE, no overload
-- risk.
-- ============================================================================

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
