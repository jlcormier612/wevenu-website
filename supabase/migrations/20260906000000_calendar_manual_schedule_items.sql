-- ============================================================================
-- Calendar Manual Type Redesign
--
-- Calendar's one manually-authored table, calendar_blocks, was built for
-- exactly one concept: "the venue is unavailable this day." Venues don't
-- think that way — they think in terms of scheduling activities, of which
-- being closed is only one kind. This migration reframes the same table
-- (same ownership: Calendar-owned, same architecture: no new tables, no
-- write path into any other feature) around a general `type` a coordinator
-- picks when adding a manual entry — Tour, Consultation, Client Meeting,
-- Walkthrough, Tasting, Vendor Meeting, Personal Appointment, Blocked Time,
-- Other — with the pre-existing `reason` (maintenance/private_event/
-- holiday/staff_training/other) preserved exactly as-is, now scoped as the
-- sub-reason for the one type that still needs it: Blocked Time.
--
-- This changes nothing about the ownership boundary
-- (docs/calendar-platform-integration.md §1): calendar_blocks remains the
-- one thing Calendar itself authors; every other item on Calendar stays
-- read-only, owned by its source feature. A manually-created "Tour" or
-- "Client Meeting" schedule item is a Calendar-owned record that happens
-- to be labeled the way a real tour_appointments row or a real Planning
-- task already is — it never writes into leads, tour_appointments,
-- event_tasks, or requests, and a coordinator who wants a *tracked* tour or
-- a *tracked* Planning meeting still uses those features' own real
-- workflows, unchanged.
-- ============================================================================

alter table public.calendar_blocks
  add column if not exists type text not null default 'blocked_time';

alter table public.calendar_blocks
  add constraint calendar_blocks_type_check
  check (type = any (array[
    'tour', 'consultation', 'client_meeting', 'walkthrough', 'tasting',
    'vendor_meeting', 'personal_appointment', 'blocked_time', 'other'
  ]));

-- reason is now meaningful only for type = 'blocked_time' — every other
-- type has no sub-reason concept, so it must be able to go unset.
alter table public.calendar_blocks alter column reason drop not null;
alter table public.calendar_blocks alter column reason drop default;

alter table public.calendar_blocks drop constraint if exists calendar_blocks_reason_check;
alter table public.calendar_blocks
  add constraint calendar_blocks_reason_check
  check (reason is null or reason = any (array[
    'maintenance', 'private_event', 'holiday', 'staff_training', 'other'
  ]));

notify pgrst, 'reload schema';
