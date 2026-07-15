-- ============================================================================
-- Make Client creation and Vendor creation atomic — same fix as
-- 20260928000000_atomic_lead_creation.sql, same root cause.
-- ============================================================================
-- Confirmed by direct code audit (not reported bugs — found while auditing
-- for the same shape after the Lead fix): `insertClient`
-- (lib/clients/repository.ts) and `insertVendor` (lib/vendors/repository.ts)
-- both resolve/create an identity row first (a Relationship for Clients, a
-- global `vendors` profile for Vendors), then perform a SEPARATE insert for
-- the actual record. If the second insert fails for any reason, the first
-- has already committed — an orphaned Relationship with no visible Client,
-- or an orphaned global vendor profile with no venue relationship pointing
-- at it. Same failure shape as the confirmed "Ron Cormier" lead bug, just
-- not yet hit in practice for these two.
-- ============================================================================

-- ---- Client ------------------------------------------------------------------

create or replace function public.create_client_atomic(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id  uuid := public.current_user_venue_id();
  v_lead_id   uuid := nullif(payload ->> 'leadId', '')::uuid;
  v_email     text := nullif(trim(payload ->> 'email'), '');
  v_first     text := trim(payload ->> 'firstName');
  v_last      text := trim(payload ->> 'lastName');
  v_rel_id    uuid;
  v_client_id uuid;
begin
  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'first and last name are required';
  end if;

  -- Converted-from-a-Lead clients inherit the Lead's already-resolved
  -- Relationship (no second identity created for the same person) —
  -- matches lib/clients/repository.ts's existing behavior exactly.
  if v_lead_id is not null then
    select relationship_id into v_rel_id
    from public.leads
    where id = v_lead_id and venue_id = v_venue_id;
  end if;

  if v_rel_id is null and v_email is not null then
    select id into v_rel_id
    from public.venue_customer_relationships
    where venue_id = v_venue_id and lower(email) = lower(v_email)
    limit 1;
  elsif v_rel_id is null then
    select id into v_rel_id
    from public.venue_customer_relationships
    where venue_id = v_venue_id and email is null
      and lower(first_name) = lower(v_first)
      and lower(last_name)  = lower(v_last)
    limit 1;
  end if;

  if v_rel_id is null then
    insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
    values (v_venue_id, v_email, v_first, v_last)
    returning id into v_rel_id;
  end if;

  insert into public.clients (
    venue_id, lead_id, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, end_date, guest_count,
    ceremony_time, reception_time, rehearsal_date, internal_notes,
    relationship_id
  ) values (
    v_venue_id, v_lead_id,
    v_first, v_last,
    v_email,
    nullif(trim(payload ->> 'phone'), ''),
    nullif(trim(payload ->> 'partnerFirstName'), ''),
    nullif(trim(payload ->> 'partnerLastName'), ''),
    nullif(trim(payload ->> 'partnerEmail'), ''),
    nullif(payload ->> 'eventType', ''),
    nullif(payload ->> 'eventDate', '')::date,
    nullif(payload ->> 'endDate', '')::date,
    nullif(regexp_replace(coalesce(payload ->> 'guestCount', ''), '[^0-9]', '', 'g'), '')::integer,
    nullif(payload ->> 'ceremonyTime', '')::time,
    nullif(payload ->> 'receptionTime', '')::time,
    nullif(payload ->> 'rehearsalDate', '')::date,
    nullif(trim(payload ->> 'internalNotes'), ''),
    v_rel_id
  )
  returning id into v_client_id;

  return v_client_id;
end;
$$;

grant execute on function public.create_client_atomic(jsonb) to authenticated;

-- ---- Vendor --------------------------------------------------------------------

create or replace function public.create_vendor_atomic(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id  uuid := public.current_user_venue_id();
  v_name      text := trim(payload ->> 'businessName');
  v_vendor_id uuid := gen_random_uuid();
begin
  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if v_name = '' then
    raise exception 'business name is required';
  end if;

  -- id generated above and inserted explicitly, no RETURNING — vendors'
  -- own SELECT policy (venues_select_related_vendors) only grants
  -- visibility through an EXISTING, non-inactive venue_vendor_relationships
  -- row. At the moment this insert would run, no such row exists yet (it's
  -- the next statement below) — the exact self-referencing-RETURNING
  -- hazard from 20260927000000_fix_venue_setup_rls_self_reference.sql,
  -- with an extra join hop. Confirmed by reading the policy, not assumed.
  --
  -- The global vendor profile: the venue is the de facto steward of
  -- identity fields until the vendor claims it (see
  -- venues_update_unclaimed_vendors) — matches insertVendor's existing
  -- comment and behavior exactly.
  insert into public.vendors (
    id, business_name, category, contact_name, email, phone, website_url,
    instagram_url, facebook_url, pinterest_url, tiktok_url,
    logo_url, description, pricing_tier
  ) values (
    v_vendor_id, v_name,
    nullif(payload ->> 'category', ''),
    nullif(trim(payload ->> 'contactName'), ''),
    nullif(trim(payload ->> 'email'), ''),
    nullif(trim(payload ->> 'phone'), ''),
    nullif(trim(payload ->> 'websiteUrl'), ''),
    nullif(trim(payload ->> 'instagramUrl'), ''),
    nullif(trim(payload ->> 'facebookUrl'), ''),
    nullif(trim(payload ->> 'pinterestUrl'), ''),
    nullif(trim(payload ->> 'tiktokUrl'), ''),
    nullif(trim(payload ->> 'logoUrl'), ''),
    nullif(trim(payload ->> 'description'), ''),
    nullif(payload ->> 'pricingTier', '')
  );

  insert into public.venue_vendor_relationships (
    venue_id, vendor_id, preference_level, notes, special_pricing_note
  ) values (
    v_venue_id, v_vendor_id,
    coalesce(nullif(payload ->> 'preferenceLevel', ''), 'recommended'),
    nullif(trim(payload ->> 'notes'), ''),
    nullif(trim(payload ->> 'specialPricingNote'), '')
  );

  return v_vendor_id;
end;
$$;

grant execute on function public.create_vendor_atomic(jsonb) to authenticated;

notify pgrst, 'reload schema';
