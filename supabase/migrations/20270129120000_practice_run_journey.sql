-- Practice Run guided journey progress and practice-booked state.
-- Additive only. Does not change operational booking, contracts, or reporting.
-- Sandbox apply authorized for this file only. DO NOT APPLY to Production.

alter table public.practice_runs
  add column if not exists journey jsonb not null default '{}'::jsonb;

alter table public.practice_runs
  add column if not exists practice_booked_at timestamptz;

alter table public.practice_runs
  drop constraint if exists practice_runs_journey_object;

alter table public.practice_runs
  add constraint practice_runs_journey_object
  check (jsonb_typeof(journey) = 'object');

comment on column public.practice_runs.journey is
  'PM-02 guided venue-side journey progress and practice simulation snapshots. Not operational CRM state.';

comment on column public.practice_runs.practice_booked_at is
  'Practice-only booked marker. Never writes events.booked_at and never occupies calendar or SaaS volume.';
