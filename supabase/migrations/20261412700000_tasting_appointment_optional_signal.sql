-- Replace the four-way tasting/appointment choice with one optional signal.
-- Yes is an operator note only. It does not configure appointment scheduling.
-- Historical neither stays false so White Glove still sees an explicit No.
-- Historical tastings / other appointments / both stay true.
-- Null stays unanswered.

alter table public.venue_onboarding_intake
  add column if not exists offers_tastings_or_appointments boolean;

update public.venue_onboarding_intake
set offers_tastings_or_appointments = case tasting_appointment_choice
  when 'tastings' then true
  when 'other_appointments' then true
  when 'both' then true
  when 'neither' then false
  else offers_tastings_or_appointments
end
where tasting_appointment_choice is not null;

alter table public.venue_onboarding_intake
  drop column if exists tasting_appointment_choice;
