-- Sprint 108.5 (step 4): Wevenu HQ — Support/Ops, Analytics, System Health
--
-- These three modules read tables the earlier Sprint 108.5 migration didn't
-- need to touch: notification_log (email/SMS delivery outcomes),
-- task_reminders (the reminder-delivery backlog), and
-- venue_notification_preferences (per-venue digest send state). Same
-- additive `*_hq_select` pattern as before — extends read access for
-- is_hq_admin() without narrowing anything.

create policy "notification_log_hq_select"
  on public.notification_log for select to authenticated
  using (public.is_hq_admin());

create policy "task_reminders_hq_select"
  on public.task_reminders for select to authenticated
  using (public.is_hq_admin());

create policy "venue_notification_preferences_hq_select"
  on public.venue_notification_preferences for select to authenticated
  using (public.is_hq_admin());

notify pgrst, 'reload schema';
