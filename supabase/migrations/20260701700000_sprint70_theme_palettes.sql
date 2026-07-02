-- Sprint 70: Theme Collections + Palette System
--
-- Themes are now two-level:
--   theme         = collection key ("classic", "modern", etc.) — controls layout/typography/photo treatment
--   theme_palette = palette name within that collection ("Ivory", "Blush", "Sage", etc.) — controls colors only
--
-- Existing records keep theme; theme_palette = null → first palette of collection (backward-compatible).

-- ── 1. Add theme_palette column ───────────────────────────────────────────────

alter table public.couple_websites
  add column if not exists theme_palette text;

-- ── 2. Update get_my_website to return theme_palette ─────────────────────────

create or replace function public.get_my_website(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site    public.couple_websites%rowtype;
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

  return jsonb_build_object(
    'exists',          true,
    'id',              v_site.id,
    'slug',            v_site.slug,
    'isPublished',     v_site.is_published,
    'hasPassword',     v_site.password is not null,
    'theme',           v_site.theme,
    'themePalette',    v_site.theme_palette,
    'accentColor',     v_site.accent_color,
    'fontPairing',     v_site.font_pairing,
    'sectionOrder',    v_site.section_order,
    'sectionsEnabled', v_site.sections_enabled,
    'scheduleSync',    v_site.schedule_sync,
    'content',         v_site.content
  );
end;
$$;

-- ── 3. Update get_wedding_website to return theme_palette ─────────────────────

create or replace function public.get_wedding_website(p_slug text, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site   public.couple_websites%rowtype;
  v_event  record;
  v_client public.clients%rowtype;
  v_guests record;
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

  select * into v_client from public.clients where id = v_site.client_id;
  select e.id, e.name, e.event_date, e.event_type
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

  return jsonb_build_object(
    'siteId',          v_site.id,
    'slug',            v_site.slug,
    'theme',           v_site.theme,
    'themePalette',    v_site.theme_palette,
    'accentColor',     v_site.accent_color,
    'fontPairing',     v_site.font_pairing,
    'sectionOrder',    v_site.section_order,
    'sectionsEnabled', v_site.sections_enabled,
    'content',         v_site.content,
    'couple', jsonb_build_object(
      'firstName',        v_client.first_name,
      'lastName',         v_client.last_name,
      'partnerFirstName', v_client.partner_first_name,
      'partnerLastName',  v_client.partner_last_name
    ),
    'event', case when v_event.id is not null then jsonb_build_object(
      'id',        v_event.id,
      'name',      v_event.name,
      'eventDate', v_event.event_date,
      'eventType', v_event.event_type
    ) else null end,
    'rsvpStats', jsonb_build_object(
      'total',     v_guests.total,
      'attending', v_guests.attending,
      'pending',   v_guests.pending
    )
  );
end;
$$;

-- ── 4. Update update_my_website to accept p_theme_palette ─────────────────────

create or replace function public.update_my_website(
  p_token            text,
  p_slug             text      default null,
  p_is_published     boolean   default null,
  p_password         text      default null,
  p_clear_password   boolean   default false,
  p_theme            text      default null,
  p_theme_palette    text      default null,
  p_accent_color     text      default null,
  p_font_pairing     text      default null,
  p_section_order    text[]    default null,
  p_content_key      text      default null,
  p_content_value    jsonb     default null,
  p_sections_enabled text[]    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site_id uuid;
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
  if p_is_published is not null then
    update public.couple_websites set is_published = p_is_published, updated_at = now() where id = v_site_id;
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

  return jsonb_build_object('ok', true, 'siteId', v_site_id);
end;
$$;

grant execute on function public.update_my_website(text,text,boolean,text,boolean,text,text,text,text,text[],text,jsonb,text[]) to anon, authenticated;

notify pgrst, 'reload schema';
