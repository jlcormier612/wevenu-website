-- Public Forms starters: durable idempotency key per venue.
-- Starters are venue-owned draft forms; never auto-published.
-- Additive only. Does not publish, delete, or rewrite form content.

alter table public.public_forms
  add column if not exists starter_key text;

comment on column public.public_forms.starter_key is
  'Platform starter identity (e.g. general_venue_inquiry). Null for venue-authored forms. Never overwrite when present.';

-- Backfill keys for already-installed platform starters (exact internal_name match only).
-- Safe for Willow Grove drafts already present in Sandbox; skips customized/renamed forms.
update public.public_forms
set starter_key = 'general_venue_inquiry'
where starter_key is null
  and internal_name = 'General Venue Inquiry';

update public.public_forms
set starter_key = 'wedding_expo_lead_capture'
where starter_key is null
  and internal_name = 'Wedding Expo Lead Capture';

update public.public_forms
set starter_key = 'open_house_tour_interest'
where starter_key is null
  and internal_name = 'Open House & Tour Interest';

update public.public_forms
set starter_key = 'private_social_event_inquiry'
where starter_key is null
  and internal_name = 'Private & Social Event Inquiry';

create unique index if not exists public_forms_venue_starter_key_uidx
  on public.public_forms (venue_id, starter_key)
  where starter_key is not null;
