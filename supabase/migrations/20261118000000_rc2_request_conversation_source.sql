-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 4: Request ↔ Conversation
-- cross-linking.
--
-- Reuses the existing source_feature/source_id "origin" pattern (Wedding
-- Workspace Request Experience, Phase 1) rather than adding a dedicated
-- conversation_id column — a Request created from a Conversation is the
-- same kind of fact as one created from Planning or Documents: which
-- feature/record it came from. source_id holds the conversation's id
-- directly (not a specific message id) — "remove dead ends so users can
-- move naturally between operational work and the discussion that
-- produced it" only needs to land back on the thread, not one exact line.
-- ============================================================================

alter table public.requests drop constraint requests_source_feature_check;
alter table public.requests add constraint requests_source_feature_check check (
  source_feature is null or source_feature in (
    'planning', 'timeline', 'documents', 'contracts', 'floor_plans', 'guests', 'manual', 'conversation'
  )
);
