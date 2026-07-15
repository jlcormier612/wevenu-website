-- ============================================================================
-- Planning — Escalation Sweep (docs/planning-release-readiness.md, Fix #2)
--
-- escalation_after_days has been settable on a Planning task since Task
-- Scheduling/Reminders shipped, but nothing ever read it — a coordinator
-- could configure "escalate 2 days after due" and it would silently do
-- nothing forever (confirmed: zero references outside lib/playbooks/*).
--
-- This migration adds the one column the sweep needs to stay idempotent
-- (escalated_at — "have we already escalated this task") and the grants
-- lib/notifications/engine.ts's new processEscalations() needs to run as
-- the service role, same posture as the existing reminder engine.
-- ============================================================================

alter table public.event_tasks
  add column escalated_at timestamptz;

comment on column public.event_tasks.escalated_at is
  'Set once the escalation sweep has notified the venue for this task — prevents re-notifying on every sweep run.';

-- ── Service-role grants for the sweep ──────────────────────────────────────
-- The sweep runs alongside processReminders() in the same service-role
-- context (lib/notifications/engine.ts, called from /api/notifications/process).
grant update on public.event_tasks to service_role;

grant execute on function public.create_venue_notification(uuid, uuid, text, text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
