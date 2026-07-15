-- ============================================================================
-- Notification Delivery Engine — missing service_role grants
-- (found while testing Planning's escalation sweep, docs/planning-release-readiness.md)
--
-- lib/notifications/engine.ts's processReminders() runs as service_role (a
-- cron job, no staff session) and reads/writes clients, tour_appointments,
-- venues, client_portal_sessions, notification_log, and updates
-- task_reminders. None of these had grants for service_role — rolbypassrls
-- bypasses RLS policies, but does not imply table-level privileges (the same
-- gap already found and fixed for Automation, Platform Events, and
-- Request-lifecycle wraps). Confirmed live: every reminder cron run was
-- throwing "permission denied for table clients" and failing silently —
-- Task Reminders have never actually been delivered.
-- ============================================================================

grant select on public.clients                 to service_role;
grant select on public.tour_appointments       to service_role;
grant select on public.venues                  to service_role;
grant select on public.client_portal_sessions  to service_role;
grant insert on public.notification_log        to service_role;
grant update on public.task_reminders          to service_role;

notify pgrst, 'reload schema';
