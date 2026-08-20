-- ============================================================================
-- Migration Center — commit-race protection.
--
-- Closes a real correctness gap: two concurrent commit requests for the
-- same session (double-click, two open tabs, a retried request) could
-- both read the same `validated`/`approved` record before either wrote
-- `committed`, creating two domain entities from one source row.
--
-- Fix: an atomic claim, at the database layer, via a conditional UPDATE —
-- the same pattern this codebase already uses for exactly this class of
-- problem (facebook_lead_queue's atomic claim). `status` itself is left
-- untouched during the attempt (still `validated`/`approved`) — only
-- `claimed_at`/`claimed_by` change — so nothing about the existing status
-- vocabulary, the resumability state machine, or the human-readable
-- history view needs to change. A claim is a conditional
-- `UPDATE ... WHERE status IN (...) AND claimed_at IS NULL`: Postgres's own
-- row-level locking guarantees at most one concurrent UPDATE can match a
-- given row — the second racing request affects zero rows and knows it
-- lost, without any application-level lock.
-- ============================================================================

alter table public.migration_records
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by uuid;

comment on column public.migration_records.claimed_at is
  'Set atomically (conditional UPDATE ... WHERE claimed_at IS NULL) when a commit attempt begins processing this record — the mechanism that makes concurrent commit requests race-safe. Cleared on both success and failure. A record claimed longer than the staleness threshold with no resolution (a crashed/killed process) is released by releaseStaleClaims() so a later commit can retry it.';
comment on column public.migration_records.claimed_by is
  'Audit only (the venue user or HQ admin id that attempted this commit) — not itself part of the correctness guarantee, which comes from the conditional UPDATE on claimed_at.';

create index if not exists migration_records_in_flight_claims
  on public.migration_records (session_id, claimed_at)
  where claimed_at is not null;

notify pgrst, 'reload schema';
