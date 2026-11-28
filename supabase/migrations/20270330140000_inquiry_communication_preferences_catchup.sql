-- Production catch-up for inquiry communication preferences.
--
-- Stamp collision: Sandbox applied 20261366000000 as inquiry_communication_preferences.
-- Production applied the same version as typography_elegant_distinct_from_romantic, so
-- venues.inquiry_communication_settings and leads/clients.preferred_communication_channels
-- never landed on Production. Website Inquiry Form settings save writes
-- inquiry_communication_settings and fails with a column-missing error.
--
-- get_public_inquiry_form on Production already includes inquiryCommunicationSettings and
-- tourProtection* (from later tips). Do not replace that function here — only add the
-- missing columns. Idempotent on Sandbox where objects already exist.

alter table public.venues
  add column if not exists inquiry_communication_settings jsonb not null
  default jsonb_build_object(
    'askPreferences', false,
    'offerEmail', true,
    'offerSms', true,
    'offerPhoneCall', true,
    'requestSmsPermission', true
  );

comment on column public.venues.inquiry_communication_settings is
  'Venue lead-form communication preference + SMS permission request config. SMS options must still be gated by texting readiness in application code.';

alter table public.leads
  add column if not exists preferred_communication_channels text[] not null default '{}';

comment on column public.leads.preferred_communication_channels is
  'Preferred contact channels chosen on the inquiry form: email, sms, and/or phone_call. Not SMS permission.';

alter table public.clients
  add column if not exists preferred_communication_channels text[] not null default '{}';

comment on column public.clients.preferred_communication_channels is
  'Preferred contact channels (email, sms, phone_call). Not SMS permission.';

notify pgrst, 'reload schema';
