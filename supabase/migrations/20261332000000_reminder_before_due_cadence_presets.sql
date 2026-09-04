-- ============================================================================
-- Expand client reminder "before due" cadence presets beyond weekly|none.
-- Offsets are fixed batches relative to payment/contract due dates — not
-- booking-date scheduling (at_booking belongs to payment due-date timing).
-- ============================================================================

alter table public.venue_reminder_cadence
  drop constraint if exists venue_reminder_cadence_payment_before_due_cadence_check;

alter table public.venue_reminder_cadence
  drop constraint if exists venue_reminder_cadence_contract_before_due_cadence_check;

alter table public.venue_reminder_cadence
  add constraint venue_reminder_cadence_payment_before_due_cadence_check
  check (payment_before_due_cadence in (
    'weekly', 'once_week', 'once_two_weeks', 'on_due', 'none'
  ));

alter table public.venue_reminder_cadence
  add constraint venue_reminder_cadence_contract_before_due_cadence_check
  check (contract_before_due_cadence in (
    'weekly', 'once_week', 'once_two_weeks', 'on_due', 'none'
  ));

comment on table public.venue_reminder_cadence is
  'Named reminder cadence presets relative to obligation due dates. '
  'Before-due: weekly=[21,14,7], once_week=[7], once_two_weeks=[14], on_due=[0], none=[]. '
  'At-booking payment timing is configured on payment schedules, not here.';
