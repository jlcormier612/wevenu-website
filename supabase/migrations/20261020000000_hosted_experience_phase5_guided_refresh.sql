-- ============================================================================
-- Hosted Experience Platform — Phase 5: Guided-Section Refresh
--
-- docs/hosted-experience-platform-architecture-spec.md §3/§4 — guided
-- sections (owner='guided': "home", "story") need a visible "Sourced from
-- Planning · synced [date]" indicator and an explicit Refresh action that
-- re-pulls the current source value into a proposed diff the couple
-- accepts or dismisses — never silently overwritten. get_website_suggestions
-- (Sprint 685, redefined in the seating_release_completion migration)
-- already does the live re-pull correctly and needs no changes; what was
-- missing was any way to record that a refresh was reviewed and accepted.
--
-- mark_section_synced is deliberately the only new function: the Studio
-- calls the existing get_website_suggestions/update_my_website pair to
-- fetch a fresh proposal and persist an accepted one, then calls this to
-- stamp last_synced_at — kept as a separate, explicit step so "last
-- synced" reflects a reviewed-and-accepted refresh, not just any edit.
-- ============================================================================

create or replace function public.mark_section_synced(p_token text, p_section_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_site_id uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then raise exception 'invalid_token'; end if;

  select id into v_site_id
  from public.couple_websites
  where client_id = v_session.client_id and venue_id = v_session.venue_id;
  if v_site_id is null then raise exception 'website_not_found'; end if;

  update public.experience_sections
  set last_synced_at = now(), updated_at = now()
  where experience_id = v_site_id and section_key = p_section_key;
end;
$$;

grant execute on function public.mark_section_synced(text, text) to anon, authenticated;
