-- ============================================================================
-- Task Action Centers — Schema Reservation
--
-- "A task should not tell someone what to do. It should give them a place to do it."
--
-- Tasks evolve from checklist items → action centers.
-- Each task can carry a direct action button that routes the user to exactly
-- the place where the work gets done.
--
-- Examples:
--   Pay Final Invoice → [Pay Now] → /p/{token}/payments
--   Upload Insurance  → [Upload Document] → /p/{token}/documents
--   Complete Questionnaire → [Continue] → /questionnaire/{key}
--   Sign Contract → [Sign Contract] → /sign/{token}
--
-- These columns are reserved now, activated in a future sprint.
-- Adding them now means no migration is needed when the feature ships.
-- ============================================================================

-- ── action fields on playbook_tasks (template definitions) ──────────────────

alter table public.playbook_tasks
  add column action_type  text,   -- see list below
  add column action_url   text,   -- deep link; may use {portal_token}, {embed_key} template vars
  add column action_label text,   -- button label; null = inferred from action_type
  add column instructions text;   -- public-facing guidance (shown to couple/vendor in portal)

-- ── action fields on event_tasks (instances) ────────────────────────────────

alter table public.event_tasks
  add column action_type     text,
  add column action_url      text,
  add column action_label    text,
  add column instructions    text,
  add column progress_state  text check (progress_state in (
    'not_started',   -- work has not begun
    'in_progress',   -- some work done but not complete
    'complete'       -- complete (mirrors status for tasks with intermediate states)
  ));
-- progress_state is null = binary task (pending/complete, no intermediate)
-- set progress_state when a task has meaningful in-between states:
--   - questionnaire: not_started → in_progress (some fields) → complete
--   - payment plan: not_started → in_progress (partial payment) → complete

-- ── supported action_type values (enforced in application, not DB) ───────────
-- pay_invoice          → Pay Now          → /invoices/{id} | /p/{token}/payments
-- upload_document      → Upload Document  → /p/{token}/documents | /events/{id}
-- complete_questionnaire → Continue       → /questionnaire/{key}
-- sign_contract        → Sign Contract    → /sign/{token}
-- add_vendors          → Add Vendors      → /events/{id} (vendors tab)
-- schedule_tour        → Schedule a Tour  → /book/{key}
-- review_timeline      → View Timeline    → /events/{id} (timeline tab)
-- create_floor_plan    → Open Floor Plan  → /events/{id} (floor plan tab)
-- view_in_portal       → Open             → /p/{token}/{section}
-- custom_url           → coordinator-defined label and URL

notify pgrst, 'reload schema';
