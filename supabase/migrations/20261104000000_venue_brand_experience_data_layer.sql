-- ============================================================================
-- Venue Brand Experience — Phase 1, Work Stream A: Data Layer
--
-- Adds the venue's already-existing brand fields (primary_color/
-- secondary_color/accent_color/neutral_color/logo_url — all present on
-- `venues` since venue_foundation/sprint76_brand_colors) to the two RPCs
-- that customer-facing surfaces (couple portal, contract-signing page)
-- actually read from. No new columns, no new tables — this is the "wire
-- it through" work the whole initiative is about.
--
-- Both corrective bodies below are a minimal diff against each function's
-- actual, currently-applied definition (re-read from its own migration
-- before writing this, not from memory) — nothing else about either
-- function changes.
-- ============================================================================

-- ── get_portal_context: couple portal ───────────────────────────────────────
-- Corrective add-on to 20260905000000_seating_release_completion.sql —
-- identical body, the venue jsonb object gains 5 new keys.
create or replace function public.get_portal_context(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
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
      'logoUrl', v_venue.logo_url
    )
  );
end;
$$;

-- ── get_contract_by_token: contract-signing page ────────────────────────────
-- Corrective add-on to 20260717000000_tr_l5_l6_contract_send_guard_and_token_rls.sql
-- — identical body, joins venues (it previously joined only clients/events)
-- and adds a 'venue' key to the return object. The venue's own name never
-- reached this page before this change either.
create or replace function public.get_contract_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select
    c.id, c.venue_id, c.client_id, c.event_id, c.template_id, c.title, c.content, c.status,
    c.sign_token, c.signer_name, c.signed_at, c.sent_at, c.expires_at, c.created_at, c.updated_at,
    cl.first_name as client_first_name, cl.last_name as client_last_name,
    cl.partner_first_name as client_partner_first_name, cl.partner_last_name as client_partner_last_name,
    e.event_date,
    ven.name as venue_name, ven.primary_color as venue_primary_color, ven.secondary_color as venue_secondary_color,
    ven.accent_color as venue_accent_color, ven.neutral_color as venue_neutral_color, ven.logo_url as venue_logo_url
  into v
  from public.contracts c
  left join public.clients cl on cl.id = c.client_id
  left join public.events e on e.id = c.event_id
  left join public.venues ven on ven.id = c.venue_id
  where c.sign_token = p_token;

  if v.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v.id, 'venue_id', v.venue_id, 'client_id', v.client_id, 'event_id', v.event_id,
    'template_id', v.template_id, 'title', v.title, 'content', v.content, 'status', v.status,
    'sign_token', v.sign_token, 'signer_name', v.signer_name, 'signed_at', v.signed_at,
    'sent_at', v.sent_at, 'expires_at', v.expires_at, 'created_at', v.created_at, 'updated_at', v.updated_at,
    'clients', case when v.client_first_name is not null then jsonb_build_object(
      'first_name', v.client_first_name, 'last_name', v.client_last_name,
      'partner_first_name', v.client_partner_first_name, 'partner_last_name', v.client_partner_last_name
    ) else null end,
    'events', case when v.event_date is not null then jsonb_build_object('event_date', v.event_date) else null end,
    'venue', jsonb_build_object(
      'name', v.venue_name, 'primaryColor', v.venue_primary_color, 'secondaryColor', v.venue_secondary_color,
      'accentColor', v.venue_accent_color, 'neutralColor', v.venue_neutral_color, 'logoUrl', v.venue_logo_url
    )
  );
end;
$$;
