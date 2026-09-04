-- Venue-configurable email signature/footer for outbound client emails.
alter table public.venues
  add column if not exists email_signature text;

comment on column public.venues.email_signature is
  'Plain-text email signature/footer appended to applicable outbound venue emails. '
  'Rendered in the branded email shell; not used for SMS.';
