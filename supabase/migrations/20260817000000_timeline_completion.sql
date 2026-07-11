-- ============================================================================
-- Timeline Experience Completion
--
-- Requirement 3 asks for Complete/Incomplete on each item — timeline_entries
-- already has a `status` column ('not_started'|'in_progress'|'complete',
-- added in Sprint 81 for the live Wedding Day Dashboard run-of-show toggle)
-- that the Booking Timeline editor's own type/repository layer never
-- exposed. Reusing it here rather than adding a second, redundant
-- completion flag — both surfaces now read/write the same column, so
-- marking an item complete in one place is reflected in the other.
--
-- The one genuinely new column is assigned_to_staff_id, reusing venue_staff
-- — the same table Planning Tasks already assign to (assigned_to_staff_id)
-- — so "Assigned To" means the same roster everywhere in the app.
--
-- Timeline Templates, the Client Timeline, and Guest Timeline are untouched.
-- ============================================================================

alter table public.timeline_entries
  add column assigned_to_staff_id uuid references public.venue_staff (id) on delete set null;

create index timeline_entries_assigned_to on public.timeline_entries (assigned_to_staff_id) where assigned_to_staff_id is not null;

notify pgrst, 'reload schema';
