-- Venue Guide expansion, "About the Venue" / "Contact Information"
-- (2026-07-23) — read-only exposure of venue columns that already exist
-- (address, phone, email); no new data entry.

create or replace function public.get_portal_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   public.client_portal_sessions%rowtype;
  v_client    public.clients%rowtype;
  v_event     record;
  v_venue     public.venues%rowtype;
  v_contact   public.client_contacts%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  update public.client_portal_sessions set last_accessed_at = now() where id = v_session.id;
  select * into v_client from public.clients where id = v_session.client_id;
  select e.id, e.event_date, e.event_type, e.status, e.name as event_name, e.guest_count, e.setup_time
  into v_event
  from public.events e
  where e.id = coalesce(v_session.event_id, public._current_event_for_client(v_session.client_id, v_session.venue_id));
  select * into v_venue from public.venues where id = v_session.venue_id;
  -- Resolve contact if session is contact-specific
  if v_session.contact_id is not null then
    select * into v_contact from public.client_contacts where id = v_session.contact_id;
  end if;

  return jsonb_build_object(
    'sessionId',   v_session.id,
    'accessLevel', coalesce(v_contact.portal_role, v_session.access_level),
    'label',       coalesce(
      v_session.label,
      case when v_contact.id is not null
        then coalesce(v_contact.role_label, v_contact.first_name)
        else v_client.first_name || ' & ' || coalesce(v_client.partner_first_name, '')
      end
    ),
    'client', jsonb_build_object(
      'id', v_client.id, 'firstName', v_client.first_name, 'lastName', v_client.last_name,
      'partnerFirstName', v_client.partner_first_name, 'partnerLastName', v_client.partner_last_name,
      'eventType', v_client.event_type
    ),
    'contact', case when v_contact.id is not null then jsonb_build_object(
      'id', v_contact.id, 'firstName', v_contact.first_name, 'lastName', v_contact.last_name,
      'roleLabel', v_contact.role_label, 'portalRole', v_contact.portal_role
    ) else null end,
    'event', case when v_event.id is not null then jsonb_build_object(
      'id', v_event.id, 'eventDate', v_event.event_date, 'eventType', v_event.event_type,
      'name', v_event.event_name, 'guestCount', v_event.guest_count, 'setupTime', v_event.setup_time
    ) else null end,
    'venue', jsonb_build_object(
      'id', v_venue.id, 'name', v_venue.name, 'website', v_venue.website,
      'primaryColor', v_venue.primary_color, 'secondaryColor', v_venue.secondary_color,
      'accentColor', v_venue.accent_color, 'neutralColor', v_venue.neutral_color,
      'logoUrl', v_venue.logo_url,
      'heroImageUrl', v_venue.hero_image_url, 'story', v_venue.story,
      'phone', v_venue.phone, 'email', v_venue.email,
      'addressLine1', v_venue.address_line1, 'addressLine2', v_venue.address_line2,
      'city', v_venue.city, 'stateRegion', v_venue.state_region, 'postalCode', v_venue.postal_code
    )
  );
end;
$$;
