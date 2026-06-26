-- ============================================================================
-- Sprint 8 — Getting Started / Onboarding
-- A single boolean on the venue that records whether the owner has manually
-- dismissed the Getting Started card. Completion is derived from existing data
-- (lead count, tour dates, status values) — no separate progress table needed.
-- ============================================================================

alter table public.venues
  add column onboarding_dismissed boolean not null default false;

notify pgrst, 'reload schema';
