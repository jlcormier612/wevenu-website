-- Communication Trust Experience — Phase 7, Diagnostics.
--
-- The admin-only diagnostics view (app/admin/venues/[venueId]) needs to
-- read a venue's raw communication data — provider payloads, webhook
-- history, queue status — for a venue that is never the logged-in HQ
-- admin's own. Every communication table's RLS policy today is strictly
-- "your own venue" (owner_user_id = auth.uid() / current_user_venue_id()),
-- so without this, the diagnostics view would silently see zero rows for
-- every venue but the admin's own — the same class of gap already closed
-- for `clients` (see `clients_hq_select`, 20260711000001). Postgres RLS
-- policies are additive (OR'd), so this is a new SELECT-only policy
-- alongside the existing owner policy, not a replacement — no existing
-- access is touched.

create policy "messages_hq_select" on public.messages
  for select to authenticated using (public.is_hq_admin());

create policy "message_threads_hq_select" on public.message_threads
  for select to authenticated using (public.is_hq_admin());

create policy "message_events_hq_select" on public.message_events
  for select to authenticated using (public.is_hq_admin());

create policy "conversation_messages_hq_select" on public.conversation_messages
  for select to authenticated using (public.is_hq_admin());

create policy "conversation_message_events_hq_select" on public.conversation_message_events
  for select to authenticated using (public.is_hq_admin());

create policy "scheduled_messages_hq_select" on public.scheduled_messages
  for select to authenticated using (public.is_hq_admin());
