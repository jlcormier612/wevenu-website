-- Appointment types checklist for onboarding intake (and Settings mirror).
-- Yes/No still uses offers_tastings_or_appointments (renamed in UI only).
-- Types are operator/intake metadata — they do not configure calendar scheduling.

alter table public.venue_onboarding_intake
  add column if not exists appointment_type_keys text[] not null default '{}';

alter table public.venue_onboarding_intake
  add column if not exists appointment_types_other text;

comment on column public.venue_onboarding_intake.appointment_type_keys is
  'Selected appointment kinds when offers_tastings_or_appointments is true: consultations, planning_meetings, final_walkthroughs, menu_tastings, other.';

comment on column public.venue_onboarding_intake.appointment_types_other is
  'Free-text description when appointment_type_keys includes other.';
