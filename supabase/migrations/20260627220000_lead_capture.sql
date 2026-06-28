-- ============================================================================
-- Sprint 31 — Lead Capture Foundation
--
-- Every opportunity begins in Wevenu.
--
-- Three additions:
--   venues.embed_key      — unique public key for the venue's inquiry form
--   leads.source_data     — source attribution (UTM, referrer, landing page)
--   Two SECURITY DEFINER functions exposing a read-only public surface:
--     get_venue_by_embed_key()  — venue branding for form rendering
--     create_public_lead()      — creates a lead from a public inquiry
-- ============================================================================

-- 1. embed_key on venues ---------------------------------------------------
-- URL-safe unique key used in the public form URL: /form/{embed_key}
-- Generated as a 32-char hex string (UUID without hyphens).
-- Not a secret — it identifies the form, not the user.
alter table public.venues
  add column embed_key text unique
    default lower(replace(gen_random_uuid()::text, '-', ''));

-- Backfill existing venues
update public.venues
  set embed_key = lower(replace(gen_random_uuid()::text, '-', ''))
  where embed_key is null;

alter table public.venues
  alter column embed_key set not null;

create unique index venues_embed_key on public.venues (embed_key);

-- 2. source_data on leads ---------------------------------------------------
-- JSONB blob capturing all attribution data at the time of inquiry.
-- Expected structure:
-- {
--   "source": "website_form",         -- canonical source type
--   "form_key": "abc123...",           -- venue embed_key used
--   "utm_source": "google",
--   "utm_medium": "cpc",
--   "utm_campaign": "summer2026",
--   "utm_content": "hero_banner",
--   "utm_term": "wedding venue",
--   "referrer": "https://google.com",
--   "landing_page": "https://venue.com/weddings",
--   "ip_address": "1.2.3.4",          -- for rate limiting / fraud (hashed in future)
--   "user_agent": "Mozilla/...",
--   "submitted_at": "2026-06-27T..."
-- }
-- JSONB allows future keys (The Knot ID, WeddingWire ID, QR code ID, etc.)
-- without schema changes.
alter table public.leads
  add column source_data jsonb;

-- 3. get_venue_by_embed_key — public venue branding lookup ------------------
-- SECURITY DEFINER: exposes only display fields to anonymous users.
-- Used by the public /form/{key} page to render venue branding.
create or replace function public.get_venue_by_embed_key(p_key text)
returns table (
  id           uuid,
  name         text,
  logo_url     text,
  primary_color text,
  secondary_color text,
  email        text,
  phone        text,
  website      text,
  city         text,
  state_region text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    id, name, logo_url, primary_color, secondary_color,
    email, phone, website, city, state_region
  from public.venues
  where embed_key = p_key;
$$;

grant execute on function public.get_venue_by_embed_key(text) to anon, authenticated;

-- 4. create_public_lead — SECURITY DEFINER inquiry creation ----------------
-- Allows anonymous users to create a lead record from a public inquiry form.
-- Validates the embed_key, creates the lead, and logs the activity.
-- Returns { lead_id, reference_code } so the form can show a confirmation number.
create or replace function public.create_public_lead(
  p_embed_key        text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_partner_first    text,
  p_partner_last     text,
  p_partner_email    text,
  p_event_type       text,
  p_event_date       date,
  p_guest_count      integer,
  p_estimated_budget numeric,
  p_message          text,
  p_source_data      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id   uuid;
  v_lead_id    uuid;
  v_ref        text;
begin
  -- Validate embed_key → venue_id
  select id into v_venue_id
  from public.venues
  where embed_key = p_embed_key;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid form key.');
  end if;

  -- Create the lead
  insert into public.leads (
    venue_id, status, source, first_name, last_name,
    email, phone, partner_first_name, partner_last_name, partner_email,
    event_type, event_date, guest_count, estimated_budget,
    inquiry_message, inquiry_date, source_data
  ) values (
    v_venue_id, 'new', 'website_form', p_first_name, p_last_name,
    p_email, p_phone, nullif(p_partner_first, ''), nullif(p_partner_last, ''), nullif(p_partner_email, ''),
    nullif(p_event_type, ''), p_event_date, p_guest_count,
    case when p_estimated_budget > 0 then p_estimated_budget else null end,
    nullif(p_message, ''), now(),
    p_source_data || jsonb_build_object('submitted_at', now())
  )
  returning id into v_lead_id;

  -- Reference code: first 8 chars of the lead ID (uppercase) for confirmation display
  v_ref := upper(left(replace(v_lead_id::text, '-', ''), 8));

  -- Activity log entry
  insert into public.lead_activities (
    venue_id, lead_id, type, title, description
  ) values (
    v_venue_id, v_lead_id,
    'inquiry_received',
    'Inquiry received via website form',
    'Submitted by ' || p_first_name || ' ' || p_last_name ||
    case when p_email != '' then ' (' || p_email || ')' else '' end
  );

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead_id,
    'reference_code', v_ref
  );
end;
$$;

grant execute on function public.create_public_lead(
  text, text, text, text, text, text, text, text,
  text, date, integer, numeric, text, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';
