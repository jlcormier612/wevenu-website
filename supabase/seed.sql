-- ============================================================================
-- Development seed data.
--
-- Runs automatically after `supabase db reset --local` (and `db start` on a
-- fresh volume). Gives every developer a predictable, working environment
-- in under a minute instead of hand-building one through the UI: one venue,
-- an owner and a manager, a couple with a confirmed event, a signed
-- contract, guests, a preferred vendor, an invoice, and a day-of timeline.
--
-- Login (local dev only — never use these credentials anywhere real):
--   Owner:   owner@example.com   / devpassword123
--   Manager: manager@example.com / devpassword123
--
-- This is a fixed development fixture, not sample/demo content for a real
-- venue — keep it small and deterministic rather than growing it into a
-- showcase dataset.
-- ============================================================================

do $$
declare
  v_owner_id        uuid := gen_random_uuid();
  v_manager_id      uuid := gen_random_uuid();
  v_venue_id        uuid := gen_random_uuid();
  v_client_id       uuid := gen_random_uuid();
  v_event_id        uuid := gen_random_uuid();
  v_contract_id     uuid := gen_random_uuid();
  v_vendor_id       uuid := gen_random_uuid();
  v_invoice_id      uuid := gen_random_uuid();
  v_section_id      uuid := gen_random_uuid();
  v_event_date      date := current_date + interval '90 days';
begin
  -- ── Auth users (owner + manager) ─────────────────────────────────────────
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_owner_id, 'authenticated', 'authenticated',
     'owner@example.com', crypt('devpassword123', gen_salt('bf')),
     now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_manager_id, 'authenticated', 'authenticated',
     'manager@example.com', crypt('devpassword123', gen_salt('bf')),
     now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), v_owner_id,
     jsonb_build_object('sub', v_owner_id::text, 'email', 'owner@example.com'), 'email', v_owner_id::text, now(), now(), now()),
    (gen_random_uuid(), v_manager_id,
     jsonb_build_object('sub', v_manager_id::text, 'email', 'manager@example.com'), 'email', v_manager_id::text, now(), now(), now());

  -- ── Venue ─────────────────────────────────────────────────────────────────
  insert into public.venues (
    id, owner_user_id, name, business_name, email, phone, website,
    address_line1, city, state_region, postal_code, country,
    venue_type, capacity, timezone, setup_completed, setup_completed_at,
    tour_scheduling_enabled, embed_key, tour_embed_key, lead_email_key
  ) values (
    v_venue_id, v_owner_id, 'Seed Venue', 'Seed Venue LLC', 'hello@seedvenue.example', '555-0100', 'https://seedvenue.example',
    '123 Orchard Lane', 'Nashville', 'TN', '37201', 'United States',
    'barn', 180, 'America/New_York', true, now(),
    true, lower(replace(gen_random_uuid()::text, '-', '')), encode(gen_random_bytes(16), 'hex'),
    lower(replace(gen_random_uuid()::text, '-', ''))
  );

  -- ── Staff ─────────────────────────────────────────────────────────────────
  insert into public.venue_staff (venue_id, user_id, full_name, email, title, role, is_owner) values
    (v_venue_id, v_owner_id,   'Jordan Rivera', 'owner@example.com',   'Owner',            'owner',   true),
    (v_venue_id, v_manager_id, 'Sam Whitfield', 'manager@example.com', 'Venue Manager',    'manager', false);

  -- ── Client (the couple) ──────────────────────────────────────────────────
  insert into public.clients (
    id, venue_id, status, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, guest_count
  ) values (
    v_client_id, v_venue_id, 'confirmed', 'Emma', 'Carter', 'emma.carter@example.com', '555-0142',
    'Jordan', 'Lee', 'jordan.lee@example.com',
    'wedding', v_event_date, 120
  );

  -- ── Event ─────────────────────────────────────────────────────────────────
  insert into public.events (
    id, venue_id, client_id, status, name, event_type, event_date, start_time, end_time, guest_count
  ) values (
    v_event_id, v_venue_id, v_client_id, 'confirmed', 'Emma & Jordan''s Wedding', 'wedding', v_event_date,
    '16:00', '23:00', 120
  );

  -- ── Contract (signed) ────────────────────────────────────────────────────
  insert into public.contracts (
    id, venue_id, client_id, event_id, title, content, status, signer_name, signed_at, sent_at
  ) values (
    v_contract_id, v_venue_id, v_client_id, v_event_id,
    'Wedding Venue Agreement — Emma & Jordan',
    E'This agreement confirms the booking of Seed Venue for Emma Carter & Jordan Lee''s wedding.\n\nEvent date: ' || v_event_date || E'\nGuest count: 120\n\nBy signing below, both parties agree to the terms of this booking.',
    'signed', 'Emma Carter', now() - interval '10 days', now() - interval '14 days'
  );

  -- ── Guests ────────────────────────────────────────────────────────────────
  insert into public.couple_guests (venue_id, client_id, first_name, last_name, rsvp_status, is_wedding_party, sort_order) values
    (v_venue_id, v_client_id, 'Alex',     'Nguyen',   'attending', true,  1),
    (v_venue_id, v_client_id, 'Priya',    'Shah',     'attending', false, 2),
    (v_venue_id, v_client_id, 'Marcus',   'Johnson',  'declined',  false, 3),
    (v_venue_id, v_client_id, 'Olivia',   'Bennett',  'maybe',     false, 4),
    (v_venue_id, v_client_id, 'Daniel',   'Kim',      'pending',   false, 5);

  -- ── Vendor ────────────────────────────────────────────────────────────────
  -- vendors is a shared, cross-venue directory (Vendor Marketplace) — the
  -- per-venue relationship (preference level, notes) lives in
  -- venue_vendor_relationships, not on the vendor row itself.
  insert into public.vendors (id, business_name, category, contact_name, email, phone, website_url) values
    (v_vendor_id, 'Golden Hour Photography', 'photography', 'Riley Tran', 'riley@goldenhourphoto.example', '555-0177', 'https://goldenhourphoto.example');

  insert into public.venue_vendor_relationships (venue_id, vendor_id, status, preference_level, notes) values
    (v_venue_id, v_vendor_id, 'active', 'preferred', 'Preferred photographer — great with outdoor ceremonies.');

  -- ── Invoice ───────────────────────────────────────────────────────────────
  insert into public.invoices (
    id, venue_id, client_id, event_id, invoice_number, status,
    subtotal, tax_amount, total, balance_due, due_date, issued_at
  ) values (
    v_invoice_id, v_venue_id, v_client_id, v_event_id, 'INV-SEED-0001', 'sent',
    12000.00, 960.00, 12960.00, 6480.00, v_event_date - interval '30 days', now() - interval '14 days'
  );

  -- ── Timeline ──────────────────────────────────────────────────────────────
  insert into public.timeline_sections (id, venue_id, event_id, name, sort_order) values
    (v_section_id, v_venue_id, v_event_id, 'Ceremony & Reception', 1);

  insert into public.timeline_entries (venue_id, event_id, section_id, title, description, entry_time, sort_order) values
    (v_venue_id, v_event_id, v_section_id, 'Guest arrival',    'Doors open, welcome drinks served.',        '15:30', 1),
    (v_venue_id, v_event_id, v_section_id, 'Ceremony',         'Processional begins.',                       '16:00', 2),
    (v_venue_id, v_event_id, v_section_id, 'Cocktail hour',    'Reception space flips while cocktails served.', '16:30', 3),
    (v_venue_id, v_event_id, v_section_id, 'Reception & dinner', 'Grand entrance, first dance, dinner service.', '17:30', 4),
    (v_venue_id, v_event_id, v_section_id, 'Send-off',         'Sparkler exit.',                             '22:45', 5);

end $$;
