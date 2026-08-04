-- Venue Lifecycle Automation Completion Pass (2026-08-04), Phase 5/9 finding.
--
-- task_reminders' founding migration (20260628120000_notification_foundation.sql)
-- granted select/insert/update/delete to `authenticated` only. But
-- lib/notifications/engine.ts's processReminders() — the reminder delivery
-- engine — deliberately runs as a service-role client, not an authenticated
-- session (its own header comment: "needs to write notification_log
-- bypassing RLS ... the engine runs as a system process"). service_role
-- bypasses RLS itself, but that is a separate mechanism from table-level
-- GRANTs — without an explicit grant, service_role has no privilege on
-- this table at all, and every real run of the reminder sweep has been
-- failing with "permission denied for table task_reminders" since this
-- table was created. Confirmed live via a real end-to-end lifecycle test
-- (see docs/venue-lifecycle-automation-completion-report.md, Phase 5) —
-- this was not a hypothetical gap, it was reproduced against real queued
-- reminders. Every comparable table these engines touch directly (not
-- through a SECURITY DEFINER RPC) already has this grant — task_reminders
-- was the one outlier.

grant select, insert, update, delete on public.task_reminders to service_role;
