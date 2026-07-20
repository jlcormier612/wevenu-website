-- ============================================================================
-- Commitment Alignment Sprint — backfill the "Submit your guest count"
-- stock task's auto_complete_trigger for venues that already applied the
-- Standard Wedding Client Planning template before this sprint wired
-- guest_count_finalized into lib/playbooks/constants.ts. Narrowly scoped
-- (exact title match, only where the trigger is currently unset) so this
-- can't touch a coordinator's own customized task of the same name that
-- deliberately kept manual completion.
-- ============================================================================

update public.playbook_tasks
set auto_complete_trigger = 'guest_count_finalized'
where title = 'Submit your guest count' and auto_complete_trigger is null;

update public.event_tasks
set auto_complete_trigger = 'guest_count_finalized'
where title = 'Submit your guest count' and auto_complete_trigger is null
  and status in ('pending', 'blocked', 'overdue');
