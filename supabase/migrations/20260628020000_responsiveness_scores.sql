-- ============================================================================
-- Sprint 37 — Responsiveness & Interest Score Columns
--
-- Two new score dimensions on leads, completing the first phase of the
-- three-axis engagement model (Interest + Responsiveness + Commitment).
--
-- All three scores: 0–100, monotonic only for Commitment.
-- Interest and Responsiveness decay with time; Commitment does not.
-- ============================================================================

alter table public.leads
  add column responsiveness_score smallint not null default 0
    check (responsiveness_score >= 0 and responsiveness_score <= 100),
  add column interest_score smallint not null default 0
    check (interest_score >= 0 and interest_score <= 100);

-- Index for "Who needs attention today?" dashboard queries
create index leads_responsiveness on public.leads (venue_id, responsiveness_score desc)
  where status not in ('won', 'lost', 'cancelled');

create index leads_interest on public.leads (venue_id, interest_score desc)
  where status not in ('won', 'lost', 'cancelled');

notify pgrst, 'reload schema';
