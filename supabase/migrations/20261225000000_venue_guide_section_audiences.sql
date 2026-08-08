-- Venue Guide audience visibility + optional dual copy.
-- One guide row per venue; sections can target clients | vendors | both,
-- with optional vendor overrides for parking/policies and per-FAQ audience.

alter table public.venue_operational_info
  add column if not exists section_audiences jsonb not null default '{
    "parking": "both",
    "accommodations": "clients",
    "weather": "both",
    "policies": "both",
    "ceremony": "both",
    "things": "clients",
    "faqs": "both",
    "contacts": "both"
  }'::jsonb,
  add column if not exists section_overrides jsonb not null default '{}'::jsonb;

comment on column public.venue_operational_info.section_audiences is
  'Per-section visibility: clients | vendors | both. Defaults preserve prior vendor-handbook subset.';
comment on column public.venue_operational_info.section_overrides is
  'Optional dual copy, e.g. {"parking":{"vendors":"..."},"policies":{"vendors":"..."}}.';

-- Existing rows already get column defaults; re-assert merged defaults so
-- any partial values remain filled for all section keys.
update public.venue_operational_info
set section_audiences = '{
  "parking": "both",
  "accommodations": "clients",
  "weather": "both",
  "policies": "both",
  "ceremony": "both",
  "things": "clients",
  "faqs": "both",
  "contacts": "both"
}'::jsonb || coalesce(section_audiences, '{}'::jsonb)
where true;

-- Couple portal: return audience metadata so the app can project safely.
-- Content is still returned in full; projection happens in TypeScript
-- (projectGuideForAudience) so Luv + UI share one helper.
create or replace function public.get_venue_info_for_portal(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.venue_id is null then return null; end if;

  return (
    select jsonb_build_object(
      'parkingInfo',          voi.parking_info,
      'transportation',       voi.transportation,
      'hotelBlocks',          voi.hotel_blocks,
      'nearbyAccommodations', voi.nearby_accommodations,
      'thingsToDo',           voi.things_to_do,
      'faqs',                 voi.faqs,
      'policies',             voi.policies,
      'ceremonyInstructions', voi.ceremony_instructions,
      'rainPlan',             voi.rain_plan,
      'importantContacts',    voi.important_contacts,
      'sectionAudiences',     voi.section_audiences,
      'sectionOverrides',     voi.section_overrides
    )
    from venue_operational_info voi
    where voi.venue_id = v_ids.venue_id
  );
end;
$$;

-- Vendor handbook (single event)
create or replace function public.get_vendor_handbook(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_venue_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (
    select 1 from public.event_vendor_assignments eva
    where eva.event_id = p_event_id and eva.vendor_id = v_vendor_id
  ) then
    return '{"error":"not_assigned"}'::jsonb;
  end if;

  select venue_id into v_venue_id from public.events where id = p_event_id;

  return jsonb_build_object(
    'venue', (
      select jsonb_build_object(
        'id', v.id, 'name', v.name, 'phone', v.phone, 'website', v.website,
        'addressLine1', v.address_line1, 'addressLine2', v.address_line2,
        'city', v.city, 'stateRegion', v.state_region, 'postalCode', v.postal_code,
        'logoUrl', v.logo_url
      )
      from public.venues v where v.id = v_venue_id
    ),
    'operationalInfo', (
      select jsonb_build_object(
        'parkingInfo', oi.parking_info,
        'transportation', oi.transportation,
        'nearbyAccommodations', oi.nearby_accommodations,
        'hotelBlocks', oi.hotel_blocks,
        'rainPlan', oi.rain_plan,
        'policies', oi.policies,
        'ceremonyInstructions', oi.ceremony_instructions,
        'thingsToDo', oi.things_to_do,
        'faqs', oi.faqs,
        'importantContacts', oi.important_contacts,
        'sectionAudiences', oi.section_audiences,
        'sectionOverrides', oi.section_overrides
      )
      from public.venue_operational_info oi where oi.venue_id = v_venue_id
    )
  );
end;
$$;

-- Vendor handbooks (all booked venues)
create or replace function public.get_vendor_handbooks()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'venues', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'venue', jsonb_build_object(
            'id', v.id, 'name', v.name, 'phone', v.phone, 'website', v.website,
            'addressLine1', v.address_line1, 'addressLine2', v.address_line2,
            'city', v.city, 'stateRegion', v.state_region, 'postalCode', v.postal_code,
            'logoUrl', v.logo_url
          ),
          'operationalInfo', (
            select jsonb_build_object(
              'parkingInfo', oi.parking_info,
              'transportation', oi.transportation,
              'nearbyAccommodations', oi.nearby_accommodations,
              'hotelBlocks', oi.hotel_blocks,
              'rainPlan', oi.rain_plan,
              'policies', oi.policies,
              'ceremonyInstructions', oi.ceremony_instructions,
              'thingsToDo', oi.things_to_do,
              'faqs', oi.faqs,
              'importantContacts', oi.important_contacts,
              'sectionAudiences', oi.section_audiences,
              'sectionOverrides', oi.section_overrides
            )
            from public.venue_operational_info oi where oi.venue_id = v.id
          )
        ) order by v.name)
        from (
          select distinct e.venue_id
          from public.event_vendor_assignments eva
          join public.events e on e.id = eva.event_id
          where eva.vendor_id = v_vendor_id
        ) booked
        join public.venues v on v.id = booked.venue_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- Guest concierge grounds on the same ops table; include audience metadata
-- so the app can project client-visible content (same as couple Luv).
-- Body preserved from 20261021000000; only venueInfo gains audience fields.
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
      'importantContacts',    v_voi.important_contacts,
      'sectionAudiences',     v_voi.section_audiences,
      'sectionOverrides',     v_voi.section_overrides
    )
  );
end;
$$;

grant execute on function public.get_guest_concierge_context(text) to anon, authenticated;

notify pgrst, 'reload schema';
