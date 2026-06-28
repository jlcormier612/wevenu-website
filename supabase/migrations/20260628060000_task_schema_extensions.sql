-- ============================================================================
-- Sprint 40.5 — Task Schema Extensions (reservations before Sprint 41)
--
-- Additive nullable columns — no existing queries affected.
-- Establishing schema now prevents migrations when automation is built.
--
-- 1. Recurrence on playbook_tasks
--    Powers future "remind every 3 days until submitted" sequences.
--
-- 2. Source tracking on event_tasks
--    Records what auto-completed a task (contract_id, payment_id, etc.)
--    Enables audit trail, intelligent Luv observations, and portal deep-links.
-- ============================================================================

-- Recurrence fields on template task definitions
alter table public.playbook_tasks
  add column reminder_interval_days integer    -- remind every N days until complete
    check (reminder_interval_days is null or reminder_interval_days > 0),
  add column reminder_max_count     integer    -- max reminder sends (null = unlimited)
    check (reminder_max_count is null or reminder_max_count > 0);

-- Source tracking on event task instances
alter table public.event_tasks
  add column source_type text
    check (source_type is null or source_type in (
      'contract',       -- completed because contract was signed
      'payment',        -- completed because payment was received
      'questionnaire',  -- completed because questionnaire was submitted
      'timeline',       -- completed because timeline entries were added
      'floor_plan',     -- completed because floor plan was created
      'document',       -- completed because a document was uploaded
      'manual',         -- completed manually by coordinator
      'system'          -- completed by an automated system action
    )),
  add column source_id uuid;  -- FK to the specific record (type-dependent, not enforced at DB level)

-- Index for source lookups (e.g., "which tasks did this contract complete?")
create index event_tasks_source on public.event_tasks (source_type, source_id)
  where source_type is not null;

notify pgrst, 'reload schema';
