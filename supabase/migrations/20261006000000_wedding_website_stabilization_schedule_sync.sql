-- ============================================================================
-- Wedding Website Stabilization — Defect 3: schedule_sync toggle doesn't
-- persist
--
-- docs/wedding-website-stabilization-plan.md. Every couple_websites field
-- except schedule_sync is written exclusively through the security
-- definer update_my_website RPC — the one consistently correct write
-- pattern in this domain (it's why no self-referencing-RLS hazard exists
-- here, unlike some other tables in this codebase). schedule_sync is the
-- one exception: app/api/portal/website/route.ts does a direct
-- .update({schedule_sync}) call. The couple's session is a custom portal
-- token, not Supabase Auth, so this request runs as anon — and anon has no
-- UPDATE grant on couple_websites at all. Confirmed live: this fails with
-- an explicit "permission denied" error, silently, since the route never
-- checks the result.
--
-- Fix: bring schedule_sync into the existing pattern instead of opening a
-- new direct-write path (which would be a step backward for this domain's
-- one consistently-enforced invariant). Adds p_schedule_sync as a normal
-- parameter, handled exactly like every other field.
--
-- Also drops the two now-superseded overloads of update_my_website that
-- have coexisted with the current 13-parameter version since CREATE OR
-- REPLACE only replaces exact signature matches (confirmed live: calling
-- with a partial parameter set produced a 3-way "ambiguous function"
-- PGRST203 error against exactly these three signatures).
-- ============================================================================

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
  p_sections_enabled text[]    default null,
  p_schedule_sync    boolean   default null
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

  return jsonb_build_object('ok', true, 'siteId', v_site_id);
end;
$$;

grant execute on function public.update_my_website(text,text,boolean,text,boolean,text,text,text,text,text[],text,jsonb,text[],boolean) to anon, authenticated;

drop function if exists public.update_my_website(text, text, boolean, text, boolean, text, text, text, jsonb, text[]);
drop function if exists public.update_my_website(text, text, boolean, text, boolean, text, text, text, text[], text, jsonb, text[]);

notify pgrst, 'reload schema';
