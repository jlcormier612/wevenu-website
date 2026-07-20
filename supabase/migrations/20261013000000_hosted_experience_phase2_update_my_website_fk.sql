-- ============================================================================
-- Hosted Experience Platform — Phase 2: update_my_website → catalog FKs +
-- Section Model
--
-- Adds p_collection_id/p_color_story_id/p_typography_style_id as the new,
-- Studio-facing write path (the legacy p_theme/p_theme_palette/
-- p_font_pairing params remain in the signature and remain fully
-- functional — not removed, since other callers may still use them and
-- removing a param is a breaking signature change; the Studio itself
-- simply stops sending them, per the "Studio cutover" scope).
--
-- Also: every save now ensures the experience has its full canonical set
-- of experience_sections rows (idempotent, ON CONFLICT DO NOTHING — safe
-- to run on every call, self-heals any experience that predates this
-- migration or is missing a row for any reason); content-key writes keep
-- the matching section's content in sync; section_order writes keep
-- sort_order in sync — so experience_sections stops being a one-time
-- backfill snapshot and becomes a live-maintained mirror.
--
-- IMPORTANT — overload discipline: this changes the parameter list from
-- the 14 params shipped in Phase 1's stabilization migration to 17.
-- CREATE OR REPLACE does not replace a function whose signature differs —
-- it creates a new overload, exactly the bug Wedding Website Stabilization
-- found and fixed once already, and exactly the mistake self-caught during
-- that same pass. The old 14-param signature is EXPLICITLY DROPPED below,
-- in this same migration, not left to chance.
-- ============================================================================

create or replace function public.update_my_website(
  p_token                text,
  p_slug                 text      default null,
  p_is_published         boolean   default null,
  p_password             text      default null,
  p_clear_password       boolean   default false,
  p_theme                text      default null,
  p_theme_palette        text      default null,
  p_accent_color         text      default null,
  p_font_pairing         text      default null,
  p_section_order        text[]    default null,
  p_content_key          text      default null,
  p_content_value        jsonb     default null,
  p_sections_enabled     text[]    default null,
  p_schedule_sync        boolean   default null,
  p_collection_id        uuid      default null,
  p_color_story_id       uuid      default null,
  p_typography_style_id  uuid      default null
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
  if p_schedule_sync is not null then
    update public.couple_websites set schedule_sync = p_schedule_sync, updated_at = now() where id = v_site_id;
  end if;

  -- Catalog FK write path (Phase 2). Only the FK columns are written here —
  -- get_my_website/get_wedding_website derive the legacy theme/themePalette/
  -- fontPairing output fields from the catalog when these are set, falling
  -- back to the raw string columns otherwise. See that migration for the
  -- read-side logic.
  if p_collection_id is not null then
    update public.couple_websites set collection_id = p_collection_id, updated_at = now() where id = v_site_id;
  end if;
  if p_color_story_id is not null then
    update public.couple_websites set color_story_id = p_color_story_id, updated_at = now() where id = v_site_id;
  end if;
  if p_typography_style_id is not null then
    update public.couple_websites set typography_style_id = p_typography_style_id, updated_at = now() where id = v_site_id;
  end if;

  -- Ensure the canonical section set exists (idempotent; self-heals any
  -- experience predating Phase 2 or missing a row for any reason).
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

  -- Keep experience_sections in sync with the two things that already
  -- write per-section state today, so it stops being a one-time snapshot.
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

  return jsonb_build_object('ok', true, 'siteId', v_site_id);
end;
$$;

grant execute on function public.update_my_website(text,text,boolean,text,boolean,text,text,text,text,text[],text,jsonb,text[],boolean,uuid,uuid,uuid) to anon, authenticated;

drop function if exists public.update_my_website(text,text,boolean,text,boolean,text,text,text,text,text[],text,jsonb,text[],boolean);

notify pgrst, 'reload schema';
