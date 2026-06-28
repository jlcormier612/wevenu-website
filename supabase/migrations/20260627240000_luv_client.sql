-- ============================================================================
-- Sprint 32 — Luv Client Workspace
--
-- Expands luv_drafts.draft_type to support client-stage drafts.
-- ============================================================================

-- Drop the existing draft_type check constraint and re-add with client types
alter table public.luv_drafts
  drop constraint luv_drafts_draft_type_check;

alter table public.luv_drafts
  add constraint luv_drafts_draft_type_check
  check (draft_type in (
    -- Lead stage drafts (Sprint 27)
    'follow_up_email', 'follow_up_text', 'next_steps', 'timeline',
    -- Client stage drafts (Sprint 32)
    'welcome_email',       -- sent right after booking conversion
    'planning_kickoff',    -- sent as planning begins
    'payment_reminder',    -- gentle nudge when payment is coming due
    'final_details'        -- "let's finalize your details" message
  ));

notify pgrst, 'reload schema';
