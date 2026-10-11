-- Venue-controlled contact details in customer-facing email footers.
-- Display preferences only — does not alter stored email/phone/signature values.
alter table public.venues
  add column if not exists email_footer_show_signature boolean not null default true,
  add column if not exists email_footer_show_email boolean not null default true,
  add column if not exists email_footer_show_phone boolean not null default false;

comment on column public.venues.email_footer_show_signature is
  'When true, venues.email_signature is rendered in the customer-facing email footer. '
  'Does not change the stored signature text.';

comment on column public.venues.email_footer_show_email is
  'When true, venues.email may appear on the customer-facing email contact line. '
  'Does not change the stored contact email.';

comment on column public.venues.email_footer_show_phone is
  'When true, venues.phone may appear on the customer-facing email contact line. '
  'Defaults false so phone is opt-in. Does not change the stored phone number.';
