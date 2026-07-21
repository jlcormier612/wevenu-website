-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 5: flip the default on.
--
-- Every new venue now provisions directly onto the canonical Conversation
-- architecture. Every existing venue is backfilled to the same state — this
-- was always a per-venue staged-rollout flag (dogfood → opt-in beta →
-- default-on → retirement, per lib/venue/types.ts's own doc comment) with
-- no toggle UI ever built, so there is no "opt out" surface to preserve;
-- flipping the column is the actual rollout step, not a formality.
--
-- The column itself is NOT dropped — kept as the real, permanent record of
-- which venues are on the canonical experience, and as a safety valve
-- (still directly editable via SQL) during the initial post-rollout window.
-- ============================================================================

alter table public.venues
  alter column conversation_experience_enabled set default true;

update public.venues
  set conversation_experience_enabled = true
  where conversation_experience_enabled = false;
