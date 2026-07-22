-- ============================================================================
-- Email Intake Self-Service — Sprint 3, Item 2.
--
-- Every venue already gets a working lead_email_key automatically (fixed
-- in 20261130000000), so key-presence alone can't distinguish "hasn't
-- connected yet" from "connected." This one column is a pure UX gate for
-- the Settings "Not Connected -> Connect" flow — it has no effect on
-- whether the underlying forwarding address actually works, which it
-- always does once a key exists.
-- ============================================================================

alter table public.venues
  add column if not exists email_intake_connected_at timestamptz;

notify pgrst, 'reload schema';
