-- ============================================================================
-- Phase 4 — Floor Plan as the operational representation of Event Order
-- ============================================================================
-- Adds the one checkpoint Floor Plans didn't have (per
-- docs/booking-financial-architecture-phase4-floor-plan-design.md §1/§4):
-- a "Final" moment to anchor the reconciliation check against. Mirrors
-- `event_orders.finalized_at`'s exact shape rather than inventing a new
-- status vocabulary — nullable timestamp, cleared (not deleted) to reopen.
--
-- No RLS change needed here — traced directly against the current schema
-- (not assumed from an earlier draft of the design doc): `floor_plans` and
-- `floor_plan_objects` were already moved onto the modern
-- `current_user_venue_id()` policy pattern by
-- 20260708120000_sprint107_team_collaboration.sql, before this phase even
-- started. `event_order_sections.floor_plan_id` already exists from Phase 2
-- (20260923000000_event_order_foundation.sql) — this migration only adds
-- what was genuinely missing.
-- ============================================================================

alter table public.floor_plans
  add column if not exists finalized_at timestamptz;

-- ---- setSectionFloorPlan support -------------------------------------------
-- event_order_sections.floor_plan_id already exists (Phase 2); no schema
-- change needed to link a Section to a Floor Plan. Confirming the index
-- Phase 4's reconciliation query will actually use exists.
create index if not exists event_order_sections_floor_plan
  on public.event_order_sections (floor_plan_id)
  where floor_plan_id is not null;

notify pgrst, 'reload schema';
