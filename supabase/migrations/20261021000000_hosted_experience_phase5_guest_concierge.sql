-- ============================================================================
-- Hosted Experience Platform — Phase 5: Guest-Facing Concierge
--
-- docs/hosted-experience-platform-architecture-spec.md §9 — "Guest-facing
-- concierge answers (FAQ, directions, parking, 'what should I wear') —
-- grounded strictly in the experience's own published content plus the
-- venue's operational info already in the platform; never invents an
-- answer it can't source."
--
-- get_guest_concierge_context(p_rsvp_token) is a guest-token-authenticated
-- twin of get_venue_info_for_portal (couple-token-authenticated venue ops
-- info) plus the couple's own published dress_code/faq/travel/things_to_do
-- section content — the two sources the spec names. Content resolution
-- mirrors get_wedding_website's published/live branch exactly (prefer the
-- frozen experience_versions snapshot when published, so a guest's
-- concierge answer never gets ahead of what the guest can actually see on
-- the site; fall back to live section content when there's no published
-- version yet, since a guest's personal rsvp_token link works regardless
-- of site publish status). Deliberately returns no guest-specific or
-- couple-private data — venue ops info and the couple's own public-facing
-- content only, per §6's rule that personalization never surfaces
-- behavioral or sensitive data back at a guest who didn't provide it.
-- ============================================================================

create or replace function public.get_guest_concierge_context(p_rsvp_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest   public.couple_guests%rowtype;
  v_client  public.clients%rowtype;
  v_venue   public.venues%rowtype;
  v_event   record;
  v_site    public.couple_websites%rowtype;
  v_version public.experience_versions%rowtype;
  v_content jsonb;
  v_voi     public.venue_operational_info%rowtype;
begin
  select * into v_guest from public.couple_guests where rsvp_token = p_rsvp_token;
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select * into v_client from public.clients where id = v_guest.client_id;
  select * into v_venue  from public.venues  where id = v_guest.venue_id;

  select e.id, e.name, e.event_date, e.event_type
  into v_event
  from public.events e
  where e.client_id = v_guest.client_id and e.venue_id = v_guest.venue_id
  order by e.event_date asc limit 1;

  select * into v_site
  from public.couple_websites
  where client_id = v_guest.client_id and venue_id = v_guest.venue_id;

  if found and v_site.current_version_id is not null then
    select * into v_version from public.experience_versions where id = v_site.current_version_id;
  end if;

  if v_site.id is not null and v_version.id is not null then
    select coalesce(jsonb_object_agg(s.key, s.content) filter (where s.content is not null), '{}'::jsonb)
    into v_content
    from jsonb_to_recordset(v_version.snapshot -> 'sections')
      as s(key text, title text, owner text, "syncMode" text, "sortOrder" int, content jsonb, visibility text);
  elsif v_site.id is not null then
    select coalesce(jsonb_object_agg(es.section_key, es.content) filter (where es.content is not null), '{}'::jsonb)
    into v_content
    from public.experience_sections es
    where es.experience_id = v_site.id and es.visibility <> 'hidden';
  end if;

  select * into v_voi from public.venue_operational_info voi where voi.venue_id = v_guest.venue_id;

  return jsonb_build_object(
    'couple', jsonb_build_object(
      'firstName',        v_client.first_name,
      'partnerFirstName', v_client.partner_first_name
    ),
    'event', case when v_event.id is not null then jsonb_build_object(
      'name', v_event.name, 'eventDate', v_event.event_date, 'eventType', v_event.event_type
    ) else null end,
    'venue', jsonb_build_object('name', v_venue.name),
    'websiteContent', jsonb_build_object(
      'dressCode',  coalesce(v_content, '{}'::jsonb) -> 'dress_code',
      'faq',        coalesce(v_content, '{}'::jsonb) -> 'faq',
      'travel',     coalesce(v_content, '{}'::jsonb) -> 'travel',
      'thingsToDo', coalesce(v_content, '{}'::jsonb) -> 'things_to_do'
    ),
    'venueInfo', jsonb_build_object(
      'parkingInfo',          v_voi.parking_info,
      'transportation',       v_voi.transportation,
      'hotelBlocks',          v_voi.hotel_blocks,
      'nearbyAccommodations', v_voi.nearby_accommodations,
      'thingsToDo',           v_voi.things_to_do,
      'faqs',                 v_voi.faqs,
      'policies',             v_voi.policies,
      'ceremonyInstructions', v_voi.ceremony_instructions,
      'rainPlan',             v_voi.rain_plan,
      'importantContacts',    v_voi.important_contacts
    )
  );
end;
$$;

grant execute on function public.get_guest_concierge_context(text) to anon, authenticated;
