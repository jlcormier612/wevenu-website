-- ============================================================================
-- White-Glove Migration — Phase 1: the one RPC-level fix blocking staff-
-- assisted Client/Vendor import, per docs/hospitality-success-platform-
-- implementation-plan.md §2.2's "real architectural finding": Packages and
-- Inventory import fine for white-glove today (plain, genuinely
-- parameterized inserts via createAdminClient() + an explicit venueId), but
-- create_client_atomic/create_vendor_atomic both resolve venue via
-- current_user_venue_id() INTERNALLY and ignore any venueId passed in from
-- the wrapping TS repository call — confirmed by reading the SQL, not
-- assumed.
--
-- Fix: add a guarded p_venue_id_override parameter to both RPCs, honored
-- ONLY when the calling Postgres role is genuinely service_role (auth.role()
-- = 'service_role') — an authenticated venue session can pass this
-- parameter too, but it's silently ignored for them, falling back to their
-- own current_user_venue_id() exactly as before. This is the only way an
-- override is safe: service_role already bypasses RLS entirely and is never
-- reachable from a browser session (createAdminClient() is server-only,
-- key never shipped to the client) — a plain authenticated user could never
-- reach this branch to hijack another venue's id.
-- ============================================================================

-- Drop the old single-argument signatures first — CREATE OR REPLACE with an
-- added parameter creates a second overload rather than replacing it, and
-- with only `payload` supplied a PostgREST RPC call would then be ambiguous
-- between the 1-arg and 2-arg (default-satisfied) versions.
drop function if exists public.create_client_atomic(jsonb);
drop function if exists public.create_vendor_atomic(jsonb);

create or replace function public.create_client_atomic(payload jsonb, p_venue_id_override uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id  uuid;
  v_lead_id   uuid := nullif(payload ->> 'leadId', '')::uuid;
  v_email     text := nullif(trim(payload ->> 'email'), '');
  v_first     text := trim(payload ->> 'firstName');
  v_last      text := trim(payload ->> 'lastName');
  v_rel_id    uuid;
  v_client_id uuid;
begin
  v_venue_id := case
    when p_venue_id_override is not null and auth.role() = 'service_role' then p_venue_id_override
    else public.current_user_venue_id()
  end;

  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'first and last name are required';
  end if;

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

grant execute on function public.create_client_atomic(jsonb, uuid) to authenticated;
grant execute on function public.create_client_atomic(jsonb, uuid) to service_role;

-- ---- Vendor --------------------------------------------------------------------

create or replace function public.create_vendor_atomic(payload jsonb, p_venue_id_override uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id  uuid;
  v_name      text := trim(payload ->> 'businessName');
  v_vendor_id uuid := gen_random_uuid();
begin
  v_venue_id := case
    when p_venue_id_override is not null and auth.role() = 'service_role' then p_venue_id_override
    else public.current_user_venue_id()
  end;

  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if v_name = '' then
    raise exception 'business name is required';
  end if;

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

grant execute on function public.create_vendor_atomic(jsonb, uuid) to authenticated;
grant execute on function public.create_vendor_atomic(jsonb, uuid) to service_role;

-- ── service_role table grants — found live, not assumed ─────────────────────
-- These RPCs are `security invoker`, so the underlying table grants matter
-- directly for whichever role actually calls them. clients/leads/vendors
-- already had service_role SELECT/INSERT/UPDATE (grant_migration
-- 20261139000000_migration_center_foundation.sql), but
-- venue_customer_relationships and venue_vendor_relationships did not —
-- confirmed live: a service_role call to create_client_atomic failed with
-- "permission denied for table venue_customer_relationships" before this,
-- exactly the "grant needs to be explicit, RLS alone doesn't imply it"
-- lesson this project has hit before.
grant select, insert, update on public.venue_customer_relationships to service_role;
grant select, insert, update on public.venue_vendor_relationships to service_role;

notify pgrst, 'reload schema';
