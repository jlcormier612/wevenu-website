-- Public inquiry sends two independent emails (couple thank-you and venue
-- notice). notification_status stays the venue/coordinator result. The
-- thank-you result is stored separately so one send cannot overwrite the other.

alter table public.lead_intake_attempts
  add column if not exists inquirer_notification_status text,
  add column if not exists venue_notification_status text;

alter table public.lead_intake_attempts
  drop constraint if exists lead_intake_attempts_inquirer_notification_status_check;

alter table public.lead_intake_attempts
  add constraint lead_intake_attempts_inquirer_notification_status_check
  check (
    inquirer_notification_status is null
    or inquirer_notification_status in ('sent', 'failed', 'skipped')
  );

alter table public.lead_intake_attempts
  drop constraint if exists lead_intake_attempts_venue_notification_status_check;

alter table public.lead_intake_attempts
  add constraint lead_intake_attempts_venue_notification_status_check
  check (
    venue_notification_status is null
    or venue_notification_status in ('sent', 'failed', 'skipped')
  );

comment on column public.lead_intake_attempts.inquirer_notification_status is
  'Couple thank-you or confirmation email outcome. Independent of the venue notice.';

comment on column public.lead_intake_attempts.venue_notification_status is
  'Venue notice outcome. Independent of the couple thank-you.';

comment on column public.lead_intake_attempts.notification_status is
  'Venue/coordinator notification outcome for this attempt. Not the couple thank-you.';
