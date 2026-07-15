-- Calendar — Manual Wedding/Event Booking Placeholder.
--
-- A venue absolutely has "bride walked in and booked on paper," "imported
-- from another system," "phone reservation," "tentative hold before full
-- onboarding" — situations where a coordinator needs to say "this date is
-- booked" without the full Lead/Booking workflow yet. date_holds already
-- exists for a *lead's* provisional reservation (DateHoldInput.leadId is
-- required) — it cannot represent a date with no Lead at all. This is that
-- missing case, and it's added the same way the Manual Type Redesign
-- already added eight other manual types: same table (calendar_blocks
-- remains the one thing Calendar itself authors), same ownership boundary,
-- a few new nullable columns meaningful only for the two new "Bookings"
-- types (wedding_event_booking, private_event) — never populated, never
-- read, for any of the other seven.
--
-- converted_lead_id is the one column that matters beyond display: once
-- set (by "Convert to Booking," which creates a real Lead through the
-- exact same createLead the New Inquiry form already uses — no parallel
-- Lead-creation logic), the placeholder stops being a placeholder and
-- starts being a receipt — "this date became Lead X" — rather than being
-- deleted, so a coordinator can always see where a given date's booking
-- actually came from.

alter table public.calendar_blocks
  add column event_type text null,
  add column client_name text null,
  add column guest_count integer null check (guest_count is null or guest_count >= 0),
  add column estimated_revenue numeric(10, 2) null check (estimated_revenue is null or estimated_revenue >= 0),
  add column converted_lead_id uuid null references public.leads (id) on delete set null;

alter table public.calendar_blocks drop constraint calendar_blocks_type_check;
alter table public.calendar_blocks
  add constraint calendar_blocks_type_check
  check (type = any (array[
    'tour', 'consultation', 'client_meeting', 'walkthrough', 'tasting',
    'vendor_meeting', 'wedding_event_booking', 'private_event',
    'personal_appointment', 'blocked_time', 'other'
  ]));

create index calendar_blocks_converted_lead on public.calendar_blocks (converted_lead_id) where converted_lead_id is not null;

notify pgrst, 'reload schema';
