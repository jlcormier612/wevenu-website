-- ============================================================================
-- Calendar Integration — Phase 1: Time-Aware Planning
--
-- Planning currently models due dates ("when should this be finished").
-- Calendar needs scheduled work ("when does this actually happen") — a
-- different concept, per docs/calendar-platform-integration.md. This adds
-- exactly that, additively, to the one table that already owns Planning's
-- operational state (event_tasks) — no new table, no redesign of
-- Playbooks/Templates/Dependencies/Milestones/due-date behavior.
--
-- All four columns are nullable and default to null. A task with none of
-- them set behaves in every way exactly as it does today — due-date-only
-- remains the default and by far the most common shape. Only a task where
-- a coordinator would actually travel somewhere, meet someone, or need to
-- be present at a specific time (Final Walkthrough, Client Meeting, Vendor
-- Meeting, Rehearsal, Venue Visit — or any custom task a coordinator marks
-- this way) ever gets these filled in.
--
-- scheduled_start_time requires scheduled_date (a time with no date makes
-- no sense); scheduled_end_time, if present, must not precede
-- scheduled_start_time. location has no such dependency — a coordinator
-- may note a location before nailing down the exact time.
-- ============================================================================

alter table public.event_tasks
  add column scheduled_date       date,
  add column scheduled_start_time time,
  add column scheduled_end_time   time,
  add column location             text;

alter table public.event_tasks
  add constraint event_tasks_scheduled_start_requires_date
    check (scheduled_start_time is null or scheduled_date is not null);

alter table public.event_tasks
  add constraint event_tasks_scheduled_end_after_start
    check (
      scheduled_end_time is null
      or scheduled_start_time is null
      or scheduled_end_time >= scheduled_start_time
    );

-- Calendar's own query (getCalendarData) filters on this directly — an
-- index keeps "every scheduled activity this month, across the venue"
-- cheap regardless of how large event_tasks grows.
create index event_tasks_scheduled_date on public.event_tasks (venue_id, scheduled_date) where scheduled_date is not null;

notify pgrst, 'reload schema';
