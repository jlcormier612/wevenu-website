-- Optional scheduled date for a lead space preference (e.g. rehearsal dinner).
-- Distinct from calendar holds: a hold protects availability; this date is the
-- venue's agreed component date for contract merge when set.

alter table public.lead_event_space_preferences
  add column if not exists scheduled_date date;

comment on column public.lead_event_space_preferences.scheduled_date is
  'Optional agreed date for this event component (e.g. rehearsal dinner). Not inferred from date_holds.';
