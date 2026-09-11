-- Retire Planning task dependencies (product decision: tasks are independent).
--
-- Columns retained for schema compatibility / migration safety — they become
-- inert from a product perspective:
--   playbook_tasks.depends_on_task_id
--   event_tasks.depends_on_event_task_id
--
-- Historical SQL RPCs that still contain "unblock dependents" loops become
-- no-ops after this cleanup (they only match rows with a dependency FK and
-- status = 'blocked'). Application code no longer writes or reads these as
-- workflow instructions. Triggers below prevent reactivation.

-- 1) Clear template dependency relationships
UPDATE public.playbook_tasks
SET depends_on_task_id = NULL
WHERE depends_on_task_id IS NOT NULL;

-- 2) Clear event dependency relationships
UPDATE public.event_tasks
SET depends_on_event_task_id = NULL
WHERE depends_on_event_task_id IS NOT NULL;

-- 3) Normalize dependency-created blocked tasks to independently actionable.
-- Only status = 'blocked' (the historical dependency-waiting state). Do not
-- rewrite complete / waived / cancelled / other meaningful states.
UPDATE public.event_tasks
SET status = 'pending',
    updated_at = now()
WHERE status = 'blocked';

-- 4) Keep columns inert going forward
CREATE OR REPLACE FUNCTION public.enforce_independent_planning_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.depends_on_event_task_id := NULL;
  IF NEW.status = 'blocked' THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_independent_planning_tasks ON public.event_tasks;
CREATE TRIGGER trg_enforce_independent_planning_tasks
  BEFORE INSERT OR UPDATE ON public.event_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_independent_planning_tasks();

CREATE OR REPLACE FUNCTION public.enforce_independent_playbook_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.depends_on_task_id := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_independent_playbook_tasks ON public.playbook_tasks;
CREATE TRIGGER trg_enforce_independent_playbook_tasks
  BEFORE INSERT OR UPDATE ON public.playbook_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_independent_playbook_tasks();

COMMENT ON COLUMN public.playbook_tasks.depends_on_task_id IS
  'COMPATIBILITY ONLY — Planning tasks are independent. Always NULL; do not use for workflow.';
COMMENT ON COLUMN public.event_tasks.depends_on_event_task_id IS
  'COMPATIBILITY ONLY — Planning tasks are independent. Always NULL; do not use for workflow.';
